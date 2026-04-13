import { VRMModelSystem } from './vrm-model-system.js';
import { TTSAudioPlayer } from './tts-audio-player.js';
import { ChatTTSSystem } from './chat-tts-system.js';
import { createChatService } from './chat-service.js';
import { ResourceLibraryPanel } from './resource-library-panel.js';
import { applyRuntimeIdentityToDocument, loadActiveRuntimeIdentity } from './runtime-avatar-package.js';


window.addEventListener('DOMContentLoaded', async () => {
    const { identity: runtimeIdentity } = await loadActiveRuntimeIdentity();
    applyRuntimeIdentityToDocument(runtimeIdentity);

    const vrmSystem = new VRMModelSystem();
    const audioPlayer = new TTSAudioPlayer(vrmSystem);
    const chatService = createChatService(runtimeIdentity);
    const chatSystem = new ChatTTSSystem(vrmSystem, audioPlayer, chatService, runtimeIdentity);
    const resourceLibraryPanel = new ResourceLibraryPanel({
        vrmSystem,
        notify: (message) => chatSystem.addSystemMessage(message)
    });

    vrmSystem.init('canvas-container');
    await Promise.all([
        vrmSystem.loadModel(),
        resourceLibraryPanel.init()
    ]);

    if (runtimeIdentity?.defaultMotionCategory && runtimeIdentity.defaultMotionCategory !== 'idle') {
        void vrmSystem.playMotionCue({
            category: runtimeIdentity.defaultMotionCategory,
            intensity: 'medium'
        });
    }

    window.vrmSystem = vrmSystem;
    window.audioPlayer = audioPlayer;
    window.chatService = chatService;
    window.chatSystem = chatSystem;
    window.resourceLibraryPanel = resourceLibraryPanel;
    window.runtimeIdentity = runtimeIdentity;
});
