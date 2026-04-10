import { VRMModelSystem } from './vrm-model-system.js';
import { TTSAudioPlayer } from './tts-audio-player.js';
import { ChatTTSSystem } from './chat-tts-system.js';
import { createChatService } from './chat-service.js';


window.addEventListener('DOMContentLoaded', async () => {
    const vrmSystem = new VRMModelSystem();
    const audioPlayer = new TTSAudioPlayer(vrmSystem);
    const chatService = createChatService();
    const chatSystem = new ChatTTSSystem(vrmSystem, audioPlayer, chatService);

    vrmSystem.init('canvas-container');
    await vrmSystem.loadModel();

    window.vrmSystem = vrmSystem;
    window.audioPlayer = audioPlayer;
    window.chatService = chatService;
    window.chatSystem = chatSystem;
});
