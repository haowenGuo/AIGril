const path = require('path');
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, shell } = require('electron');
const {
    DEFAULT_PET_SCALE,
    PET_SCALE_OPTIONS,
    getScaledPetSize,
    loadDesktopState,
    normalizePetScale,
    resizePetBounds,
    saveDesktopState
} = require('./store.cjs');

const DEFAULT_DEV_SERVER_URL = 'http://127.0.0.1:5173';
const devServerUrl = process.env.AIGRIL_DESKTOP_DEV_URL || '';
const PET_MIN_SIZE = getScaledPetSize(PET_SCALE_OPTIONS[0]);
const CHAT_MIN_WIDTH = 360;
const CHAT_MIN_HEIGHT = 420;

let petWindow = null;
let chatWindow = null;
let tray = null;
let isQuitting = false;
let desktopState = null;
const windowPersistTimers = new Map();

function isDevMode() {
    return Boolean(devServerUrl);
}

function buildRendererUrl(pageName) {
    if (isDevMode()) {
        return `${devServerUrl || DEFAULT_DEV_SERVER_URL}/${pageName}`;
    }
    return path.join(__dirname, '..', 'dist', pageName);
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

function buildPetContextMenu() {
    return Menu.buildFromTemplate([
        {
            label: '聊天',
            click: () => showChatWindow()
        },
        {
            label: '缩放',
            submenu: buildPetScaleMenu()
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => quitApplication()
        }
    ]);
}

function showPetContextMenu() {
    if (!petWindow) {
        return false;
    }

    buildPetContextMenu().popup({ window: petWindow });
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
        {
            label: '缩放',
            submenu: buildPetScaleMenu()
        },
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
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => quitApplication()
        }
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

function registerIpc() {
    ipcMain.handle('aigril:toggle-chat-window', () => toggleChatWindow());
    ipcMain.handle('aigril:show-chat-window', () => {
        showChatWindow();
        return true;
    });
    ipcMain.handle('aigril:hide-chat-window', () => {
        hideChatWindow();
        return false;
    });
    ipcMain.handle('aigril:show-pet-context-menu', () => showPetContextMenu());

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
    Menu.setApplicationMenu(null);
    registerIpc();
    createPetWindow();
    createChatWindow();
    createTray();

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
});

app.on('window-all-closed', () => {
    // 托盘常驻形态下，窗口全部关闭并不等于退出应用。
});
