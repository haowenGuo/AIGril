const elements = {
    appVersion: document.getElementById('app-version'),
    avatarBubbleAvatarPreview: document.getElementById('avatar-bubble-avatar-preview'),
    avatarBubbleEditor: document.getElementById('avatar-bubble-editor'),
    avatarBubbleExtraWidth: document.getElementById('avatar-bubble-extra-width'),
    avatarBubbleExtraWidthValue: document.getElementById('avatar-bubble-extra-width-value'),
    avatarBubbleExtraTop: document.getElementById('avatar-bubble-extra-top'),
    avatarBubbleExtraTopValue: document.getElementById('avatar-bubble-extra-top-value'),
    avatarBubbleLeft: document.getElementById('avatar-bubble-left'),
    avatarBubbleLeftValue: document.getElementById('avatar-bubble-left-value'),
    avatarBubblePreview: document.getElementById('avatar-bubble-preview'),
    avatarBubbleScale: document.getElementById('avatar-bubble-scale'),
    avatarBubbleScaleValue: document.getElementById('avatar-bubble-scale-value'),
    avatarBubbleTop: document.getElementById('avatar-bubble-top'),
    avatarBubbleTopValue: document.getElementById('avatar-bubble-top-value'),
    avatarBubbleWindowPreview: document.getElementById('avatar-bubble-window-preview'),
    avatarBubbleWindowResize: document.getElementById('avatar-bubble-window-resize'),
    cameraDistance: document.getElementById('camera-distance'),
    cameraDistanceValue: document.getElementById('camera-distance-value'),
    cameraHeight: document.getElementById('camera-height'),
    cameraHeightValue: document.getElementById('camera-height-value'),
    cameraTargetY: document.getElementById('camera-target-y'),
    cameraTargetYValue: document.getElementById('camera-target-y-value'),
    closeBtn: document.getElementById('close-btn'),
    computerControlEnabled: document.getElementById('computer-control-enabled'),
    clearElevenLabsKeyBtn: document.getElementById('clear-elevenlabs-key-btn'),
    clearLlmKeyBtn: document.getElementById('clear-llm-key-btn'),
    clearEmailQqSecretBtn: document.getElementById('clear-email-qq-secret-btn'),
    clearEmailGmailSecretBtn: document.getElementById('clear-email-gmail-secret-btn'),
    clearEmailOutlookSecretBtn: document.getElementById('clear-email-outlook-secret-btn'),
    emailQqAccount: document.getElementById('email-qq-account'),
    emailQqSecret: document.getElementById('email-qq-secret'),
    emailQqState: document.getElementById('email-qq-state'),
    emailGmailAccount: document.getElementById('email-gmail-account'),
    emailGmailSecret: document.getElementById('email-gmail-secret'),
    emailGmailState: document.getElementById('email-gmail-state'),
    emailOutlookAccount: document.getElementById('email-outlook-account'),
    emailOutlookSecret: document.getElementById('email-outlook-secret'),
    emailOutlookState: document.getElementById('email-outlook-state'),
    elevenLabsApiBase: document.getElementById('elevenlabs-api-base'),
    elevenLabsApiKey: document.getElementById('elevenlabs-api-key'),
    elevenLabsKeyState: document.getElementById('elevenlabs-key-state'),
    elevenLabsModelId: document.getElementById('elevenlabs-model-id'),
    elevenLabsOutputFormat: document.getElementById('elevenlabs-output-format'),
    elevenLabsTimeout: document.getElementById('elevenlabs-timeout'),
    elevenLabsVoiceId: document.getElementById('elevenlabs-voice-id'),
    llmApiKey: document.getElementById('llm-api-key'),
    llmBaseUrl: document.getElementById('llm-base-url'),
    llmKeyState: document.getElementById('llm-key-state'),
    llmModel: document.getElementById('llm-model'),
    llmProvider: document.getElementById('llm-provider'),
    llmTemperature: document.getElementById('llm-temperature'),
    llmTemperatureValue: document.getElementById('llm-temperature-value'),
    llmTimeout: document.getElementById('llm-timeout'),
    micHelp: document.getElementById('mic-help'),
    memoryBlockList: document.getElementById('memory-block-list'),
    memoryPathText: document.getElementById('memory-path-text'),
    memoryStatusText: document.getElementById('memory-status-text'),
    humanClawStateDir: document.getElementById('humanclaw-state-dir'),
    humanClawStateDirHelp: document.getElementById('humanclaw-state-dir-help'),
    chooseHumanClawStateDirBtn: document.getElementById('choose-humanclaw-state-dir-btn'),
    resetHumanClawStateDirBtn: document.getElementById('reset-humanclaw-state-dir-btn'),
    openclawRuntimeText: document.getElementById('openclaw-runtime-text'),
    openclawStatusText: document.getElementById('openclaw-status-text'),
    packageStateText: document.getElementById('package-state-text'),
    petMouseHitTestEnabled: document.getElementById('pet-mouse-hit-test-enabled'),
    petMouseHitTestShape: document.getElementById('pet-mouse-hit-test-shape'),
    petMouseHitTestWidth: document.getElementById('pet-mouse-hit-test-width'),
    petMouseHitTestWidthValue: document.getElementById('pet-mouse-hit-test-width-value'),
    petMouseHitTestHeight: document.getElementById('pet-mouse-hit-test-height'),
    petMouseHitTestHeightValue: document.getElementById('pet-mouse-hit-test-height-value'),
    petMouseHitTestOffsetX: document.getElementById('pet-mouse-hit-test-offset-x'),
    petMouseHitTestOffsetXValue: document.getElementById('pet-mouse-hit-test-offset-x-value'),
    petMouseHitTestOffsetY: document.getElementById('pet-mouse-hit-test-offset-y'),
    petMouseHitTestOffsetYValue: document.getElementById('pet-mouse-hit-test-offset-y-value'),
    petMouseHitTestDebug: document.getElementById('pet-mouse-hit-test-debug'),
    petScale: document.getElementById('pet-scale'),
    preferredMic: document.getElementById('preferred-mic'),
    petShowTaskbar: document.getElementById('pet-show-taskbar'),
    recognitionMode: document.getElementById('recognition-mode'),
    recognitionModeText: document.getElementById('recognition-mode-text'),
    refreshMemoryBtn: document.getElementById('refresh-memory-btn'),
    refreshMicsBtn: document.getElementById('refresh-mics-btn'),
    resetAffinityBtn: document.getElementById('reset-affinity-btn'),
    resetBtn: document.getElementById('reset-btn'),
    renderAmbientFill: document.getElementById('render-ambient-fill'),
    renderAmbientFillValue: document.getElementById('render-ambient-fill-value'),
    renderAntialiasEnabled: document.getElementById('render-antialias-enabled'),
    renderFpsLimit: document.getElementById('render-fps-limit'),
    renderFpsLimitValue: document.getElementById('render-fps-limit-value'),
    renderKeyLight: document.getElementById('render-key-light'),
    renderKeyLightValue: document.getElementById('render-key-light-value'),
    renderLightYaw: document.getElementById('render-light-yaw'),
    renderLightYawValue: document.getElementById('render-light-yaw-value'),
    renderOutlineEnabled: document.getElementById('render-outline-enabled'),
    renderOutlineScale: document.getElementById('render-outline-scale'),
    renderOutlineScaleValue: document.getElementById('render-outline-scale-value'),
    renderProfile: document.getElementById('render-profile'),
    renderResolutionScale: document.getElementById('render-resolution-scale'),
    renderResolutionScaleValue: document.getElementById('render-resolution-scale-value'),
    renderShadowEnabled: document.getElementById('render-shadow-enabled'),
    renderShadowQuality: document.getElementById('render-shadow-quality'),
    renderShadowQualityValue: document.getElementById('render-shadow-quality-value'),
    saveBtn: document.getElementById('save-btn'),
    speechMode: document.getElementById('speech-mode'),
    statusText: document.getElementById('status-text'),
    ttsPitch: document.getElementById('tts-pitch'),
    ttsPitchValue: document.getElementById('tts-pitch-value'),
    ttsRate: document.getElementById('tts-rate'),
    ttsRateValue: document.getElementById('tts-rate-value'),
    ttsVolume: document.getElementById('tts-volume'),
    ttsVolumeValue: document.getElementById('tts-volume-value'),
    userDataPath: document.getElementById('user-data-path')
};

const speechModeLabels = {
    cosyvoice3: 'CosyVoice3 本地高质量',
    kokoro: 'Kokoro-82M 最低延迟',
    local: '浏览器 speechSynthesis',
    server: 'ElevenLabs 顶级音质',
    vits: '本地 VITS 实验模型',
    off: '关闭语音'
};

const recognitionModeLabels = {
    'auto-vad': '按钮开启 ASR',
    continuous: '自动 ASR 常驻检测',
    manual: '手动开始/停止'
};

const llmProviderLabels = {
    'openai-compatible': 'OpenAI-compatible'
};

const renderProfileLabels = {
    aigl_soft_anime_mtoon: '柔和动漫 MToon',
    aigl_bright_companion_mtoon: '明亮陪伴 MToon',
    aigl_cinematic_rim_toon: '电影感边缘光 Toon',
    aigl_material_hybrid_npr: '材质混合 NPR',
    aigl_hard_cel_mtoon: '硬边赛璐璐 MToon'
};

const PET_BASE_WIDTH = 720;
const PET_BASE_HEIGHT = 960;
const FPS_LIMIT_OPTIONS = [24, 30, 45, 60];
const BUBBLE_PREVIEW_BASE_WIDTH = 158;
const BUBBLE_PREVIEW_BASE_HEIGHT = 58;

let currentPreferences = null;
let panelState = null;
let microphoneDevices = [];
let saveInFlight = false;
let assistantStatusCache = null;
let dialoguePreviewScale = 1;
let dialoguePreviewDrag = null;
let pendingClearLlmKey = false;
let pendingClearElevenLabsKey = false;
const pendingClearEmailSecrets = {
    qq: false,
    gmail: false,
    outlook: false
};
const emailElements = {
    qq: {
        account: elements.emailQqAccount,
        secret: elements.emailQqSecret,
        state: elements.emailQqState,
        clear: elements.clearEmailQqSecretBtn
    },
    gmail: {
        account: elements.emailGmailAccount,
        secret: elements.emailGmailSecret,
        state: elements.emailGmailState,
        clear: elements.clearEmailGmailSecretBtn
    },
    outlook: {
        account: elements.emailOutlookAccount,
        secret: elements.emailOutlookSecret,
        state: elements.emailOutlookState,
        clear: elements.clearEmailOutlookSecretBtn
    }
};

function setStatus(text) {
    elements.statusText.textContent = text;
}

function formatValue(value) {
    return Number(value).toFixed(2);
}

function formatPixelValue(value) {
    return `${Math.round(Number(value) || 0)}px`;
}

function formatHitTestScale(value, neutral, strength) {
    const scale = 1 + (Number(value) - neutral) * strength;
    return `${Math.round(scale * 100)}%`;
}

function formatNeutralOffset(value, neutral = 0) {
    const offset = Number(value) - neutral;
    const sign = offset > 0 ? '+' : '';
    return `${sign}${Math.round(offset * 100)}%`;
}

function formatPercentScale(value) {
    return `${Math.round(Number(value || 1) * 100)}%`;
}

function formatLightYaw(value) {
    const numericValue = Math.round(Number(value || 0));
    if (numericValue === 0) {
        return '正面';
    }
    return `${numericValue > 0 ? '右' : '左'} ${Math.abs(numericValue)}°`;
}

function normalizeQualityLevel(value, fallbackValue = 3) {
    const numericValue = Math.round(Number(value));
    if (![1, 2, 3].includes(numericValue)) {
        return fallbackValue;
    }
    return numericValue;
}

function formatQualityLevel(value) {
    return ['低', '中', '高'][normalizeQualityLevel(value) - 1];
}

function normalizeRenderResolutionScale(value, fallbackValue = 2) {
    return clampNumber(value, 0.5, 3, fallbackValue, 2);
}

function normalizeRenderFpsLimit(value, fallbackValue = 60) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallbackValue;
    }
    return FPS_LIMIT_OPTIONS.reduce((closestValue, optionValue) => (
        Math.abs(optionValue - numericValue) < Math.abs(closestValue - numericValue)
            ? optionValue
            : closestValue
    ), fallbackValue);
}

function getFpsSliderIndex(value) {
    const fpsLimit = normalizeRenderFpsLimit(value);
    const optionIndex = FPS_LIMIT_OPTIONS.indexOf(fpsLimit);
    return optionIndex >= 0 ? optionIndex + 1 : FPS_LIMIT_OPTIONS.length;
}

function getFpsFromSliderIndex(value) {
    const optionIndex = Math.round(Number(value)) - 1;
    return FPS_LIMIT_OPTIONS[Math.min(Math.max(optionIndex, 0), FPS_LIMIT_OPTIONS.length - 1)];
}

function formatResolutionScale(value) {
    const normalizedValue = normalizeRenderResolutionScale(value);
    return `${normalizedValue.toFixed(2).replace(/\.?0+$/, '')}x`;
}

function formatFpsLimit(value) {
    return `${normalizeRenderFpsLimit(value)} FPS`;
}

function clampNumber(value, minimum, maximum, fallbackValue, digits = 2) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallbackValue;
    }
    const clampedValue = Math.min(Math.max(numericValue, minimum), maximum);
    return Number(clampedValue.toFixed(digits));
}

function getDialogueLayoutValues() {
    const petScale = Number(elements.petScale?.value || currentPreferences?.petScale || 0.85);
    const baseWidth = Math.round(PET_BASE_WIDTH * petScale);
    const baseHeight = Math.round(PET_BASE_HEIGHT * petScale);

    return {
        baseWidth,
        baseHeight,
        left: Math.round(Number(elements.avatarBubbleLeft.value) || 0),
        top: Math.round(Number(elements.avatarBubbleTop.value) || 0),
        scale: Number(elements.avatarBubbleScale.value) || 1,
        extraWidth: Math.round(Number(elements.avatarBubbleExtraWidth.value) || 0),
        extraTop: Math.round(Number(elements.avatarBubbleExtraTop.value) || 0)
    };
}

function syncDialoguePreview() {
    if (
        !elements.avatarBubbleEditor ||
        !elements.avatarBubbleWindowPreview ||
        !elements.avatarBubblePreview ||
        !elements.avatarBubbleAvatarPreview
    ) {
        return;
    }

    const layout = getDialogueLayoutValues();
    const stageRect = elements.avatarBubbleEditor.getBoundingClientRect();
    const stageWidth = stageRect.width || 420;
    const stageHeight = stageRect.height || 280;
    const windowWidth = Math.max(layout.baseWidth, layout.baseWidth + layout.extraWidth);
    const windowHeight = Math.max(layout.baseHeight, layout.baseHeight + layout.extraTop);
    dialoguePreviewScale = Math.min(
        Math.max(stageWidth - 32, 120) / windowWidth,
        Math.max(stageHeight - 32, 120) / windowHeight,
        1
    );

    elements.avatarBubbleWindowPreview.style.width = `${windowWidth}px`;
    elements.avatarBubbleWindowPreview.style.height = `${windowHeight}px`;
    elements.avatarBubbleWindowPreview.style.transform =
        `translate(-50%, -50%) scale(${dialoguePreviewScale})`;
    elements.avatarBubbleAvatarPreview.style.width = `${layout.baseWidth}px`;
    elements.avatarBubbleAvatarPreview.style.height = `${layout.baseHeight}px`;
    const maxBubbleLeft = Math.max(0, windowWidth - BUBBLE_PREVIEW_BASE_WIDTH * layout.scale - 8);
    const maxBubbleTop = Math.max(0, windowHeight - BUBBLE_PREVIEW_BASE_HEIGHT * layout.scale - 8);
    elements.avatarBubblePreview.style.left = `${Math.round(Math.min(layout.left, maxBubbleLeft))}px`;
    elements.avatarBubblePreview.style.top = `${Math.round(Math.min(layout.top, maxBubbleTop))}px`;
    elements.avatarBubblePreview.style.transform = `scale(${layout.scale})`;
}

function updateRangeLabels() {
    elements.avatarBubbleLeftValue.textContent = formatPixelValue(elements.avatarBubbleLeft.value);
    elements.avatarBubbleTopValue.textContent = formatPixelValue(elements.avatarBubbleTop.value);
    elements.avatarBubbleScaleValue.textContent = `${Math.round(Number(elements.avatarBubbleScale.value || 1) * 100)}%`;
    const dialogueLayout = getDialogueLayoutValues();
    elements.avatarBubbleExtraWidthValue.textContent = `${dialogueLayout.baseWidth + dialogueLayout.extraWidth}px`;
    elements.avatarBubbleExtraTopValue.textContent = `${dialogueLayout.baseHeight + dialogueLayout.extraTop}px`;
    elements.cameraDistanceValue.textContent = formatValue(elements.cameraDistance.value);
    elements.cameraHeightValue.textContent = formatValue(elements.cameraHeight.value);
    elements.cameraTargetYValue.textContent = formatValue(elements.cameraTargetY.value);
    elements.renderLightYawValue.textContent = formatLightYaw(elements.renderLightYaw.value);
    elements.renderKeyLightValue.textContent = formatPercentScale(elements.renderKeyLight.value);
    elements.renderAmbientFillValue.textContent = formatPercentScale(elements.renderAmbientFill.value);
    elements.renderOutlineScaleValue.textContent = formatPercentScale(elements.renderOutlineScale.value);
    elements.renderResolutionScaleValue.textContent = formatResolutionScale(elements.renderResolutionScale.value);
    elements.renderFpsLimitValue.textContent = formatFpsLimit(getFpsFromSliderIndex(elements.renderFpsLimit.value));
    elements.renderShadowQualityValue.textContent = formatQualityLevel(elements.renderShadowQuality.value);
    elements.petMouseHitTestWidthValue.textContent = formatHitTestScale(
        elements.petMouseHitTestWidth.value || 0.58,
        0.58,
        0.85
    );
    elements.petMouseHitTestHeightValue.textContent = formatHitTestScale(
        elements.petMouseHitTestHeight.value || 0.78,
        0.78,
        0.72
    );
    elements.petMouseHitTestOffsetXValue.textContent = formatNeutralOffset(
        elements.petMouseHitTestOffsetX.value || 0
    );
    elements.petMouseHitTestOffsetYValue.textContent = formatNeutralOffset(
        elements.petMouseHitTestOffsetY.value || 0.08,
        0.08
    );
    elements.ttsRateValue.textContent = formatValue(elements.ttsRate.value);
    elements.ttsPitchValue.textContent = formatValue(elements.ttsPitch.value);
    elements.ttsVolumeValue.textContent = formatValue(elements.ttsVolume.value);
    elements.llmTemperatureValue.textContent = formatValue(elements.llmTemperature.value);
    syncDialoguePreview();
}

function normalizePreferences(preferences = {}) {
    const llmTemperature = Math.min(
        2,
        Math.max(0, Number(preferences.llmTemperature ?? 0.8))
    );
    const llmTimeout = Math.min(
        120000,
        Math.max(5000, Number(preferences.llmRequestTimeoutMs ?? 25000))
    );

    const emailProfiles = normalizeEmailProfiles(preferences.emailProfiles || {});

    return {
        petScale: String(preferences.petScale ?? '0.85'),
        petSkipTaskbar: Boolean(preferences.petSkipTaskbar),
        speechMode: String(preferences.speechMode || 'cosyvoice3'),
        recognitionMode: String(preferences.recognitionMode || 'auto-vad'),
        preferredMicDeviceId: String(preferences.preferredMicDeviceId || ''),
        humanClawStateDir: String(preferences.humanClawStateDir || ''),
        humanClawResolvedStateDir: String(preferences.humanClawResolvedStateDir || ''),
        humanClawDefaultStateDir: String(preferences.humanClawDefaultStateDir || ''),
        llmProvider: String(preferences.llmProvider || 'openai-compatible'),
        llmBaseUrl: String(preferences.llmBaseUrl || 'https://ark.cn-beijing.volces.com/api/v3'),
        llmModel: String(preferences.llmModel || 'doubao-seed-2-0-mini-260215'),
        llmApiKeyConfigured: Boolean(preferences.llmApiKeyConfigured),
        llmApiKeySource: String(preferences.llmApiKeySource || 'none'),
        llmTemperature: Number(llmTemperature.toFixed(2)),
        llmRequestTimeoutMs: Math.round(llmTimeout),
        elevenLabsApiBase: String(preferences.elevenLabsApiBase || 'https://api.elevenlabs.io'),
        elevenLabsVoiceId: String(preferences.elevenLabsVoiceId || ''),
        elevenLabsModelId: String(preferences.elevenLabsModelId || 'eleven_multilingual_v2'),
        elevenLabsOutputFormat: String(preferences.elevenLabsOutputFormat || 'mp3_44100_128'),
        elevenLabsTimeoutMs: Math.round(
            Math.min(120000, Math.max(5000, Number(preferences.elevenLabsTimeoutMs ?? 60000)))
        ),
        elevenLabsApiKeyConfigured: Boolean(preferences.elevenLabsApiKeyConfigured),
        elevenLabsApiKeySource: String(preferences.elevenLabsApiKeySource || 'none'),
        computerControlEnabled: preferences.computerControlEnabled !== false,
        emailProfiles,
        cameraDistance: Number(preferences.cameraDistance ?? 1.1),
        cameraHeight: Number(preferences.cameraHeight ?? 1.3),
        cameraTargetY: Number(preferences.cameraTargetY ?? 1),
        renderProfileId: Object.prototype.hasOwnProperty.call(
            renderProfileLabels,
            String(preferences.renderProfileId || '')
        )
            ? String(preferences.renderProfileId)
            : 'aigl_soft_anime_mtoon',
        renderLightYawDeg: clampNumber(preferences.renderLightYawDeg, -75, 75, 0, 0),
        renderKeyLightScale: clampNumber(preferences.renderKeyLightScale, 0.65, 1.45, 1, 2),
        renderAmbientFillScale: clampNumber(preferences.renderAmbientFillScale, 0.55, 1.35, 1, 2),
        renderOutlineScale: clampNumber(preferences.renderOutlineScale, 0.25, 1.2, 0.72, 2),
        renderShadowEnabled: preferences.renderShadowEnabled !== false,
        renderResolutionScale: normalizeRenderResolutionScale(preferences.renderResolutionScale, 2),
        renderFpsLimit: normalizeRenderFpsLimit(preferences.renderFpsLimit, 60),
        renderShadowQuality: normalizeQualityLevel(preferences.renderShadowQuality, 3),
        renderOutlineEnabled: preferences.renderOutlineEnabled !== false,
        renderAntialiasEnabled: preferences.renderAntialiasEnabled !== false,
        desktopNativeTtsRate: Number(preferences.desktopNativeTtsRate ?? 0.96),
        desktopNativeTtsPitch: Number(preferences.desktopNativeTtsPitch ?? 1.12),
        desktopNativeTtsVolume: Number(preferences.desktopNativeTtsVolume ?? 1),
        avatarDialogueBubbleLeft: Math.round(
            clampNumber(preferences.avatarDialogueBubbleLeft, 0, 640, 8, 0)
        ),
        avatarDialogueBubbleTop: Math.round(
            clampNumber(preferences.avatarDialogueBubbleTop, 0, 480, 8, 0)
        ),
        avatarDialogueBubbleScale: clampNumber(
            preferences.avatarDialogueBubbleScale,
            0.75,
            1.35,
            1,
            2
        ),
        avatarDialogueBubbleExtraWidth: Math.round(
            clampNumber(preferences.avatarDialogueBubbleExtraWidth, 0, 520, 220, 0)
        ),
        avatarDialogueBubbleExtraTop: Math.round(
            clampNumber(preferences.avatarDialogueBubbleExtraTop, 0, 360, 190, 0)
        ),
        petMouseHitTestEnabled: preferences.petMouseHitTestEnabled !== false,
        petMouseHitTestShape: ['ellipse', 'rectangle'].includes(String(preferences.petMouseHitTestShape || '').trim().toLowerCase())
            ? String(preferences.petMouseHitTestShape).trim().toLowerCase()
            : 'ellipse',
        petMouseHitTestWidthRatio: clampNumber(
            preferences.petMouseHitTestWidthRatio,
            0.2,
            1,
            0.58,
            2
        ),
        petMouseHitTestHeightRatio: clampNumber(
            preferences.petMouseHitTestHeightRatio,
            0.25,
            1,
            0.78,
            2
        ),
        petMouseHitTestOffsetXRatio: clampNumber(
            preferences.petMouseHitTestOffsetXRatio,
            -0.5,
            0.5,
            0,
            2
        ),
        petMouseHitTestOffsetYRatio: clampNumber(
            preferences.petMouseHitTestOffsetYRatio,
            -0.5,
            0.5,
            0.08,
            2
        ),
        petMouseHitTestDebug: Boolean(preferences.petMouseHitTestDebug)
    };
}

function normalizeEmailProfiles(profiles = {}) {
    const providerIds = ['qq', 'gmail', 'outlook'];
    return Object.fromEntries(providerIds.map((providerId) => {
        const profile = profiles[providerId] && typeof profiles[providerId] === 'object'
            ? profiles[providerId]
            : {};
        return [
            providerId,
            {
                account: String(profile.account || profile.email || ''),
                authType: String(profile.authType || 'password'),
                secretConfigured: Boolean(profile.secretConfigured || profile.secret),
                secretSource: String(profile.secretSource || (profile.secretConfigured || profile.secret ? 'saved' : 'none'))
            }
        ];
    }));
}

function readFormPreferences({ includeSecret = false } = {}) {
    const nextPreferences = normalizePreferences({
        petScale: Number(elements.petScale.value),
        petSkipTaskbar: !elements.petShowTaskbar.checked,
        speechMode: elements.speechMode.value,
        recognitionMode: elements.recognitionMode.value,
        preferredMicDeviceId: elements.preferredMic.value,
        humanClawStateDir: elements.humanClawStateDir
            ? elements.humanClawStateDir.value.trim()
            : currentPreferences?.humanClawStateDir || '',
        humanClawResolvedStateDir: currentPreferences?.humanClawResolvedStateDir || '',
        humanClawDefaultStateDir: currentPreferences?.humanClawDefaultStateDir || '',
        llmProvider: elements.llmProvider.value,
        llmBaseUrl: elements.llmBaseUrl.value,
        llmModel: elements.llmModel.value,
        llmApiKeyConfigured: pendingClearLlmKey
            ? false
            : Boolean(currentPreferences?.llmApiKeyConfigured),
        llmApiKeySource: pendingClearLlmKey
            ? 'none'
            : String(currentPreferences?.llmApiKeySource || 'none'),
        llmTemperature: Number(elements.llmTemperature.value),
        llmRequestTimeoutMs: Number(elements.llmTimeout.value),
        elevenLabsApiBase: elements.elevenLabsApiBase.value,
        elevenLabsVoiceId: elements.elevenLabsVoiceId.value,
        elevenLabsModelId: elements.elevenLabsModelId.value,
        elevenLabsOutputFormat: elements.elevenLabsOutputFormat.value,
        elevenLabsTimeoutMs: Number(elements.elevenLabsTimeout.value),
        elevenLabsApiKeyConfigured: pendingClearElevenLabsKey
            ? false
            : Boolean(currentPreferences?.elevenLabsApiKeyConfigured),
        elevenLabsApiKeySource: pendingClearElevenLabsKey
            ? 'none'
            : String(currentPreferences?.elevenLabsApiKeySource || 'none'),
        computerControlEnabled: elements.computerControlEnabled.checked,
        emailProfiles: readEmailFormProfiles({ includeSecret }),
        cameraDistance: Number(elements.cameraDistance.value),
        cameraHeight: Number(elements.cameraHeight.value),
        cameraTargetY: Number(elements.cameraTargetY.value),
        renderProfileId: elements.renderProfile.value,
        renderLightYawDeg: Number(elements.renderLightYaw.value),
        renderKeyLightScale: Number(elements.renderKeyLight.value),
        renderAmbientFillScale: Number(elements.renderAmbientFill.value),
        renderOutlineScale: Number(elements.renderOutlineScale.value),
        renderShadowEnabled: elements.renderShadowEnabled.checked,
        renderResolutionScale: normalizeRenderResolutionScale(elements.renderResolutionScale.value, 2),
        renderFpsLimit: getFpsFromSliderIndex(elements.renderFpsLimit.value),
        renderShadowQuality: Number(elements.renderShadowQuality.value),
        renderOutlineEnabled: elements.renderOutlineEnabled.checked,
        renderAntialiasEnabled: elements.renderAntialiasEnabled.checked,
        desktopNativeTtsRate: Number(elements.ttsRate.value),
        desktopNativeTtsPitch: Number(elements.ttsPitch.value),
        desktopNativeTtsVolume: Number(elements.ttsVolume.value),
        avatarDialogueBubbleLeft: Number(elements.avatarBubbleLeft.value),
        avatarDialogueBubbleTop: Number(elements.avatarBubbleTop.value),
        avatarDialogueBubbleScale: Number(elements.avatarBubbleScale.value),
        avatarDialogueBubbleExtraWidth: Number(elements.avatarBubbleExtraWidth.value),
        avatarDialogueBubbleExtraTop: Number(elements.avatarBubbleExtraTop.value),
        petMouseHitTestEnabled: elements.petMouseHitTestEnabled.checked,
        petMouseHitTestShape: elements.petMouseHitTestShape.value,
        petMouseHitTestWidthRatio: Number(elements.petMouseHitTestWidth.value),
        petMouseHitTestHeightRatio: Number(elements.petMouseHitTestHeight.value),
        petMouseHitTestOffsetXRatio: Number(elements.petMouseHitTestOffsetX.value),
        petMouseHitTestOffsetYRatio: Number(elements.petMouseHitTestOffsetY.value),
        petMouseHitTestDebug: elements.petMouseHitTestDebug.checked
    });

    if (includeSecret) {
        const nextApiKey = elements.llmApiKey.value.trim();
        if (nextApiKey) {
            nextPreferences.llmApiKey = nextApiKey;
        }
        if (pendingClearLlmKey) {
            nextPreferences.llmApiKeyAction = 'clear';
        }
        const nextElevenLabsApiKey = elements.elevenLabsApiKey.value.trim();
        if (nextElevenLabsApiKey) {
            nextPreferences.elevenLabsApiKey = nextElevenLabsApiKey;
        }
        if (pendingClearElevenLabsKey) {
            nextPreferences.elevenLabsApiKeyAction = 'clear';
        }
        nextPreferences.emailProfiles = readEmailFormProfiles({ includeSecret: true });
    }

    return nextPreferences;
}

function readEmailFormProfiles({ includeSecret = false } = {}) {
    const profiles = {};
    for (const [providerId, entry] of Object.entries(emailElements)) {
        profiles[providerId] = {
            account: entry.account?.value?.trim() || '',
            authType: currentPreferences?.emailProfiles?.[providerId]?.authType || 'password',
            secretConfigured: pendingClearEmailSecrets[providerId]
                ? false
                : Boolean(currentPreferences?.emailProfiles?.[providerId]?.secretConfigured),
            secretSource: pendingClearEmailSecrets[providerId]
                ? 'none'
                : String(currentPreferences?.emailProfiles?.[providerId]?.secretSource || 'none')
        };
        if (includeSecret) {
            const secret = entry.secret?.value?.trim() || '';
            if (secret) {
                profiles[providerId].secret = secret;
            }
            if (pendingClearEmailSecrets[providerId]) {
                profiles[providerId].secretAction = 'clear';
            }
        }
    }
    return profiles;
}

function hasDirtyChanges() {
    if (!currentPreferences) {
        return false;
    }

    const hasEmailSecretInput = Object.values(emailElements).some((entry) => entry.secret?.value?.trim());
    const hasPendingEmailClear = Object.values(pendingClearEmailSecrets).some(Boolean);

    return Boolean(elements.llmApiKey.value.trim()) ||
        Boolean(elements.elevenLabsApiKey.value.trim()) ||
        hasEmailSecretInput ||
        hasPendingEmailClear ||
        pendingClearLlmKey ||
        pendingClearElevenLabsKey ||
        JSON.stringify(readFormPreferences()) !== JSON.stringify(currentPreferences);
}

function syncSaveButton() {
    elements.saveBtn.disabled = saveInFlight || !hasDirtyChanges();
}

function fillScaleOptions(scaleOptions = []) {
    elements.petScale.innerHTML = '';
    scaleOptions.forEach((scale) => {
        const option = document.createElement('option');
        option.value = String(scale);
        option.textContent = `${Math.round(scale * 100)}%`;
        elements.petScale.appendChild(option);
    });
}

function fillSpeechModeOptions(modeOptions = []) {
    elements.speechMode.innerHTML = '';
    modeOptions.forEach((mode) => {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = speechModeLabels[mode] || mode;
        elements.speechMode.appendChild(option);
    });
}

function fillRecognitionModeOptions(modeOptions = []) {
    elements.recognitionMode.innerHTML = '';
    modeOptions.forEach((mode) => {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = recognitionModeLabels[mode] || mode;
        elements.recognitionMode.appendChild(option);
    });
}

function fillLlmProviderOptions(providerOptions = []) {
    elements.llmProvider.innerHTML = '';
    providerOptions.forEach((provider) => {
        const option = document.createElement('option');
        option.value = provider;
        option.textContent = llmProviderLabels[provider] || provider;
        elements.llmProvider.appendChild(option);
    });
}

function fillRenderProfileOptions(profileOptions = []) {
    elements.renderProfile.innerHTML = '';
    profileOptions.forEach((profileId) => {
        const option = document.createElement('option');
        option.value = profileId;
        option.textContent = renderProfileLabels[profileId] || profileId;
        elements.renderProfile.appendChild(option);
    });
}

function syncLlmKeyState() {
    if (pendingClearLlmKey) {
        elements.llmKeyState.textContent = '保存后会清除已保存 Key。';
        return;
    }

    if (currentPreferences?.llmApiKeyConfigured) {
        if (currentPreferences.llmApiKeySource === 'environment') {
            elements.llmKeyState.textContent = elements.llmApiKey.value.trim()
                ? '保存后会用新 Key 覆盖环境变量里的 Key。'
                : 'Key 状态：已从环境变量读取。';
            return;
        }

        elements.llmKeyState.textContent = elements.llmApiKey.value.trim()
            ? '保存后会用新 Key 覆盖已保存 Key。'
            : 'Key 状态：已保存。留空会继续沿用当前 Key。';
        return;
    }

    elements.llmKeyState.textContent = elements.llmApiKey.value.trim()
        ? '保存后会写入新的 Key。'
        : 'Key 状态：未配置。';
}

function syncElevenLabsKeyState() {
    if (pendingClearElevenLabsKey) {
        elements.elevenLabsKeyState.textContent = '保存后会清除已保存 Key。';
        return;
    }

    if (currentPreferences?.elevenLabsApiKeyConfigured) {
        elements.elevenLabsKeyState.textContent = elements.elevenLabsApiKey.value.trim()
            ? '保存后会用新 Key 覆盖已保存 Key。'
            : 'Key 状态：已保存。留空会继续沿用当前 Key。';
        return;
    }

    elements.elevenLabsKeyState.textContent = elements.elevenLabsApiKey.value.trim()
        ? '保存后会写入新的 Key。'
        : 'Key 状态：未配置。';
}

function syncEmailSecretStates() {
    for (const [providerId, entry] of Object.entries(emailElements)) {
        const profile = currentPreferences?.emailProfiles?.[providerId] || {};
        if (!entry.state) {
            continue;
        }
        if (pendingClearEmailSecrets[providerId]) {
            entry.state.textContent = '保存后会清除已保存密钥。';
        } else if (entry.secret?.value?.trim()) {
            entry.state.textContent = profile.secretConfigured
                ? '保存后会覆盖已保存密钥。'
                : '保存后会写入新的密钥。';
        } else if (profile.secretConfigured) {
            entry.state.textContent = '密钥状态：已保存。留空会继续沿用当前密钥。';
        } else {
            entry.state.textContent = '密钥状态：未配置。';
        }
    }
}

function fillForm(preferences) {
    const normalized = normalizePreferences(preferences);
    currentPreferences = normalized;
    pendingClearLlmKey = false;
    pendingClearElevenLabsKey = false;
    Object.keys(pendingClearEmailSecrets).forEach((providerId) => {
        pendingClearEmailSecrets[providerId] = false;
    });

    elements.petScale.value = normalized.petScale;
    elements.petShowTaskbar.checked = !normalized.petSkipTaskbar;
    elements.speechMode.value = normalized.speechMode;
    elements.recognitionMode.value = normalized.recognitionMode;
    if (elements.recognitionModeText) {
        elements.recognitionModeText.textContent = recognitionModeLabels[normalized.recognitionMode] ||
            normalized.recognitionMode;
    }
    if (elements.humanClawStateDir) {
        elements.humanClawStateDir.value = normalized.humanClawStateDir;
    }
    if (elements.humanClawStateDirHelp) {
        elements.humanClawStateDirHelp.textContent = normalized.humanClawStateDir
            ? `当前解析目录：${normalized.humanClawResolvedStateDir || normalized.humanClawStateDir}`
            : `默认目录：${normalized.humanClawDefaultStateDir || '软件根目录下的 .humanclaw-state'}`;
    }
    elements.llmProvider.value = normalized.llmProvider;
    elements.llmBaseUrl.value = normalized.llmBaseUrl;
    elements.llmModel.value = normalized.llmModel;
    elements.llmApiKey.value = '';
    elements.llmTemperature.value = String(normalized.llmTemperature);
    elements.llmTimeout.value = String(normalized.llmRequestTimeoutMs);
    elements.elevenLabsApiBase.value = normalized.elevenLabsApiBase;
    elements.elevenLabsVoiceId.value = normalized.elevenLabsVoiceId;
    elements.elevenLabsApiKey.value = '';
    elements.elevenLabsModelId.value = normalized.elevenLabsModelId;
    elements.elevenLabsOutputFormat.value = normalized.elevenLabsOutputFormat;
    elements.elevenLabsTimeout.value = String(normalized.elevenLabsTimeoutMs);
    elements.computerControlEnabled.checked = normalized.computerControlEnabled;
    for (const [providerId, entry] of Object.entries(emailElements)) {
        const profile = normalized.emailProfiles?.[providerId] || {};
        if (entry.account) {
            entry.account.value = profile.account || '';
        }
        if (entry.secret) {
            entry.secret.value = '';
        }
    }
    elements.cameraDistance.value = String(normalized.cameraDistance);
    elements.cameraHeight.value = String(normalized.cameraHeight);
    elements.cameraTargetY.value = String(normalized.cameraTargetY);
    elements.renderProfile.value = normalized.renderProfileId;
    elements.renderLightYaw.value = String(normalized.renderLightYawDeg);
    elements.renderKeyLight.value = String(normalized.renderKeyLightScale);
    elements.renderAmbientFill.value = String(normalized.renderAmbientFillScale);
    elements.renderOutlineScale.value = String(normalized.renderOutlineScale);
    elements.renderShadowEnabled.checked = normalized.renderShadowEnabled;
    elements.renderResolutionScale.value = String(normalized.renderResolutionScale);
    elements.renderFpsLimit.value = String(getFpsSliderIndex(normalized.renderFpsLimit));
    elements.renderShadowQuality.value = String(normalized.renderShadowQuality);
    elements.renderOutlineEnabled.checked = normalized.renderOutlineEnabled;
    elements.renderAntialiasEnabled.checked = normalized.renderAntialiasEnabled;
    elements.ttsRate.value = String(normalized.desktopNativeTtsRate);
    elements.ttsPitch.value = String(normalized.desktopNativeTtsPitch);
    elements.ttsVolume.value = String(normalized.desktopNativeTtsVolume);
    elements.avatarBubbleLeft.value = String(normalized.avatarDialogueBubbleLeft);
    elements.avatarBubbleTop.value = String(normalized.avatarDialogueBubbleTop);
    elements.avatarBubbleScale.value = String(normalized.avatarDialogueBubbleScale);
    elements.avatarBubbleExtraWidth.value = String(normalized.avatarDialogueBubbleExtraWidth);
    elements.avatarBubbleExtraTop.value = String(normalized.avatarDialogueBubbleExtraTop);
    elements.petMouseHitTestEnabled.checked = normalized.petMouseHitTestEnabled;
    elements.petMouseHitTestShape.value = normalized.petMouseHitTestShape;
    elements.petMouseHitTestWidth.value = String(normalized.petMouseHitTestWidthRatio);
    elements.petMouseHitTestHeight.value = String(normalized.petMouseHitTestHeightRatio);
    elements.petMouseHitTestOffsetX.value = String(normalized.petMouseHitTestOffsetXRatio);
    elements.petMouseHitTestOffsetY.value = String(normalized.petMouseHitTestOffsetYRatio);
    elements.petMouseHitTestDebug.checked = normalized.petMouseHitTestDebug;

    updateRangeLabels();
    syncLlmKeyState();
    syncElevenLabsKeyState();
    syncEmailSecretStates();
    syncMicrophoneSelection();
    syncSaveButton();
}

function renderHumanClawStatus(status = {}) {
    if (!elements.openclawStatusText || !elements.openclawRuntimeText) {
        return;
    }

    assistantStatusCache = {
        ...(assistantStatusCache || {}),
        ...(status || {}),
        managedRuntime: {
            ...((assistantStatusCache && assistantStatusCache.managedRuntime) || {}),
            ...((status && status.managedRuntime) || {})
        }
    };

    const resolvedStatus = assistantStatusCache || {};
    const humanGateway = resolvedStatus.humanGateway || resolvedStatus;
    const agentRunner = humanGateway.agentRunner || {};
    const memoryStatus = humanGateway.memory || agentRunner.memory || {};
    const toolValidation = resolvedStatus.toolSurfaceValidation || {};

    if (humanGateway.running) {
        elements.openclawStatusText.textContent = `HumanClaw Gateway 已运行（${humanGateway.url || `:${humanGateway.port || ''}`}）`;
    } else if (resolvedStatus.lastError) {
        elements.openclawStatusText.textContent = resolvedStatus.lastError;
    } else {
        elements.openclawStatusText.textContent = 'HumanClaw Gateway 尚未启动。';
    }

    const statusBits = [
        agentRunner.enabled ? `Agent Runner: ${agentRunner.version || 'v0'}` : '',
        humanGateway.defaultContext?.computerControlEnabled === true
            ? 'computer: 完全控制'
            : humanGateway.defaultContext?.computerControlEnabled === false
            ? 'computer: 确认模式'
            : '',
        typeof agentRunner.completedRunCount === 'number' ? `runs: ${agentRunner.completedRunCount}` : '',
        memoryStatus.enabled ? `memory: ${memoryStatus.affinityScore ?? 50}/100` : '',
        humanGateway.workspaceRoot ? `workspace: ${humanGateway.workspaceRoot}` : '',
        agentRunner.pendingStorePath ? `state: ${agentRunner.pendingStorePath}` : '',
        typeof humanGateway.openClawToolSurfaceValidation?.ok === 'boolean'
            ? humanGateway.openClawToolSurfaceValidation.ok
                ? `tools: 已对齐 (${humanGateway.openClawToolSurfaceValidation.coreToolCount || 0} core)`
                : `tools: 校验失败 (${humanGateway.openClawToolSurfaceValidation.issueCount || 0} 项)`
            : typeof toolValidation.ok === 'boolean'
            ? toolValidation.ok
                ? `tools: 已对齐 (${toolValidation.coreToolCount || 0} core)`
                : `tools: 校验失败 (${toolValidation.issueCount || 0} 项)`
            : ''
    ].filter(Boolean);

    elements.openclawRuntimeText.textContent = statusBits.join(' | ');
}

async function refreshOpenClawStatus() {
    if (!elements.openclawStatusText || !elements.openclawRuntimeText) {
        return;
    }

    if (!window.aigrilDesktop?.gateway?.getStatus) {
        elements.openclawStatusText.textContent = '当前环境不支持 HumanClaw Gateway。';
        elements.openclawRuntimeText.textContent = '';
        return;
    }

    try {
        renderHumanClawStatus(await window.aigrilDesktop.gateway.getStatus());
    } catch (error) {
        elements.openclawStatusText.textContent = `读取 HumanClaw 状态失败：${error.message || error}`;
        elements.openclawRuntimeText.textContent = '';
    }
}

function truncatePanelText(value, maxChars = 180) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxChars) {
        return text;
    }
    return `${text.slice(0, maxChars - 1)}…`;
}

function renderMemorySnapshot(snapshot = {}) {
    const status = snapshot.status || {};
    if (elements.memoryStatusText) {
        const affinity = typeof status.affinityScore === 'number'
            ? `好感度 ${status.affinityScore}/100`
            : '好感度未初始化';
        const blocks = typeof status.blockCount === 'number' ? `${status.blockCount} 个记忆块` : '';
        const events = typeof status.eventCount === 'number' ? `${status.eventCount} 条近期事件` : '';
        elements.memoryStatusText.textContent = [
            status.loaded === false ? '记忆未加载' : '记忆已启用',
            affinity,
            blocks,
            events,
            status.secretCount ? `隐私条目 ${status.secretCount}` : ''
        ].filter(Boolean).join(' | ');
    }
    if (elements.memoryPathText) {
        elements.memoryPathText.textContent = status.rootDir ? `目录：${status.rootDir}` : '';
    }
    if (!elements.memoryBlockList) {
        return;
    }

    elements.memoryBlockList.innerHTML = '';
    const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
    const preferredKeys = ['user', 'relationship', 'project', 'affinity', 'persona', 'secrets_index'];
    const orderedBlocks = [
        ...preferredKeys
            .map((key) => blocks.find((block) => block.key === key))
            .filter(Boolean),
        ...blocks.filter((block) => !preferredKeys.includes(block.key))
    ].slice(0, 6);

    if (!orderedBlocks.length) {
        const empty = document.createElement('div');
        empty.className = 'field-help';
        empty.textContent = '还没有可显示的记忆块。';
        elements.memoryBlockList.appendChild(empty);
        return;
    }

    orderedBlocks.forEach((block) => {
        const item = document.createElement('div');
        item.className = 'memory-block';

        const title = document.createElement('div');
        title.className = 'memory-block-title';
        title.textContent = block.label || block.key || '记忆块';

        const text = document.createElement('div');
        text.className = 'memory-block-text';
        text.textContent = truncatePanelText(block.value, 240);

        item.appendChild(title);
        item.appendChild(text);
        elements.memoryBlockList.appendChild(item);
    });
}

async function refreshMemoryStatus() {
    if (!window.aigrilDesktop?.memory?.getSnapshot) {
        if (elements.memoryStatusText) {
            elements.memoryStatusText.textContent = '当前环境不支持人格记忆。';
        }
        return;
    }
    try {
        renderMemorySnapshot(await window.aigrilDesktop.memory.getSnapshot({ includeEvents: false }));
    } catch (error) {
        if (elements.memoryStatusText) {
            elements.memoryStatusText.textContent = `读取人格记忆失败：${error.message || error}`;
        }
    }
}

async function resetAffinityScore() {
    if (!window.aigrilDesktop?.memory?.resetAffinity) {
        return;
    }
    try {
        await window.aigrilDesktop.memory.resetAffinity({ score: 50 });
        await refreshMemoryStatus();
        setStatus('好感度已重置为 50。');
    } catch (error) {
        setStatus(`重置好感度失败：${error.message || error}`);
    }
}

function syncMicrophoneSelection() {
    const currentValue = currentPreferences?.preferredMicDeviceId || '';
    const previousValue = elements.preferredMic.value;
    const selectedValue = previousValue || currentValue;

    elements.preferredMic.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '系统默认麦克风';
    elements.preferredMic.appendChild(defaultOption);

    if (!microphoneDevices.length) {
        const option = document.createElement('option');
        option.value = currentValue;
        option.textContent = currentValue ? '已保存设备（当前未发现）' : '未发现可用麦克风';
        if (currentValue) {
            elements.preferredMic.appendChild(option);
        }
        elements.preferredMic.value = currentValue;
        return;
    }

    microphoneDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `麦克风 ${index + 1}`;
        elements.preferredMic.appendChild(option);
    });

    const hasSelected = microphoneDevices.some((device) => device.deviceId === selectedValue);
    if (!hasSelected && selectedValue) {
        const preservedOption = document.createElement('option');
        preservedOption.value = selectedValue;
        preservedOption.textContent = '已保存设备（当前未连接）';
        elements.preferredMic.appendChild(preservedOption);
    }

    elements.preferredMic.value = hasSelected || selectedValue ? selectedValue : '';
}

async function refreshMicrophones({ requestPermission = false } = {}) {
    if (!navigator.mediaDevices?.enumerateDevices) {
        microphoneDevices = [];
        elements.micHelp.textContent = '当前桌面环境不支持枚举音频输入设备。';
        syncMicrophoneSelection();
        return;
    }

    try {
        if (requestPermission && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        microphoneDevices = devices.filter((device) => device.kind === 'audioinput');
        elements.micHelp.textContent = microphoneDevices.length
            ? `共发现 ${microphoneDevices.length} 个音频输入设备。`
            : '还没有识别到可用麦克风，插拔设备后可重新刷新。';
        syncMicrophoneSelection();
    } catch (error) {
        microphoneDevices = [];
        elements.micHelp.textContent = `读取麦克风失败：${error.message || error}`;
        syncMicrophoneSelection();
    }
}

async function savePreferences() {
    if (!window.aigrilDesktop?.savePreferences) {
        setStatus('当前环境不支持保存桌面配置。');
        return;
    }

    saveInFlight = true;
    syncSaveButton();
    setStatus('正在保存设置...');

    try {
        const savedPreferences = await window.aigrilDesktop.savePreferences(
            readFormPreferences({ includeSecret: true })
        );
        pendingClearLlmKey = false;
        pendingClearElevenLabsKey = false;
        fillForm(savedPreferences);
        await refreshOpenClawStatus();
        setStatus('设置已保存，桌宠与聊天窗已同步刷新。');
    } catch (error) {
        setStatus(`保存失败：${error.message || error}`);
    } finally {
        saveInFlight = false;
        syncSaveButton();
    }
}

async function restoreDefaults() {
    if (!window.aigrilDesktop?.restoreDefaultPreferences) {
        setStatus('当前环境不支持恢复默认配置。');
        return;
    }

    const confirmed = window.confirm('恢复默认后会覆盖当前面板中的设置，继续吗？');
    if (!confirmed) {
        return;
    }

    saveInFlight = true;
    syncSaveButton();
    setStatus('正在恢复默认设置...');

    try {
        const restoredPreferences = await window.aigrilDesktop.restoreDefaultPreferences();
        pendingClearLlmKey = false;
        pendingClearElevenLabsKey = false;
        fillForm(restoredPreferences);
        await refreshOpenClawStatus();
        setStatus('默认设置已恢复。');
    } catch (error) {
        setStatus(`恢复默认失败：${error.message || error}`);
    } finally {
        saveInFlight = false;
        syncSaveButton();
    }
}

async function initialize() {
    if (!window.aigrilDesktop?.getControlPanelState) {
        setStatus('当前页面只能在 AIGril 桌面版里使用。');
        return;
    }

    setStatus('正在读取当前配置...');

    try {
        panelState = await window.aigrilDesktop.getControlPanelState();
        fillScaleOptions(panelState.options?.petScaleOptions || []);
        fillSpeechModeOptions(panelState.options?.speechModeOptions || []);
        fillRecognitionModeOptions(panelState.options?.recognitionModeOptions || ['auto-vad', 'continuous', 'manual']);
        fillLlmProviderOptions(panelState.options?.llmProviderOptions || ['openai-compatible']);
        fillRenderProfileOptions(panelState.options?.renderProfileOptions || Object.keys(renderProfileLabels));
        fillForm(panelState.preferences || {});
        renderHumanClawStatus(panelState.assistant?.humanGateway || panelState.assistant || {});

        elements.appVersion.textContent = `v${panelState.environment?.version || '1.0.0'}`;
        if (elements.userDataPath) {
            elements.userDataPath.textContent = panelState.environment?.userDataPath || '未知';
        }
        if (elements.recognitionModeText) {
            elements.recognitionModeText.textContent = recognitionModeLabels[panelState.preferences?.recognitionMode] ||
                panelState.preferences?.recognitionMode ||
                'auto-vad';
        }
        if (elements.packageStateText) {
            elements.packageStateText.textContent = panelState.environment?.isPackaged
                ? '已从安装包或便携版启动'
                : '开发模式运行中';
        }

        await refreshMicrophones();
        await refreshOpenClawStatus();
        await refreshMemoryStatus();
        setStatus('配置已就绪。修改后点击右下角保存。');
    } catch (error) {
        setStatus(`读取配置失败：${error.message || error}`);
    }
}

function setRangeValue(element, value) {
    if (!element) {
        return;
    }

    const minimum = Number(element.min || 0);
    const maximum = Number(element.max || 100);
    element.value = String(Math.round(clampNumber(value, minimum, maximum, minimum, 0)));
}

function beginDialogueBubbleDrag(event) {
    if (event.button !== 0 || !elements.avatarBubbleWindowPreview || !elements.avatarBubblePreview) {
        return;
    }

    event.preventDefault();
    const windowRect = elements.avatarBubbleWindowPreview.getBoundingClientRect();
    const bubbleRect = elements.avatarBubblePreview.getBoundingClientRect();
    dialoguePreviewDrag = {
        type: 'bubble',
        pointerId: event.pointerId,
        windowLeft: windowRect.left,
        windowTop: windowRect.top,
        offsetX: event.clientX - bubbleRect.left,
        offsetY: event.clientY - bubbleRect.top
    };
    elements.avatarBubblePreview.setPointerCapture?.(event.pointerId);
}

function beginDialogueWindowResize(event) {
    if (event.button !== 0) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    dialoguePreviewDrag = {
        type: 'window',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startExtraWidth: Number(elements.avatarBubbleExtraWidth.value) || 0,
        startExtraTop: Number(elements.avatarBubbleExtraTop.value) || 0
    };
    elements.avatarBubbleWindowResize.setPointerCapture?.(event.pointerId);
}

function moveDialoguePreviewDrag(event) {
    if (!dialoguePreviewDrag || event.pointerId !== dialoguePreviewDrag.pointerId) {
        return;
    }

    event.preventDefault();

    if (dialoguePreviewDrag.type === 'bubble') {
        const nextLeft = (event.clientX - dialoguePreviewDrag.windowLeft - dialoguePreviewDrag.offsetX) /
            dialoguePreviewScale;
        const nextTop = (event.clientY - dialoguePreviewDrag.windowTop - dialoguePreviewDrag.offsetY) /
            dialoguePreviewScale;
        setRangeValue(elements.avatarBubbleLeft, nextLeft);
        setRangeValue(elements.avatarBubbleTop, nextTop);
    } else if (dialoguePreviewDrag.type === 'window') {
        const nextExtraWidth = dialoguePreviewDrag.startExtraWidth +
            (event.clientX - dialoguePreviewDrag.startX) / dialoguePreviewScale;
        const nextExtraTop = dialoguePreviewDrag.startExtraTop +
            (event.clientY - dialoguePreviewDrag.startY) / dialoguePreviewScale;
        setRangeValue(elements.avatarBubbleExtraWidth, nextExtraWidth);
        setRangeValue(elements.avatarBubbleExtraTop, nextExtraTop);
    }

    updateRangeLabels();
    syncSaveButton();
}

function endDialoguePreviewDrag(event) {
    if (!dialoguePreviewDrag || event.pointerId !== dialoguePreviewDrag.pointerId) {
        return;
    }

    event.preventDefault();
    dialoguePreviewDrag = null;
    syncSaveButton();
}

[
    elements.avatarBubbleExtraWidth,
    elements.avatarBubbleExtraTop,
    elements.avatarBubbleLeft,
    elements.avatarBubbleScale,
    elements.avatarBubbleTop,
    elements.cameraDistance,
    elements.cameraHeight,
    elements.cameraTargetY,
    elements.llmBaseUrl,
    elements.llmModel,
    elements.llmProvider,
    elements.llmTemperature,
    elements.llmTimeout,
    elements.humanClawStateDir,
    elements.elevenLabsApiBase,
    elements.elevenLabsVoiceId,
    elements.elevenLabsModelId,
    elements.elevenLabsOutputFormat,
    elements.elevenLabsTimeout,
    elements.computerControlEnabled,
    elements.emailQqAccount,
    elements.emailGmailAccount,
    elements.emailOutlookAccount,
    elements.petMouseHitTestDebug,
    elements.petMouseHitTestEnabled,
    elements.petMouseHitTestHeight,
    elements.petMouseHitTestOffsetX,
    elements.petMouseHitTestOffsetY,
    elements.petMouseHitTestShape,
    elements.petMouseHitTestWidth,
    elements.petScale,
    elements.preferredMic,
    elements.recognitionMode,
    elements.renderAmbientFill,
    elements.renderAntialiasEnabled,
    elements.renderFpsLimit,
    elements.renderKeyLight,
    elements.renderLightYaw,
    elements.renderOutlineEnabled,
    elements.renderOutlineScale,
    elements.renderProfile,
    elements.renderResolutionScale,
    elements.renderShadowEnabled,
    elements.renderShadowQuality,
    elements.petShowTaskbar,
    elements.speechMode,
    elements.ttsPitch,
    elements.ttsRate,
    elements.ttsVolume
].forEach((element) => {
    element?.addEventListener('input', () => {
        updateRangeLabels();
        syncSaveButton();
    });
    element?.addEventListener('change', () => {
        updateRangeLabels();
        syncSaveButton();
    });
});

elements.avatarBubblePreview?.addEventListener('pointerdown', beginDialogueBubbleDrag);
elements.avatarBubblePreview?.addEventListener('pointermove', moveDialoguePreviewDrag);
elements.avatarBubblePreview?.addEventListener('pointerup', endDialoguePreviewDrag);
elements.avatarBubblePreview?.addEventListener('pointercancel', endDialoguePreviewDrag);
elements.avatarBubbleWindowResize?.addEventListener('pointerdown', beginDialogueWindowResize);
elements.avatarBubbleWindowResize?.addEventListener('pointermove', moveDialoguePreviewDrag);
elements.avatarBubbleWindowResize?.addEventListener('pointerup', endDialoguePreviewDrag);
elements.avatarBubbleWindowResize?.addEventListener('pointercancel', endDialoguePreviewDrag);
window.addEventListener('resize', syncDialoguePreview);

elements.llmApiKey.addEventListener('input', () => {
    if (elements.llmApiKey.value.trim()) {
        pendingClearLlmKey = false;
    }
    syncLlmKeyState();
    syncSaveButton();
});

elements.elevenLabsApiKey.addEventListener('input', () => {
    if (elements.elevenLabsApiKey.value.trim()) {
        pendingClearElevenLabsKey = false;
    }
    syncElevenLabsKeyState();
    syncSaveButton();
});

for (const [providerId, entry] of Object.entries(emailElements)) {
    entry.secret?.addEventListener('input', () => {
        if (entry.secret.value.trim()) {
            pendingClearEmailSecrets[providerId] = false;
        }
        syncEmailSecretStates();
        syncSaveButton();
    });
    entry.clear?.addEventListener('click', () => {
        if (entry.secret) {
            entry.secret.value = '';
        }
        pendingClearEmailSecrets[providerId] = Boolean(currentPreferences?.emailProfiles?.[providerId]?.secretConfigured);
        syncEmailSecretStates();
        syncSaveButton();
    });
}

elements.clearLlmKeyBtn.addEventListener('click', () => {
    elements.llmApiKey.value = '';
    pendingClearLlmKey = Boolean(currentPreferences?.llmApiKeyConfigured);
    syncLlmKeyState();
    syncSaveButton();
});

elements.clearElevenLabsKeyBtn.addEventListener('click', () => {
    elements.elevenLabsApiKey.value = '';
    pendingClearElevenLabsKey = Boolean(currentPreferences?.elevenLabsApiKeyConfigured);
    syncElevenLabsKeyState();
    syncSaveButton();
});

elements.chooseHumanClawStateDirBtn?.addEventListener('click', async () => {
    if (!window.aigrilDesktop?.chooseHumanClawStateDir) {
        setStatus('当前环境不支持选择目录。');
        return;
    }
    try {
        const result = await window.aigrilDesktop.chooseHumanClawStateDir();
        if (!result?.ok || !result.path) {
            return;
        }
        elements.humanClawStateDir.value = result.path;
        if (elements.humanClawStateDirHelp) {
            elements.humanClawStateDirHelp.textContent = `保存后使用：${result.path}`;
        }
        syncSaveButton();
    } catch (error) {
        setStatus(`选择目录失败：${error.message || error}`);
    }
});

elements.resetHumanClawStateDirBtn?.addEventListener('click', () => {
    elements.humanClawStateDir.value = '';
    if (elements.humanClawStateDirHelp) {
        elements.humanClawStateDirHelp.textContent =
            `保存后使用默认目录：${currentPreferences?.humanClawDefaultStateDir || '软件根目录下的 .humanclaw-state'}`;
    }
    syncSaveButton();
});

elements.saveBtn.addEventListener('click', () => {
    void savePreferences();
});

elements.resetBtn.addEventListener('click', () => {
    void restoreDefaults();
});

elements.refreshMicsBtn.addEventListener('click', () => {
    void refreshMicrophones({ requestPermission: true });
});

elements.refreshMemoryBtn?.addEventListener('click', () => {
    void refreshMemoryStatus();
});

elements.resetAffinityBtn?.addEventListener('click', () => {
    void resetAffinityScore();
});

elements.closeBtn.addEventListener('click', () => {
    void window.aigrilDesktop?.closeCurrentWindow?.();
});

window.aigrilDesktop?.onPreferencesUpdated?.(({ preferences = {} } = {}) => {
    if (saveInFlight) {
        return;
    }

    if (hasDirtyChanges()) {
        setStatus('检测到外部配置更新。当前面板中的改动还没保存。');
        return;
    }

    fillForm(preferences);
    void refreshOpenClawStatus();
    void refreshMemoryStatus();
    setStatus('已同步外部配置更新。');
});

window.aigrilDesktop?.gateway?.onEvent?.((event = {}) => {
    if (/^(gateway|agent|tool)\./.test(event.type || '')) {
        void refreshOpenClawStatus();
    }
    if (/^agent\.memory\./.test(event.type || '')) {
        void refreshMemoryStatus();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    updateRangeLabels();
    void initialize();
});

navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    void refreshMicrophones();
});
