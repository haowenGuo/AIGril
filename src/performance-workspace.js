import {
    buildBindingRecordFromAsset,
    getBindingSlots
} from './resource-library.js';


const DEFAULT_SEGMENT_DURATION_SECONDS = 3.5;


function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}


function nowIso() {
    return new Date().toISOString();
}


function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}


function normalizeSegment(segment, index = 0) {
    const startTime = Math.max(0, toNumber(segment?.startTime, index * DEFAULT_SEGMENT_DURATION_SECONDS));
    const endTime = Math.max(startTime + 0.1, toNumber(segment?.endTime, startTime + DEFAULT_SEGMENT_DURATION_SECONDS));

    return {
        id: segment?.id || createId('segment'),
        order: toNumber(segment?.order, index),
        text: String(segment?.text || '').trim(),
        startTime,
        endTime,
        motionId: String(segment?.motionId || '').trim(),
        motionCategory: String(segment?.motionCategory || '').trim(),
        motionIntensity: String(segment?.motionIntensity || 'medium').trim(),
        expression: String(segment?.expression || '').trim(),
        expressionIntensity: String(segment?.expressionIntensity || 'medium').trim()
    };
}


export function createEmptyTimeline() {
    return {
        version: 1,
        updatedAt: null,
        sourceAssetId: '',
        sourceExt: '',
        motionLeadSeconds: 0,
        segments: []
    };
}


export function createEmptyPerformance() {
    return {
        id: createId('performance'),
        title: '未命名作品',
        artist: '',
        sourceWorkId: '',
        sourceWorkTitle: '',
        status: 'draft',
        playbackSource: 'auto',
        bindings: {},
        timeline: createEmptyTimeline(),
        createdAt: nowIso(),
        updatedAt: nowIso()
    };
}


export function sortTimelineSegments(segments) {
    return [...(segments || [])]
        .map((segment, index) => normalizeSegment(segment, index))
        .sort((left, right) => left.startTime - right.startTime || left.order - right.order)
        .map((segment, index) => ({
            ...segment,
            order: index
        }));
}


export function createPerformanceFromWork(work) {
    const performance = {
        ...createEmptyPerformance(),
        title: work?.title || '未命名作品',
        artist: work?.artist || '',
        sourceWorkId: work?.id || '',
        sourceWorkTitle: work?.title || '',
        bindings: {},
        timeline: createEmptyTimeline()
    };

    const slotValues = new Map();
    const bucketEntries = [
        ['audio', work?.assets?.audio || []],
        ['lyrics', work?.assets?.lyrics || []],
        ['score', work?.assets?.scores || []]
    ];

    for (const [bucketKey, bucket] of bucketEntries) {
        for (const asset of bucket) {
            const binding = buildBindingRecordFromAsset(work, { ...asset, kind: bucketKey });
            if (!slotValues.has(binding.slot)) {
                slotValues.set(binding.slot, binding);
            }
        }
    }

    performance.bindings = Object.fromEntries(slotValues.entries());
    return performance;
}


export function upsertPerformance(state, performance, { markActive = true } = {}) {
    const performances = Array.isArray(state?.performances) ? [...state.performances] : [];
    const nextPerformance = {
        ...createEmptyPerformance(),
        ...performance,
        updatedAt: nowIso(),
        bindings: { ...(performance?.bindings || {}) },
        timeline: {
            ...createEmptyTimeline(),
            ...(performance?.timeline || {}),
            segments: sortTimelineSegments(performance?.timeline?.segments || [])
        }
    };

    const existingIndex = performances.findIndex((item) => item.id === nextPerformance.id);
    if (existingIndex >= 0) {
        performances[existingIndex] = nextPerformance;
    } else {
        performances.push(nextPerformance);
    }

    return {
        ...state,
        performances,
        activePerformanceId: markActive ? nextPerformance.id : (state?.activePerformanceId || '')
    };
}


export function removePerformance(state, performanceId) {
    const performances = (state?.performances || []).filter((item) => item.id !== performanceId);
    return {
        ...state,
        performances,
        activePerformanceId: state?.activePerformanceId === performanceId
            ? (performances[0]?.id || '')
            : state?.activePerformanceId || ''
    };
}


export function applyBindingToPerformance(performance, slot, binding) {
    const nextBindings = {
        ...(performance?.bindings || {}),
        [slot]: binding
    };

    return {
        ...performance,
        bindings: nextBindings,
        updatedAt: nowIso()
    };
}


export function clearPerformanceBinding(performance, slot) {
    const nextBindings = { ...(performance?.bindings || {}) };
    delete nextBindings[slot];

    return {
        ...performance,
        bindings: nextBindings,
        updatedAt: nowIso()
    };
}


export function listPerformanceBindings(performance) {
    return getBindingSlots().map((slot) => ({
        ...slot,
        binding: performance?.bindings?.[slot.key] || null
    }));
}


export function selectPlaybackBinding(performance) {
    const playbackSource = performance?.playbackSource || 'auto';
    const bindings = performance?.bindings || {};

    if (playbackSource === 'song') {
        return bindings.song || bindings.accompaniment || null;
    }
    if (playbackSource === 'accompaniment') {
        return bindings.accompaniment || bindings.song || null;
    }
    return bindings.accompaniment || bindings.song || null;
}


function parseLrcText(text) {
    const lines = String(text || '').split(/\r?\n/);
    const items = [];
    const timeTagPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const line of lines) {
        const matches = [...line.matchAll(timeTagPattern)];
        if (!matches.length) {
            continue;
        }

        const lyricText = line.replace(timeTagPattern, '').trim();
        if (!lyricText) {
            continue;
        }

        for (const match of matches) {
            const minutes = Number(match[1] || 0);
            const seconds = Number(match[2] || 0);
            const fractionRaw = String(match[3] || '');
            const fraction = fractionRaw
                ? Number(`0.${fractionRaw.padEnd(3, '0').slice(0, 3)}`)
                : 0;

            items.push({
                text: lyricText,
                startTime: minutes * 60 + seconds + fraction
            });
        }
    }

    items.sort((left, right) => left.startTime - right.startTime);

    return items.map((item, index) => ({
        ...item,
        endTime: items[index + 1]
            ? Math.max(item.startTime + 0.15, items[index + 1].startTime)
            : item.startTime + DEFAULT_SEGMENT_DURATION_SECONDS
    }));
}


function parsePlainLyricsText(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({
            text: line,
            startTime: index * DEFAULT_SEGMENT_DURATION_SECONDS,
            endTime: (index + 1) * DEFAULT_SEGMENT_DURATION_SECONDS
        }));
}


export function buildTimelineSegmentsFromText({
    text,
    ext = '.txt',
    defaultMotionCategory = '',
    defaultMotionIntensity = 'medium'
}) {
    const parsedSegments = String(ext || '').toLowerCase() === '.lrc'
        ? parseLrcText(text)
        : parsePlainLyricsText(text);

    return sortTimelineSegments(
        parsedSegments.map((segment, index) => ({
            id: createId('segment'),
            order: index,
            text: segment.text,
            startTime: segment.startTime,
            endTime: segment.endTime,
            motionId: '',
            motionCategory: defaultMotionCategory,
            motionIntensity: defaultMotionIntensity,
            expression: '',
            expressionIntensity: 'medium'
        }))
    );
}


export async function ensurePerformanceTimeline(performance, loadTextPreview) {
    const lyricsBinding = performance?.bindings?.lyrics || null;
    if (!lyricsBinding?.path) {
        return performance;
    }

    if (performance?.timeline?.segments?.length) {
        return performance;
    }

    const previewText = await loadTextPreview(lyricsBinding);
    const defaultMotionCategory =
        performance?.bindings?.motion?.metadata?.category ||
        performance?.bindings?.motion?.metadata?.motion_category ||
        '';
    const defaultMotionIntensity =
        performance?.bindings?.motion?.metadata?.intensity ||
        performance?.bindings?.motion?.metadata?.motionIntensity ||
        'medium';

    return {
        ...performance,
        timeline: {
            ...createEmptyTimeline(),
            ...(performance?.timeline || {}),
            updatedAt: nowIso(),
            sourceAssetId: lyricsBinding.id || '',
            sourceExt: lyricsBinding.ext || '',
            segments: buildTimelineSegmentsFromText({
                text: previewText,
                ext: lyricsBinding.ext || '.txt',
                defaultMotionCategory,
                defaultMotionIntensity
            })
        },
        updatedAt: nowIso()
    };
}


export function addTimelineSegment(performance) {
    const segments = sortTimelineSegments(performance?.timeline?.segments || []);
    const lastSegment = segments[segments.length - 1];
    const startTime = lastSegment ? lastSegment.endTime : 0;
    const newSegment = normalizeSegment({
        id: createId('segment'),
        order: segments.length,
        text: '',
        startTime,
        endTime: startTime + DEFAULT_SEGMENT_DURATION_SECONDS,
        motionCategory: performance?.bindings?.motion?.metadata?.category || '',
        motionIntensity: performance?.bindings?.motion?.metadata?.intensity || 'medium'
    }, segments.length);

    return {
        ...performance,
        timeline: {
            ...createEmptyTimeline(),
            ...(performance?.timeline || {}),
            updatedAt: nowIso(),
            segments: sortTimelineSegments([...segments, newSegment])
        },
        updatedAt: nowIso()
    };
}


export function updateTimelineSegment(performance, segmentId, patch) {
    const nextSegments = sortTimelineSegments(
        (performance?.timeline?.segments || []).map((segment) => (
            segment.id === segmentId ? { ...segment, ...patch } : segment
        ))
    );

    return {
        ...performance,
        timeline: {
            ...createEmptyTimeline(),
            ...(performance?.timeline || {}),
            updatedAt: nowIso(),
            segments: nextSegments
        },
        updatedAt: nowIso()
    };
}


export function removeTimelineSegment(performance, segmentId) {
    return {
        ...performance,
        timeline: {
            ...createEmptyTimeline(),
            ...(performance?.timeline || {}),
            updatedAt: nowIso(),
            segments: sortTimelineSegments(
                (performance?.timeline?.segments || []).filter((segment) => segment.id !== segmentId)
            )
        },
        updatedAt: nowIso()
    };
}


export function getTimelineDurationHint(performance) {
    const segments = performance?.timeline?.segments || [];
    if (!segments.length) {
        return 0;
    }
    return Math.max(...segments.map((segment) => Number(segment.endTime) || 0));
}


export function formatTimelineTime(value) {
    const safeValue = Math.max(0, Number(value) || 0);
    const minutes = Math.floor(safeValue / 60);
    const seconds = safeValue % 60;
    return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
}
