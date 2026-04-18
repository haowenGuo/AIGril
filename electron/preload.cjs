const { contextBridge, ipcRenderer } = require('electron');

const initialPreferences = ipcRenderer.sendSync('aigril:get-preferences-sync');

contextBridge.exposeInMainWorld('aigrilDesktop', {
    platform: 'electron',
    preferences: initialPreferences,
    versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node
    },
    toggleChatWindow: () => ipcRenderer.invoke('aigril:toggle-chat-window'),
    showChatWindow: () => ipcRenderer.invoke('aigril:show-chat-window'),
    hideChatWindow: () => ipcRenderer.invoke('aigril:hide-chat-window'),
    showControlMenu: () => ipcRenderer.invoke('aigril:show-control-menu'),
    setSpeechMode: (mode) => ipcRenderer.invoke('aigril:set-speech-mode', mode),
    setRecognitionMode: (mode) => ipcRenderer.invoke('aigril:set-recognition-mode', mode),
    setPreferredMicDevice: (deviceId) => ipcRenderer.invoke('aigril:set-preferred-mic-device', deviceId),
    transcribeAudio: (audioBytes) => ipcRenderer.invoke('aigril:asr-transcribe', audioBytes),
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
    },
    onPreferencesUpdated: (listener) => {
        const wrapped = (_event, payload = {}) => listener(payload);
        ipcRenderer.on('aigril:preferences-updated', wrapped);
        return () => ipcRenderer.removeListener('aigril:preferences-updated', wrapped);
    }
});
