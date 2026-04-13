import { CONFIG } from './config.js';

const CHAT_UI_EVENT_NAME = 'aigril-chat-ui-event';

export class ChatTTSSystem {
    constructor(vrmSystem, audioPlayer, chatService) {
        this.vrmSystem = vrmSystem;
        this.audioPlayer = audioPlayer;
        this.chatService = chatService;

        this.messageHistory = [];
        this.messageListEl = document.getElementById('message-list');
        this.inputEl = document.getElementById('message-input');
        this.sendBtnEl = document.getElementById('send-btn');
        this.sessionId = this.getOrCreateSessionId();

        this.isBusy = false;
        this.autoChatTimer = null;
        this.hasShownAutoplayHint = false;
        this.hasShownTextFallbackHint = false;
        this.messageCounter = 0;

        this.inputEl.disabled = true;
        this.sendBtnEl.disabled = true;

        this.bindEvents();
        this.installAudioUnlockHandlers();
        this.emitChatUiEvent({ type: 'state', isBusy: this.isBusy });
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = `user_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    bindEvents() {
        this.sendBtnEl.addEventListener('click', () => this.sendMessage());
        this.inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });

        window.addEventListener('modelLoaded', () => {
            const welcomeMessage = this.chatService?.getWelcomeMessage?.() ||
                'AIGL到啦！现在可以聊天啦~';
            this.addSystemMessage(welcomeMessage);
            this.inputEl.disabled = false;
            this.sendBtnEl.disabled = false;
            this.startAutoChatTimer();
            this.emitChatUiEvent({ type: 'state', isBusy: this.isBusy });
        });
    }

    installAudioUnlockHandlers() {
        const unlockAudio = async () => {
            try {
                await this.audioPlayer.unlock();
            } catch (error) {
                console.warn('⚠️ 提前解锁音频失败：', error);
            }
        };

        window.addEventListener('pointerdown', unlockAudio, { once: true });
        window.addEventListener('keydown', unlockAudio, { once: true });
    }

    startAutoChatTimer() {
        if (this.autoChatTimer) {
            clearTimeout(this.autoChatTimer);
        }

        const randomDelay = CONFIG.AUTO_CHAT_MIN_INTERVAL +
            Math.random() * (CONFIG.AUTO_CHAT_MAX_INTERVAL - CONFIG.AUTO_CHAT_MIN_INTERVAL);

        console.log(`⏱️ 下一次主动对话将在 ${(randomDelay / 1000).toFixed(1)} 秒后`);
        this.autoChatTimer = setTimeout(() => this.triggerAutoChat(), randomDelay);
    }

    createMessageId(role = 'message') {
        this.messageCounter += 1;
        return `${role}-${Date.now()}-${this.messageCounter}`;
    }

    ensureMessageIdentity(element, role) {
        if (!element.dataset.messageId) {
            element.dataset.messageId = this.createMessageId(role);
        }
        if (role) {
            element.dataset.messageRole = role;
        }
        return element.dataset.messageId;
    }

    inferMessageRole(element) {
        if (element.dataset.messageRole) {
            return element.dataset.messageRole;
        }
        if (element.classList.contains('message-user')) {
            return 'user';
        }
        if (element.classList.contains('message-ai')) {
            return 'assistant';
        }
        if (element.classList.contains('message-system')) {
            return 'system';
        }
        if (element.classList.contains('message-loading')) {
            return 'loading';
        }
        return 'system';
    }

    serializeMessageElement(element) {
        const role = this.inferMessageRole(element);
        return {
            id: this.ensureMessageIdentity(element, role),
            role,
            content: element.textContent || '',
            pending: role === 'loading'
        };
    }

    emitChatUiEvent(payload) {
        window.dispatchEvent(new CustomEvent(CHAT_UI_EVENT_NAME, { detail: payload }));
    }

    notifyMessageAdded(element, role) {
        this.ensureMessageIdentity(element, role);
        this.emitChatUiEvent({
            type: 'message-added',
            message: this.serializeMessageElement(element)
        });
    }

    notifyMessageUpdated(element) {
        if (!element?.dataset?.messageId) {
            return;
        }
        this.emitChatUiEvent({
            type: 'message-updated',
            message: this.serializeMessageElement(element)
        });
    }

    notifyMessageRemoved(element) {
        if (!element?.dataset?.messageId || element.dataset.removalNotified === 'true') {
            return;
        }
        element.dataset.removalNotified = 'true';
        this.emitChatUiEvent({
            type: 'message-removed',
            id: element.dataset.messageId
        });
    }

    setBusy(nextBusy) {
        this.isBusy = nextBusy;
        this.emitChatUiEvent({ type: 'state', isBusy: nextBusy });
    }

    updateMessageContent(element, content) {
        if (!element) {
            return;
        }
        element.textContent = content;
        this.notifyMessageUpdated(element);
    }

    removeMessageElement(element) {
        if (!element) {
            return;
        }
        this.notifyMessageRemoved(element);
        element.remove();
        this.scrollToBottom();
    }

    getTranscriptSnapshot() {
        return Array.from(this.messageListEl.children)
            .filter((element) => element instanceof HTMLElement)
            .map((element) => this.serializeMessageElement(element));
    }

    async sendExternalMessage(content) {
        return this.sendMessage(content);
    }

    async triggerAutoChat() {
        if (this.isBusy) {
            console.log('🤫 当前正忙，跳过本次主动对话');
            this.startAutoChatTimer();
            return;
        }

        console.log('✨ AIGL 尝试主动发起对话...');
        this.setBusy(true);
        const aiMessageDiv = this.createAIMessage();
        this.vrmSystem.startFallbackSpeech();

        try {
            const payload = await this.fetchAssistantTurn(true, (partialPayload) => {
                this.renderStreamingAssistantReply(partialPayload, aiMessageDiv);
            });
            await this.renderAssistantReply(payload, aiMessageDiv);
            this.messageHistory.push({ role: 'assistant', content: payload.display_text });
        } catch (error) {
            this.removeMessageElement(aiMessageDiv);
            console.error('主动对话请求失败：', error);
        } finally {
            this.setBusy(false);
            this.startAutoChatTimer();
        }
    }

    async sendMessage(contentOverride = null) {
        if (this.isBusy) {
            return;
        }

        const hasOverride = typeof contentOverride === 'string';
        const content = String(hasOverride ? contentOverride : this.inputEl.value).trim();
        if (!content) {
            return;
        }

        this.setBusy(true);
        this.startAutoChatTimer();

        if (!hasOverride) {
            this.inputEl.value = '';
        }
        this.addUserMessage(content);
        this.messageHistory.push({ role: 'user', content });

        const loadingEl = this.addLoadingMessage();
        const aiMessageDiv = this.createAIMessage();
        this.vrmSystem.startFallbackSpeech();

        try {
            const payload = await this.fetchAssistantTurn(false, (partialPayload) => {
                this.removeMessageElement(loadingEl);
                this.renderStreamingAssistantReply(partialPayload, aiMessageDiv);
            });
            this.removeMessageElement(loadingEl);
            await this.renderAssistantReply(payload, aiMessageDiv);
            this.messageHistory.push({ role: 'assistant', content: payload.display_text });
        } catch (error) {
            this.removeMessageElement(loadingEl);
            this.removeMessageElement(aiMessageDiv);
            this.vrmSystem.stopSpeaking();
            this.addSystemMessage(`请求失败：${error.message}`);
            console.error('后端请求失败：', error);
        } finally {
            this.setBusy(false);
            this.startAutoChatTimer();
        }
    }

    async fetchAssistantTurn(isAutoChat = false, onProgress) {
        return this.chatService.fetchAssistantTurn({
            sessionId: this.sessionId,
            messageHistory: this.messageHistory,
            is_auto_chat: isAutoChat,
            isAutoChat,
            onProgress
        });
    }

    async renderAssistantReply(payload, aiMessageDiv) {
        const displayText = payload.display_text || payload.speech_text || '...';
        const alignment = payload.normalized_alignment || payload.alignment || null;

        this.executeAvatarCue(payload, aiMessageDiv);

        if (payload.streamMode) {
            this.updateMessageContent(aiMessageDiv, displayText);
            this.vrmSystem.stopSpeaking();
            this.scrollToBottom();
            return;
        }

        if (payload.fallbackMode) {
            await this.playFallbackSpeech(displayText, aiMessageDiv);
            if (!this.hasShownTextFallbackHint) {
                this.addSystemMessage('当前语音服务不可用，已自动切换为纯文本回复。');
                this.hasShownTextFallbackHint = true;
            }
            return;
        }

        try {
            await this.audioPlayer.playSpeech({
                audioBase64: payload.audio_base64,
                mimeType: payload.mime_type,
                displayText,
                alignment,
                onTextProgress: (text) => {
                    this.updateMessageContent(aiMessageDiv, text || '');
                    this.scrollToBottom();
                },
                onPlaybackStart: () => {
                    if (alignment?.characters?.length) {
                        this.updateMessageContent(aiMessageDiv, '');
                    } else {
                        this.updateMessageContent(aiMessageDiv, displayText);
                    }
                    this.scrollToBottom();
                },
                onPlaybackEnd: () => {
                    this.updateMessageContent(aiMessageDiv, displayText);
                    this.scrollToBottom();
                }
            });
        } catch (error) {
            this.updateMessageContent(aiMessageDiv, displayText);
            this.vrmSystem.stopSpeaking();

            this.showAutoplayHintOnce(error);
            console.error('音频播放失败：', error);
        }
    }

    renderStreamingAssistantReply(payload, aiMessageDiv) {
        const displayText = payload.display_text || payload.speech_text || '';

        this.executeAvatarCue(payload, aiMessageDiv);
        this.updateMessageContent(aiMessageDiv, displayText);
        this.scrollToBottom();
    }

    executeAvatarCue(payload, aiMessageDiv) {
        if (payload.action && aiMessageDiv?.dataset.actionCue !== payload.action) {
            this.vrmSystem.playAction(payload.action);
            aiMessageDiv.dataset.actionCue = payload.action;
        }

        if (payload.expression && aiMessageDiv?.dataset.expressionCue !== payload.expression) {
            this.vrmSystem.applyExpressionPreset(payload.expression);
            aiMessageDiv.dataset.expressionCue = payload.expression;
        }
    }

    async playFallbackSpeech(displayText, aiMessageDiv) {
        const durationMs = Math.min(
            CONFIG.TEXT_ONLY_SPEECH_MAX_MS,
            Math.max(CONFIG.TEXT_ONLY_SPEECH_MIN_MS, displayText.length * CONFIG.TEXT_ONLY_SPEECH_CHAR_MS)
        );

        this.vrmSystem.startFallbackSpeech();

        await new Promise((resolve) => {
            const startTime = performance.now();

            const renderFrame = (now) => {
                const elapsedMs = now - startTime;
                const progress = Math.min(1, elapsedMs / durationMs);
                const visibleLength = Math.max(1, Math.round(displayText.length * progress));

                this.updateMessageContent(aiMessageDiv, displayText.slice(0, visibleLength));
                this.scrollToBottom();

                if (progress >= 1) {
                    resolve();
                    return;
                }

                window.requestAnimationFrame(renderFrame);
            };

            window.requestAnimationFrame(renderFrame);
        });

        this.vrmSystem.stopSpeaking();
    }

    showAutoplayHintOnce(error) {
        if (this.hasShownAutoplayHint) {
            return;
        }

        const errorMessage = String(error?.message || error || '').toLowerCase();
        if (
            errorMessage.includes('gesture') ||
            errorMessage.includes('interact') ||
            errorMessage.includes('play')
        ) {
            this.addSystemMessage('浏览器还没解锁音频，请先点击页面任意位置，再试一次语音播放。');
            this.hasShownAutoplayHint = true;
        }
    }

    createAIMessage() {
        const div = document.createElement('div');
        div.className = 'message-item message-ai';
        div.dataset.actionCue = '';
        div.dataset.expressionCue = '';
        this.messageListEl.appendChild(div);
        this.notifyMessageAdded(div, 'assistant');
        this.scrollToBottom();
        return div;
    }

    addUserMessage(content) {
        const div = document.createElement('div');
        div.className = 'message-item message-user';
        div.textContent = content;
        this.messageListEl.appendChild(div);
        this.notifyMessageAdded(div, 'user');
        this.scrollToBottom();
    }

    addSystemMessage(content) {
        const div = document.createElement('div');
        div.className = 'message-item message-system';
        div.textContent = content;
        this.messageListEl.appendChild(div);
        this.notifyMessageAdded(div, 'system');
        this.scrollToBottom();
    }

    addLoadingMessage() {
        const div = document.createElement('div');
        div.className = 'message-loading';
        div.textContent = 'AIGL正在思考...';
        this.messageListEl.appendChild(div);
        this.notifyMessageAdded(div, 'loading');
        this.scrollToBottom();
        return div;
    }

    scrollToBottom() {
        this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
    }
}
