const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aigrilDesktop', {
    platform: 'electron',
    versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node
    },
    getBackendBaseUrl: () => ipcRenderer.invoke('aigril:get-backend-base-url')
});
