import previewA from '../output_perfect_smooth.png';
import previewB from '../output_smooth.png';
import previewC from '../smooth_result.png';
import {
    assetBlueprint,
    identityPresets,
    personalityProfiles,
    publishChecklist,
    referenceSignals,
    roadmap,
    strategyCards,
    workspaces
} from './studio-data.js';
import {
    ARCHETYPE_OPTIONS,
    CAMERA_OPTIONS,
    HAIR_OPTIONS,
    OUTFIT_OPTIONS,
    RESOURCE_SLOT_DEFS,
    SINGING_STYLE_OPTIONS,
    SLOT_STATUS_OPTIONS,
    VOICE_PACE_OPTIONS,
    VOICE_TIMBRE_OPTIONS,
    WORK_STATUS_OPTIONS,
    buildRuntimeManifest,
    cloneCharacterPackage,
    createDefaultCharacterPackage,
    createDefaultWorkTemplate,
    normalizeCharacterPackage,
    summarizeCharacterPackage,
    validateCharacterPackage
} from './aigril-package-contract.js';
import { EXPRESSION_NAMES, MOTION_CATEGORIES } from './cue-utils.js';
import { summarizeWorkAssets } from './resource-library.js';
import { createEmptyResourcePlatformState, loadResourcePlatformState } from './resource-platform-store.js';
import {
    activateRuntimePackage,
    createEmptyRuntimePackageRegistry,
    getActiveRuntimePackage,
    loadRuntimePackageRegistry,
    removeRuntimePackage,
    saveRuntimePackageRegistry,
    upsertRuntimePackage
} from './runtime-package-registry.js';

const DRAFT_KEY = 'aigril_studio_draft_package_v1';
const UI_KEY = 'aigril_studio_ui_state_v1';
const WORKSPACE_BY_ID = new Map(workspaces.map((item) => [item.id, item]));
const TRAITS = { warmth: '温柔度', initiative: '主动性', humor: '幽默感', calmness: '稳定感' };
const PROFILE_TRAITS = {
    gentle: { warmth: 82, initiative: 58, humor: 46, calmness: 74 },
    stage: { warmth: 66, initiative: 81, humor: 62, calmness: 56 },
    muse: { warmth: 59, initiative: 74, humor: 57, calmness: 79 }
};
const STATUS_LABELS = { draft: '草稿', review: '待审校', ready: '可发布', editing: '编辑中', published: '已发布', info: '提示', success: '完成', error: '错误' };
const PREVIEWS = [
    { id: 'stage', label: '舞台封面', caption: '适合主推封面与作品入口。', image: previewA },
    { id: 'closeup', label: '近景镜头', caption: '更适合看脸部、口型和镜头感。', image: previewB },
    { id: 'casual', label: '轻陪伴场景', caption: '适合直播、对话和日常陪伴。', image: previewC }
];
const EXPRESSIONS = EXPRESSION_NAMES.filter((item) => !item.startsWith('blink') && item !== 'neutral');
const NOTICE = 'Studio 现在会把角色包协议、资源装配和 Runtime 发布串成一条编辑链。';

const state = {
    activeWorkspace: 'overview',
    draftPackage: createDefaultCharacterPackage(),
    registry: createEmptyRuntimePackageRegistry(),
    platformState: createEmptyResourcePlatformState(),
    selectedPreviewId: PREVIEWS[0].id,
    selectedAvatarPresetId: identityPresets[0]?.id || '',
    selectedPersonalityProfileId: personalityProfiles[0]?.id || '',
    selectedWorkId: '',
    notice: { type: 'info', message: NOTICE }
};

const appEl = document.getElementById('studio-app');

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function json(raw, fallback) {
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function shortId(value) {
    const text = String(value || '');
    return !text ? '未分配' : (text.length > 12 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text);
}

function fmtDate(value) {
    if (!value) {
        return '未记录';
    }
    try {
        return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
    } catch {
        return String(value);
    }
}

function label(value) {
    return STATUS_LABELS[value] || value || '未设置';
}

function cls(value) {
    return String(value || 'draft').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
}

function options(list, current) {
    return list.map((item) => `<option value="${esc(item)}" ${item === current ? 'selected' : ''}>${esc(item)}</option>`).join('');
}

function readValue(inputEl) {
    return inputEl.type === 'number' || inputEl.type === 'range' ? Number(inputEl.value || 0) : inputEl.value;
}

function setByPath(target, path, value) {
    const keys = String(path || '').split('.').filter(Boolean);
    let cursor = target;
    for (let index = 0; index < keys.length - 1; index += 1) {
        const key = /^\d+$/.test(keys[index]) ? Number(keys[index]) : keys[index];
        const nextKey = keys[index + 1];
        if (cursor[key] == null) {
            cursor[key] = /^\d+$/.test(nextKey) ? [] : {};
        }
        cursor = cursor[key];
    }
    const last = /^\d+$/.test(keys[keys.length - 1]) ? Number(keys[keys.length - 1]) : keys[keys.length - 1];
    cursor[last] = value;
}

function ensureWork() {
    const works = state.draftPackage.works || [];
    if (!works.length) {
        state.selectedWorkId = '';
        return;
    }
    if (!works.some((work) => work.id === state.selectedWorkId)) {
        state.selectedWorkId = works[0].id;
    }
}

function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draftPackage));
}

function saveUi() {
    localStorage.setItem(UI_KEY, JSON.stringify({
        activeWorkspace: state.activeWorkspace,
        selectedPreviewId: state.selectedPreviewId,
        selectedAvatarPresetId: state.selectedAvatarPresetId,
        selectedPersonalityProfileId: state.selectedPersonalityProfileId,
        selectedWorkId: state.selectedWorkId
    }));
}

function setNotice(type, message) {
    state.notice = { type, message };
}

function loadDraft(activePackage) {
    const stored = json(localStorage.getItem(DRAFT_KEY), null);
    if (stored && typeof stored === 'object') {
        return normalizeCharacterPackage(stored);
    }
    if (activePackage?.payload) {
        return normalizeCharacterPackage(cloneCharacterPackage(activePackage.payload));
    }
    return normalizeCharacterPackage(createDefaultCharacterPackage());
}

function importedStats(platformState) {
    const stats = { songs: 0, accompaniments: 0, lyrics: 0, motions: 0, danceTemplates: 0, voicePresets: 0, works: platformState?.importedWorks?.length || 0, assets: platformState?.importedAssets?.length || 0 };
    for (const asset of platformState?.importedAssets || []) {
        const kind = String(asset?.kind || '').toLowerCase();
        const role = String(asset?.role || '').toLowerCase();
        const motionCategory = String(asset?.metadata?.motion_category || '').toLowerCase();
        if (kind === 'audio') {
            if (role === 'accompaniment') stats.accompaniments += 1;
            else if (role === 'voice') stats.voicePresets += 1;
            else stats.songs += 1;
        } else if (kind === 'lyrics') stats.lyrics += 1;
        else if (kind === 'motion') {
            stats.motions += 1;
            if (motionCategory === 'dance') stats.danceTemplates += 1;
        }
    }
    return stats;
}

function importedWorkTemplate(importedWork) {
    const summary = summarizeWorkAssets(importedWork);
    const motionCategory = (importedWork?.assets?.motions || [])
        .map((motion) => String(motion?.metadata?.motion_category || '').toLowerCase())
        .find((item) => MOTION_CATEGORIES.includes(item)) || (summary.motion > 0 ? 'dance' : 'idle');
    return {
        ...createDefaultWorkTemplate(state.draftPackage.works.length),
        title: importedWork?.title || '导入作品',
        scenario: importedWork?.artist ? `${importedWork.artist} 作品装配` : '资源导入作品',
        mood: (importedWork?.tags || []).slice(0, 2).join(' / ') || (summary.motion > 0 ? '舞台 / 互动' : '温柔 / 抒情'),
        summary: `从本地授权资源导入，含 ${summary.song} 首歌曲、${summary.accompaniment} 条伴奏、${summary.lyrics} 份歌词、${summary.motion} 条动作。`,
        resourceBindings: { songs: summary.song, accompaniments: summary.accompaniment, lyrics: summary.lyrics, motions: summary.motion },
        preferredMotionCategory: motionCategory,
        defaultExpression: summary.motion > 0 ? 'happy' : 'relaxed',
        stagePreset: summary.motion > 0 ? '聚光舞台' : '晚安广播',
        status: 'review'
    };
}

function updateDraft(mutator, notice = null, nextWorkId = '') {
    const nextDraft = cloneCharacterPackage(state.draftPackage);
    mutator(nextDraft);
    state.draftPackage = normalizeCharacterPackage(nextDraft);
    if (nextWorkId) {
        state.selectedWorkId = nextWorkId;
    }
    ensureWork();
    saveDraft();
    if (notice) {
        setNotice(notice.type || 'info', notice.message);
    }
    render();
}

function field(labelText, control, wide = false) {
    return `<label class="field-block${wide ? ' field-block--wide' : ''}"><span class="field-label">${esc(labelText)}</span>${control}</label>`;
}

function input(labelText, path, value, type = 'text', wide = false, placeholder = '') {
    return field(labelText, `<input type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" data-bind="${esc(path)}" />`, wide);
}

function textarea(labelText, path, value, rows = 4, wide = true) {
    return field(labelText, `<textarea rows="${rows}" data-bind="${esc(path)}">${esc(value)}</textarea>`, wide);
}

function select(labelText, path, value, list, wide = false) {
    return field(labelText, `<select data-bind="${esc(path)}">${options(list, value)}</select>`, wide);
}

function range(labelText, path, value) {
    return field(labelText, `<div class="range-with-value"><input type="range" min="0" max="100" value="${Number(value || 0)}" data-bind="${esc(path)}" /><output data-bind-readout="${esc(path)}">${Number(value || 0)}</output></div>`);
}

function color(labelText, path, value) {
    return field(labelText, `<div class="color-field"><input type="color" value="${esc(value)}" data-bind="${esc(path)}" /><div class="swatch-chip"><span class="swatch-chip__color" style="background:${esc(value)};"></span><span data-bind-readout="${esc(path)}">${esc(value)}</span></div></div>`);
}

function metric(labelText, value, hint = '') {
    return `<div class="metric-row"><header><strong>${esc(labelText)}</strong><span>${Number(value || 0)}</span></header>${hint ? `<p>${esc(hint)}</p>` : ''}<div class="metric-bar"><span style="width:${Math.max(0, Math.min(100, Number(value || 0)))}%"></span></div></div>`;
}

function contractLanes(validation, supply) {
    const draft = state.draftPackage;
    return [
        { label: '角色包 / Avatar', status: draft.avatar.displayName && draft.avatar.archetype ? 'ready' : 'review', body: '决定外观、视觉识别和 Runtime 首屏气质。', points: [draft.avatar.displayName || '缺少角色名', draft.avatar.archetype || '缺少角色原型', draft.avatar.visual.accentColor] },
        { label: '人格协议 / Personality', status: draft.personality.summary && draft.personality.greeting ? 'ready' : 'review', body: '负责开场白、边界、情绪风格和默认姿态。', points: [draft.personality.summary || '缺少摘要', draft.personality.greeting || '缺少开场白', draft.personality.catchphrase || '缺少记忆句'] },
        { label: '声音 / Voice', status: draft.voice.timbre && draft.voice.singingStyle ? 'ready' : 'review', body: '音色、语速和演唱风格一起进入 Runtime manifest。', points: [draft.voice.timbre, draft.voice.pace, draft.voice.singingStyle] },
        { label: '资源槽位 / Resources', status: supply.assets > 0 ? 'ready' : 'draft', body: '把歌曲、伴奏、歌词、动作和模板组织进统一槽位。', points: [`已导入 ${supply.assets} 个资源`, `歌曲 ${draft.resources.slots.songs.count} / 动作 ${draft.resources.slots.motions.count}`, `作品模板 ${draft.works.length} 个`] },
        { label: '发布 / Runtime', status: validation.readyToPublish ? 'ready' : (validation.errors.length ? 'review' : 'draft'), body: '发布时只导出 Runtime 需要的 manifest，不直接带 Studio 全量编辑态。', points: [`评分 ${validation.score}`, validation.errors.length ? `${validation.errors.length} 个错误` : '无阻断错误', validation.warnings.length ? `${validation.warnings.length} 个提醒` : '无提醒项'] }
    ];
}

function overviewView(workspace, validation, supply) {
    return `
        <div class="workspace-header"><div><h2>${esc(workspace.title)}</h2><p>${esc(workspace.subtitle)}</p></div><div class="workspace-outcome">${esc(workspace.outcome)}</div></div>
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface"><h3>平台拆分</h3><div class="strategy-grid">${strategyCards.map((card) => `<article class="strategy-card"><span class="badge ${card.badge === '必须先定' ? 'accent-badge' : ''}">${esc(card.badge)}</span><h4>${esc(card.title)}</h4><p>${esc(card.body)}</p></article>`).join('')}</div></section>
                <section class="tool-surface"><h3>角色包协议</h3><div class="contract-grid">${contractLanes(validation, supply).map((lane) => `<article class="contract-lane"><div class="lane-head"><strong>${esc(lane.label)}</strong><span class="slot-status ${cls(lane.status)}">${esc(label(lane.status))}</span></div><p>${esc(lane.body)}</p><ul class="lane-points">${lane.points.map((point) => `<li>${esc(point)}</li>`).join('')}</ul></article>`).join('')}</div></section>
                <section class="tool-surface"><h3>编辑闭环</h3><div class="publish-groups">${workspaces.slice(1).map((item) => `<article class="publish-group"><header><strong>${esc(item.label)}</strong><span class="badge">${esc(item.outcome)}</span></header><p>${esc(item.subtitle)}</p></article>`).join('')}</div></section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface"><h3>参考信号</h3><div class="reference-list">${referenceSignals.map((signal) => `<article class="reference-row"><header><strong>${esc(signal.name)}</strong><span>${esc(signal.region)}</span></header><p>${esc(signal.cue)}</p><div class="reference-focus">${signal.focus.map((focus) => `<span class="badge">${esc(focus)}</span>`).join('')}</div></article>`).join('')}</div></section>
                <section class="tool-surface"><h3>当前产出</h3><div class="metric-list">${metric('发布准备度', validation.score, '错误会直接阻断 Runtime 发布。')}${metric('资源导入饱和度', Math.min(100, supply.assets * 2), `已同步 ${supply.assets} 个资源，${supply.works} 个作品。`)}${metric('作品覆盖度', Math.min(100, state.draftPackage.works.length * 20), `当前有 ${state.draftPackage.works.length} 个作品模板。`)}</div></section>
                <section class="tool-surface"><h3>标准装配蓝图</h3><div class="publish-groups">${assetBlueprint.slots.slice(0, 4).map((slot) => `<article class="publish-group"><header><strong>${esc(slot.label)}</strong><span class="slot-status ${cls(slot.status)}">${slot.count}</span></header><p>推荐作为中台目标容量，用来校准当前草稿的资源密度。</p></article>`).join('')}</div></section>
            </div>
        </div>
    `;
}

function avatarView(workspace) {
    const draft = state.draftPackage;
    const visual = draft.avatar.visual;
    const currentPreview = PREVIEWS.find((item) => item.id === state.selectedPreviewId) || PREVIEWS[0];
    return `
        <div class="workspace-header"><div><h2>${esc(workspace.title)}</h2><p>${esc(workspace.subtitle)}</p></div><div class="workspace-outcome">${esc(workspace.outcome)}</div></div>
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface"><div class="surface-head"><div><h3>角色预览</h3><p>先看主视觉，再调角色 DNA。</p></div></div><div class="preview-canvas"><div class="avatar-preview" style="box-shadow: inset 0 0 0 2px ${esc(visual.accentColor)};"><img src="${esc(currentPreview.image)}" alt="${esc(currentPreview.label)}" /><div class="preview-overlay"><strong>${esc(draft.avatar.displayName)}</strong><span>${esc(draft.avatar.tagline)}</span><span>${esc(currentPreview.caption)}</span></div></div><div class="thumbnail-column">${PREVIEWS.map((item) => `<button class="thumb-button ${item.id === currentPreview.id ? 'is-active' : ''}" type="button" data-action="select-preview" data-preview-id="${esc(item.id)}"><img src="${esc(item.image)}" alt="${esc(item.label)}" /><strong>${esc(item.label)}</strong><span>${esc(item.caption)}</span></button>`).join('')}</div></div></section>
                <section class="tool-surface"><div class="surface-head"><div><h3>形象预设</h3><p>先套一个强基调，再往下调细部。</p></div></div><div class="pill-row">${identityPresets.map((item) => `<button class="pill-button ${item.id === state.selectedAvatarPresetId ? 'is-active' : ''}" type="button" data-action="apply-avatar-preset" data-preset-id="${esc(item.id)}">${esc(item.name)}</button>`).join('')}</div><div class="field-grid">${input('角色包名', 'packageName', draft.packageName)}${input('创建者', 'creatorName', draft.creatorName)}${input('角色显示名', 'avatar.displayName', draft.avatar.displayName)}${input('角色原型', 'avatar.archetype', draft.avatar.archetype, 'text', false, ARCHETYPE_OPTIONS[0])}${input('一句介绍', 'avatar.tagline', draft.avatar.tagline, 'text', true)}${textarea('角色轮廓', 'avatar.silhouette', draft.avatar.silhouette, 3)}${textarea('Runtime 适配说明', 'avatar.runtimeFit', draft.avatar.runtimeFit, 3)}</div></section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface"><h3>视觉参数</h3><div class="field-grid">${select('发型', 'avatar.visual.hairStyle', visual.hairStyle, HAIR_OPTIONS)}${select('服装风格', 'avatar.visual.outfitStyle', visual.outfitStyle, OUTFIT_OPTIONS)}${select('镜头 framing', 'avatar.visual.cameraFraming', visual.cameraFraming, CAMERA_OPTIONS)}${color('主色', 'avatar.visual.accentColor', visual.accentColor)}${color('瞳色', 'avatar.visual.eyeColor', visual.eyeColor)}${range('肤色亮度', 'avatar.visual.skinTone', visual.skinTone)}${range('表情表现力', 'avatar.visual.expressiveness', visual.expressiveness)}${range('动作能量', 'avatar.visual.motionEnergy', visual.motionEnergy)}</div></section>
                <section class="tool-surface"><h3>工坊判断</h3><div class="metric-list">${metric('镜头友好度', Math.round((visual.expressiveness + draft.personality.traits.warmth) / 2), '影响近景对话和演出镜头。')}${metric('舞台冲击力', Math.round((visual.motionEnergy + draft.personality.traits.initiative) / 2), '动作密度和演出作品更看这个值。')}${metric('识别稳定度', Math.round((visual.skinTone + 100 - Math.abs(50 - draft.personality.traits.calmness)) / 2), '角色换作品时还能不能保持是她。')}</div><div class="preview-meta-grid"><div class="swatch-chip"><span class="swatch-chip__color" style="background:${esc(visual.accentColor)};"></span><span>主色 ${esc(visual.accentColor)}</span></div><div class="swatch-chip"><span class="swatch-chip__color" style="background:${esc(visual.eyeColor)};"></span><span>瞳色 ${esc(visual.eyeColor)}</span></div></div></section>
            </div>
        </div>
    `;
}

function personalityView(workspace) {
    const draft = state.draftPackage;
    return `
        <div class="workspace-header"><div><h2>${esc(workspace.title)}</h2><p>${esc(workspace.subtitle)}</p></div><div class="workspace-outcome">${esc(workspace.outcome)}</div></div>
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface"><div class="surface-head"><div><h3>人格预设</h3><p>先选调性，再补个性边界。</p></div></div><div class="profile-tabs">${personalityProfiles.map((item) => `<button class="profile-tab ${item.id === state.selectedPersonalityProfileId ? 'is-active' : ''}" type="button" data-action="apply-personality-profile" data-profile-id="${esc(item.id)}">${esc(item.name)}</button>`).join('')}</div><div class="profile-list">${personalityProfiles.map((item) => `<article class="strategy-card"><strong>${esc(item.name)}</strong><p>${esc(item.summary)}</p></article>`).join('')}</div></section>
                <section class="tool-surface"><h3>对话协议</h3><div class="field-grid">${textarea('性格摘要', 'personality.summary', draft.personality.summary, 4)}${input('默认开场白', 'personality.greeting', draft.personality.greeting, 'text', true)}${textarea('边界说明', 'personality.boundary', draft.personality.boundary, 3)}${input('标志性句子', 'personality.catchphrase', draft.personality.catchphrase, 'text', true)}</div></section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface"><h3>人格强度</h3><div class="trait-grid">${Object.entries(TRAITS).map(([key, text]) => `<div class="trait-card"><strong>${esc(text)}</strong><div class="range-with-value"><input type="range" min="0" max="100" value="${Number(draft.personality.traits[key] || 0)}" data-bind="personality.traits.${esc(key)}" /><output data-bind-readout="personality.traits.${esc(key)}">${Number(draft.personality.traits[key] || 0)}</output></div></div>`).join('')}</div></section>
                <section class="tool-surface"><h3>声音与演唱</h3><div class="field-grid">${select('音色', 'voice.timbre', draft.voice.timbre, VOICE_TIMBRE_OPTIONS)}${select('语速', 'voice.pace', draft.voice.pace, VOICE_PACE_OPTIONS)}${select('唱歌风格', 'voice.singingStyle', draft.voice.singingStyle, SINGING_STYLE_OPTIONS)}</div><div class="voice-card"><strong>Runtime 入口语气</strong><span>${esc(draft.personality.greeting)}</span></div><div class="voice-card"><strong>人格缩写</strong><span>${esc(draft.personality.summary)}</span></div></section>
            </div>
        </div>
    `;
}

function slotRows(supply) {
    return RESOURCE_SLOT_DEFS.map((slotDef) => {
        const slot = state.draftPackage.resources.slots[slotDef.key];
        const count = supply[slotDef.key] || 0;
        const gap = Math.max(0, Number(slot.count || 0) - count);
        return `<article class="slot-row resource-slot-editor"><header><strong>${esc(slotDef.label)}</strong><span class="slot-status ${cls(slot.status)}">${esc(label(slot.status))}</span></header><div class="slot-meta"><span>当前声明 ${Number(slot.count || 0)}</span><span>资源平台已导入 ${count}</span><span class="${gap > 0 ? 'slot-gap is-warning' : 'slot-gap'}">${gap > 0 ? `缺口 ${gap}` : '容量匹配'}</span></div><div class="slot-input-row"><input type="number" min="0" max="999" value="${Number(slot.count || 0)}" data-bind="resources.slots.${esc(slotDef.key)}.count" /><select data-bind="resources.slots.${esc(slotDef.key)}.status">${options(SLOT_STATUS_OPTIONS, slot.status)}</select></div></article>`;
    }).join('');
}

function importedWorksView() {
    const works = state.platformState.importedWorks || [];
    if (!works.length) {
        return `<div class="empty-state">还没有从资源平台导入作品。等你在 Electron 资源库里导入歌曲、伴奏、歌词和动作后，这里就能直接把它们变成作品模板。</div>`;
    }
    return `<div class="library-list">${works.map((work) => {
        const summary = summarizeWorkAssets(work);
        return `<article class="library-row"><div><strong>${esc(work.title || '未命名作品')}</strong><p>${esc(work.artist || '本地授权资源')}</p><span>歌 ${summary.song} · 伴奏 ${summary.accompaniment} · 词 ${summary.lyrics} · 动作 ${summary.motion}</span></div><button class="ghost-btn mini-btn" type="button" data-action="import-work-template" data-import-work-id="${esc(work.id)}">生成模板</button></article>`;
    }).join('')}</div>`;
}

function workEditor(workIndex) {
    const work = state.draftPackage.works[workIndex];
    if (!work) {
        return `<div class="empty-state">先新建一个作品模板，或者从资源平台直接导入。</div>`;
    }
    return `
        <div class="work-editor-grid">
            ${input('作品标题', `works.${workIndex}.title`, work.title)}
            ${input('场景', `works.${workIndex}.scenario`, work.scenario)}
            ${input('情绪标签', `works.${workIndex}.mood`, work.mood)}
            ${input('舞台预设', `works.${workIndex}.stagePreset`, work.stagePreset)}
            ${select('默认动作类别', `works.${workIndex}.preferredMotionCategory`, work.preferredMotionCategory, MOTION_CATEGORIES)}
            ${select('默认表情', `works.${workIndex}.defaultExpression`, work.defaultExpression, EXPRESSIONS)}
            ${select('作品状态', `works.${workIndex}.status`, work.status, WORK_STATUS_OPTIONS)}
            ${textarea('作品说明', `works.${workIndex}.summary`, work.summary, 4)}
        </div>
        <div class="field-grid work-binding-grid">
            ${input('歌曲引用数', `works.${workIndex}.resourceBindings.songs`, work.resourceBindings.songs, 'number')}
            ${input('伴奏引用数', `works.${workIndex}.resourceBindings.accompaniments`, work.resourceBindings.accompaniments, 'number')}
            ${input('歌词引用数', `works.${workIndex}.resourceBindings.lyrics`, work.resourceBindings.lyrics, 'number')}
            ${input('动作引用数', `works.${workIndex}.resourceBindings.motions`, work.resourceBindings.motions, 'number')}
        </div>
        <div class="work-editor-actions">
            <button class="ghost-btn mini-btn" type="button" data-action="promote-work" data-work-id="${esc(work.id)}">设为主推作品</button>
            <button class="ghost-btn mini-btn danger-btn" type="button" data-action="remove-work" data-work-id="${esc(work.id)}">删除作品</button>
        </div>
    `;
}

function performanceView(workspace, supply) {
    const workIndex = Math.max(0, state.draftPackage.works.findIndex((item) => item.id === state.selectedWorkId));
    return `
        <div class="workspace-header"><div><h2>${esc(workspace.title)}</h2><p>${esc(workspace.subtitle)}</p></div><div class="workspace-outcome">${esc(workspace.outcome)}</div></div>
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface"><div class="surface-head"><div><h3>资源槽位</h3><p>角色包声明“她需要多少资源”，资源平台负责供货。</p></div><button class="ghost-btn mini-btn" type="button" data-action="sync-resource-counts">从资源平台同步</button></div><div class="asset-slots">${slotRows(supply)}</div></section>
                <section class="tool-surface"><div class="surface-head"><div><h3>本地资源作品</h3><p>把已经整理好的歌曲、伴奏、歌词、动作一键变成可编辑作品模板。</p></div></div>${importedWorksView()}</section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface"><div class="surface-head"><div><h3>作品模板</h3><p>作品是资源装配单位，也是 Runtime 的推荐演出单位。</p></div><button class="primary-btn mini-btn" type="button" data-action="add-work">新增作品</button></div><div class="work-list">${state.draftPackage.works.map((work) => `<button class="work-row ${work.id === state.selectedWorkId ? 'is-selected' : ''}" type="button" data-action="select-work" data-work-id="${esc(work.id)}"><header><strong>${esc(work.title)}</strong><span class="work-progress ${cls(work.status)}">${esc(label(work.status))}</span></header><p>${esc(work.summary)}</p><span>${esc(work.preferredMotionCategory)} · 歌 ${work.resourceBindings.songs} · 动作 ${work.resourceBindings.motions}</span></button>`).join('')}</div></section>
                <section class="tool-surface"><h3>当前作品装配</h3>${workEditor(workIndex)}</section>
            </div>
        </div>
    `;
}

function validationView(validation) {
    if (!validation.errors.length && !validation.warnings.length) {
        return `<div class="validation-item ready">这份角色包已经通过当前 V1 校验，可以直接送进 Runtime。</div>`;
    }
    return `<div class="validation-list">${validation.errors.map((item) => `<div class="validation-item error">${esc(item)}</div>`).join('')}${validation.warnings.map((item) => `<div class="validation-item warning">${esc(item)}</div>`).join('')}</div>`;
}

function registryView() {
    if (!state.registry.packages.length) {
        return `<div class="empty-state">还没有已发布角色包。第一次发布后，这里会变成 Runtime 的角色版本面板。</div>`;
    }
    return `<div class="registry-list">${state.registry.packages.map((entry) => `<article class="registry-row ${entry.packageId === state.registry.activePackageId ? 'is-active' : ''}"><div><strong>${esc(entry.summary?.displayName || entry.summary?.packageName || entry.packageId)}</strong><p>${esc(entry.summary?.archetype || '未标注角色原型')}</p><span>v${esc(entry.summary?.versionTag || '0.0.0')} · ${entry.validation?.score ?? '--'} 分 · 发布 ${esc(fmtDate(entry.publishedAt))}</span></div><div class="registry-actions"><button class="ghost-btn mini-btn" type="button" data-action="load-package" data-package-id="${esc(entry.packageId)}">载入工坊</button><button class="ghost-btn mini-btn" type="button" data-action="activate-package" data-package-id="${esc(entry.packageId)}">设为 Runtime</button><button class="ghost-btn mini-btn danger-btn" type="button" data-action="remove-package" data-package-id="${esc(entry.packageId)}">移除</button></div></article>`).join('')}</div>`;
}

function publishView(workspace, validation) {
    const manifest = buildRuntimeManifest(state.draftPackage);
    return `
        <div class="workspace-header"><div><h2>${esc(workspace.title)}</h2><p>${esc(workspace.subtitle)}</p></div><div class="workspace-outcome">${esc(workspace.outcome)}</div></div>
        <div class="workspace-grid">
            <div class="workspace-stack">
                <section class="tool-surface"><div class="surface-head"><div><h3>发布校验</h3><p>V1 先校验包结构、作品资源约束和 Runtime manifest 可用性。</p></div><button class="primary-btn mini-btn" type="button" data-action="publish-package">发布到 Runtime</button></div><div class="inline-kpis"><div class="kpi-card"><strong>${validation.score}</strong><span>发布评分</span></div><div class="kpi-card"><strong>${validation.errors.length}</strong><span>阻断错误</span></div><div class="kpi-card"><strong>${validation.warnings.length}</strong><span>提醒项</span></div></div>${validationView(validation)}</section>
                <section class="tool-surface"><h3>发布清单</h3><div class="publish-groups">${publishChecklist.map((group) => `<article class="publish-group"><header><strong>${esc(group.title)}</strong><span class="slot-status ${cls(group.status)}">${esc(label(group.status))}</span></header><ul class="lane-points">${group.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></article>`).join('')}</div></section>
            </div>
            <div class="workspace-stack">
                <section class="tool-surface"><h3>Runtime 注册表</h3>${registryView()}</section>
                <section class="tool-surface"><h3>导出预览</h3><div class="package-preview-grid"><div><div class="json-title">Runtime manifest</div><pre class="json-preview json-preview--tall">${esc(JSON.stringify(manifest, null, 2))}</pre></div><div><div class="json-title">Character package</div><pre class="json-preview json-preview--tall">${esc(JSON.stringify(state.draftPackage, null, 2))}</pre></div></div></section>
            </div>
        </div>
    `;
}

function inspector(validation, supply) {
    const summary = summarizeCharacterPackage(state.draftPackage);
    const manifest = buildRuntimeManifest(state.draftPackage);
    const active = getActiveRuntimePackage(state.registry);
    const notice = state.notice || { type: 'info', message: NOTICE };
    return `
        <aside class="studio-inspector">
            <div><h3 class="inspector-title">Studio Inspector</h3><p class="inspector-copy">右侧不再是装饰栏，而是当前角色包、资源槽位和 Runtime 状态的集中视图。</p></div>
            <div class="notice-banner ${cls(notice.type)}">${esc(notice.message)}</div>
            <div class="inspector-list">
                <section class="inspector-block"><h4>角色包摘要</h4><ul><li>${esc(summary.displayName)} · ${esc(summary.archetype)}</li><li>包 ID：${esc(shortId(summary.packageId))}</li><li>版本：${esc(summary.versionTag)}</li><li>作品模板：${summary.works} 个</li></ul></section>
                <section class="inspector-block"><h4>资源供给</h4><ul><li>已导入资源：${supply.assets} 个</li><li>已导入作品：${supply.works} 个</li><li>歌曲 ${supply.songs} / 伴奏 ${supply.accompaniments}</li><li>歌词 ${supply.lyrics} / 动作 ${supply.motions}</li></ul></section>
                <section class="inspector-block"><h4>Runtime 生效角色</h4><ul><li>${esc(active?.summary?.displayName || '尚未发布')}</li><li>${active?.summary?.versionTag ? `v${esc(active.summary.versionTag)}` : '未进入 Runtime'}</li><li>默认动作：${esc(manifest.defaultMotionCategory || 'idle')}</li><li>主推作品：${esc(manifest.spotlightWork || '未设置')}</li></ul></section>
                <section class="inspector-block"><h4>质量门禁</h4><ul><li>当前评分：${validation.score}</li><li>错误：${validation.errors.length}</li><li>提醒：${validation.warnings.length}</li><li>${validation.readyToPublish ? '可以发布到 Runtime' : '仍需补齐门禁'}</li></ul></section>
            </div>
        </aside>
    `;
}

function workspaceView(validation, supply) {
    const workspace = WORKSPACE_BY_ID.get(state.activeWorkspace) || workspaces[0];
    if (workspace.id === 'avatar') return avatarView(workspace);
    if (workspace.id === 'personality') return personalityView(workspace);
    if (workspace.id === 'performance') return performanceView(workspace, supply);
    if (workspace.id === 'publish') return publishView(workspace, validation);
    return overviewView(workspace, validation, supply);
}

function render() {
    ensureWork();
    saveUi();
    const validation = validateCharacterPackage(state.draftPackage);
    const supply = importedStats(state.platformState);
    const active = getActiveRuntimePackage(state.registry);
    appEl.innerHTML = `
        <header class="studio-topbar"><div class="brand-lockup"><div class="brand-mark">AG</div><div class="brand-meta"><h1>${esc(state.draftPackage.avatar.displayName)} Studio</h1><p>角色包协议、形象工坊、作品装配与 Runtime 发布</p></div></div><div class="topbar-actions"><span class="chip">包 ID ${esc(shortId(state.draftPackage.packageId))}</span><span class="chip">版本 ${esc(state.draftPackage.publishMeta.versionTag)}</span><span class="chip">评分 ${validation.score}</span><span class="chip">Runtime ${esc(active?.summary?.displayName || '未激活')}</span><button class="ghost-btn" type="button" data-action="sync-resource-counts">同步资源槽位</button><button class="ghost-btn" type="button" data-action="open-runtime-preview">打开 Runtime</button><button class="primary-btn" type="button" data-action="publish-package">发布</button></div></header>
        <aside class="studio-sidebar"><div class="nav-group"><div class="section-caption">Workspaces</div>${workspaces.map((item) => `<button class="nav-item ${item.id === state.activeWorkspace ? 'is-active' : ''}" type="button" data-action="switch-workspace" data-workspace-id="${esc(item.id)}"><strong>${esc(item.label)}</strong><span>${esc(item.outcome)}</span></button>`).join('')}</div><div class="roadmap-band"><div class="section-caption">Roadmap</div>${roadmap.map((item) => `<div class="roadmap-item"><strong>${esc(item.phase)} · ${esc(item.title)}</strong><span>${esc(item.detail)}</span></div>`).join('')}</div></aside>
        <main class="studio-main">${workspaceView(validation, supply)}</main>
        ${inspector(validation, supply)}
    `;
}

async function publishPackage() {
    const validation = validateCharacterPackage(state.draftPackage);
    if (!validation.readyToPublish) {
        state.activeWorkspace = 'publish';
        setNotice('error', '当前角色包还有发布门禁未通过，先把错误项补齐再送进 Runtime。');
        render();
        return;
    }
    const nextDraft = cloneCharacterPackage(validation.normalizedPackage);
    nextDraft.publishMeta.status = 'published';
    nextDraft.publishMeta.channel = 'runtime';
    nextDraft.publishMeta.publishedAt = new Date().toISOString();
    nextDraft.publishMeta.lastValidationScore = validation.score;
    state.draftPackage = normalizeCharacterPackage(nextDraft);
    saveDraft();
    state.registry = await saveRuntimePackageRegistry(activateRuntimePackage(upsertRuntimePackage(state.registry, state.draftPackage), state.draftPackage.packageId));
    state.activeWorkspace = 'publish';
    setNotice('success', `${state.draftPackage.avatar.displayName} v${state.draftPackage.publishMeta.versionTag} 已发布到 Runtime，并设为当前生效角色包。`);
    render();
}

function syncSlots() {
    const supply = importedStats(state.platformState);
    updateDraft((draft) => {
        for (const slotDef of RESOURCE_SLOT_DEFS) {
            const count = supply[slotDef.key] || 0;
            draft.resources.slots[slotDef.key] = { count, status: count > 0 ? 'ready' : 'draft' };
        }
    }, { type: 'success', message: `资源槽位已同步到本地资源平台：${supply.assets} 个资源，${supply.works} 个作品。` });
}

function loadPackageToDraft(packageId) {
    const entry = state.registry.packages.find((item) => item.packageId === packageId);
    if (!entry?.payload) {
        setNotice('error', '这个角色包缺少可编辑载荷，无法回填到工坊。');
        render();
        return;
    }
    state.draftPackage = normalizeCharacterPackage(cloneCharacterPackage(entry.payload));
    state.selectedWorkId = state.draftPackage.works[0]?.id || '';
    saveDraft();
    setNotice('success', `已把 ${state.draftPackage.avatar.displayName} 载入形象工坊。`);
    render();
}

function applyAvatarPreset(presetId) {
    const preset = identityPresets.find((item) => item.id === presetId);
    if (!preset) {
        return;
    }
    state.selectedAvatarPresetId = preset.id;
    updateDraft((draft) => {
        draft.avatar.archetype = ARCHETYPE_OPTIONS.find((item) => item === preset.name) || draft.avatar.archetype;
        draft.avatar.silhouette = preset.silhouette;
        draft.avatar.runtimeFit = preset.runtimeFit;
        if (!draft.avatar.tagline || draft.avatar.tagline === createDefaultCharacterPackage().avatar.tagline) {
            draft.avatar.tagline = `${preset.name}，${preset.style}。`;
        }
    }, { type: 'success', message: `已应用形象预设：${preset.name}。` });
}

function applyProfile(profileId) {
    const profile = personalityProfiles.find((item) => item.id === profileId);
    if (!profile) {
        return;
    }
    state.selectedPersonalityProfileId = profile.id;
    updateDraft((draft) => {
        draft.personality.summary = profile.summary;
        draft.voice.timbre = profile.voice.timbre;
        draft.voice.pace = profile.voice.pace;
        draft.voice.singingStyle = profile.voice.singing === '电子 / 梦核' ? '电子梦核' : profile.voice.singing;
        draft.personality.traits = { ...draft.personality.traits, ...(PROFILE_TRAITS[profile.id] || {}) };
    }, { type: 'success', message: `已加载人格预设：${profile.name}。` });
}

function openRuntime() {
    const url = new URL('./index.html?demo=1', window.location.href).toString();
    if (window.aigrilDesktop?.platform === 'electron') {
        window.location.href = url;
        return;
    }
    window.open(url, '_blank', 'noopener');
}

async function onAction(actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'switch-workspace') {
        state.activeWorkspace = actionEl.dataset.workspaceId || 'overview';
        render();
        return;
    }
    if (action === 'select-preview') {
        state.selectedPreviewId = actionEl.dataset.previewId || PREVIEWS[0].id;
        render();
        return;
    }
    if (action === 'apply-avatar-preset') return applyAvatarPreset(actionEl.dataset.presetId || '');
    if (action === 'apply-personality-profile') return applyProfile(actionEl.dataset.profileId || '');
    if (action === 'sync-resource-counts') return syncSlots();
    if (action === 'add-work') {
        const nextWork = createDefaultWorkTemplate(state.draftPackage.works.length);
        return updateDraft((draft) => draft.works.push(nextWork), { type: 'success', message: '已创建新的作品模板。' }, nextWork.id);
    }
    if (action === 'select-work') {
        state.selectedWorkId = actionEl.dataset.workId || '';
        render();
        return;
    }
    if (action === 'remove-work') {
        if (state.draftPackage.works.length <= 1) {
            setNotice('error', '至少保留一个作品模板，Runtime 才有默认演出入口。');
            render();
            return;
        }
        const workId = actionEl.dataset.workId || '';
        return updateDraft((draft) => { draft.works = draft.works.filter((work) => work.id !== workId); }, { type: 'info', message: '作品模板已移除。' });
    }
    if (action === 'promote-work') {
        const workId = actionEl.dataset.workId || '';
        return updateDraft((draft) => {
            const index = draft.works.findIndex((work) => work.id === workId);
            if (index <= 0) return;
            const [picked] = draft.works.splice(index, 1);
            draft.works.unshift(picked);
        }, { type: 'success', message: '该作品已设为主推作品，Runtime 默认动作和 spotlight 会跟着更新。' }, workId);
    }
    if (action === 'import-work-template') {
        const importedWork = (state.platformState.importedWorks || []).find((work) => work.id === (actionEl.dataset.importWorkId || ''));
        if (!importedWork) {
            setNotice('error', '没有找到要导入的资源作品。');
            render();
            return;
        }
        const nextWork = importedWorkTemplate(importedWork);
        return updateDraft((draft) => draft.works.push(nextWork), { type: 'success', message: `已从资源平台生成作品模板：${nextWork.title}。` }, nextWork.id);
    }
    if (action === 'publish-package') return publishPackage();
    if (action === 'activate-package') {
        state.registry = await saveRuntimePackageRegistry(activateRuntimePackage(state.registry, actionEl.dataset.packageId || ''));
        setNotice('success', 'Runtime 生效角色包已切换。');
        render();
        return;
    }
    if (action === 'load-package') return loadPackageToDraft(actionEl.dataset.packageId || '');
    if (action === 'remove-package') {
        state.registry = await saveRuntimePackageRegistry(removeRuntimePackage(state.registry, actionEl.dataset.packageId || ''));
        setNotice('info', '已从 Runtime 注册表移除这个角色包。');
        render();
        return;
    }
    if (action === 'open-runtime-preview') return openRuntime();
}

function onChange(event) {
    const bindEl = event.target.closest('[data-bind]');
    if (!bindEl) {
        return;
    }
    updateDraft((draft) => setByPath(draft, bindEl.dataset.bind, readValue(bindEl)));
}

function onInput(event) {
    const bindEl = event.target.closest('[data-bind]');
    if (!bindEl || (bindEl.type !== 'range' && bindEl.type !== 'color')) {
        return;
    }
    const readoutEl = appEl.querySelector(`[data-bind-readout="${bindEl.dataset.bind}"]`);
    if (readoutEl) {
        readoutEl.textContent = bindEl.value;
    }
    if (bindEl.type === 'color') {
        const swatchEl = readoutEl?.closest('.swatch-chip')?.querySelector('.swatch-chip__color');
        if (swatchEl) {
            swatchEl.style.background = bindEl.value;
        }
    }
}

async function boot() {
    const [registry, platformState] = await Promise.all([loadRuntimePackageRegistry(), loadResourcePlatformState()]);
    state.registry = registry;
    state.platformState = platformState;
    const activePackage = getActiveRuntimePackage(registry);
    const uiState = json(localStorage.getItem(UI_KEY), {});
    state.draftPackage = loadDraft(activePackage);
    state.activeWorkspace = WORKSPACE_BY_ID.has(uiState.activeWorkspace) ? uiState.activeWorkspace : 'overview';
    state.selectedPreviewId = PREVIEWS.some((item) => item.id === uiState.selectedPreviewId) ? uiState.selectedPreviewId : PREVIEWS[0].id;
    state.selectedAvatarPresetId = uiState.selectedAvatarPresetId || state.selectedAvatarPresetId;
    state.selectedPersonalityProfileId = uiState.selectedPersonalityProfileId || state.selectedPersonalityProfileId;
    state.selectedWorkId = uiState.selectedWorkId || state.draftPackage.works[0]?.id || '';
    ensureWork();
    render();
}

appEl.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
        void onAction(actionEl);
    }
});
appEl.addEventListener('change', onChange);
appEl.addEventListener('input', onInput);
window.addEventListener('runtimePackageRegistryChanged', (event) => {
    state.registry = event.detail || state.registry;
    render();
});
window.addEventListener('resourcePlatformChanged', (event) => {
    state.platformState = event.detail || state.platformState;
    render();
});
void boot();
