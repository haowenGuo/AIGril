const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    Tray,
    nativeImage,
    protocol,
    session,
    screen,
    shell
} = require('electron');
const { DesktopASRManager } = require('./local-asr-manager.cjs');
const {
    DEFAULT_PET_SCALE,
    PET_SCALE_OPTIONS,
    SPEECH_MODE_OPTIONS,
    getScaledPetSize,
    loadDesktopState,
    normalizeRecognitionMode,
    normalizeSpeechMode,
    normalizePreferredMicDeviceId,
    normalizePetScale,
    resizePetBounds,
    saveDesktopState
} = require('./store.cjs');

const DEFAULT_DEV_SERVER_URL = 'http://127.0.0.1:5173';
const devServerUrl = process.env.AIGRIL_DESKTOP_DEV_URL || '';
const PET_MIN_SIZE = getScaledPetSize(PET_SCALE_OPTIONS[0]);
const CHAT_MIN_WIDTH = 360;
const CHAT_MIN_HEIGHT = 420;
const SPEECH_MODEL_PROTOCOL = 'aigril-model';
const SPEECH_MODEL_CACHE_DIRNAME = 'speech-models';
const SPEECH_MODEL_REMOTE_HOSTS = {
    modelscope: 'https://www.modelscope.cn/models/',
    huggingface: 'https://huggingface.co/'
};

let petWindow = null;
let chatWindow = null;
let tray = null;
let isQuitting = false;
let desktopState = null;
let desktopASRManager = null;
const windowPersistTimers = new Map();
const speechModelDownloadTasks = new Map();

if (typeof protocol?.registerSchemesAsPrivileged === 'function') {
    protocol.registerSchemesAsPrivileged([
        {
            scheme: SPEECH_MODEL_PROTOCOL,
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                corsEnabled: true,
                stream: true
            }
        }
    ]);
}

function isDevMode() {
    return Boolean(devServerUrl);
}

function buildRendererUrl(pageName) {
    if (isDevMode()) {
        return `${devServerUrl || DEFAULT_DEV_SERVER_URL}/${pageName}`;
    }
    return path.join(__dirname, '..', 'dist', pageName);
}

function ensureSafePathSegments(rawValue, fieldName) {
    const segments = String(rawValue || '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (!segments.length) {
        throw new Error(`缺少 ${fieldName}`);
    }

    for (const segment of segments) {
        if (
            segment === '.' ||
            segment === '..' ||
            segment.includes('\\') ||
            segment.includes(':')
        ) {
            throw new Error(`${fieldName} 含有非法路径片段`);
        }
    }

    return segments;
}

function resolveSpeechModelFilePath(rootDir, { source, model, revision, filename }) {
    const rootPath = path.resolve(rootDir);
    const targetPath = path.resolve(
        rootPath,
        source,
        ...ensureSafePathSegments(model, 'model'),
        revision,
        ...ensureSafePathSegments(filename, 'filename')
    );

    if (!targetPath.startsWith(rootPath)) {
        throw new Error('语音模型路径越界');
    }

    return targetPath;
}

function getSpeechModelCacheRoot() {
    return path.join(app.getPath('userData'), SPEECH_MODEL_CACHE_DIRNAME);
}

function getBundledSpeechModelRoots() {
    return [
        path.join(process.resourcesPath, 'speech-models'),
        path.join(app.getAppPath(), 'Resources', 'speech-models'),
        path.join(app.getAppPath(), 'dist', 'Resources', 'speech-models')
    ];
}

function guessSpeechModelMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.json') {
        return 'application/json; charset=utf-8';
    }
    if (ext === '.txt') {
        return 'text/plain; charset=utf-8';
    }
    if (ext === '.wasm') {
        return 'application/wasm';
    }
    if (ext === '.js' || ext === '.mjs') {
        return 'text/javascript; charset=utf-8';
    }
    return 'application/octet-stream';
}

function getSpeechAssetVariants(asset) {
    const orderedSources = [asset.source, ...Object.keys(SPEECH_MODEL_REMOTE_HOSTS)]
        .filter(Boolean)
        .filter((source, index, items) => items.indexOf(source) === index);

    return orderedSources.map((source) => ({
        ...asset,
        source
    }));
}

async function createFileResponse(filePath) {
    const fileBuffer = await fsp.readFile(filePath);
    return new Response(fileBuffer, {
        headers: {
            'content-type': guessSpeechModelMimeType(filePath),
            'content-length': String(fileBuffer.byteLength)
        }
    });
}

async function findBundledSpeechModelFile(asset) {
    for (const rootDir of getBundledSpeechModelRoots()) {
        for (const variant of getSpeechAssetVariants(asset)) {
            const candidatePath = resolveSpeechModelFilePath(rootDir, variant);
            if (fs.existsSync(candidatePath)) {
                return candidatePath;
            }
        }
    }

    return null;
}

function buildSpeechModelRemoteUrl({ source, model, revision, filename }) {
    const host = SPEECH_MODEL_REMOTE_HOSTS[source];
    if (!host) {
        throw new Error(`不支持的语音模型源：${source}`);
    }

    return new URL(
        `${model}/resolve/${encodeURIComponent(revision)}/${filename}`,
        host
    ).toString();
}

async function downloadSpeechModelAsset(asset) {
    const cachePath = resolveSpeechModelFilePath(getSpeechModelCacheRoot(), asset);
    const existingTask = speechModelDownloadTasks.get(cachePath);
    if (existingTask) {
        return existingTask;
    }

    const task = (async () => {
        if (fs.existsSync(cachePath)) {
            return createFileResponse(cachePath);
        }

        const remoteUrl = buildSpeechModelRemoteUrl(asset);
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            return response;
        }

        const responseBuffer = Buffer.from(await response.arrayBuffer());
        await fsp.mkdir(path.dirname(cachePath), { recursive: true });
        await fsp.writeFile(cachePath, responseBuffer);

        return new Response(responseBuffer, {
            headers: {
                'content-type': response.headers.get('content-type') || guessSpeechModelMimeType(cachePath),
                'content-length': String(responseBuffer.byteLength)
            }
        });
    })();

    speechModelDownloadTasks.set(cachePath, task);
    try {
        return await task;
    } finally {
        speechModelDownloadTasks.delete(cachePath);
    }
}

async function downloadSpeechModelAssetWithFallback(asset) {
    const variants = getSpeechAssetVariants(asset);
    let lastResponse = null;
    let lastError = null;

    for (const variant of variants) {
        try {
            const response = await downloadSpeechModelAsset(variant);
            if (response.ok || variant.source === variants[variants.length - 1]?.source) {
                return response;
            }
            lastResponse = response;
        } catch (error) {
            lastError = error;
        }
    }

    if (lastResponse) {
        return lastResponse;
    }

    throw lastError || new Error('语音模型资源下载失败');
}

async function handleSpeechModelProtocol(request) {
    const targetUrl = new URL(request.url);
    const asset = {
        source: targetUrl.searchParams.get('source') || 'modelscope',
        model: targetUrl.searchParams.get('model') || '',
        revision: targetUrl.searchParams.get('revision') || 'main',
        filename: targetUrl.searchParams.get('filename') || ''
    };

    try {
        for (const variant of getSpeechAssetVariants(asset)) {
            const cachePath = resolveSpeechModelFilePath(getSpeechModelCacheRoot(), variant);
            if (fs.existsSync(cachePath)) {
                return createFileResponse(cachePath);
            }
        }

        const bundledPath = await findBundledSpeechModelFile(asset);
        if (bundledPath) {
            return createFileResponse(bundledPath);
        }

        return downloadSpeechModelAssetWithFallback(asset);
    } catch (error) {
        return new Response(String(error.message || error), {
            status: 500,
            headers: {
                'content-type': 'text/plain; charset=utf-8'
            }
        });
    }
}

function makeTrayIcon() {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
            <rect width="64" height="64" rx="14" fill="#73b8e5"/>
            <text x="50%" y="58%" text-anchor="middle" font-size="28" font-family="Segoe UI, Arial" fill="#ffffff">AG</text>
        </svg>
    `;

    return nativeImage
        .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
        .resize({ width: 16, height: 16 });
}

function clampBoundsToDisplay(bounds, minimumWidth = 320, minimumHeight = 320) {
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;
    const width = Math.min(Math.max(bounds.width, minimumWidth), workArea.width);
    const height = Math.min(Math.max(bounds.height, minimumHeight), workArea.height);

    return {
        ...bounds,
        width,
        height,
        x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
        y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height)
    };
}

function persistDesktopState() {
    desktopState = saveDesktopState(app, desktopState);
    refreshTrayMenu();
}

function getRendererPreferences() {
    return {
        petSkipTaskbar: Boolean(desktopState?.preferences?.petSkipTaskbar),
        petScale: normalizePetScale(desktopState?.preferences?.petScale || DEFAULT_PET_SCALE),
        speechMode: normalizeSpeechMode(desktopState?.preferences?.speechMode),
        recognitionMode: normalizeRecognitionMode(desktopState?.preferences?.recognitionMode),
        preferredMicDeviceId: normalizePreferredMicDeviceId(desktopState?.preferences?.preferredMicDeviceId)
    };
}

function broadcastPreferencesUpdated() {
    const payload = {
        preferences: getRendererPreferences()
    };

    petWindow?.webContents.send('aigril:preferences-updated', payload);
    chatWindow?.webContents.send('aigril:preferences-updated', payload);
}

function updateWindowState(key, window, options = {}) {
    if (!window || !desktopState?.[key]) {
        return;
    }

    const minimumWidth = key === 'petWindow' ? PET_MIN_SIZE.width : CHAT_MIN_WIDTH;
    const minimumHeight = key === 'petWindow' ? PET_MIN_SIZE.height : CHAT_MIN_HEIGHT;

    desktopState[key].bounds = clampBoundsToDisplay(
        window.getBounds(),
        minimumWidth,
        minimumHeight
    );
    desktopState[key].visible = window.isVisible();

    if (options.immediate) {
        persistDesktopState();
        return;
    }

    clearTimeout(windowPersistTimers.get(key));
    windowPersistTimers.set(key, setTimeout(() => {
        persistDesktopState();
        windowPersistTimers.delete(key);
    }, 120));
}

function hookWindowPersistence(key, window) {
    window.on('move', () => updateWindowState(key, window));
    window.on('resize', () => updateWindowState(key, window));
    window.on('show', () => updateWindowState(key, window, { immediate: true }));
    window.on('hide', () => updateWindowState(key, window, { immediate: true }));
    window.on('closed', () => {
        clearTimeout(windowPersistTimers.get(key));
        windowPersistTimers.delete(key);
    });
}

function openExternalLinks(window) {
    window.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });
}

function loadWindowContent(window, pageName) {
    if (isDevMode()) {
        return window.loadURL(buildRendererUrl(pageName));
    }
    return window.loadFile(buildRendererUrl(pageName));
}

function registerMediaPermissionHandlers() {
    const defaultSession = session.defaultSession;
    if (!defaultSession) {
        return;
    }

    defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        return permission === 'media';
    });

    defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
        const requestsAudio = Array.isArray(details?.mediaTypes) && details.mediaTypes.includes('audio');
        callback(permission === 'media' && requestsAudio);
    });
}

function showChatWindow() {
    if (!chatWindow) {
        createChatWindow();
    }

    if (!chatWindow.isVisible()) {
        chatWindow.show();
    }

    chatWindow.focus();
}

function hideChatWindow() {
    if (chatWindow?.isVisible()) {
        chatWindow.hide();
    }
}

function toggleChatWindow() {
    if (!chatWindow || !chatWindow.isVisible()) {
        showChatWindow();
        return true;
    }

    hideChatWindow();
    return false;
}

function quitApplication() {
    isQuitting = true;
    app.quit();
}

function applyPetScale(scale) {
    if (!desktopState) {
        return;
    }

    const normalizedScale = normalizePetScale(scale);
    const referenceBounds = petWindow ? petWindow.getBounds() : desktopState.petWindow.bounds;
    const nextBounds = clampBoundsToDisplay(
        resizePetBounds(referenceBounds, normalizedScale),
        PET_MIN_SIZE.width,
        PET_MIN_SIZE.height
    );

    desktopState.preferences.petScale = normalizedScale;
    desktopState.petWindow.bounds = nextBounds;

    if (petWindow) {
        petWindow.setBounds(nextBounds);
        petWindow.show();
        petWindow.focus();
    }

    persistDesktopState();
}

function buildPetScaleMenu() {
    const currentScale = normalizePetScale(desktopState?.preferences?.petScale || DEFAULT_PET_SCALE);

    return PET_SCALE_OPTIONS.map((scale) => ({
        label: `${Math.round(scale * 100)}%`,
        type: 'radio',
        checked: currentScale === scale,
        click: () => applyPetScale(scale)
    }));
}

function getSpeechModeLabel(mode) {
    if (mode === 'local') {
        return '本地简易语音';
    }
    if (mode === 'off') {
        return '关闭语音';
    }
    return 'AI语音（服务端）';
}

function buildControlMenuTemplate({ includeTaskbarToggle = false } = {}) {
    const template = [
        {
            label: '聊天',
            click: () => showChatWindow()
        },
        {
            label: '语音模式',
            submenu: SPEECH_MODE_OPTIONS.map((mode) => ({
                label: getSpeechModeLabel(mode),
                type: 'radio',
                checked: getRendererPreferences().speechMode === mode,
                click: () => updateSpeechMode(mode)
            }))
        },
        {
            label: '缩放',
            submenu: buildPetScaleMenu()
        }
    ];

    if (includeTaskbarToggle) {
        template.push(
            { type: 'separator' },
            {
                label: '桌宠显示在任务栏',
                type: 'checkbox',
                checked: !desktopState.preferences.petSkipTaskbar,
                click: (menuItem) => {
                    desktopState.preferences.petSkipTaskbar = !menuItem.checked;
                    if (petWindow) {
                        petWindow.setSkipTaskbar(desktopState.preferences.petSkipTaskbar);
                    }
                    persistDesktopState();
                }
            }
        );
    }

    template.push(
        { type: 'separator' },
        {
            label: '退出',
            click: () => quitApplication()
        }
    );

    return template;
}

function buildPetContextMenu() {
    return Menu.buildFromTemplate(buildControlMenuTemplate());
}

function showControlMenu(targetWindow = petWindow) {
    if (!targetWindow || targetWindow.isDestroyed()) {
        return false;
    }

    buildPetContextMenu().popup({ window: targetWindow });
    return true;
}

function createPetWindow() {
    const petState = desktopState.petWindow;
    const petBounds = clampBoundsToDisplay(petState.bounds, PET_MIN_SIZE.width, PET_MIN_SIZE.height);

    petWindow = new BrowserWindow({
        ...petBounds,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        resizable: false,
        movable: true,
        alwaysOnTop: true,
        skipTaskbar: desktopState.preferences.petSkipTaskbar,
        show: Boolean(petState.visible),
        title: 'AIGril Pet',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    petWindow.setAlwaysOnTop(true, 'screen-saver');
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    openExternalLinks(petWindow);
    hookWindowPersistence('petWindow', petWindow);

    petWindow.on('close', (event) => {
        if (isQuitting) {
            return;
        }
        event.preventDefault();
        petWindow.hide();
        hideChatWindow();
    });

    petWindow.on('closed', () => {
        petWindow = null;
    });

    void loadWindowContent(petWindow, 'pet.html');
    if (!desktopState.petWindow.visible) {
        petWindow.hide();
    }
}

function createChatWindow() {
    const chatState = desktopState.chatWindow;
    const chatBounds = clampBoundsToDisplay(chatState.bounds, CHAT_MIN_WIDTH, CHAT_MIN_HEIGHT);

    chatWindow = new BrowserWindow({
        ...chatBounds,
        frame: false,
        transparent: false,
        backgroundColor: '#f8fbff',
        hasShadow: true,
        resizable: true,
        show: false,
        skipTaskbar: false,
        alwaysOnTop: true,
        title: 'AIGril Chat',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    openExternalLinks(chatWindow);
    hookWindowPersistence('chatWindow', chatWindow);

    chatWindow.on('close', (event) => {
        if (isQuitting) {
            return;
        }
        event.preventDefault();
        chatWindow.hide();
    });

    chatWindow.on('closed', () => {
        chatWindow = null;
    });

    void loadWindowContent(chatWindow, 'chat.html').then(() => {
        if (desktopState.chatWindow.visible) {
            chatWindow.show();
        }
    });
}

function refreshTrayMenu() {
    if (!tray) {
        return;
    }

    const menu = Menu.buildFromTemplate([
        {
            label: petWindow?.isVisible() ? '隐藏桌宠' : '显示桌宠',
            click: () => {
                if (!petWindow) {
                    createPetWindow();
                    return;
                }
                if (petWindow.isVisible()) {
                    petWindow.hide();
                    hideChatWindow();
                } else {
                    petWindow.show();
                    petWindow.focus();
                }
            }
        },
        {
            label: '聊天',
            click: () => showChatWindow()
        },
        ...buildControlMenuTemplate({ includeTaskbarToggle: true })
    ]);

    tray.setContextMenu(menu);
    tray.setToolTip('AIGril 桌宠');
}

function createTray() {
    tray = new Tray(makeTrayIcon());
    tray.on('double-click', () => {
        if (!petWindow) {
            createPetWindow();
            return;
        }
        petWindow.show();
        petWindow.focus();
    });
    refreshTrayMenu();
}

function updateSpeechMode(nextMode) {
    if (!desktopState?.preferences) {
        return getRendererPreferences();
    }

    desktopState.preferences.speechMode = normalizeSpeechMode(nextMode);
    persistDesktopState();
    broadcastPreferencesUpdated();
    return getRendererPreferences();
}

function updatePreferredMicDevice(nextDeviceId) {
    if (!desktopState?.preferences) {
        return getRendererPreferences();
    }

    desktopState.preferences.preferredMicDeviceId = normalizePreferredMicDeviceId(nextDeviceId);
    persistDesktopState();
    broadcastPreferencesUpdated();
    return getRendererPreferences();
}

function updateRecognitionMode(nextMode) {
    if (!desktopState?.preferences) {
        return getRendererPreferences();
    }

    desktopState.preferences.recognitionMode = normalizeRecognitionMode(nextMode);
    persistDesktopState();
    broadcastPreferencesUpdated();
    return getRendererPreferences();
}

function registerIpc() {
    ipcMain.on('aigril:get-preferences-sync', (event) => {
        event.returnValue = getRendererPreferences();
    });

    ipcMain.handle('aigril:toggle-chat-window', () => toggleChatWindow());
    ipcMain.handle('aigril:show-chat-window', () => {
        showChatWindow();
        return true;
    });
    ipcMain.handle('aigril:hide-chat-window', () => {
        hideChatWindow();
        return false;
    });
    ipcMain.handle('aigril:show-control-menu', (event) => {
        const sourceWindow = BrowserWindow.fromWebContents(event.sender);
        return showControlMenu(sourceWindow || petWindow);
    });
    ipcMain.handle('aigril:set-speech-mode', (_event, mode) => updateSpeechMode(mode));
    ipcMain.handle('aigril:set-recognition-mode', (_event, mode) => updateRecognitionMode(mode));
    ipcMain.handle('aigril:set-preferred-mic-device', (_event, deviceId) => updatePreferredMicDevice(deviceId));
    ipcMain.handle('aigril:asr-transcribe', async (_event, audioBytes) => {
        if (!desktopASRManager) {
            throw new Error('本地语音识别管理器尚未初始化');
        }

        return desktopASRManager.transcribeAudioBytes(audioBytes);
    });

    ipcMain.on('aigril:drag-pet-window', (_event, payload = {}) => {
        if (!petWindow) {
            return;
        }

        const bounds = petWindow.getBounds();
        const nextBounds = clampBoundsToDisplay({
            ...bounds,
            x: Math.round(bounds.x + Number(payload.deltaX || 0)),
            y: Math.round(bounds.y + Number(payload.deltaY || 0))
        }, PET_MIN_SIZE.width, PET_MIN_SIZE.height);

        petWindow.setBounds(nextBounds);
    });

    ipcMain.on('aigril:chat-send-message', (_event, payload = {}) => {
        petWindow?.webContents.send('aigril:chat-send-message', payload);
        showChatWindow();
    });

    ipcMain.on('aigril:pet-chat-event', (_event, payload = {}) => {
        if (chatWindow) {
            chatWindow.webContents.send('aigril:chat-event', payload);
        }
    });

    ipcMain.on('aigril:chat-state-sync-request', () => {
        petWindow?.webContents.send('aigril:chat-state-sync-request', {});
    });
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (petWindow) {
            petWindow.show();
            petWindow.focus();
        }
        showChatWindow();
    });
}

app.whenReady().then(() => {
    desktopState = loadDesktopState(app);
    desktopState = saveDesktopState(app, desktopState);
    desktopASRManager = new DesktopASRManager({ app });
    Menu.setApplicationMenu(null);
    registerMediaPermissionHandlers();
    protocol.handle(SPEECH_MODEL_PROTOCOL, handleSpeechModelProtocol);
    registerIpc();
    createPetWindow();
    createChatWindow();
    createTray();

    setTimeout(() => {
        desktopASRManager?.warmup?.().catch((error) => {
            console.warn('[ASR] 后台预热失败：', error.message || error);
        });
    }, 4000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createPetWindow();
            createChatWindow();
            if (!tray) {
                createTray();
            }
        } else if (petWindow) {
            petWindow.show();
        }
    });
});

app.on('before-quit', () => {
    isQuitting = true;
    desktopASRManager?.close?.();
});

app.on('window-all-closed', () => {
    // 托盘常驻形态下，窗口全部关闭并不等于退出应用。
});
