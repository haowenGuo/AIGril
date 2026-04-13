import {
    collectWorkAssets,
    createEmptyResourceLibrary,
    resolveBindingSlot
} from './resource-library.js';


const PLATFORM_STORAGE_KEY = 'aigril_resource_platform_state';


function isPlainObject(value) {
    return typeof value === 'object' && value !== null;
}


function isAbsolutePath(value) {
    return /^[A-Za-z]:[\\/]/.test(String(value || '')) || String(value || '').startsWith('/');
}


export function isDesktopRuntime() {
    return typeof window !== 'undefined' && typeof window.aigrilDesktop === 'object';
}


export function createEmptyResourcePlatformState() {
    return {
        version: 1,
        updatedAt: null,
        importedAssets: [],
        importedWorks: [],
        performances: [],
        activePerformanceId: ''
    };
}


function sanitizePlatformState(payload) {
    if (!isPlainObject(payload)) {
        return createEmptyResourcePlatformState();
    }

    return {
        ...createEmptyResourcePlatformState(),
        ...payload,
        importedAssets: Array.isArray(payload.importedAssets) ? payload.importedAssets : [],
        importedWorks: Array.isArray(payload.importedWorks) ? payload.importedWorks : [],
        performances: Array.isArray(payload.performances) ? payload.performances : []
    };
}


export async function loadResourcePlatformState() {
    if (isDesktopRuntime() && typeof window.aigrilDesktop.loadResourcePlatformState === 'function') {
        return sanitizePlatformState(await window.aigrilDesktop.loadResourcePlatformState());
    }

    try {
        const raw = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
        if (!raw) {
            return createEmptyResourcePlatformState();
        }
        return sanitizePlatformState(JSON.parse(raw));
    } catch (error) {
        console.warn('⚠️ 读取资源平台状态失败：', error);
        return createEmptyResourcePlatformState();
    }
}


export async function saveResourcePlatformState(nextState) {
    const sanitized = sanitizePlatformState(nextState);

    if (isDesktopRuntime() && typeof window.aigrilDesktop.saveResourcePlatformState === 'function') {
        const saved = sanitizePlatformState(await window.aigrilDesktop.saveResourcePlatformState(sanitized));
        window.dispatchEvent(new CustomEvent('resourcePlatformChanged', { detail: saved }));
        return saved;
    }

    window.localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent('resourcePlatformChanged', { detail: sanitized }));
    return sanitized;
}


export async function importAuthorizedAssets() {
    if (!isDesktopRuntime() || typeof window.aigrilDesktop.importAuthorizedAssets !== 'function') {
        throw new Error('本地资源导入目前只支持 Electron 桌面版');
    }

    const result = await window.aigrilDesktop.importAuthorizedAssets();
    return {
        ...result,
        state: sanitizePlatformState(result?.state)
    };
}


function buildSearchRecordFromWorkAsset(work, asset) {
    return {
        id: asset.id,
        groupId: work.id,
        kind: asset.kind || resolveBindingSlot(asset, asset.kind),
        title: asset.title || work.title || '',
        artist: work.artist || '',
        role: asset.role || '',
        path: asset.path || '',
        tags: Array.isArray(work.tags) ? work.tags : []
    };
}


export function mergeLibraryWithPlatform(baseLibrary, platformState) {
    const base = {
        ...createEmptyResourceLibrary(),
        ...baseLibrary,
        works: Array.isArray(baseLibrary?.works) ? baseLibrary.works : [],
        motions: Array.isArray(baseLibrary?.motions) ? baseLibrary.motions : [],
        searchIndex: Array.isArray(baseLibrary?.searchIndex) ? baseLibrary.searchIndex : []
    };

    const importedWorks = Array.isArray(platformState?.importedWorks) ? platformState.importedWorks : [];
    const importedSearchRecords = importedWorks.flatMap((work) =>
        collectWorkAssets(work).map((asset) => buildSearchRecordFromWorkAsset(work, asset))
    );

    return {
        ...base,
        works: [...base.works, ...importedWorks],
        searchIndex: [...base.searchIndex, ...importedSearchRecords],
        stats: {
            ...base.stats,
            works: base.works.length + importedWorks.length,
            importedAssets: (base.stats?.importedAssets || 0) + ((platformState?.importedAssets || []).length),
            searchRecords: base.searchIndex.length + importedSearchRecords.length
        }
    };
}


export function isDesktopAsset(asset) {
    return Boolean(asset?.storage === 'desktop' || isAbsolutePath(asset?.path));
}


export async function resolveAssetUrl(assetOrPath) {
    const path = typeof assetOrPath === 'string' ? assetOrPath : assetOrPath?.path;
    if (!path) {
        return '';
    }

    if (isAbsolutePath(path)) {
        if (isDesktopRuntime() && typeof window.aigrilDesktop.resolveAssetUrl === 'function') {
            return window.aigrilDesktop.resolveAssetUrl(path);
        }
        return `file:///${String(path).replace(/\\/g, '/')}`;
    }

    return new URL(path, window.location.href).toString();
}


export async function fetchAssetTextPreview(assetOrPath, maxChars = 2400) {
    const path = typeof assetOrPath === 'string' ? assetOrPath : assetOrPath?.path;
    if (!path) {
        throw new Error('资源路径为空');
    }

    if (isAbsolutePath(path) && isDesktopRuntime() && typeof window.aigrilDesktop.readAssetText === 'function') {
        return window.aigrilDesktop.readAssetText(path, maxChars);
    }

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
