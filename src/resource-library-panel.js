import {
    buildBindingRecordFromAsset,
    buildBindingRecordFromMotion,
    collectWorkAssets,
    createEmptyResourceLibrary,
    fetchResourceLibrary,
    filterMotions,
    filterWorks,
    getBindingSlots,
    isAudioAsset,
    isTextPreviewableAsset,
    summarizeWorkAssets
} from './resource-library.js';
import { PerformanceRuntimeController } from './performance-runtime.js';
import {
    addTimelineSegment,
    applyBindingToPerformance,
    clearPerformanceBinding,
    createPerformanceFromWork,
    ensurePerformanceTimeline,
    formatTimelineTime,
    getTimelineDurationHint,
    listPerformanceBindings,
    removePerformance,
    removeTimelineSegment,
    updateTimelineSegment,
    upsertPerformance
} from './performance-workspace.js';
import {
    fetchAssetTextPreview,
    importAuthorizedAssets,
    loadResourcePlatformState,
    mergeLibraryWithPlatform,
    resolveAssetUrl,
    saveResourcePlatformState
} from './resource-platform-store.js';
import { CUE_INTENSITY_LEVELS, EXPRESSION_NAMES, MOTION_CATEGORIES } from './cue-utils.js';


function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


function labelForSlot(slot) {
    return getBindingSlots().find((item) => item.key === slot)?.label || slot;
}


function categoryLabel(category) {
    const labels = {
        idle: '待机',
        walk: '走路',
        run: '奔跑',
        dance: '舞蹈',
        fight: '战斗',
        sports: '运动',
        zombie: '丧尸',
        superhero: '英雄',
        general: '通用'
    };
    return labels[category] || category || '未指定';
}


function intensityLabel(value) {
    const labels = { low: '低', medium: '中', high: '高' };
    return labels[value] || value || '中';
}


function expressionLabel(value) {
    const labels = {
        happy: '开心',
        sad: '难过',
        angry: '生气',
        relaxed: '放松',
        surprised: '惊讶',
        blinkRight: '眨眼',
        neutral: '中性'
    };
    return labels[value] || value || '未指定';
}


function performanceMatchesQuery(performance, query) {
    if (!query) {
        return true;
    }

    const haystack = [
        performance?.title || '',
        performance?.artist || '',
        performance?.sourceWorkTitle || '',
        Object.values(performance?.bindings || {}).map((binding) => binding?.title || '').join(' ')
    ].join(' ').toLowerCase();

    return haystack.includes(query.toLowerCase());
}


function summarizePerformance(performance) {
    const bindings = performance?.bindings || {};
    return {
        slots: Object.keys(bindings).length,
        timelineSegments: performance?.timeline?.segments?.length || 0,
        playbackSource: performance?.playbackSource || 'auto'
    };
}


function optionHtml(options, selectedValue, emptyLabel = '未指定') {
    const rows = [`<option value="">${escapeHtml(emptyLabel)}</option>`];
    for (const value of options) {
        rows.push(`<option value="${escapeHtml(value)}"${value === selectedValue ? ' selected' : ''}>${escapeHtml(value)}</option>`);
    }
    return rows.join('');
}


function getSegmentMotionText(segment) {
    if (segment?.motionId) {
        return `动作 ${segment.motionId}`;
    }
    if (segment?.motionCategory) {
        return `${categoryLabel(segment.motionCategory)} · ${intensityLabel(segment.motionIntensity)}`;
    }
    return '沿用默认动作';
}


export class ResourceLibraryPanel {
    constructor({ vrmSystem, notify = null } = {}) {
        this.vrmSystem = vrmSystem;
        this.notify = typeof notify === 'function' ? notify : null;

        this.panelEl = document.getElementById('resource-panel');
        this.toggleEl = document.getElementById('resource-panel-toggle');
        this.closeEl = document.getElementById('resource-panel-close');
        this.importEl = document.getElementById('resource-panel-import');
        this.searchEl = document.getElementById('resource-search-input');
        this.tabRowEl = document.getElementById('resource-tab-row');
        this.filterRowEl = document.getElementById('resource-filter-row');
        this.bindingSummaryEl = document.getElementById('resource-binding-summary');
        this.listEl = document.getElementById('resource-list');
        this.detailEl = document.getElementById('resource-detail');
        this.statusEl = document.getElementById('resource-panel-status');

        this.baseLibrary = createEmptyResourceLibrary();
        this.library = createEmptyResourceLibrary();
        this.platformState = {
            importedAssets: [],
            importedWorks: [],
            performances: [],
            activePerformanceId: ''
        };

        this.selectedTab = 'library';
        this.selectedWorkId = '';
        this.selectedMotionId = '';
        this.selectedPerformanceId = '';
        this.selectedSegmentId = '';
        this.selectedWorkFilter = 'all';
        this.selectedMotionCategory = 'all';
        this.searchQuery = '';
        this.previewState = {
            assetId: '',
            title: '',
            content: '',
            loading: false,
            error: ''
        };

        this.audioPreviewEl = new Audio();
        this.playingPreviewId = '';
        this.audioPreviewEl.addEventListener('ended', () => {
            this.playingPreviewId = '';
            this.render();
        });
        this.audioPreviewEl.addEventListener('pause', () => {
            if (!this.audioPreviewEl.currentTime || this.audioPreviewEl.ended) {
                this.playingPreviewId = '';
                this.render();
            }
        });

        this.runtimeState = {
            isPlaying: false,
            performanceId: '',
            currentTime: 0,
            duration: 0,
            activeSegmentId: '',
            activeLyricText: '',
            playbackLabel: ''
        };
        this.performanceRuntime = new PerformanceRuntimeController({
            vrmSystem: this.vrmSystem,
            onStateChange: (runtimeState) => {
                this.runtimeState = runtimeState;
                if (runtimeState.activeSegmentId) {
                    this.selectedSegmentId = runtimeState.activeSegmentId;
                }
                this.renderBindingSummary();
                this.renderDetail();
                this.renderList();
            }
        });
    }

    async init() {
        this.bindEvents();
        await this.loadLibrary();
        this.render();
    }

    bindEvents() {
        this.toggleEl?.addEventListener('click', () => this.toggle());
        this.closeEl?.addEventListener('click', () => this.close());
        this.importEl?.addEventListener('click', () => {
            void this.handleImportAssets();
        });
        this.searchEl?.addEventListener('input', (event) => {
            this.searchQuery = event.target.value.trim();
            this.ensureSelections();
            this.render();
        });

        this.tabRowEl?.addEventListener('click', (event) => {
            const target = event.target.closest('[data-tab]');
            if (!target) {
                return;
            }
            this.selectedTab = target.dataset.tab;
            this.ensureSelections();
            this.render();
        });

        this.filterRowEl?.addEventListener('click', (event) => {
            const target = event.target.closest('[data-filter-value]');
            if (!target) {
                return;
            }

            if (this.selectedTab === 'library') {
                this.selectedWorkFilter = target.dataset.filterValue;
            } else if (this.selectedTab === 'motions') {
                this.selectedMotionCategory = target.dataset.filterValue;
            }

            this.ensureSelections();
            this.render();
        });

        this.listEl?.addEventListener('click', (event) => {
            void this.handleActionClick(event);
        });
        this.detailEl?.addEventListener('click', (event) => {
            void this.handleActionClick(event);
        });
        this.bindingSummaryEl?.addEventListener('click', (event) => {
            void this.handleActionClick(event);
        });
        this.detailEl?.addEventListener('change', (event) => {
            void this.handleDetailChange(event);
        });
        this.detailEl?.addEventListener('input', (event) => {
            if (event.target.matches('[data-change="runtime-seek"]')) {
                void this.handleDetailChange(event);
            }
        });
    }

    async loadLibrary() {
        this.baseLibrary = await fetchResourceLibrary();
        this.platformState = await loadResourcePlatformState();
        this.refreshMergedLibrary();
        this.ensureSelections();
    }

    refreshMergedLibrary() {
        this.library = mergeLibraryWithPlatform(this.baseLibrary, this.platformState);
    }

    getPerformances() {
        return [...(this.platformState?.performances || [])]
            .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    }

    getVisibleWorks() {
        return filterWorks(this.library.works, this.searchQuery, this.selectedWorkFilter);
    }

    getVisibleMotions() {
        return filterMotions(this.library.motions, this.searchQuery, this.selectedMotionCategory);
    }

    getVisiblePerformances() {
        return this.getPerformances().filter((performance) => performanceMatchesQuery(performance, this.searchQuery));
    }

    getSelectedWork() {
        return this.library.works.find((work) => work.id === this.selectedWorkId) || null;
    }

    getSelectedMotion() {
        return this.library.motions.find((motion) => motion.id === this.selectedMotionId) || null;
    }

    getSelectedPerformance() {
        return this.getPerformances().find((performance) => performance.id === this.selectedPerformanceId) || null;
    }

    getSelectedSegment() {
        const performance = this.getSelectedPerformance();
        return performance?.timeline?.segments?.find((segment) => segment.id === this.selectedSegmentId) || null;
    }

    ensureSelections() {
        const visibleWorks = this.getVisibleWorks();
        if (!visibleWorks.find((work) => work.id === this.selectedWorkId)) {
            this.selectedWorkId = visibleWorks[0]?.id || '';
        }

        const visibleMotions = this.getVisibleMotions();
        if (!visibleMotions.find((motion) => motion.id === this.selectedMotionId)) {
            this.selectedMotionId = visibleMotions[0]?.id || '';
        }

        const visiblePerformances = this.getVisiblePerformances();
        const preferredPerformanceId = this.platformState?.activePerformanceId || this.selectedPerformanceId;
        this.selectedPerformanceId = visiblePerformances.find((item) => item.id === preferredPerformanceId)?.id
            || visiblePerformances[0]?.id
            || '';

        const segments = this.getSelectedPerformance()?.timeline?.segments || [];
        if (!segments.find((segment) => segment.id === this.selectedSegmentId)) {
            this.selectedSegmentId = segments[0]?.id || '';
        }
    }

    async applyPlatformState(nextState, { persist = true } = {}) {
        this.platformState = persist ? await saveResourcePlatformState(nextState) : nextState;
        this.refreshMergedLibrary();
        this.ensureSelections();
        this.render();
    }
    announce(message) {
        if (this.notify) {
            this.notify(message);
        }
    }
    async setActivePerformance(performanceId) {
        this.selectedPerformanceId = performanceId;
        await this.applyPlatformState({
            ...this.platformState,
            activePerformanceId: performanceId
        });
    }

    async ensureSelectedPerformance(work = null) {
        const existing = this.getSelectedPerformance();
        if (existing) {
            return existing;
        }

        if (!work) {
            return null;
        }

        const created = createPerformanceFromWork(work);
        await this.applyPlatformState(upsertPerformance(this.platformState, created, { markActive: true }));
        this.announce(`已从《${work.title || '未命名资源'}》创建作品。`);
        return this.getSelectedPerformance();
    }

    async updateSelectedPerformance(mutator) {
        const performance = this.getSelectedPerformance();
        if (!performance) {
            return null;
        }

        const nextPerformance = mutator(performance);
        await this.applyPlatformState(upsertPerformance(this.platformState, nextPerformance, { markActive: true }));
        return this.getSelectedPerformance();
    }

    async ensureTimelineForPerformance(performance) {
        const nextPerformance = await ensurePerformanceTimeline(performance, (asset) => (
            fetchAssetTextPreview(asset, 100000)
        ));

        if (nextPerformance !== performance) {
            await this.applyPlatformState(upsertPerformance(this.platformState, nextPerformance, { markActive: true }));
        }
        return this.getSelectedPerformance() || nextPerformance;
    }

    async handleImportAssets() {
        try {
            const result = await importAuthorizedAssets();
            if (result.canceled) {
                return;
            }

            this.platformState = result.state;
            this.refreshMergedLibrary();
            this.ensureSelections();

            if (result.importedCount) {
                const latestImportedWork = result.state.importedWorks?.[result.state.importedWorks.length - 1];
                if (latestImportedWork?.id) {
                    this.selectedWorkId = latestImportedWork.id;
                }
                this.announce(`已导入 ${result.importedCount} 个授权资源。`);
            } else {
                this.announce('没有导入新资源。');
            }
            this.render();
        } catch (error) {
            console.error('❌ 资源导入失败：', error);
            this.announce(`资源导入失败：${error.message || '未知错误'}`);
        }
    }
    async handleActionClick(event) {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) {
            return;
        }

        const action = actionEl.dataset.action;
        const itemId = actionEl.dataset.id || '';
        const slot = actionEl.dataset.slot || '';

        if (action === 'select-work') {
            this.selectedWorkId = itemId;
            this.previewState = { assetId: '', title: '', content: '', loading: false, error: '' };
            this.render();
            return;
        }

        if (action === 'select-motion') {
            this.selectedMotionId = itemId;
            this.render();
            return;
        }

        if (action === 'select-performance') {
            await this.setActivePerformance(itemId);
            return;
        }

        if (action === 'select-segment') {
            this.selectedSegmentId = itemId;
            this.render();
            return;
        }

        if (action === 'create-performance-from-work') {
            await this.createPerformanceFromSelectedWork();
            return;
        }

        if (action === 'bind-work') {
            await this.bindFirstAssetsFromSelectedWork();
            return;
        }

        if (action === 'bind-asset') {
            await this.bindSelectedAsset(itemId, slot);
            return;
        }

        if (action === 'preview-text') {
            await this.previewSelectedAssetText(itemId);
            return;
        }

        if (action === 'toggle-audio') {
            await this.toggleAudioPreview(itemId);
            return;
        }

        if (action === 'bind-motion') {
            await this.bindMotion(itemId);
            return;
        }

        if (action === 'play-motion') {
            await this.playMotion(itemId);
            return;
        }

        if (action === 'clear-binding') {
            await this.clearBinding(slot);
            return;
        }

        if (action === 'preview-binding') {
            await this.previewBinding(slot);
            return;
        }

        if (action === 'rebuild-timeline') {
            await this.rebuildSelectedPerformanceTimeline();
            return;
        }

        if (action === 'add-segment') {
            await this.updateSelectedPerformance((performance) => addTimelineSegment(performance));
            this.selectedSegmentId = this.getSelectedPerformance()?.timeline?.segments?.slice(-1)[0]?.id || '';
            return;
        }

        if (action === 'delete-segment') {
            const segmentId = itemId || this.selectedSegmentId;
            if (segmentId) {
                await this.updateSelectedPerformance((performance) => removeTimelineSegment(performance, segmentId));
            }
            return;
        }

        if (action === 'delete-performance') {
            const performanceId = itemId || this.selectedPerformanceId;
            if (!performanceId) {
                return;
            }
            if (this.runtimeState.performanceId === performanceId) {
                await this.performanceRuntime.stop();
            }
            await this.applyPlatformState(removePerformance(this.platformState, performanceId));
            return;
        }

        if (action === 'open-timeline') {
            this.selectedTab = 'timeline';
            this.render();
            return;
        }

        if (action === 'open-stage') {
            this.selectedTab = 'stage';
            this.render();
            return;
        }

        if (action === 'play-performance') {
            await this.playSelectedPerformance();
            return;
        }

        if (action === 'stop-performance') {
            await this.performanceRuntime.stop();
        }
    }

    async handleDetailChange(event) {
        const target = event.target;
        const changeType = target.dataset.change;

        if (changeType === 'performance-title') {
            await this.updateSelectedPerformance((performance) => ({
                ...performance,
                title: target.value.trim() || '未命名作品'
            }));
            return;
        }

        if (changeType === 'playback-source') {
            await this.updateSelectedPerformance((performance) => ({
                ...performance,
                playbackSource: target.value || 'auto'
            }));
            return;
        }

        if (changeType === 'segment-field') {
            const segmentId = target.dataset.segmentId;
            const field = target.dataset.field;
            const rawValue = target.value;
            const value = ['startTime', 'endTime'].includes(field) ? Number(rawValue) : rawValue;
            await this.updateSelectedPerformance((performance) => (
                updateTimelineSegment(performance, segmentId, { [field]: value })
            ));
            return;
        }

        if (changeType === 'runtime-seek') {
            await this.performanceRuntime.seek(Number(target.value || 0));
        }
    }

    async createPerformanceFromSelectedWork() {
        const work = this.getSelectedWork();
        if (!work) {
            return;
        }

        const created = createPerformanceFromWork(work);
        await this.applyPlatformState(upsertPerformance(this.platformState, created, { markActive: true }));
        this.selectedTab = 'performances';
        this.announce(`已为《${work.title || '未命名作品'}》创建作品。`);
    }

    async bindFirstAssetsFromSelectedWork() {
        const work = this.getSelectedWork();
        if (!work) {
            return;
        }

        const performance = await this.ensureSelectedPerformance(work);
        if (!performance) {
            return;
        }

        const nextBindings = { ...(performance.bindings || {}) };
        for (const asset of collectWorkAssets(work)) {
            if (asset.slot === 'motion') {
                continue;
            }
            if (!nextBindings[asset.slot]) {
                nextBindings[asset.slot] = buildBindingRecordFromAsset(work, asset);
            }
        }

        await this.applyPlatformState(
            upsertPerformance(this.platformState, { ...performance, bindings: nextBindings }, { markActive: true })
        );
        this.selectedTab = 'performances';
        this.announce(`已把《${work.title || '未命名作品'}》的可绑定资源并入当前作品。`);
    }

    async bindSelectedAsset(assetId, slot) {
        const work = this.getSelectedWork();
        if (!work) {
            return;
        }

        const asset = collectWorkAssets(work).find((item) => item.id === assetId);
        if (!asset) {
            return;
        }

        if (asset.slot === 'motion') {
            this.announce('作品自带动作素材先作为资源入库；运行时默认动作请在“动作”页绑定。');
            return;
        }

        const performance = await this.ensureSelectedPerformance(work);
        if (!performance) {
            return;
        }

        const finalSlot = slot || asset.slot;
        const nextPerformance = applyBindingToPerformance(
            performance,
            finalSlot,
            buildBindingRecordFromAsset(work, asset)
        );
        await this.applyPlatformState(upsertPerformance(this.platformState, nextPerformance, { markActive: true }));
        this.selectedTab = 'performances';
        this.announce(`已绑定${labelForSlot(finalSlot)}：${asset.title || work.title || '未命名资源'}。`);
    }

    async bindMotion(motionId) {
        const performance = await this.ensureSelectedPerformance(this.getSelectedWork());
        if (!performance) {
            this.announce('先创建一个作品，再给它绑定默认动作。');
            return;
        }

        const motion = this.library.motions.find((item) => item.id === motionId);
        if (!motion) {
            return;
        }

        const nextPerformance = applyBindingToPerformance(
            performance,
            'motion',
            buildBindingRecordFromMotion(motion)
        );
        await this.applyPlatformState(upsertPerformance(this.platformState, nextPerformance, { markActive: true }));
        this.announce(`已为作品绑定默认动作：${motion.title || motion.id}`);
    }

    async clearBinding(slot) {
        const performance = this.getSelectedPerformance();
        if (!performance) {
            return;
        }

        await this.applyPlatformState(
            upsertPerformance(this.platformState, clearPerformanceBinding(performance, slot), { markActive: true })
        );
    }

    async playMotion(motionId) {
        const motion = this.library.motions.find((item) => item.id === motionId);
        if (!motion) {
            return;
        }

        try {
            await this.vrmSystem.playMotionCue({ motionId: motion.id });
            this.announce(`正在播放动作：${motion.title || motion.id}`);
        } catch (error) {
            console.error('❌ 播放动作失败：', error);
            this.announce(`动作播放失败：${motion.title || motion.id}`);
        }
    }

    async previewSelectedAssetText(assetId) {
        const work = this.getSelectedWork();
        const asset = collectWorkAssets(work).find((item) => item.id === assetId);
        if (!asset || !isTextPreviewableAsset(asset)) {
            return;
        }

        this.previewState = {
            assetId,
            title: asset.title || work?.title || '',
            content: '',
            loading: true,
            error: ''
        };
        this.renderDetail();

        try {
            const content = await fetchAssetTextPreview(asset);
            this.previewState = {
                assetId,
                title: asset.title || work?.title || '',
                content,
                loading: false,
                error: ''
            };
        } catch (error) {
            this.previewState = {
                assetId,
                title: asset.title || work?.title || '',
                content: '',
                loading: false,
                error: error.message || '预览失败'
            };
        }

        this.renderDetail();
    }

    async toggleAudioPreview(assetId) {
        const work = this.getSelectedWork();
        const asset = collectWorkAssets(work).find((item) => item.id === assetId);
        if (!asset || !isAudioAsset(asset)) {
            return;
        }

        if (this.playingPreviewId === assetId) {
            this.audioPreviewEl.pause();
            this.audioPreviewEl.currentTime = 0;
            this.playingPreviewId = '';
            this.render();
            return;
        }

        try {
            this.audioPreviewEl.pause();
            this.audioPreviewEl.src = await resolveAssetUrl(asset);
            this.playingPreviewId = assetId;
            await this.audioPreviewEl.play();
            this.render();
        } catch {
            this.playingPreviewId = '';
            this.render();
            this.announce(`音频预览失败：${asset.title || '未命名音频'}`);
        }
    }

    async previewBinding(slot) {
        const binding = this.getSelectedPerformance()?.bindings?.[slot] || null;
        if (!binding) {
            return;
        }

        if (slot === 'motion') {
            await this.playMotion(binding.id);
            return;
        }

        if (isAudioAsset(binding)) {
            if (this.playingPreviewId === binding.id) {
                this.audioPreviewEl.pause();
                this.audioPreviewEl.currentTime = 0;
                this.playingPreviewId = '';
            } else {
                this.audioPreviewEl.pause();
                this.audioPreviewEl.src = await resolveAssetUrl(binding);
                this.playingPreviewId = binding.id;
                await this.audioPreviewEl.play().catch(() => {
                    this.playingPreviewId = '';
                    this.announce(`音频预览失败：${binding.title || '未命名音频'}`);
                });
            }
            this.render();
            return;
        }

        if (isTextPreviewableAsset(binding)) {
            this.previewState = {
                assetId: binding.id,
                title: binding.title || binding.workTitle || '',
                content: '',
                loading: true,
                error: ''
            };
            this.render();

            try {
                const content = await fetchAssetTextPreview(binding);
                this.previewState = {
                    assetId: binding.id,
                    title: binding.title || binding.workTitle || '',
                    content,
                    loading: false,
                    error: ''
                };
            } catch (error) {
                this.previewState = {
                    assetId: binding.id,
                    title: binding.title || binding.workTitle || '',
                    content: '',
                    loading: false,
                    error: error.message || '预览失败'
                };
            }

            this.render();
        }
    }

    async rebuildSelectedPerformanceTimeline() {
        const performance = this.getSelectedPerformance();
        if (!performance) {
            this.announce('先创建一个作品，再根据歌词生成时间轴。');
            return;
        }

        if (!performance.bindings?.lyrics) {
            this.announce('当前作品还没有绑定歌词，暂时无法生成歌词-动作时间轴。');
            return;
        }

        const nextPerformance = await ensurePerformanceTimeline(
            {
                ...performance,
                timeline: {
                    ...performance.timeline,
                    segments: []
                }
            },
            (asset) => fetchAssetTextPreview(asset, 100000)
        );

        await this.applyPlatformState(upsertPerformance(this.platformState, nextPerformance, { markActive: true }));
        this.selectedSegmentId = this.getSelectedPerformance()?.timeline?.segments?.[0]?.id || '';
        this.selectedTab = 'timeline';
        this.announce('已按当前歌词重建时间轴。');
    }

    async playSelectedPerformance() {
        let performance = this.getSelectedPerformance();
        if (!performance) {
            this.announce('先创建一个作品，再开始演出。');
            return;
        }

        if (!performance.timeline?.segments?.length && performance.bindings?.lyrics) {
            performance = await this.ensureTimelineForPerformance(performance);
        }

        try {
            await this.performanceRuntime.play({
                performance,
                resolveAssetUrl
            });
            this.selectedTab = 'stage';
            this.announce(`开始演出：${performance.title || '未命名作品'}`);
        } catch (error) {
            console.error('❌ 演出运行失败：', error);
            this.announce(`演出运行失败：${error.message || '未知错误'}`);
        }
    }

    toggle() {
        if (this.panelEl?.classList.contains('is-open')) {
            this.close();
            return;
        }
        this.open();
    }

    open() {
        this.panelEl?.classList.add('is-open');
        document.body.classList.add('resource-panel-open');
        this.toggleEl?.setAttribute('aria-expanded', 'true');
    }

    close() {
        this.panelEl?.classList.remove('is-open');
        document.body.classList.remove('resource-panel-open');
        this.toggleEl?.setAttribute('aria-expanded', 'false');
    }

    render() {
        if (this.panelEl) {
            this.panelEl.dataset.activeTab = this.selectedTab;
        }
        this.renderHeader();
        this.renderTabs();
        this.renderBindingSummary();
        this.renderFilters();
        this.renderList();
        this.renderDetail();
    }
    renderHeader() {
        if (!this.statusEl) {
            return;
        }

        const works = this.library?.stats?.works || this.library.works.length;
        const importedWorks = this.platformState?.importedWorks?.length || 0;
        const motions = this.library?.stats?.motionEntries || this.library.motions.length;
        const performances = this.platformState?.performances?.length || 0;
        const runtimeText = this.runtimeState.isPlaying
            ? ` · 演出 ${formatTimelineTime(this.runtimeState.currentTime)}`
            : '';

        this.statusEl.textContent = `资源 ${works}（导入 ${importedWorks}） · 动作 ${motions} · 作品 ${performances}${runtimeText}`;
    }

    renderTabs() {
        if (!this.tabRowEl) {
            return;
        }

        const tabs = [
            { id: 'library', label: '资源' },
            { id: 'motions', label: '动作' },
            { id: 'performances', label: '作品' },
            { id: 'timeline', label: '时间轴' },
            { id: 'stage', label: '演出' }
        ];

        this.tabRowEl.innerHTML = tabs.map((tab) => `
            <button
                class="resource-tab-btn${this.selectedTab === tab.id ? ' is-active' : ''}"
                data-tab="${tab.id}"
                type="button"
            >${escapeHtml(tab.label)}</button>
        `).join('');
    }

    renderBindingSummary() {
        if (!this.bindingSummaryEl) {
            return;
        }

        const performance = this.getSelectedPerformance();
        if (!performance) {
            this.bindingSummaryEl.innerHTML = `
                <div class="resource-summary-card">
                    <div class="resource-summary-title">还没有作品</div>
                    <div class="resource-empty">先在“资源”里选一首歌，创建一个作品，再绑定歌曲、伴奏、歌词和默认动作。</div>
                </div>
            `;
            return;
        }

        const slotRows = listPerformanceBindings(performance).map((slot) => `
            <div class="binding-slot-row">
                <div class="binding-slot-label">${escapeHtml(slot.label)}</div>
                <div class="binding-slot-value">${escapeHtml(slot.binding?.title || '未绑定')}</div>
                <div class="binding-slot-actions">
                    ${slot.binding ? `<button class="binding-mini-btn" type="button" data-action="preview-binding" data-slot="${slot.key}">${slot.key === 'motion' ? '播放' : '预览'}</button>` : ''}
                    ${slot.binding ? `<button class="binding-mini-btn" type="button" data-action="clear-binding" data-slot="${slot.key}">清空</button>` : ''}
                </div>
            </div>
        `).join('');

        const runtimeBadge = this.runtimeState.isPlaying && this.runtimeState.performanceId === performance.id
            ? '<span class="summary-pill is-live">演出中</span>'
            : '';

        this.bindingSummaryEl.innerHTML = `
            <div class="resource-summary-card">
                <div class="resource-summary-header">
                    <div>
                        <div class="resource-summary-title">${escapeHtml(performance.title || '未命名作品')}</div>
                        <div class="resource-summary-meta">${escapeHtml(performance.artist || '本地演出作品')}</div>
                    </div>
                    ${runtimeBadge}
                </div>
                ${slotRows}
            </div>
        `;
    }

    renderFilters() {
        if (!this.filterRowEl) {
            return;
        }

        let filters = [];
        let active = '';

        if (this.selectedTab === 'library') {
            filters = [
                ['all', '全部'],
                ['song', '歌曲'],
                ['accompaniment', '伴奏'],
                ['lyrics', '歌词'],
                ['score', '乐谱'],
                ['motion', '动作素材']
            ];
            active = this.selectedWorkFilter;
        } else if (this.selectedTab === 'motions') {
            filters = [
                ['all', '全部'],
                ...MOTION_CATEGORIES.map((category) => [category, categoryLabel(category)])
            ];
            active = this.selectedMotionCategory;
        }

        if (!filters.length) {
            this.filterRowEl.innerHTML = '';
            return;
        }

        this.filterRowEl.innerHTML = filters.map(([value, label]) => `
            <button
                class="resource-filter-btn${active === value ? ' is-active' : ''}"
                type="button"
                data-filter-value="${value}"
            >${escapeHtml(label)}</button>
        `).join('');
    }

    renderList() {
        if (!this.listEl) {
            return;
        }

        if (this.selectedTab === 'library') {
            const works = this.getVisibleWorks();
            if (!works.length) {
                this.listEl.innerHTML = '<div class="resource-empty">没有匹配的资源作品。</div>';
                return;
            }

            this.listEl.innerHTML = works.map((work) => {
                const summary = summarizeWorkAssets(work);
                return `
                    <button class="resource-list-item${work.id === this.selectedWorkId ? ' is-active' : ''}" type="button" data-action="select-work" data-id="${work.id}">
                        <div class="resource-list-title">${escapeHtml(work.title || '未命名作品')}</div>
                        <div class="resource-list-meta">${escapeHtml(work.artist || (work.storage === 'desktop' ? '桌面导入资源' : '内置资源库'))}</div>
                        <div class="resource-list-tags">
                            ${summary.song ? `<span>歌 ${summary.song}</span>` : ''}
                            ${summary.accompaniment ? `<span>伴 ${summary.accompaniment}</span>` : ''}
                            ${summary.lyrics ? `<span>词 ${summary.lyrics}</span>` : ''}
                            ${summary.score ? `<span>谱 ${summary.score}</span>` : ''}
                            ${summary.motion ? `<span>动 ${summary.motion}</span>` : ''}
                        </div>
                    </button>
                `;
            }).join('');
            return;
        }

        if (this.selectedTab === 'motions') {
            const motions = this.getVisibleMotions();
            if (!motions.length) {
                this.listEl.innerHTML = '<div class="resource-empty">没有匹配的动作。</div>';
                return;
            }

            this.listEl.innerHTML = motions.map((motion) => `
                <button class="resource-list-item${motion.id === this.selectedMotionId ? ' is-active' : ''}" type="button" data-action="select-motion" data-id="${motion.id}">
                    <div class="resource-list-title">${escapeHtml(motion.title || motion.id)}</div>
                    <div class="resource-list-meta">${escapeHtml(categoryLabel(motion.category))} · ${escapeHtml(intensityLabel(motion.intensity || 'medium'))} · ${escapeHtml(motion.tier || '')}</div>
                    <div class="resource-list-tags">${escapeHtml(motion.source || '')}</div>
                </button>
            `).join('');
            return;
        }

        if (this.selectedTab === 'performances' || this.selectedTab === 'stage') {
            const performances = this.getVisiblePerformances();
            if (!performances.length) {
                this.listEl.innerHTML = '<div class="resource-empty">还没有作品。先从资源库里选一首歌，创建一个作品。</div>';
                return;
            }

            this.listEl.innerHTML = performances.map((performance) => {
                const summary = summarizePerformance(performance);
                const liveTag = this.runtimeState.isPlaying && this.runtimeState.performanceId === performance.id
                    ? '<span>LIVE</span>'
                    : '';
                return `
                    <button class="resource-list-item${performance.id === this.selectedPerformanceId ? ' is-active' : ''}" type="button" data-action="select-performance" data-id="${performance.id}">
                        <div class="resource-list-title">${escapeHtml(performance.title || '未命名作品')}</div>
                        <div class="resource-list-meta">${escapeHtml(performance.artist || performance.sourceWorkTitle || '桌面演出作品')}</div>
                        <div class="resource-list-tags">
                            <span>槽位 ${summary.slots}</span>
                            <span>段落 ${summary.timelineSegments}</span>
                            <span>${escapeHtml(summary.playbackSource)}</span>
                            ${liveTag}
                        </div>
                    </button>
                `;
            }).join('');
            return;
        }

        const performance = this.getSelectedPerformance();
        const segments = performance?.timeline?.segments || [];
        if (!performance) {
            this.listEl.innerHTML = '<div class="resource-empty">先创建一个作品，时间轴才能开始编辑。</div>';
            return;
        }
        if (!segments.length) {
            this.listEl.innerHTML = '<div class="resource-empty">当前作品还没有时间轴段落。先绑定歌词，再生成时间轴。</div>';
            return;
        }

        this.listEl.innerHTML = segments.map((segment) => `
            <button class="resource-list-item${segment.id === this.selectedSegmentId ? ' is-active' : ''}" type="button" data-action="select-segment" data-id="${segment.id}">
                <div class="resource-list-title">${escapeHtml(segment.text || '空白段')}</div>
                <div class="resource-list-meta">${escapeHtml(formatTimelineTime(segment.startTime))} - ${escapeHtml(formatTimelineTime(segment.endTime))}</div>
                <div class="resource-list-tags">
                    <span>${escapeHtml(getSegmentMotionText(segment))}</span>
                    ${segment.expression ? `<span>${escapeHtml(expressionLabel(segment.expression))}</span>` : ''}
                </div>
            </button>
        `).join('');
    }

    renderDetail() {
        if (!this.detailEl) {
            return;
        }

        if (this.selectedTab === 'library') {
            this.detailEl.innerHTML = this.renderLibraryDetail();
            return;
        }

        if (this.selectedTab === 'motions') {
            this.detailEl.innerHTML = this.renderMotionDetail();
            return;
        }

        if (this.selectedTab === 'performances') {
            this.detailEl.innerHTML = this.renderPerformanceDetail();
            return;
        }

        if (this.selectedTab === 'timeline') {
            this.detailEl.innerHTML = this.renderTimelineDetail();
            return;
        }

        this.detailEl.innerHTML = this.renderStageDetail();
    }

    renderPreviewBlock() {
        if (!this.previewState.assetId) {
            return '';
        }

        return `
            <div class="detail-preview-block">
                <div class="detail-preview-title">${escapeHtml(this.previewState.title || '资源预览')}</div>
                ${
                    this.previewState.loading
                        ? '<div class="resource-empty">正在加载预览...</div>'
                        : this.previewState.error
                            ? `<div class="resource-empty">${escapeHtml(this.previewState.error)}</div>`
                            : `<pre class="detail-preview-text">${escapeHtml(this.previewState.content || '暂无预览内容')}</pre>`
                }
            </div>
        `;
    }

    renderLibraryDetail() {
        const work = this.getSelectedWork();
        if (!work) {
            return '<div class="resource-empty">选中一首歌、一份歌词或一组动作素材，这里就会显示资源详情。</div>';
        }

        const performance = this.getSelectedPerformance();
        const assets = collectWorkAssets(work);
        const assetRows = assets.map((asset) => {
            const actionButtons = [];

            if (asset.slot !== 'motion') {
                actionButtons.push(
                    `<button class="detail-action-btn" type="button" data-action="bind-asset" data-id="${asset.id}" data-slot="${asset.slot}">绑定${escapeHtml(labelForSlot(asset.slot))}</button>`
                );
            }

            if (isAudioAsset(asset)) {
                actionButtons.push(
                    `<button class="detail-action-btn" type="button" data-action="toggle-audio" data-id="${asset.id}">${this.playingPreviewId === asset.id ? '停止' : '试听'}</button>`
                );
            }

            if (isTextPreviewableAsset(asset)) {
                actionButtons.push(
                    `<button class="detail-action-btn" type="button" data-action="preview-text" data-id="${asset.id}">预览</button>`
                );
            }

            return `
                <div class="detail-asset-row">
                    <div class="detail-asset-main">
                        <div class="detail-asset-title">${escapeHtml(asset.title || work.title || '未命名资源')}</div>
                        <div class="detail-asset-meta">${escapeHtml(labelForSlot(asset.slot))} · ${escapeHtml(asset.ext || '')} · ${escapeHtml(asset.storage === 'desktop' ? '桌面导入' : '内置')}</div>
                    </div>
                    <div class="detail-asset-actions">
                        ${actionButtons.join('') || '<span class="detail-inline-note">动作素材会先留在资源库里，默认动作请在“动作”页绑定。</span>'}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="detail-header">
                <div>
                    <div class="detail-title">${escapeHtml(work.title || '未命名作品')}</div>
                    <div class="detail-meta">${escapeHtml(work.artist || (work.storage === 'desktop' ? '桌面授权资源' : '内置资源'))}</div>
                </div>
                <div class="detail-header-actions">
                    <button class="detail-primary-btn" type="button" data-action="create-performance-from-work">创建作品</button>
                    ${performance ? '<button class="detail-action-btn" type="button" data-action="bind-work">并入当前作品</button>' : ''}
                </div>
            </div>
            <div class="detail-tags">${(work.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            <div class="detail-section-title">资源列表</div>
            <div class="detail-asset-list">
                ${assetRows || '<div class="resource-empty">这组资源里还没有可操作的条目。</div>'}
            </div>
            ${this.renderPreviewBlock()}
        `;
    }

    renderMotionDetail() {
        const motion = this.getSelectedMotion();
        const performance = this.getSelectedPerformance();

        if (!motion) {
            return '<div class="resource-empty">选一个动作，就能预览它，并把它设成作品的默认动作。</div>';
        }

        return `
            <div class="detail-header">
                <div>
                    <div class="detail-title">${escapeHtml(motion.title || motion.id)}</div>
                    <div class="detail-meta">${escapeHtml(categoryLabel(motion.category))} · ${escapeHtml(intensityLabel(motion.intensity || 'medium'))}</div>
                </div>
                <div class="detail-header-actions">
                    <button class="detail-primary-btn" type="button" data-action="play-motion" data-id="${motion.id}">播放</button>
                    <button class="detail-action-btn" type="button" data-action="bind-motion" data-id="${motion.id}">${performance ? '设为默认动作' : '绑定到新作品'}</button>
                </div>
            </div>
            <div class="detail-tags">
                <span>${escapeHtml(motion.tier || '')}</span>
                <span>${escapeHtml(motion.source || '')}</span>
                <span>${escapeHtml(motion.path || '')}</span>
            </div>
            <div class="detail-section-title">动作说明</div>
            <div class="resource-empty">动作库已经接进运行时。绑定后，它会成为当前作品的默认动作；时间轴里每一行歌词也可以再单独覆盖动作类别和强度。</div>
        `;
    }

    renderPerformanceDetail() {
        const performance = this.getSelectedPerformance();
        if (!performance) {
            return '<div class="resource-empty">先从“资源”里创建一个作品，这里就会显示绑定关系、播放源和时间轴入口。</div>';
        }

        const bindingRows = listPerformanceBindings(performance).map((slot) => `
            <div class="detail-asset-row">
                <div class="detail-asset-main">
                    <div class="detail-asset-title">${escapeHtml(slot.binding?.title || '未绑定')}</div>
                    <div class="detail-asset-meta">${escapeHtml(slot.label)}${slot.binding?.ext ? ` · ${escapeHtml(slot.binding.ext)}` : ''}</div>
                </div>
                <div class="detail-asset-actions">
                    ${slot.binding ? `<button class="detail-action-btn" type="button" data-action="preview-binding" data-slot="${slot.key}">${slot.key === 'motion' ? '播放' : '预览'}</button>` : ''}
                    ${slot.binding ? `<button class="detail-action-btn" type="button" data-action="clear-binding" data-slot="${slot.key}">清空</button>` : ''}
                </div>
            </div>
        `).join('');

        return `
            <div class="detail-header">
                <div class="detail-grow">
                    <div class="detail-title">作品建模</div>
                    <div class="detail-meta">这一层负责把歌曲、伴奏、歌词、乐谱和默认动作绑定成一个可排练的作品。</div>
                </div>
                <div class="detail-header-actions">
                    <button class="detail-primary-btn" type="button" data-action="open-timeline">时间轴</button>
                    <button class="detail-action-btn" type="button" data-action="open-stage">演出</button>
                    <button class="detail-action-btn" type="button" data-action="delete-performance" data-id="${performance.id}">删除</button>
                </div>
            </div>
            <div class="detail-form-grid">
                <label class="detail-field">
                    <span>作品名</span>
                    <input type="text" value="${escapeHtml(performance.title || '')}" data-change="performance-title" />
                </label>
                <label class="detail-field">
                    <span>播放源</span>
                    <select data-change="playback-source">
                        <option value="auto"${performance.playbackSource === 'auto' ? ' selected' : ''}>自动（优先伴奏）</option>
                        <option value="song"${performance.playbackSource === 'song' ? ' selected' : ''}>歌曲</option>
                        <option value="accompaniment"${performance.playbackSource === 'accompaniment' ? ' selected' : ''}>伴奏</option>
                    </select>
                </label>
            </div>
            <div class="detail-tags">
                <span>来源 ${escapeHtml(performance.sourceWorkTitle || '自定义')}</span>
                <span>段落 ${performance.timeline?.segments?.length || 0}</span>
                <span>时长 ${escapeHtml(formatTimelineTime(getTimelineDurationHint(performance)))}</span>
            </div>
            <div class="detail-section-title">槽位绑定</div>
            <div class="detail-asset-list">
                ${bindingRows}
            </div>
            <div class="detail-actions-row">
                <button class="detail-primary-btn" type="button" data-action="rebuild-timeline">按歌词生成时间轴</button>
                <button class="detail-action-btn" type="button" data-action="play-performance">立即试演</button>
            </div>
            ${this.renderPreviewBlock()}
        `;
    }

    renderTimelineOverview(performance) {
        const segments = performance?.timeline?.segments || [];
        const duration = Math.max(getTimelineDurationHint(performance), 0.1);

        if (!segments.length) {
            return '<div class="resource-empty">还没有段落。先绑定歌词，再生成时间轴。</div>';
        }

        return `
            <div class="timeline-overview">
                ${segments.map((segment) => {
                    const width = Math.max(4, ((segment.endTime - segment.startTime) / duration) * 100);
                    return `
                        <button
                            class="timeline-overview-segment${segment.id === this.selectedSegmentId ? ' is-active' : ''}"
                            style="width:${width}%;"
                            type="button"
                            data-action="select-segment"
                            data-id="${segment.id}"
                            title="${escapeHtml(segment.text || formatTimelineTime(segment.startTime))}"
                        ></button>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderTimelineDetail() {
        const performance = this.getSelectedPerformance();
        if (!performance) {
            return '<div class="resource-empty">先创建一个作品，时间轴才有可编辑的对象。</div>';
        }

        const segment = this.getSelectedSegment();
        const playbackBinding = performance.bindings?.accompaniment || performance.bindings?.song || null;

        return `
            <div class="detail-header">
                <div>
                    <div class="detail-title">${escapeHtml(performance.title || '未命名作品')} · 时间轴</div>
                    <div class="detail-meta">把歌词行和动作节奏对齐，演出运行时就会按这里的结果驱动。</div>
                </div>
                <div class="detail-header-actions">
                    <button class="detail-primary-btn" type="button" data-action="play-performance">试演</button>
                    <button class="detail-action-btn" type="button" data-action="rebuild-timeline">重建</button>
                </div>
            </div>
            <div class="detail-tags">
                <span>${escapeHtml(playbackBinding?.title || '未绑定播放音频')}</span>
                <span>${escapeHtml(performance.bindings?.lyrics?.title || '未绑定歌词')}</span>
                <span>总时长 ${escapeHtml(formatTimelineTime(getTimelineDurationHint(performance)))}</span>
            </div>
            ${this.renderTimelineOverview(performance)}
            <div class="detail-actions-row">
                <button class="detail-action-btn" type="button" data-action="add-segment">新增段</button>
                ${segment ? `<button class="detail-action-btn" type="button" data-action="delete-segment" data-id="${segment.id}">删除当前段</button>` : ''}
            </div>
            ${
                segment ? `
                    <div class="detail-section-title">当前段编辑</div>
                    <div class="detail-form-grid">
                        <label class="detail-field">
                            <span>开始时间</span>
                            <input type="number" step="0.01" min="0" value="${segment.startTime}" data-change="segment-field" data-segment-id="${segment.id}" data-field="startTime" />
                        </label>
                        <label class="detail-field">
                            <span>结束时间</span>
                            <input type="number" step="0.01" min="0" value="${segment.endTime}" data-change="segment-field" data-segment-id="${segment.id}" data-field="endTime" />
                        </label>
                        <label class="detail-field detail-field-wide">
                            <span>歌词文本</span>
                            <textarea rows="3" data-change="segment-field" data-segment-id="${segment.id}" data-field="text">${escapeHtml(segment.text || '')}</textarea>
                        </label>
                        <label class="detail-field">
                            <span>动作类别</span>
                            <select data-change="segment-field" data-segment-id="${segment.id}" data-field="motionCategory">
                                ${optionHtml(MOTION_CATEGORIES, segment.motionCategory)}
                            </select>
                        </label>
                        <label class="detail-field">
                            <span>动作强度</span>
                            <select data-change="segment-field" data-segment-id="${segment.id}" data-field="motionIntensity">
                                ${optionHtml(CUE_INTENSITY_LEVELS, segment.motionIntensity, 'medium')}
                            </select>
                        </label>
                        <label class="detail-field">
                            <span>表情</span>
                            <select data-change="segment-field" data-segment-id="${segment.id}" data-field="expression">
                                ${optionHtml(EXPRESSION_NAMES, segment.expression)}
                            </select>
                        </label>
                        <label class="detail-field">
                            <span>表情强度</span>
                            <select data-change="segment-field" data-segment-id="${segment.id}" data-field="expressionIntensity">
                                ${optionHtml(CUE_INTENSITY_LEVELS, segment.expressionIntensity, 'medium')}
                            </select>
                        </label>
                    </div>
                ` : '<div class="resource-empty">先选一个段落，再编辑它的歌词、时间和动作。</div>'
            }
        `;
    }

    renderStageDetail() {
        const performance = this.getSelectedPerformance();
        if (!performance) {
            return '<div class="resource-empty">先创建一个作品，这里才会出现可运行的演出界面。</div>';
        }

        const segments = performance?.timeline?.segments || [];
        const currentIndex = segments.findIndex((segment) => segment.id === this.runtimeState.activeSegmentId);
        const nextSegments = currentIndex >= 0 ? segments.slice(currentIndex, currentIndex + 3) : segments.slice(0, 3);
        const duration = this.runtimeState.duration || getTimelineDurationHint(performance);

        return `
            <div class="detail-header">
                <div>
                    <div class="detail-title">${escapeHtml(performance.title || '未命名作品')} · 演出运行时</div>
                    <div class="detail-meta">按绑定结果驱动歌曲、歌词和动作，V1 先做本地排练与预演。</div>
                </div>
                <div class="detail-header-actions">
                    <button class="detail-primary-btn" type="button" data-action="play-performance">${this.runtimeState.isPlaying && this.runtimeState.performanceId === performance.id ? '重新开始' : '开始演出'}</button>
                    <button class="detail-action-btn" type="button" data-action="stop-performance">停止</button>
                </div>
            </div>
            <div class="detail-tags">
                <span>播放源 ${escapeHtml(this.runtimeState.playbackLabel || performance.playbackSource || 'auto')}</span>
                <span>当前歌词 ${escapeHtml(this.runtimeState.activeLyricText || '等待开始')}</span>
                <span>时刻 ${escapeHtml(formatTimelineTime(this.runtimeState.currentTime || 0))}</span>
            </div>
            <div class="stage-runtime-card">
                <div class="stage-runtime-time">
                    <span>${escapeHtml(formatTimelineTime(this.runtimeState.currentTime || 0))}</span>
                    <span>${escapeHtml(formatTimelineTime(duration || 0))}</span>
                </div>
                <input class="stage-runtime-slider" type="range" min="0" max="${duration || 0}" step="0.01" value="${Math.min(this.runtimeState.currentTime || 0, duration || 0)}" data-change="runtime-seek" />
                <div class="stage-runtime-lyric">${escapeHtml(this.runtimeState.activeLyricText || '点开始演出后，这里会跟着时间轴滚动当前歌词。')}</div>
            </div>
            <div class="detail-section-title">接下来几段</div>
            <div class="detail-asset-list">
                ${nextSegments.length ? nextSegments.map((segment) => `
                    <div class="detail-asset-row${segment.id === this.runtimeState.activeSegmentId ? ' is-active-row' : ''}">
                        <div class="detail-asset-main">
                            <div class="detail-asset-title">${escapeHtml(segment.text || '空白段')}</div>
                            <div class="detail-asset-meta">${escapeHtml(formatTimelineTime(segment.startTime))} - ${escapeHtml(formatTimelineTime(segment.endTime))}</div>
                        </div>
                        <div class="detail-asset-actions">
                            <span class="detail-inline-note">${escapeHtml(getSegmentMotionText(segment))}</span>
                        </div>
                    </div>
                `).join('') : '<div class="resource-empty">当前作品还没有时间轴段落。</div>'}
            </div>
        `;
    }
}
