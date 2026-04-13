import { CONFIG } from './config.js';


export class ChatTTSSystem {
    constructor(vrmSystem, audioPlayer, chatService, runtimeIdentity = null) {
        this.vrmSystem = vrmSystem;
        this.audioPlayer = audioPlayer;
        this.chatService = chatService;
        this.runtimeIdentity = runtimeIdentity;

        this.messageHistory = [];
        this.messageListEl = document.getElementById('message-list');
        this.inputEl = document.getElementById('message-input');
        this.sendBtnEl = document.getElementById('send-btn');
        this.sessionId = this.getOrCreateSessionId();

        this.isBusy = false;
        this.isModelReady = false;
        this.isPerformanceMode = false;
        this.autoChatTimer = null;
        this.hasShownAutoplayHint = false;
        this.hasShownTextFallbackHint = false;

        this.inputEl.disabled = true;
        this.sendBtnEl.disabled = true;

        this.bindEvents();
        this.installAudioUnlockHandlers();
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = `user_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    applyInputAvailability() {
        const disabled = !this.isModelReady || this.isPerformanceMode;
        this.inputEl.disabled = disabled;
        this.sendBtnEl.disabled = disabled;
        this.inputEl.placeholder = this.isPerformanceMode
            ? '演出进行中，结束后继续聊天...'
            : '说点什么...';
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
            if (this.runtimeIdentity?.packageName) {
                this.addSystemMessage(`当前角色包：${this.runtimeIdentity.packageName}`);
            }
            this.isModelReady = true;
            this.applyInputAvailability();
            if (!this.isPerformanceMode) {
                this.startAutoChatTimer();
            }
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
        if (this.isPerformanceMode || !this.isModelReady) {
            return;
        }

        if (this.autoChatTimer) {
            clearTimeout(this.autoChatTimer);
        }

        const randomDelay = CONFIG.AUTO_CHAT_MIN_INTERVAL +
            Math.random() * (CONFIG.AUTO_CHAT_MAX_INTERVAL - CONFIG.AUTO_CHAT_MIN_INTERVAL);

        console.log(`⏱️ 下一次主动对话将在 ${(randomDelay / 1000).toFixed(1)} 秒后`);
        this.autoChatTimer = setTimeout(() => this.triggerAutoChat(), randomDelay);
    }

    async triggerAutoChat() {
        if (this.isBusy || this.isPerformanceMode) {
            console.log('🤫 当前正忙，跳过本次主动对话');
            if (!this.isPerformanceMode) {
                this.startAutoChatTimer();
            }
            return;
        }

        console.log('✨ AIGL 尝试主动发起对话...');
        this.isBusy = true;
        const aiMessageDiv = this.createAIMessage();
        this.vrmSystem.startFallbackSpeech();

        try {
            const payload = await this.fetchAssistantTurn(true, (partialPayload) => {
                this.renderStreamingAssistantReply(partialPayload, aiMessageDiv);
            });
            await this.renderAssistantReply(payload, aiMessageDiv);
            this.messageHistory.push({ role: 'assistant', content: payload.display_text });
        } catch (error) {
            aiMessageDiv.remove();
            console.error('主动对话请求失败：', error);
        } finally {
            this.isBusy = false;
            if (!this.isPerformanceMode) {
                this.startAutoChatTimer();
            }
        }
    }

    async sendMessage() {
        if (this.isBusy || this.isPerformanceMode) {
            return;
        }

        const content = this.inputEl.value.trim();
        if (!content) {
            return;
        }

        this.isBusy = true;
        this.startAutoChatTimer();

        this.inputEl.value = '';
        this.addUserMessage(content);
        this.messageHistory.push({ role: 'user', content });

        const loadingEl = this.addLoadingMessage();
        const aiMessageDiv = this.createAIMessage();
        this.vrmSystem.startFallbackSpeech();

        try {
            const payload = await this.fetchAssistantTurn(false, (partialPayload) => {
                loadingEl.remove();
                this.renderStreamingAssistantReply(partialPayload, aiMessageDiv);
            });
            loadingEl.remove();
            await this.renderAssistantReply(payload, aiMessageDiv);
            this.messageHistory.push({ role: 'assistant', content: payload.display_text });
        } catch (error) {
            loadingEl.remove();
            aiMessageDiv.remove();
            this.vrmSystem.stopSpeaking();
            this.addSystemMessage(`请求失败：${error.message}`);
            console.error('后端请求失败：', error);
        } finally {
            this.isBusy = false;
            if (!this.isPerformanceMode) {
                this.startAutoChatTimer();
            }
        }
    }

    async enterPerformanceMode({ title = '' } = {}) {
        this.isPerformanceMode = true;
        if (this.autoChatTimer) {
            clearTimeout(this.autoChatTimer);
            this.autoChatTimer = null;
        }
        this.applyInputAvailability();

        try {
            await this.audioPlayer.stop();
        } catch (error) {
            console.warn('⚠️ 进入演出态时停止语音失败：', error);
        }

        if (title) {
            this.addSystemMessage(`进入演出态：${title}`);
        }
    }

    async exitPerformanceMode({ reason = '' } = {}) {
        this.isPerformanceMode = false;
        this.applyInputAvailability();
        if (reason) {
            this.addSystemMessage(reason);
        }
        if (this.isModelReady) {
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

        if (this.isPerformanceMode) {
            aiMessageDiv.textContent = displayText;
            this.scrollToBottom();
            return;
        }

        this.executeAvatarCue(payload, aiMessageDiv);

        if (payload.streamMode) {
            aiMessageDiv.textContent = displayText;
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
                    aiMessageDiv.textContent = text || '';
                    this.scrollToBottom();
                },
                onPlaybackStart: () => {
                    if (alignment?.characters?.length) {
                        aiMessageDiv.textContent = '';
                    } else {
                        aiMessageDiv.textContent = displayText;
                    }
                    this.scrollToBottom();
                },
                onPlaybackEnd: () => {
                    aiMessageDiv.textContent = displayText;
                    this.scrollToBottom();
                }
            });
        } catch (error) {
            aiMessageDiv.textContent = displayText;
            this.vrmSystem.stopSpeaking();

            this.showAutoplayHintOnce(error);
            console.error('音频播放失败：', error);
        }
    }

    renderStreamingAssistantReply(payload, aiMessageDiv) {
        const displayText = payload.display_text || payload.speech_text || '';

        if (this.isPerformanceMode) {
            aiMessageDiv.textContent = displayText;
            this.scrollToBottom();
            return;
        }

        this.executeAvatarCue(payload, aiMessageDiv);
        aiMessageDiv.textContent = displayText;
        this.scrollToBottom();
    }

    executeAvatarCue(payload, aiMessageDiv) {
        const motionCueKey = payload.motion_category
            ? `${payload.motion_category}:${payload.motion_intensity || 'medium'}`
            : payload.action || '';
        const expressionCueKey = payload.expression
            ? `${payload.expression}:${payload.expression_intensity || 'medium'}`
            : '';

        if (motionCueKey && aiMessageDiv?.dataset.actionCue !== motionCueKey) {
            void this.vrmSystem.playMotionCue({
                category: payload.motion_category,
                intensity: payload.motion_intensity,
                legacyAction: payload.legacy_action || payload.action
            });
            aiMessageDiv.dataset.actionCue = motionCueKey;
        }

        if (expressionCueKey && aiMessageDiv?.dataset.expressionCue !== expressionCueKey) {
            this.vrmSystem.applyExpressionCue({
                name: payload.expression,
                intensity: payload.expression_intensity
            });
            aiMessageDiv.dataset.expressionCue = expressionCueKey;
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

                aiMessageDiv.textContent = displayText.slice(0, visibleLength);
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
        this.scrollToBottom();
        return div;
    }

    addUserMessage(content) {
        const div = document.createElement('div');
        div.className = 'message-item message-user';
        div.textContent = content;
        this.messageListEl.appendChild(div);
        this.scrollToBottom();
    }

    addSystemMessage(content) {
        const div = document.createElement('div');
        div.className = 'message-item message-system';
        div.textContent = content;
        this.messageListEl.appendChild(div);
        this.scrollToBottom();
    }

    addLoadingMessage() {
        const div = document.createElement('div');
        div.className = 'message-loading';
        div.textContent = 'AIGL正在思考...';
        this.messageListEl.appendChild(div);
        this.scrollToBottom();
        return div;
    }

    scrollToBottom() {
        this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
    }
}
