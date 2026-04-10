import { CONFIG } from './config.js';


function base64ToBlobUrl(base64Audio, mimeType) {
    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index);
    }

    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}


function getSafeAlignment(alignment, displayText) {
    if (!alignment?.characters?.length) {
        return null;
    }

    const joinedText = alignment.characters.join('');
    if (joinedText !== displayText) {
        return null;
    }

    return alignment;
}


export class TTSAudioPlayer {
    constructor(vrmSystem) {
        this.vrmSystem = vrmSystem;

        this.audioElement = new Audio();
        this.audioElement.preload = 'auto';

        this.audioContext = null;
        this.mediaSourceNode = null;
        this.analyserNode = null;
        this.frequencyData = null;

        this.currentObjectUrl = null;
        this.syncRafId = 0;
    }

    async unlock() {
        try {
            await this.ensureAudioGraph();
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.warn('⚠️ 音频上下文解锁失败，将继续尝试浏览器原生播放：', error);
        }
    }

    async playSpeech({
        audioBase64,
        mimeType,
        displayText,
        alignment,
        onTextProgress,
        onPlaybackStart,
        onPlaybackEnd
    }) {
        await this.stop();
        await this.unlock();

        const safeAlignment = getSafeAlignment(alignment, displayText);
        let visibleCharCount = 0;

        this.currentObjectUrl = base64ToBlobUrl(audioBase64, mimeType);
        this.audioElement.src = this.currentObjectUrl;
        this.audioElement.currentTime = 0;
        this.audioElement.load();

        if (!safeAlignment && onTextProgress) {
            onTextProgress(displayText);
        }

        return new Promise((resolve, reject) => {
            const cleanupListeners = () => {
                this.audioElement.onended = null;
                this.audioElement.onerror = null;
            };

            const finalizePlayback = () => {
                cleanupListeners();
                this.stop().finally(() => {
                    if (onTextProgress) {
                        onTextProgress(displayText);
                    }
                    if (onPlaybackEnd) {
                        onPlaybackEnd();
                    }
                    resolve();
                });
            };

            this.audioElement.onerror = () => {
                cleanupListeners();
                this.stop().finally(() => reject(new Error('音频资源播放失败')));
            };

            this.audioElement.onended = () => {
                finalizePlayback();
            };

            this.audioElement.play()
                .then(() => {
                    if (this.analyserNode) {
                        this.vrmSystem.startAudioDrivenSpeech();
                    } else {
                        this.vrmSystem.startFallbackSpeech();
                    }
                    if (onPlaybackStart) {
                        onPlaybackStart();
                    }

                    const syncFrame = () => {
                        this.syncRafId = window.requestAnimationFrame(syncFrame);
                        this.updateLipSyncFromAudio();

                        if (safeAlignment && onTextProgress) {
                            visibleCharCount = this.findVisibleCharCount(
                                safeAlignment,
                                this.audioElement.currentTime,
                                visibleCharCount
                            );
                            onTextProgress(safeAlignment.characters.slice(0, visibleCharCount).join(''));
                        }
                    };

                    syncFrame();
                })
                .catch((error) => {
                    cleanupListeners();
                    this.stop().finally(() => reject(error));
                });
        });
    }

    async stop() {
        if (this.syncRafId) {
            window.cancelAnimationFrame(this.syncRafId);
            this.syncRafId = 0;
        }

        if (!this.audioElement.paused) {
            this.audioElement.pause();
        }

        this.audioElement.currentTime = 0;
        this.vrmSystem.stopSpeaking();

        if (this.currentObjectUrl) {
            URL.revokeObjectURL(this.currentObjectUrl);
            this.currentObjectUrl = null;
        }
    }

    async ensureAudioGraph() {
        if (this.analyserNode) {
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return;
        }

        this.audioContext = new AudioContextClass();
        this.mediaSourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);

        this.mediaSourceNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);
    }

    updateLipSyncFromAudio() {
        if (!this.analyserNode || !this.frequencyData) {
            return;
        }

        this.analyserNode.getByteFrequencyData(this.frequencyData);
        const speechBins = this.frequencyData.subarray(2, Math.min(48, this.frequencyData.length));
        if (speechBins.length === 0) {
            return;
        }

        let total = 0;
        for (const value of speechBins) {
            total += value;
        }

        const average = total / speechBins.length;
        const normalized = Math.min(1, average / CONFIG.AUDIO_LIP_SYNC_DIVISOR);
        const mouthValue = Math.min(CONFIG.MAX_MOUTH_OPEN, normalized * CONFIG.AUDIO_LIP_SYNC_BOOST);

        this.vrmSystem.setLipSyncValue(mouthValue);
    }

    findVisibleCharCount(alignment, currentTime, lastVisibleCharCount) {
        const charStartTimes = alignment.character_start_times_seconds || [];
        let nextVisibleCharCount = lastVisibleCharCount;

        while (
            nextVisibleCharCount < charStartTimes.length &&
            charStartTimes[nextVisibleCharCount] <= currentTime + CONFIG.TEXT_SYNC_LEAD_SECONDS
        ) {
            nextVisibleCharCount += 1;
        }

        return nextVisibleCharCount;
    }
}
