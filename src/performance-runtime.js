import {
    getTimelineDurationHint,
    selectPlaybackBinding
} from './performance-workspace.js';


function createEmptyRuntimeState() {
    return {
        isPlaying: false,
        performanceId: '',
        currentTime: 0,
        duration: 0,
        activeSegmentId: '',
        activeLyricText: '',
        playbackLabel: ''
    };
}


function findActiveSegment(segments, currentTime) {
    return (segments || []).find((segment) => (
        currentTime >= Number(segment.startTime || 0) &&
        currentTime < Number(segment.endTime || 0)
    )) || null;
}


function resolveSegmentCue(performance, segment) {
    const motionBinding = performance?.bindings?.motion || null;

    if (segment?.motionId) {
        return {
            motionId: segment.motionId
        };
    }

    if (segment?.motionCategory) {
        return {
            category: segment.motionCategory,
            intensity: segment.motionIntensity || 'medium'
        };
    }

    if (motionBinding?.id && !motionBinding?.path?.match(/^(?:[A-Za-z]:[\\/]|\/)/)) {
        return {
            motionId: motionBinding.id
        };
    }

    const fallbackCategory =
        motionBinding?.metadata?.category ||
        motionBinding?.metadata?.motion_category ||
        '';
    if (fallbackCategory) {
        return {
            category: fallbackCategory,
            intensity: motionBinding?.metadata?.intensity || 'medium'
        };
    }

    return {
        category: 'idle',
        intensity: 'low',
        legacyAction: 'idle'
    };
}


function nowMs() {
    return globalThis.performance?.now?.() || Date.now();
}


export class PerformanceRuntimeController {
    constructor({ vrmSystem, onStateChange = null } = {}) {
        this.vrmSystem = vrmSystem;
        this.onStateChange = typeof onStateChange === 'function' ? onStateChange : null;

        this.audioEl = new Audio();
        this.audioEl.preload = 'auto';

        this.runtimeState = createEmptyRuntimeState();
        this.currentPerformance = null;
        this.lastSegmentId = '';
        this.rafId = 0;
        this.manualClockStartedAt = 0;
        this.manualClockOffset = 0;
        this.usingAudioPlayback = false;

        this.sync = this.sync.bind(this);
        this.audioEl.addEventListener('ended', () => {
            void this.stop();
        });
    }

    emitState(nextPartialState) {
        this.runtimeState = {
            ...this.runtimeState,
            ...nextPartialState
        };
        this.onStateChange?.(this.runtimeState);
    }

    async play({ performance: performanceRecord, resolveAssetUrl }) {
        if (!performanceRecord) {
            return;
        }

        await this.stop({ restoreIdle: false });

        this.currentPerformance = performanceRecord;
        this.lastSegmentId = '';
        this.manualClockOffset = 0;
        this.manualClockStartedAt = nowMs();

        const segments = performanceRecord?.timeline?.segments || [];
        const durationHint = getTimelineDurationHint(performanceRecord);
        const playbackBinding = selectPlaybackBinding(performanceRecord);
        const playbackLabel = playbackBinding?.slot === 'accompaniment'
            ? '伴奏'
            : playbackBinding?.slot === 'song'
                ? '歌曲'
                : '时间轴';

        this.emitState({
            isPlaying: true,
            performanceId: performanceRecord.id,
            currentTime: 0,
            duration: durationHint,
            activeSegmentId: '',
            activeLyricText: '',
            playbackLabel
        });

        if (segments.length) {
            await this.triggerSegmentCue(segments[0]);
        } else {
            await this.vrmSystem.playMotionCue({ category: 'idle', intensity: 'low', legacyAction: 'idle' });
        }

        if (playbackBinding?.path) {
            const assetUrl = await resolveAssetUrl(playbackBinding);
            this.audioEl.src = assetUrl;
            this.audioEl.currentTime = 0;
            this.usingAudioPlayback = true;
            await this.audioEl.play();
        } else {
            this.usingAudioPlayback = false;
        }

        this.sync();
    }

    async stop({ restoreIdle = true } = {}) {
        if (this.rafId) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }

        if (!this.audioEl.paused) {
            this.audioEl.pause();
        }
        this.audioEl.currentTime = 0;
        this.audioEl.src = '';

        const hadPerformance = Boolean(this.currentPerformance);
        this.currentPerformance = null;
        this.lastSegmentId = '';
        this.usingAudioPlayback = false;

        this.emitState(createEmptyRuntimeState());

        if (restoreIdle && hadPerformance) {
            await this.vrmSystem.playMotionCue({ category: 'idle', intensity: 'low', legacyAction: 'idle' });
        }
    }

    async seek(nextTime) {
        const safeTime = Math.max(0, Number(nextTime) || 0);
        if (this.usingAudioPlayback) {
            this.audioEl.currentTime = safeTime;
            return;
        }

        this.manualClockOffset = safeTime;
        this.manualClockStartedAt = nowMs();
        await this.syncCurrentSegment(safeTime);
    }

    async triggerSegmentCue(segment) {
        if (!segment) {
            return;
        }

        const cue = resolveSegmentCue(this.currentPerformance, segment);
        await this.vrmSystem.playMotionCue(cue);

        if (segment.expression) {
            this.vrmSystem.applyExpressionCue({
                name: segment.expression,
                intensity: segment.expressionIntensity || 'medium'
            });
        }
    }

    async syncCurrentSegment(currentTime) {
        const performanceRecord = this.currentPerformance;
        if (!performanceRecord) {
            return;
        }

        const segments = performanceRecord?.timeline?.segments || [];
        const activeSegment = findActiveSegment(segments, currentTime);

        if (activeSegment?.id && activeSegment.id !== this.lastSegmentId) {
            this.lastSegmentId = activeSegment.id;
            await this.triggerSegmentCue(activeSegment);
        }

        this.emitState({
            isPlaying: true,
            performanceId: performanceRecord.id,
            currentTime,
            duration: this.audioEl.duration && Number.isFinite(this.audioEl.duration)
                ? this.audioEl.duration
                : getTimelineDurationHint(performanceRecord),
            activeSegmentId: activeSegment?.id || '',
            activeLyricText: activeSegment?.text || '',
            playbackLabel: this.runtimeState.playbackLabel
        });
    }

    sync() {
        const performanceRecord = this.currentPerformance;
        if (!performanceRecord) {
            return;
        }

        const durationHint = getTimelineDurationHint(performanceRecord);
        const currentTime = this.usingAudioPlayback
            ? this.audioEl.currentTime
            : this.manualClockOffset + ((nowMs() - this.manualClockStartedAt) / 1000);

        void this.syncCurrentSegment(currentTime);

        if (!this.usingAudioPlayback && durationHint > 0 && currentTime >= durationHint) {
            void this.stop();
            return;
        }

        if (!this.runtimeState.isPlaying) {
            return;
        }

        this.rafId = window.requestAnimationFrame(this.sync);
    }
}
