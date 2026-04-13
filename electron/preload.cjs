const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aigrilDesktop', {
    platform: 'electron',
    versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node
    },
    toggleChatWindow: () => ipcRenderer.invoke('aigril:toggle-chat-window'),
    showChatWindow: () => ipcRenderer.invoke('aigril:show-chat-window'),
    hideChatWindow: () => ipcRenderer.invoke('aigril:hide-chat-window'),
    showPetContextMenu: () => ipcRenderer.invoke('aigril:show-pet-context-menu'),
    dragPetWindow: (deltaX, deltaY) => {
        ipcRenderer.send('aigril:drag-pet-window', { deltaX, deltaY });
    },
    sendChatMessage: (content) => {
        ipcRenderer.send('aigril:chat-send-message', { content });
    },
    emitChatEvent: (payload) => {
        ipcRenderer.send('aigril:pet-chat-event', payload || {});
    },
    requestChatStateSync: () => {
        ipcRenderer.send('aigril:chat-state-sync-request');
    },
    onChatMessageRequest: (listener) => {
        const wrapped = (_event, payload = {}) => listener(payload);
        ipcRenderer.on('aigril:chat-send-message', wrapped);
        return () => ipcRenderer.removeListener('aigril:chat-send-message', wrapped);
    },
    onChatStateSyncRequest: (listener) => {
        const wrapped = (_event, payload = {}) => listener(payload);
        ipcRenderer.on('aigril:chat-state-sync-request', wrapped);
        return () => ipcRenderer.removeListener('aigril:chat-state-sync-request', wrapped);
    },
    onChatEvent: (listener) => {
        const wrapped = (_event, payload = {}) => listener(payload);
        ipcRenderer.on('aigril:chat-event', wrapped);
        return () => ipcRenderer.removeListener('aigril:chat-event', wrapped);
    }
});
