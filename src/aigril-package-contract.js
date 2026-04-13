import { MOTION_CATEGORIES } from './cue-utils.js';
import { createEmptyTimeline, sortTimelineSegments } from './performance-workspace.js';
import {
    createEmptyWorkResourceRefs,
    normalizeWorkResourceRefs,
    summarizeWorkResourceRefs
} from './resource-reference-resolver.js';


export const RESOURCE_SLOT_DEFS = Object.freeze([
    { key: 'songs', label: '歌曲' },
    { key: 'accompaniments', label: '伴奏' },
    { key: 'lyrics', label: '歌词' },
    { key: 'motions', label: '动作' },
    { key: 'danceTemplates', label: '舞蹈模板' },
    { key: 'voicePresets', label: '声线模板' }
]);

export const SLOT_STATUS_OPTIONS = Object.freeze(['draft', 'ready', 'review']);
export const VOICE_TIMBRE_OPTIONS = Object.freeze(['轻柔女声', '亮感女声', '空灵女声', '冷感女声']);
export const VOICE_PACE_OPTIONS = Object.freeze(['偏慢', '中速', '中快']);
export const SINGING_STYLE_OPTIONS = Object.freeze(['抒情优先', '流行唱跳', '电子梦核', '舞台主唱']);
export const ARCHETYPE_OPTIONS = Object.freeze(['舞台型偶像', '陪伴型女友', '冷感系主唱']);
export const OUTFIT_OPTIONS = Object.freeze(['演出服', '日常穿搭', '都会舞台', '学院轻甜']);
export const HAIR_OPTIONS = Object.freeze(['中长发', '短发', '高马尾', '双马尾', '波浪长发']);
export const CAMERA_OPTIONS = Object.freeze(['半身镜头', '近景镜头', '舞台全景']);
export const WORK_STATUS_OPTIONS = Object.freeze(['draft', 'ready', 'review']);


function nowIso() {
    return new Date().toISOString();
}


function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}


function clampNumber(value, min = 0, max = 100, fallback = 0) {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, nextValue));
}


function normalizeColor(value, fallback) {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}


export function createDefaultWorkTemplate(index = 0) {
    return {
        id: createId('work'),
        title: index === 0 ? '夜风练习室' : `新作品 ${index + 1}`,
        scenario: index === 0 ? '晚间陪伴' : '新场景',
        mood: index === 0 ? '温柔 / 抒情' : '舞台 / 互动',
        summary: index === 0
            ? '适合轻唱、轻动作和慢节奏对话。'
            : '为这个角色定义新的歌曲、动作和演出模板。',
        resourceBindings: {
            songs: index === 0 ? 6 : 0,
            accompaniments: index === 0 ? 4 : 0,
            lyrics: index === 0 ? 5 : 0,
            motions: index === 0 ? 8 : 0
        },
        preferredMotionCategory: index === 0 ? 'idle' : 'dance',
        defaultExpression: index === 0 ? 'relaxed' : 'happy',
        stagePreset: index === 0 ? '晚安广播' : '聚光舞台',
        status: index === 0 ? 'ready' : 'draft',
        resourceRefs: createEmptyWorkResourceRefs(),
        timeline: createEmptyTimeline()
    };
}


export function createDefaultCharacterPackage() {
    return {
        version: 1,
        packageId: createId('pkg'),
        packageName: 'AIGril 角色包',
        creatorName: 'Studio User',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        avatar: {
            displayName: 'AIGL',
            archetype: ARCHETYPE_OPTIONS[0],
            tagline: '会唱歌，也会认真陪你说话。',
            silhouette: '中长发 + 演出服 + 高辨识配色',
            runtimeFit: '适合唱跳、短对话、陪伴型直播',
            visual: {
                hairStyle: HAIR_OPTIONS[0],
                outfitStyle: OUTFIT_OPTIONS[0],
                cameraFraming: CAMERA_OPTIONS[0],
                accentColor: '#127475',
                eyeColor: '#2e4057',
                skinTone: 56,
                expressiveness: 72,
                motionEnergy: 66
            }
        },
        personality: {
            summary: '表达温柔，镜头感好，会接住用户情绪，也能自然切到唱歌和表演。',
            greeting: '你好呀，我已经准备好陪你了。',
            boundary: '保持温柔亲近，但不越界。',
            catchphrase: '来吧，我们把这一刻变好一点。',
            traits: {
                warmth: 82,
                initiative: 64,
                humor: 48,
                calmness: 72
            }
        },
        voice: {
            timbre: VOICE_TIMBRE_OPTIONS[0],
            pace: VOICE_PACE_OPTIONS[1],
            singingStyle: SINGING_STYLE_OPTIONS[0]
        },
        resources: {
            slots: {
                songs: { count: 12, status: 'ready' },
                accompaniments: { count: 8, status: 'ready' },
                lyrics: { count: 10, status: 'ready' },
                motions: { count: 20, status: 'review' },
                danceTemplates: { count: 4, status: 'draft' },
                voicePresets: { count: 3, status: 'ready' }
            }
        },
        works: [
            createDefaultWorkTemplate(0)
        ],
        publishMeta: {
            versionTag: '0.1.0',
            channel: 'draft',
            status: 'editing',
            publishedAt: null,
            lastValidationScore: 0,
            notes: 'Studio 初版角色包'
        }
    };
}


export function cloneCharacterPackage(characterPackage) {
    return JSON.parse(JSON.stringify(characterPackage));
}


export function normalizeCharacterPackage(inputPackage) {
    const safePackage = cloneCharacterPackage(inputPackage || createDefaultCharacterPackage());
    const defaults = createDefaultCharacterPackage();

    const nextPackage = {
        ...defaults,
        ...safePackage,
        avatar: {
            ...defaults.avatar,
            ...(safePackage.avatar || {}),
            visual: {
                ...defaults.avatar.visual,
                ...(safePackage.avatar?.visual || {})
            }
        },
        personality: {
            ...defaults.personality,
            ...(safePackage.personality || {}),
            traits: {
                ...defaults.personality.traits,
                ...(safePackage.personality?.traits || {})
            }
        },
        voice: {
            ...defaults.voice,
            ...(safePackage.voice || {})
        },
        resources: {
            ...defaults.resources,
            ...(safePackage.resources || {}),
            slots: {
                ...defaults.resources.slots,
                ...(safePackage.resources?.slots || {})
            }
        },
        publishMeta: {
            ...defaults.publishMeta,
            ...(safePackage.publishMeta || {})
        },
        works: Array.isArray(safePackage.works) && safePackage.works.length
            ? safePackage.works.map((work, index) => ({
                ...createDefaultWorkTemplate(index),
                ...work,
                resourceBindings: {
                    ...createDefaultWorkTemplate(index).resourceBindings,
                    ...(work.resourceBindings || {})
                },
                resourceRefs: normalizeWorkResourceRefs(work.resourceRefs),
                timeline: {
                    ...createEmptyTimeline(),
                    ...(work.timeline || {}),
                    segments: sortTimelineSegments(work?.timeline?.segments || [])
                }
            }))
            : defaults.works
    };

    nextPackage.avatar.visual.accentColor = normalizeColor(nextPackage.avatar.visual.accentColor, defaults.avatar.visual.accentColor);
    nextPackage.avatar.visual.eyeColor = normalizeColor(nextPackage.avatar.visual.eyeColor, defaults.avatar.visual.eyeColor);
    nextPackage.avatar.visual.skinTone = clampNumber(nextPackage.avatar.visual.skinTone, 0, 100, defaults.avatar.visual.skinTone);
    nextPackage.avatar.visual.expressiveness = clampNumber(nextPackage.avatar.visual.expressiveness, 0, 100, defaults.avatar.visual.expressiveness);
    nextPackage.avatar.visual.motionEnergy = clampNumber(nextPackage.avatar.visual.motionEnergy, 0, 100, defaults.avatar.visual.motionEnergy);

    for (const traitKey of Object.keys(nextPackage.personality.traits)) {
        nextPackage.personality.traits[traitKey] = clampNumber(nextPackage.personality.traits[traitKey], 0, 100, defaults.personality.traits[traitKey]);
    }

    for (const slotDef of RESOURCE_SLOT_DEFS) {
        const nextSlot = nextPackage.resources.slots[slotDef.key] || defaults.resources.slots[slotDef.key];
        nextPackage.resources.slots[slotDef.key] = {
            count: clampNumber(nextSlot.count, 0, 999, 0),
            status: SLOT_STATUS_OPTIONS.includes(nextSlot.status) ? nextSlot.status : 'draft'
        };
    }

    nextPackage.works = nextPackage.works.map((work, index) => ({
        ...createDefaultWorkTemplate(index),
        ...work,
        preferredMotionCategory: MOTION_CATEGORIES.includes(work.preferredMotionCategory)
            ? work.preferredMotionCategory
            : createDefaultWorkTemplate(index).preferredMotionCategory,
        status: WORK_STATUS_OPTIONS.includes(work.status) ? work.status : 'draft',
        resourceBindings: {
            ...createDefaultWorkTemplate(index).resourceBindings,
            ...(work.resourceBindings || {})
        },
        resourceRefs: normalizeWorkResourceRefs(work.resourceRefs),
        timeline: {
            ...createEmptyTimeline(),
            ...(work.timeline || {}),
            segments: sortTimelineSegments(work?.timeline?.segments || [])
        }
    }));

    nextPackage.updatedAt = nowIso();
    return nextPackage;
}


export function validateCharacterPackage(characterPackage) {
    const normalizedPackage = normalizeCharacterPackage(characterPackage);
    const errors = [];
    const warnings = [];

    if (!normalizedPackage.avatar.displayName.trim()) {
        errors.push('角色显示名不能为空。');
    }
    if (!normalizedPackage.avatar.tagline.trim()) {
        warnings.push('角色缺少一句清晰的自我介绍。');
    }
    if (!ARCHETYPE_OPTIONS.includes(normalizedPackage.avatar.archetype)) {
        errors.push('角色原型未落在支持的形象工坊预设里。');
    }
    if (!normalizedPackage.personality.summary.trim()) {
        errors.push('性格摘要不能为空。');
    }
    if (!normalizedPackage.personality.greeting.trim()) {
        warnings.push('建议填写默认开场白，Runtime 接入后首句会更完整。');
    }
    if (!normalizedPackage.publishMeta.versionTag.trim()) {
        errors.push('发布版本号不能为空。');
    }
    if (!/^\d+\.\d+\.\d+$/.test(normalizedPackage.publishMeta.versionTag.trim())) {
        warnings.push('版本号建议使用 x.y.z 结构，方便 Runtime 回滚。');
    }
    if (!normalizedPackage.works.length) {
        errors.push('至少需要一个作品模板。');
    }

    normalizedPackage.works.forEach((work, index) => {
        const bindingSummary = summarizeWorkResourceRefs(work.resourceRefs);
        const legacyBindingCounts = work.resourceBindings || {};
        const usesLegacyCounts = !bindingSummary.totalBound &&
            ['songs', 'accompaniments', 'lyrics', 'motions'].some((key) => Number(legacyBindingCounts[key] || 0) > 0);

        if (!work.title.trim()) {
            errors.push(`作品 ${index + 1} 缺少标题。`);
        }
        if (!MOTION_CATEGORIES.includes(work.preferredMotionCategory)) {
            errors.push(`作品 ${index + 1} 的默认动作类别无效。`);
        }
        if (!bindingSummary.hasAudio && (legacyBindingCounts.songs || 0) <= 0 && (legacyBindingCounts.accompaniments || 0) <= 0) {
            errors.push(`作品 ${index + 1} 至少需要歌曲或伴奏其中一种资源。`);
        }
        if (!bindingSummary.hasLyrics && (legacyBindingCounts.lyrics || 0) <= 0) {
            warnings.push(`作品 ${index + 1} 没有歌词资源，后续做对齐会比较困难。`);
        }
        if (!bindingSummary.hasMotion && (legacyBindingCounts.motions || 0) <= 0) {
            warnings.push(`作品 ${index + 1} 没有动作资源，Runtime 只能用默认动作。`);
        }
        if (usesLegacyCounts) {
            warnings.push(`作品 ${index + 1} 仍在使用旧的数量绑定，建议升级为具体资源 ID 绑定。`);
        }
        if (work.timeline?.segments?.length && !bindingSummary.hasLyrics) {
            warnings.push(`作品 ${index + 1} 已有时间轴，但还没有绑定具体歌词资源。`);
        }
    });

    const totalRequiredSongs = normalizedPackage.works.reduce((sum, work) => {
        const bindingSummary = summarizeWorkResourceRefs(work.resourceRefs);
        return sum + (bindingSummary.songId ? 1 : (work.resourceBindings.songs || 0));
    }, 0);
    if ((normalizedPackage.resources.slots.songs?.count || 0) < totalRequiredSongs) {
        warnings.push('资源槽位里的歌曲数量少于作品模板引用需求。');
    }

    const totalRequiredMotions = normalizedPackage.works.reduce((sum, work) => {
        const bindingSummary = summarizeWorkResourceRefs(work.resourceRefs);
        return sum + (bindingSummary.motionId ? 1 : (work.resourceBindings.motions || 0));
    }, 0);
    if ((normalizedPackage.resources.slots.motions?.count || 0) < totalRequiredMotions) {
        warnings.push('资源槽位里的动作数量少于作品模板引用需求。');
    }

    const score = Math.max(0, 100 - errors.length * 15 - warnings.length * 5);

    return {
        normalizedPackage,
        errors,
        warnings,
        score,
        readyToPublish: errors.length === 0
    };
}


export function summarizeCharacterPackage(characterPackage) {
    const normalizedPackage = normalizeCharacterPackage(characterPackage);
    return {
        packageId: normalizedPackage.packageId,
        packageName: normalizedPackage.packageName,
        displayName: normalizedPackage.avatar.displayName,
        archetype: normalizedPackage.avatar.archetype,
        works: normalizedPackage.works.length,
        versionTag: normalizedPackage.publishMeta.versionTag,
        accentColor: normalizedPackage.avatar.visual.accentColor
    };
}


export function buildRuntimeManifest(characterPackage) {
    const normalizedPackage = normalizeCharacterPackage(characterPackage);
    return {
        packageId: normalizedPackage.packageId,
        packageName: normalizedPackage.packageName,
        displayName: normalizedPackage.avatar.displayName,
        greeting: normalizedPackage.personality.greeting,
        tagline: normalizedPackage.avatar.tagline,
        archetype: normalizedPackage.avatar.archetype,
        accentColor: normalizedPackage.avatar.visual.accentColor,
        eyeColor: normalizedPackage.avatar.visual.eyeColor,
        runtimeFit: normalizedPackage.avatar.runtimeFit,
        personalitySummary: normalizedPackage.personality.summary,
        catchphrase: normalizedPackage.personality.catchphrase,
        voice: normalizedPackage.voice,
        defaultMotionCategory: normalizedPackage.works[0]?.preferredMotionCategory || 'idle',
        spotlightWork: normalizedPackage.works[0]?.title || '',
        works: normalizedPackage.works.map((work) => ({
            id: work.id,
            title: work.title,
            mood: work.mood,
            preferredMotionCategory: work.preferredMotionCategory,
            defaultExpression: work.defaultExpression,
            resourceRefs: normalizeWorkResourceRefs(work.resourceRefs),
            timeline: {
                sourceAssetId: work.timeline?.sourceAssetId || '',
                sourceExt: work.timeline?.sourceExt || '',
                motionLeadSeconds: work.timeline?.motionLeadSeconds || 0,
                segments: sortTimelineSegments(work.timeline?.segments || [])
            }
        })),
        publishMeta: {
            versionTag: normalizedPackage.publishMeta.versionTag,
            channel: normalizedPackage.publishMeta.channel,
            publishedAt: normalizedPackage.publishMeta.publishedAt
        }
    };
}
