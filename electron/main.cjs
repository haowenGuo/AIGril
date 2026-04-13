const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const {
    importAssets,
    loadPlatformState,
    readAssetText,
    resolveAssetUrl,
    savePlatformState
} = require('./resource-platform.cjs');

const DEFAULT_BACKEND_BASE_URL = 'https://airi-backend.onrender.com';
const DEFAULT_DEV_SERVER_URL = 'http://127.0.0.1:5173';

const backendBaseUrl = process.env.AIGRIL_BACKEND_URL || DEFAULT_BACKEND_BASE_URL;
const devServerUrl = process.env.AIGRIL_DESKTOP_DEV_URL || '';

function buildSearchParams() {
    const params = new URLSearchParams({
        shell: 'electron',
        backend: backendBaseUrl
    });

    return params.toString();
}

function buildDevUrl() {
    const url = new URL(devServerUrl || DEFAULT_DEV_SERVER_URL);
    const params = new URLSearchParams(url.search);

    for (const [key, value] of new URLSearchParams(buildSearchParams()).entries()) {
        params.set(key, value);
    }

    url.search = params.toString();
    return url.toString();
}

async function loadApp(window) {
    if (devServerUrl) {
        await window.loadURL(buildDevUrl());
        return;
    }

    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
        search: `?${buildSearchParams()}`
    });
}

function isExternalNavigation(targetUrl) {
    if (!targetUrl) {
        return false;
    }

    if (targetUrl.startsWith('file://')) {
        return false;
    }

    if (devServerUrl && targetUrl.startsWith(devServerUrl)) {
        return false;
    }

    try {
        const parsedUrl = new URL(targetUrl);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
        return false;
    }
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 960,
        minHeight: 640,
        title: 'AIGril',
        backgroundColor: '#f0f8ff',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isExternalNavigation(url)) {
            shell.openExternal(url);
        }

        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!isExternalNavigation(url)) {
            return;
        }

        event.preventDefault();
        shell.openExternal(url);
    });

    loadApp(mainWindow).catch((error) => {
        console.error('[AIGril Desktop] Failed to load app:', error);
    });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const [window] = BrowserWindow.getAllWindows();
        if (!window) {
            return;
        }

        if (window.isMinimized()) {
            window.restore();
        }
        window.focus();
    });

    app.whenReady().then(() => {
        ipcMain.handle('aigril:get-backend-base-url', () => backendBaseUrl);
        ipcMain.handle('aigril:load-resource-platform-state', () => loadPlatformState(app));
        ipcMain.handle('aigril:save-resource-platform-state', (_event, nextState) => savePlatformState(app, nextState || {}));
        ipcMain.handle('aigril:pick-and-import-assets', async () => {
            const result = await dialog.showOpenDialog({
                title: '导入本地授权资源',
                properties: ['openFile', 'multiSelections'],
                filters: [
                    {
                        name: '支持的资源文件',
                        extensions: [
                            'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus',
                            'lrc', 'txt', 'vtt', 'srt', 'ass',
                            'musicxml', 'mxl', 'mei', 'abc', 'krn', 'ly', 'mid', 'midi',
                            'vrma', 'fbx', 'glb', 'gltf', 'vmd'
                        ]
                    }
                ]
            });

            if (result.canceled || !result.filePaths.length) {
                return {
                    importedCount: 0,
                    skipped: [],
                    canceled: true,
                    state: loadPlatformState(app)
                };
            }

            return {
                ...importAssets(app, result.filePaths),
                canceled: false
            };
        });
        ipcMain.handle('aigril:read-asset-text', (_event, payload = {}) => (
            readAssetText(payload.path, payload.maxChars)
        ));
        ipcMain.handle('aigril:resolve-asset-url', (_event, payload = {}) => (
            resolveAssetUrl(payload.path)
        ));
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
