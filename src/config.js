import * as THREE from 'three';

function getRuntimeSettings() {
    if (typeof window === 'undefined') {
        return {
            backendBaseUrl: 'http://localhost:8000',
            demoModeEnabled: false,
            isGitHubPages: false,
            speechMode: 'server'
        };
    }

    const url = new URL(window.location.href);
    const queryBackend = url.searchParams.get('backend')?.trim();
    const forceDemo = url.searchParams.get('demo') === '1';
    const querySpeechMode = url.searchParams.get('speechMode')?.trim().toLowerCase();
    const desktopPreferenceSpeechMode = window.aigrilDesktop?.preferences?.speechMode;

    if (queryBackend) {
        window.localStorage.setItem('aigril_backend_base_url', queryBackend);
    }
    if (querySpeechMode) {
        window.localStorage.setItem('aigril_speech_mode', querySpeechMode);
    }

    const storedBackend = (
        window.localStorage.getItem('aigril_backend_base_url') ||
        window.localStorage.getItem('airi_backend_base_url')
    )?.trim();
    const storedSpeechMode = (
        window.localStorage.getItem('aigril_speech_mode') ||
        desktopPreferenceSpeechMode ||
        'server'
    ).trim().toLowerCase();
    const backendBaseUrl = queryBackend || storedBackend || 'http://localhost:8000';
    const isGitHubPages = window.location.hostname.endsWith('github.io');
    const demoModeEnabled = forceDemo || (isGitHubPages && !queryBackend && !storedBackend);
    const requestedSpeechMode = querySpeechMode || storedSpeechMode || 'server';
    const speechMode = ['server', 'local', 'off', 'auto'].includes(requestedSpeechMode)
        ? requestedSpeechMode
        : 'server';

    return {
        backendBaseUrl,
        demoModeEnabled,
        isGitHubPages,
        speechMode
    };
}

const runtimeSettings = getRuntimeSettings();

export const CONFIG = {
    MODEL_PATH: 'Resources/AiGril.vrm',
    ANIMATION_FILES: [
        { name: 'idle', path: 'Resources/VRMA_MotionPack/vrma/Idle.vrma' },
        { name: 'idle1', path: 'Resources/VRMA_MotionPack/vrma/Idle1.vrma' },
        { name: 'idle2', path: 'Resources/VRMA_MotionPack/vrma/Idle2.vrma' },
        { name: 'vrma25', path: 'Resources/VRMA_MotionPack/vrma/VRMA_25.vrma' },
        { name: 'vrma17', path: 'Resources/VRMA_MotionPack/vrma/VRMA_17.vrma' },
        { name: 'angry', path: 'Resources/VRMA_MotionPack/vrma/Angry.vrma' },
        { name: 'blush', path: 'Resources/VRMA_MotionPack/vrma/Blush.vrma' },
        { name: 'sad', path: 'Resources/VRMA_MotionPack/vrma/Sad.vrma' },
        { name: 'sleepy', path: 'Resources/VRMA_MotionPack/vrma/Sleepy.vrma' },
        { name: 'surprised', path: 'Resources/VRMA_MotionPack/vrma/Surprised.vrma' },
        { name: 'lookaround', path: 'Resources/VRMA_MotionPack/vrma/LookAround.vrma' },
        { name: 'jump', path: 'Resources/VRMA_MotionPack/vrma/Jump.vrma' },
        { name: 'goodbye', path: 'Resources/VRMA_MotionPack/vrma/Goodbye.vrma' },
        { name: 'clapping', path: 'Resources/VRMA_MotionPack/vrma/Clapping.vrma' },
        { name: 'thinking', path: 'Resources/VRMA_MotionPack/vrma/Thinking.vrma' }
    ],
    IDLE_ACTION_LIST: ['idle', 'idle1', 'idle2'],
    DANCE_ACTION_LIST: ['vrma17', 'vrma25'],
    CROSS_FADE_DURATION: 0.4,
    RENDER_PIXEL_RATIO: 2,
    CAMERA_POSITION: new THREE.Vector3(0, 1.3, 1.1),
    CAMERA_TARGET: new THREE.Vector3(0, 1, 0),
    CAMERA_MIN_DISTANCE: 0.85,
    CAMERA_MAX_DISTANCE: 1.5,
    BLINK_MIN_INTERVAL: 2000,
    BLINK_MAX_INTERVAL: 5000,
    SPEAK_SPEED: 10,
    SPEAK_AMPLITUDE: 0.4,
    MAX_MOUTH_OPEN: 0.95,
    LIP_SYNC_SMOOTHING: 0.35,
    AUDIO_LIP_SYNC_DIVISOR: 70,
    AUDIO_LIP_SYNC_BOOST: 1.8,
    TEXT_SYNC_LEAD_SECONDS: 0.03,
    TEXT_ONLY_SPEECH_CHAR_MS: 85,
    TEXT_ONLY_SPEECH_MIN_MS: 1200,
    TEXT_ONLY_SPEECH_MAX_MS: 6500,
    EXPRESSION_RESET_DELAY_MS: 350,
    EXPRESSION_HOLD_MS: 2800,
    BLINK_EXPRESSION_HOLD_MS: 220,
    // 表情预设统一收口在这里。
    // 对话系统只传表情名，不直接控制数值。
    EXPRESSION_PRESETS: {
        happy: 0.4,
        angry: 0.55,
        sad: 0.72,
        relaxed: 0.65,
        surprised: 0.62,
        aa: 0.5,
        ih: 0.5,
        ou: 0.5,
        ee: 0.5,
        oh: 0.5,
        blink: 1.0,
        blinkLeft: 1.0,
        blinkRight: 1.0,
        neutral: 0.0
    },
    BACKEND_BASE_URL: runtimeSettings.backendBaseUrl,
    DEMO_MODE_ENABLED: runtimeSettings.demoModeEnabled,
    IS_GITHUB_PAGES: runtimeSettings.isGitHubPages,
    BACKEND_STREAM_API_URL: `${runtimeSettings.backendBaseUrl}/api/chat`,
    BACKEND_TTS_API_URL: `${runtimeSettings.backendBaseUrl}/api/chat/tts`,
    BACKEND_TEXT_API_URL: `${runtimeSettings.backendBaseUrl}/api/chat/text`,
    SPEECH_MODE: runtimeSettings.speechMode,
    ASR_SAMPLE_RATE: 16000,
    ASR_MAX_RECORD_MS: 12000,
    ASR_MIN_INPUT_LEVEL: 0.01,
    ASR_CONTINUOUS_SPEECH_LEVEL: 0.02,
    ASR_CONTINUOUS_SILENCE_MS: 1100,
    ASR_CONTINUOUS_IDLE_MS: 6500,
    ASR_CONTINUOUS_RESTART_MS: 450,
    ASR_CONTINUOUS_MIN_SPEECH_MS: 380,
    ASR_WAKE_WORD: '老婆',
    ASR_WAKE_WORD_ALIASES: ['老婆', '老 婆', '我老婆'],
    WEB_NATIVE_TTS_FALLBACK_ENABLED: true,
    DESKTOP_NATIVE_TTS_RATE: 0.96,
    DESKTOP_NATIVE_TTS_PITCH: 1.12,
    DESKTOP_NATIVE_TTS_VOLUME: 1,
    AUTO_CHAT_MIN_INTERVAL: 60000,
    AUTO_CHAT_MAX_INTERVAL: 120000
};
