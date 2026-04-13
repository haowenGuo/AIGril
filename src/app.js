import { VRMModelSystem } from './vrm-model-system.js';
import { TTSAudioPlayer } from './tts-audio-player.js';
import { ChatTTSSystem } from './chat-tts-system.js';
import { createChatService } from './chat-service.js';
import { ResourceLibraryPanel } from './resource-library-panel.js';
import { RuntimeShowController } from './runtime-show-controller.js';
import { applyRuntimeIdentityToDocument, loadActiveRuntimeIdentity } from './runtime-avatar-package.js';


window.addEventListener('DOMContentLoaded', async () => {
    const { activePackage, identity: runtimeIdentity } = await loadActiveRuntimeIdentity();
    applyRuntimeIdentityToDocument(runtimeIdentity);

    const vrmSystem = new VRMModelSystem();
    const audioPlayer = new TTSAudioPlayer(vrmSystem);
    const chatService = createChatService(runtimeIdentity);
    const chatSystem = new ChatTTSSystem(vrmSystem, audioPlayer, chatService, runtimeIdentity);
    const resourceLibraryPanel = new ResourceLibraryPanel({
        vrmSystem,
        notify: (message) => chatSystem.addSystemMessage(message)
    });
    const runtimeShowController = new RuntimeShowController({
        vrmSystem,
        chatSystem,
        activePackage,
        announce: (message) => chatSystem.addSystemMessage(message)
    });

    vrmSystem.init('canvas-container');
    await Promise.all([
        vrmSystem.loadModel(),
        resourceLibraryPanel.init(),
        runtimeShowController.init()
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
    window.runtimeShowController = runtimeShowController;
    window.runtimeIdentity = runtimeIdentity;
    window.activeRuntimePackage = activePackage;

    window.addEventListener('runtimePackageRegistryChanged', async () => {
        const { activePackage: nextPackage, identity: nextIdentity } = await loadActiveRuntimeIdentity();
        applyRuntimeIdentityToDocument(nextIdentity);
        runtimeShowController.setActivePackage(nextPackage);
        chatSystem.runtimeIdentity = nextIdentity;
        if ('runtimeIdentity' in chatService) {
            chatService.runtimeIdentity = nextIdentity;
        }
        window.runtimeIdentity = nextIdentity;
        window.activeRuntimePackage = nextPackage;
    });
});
