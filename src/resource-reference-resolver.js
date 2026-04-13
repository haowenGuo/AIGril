import {
    buildBindingRecordFromAsset,
    buildBindingRecordFromMotion,
    collectWorkAssets,
    createEmptyResourceLibrary
} from './resource-library.js';
import { createEmptyTimeline, sortTimelineSegments } from './performance-workspace.js';


export function createEmptyWorkResourceRefs() {
    return {
        songId: '',
        accompanimentId: '',
        lyricsId: '',
        scoreId: '',
        motionId: ''
    };
}


export function normalizeWorkResourceRefs(resourceRefs) {
    const safeRefs = resourceRefs && typeof resourceRefs === 'object' ? resourceRefs : {};
    const defaults = createEmptyWorkResourceRefs();

    return {
        songId: String(safeRefs.songId || safeRefs.song || defaults.songId).trim(),
        accompanimentId: String(safeRefs.accompanimentId || safeRefs.accompaniment || defaults.accompanimentId).trim(),
        lyricsId: String(safeRefs.lyricsId || safeRefs.lyrics || defaults.lyricsId).trim(),
        scoreId: String(safeRefs.scoreId || safeRefs.score || defaults.scoreId).trim(),
        motionId: String(safeRefs.motionId || safeRefs.motion || defaults.motionId).trim()
    };
}


export function summarizeWorkResourceRefs(resourceRefs) {
    const normalizedRefs = normalizeWorkResourceRefs(resourceRefs);
    return {
        totalBound: Object.values(normalizedRefs).filter(Boolean).length,
        hasAudio: Boolean(normalizedRefs.songId || normalizedRefs.accompanimentId),
        hasLyrics: Boolean(normalizedRefs.lyricsId),
        hasMotion: Boolean(normalizedRefs.motionId),
        ...normalizedRefs
    };
}


function createAssetCandidateMap(library) {
    const safeLibrary = {
        ...createEmptyResourceLibrary(),
        ...(library || {}),
        works: Array.isArray(library?.works) ? library.works : [],
        motions: Array.isArray(library?.motions) ? library.motions : []
    };

    const assetMap = new Map();

    for (const work of safeLibrary.works) {
        for (const asset of collectWorkAssets(work)) {
            if (asset.slot === 'motion') {
                continue;
            }

            const binding = buildBindingRecordFromAsset(work, asset);
            assetMap.set(binding.id, {
                ...binding,
                sourceWorkId: work.id || '',
                sourceWorkTitle: work.title || binding.workTitle || '',
                searchLabel: [binding.title || '', work.title || '', work.artist || ''].filter(Boolean).join(' · ')
            });
        }
    }

    return assetMap;
}


function createMotionCandidateMap(library) {
    const safeLibrary = {
        ...createEmptyResourceLibrary(),
        ...(library || {}),
        motions: Array.isArray(library?.motions) ? library.motions : []
    };

    const motionMap = new Map();
    for (const motion of safeLibrary.motions) {
        const binding = buildBindingRecordFromMotion(motion);
        motionMap.set(binding.id, {
            ...binding,
            searchLabel: [binding.title || '', motion.category || '', motion.tier || ''].filter(Boolean).join(' · ')
        });
    }
    return motionMap;
}


export function collectLibraryBindingCandidates(library) {
    const assetMap = createAssetCandidateMap(library);
    const motionMap = createMotionCandidateMap(library);

    const grouped = {
        song: [],
        accompaniment: [],
        lyrics: [],
        score: [],
        motion: []
    };

    for (const binding of assetMap.values()) {
        if (grouped[binding.slot]) {
            grouped[binding.slot].push(binding);
        }
    }

    grouped.motion = Array.from(motionMap.values());

    for (const slotKey of Object.keys(grouped)) {
        grouped[slotKey].sort((left, right) => (
            String(left.searchLabel || left.title || '').localeCompare(
                String(right.searchLabel || right.title || ''),
                'zh-CN'
            )
        ));
    }

    return grouped;
}


export function resolveWorkResourceBindings(resourceRefs, library) {
    const normalizedRefs = normalizeWorkResourceRefs(resourceRefs);
    const assetMap = createAssetCandidateMap(library);
    const motionMap = createMotionCandidateMap(library);

    return {
        song: normalizedRefs.songId ? assetMap.get(normalizedRefs.songId) || null : null,
        accompaniment: normalizedRefs.accompanimentId ? assetMap.get(normalizedRefs.accompanimentId) || null : null,
        lyrics: normalizedRefs.lyricsId ? assetMap.get(normalizedRefs.lyricsId) || null : null,
        score: normalizedRefs.scoreId ? assetMap.get(normalizedRefs.scoreId) || null : null,
        motion: normalizedRefs.motionId ? motionMap.get(normalizedRefs.motionId) || null : null
    };
}


export function resolveResourceRefById(resourceId, library) {
    if (!resourceId) {
        return null;
    }

    const assetMap = createAssetCandidateMap(library);
    if (assetMap.has(resourceId)) {
        return assetMap.get(resourceId);
    }

    const motionMap = createMotionCandidateMap(library);
    return motionMap.get(resourceId) || null;
}


export function normalizeWorkTimeline(timeline) {
    return {
        ...createEmptyTimeline(),
        ...(timeline || {}),
        segments: sortTimelineSegments(timeline?.segments || [])
    };
}


export function buildPerformanceFromCharacterWork(work, library) {
    return {
        id: work?.id || '',
        title: work?.title || '未命名作品',
        artist: '',
        sourceWorkId: work?.id || '',
        sourceWorkTitle: work?.title || '',
        status: work?.status || 'draft',
        playbackSource: 'auto',
        bindings: resolveWorkResourceBindings(work?.resourceRefs || {}, library),
        timeline: normalizeWorkTimeline(work?.timeline || {})
    };
}
