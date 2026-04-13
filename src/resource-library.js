import { CONFIG } from './config.js';


const BINDINGS_STORAGE_KEY = 'aigril_resource_bindings';
const TEXT_PREVIEWABLE_EXTENSIONS = new Set(['.txt', '.lrc', '.vtt', '.srt', '.ass', '.ly', '.abc', '.krn', '.musicxml', '.mei']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus']);


export function createEmptyResourceLibrary() {
    return {
        version: 1,
        generatedAt: null,
        libraryRoot: 'Resources/library',
        stats: {
            works: 0,
            importedAssets: 0,
            motionEntries: 0,
            searchRecords: 0
        },
        works: [],
        motions: [],
        searchIndex: []
    };
}


export async function fetchResourceLibrary(path = CONFIG.RESOURCE_LIBRARY_PATH) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        return {
            ...createEmptyResourceLibrary(),
            ...payload,
            works: Array.isArray(payload.works) ? payload.works : [],
            motions: Array.isArray(payload.motions) ? payload.motions : [],
            searchIndex: Array.isArray(payload.searchIndex) ? payload.searchIndex : []
        };
    } catch (error) {
        console.warn('⚠️ 资源库加载失败，回退为空库：', error);
        return createEmptyResourceLibrary();
    }
}


export function loadResourceBindings() {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(BINDINGS_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch (error) {
        console.warn('⚠️ 读取资源绑定失败：', error);
        return {};
    }
}


export function saveResourceBindings(bindings) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
    window.dispatchEvent(new CustomEvent('resourceBindingsChanged', { detail: bindings }));
}


export function resolveBindingSlot(asset, bucketKey = '') {
    const role = String(asset?.role || '').toLowerCase();
    const kind = String(asset?.kind || bucketKey || '').toLowerCase();

    if (kind === 'audio') {
        return role === 'accompaniment' ? 'accompaniment' : 'song';
    }
    if (kind === 'lyrics') {
        return 'lyrics';
    }
    if (kind === 'score' || kind === 'scores') {
        return 'score';
    }
    if (kind === 'motion' || kind === 'motions') {
        return 'motion';
    }
    return role || 'asset';
}


export function collectWorkAssets(work) {
    if (!work?.assets) {
        return [];
    }

    const bucketEntries = [
        ['audio', work.assets.audio || []],
        ['lyrics', work.assets.lyrics || []],
        ['score', work.assets.scores || []],
        ['motion', work.assets.motions || []]
    ];

    return bucketEntries.flatMap(([bucketKey, items]) =>
        items.map((asset) => ({
            ...asset,
            kind: bucketKey,
            slot: resolveBindingSlot(asset, bucketKey)
        }))
    );
}


export function summarizeWorkAssets(work) {
    const assets = collectWorkAssets(work);
    return {
        song: assets.filter((asset) => asset.slot === 'song').length,
        accompaniment: assets.filter((asset) => asset.slot === 'accompaniment').length,
        lyrics: assets.filter((asset) => asset.slot === 'lyrics').length,
        score: assets.filter((asset) => asset.slot === 'score').length,
        motion: assets.filter((asset) => asset.slot === 'motion').length
    };
}


export function workMatchesQuery(work, query) {
    if (!query) {
        return true;
    }

    const haystack = [
        work?.title || '',
        work?.artist || '',
        work?.searchText || '',
        ...(work?.tags || [])
    ].join(' ').toLowerCase();

    return haystack.includes(query.toLowerCase());
}


export function motionMatchesQuery(motion, query) {
    if (!query) {
        return true;
    }

    const haystack = [
        motion?.title || '',
        motion?.category || '',
        motion?.intensity || '',
        motion?.tier || '',
        ...(motion?.tags || [])
    ].join(' ').toLowerCase();

    return haystack.includes(query.toLowerCase());
}


export function filterWorks(works, query, filter = 'all') {
    return (works || []).filter((work) => {
        if (!workMatchesQuery(work, query)) {
            return false;
        }

        if (filter === 'all') {
            return true;
        }

        const summary = summarizeWorkAssets(work);
        return summary[filter] > 0;
    });
}


export function filterMotions(motions, query, category = 'all') {
    return (motions || []).filter((motion) => {
        if (category !== 'all' && motion?.category !== category) {
            return false;
        }
        return motionMatchesQuery(motion, query);
    });
}


export function buildBindingRecordFromAsset(work, asset) {
    const slot = resolveBindingSlot(asset, asset?.kind);
    return {
        slot,
        id: asset?.id || '',
        workId: work?.id || '',
        title: asset?.title || work?.title || '',
        workTitle: work?.title || '',
        artist: work?.artist || '',
        role: asset?.role || slot,
        kind: asset?.kind || '',
        ext: asset?.ext || '',
        path: asset?.path || '',
        metadata: asset?.metadata || {}
    };
}


export function buildBindingRecordFromMotion(motion) {
    return {
        slot: 'motion',
        id: motion?.id || '',
        workId: motion?.groupId || '',
        title: motion?.title || '',
        workTitle: motion?.title || '',
        artist: '',
        role: 'motion',
        kind: 'motion',
        ext: motion?.path?.includes('.') ? `.${motion.path.split('.').pop().toLowerCase()}` : '',
        path: motion?.path || '',
        metadata: {
            category: motion?.category || '',
            intensity: motion?.intensity || '',
            tier: motion?.tier || '',
            source: motion?.source || ''
        }
    };
}


export function isAudioAsset(asset) {
    return AUDIO_EXTENSIONS.has(String(asset?.ext || '').toLowerCase());
}


export function isTextPreviewableAsset(asset) {
    return TEXT_PREVIEWABLE_EXTENSIONS.has(String(asset?.ext || '').toLowerCase());
}


export async function fetchAssetTextPreview(path, maxChars = 2400) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    if (text.length <= maxChars) {
        return text;
    }
    return `${text.slice(0, maxChars)}\n...`;
}


export function getBindingSlots() {
    return [
        { key: 'song', label: '歌曲' },
        { key: 'accompaniment', label: '伴奏' },
        { key: 'lyrics', label: '歌词' },
        { key: 'score', label: '乐谱' },
        { key: 'motion', label: '动作' }
    ];
}
