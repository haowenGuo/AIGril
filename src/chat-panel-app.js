import { CONFIG } from './config.js';
import { createDesktopSpeechRecognitionService } from './desktop-speech-recognition.js';

function getMessageClassName(role) {
    if (role === 'user') {
        return 'message-item message-user';
    }
    if (role === 'assistant') {
        return 'message-item message-ai';
    }
    if (role === 'loading') {
        return 'message-loading';
    }
    return 'message-item message-system';
}

window.addEventListener('DOMContentLoaded', () => {
    const messageListEl = document.getElementById('message-list');
    const inputEl = document.getElementById('message-input');
    const sendBtnEl = document.getElementById('send-btn');
    const voiceBtnEl = document.getElementById('voice-btn');
    const closeBtnEl = document.getElementById('close-btn');
    const statusEl = document.getElementById('chat-status');

    let isBusy = false;
    let isRecording = false;
    let isTranscribing = false;
    let speechStatusText = '';
    let currentPreferredMicDeviceId = window.aigrilDesktop?.preferences?.preferredMicDeviceId || '';
    let recorderController = null;
    let recordingTimeoutId = 0;
    let levelPollingId = 0;
    const speechRecognition = createDesktopSpeechRecognitionService();

    function scrollToBottom() {
        messageListEl.scrollTop = messageListEl.scrollHeight;
    }

    function getStatusText() {
        if (isRecording) {
            return speechStatusText || '正在听你说话...';
        }
        if (isTranscribing) {
            return speechStatusText || '正在本地识别语音...';
        }
        if (speechStatusText) {
            return speechStatusText;
        }
        if (isBusy) {
            return 'AIGL 正在思考或说话...';
        }
        return '已连接桌宠';
    }

    function updateComposerState() {
        sendBtnEl.disabled = isBusy || isRecording || isTranscribing || !inputEl.value.trim();
        statusEl.textContent = getStatusText();

        if (voiceBtnEl) {
            voiceBtnEl.hidden = !speechRecognition.supportsRecognition;
            voiceBtnEl.disabled = !speechRecognition.supportsRecognition || isTranscribing || (!isRecording && isBusy);
            voiceBtnEl.dataset.recording = isRecording ? 'true' : 'false';
            voiceBtnEl.textContent = isRecording ? '停止' : '语音';
        }
    }

    function upsertMessage(message) {
        if (!message?.id) {
            return;
        }

        let element = messageListEl.querySelector(`[data-message-id="${message.id}"]`);
        if (!element) {
            element = document.createElement('div');
            element.dataset.messageId = message.id;
            messageListEl.appendChild(element);
        }

        element.className = getMessageClassName(message.role);
        element.dataset.messageRole = message.role || 'system';
        element.textContent = message.content || '';
        scrollToBottom();
    }

    function removeMessage(messageId) {
        const element = messageListEl.querySelector(`[data-message-id="${messageId}"]`);
        if (!element) {
            return;
        }
        element.remove();
        scrollToBottom();
    }

    function renderSnapshot(messages = []) {
        messageListEl.innerHTML = '';
        messages.forEach((message) => upsertMessage(message));
        scrollToBottom();
    }

    function sendCurrentMessage() {
        const content = inputEl.value.trim();
        if (!content || isBusy || isRecording || isTranscribing) {
            return;
        }

        window.aigrilDesktop?.sendChatMessage?.(content);
        inputEl.value = '';
        updateComposerState();
    }

    function clearRecordingTimeout() {
        if (recordingTimeoutId) {
            window.clearTimeout(recordingTimeoutId);
            recordingTimeoutId = 0;
        }
    }

    function clearLevelPolling() {
        if (levelPollingId) {
            window.clearInterval(levelPollingId);
            levelPollingId = 0;
        }
    }

    function setTransientStatus(text, timeoutMs = 2200) {
        speechStatusText = text;
        updateComposerState();

        if (!text) {
            return;
        }

        window.setTimeout(() => {
            if (speechStatusText === text) {
                speechStatusText = '';
                updateComposerState();
            }
        }, timeoutMs);
    }

    async function startVoiceInput() {
        if (!speechRecognition.supportsRecognition || isBusy || isRecording || isTranscribing) {
            return;
        }

        speechStatusText = '正在请求麦克风权限...';
        updateComposerState();

        try {
            recorderController = await speechRecognition.createRecorder({
                preferredDeviceId: currentPreferredMicDeviceId
            });
            isRecording = true;
            speechStatusText = '正在听你说话...';

            if (recorderController.usedFallbackDevice?.()) {
                currentPreferredMicDeviceId = '';
                setTransientStatus('已切回系统默认麦克风', 2200);
            }

            updateComposerState();
            clearRecordingTimeout();
            clearLevelPolling();

            levelPollingId = window.setInterval(() => {
                if (!recorderController) {
                    return;
                }

                const currentLevel = recorderController.getLevel?.() || 0;
                if (currentLevel >= 0.04) {
                    speechStatusText = '正在听你说话... 音量正常';
                } else if (currentLevel >= CONFIG.ASR_MIN_INPUT_LEVEL) {
                    speechStatusText = '正在听你说话... 声音有点小';
                } else {
                    speechStatusText = '正在听你说话... 目前几乎没有收到声音';
                }
                updateComposerState();
            }, 120);

            recordingTimeoutId = window.setTimeout(() => {
                void stopVoiceInput();
            }, CONFIG.ASR_MAX_RECORD_MS);
        } catch (error) {
            console.error('启动本地语音识别失败：', error);
            setTransientStatus(`语音识别失败：${error.message || '无法打开麦克风'}`);
        }
    }

    async function stopVoiceInput({ cancel = false } = {}) {
        if (!recorderController) {
            return;
        }

        const activeRecorder = recorderController;
        recorderController = null;
        clearRecordingTimeout();
        clearLevelPolling();
        isRecording = false;
        isTranscribing = !cancel;

        if (!cancel) {
            speechStatusText = '正在本地识别语音，首次加载会稍慢...';
        } else {
            speechStatusText = '';
        }
        updateComposerState();

        try {
            const audioBlob = cancel
                ? await activeRecorder.cancel()
                : await activeRecorder.stop();

            if (cancel || !audioBlob) {
                speechStatusText = '';
                return;
            }

            const result = await speechRecognition.transcribeAudioBlob(audioBlob);
            const transcript = String(result?.text || '').trim();

            if (!transcript) {
                setTransientStatus('没有听清楚，再说一次吧');
                return;
            }

            inputEl.value = transcript;
            isTranscribing = false;
            speechStatusText = '';
            updateComposerState();
            sendCurrentMessage();
        } catch (error) {
            console.error('本地语音识别失败：', error);
            setTransientStatus(`语音识别失败：${error.message || '本地模型未完成识别'}`);
        } finally {
            isTranscribing = false;
            updateComposerState();
        }
    }

    async function toggleVoiceInput() {
        if (isRecording) {
            await stopVoiceInput();
            return;
        }

        await startVoiceInput();
    }

    sendBtnEl.addEventListener('click', sendCurrentMessage);
    voiceBtnEl?.addEventListener('click', () => {
        void toggleVoiceInput();
    });
    inputEl.addEventListener('input', updateComposerState);
    inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendCurrentMessage();
        }
    });

    window.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void window.aigrilDesktop?.showControlMenu?.();
    });

    closeBtnEl.addEventListener('click', async () => {
        if (recorderController) {
            await stopVoiceInput({ cancel: true });
        }
        await window.aigrilDesktop?.hideChatWindow?.();
    });

    window.aigrilDesktop?.onChatEvent?.((payload = {}) => {
        if (payload.type === 'snapshot') {
            renderSnapshot(payload.messages || []);
            if (typeof payload.isBusy === 'boolean') {
                isBusy = payload.isBusy;
            }
            updateComposerState();
            return;
        }

        if (payload.type === 'message-added' || payload.type === 'message-updated') {
            upsertMessage(payload.message);
            return;
        }

        if (payload.type === 'message-removed') {
            removeMessage(payload.id);
            return;
        }

        if (payload.type === 'state' && typeof payload.isBusy === 'boolean') {
            isBusy = payload.isBusy;
            updateComposerState();
        }
    });

    window.aigrilDesktop?.onPreferencesUpdated?.(({ preferences = {} } = {}) => {
        currentPreferredMicDeviceId = preferences.preferredMicDeviceId || '';
        updateComposerState();
    });

    window.addEventListener('focus', () => {
        window.aigrilDesktop?.requestChatStateSync?.();
    });

    window.addEventListener('beforeunload', () => {
        clearLevelPolling();
        if (recorderController) {
            void stopVoiceInput({ cancel: true });
        }
    });

    updateComposerState();
});
