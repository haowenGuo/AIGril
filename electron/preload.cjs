const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aigrilDesktop', {
    platform: 'electron',
    versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node
    },
    getBackendBaseUrl: () => ipcRenderer.invoke('aigril:get-backend-base-url'),
    loadResourcePlatformState: () => ipcRenderer.invoke('aigril:load-resource-platform-state'),
    saveResourcePlatformState: (state) => ipcRenderer.invoke('aigril:save-resource-platform-state', state),
    importAuthorizedAssets: () => ipcRenderer.invoke('aigril:pick-and-import-assets'),
    readAssetText: (assetPath, maxChars) => ipcRenderer.invoke('aigril:read-asset-text', {
        path: assetPath,
        maxChars
    }),
    resolveAssetUrl: (assetPath) => ipcRenderer.invoke('aigril:resolve-asset-url', {
        path: assetPath
    })
});
