import * as THREE from 'three';

function getRuntimeSettings() {
    if (typeof window === 'undefined') {
        return {
            backendBaseUrl: 'http://localhost:8000',
            demoModeEnabled: false,
            isGitHubPages: false
        };
    }

    const url = new URL(window.location.href);
    const queryBackend = url.searchParams.get('backend')?.trim();
    const forceDemo = url.searchParams.get('demo') === '1';

    if (queryBackend) {
        window.localStorage.setItem('airi_backend_base_url', queryBackend);
    }

    const storedBackend = window.localStorage.getItem('airi_backend_base_url')?.trim();
    const backendBaseUrl = queryBackend || storedBackend || 'http://localhost:8000';
    const isGitHubPages = window.location.hostname.endsWith('github.io');
    const demoModeEnabled = forceDemo || (isGitHubPages && !queryBackend && !storedBackend);

    return {
        backendBaseUrl,
        demoModeEnabled,
        isGitHubPages
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
        { name: 'vrma1', path: 'Resources/VRMA_MotionPack/vrma/VRMA_01.vrma' },
        { name: 'vrma2', path: 'Resources/VRMA_MotionPack/vrma/VRMA_02.vrma' },
        { name: 'vrma10', path: 'Resources/VRMA_MotionPack/vrma/VRMA_10.vrma' },
        { name: 'vrma11', path: 'Resources/VRMA_MotionPack/vrma/VRMA_11.vrma' },
        { name: 'vrma12', path: 'Resources/VRMA_MotionPack/vrma/VRMA_12.vrma' },
        { name: 'vrma13', path: 'Resources/VRMA_MotionPack/vrma/VRMA_13.vrma' },
        { name: 'vrma14', path: 'Resources/VRMA_MotionPack/vrma/VRMA_14.vrma' },
        { name: 'vrma15', path: 'Resources/VRMA_MotionPack/vrma/VRMA_15.vrma' },
        { name: 'vrma16', path: 'Resources/VRMA_MotionPack/vrma/VRMA_16.vrma' },
        { name: 'vrma18', path: 'Resources/VRMA_MotionPack/vrma/VRMA_18.vrma' },
        { name: 'vrma19', path: 'Resources/VRMA_MotionPack/vrma/VRMA_19.vrma' },
        { name: 'vrma20', path: 'Resources/VRMA_MotionPack/vrma/VRMA_20.vrma' },
        { name: 'vrma21', path: 'Resources/VRMA_MotionPack/vrma/VRMA_21.vrma' },
        { name: 'vrma22', path: 'Resources/VRMA_MotionPack/vrma/VRMA_22.vrma' },
        { name: 'vrma23', path: 'Resources/VRMA_MotionPack/vrma/VRMA_23.vrma' },
        { name: 'vrma24', path: 'Resources/VRMA_MotionPack/vrma/VRMA_24.vrma' },
        { name: 'vrma26', path: 'Resources/VRMA_MotionPack/vrma/VRMA_26.vrma' },
        { name: 'vrma27', path: 'Resources/VRMA_MotionPack/vrma/VRMA_27.vrma' },
        { name: 'vrma28', path: 'Resources/VRMA_MotionPack/vrma/VRMA_28.vrma' },
        { name: 'vrma29', path: 'Resources/VRMA_MotionPack/vrma/VRMA_29.vrma' },
        { name: 'vrma30', path: 'Resources/VRMA_MotionPack/vrma/VRMA_30.vrma' },
        { name: 'vrma31', path: 'Resources/VRMA_MotionPack/vrma/VRMA_31.vrma' },
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
    DANCE_ACTION_LIST: [
        'vrma1', 'vrma2', 'vrma10', 'vrma11', 'vrma12',
        'vrma13', 'vrma14', 'vrma15', 'vrma16', 'vrma17'
    ],
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
    DANCE_ACTION_DURATION_MS: 4800,
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
    AUTO_CHAT_MIN_INTERVAL: 60000,
    AUTO_CHAT_MAX_INTERVAL: 120000
};
