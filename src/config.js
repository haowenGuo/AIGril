import * as THREE from 'three';
import { CUE_INTENSITY_LEVELS, EXPRESSION_NAMES, MOTION_CATEGORIES } from './cue-utils.js';

function getRuntimeSettings() {
    if (typeof window === 'undefined') {
        return {
            backendBaseUrl: 'http://localhost:8000',
            demoModeEnabled: false,
            isGitHubPages: false,
            runtimeShell: 'web',
            isElectronShell: false
        };
    }

    const url = new URL(window.location.href);
    const queryBackend = url.searchParams.get('backend')?.trim();
    const forceDemo = url.searchParams.get('demo') === '1';
    const runtimeShell = (url.searchParams.get('shell') || '').trim().toLowerCase() || 'web';

    if (queryBackend) {
        window.localStorage.setItem('aigril_backend_base_url', queryBackend);
    }

    const storedBackend = (
        window.localStorage.getItem('aigril_backend_base_url') ||
        window.localStorage.getItem('airi_backend_base_url')
    )?.trim();
    const backendBaseUrl = queryBackend || storedBackend || 'http://localhost:8000';
    const isGitHubPages = window.location.hostname.endsWith('github.io');
    const demoModeEnabled = forceDemo || (isGitHubPages && !queryBackend && !storedBackend);

    return {
        backendBaseUrl,
        demoModeEnabled,
        isGitHubPages,
        runtimeShell,
        isElectronShell: runtimeShell === 'electron'
    };
}

const runtimeSettings = getRuntimeSettings();

export const CONFIG = {
    MODEL_PATH: 'Resources/AiGril.vrm',
    MOTION_CATALOG_PATH: 'Resources/motion-catalog.json',
    RESOURCE_LIBRARY_PATH: 'Resources/resource-library.json',
    MOTION_CATEGORIES,
    CUE_INTENSITY_LEVELS,
    EXPRESSION_NAMES,
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
    RUNTIME_SHELL: runtimeSettings.runtimeShell,
    IS_ELECTRON_SHELL: runtimeSettings.isElectronShell,
    BACKEND_STREAM_API_URL: `${runtimeSettings.backendBaseUrl}/api/chat`,
    BACKEND_TTS_API_URL: `${runtimeSettings.backendBaseUrl}/api/chat/tts`,
    BACKEND_TEXT_API_URL: `${runtimeSettings.backendBaseUrl}/api/chat/text`,
    AUTO_CHAT_MIN_INTERVAL: 60000,
    AUTO_CHAT_MAX_INTERVAL: 120000
};
