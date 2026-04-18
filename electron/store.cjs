const fs = require('fs');
const path = require('path');
const { screen } = require('electron');

const STATE_FILE_NAME = 'desktop-state.json';
const STATE_VERSION = 4;
const PET_BASE_WIDTH = 360;
const PET_BASE_HEIGHT = 560;
const PET_SCALE_OPTIONS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1, 1.15];
const DEFAULT_PET_SCALE = 0.85;
const SPEECH_MODE_OPTIONS = ['local', 'server', 'off'];
const RECOGNITION_MODE_OPTIONS = ['manual'];

function normalizePreferredMicDeviceId(deviceId) {
    return String(deviceId || '').trim();
}

function normalizeSpeechMode(mode) {
    const normalizedMode = String(mode || '').trim().toLowerCase();
    return SPEECH_MODE_OPTIONS.includes(normalizedMode) ? normalizedMode : 'server';
}

function normalizeRecognitionMode(mode) {
    return 'manual';
}

function normalizePetScale(scale) {
    const numericScale = Number(scale);
    if (!Number.isFinite(numericScale)) {
        return DEFAULT_PET_SCALE;
    }

    return PET_SCALE_OPTIONS.reduce((closestScale, option) => {
        const nextDistance = Math.abs(option - numericScale);
        const closestDistance = Math.abs(closestScale - numericScale);
        return nextDistance < closestDistance ? option : closestScale;
    }, PET_SCALE_OPTIONS[0]);
}

function getScaledPetSize(scale = DEFAULT_PET_SCALE) {
    const normalizedScale = normalizePetScale(scale);
    return {
        width: Math.round(PET_BASE_WIDTH * normalizedScale),
        height: Math.round(PET_BASE_HEIGHT * normalizedScale)
    };
}

function resizePetBounds(bounds, scale = DEFAULT_PET_SCALE) {
    const nextSize = getScaledPetSize(scale);
    const centerX = bounds.x + bounds.width / 2;
    const bottomY = bounds.y + bounds.height;

    return {
        x: Math.round(centerX - nextSize.width / 2),
        y: Math.round(bottomY - nextSize.height),
        width: nextSize.width,
        height: nextSize.height
    };
}

function getDefaultState() {
    const workArea = screen.getPrimaryDisplay().workArea;
    const petScale = DEFAULT_PET_SCALE;
    const petSize = getScaledPetSize(petScale);
    const chatWidth = 420;
    const chatHeight = 620;

    const petX = workArea.x + workArea.width - petSize.width - 32;
    const petY = workArea.y + workArea.height - petSize.height - 24;
    const chatX = Math.max(workArea.x + 24, petX - chatWidth - 24);
    const chatY = Math.max(workArea.y + 24, petY + 32);

    return {
        version: STATE_VERSION,
        petWindow: {
            bounds: {
                x: petX,
                y: petY,
                width: petSize.width,
                height: petSize.height
            },
            visible: true
        },
        chatWindow: {
            bounds: {
                x: chatX,
                y: chatY,
                width: chatWidth,
                height: chatHeight
            },
            visible: false
        },
        preferences: {
            petSkipTaskbar: true,
            petScale,
            speechMode: 'server',
            recognitionMode: 'manual',
            preferredMicDeviceId: ''
        }
    };
}

function getStateFilePath(app) {
    return path.join(app.getPath('userData'), STATE_FILE_NAME);
}

function normalizeState(inputState) {
    const defaults = getDefaultState();
    const nextState = inputState && typeof inputState === 'object' ? inputState : {};

    const normalizedState = {
        ...defaults,
        ...nextState,
        petWindow: {
            ...defaults.petWindow,
            ...(nextState.petWindow || {}),
            bounds: {
                ...defaults.petWindow.bounds,
                ...(nextState.petWindow?.bounds || {})
            }
        },
        chatWindow: {
            ...defaults.chatWindow,
            ...(nextState.chatWindow || {}),
            bounds: {
                ...defaults.chatWindow.bounds,
                ...(nextState.chatWindow?.bounds || {})
            }
        },
        preferences: {
            ...defaults.preferences,
            ...(nextState.preferences || {})
        }
    };

    normalizedState.preferences.petScale = normalizePetScale(normalizedState.preferences.petScale);
    normalizedState.preferences.speechMode = normalizeSpeechMode(normalizedState.preferences.speechMode);
    normalizedState.preferences.recognitionMode = normalizeRecognitionMode(normalizedState.preferences.recognitionMode);
    normalizedState.preferences.preferredMicDeviceId = normalizePreferredMicDeviceId(
        normalizedState.preferences.preferredMicDeviceId
    );

    if ((nextState.version || 0) < STATE_VERSION) {
        normalizedState.petWindow.bounds = resizePetBounds(
            normalizedState.petWindow.bounds,
            normalizedState.preferences.petScale
        );
    }

    normalizedState.version = STATE_VERSION;
    return normalizedState;
}

function loadDesktopState(app) {
    const filePath = getStateFilePath(app);
    try {
        if (!fs.existsSync(filePath)) {
            return getDefaultState();
        }
        return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
        console.warn('⚠️ 读取桌宠状态失败，回退默认值：', error);
        return getDefaultState();
    }
}

function saveDesktopState(app, nextState) {
    const normalized = normalizeState(nextState);
    const filePath = getStateFilePath(app);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

module.exports = {
    DEFAULT_PET_SCALE,
    PET_SCALE_OPTIONS,
    RECOGNITION_MODE_OPTIONS,
    SPEECH_MODE_OPTIONS,
    getDefaultState,
    getScaledPetSize,
    loadDesktopState,
    normalizePetScale,
    normalizePreferredMicDeviceId,
    normalizeRecognitionMode,
    normalizeSpeechMode,
    normalizeState,
    resizePetBounds,
    saveDesktopState
};
