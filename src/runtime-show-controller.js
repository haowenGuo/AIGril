import { ensurePerformanceTimeline, formatTimelineTime } from './performance-workspace.js';
import { createEmptyResourceLibrary, fetchResourceLibrary } from './resource-library.js';
import {
    createEmptyResourcePlatformState,
    fetchAssetTextPreview,
    loadResourcePlatformState,
    mergeLibraryWithPlatform,
    resolveAssetUrl
} from './resource-platform-store.js';
import {
    buildPerformanceFromCharacterWork,
    normalizeWorkResourceRefs,
    resolveWorkResourceBindings
} from './resource-reference-resolver.js';
import { PerformanceRuntimeController } from './performance-runtime.js';


function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


function readinessText(isReady, readyText, pendingText) {
    return isReady ? readyText : pendingText;
}


function workReadiness(work, library) {
    const refs = normalizeWorkResourceRefs(work?.resourceRefs || {});
    const bindings = resolveWorkResourceBindings(refs, library);
    return {
        refs,
        bindings,
        hasAudio: Boolean(bindings.song || bindings.accompaniment),
        hasLyrics: Boolean(bindings.lyrics || work?.timeline?.segments?.length),
        hasMotion: Boolean(
            bindings.motion ||
            work?.timeline?.segments?.some((segment) => segment.motionId || segment.motionCategory) ||
            work?.preferredMotionCategory
        ),
        segmentCount: work?.timeline?.segments?.length || 0
    };
}


export class RuntimeShowController {
    constructor({ vrmSystem, chatSystem = null, activePackage = null, announce = null } = {}) {
        this.vrmSystem = vrmSystem;
        this.chatSystem = chatSystem;
        this.activePackage = activePackage;
        this.announce = typeof announce === 'function' ? announce : null;

        this.baseLibrary = createEmptyResourceLibrary();
        this.platformState = createEmptyResourcePlatformState();
        this.library = createEmptyResourceLibrary();

        this.selectedWorkId = '';
        this.runtimeState = {
            isPlaying: false,
            performanceId: '',
            currentTime: 0,
            duration: 0,
            activeSegmentId: '',
            activeLyricText: '',
            playbackLabel: ''
        };
        this.pendingCompletionMessage = '';
        this.suppressNextCompletionMessage = false;

        this.rootEl = document.getElementById('runtime-show-dock');
        this.metaEl = document.getElementById('runtime-show-meta');
        this.selectEl = document.getElementById('runtime-work-select');
        this.startBtnEl = document.getElementById('runtime-show-start');
        this.stopBtnEl = document.getElementById('runtime-show-stop');
        this.playbackEl = document.getElementById('runtime-show-playback');
        this.lyricEl = document.getElementById('runtime-show-lyric');

        this.performanceRuntime = new PerformanceRuntimeController({
            vrmSystem: this.vrmSystem,
            onStateChange: (runtimeState) => {
                const wasPlaying = this.runtimeState.isPlaying;
                const previousPerformanceId = this.runtimeState.performanceId;
                this.runtimeState = runtimeState;
                this.render();

                if (!runtimeState.isPlaying && wasPlaying && previousPerformanceId) {
                    if (this.suppressNextCompletionMessage) {
                        this.suppressNextCompletionMessage = false;
                        return;
                    }

                    const finishedWork = this.getWorks().find((work) => work.id === previousPerformanceId) || null;
                    const message = this.pendingCompletionMessage ||
                        `《${finishedWork?.title || '当前作品'}》演出结束，回到对话态。`;
                    this.pendingCompletionMessage = '';
                    void this.chatSystem?.exitPerformanceMode({ reason: message });
                }
            }
        });
    }

    async init() {
        this.bindEvents();
        await this.reloadResources({ refreshBase: true });
        this.selectDefaultWork();
        this.render();
    }

    bindEvents() {
        this.selectEl?.addEventListener('change', (event) => {
            this.selectedWorkId = event.target.value || '';
            this.render();
        });

        this.startBtnEl?.addEventListener('click', () => {
            void this.startSelectedShow();
        });

        this.stopBtnEl?.addEventListener('click', () => {
            void this.stopShow();
        });

        window.addEventListener('resourcePlatformChanged', (event) => {
            this.platformState = event.detail || this.platformState;
            this.refreshMergedLibrary();
            this.render();
        });
    }

    async reloadResources({ refreshBase = false } = {}) {
        if (refreshBase || !this.baseLibrary?.works?.length) {
            this.baseLibrary = await fetchResourceLibrary();
        }
        this.platformState = await loadResourcePlatformState();
        this.refreshMergedLibrary();
    }

    refreshMergedLibrary() {
        this.library = mergeLibraryWithPlatform(this.baseLibrary, this.platformState);
    }

    setActivePackage(activePackage) {
        this.activePackage = activePackage || null;
        this.selectDefaultWork();
        this.render();
    }

    getWorks() {
        return Array.isArray(this.activePackage?.manifest?.works) ? this.activePackage.manifest.works : [];
    }

    getSelectedWork() {
        return this.getWorks().find((work) => work.id === this.selectedWorkId) || null;
    }

    selectDefaultWork() {
        const works = this.getWorks();
        if (!works.length) {
            this.selectedWorkId = '';
            return;
        }

        if (works.some((work) => work.id === this.selectedWorkId)) {
            return;
        }

        const spotlightWorkTitle = String(this.activePackage?.manifest?.spotlightWork || '').trim();
        const spotlightWork = works.find((work) => work.title === spotlightWorkTitle) || null;
        this.selectedWorkId = spotlightWork?.id || works[0].id;
    }

    async buildSelectedPerformance() {
        const work = this.getSelectedWork();
        if (!work) {
            return null;
        }

        let performance = buildPerformanceFromCharacterWork(work, this.library);
        if (!performance.timeline?.segments?.length && performance.bindings?.lyrics) {
            performance = await ensurePerformanceTimeline(
                performance,
                (asset) => fetchAssetTextPreview(asset, 100000)
            );
        }

        return performance;
    }

    async startSelectedShow() {
        const work = this.getSelectedWork();
        if (!work) {
            this.announce?.('当前角色包还没有可演出的已发布作品。');
            this.render();
            return;
        }

        try {
            const performance = await this.buildSelectedPerformance();
            if (!performance) {
                this.announce?.('当前作品无法生成演出会话。');
                return;
            }

            if (!performance.bindings.song && !performance.bindings.accompaniment && !performance.timeline?.segments?.length) {
                this.announce?.(`《${work.title || '当前作品'}》缺少音频与时间轴，暂时无法开演。`);
                return;
            }

            if (this.runtimeState.isPlaying) {
                this.suppressNextCompletionMessage = true;
            }

            await this.chatSystem?.enterPerformanceMode({ title: work.title || '当前作品' });
            this.pendingCompletionMessage = '';
            await this.performanceRuntime.play({
                performance,
                resolveAssetUrl
            });
            this.render();
        } catch (error) {
            this.pendingCompletionMessage = '';
            this.suppressNextCompletionMessage = false;
            await this.chatSystem?.exitPerformanceMode({
                reason: `演出启动失败：${error.message || error}`
            });
        }
    }

    async stopShow() {
        if (!this.runtimeState.isPlaying) {
            return;
        }

        this.pendingCompletionMessage = '已停止演出，回到对话态。';
        await this.performanceRuntime.stop();
    }

    render() {
        if (!this.rootEl) {
            return;
        }

        const works = this.getWorks();
        const selectedWork = this.getSelectedWork();
        const readiness = selectedWork ? workReadiness(selectedWork, this.library) : null;

        this.rootEl.dataset.state = !works.length
            ? 'empty'
            : this.runtimeState.isPlaying
                ? 'playing'
                : 'ready';

        if (this.selectEl) {
            this.selectEl.innerHTML = works.length
                ? works.map((work) => (
                    `<option value="${escapeHtml(work.id)}"${work.id === this.selectedWorkId ? ' selected' : ''}>${escapeHtml(work.title || '未命名作品')}</option>`
                )).join('')
                : '<option value="">没有已发布作品</option>';
            this.selectEl.disabled = !works.length || this.runtimeState.isPlaying;
        }

        if (this.startBtnEl) {
            this.startBtnEl.disabled = !selectedWork;
        }

        if (this.stopBtnEl) {
            this.stopBtnEl.disabled = !this.runtimeState.isPlaying;
        }

        if (this.metaEl) {
            if (!works.length) {
                this.metaEl.textContent = '当前激活角色包还没有可演出的已发布作品。';
            } else if (!selectedWork || !readiness) {
                this.metaEl.textContent = `已发布 ${works.length} 个作品。`;
            } else {
                this.metaEl.textContent = [
                    `已发布 ${works.length} 个作品`,
                    readinessText(readiness.hasAudio, '音频就绪', '缺少音频'),
                    readinessText(readiness.hasLyrics, `时间轴 ${readiness.segmentCount || '待生成'} 段`, '缺少歌词'),
                    readinessText(readiness.hasMotion, '动作已就绪', '动作走默认兜底')
                ].join(' · ');
            }
        }

        if (this.playbackEl) {
            this.playbackEl.textContent = this.runtimeState.isPlaying
                ? `${this.runtimeState.playbackLabel || '演出'} · ${formatTimelineTime(this.runtimeState.currentTime || 0)}`
                : (selectedWork?.title ? `默认作品：${selectedWork.title}` : '等待选择作品');
        }

        if (this.lyricEl) {
            this.lyricEl.textContent = this.runtimeState.activeLyricText ||
                (selectedWork?.mood
                    ? `${selectedWork.mood} · 点击“开演”进入正式 Runtime 演出。`
                    : '当前没有正在播放的演出。');
        }
    }
}
