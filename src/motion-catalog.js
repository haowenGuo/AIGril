import { normalizeCueIntensity, normalizeMotionCategory } from './cue-utils.js';


const INTENSITY_RANK = {
    low: 0,
    medium: 1,
    high: 2
};

function normalizeWeight(value, fallbackValue = 1) {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return fallbackValue;
    }
    return parsedValue;
}

function normalizeCatalogEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const category = normalizeMotionCategory(entry.category);
    const path = String(entry.path || '').trim();
    if (!category || !path) {
        return null;
    }

    return {
        id: String(entry.id || '').trim() || path,
        label: String(entry.label || '').trim() || path.split('/').pop() || category,
        category,
        intensity: normalizeCueIntensity(entry.intensity) || 'medium',
        path,
        tier: String(entry.tier || 'review').trim() || 'review',
        source: String(entry.source || 'catalog').trim() || 'catalog',
        pack: String(entry.pack || '').trim(),
        weight: normalizeWeight(entry.weight, entry.tier === 'core' ? 3 : 1),
        preload: Boolean(entry.preload),
        desktopOnly: Boolean(entry.desktopOnly),
        legacyActionNames: Array.isArray(entry.legacyActionNames)
            ? entry.legacyActionNames.map((item) => String(item || '').trim()).filter(Boolean)
            : []
    };
}

export async function fetchMotionCatalog(catalogPath) {
    const response = await fetch(catalogPath, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`动作目录加载失败，状态码：${response.status}`);
    }

    const payload = await response.json();
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    return {
        ...payload,
        entries: entries
            .map((entry) => normalizeCatalogEntry(entry))
            .filter(Boolean)
    };
}

export function buildMotionCatalogIndex(catalog, { includeDesktopOnly = false } = {}) {
    const entries = Array.isArray(catalog?.entries)
        ? catalog.entries.filter((entry) => includeDesktopOnly || !entry.desktopOnly)
        : [];

    const byId = new Map();
    const byCategory = new Map();
    const byLegacyAction = new Map();

    for (const entry of entries) {
        byId.set(entry.id, entry);

        const categoryEntries = byCategory.get(entry.category) || [];
        categoryEntries.push(entry);
        byCategory.set(entry.category, categoryEntries);

        for (const legacyActionName of entry.legacyActionNames) {
            const legacyEntries = byLegacyAction.get(legacyActionName) || [];
            legacyEntries.push(entry);
            byLegacyAction.set(legacyActionName, legacyEntries);
        }
    }

    return {
        entries,
        byId,
        byCategory,
        byLegacyAction,
        meta: {
            version: catalog?.version || 1,
            generatedAt: catalog?.generatedAt || null
        }
    };
}

function getIntensityDistance(leftIntensity, rightIntensity) {
    const leftRank = INTENSITY_RANK[leftIntensity] ?? INTENSITY_RANK.medium;
    const rightRank = INTENSITY_RANK[rightIntensity] ?? INTENSITY_RANK.medium;
    return Math.abs(leftRank - rightRank);
}

function pickWeightedEntry(entries, currentMotionId, targetIntensity) {
    const candidates = entries.filter(Boolean);
    if (candidates.length === 0) {
        return null;
    }

    const weightedEntries = candidates.map((entry) => {
        const intensityDistance = getIntensityDistance(entry.intensity, targetIntensity);
        const intensityMultiplier = intensityDistance === 0
            ? 2.4
            : intensityDistance === 1
                ? 1.4
                : 0.9;
        const repeatPenalty = entry.id === currentMotionId && candidates.length > 1 ? 0.15 : 1;
        return {
            entry,
            weight: normalizeWeight(entry.weight) * intensityMultiplier * repeatPenalty
        };
    });

    const totalWeight = weightedEntries.reduce((total, item) => total + item.weight, 0);
    let randomValue = Math.random() * totalWeight;
    for (const item of weightedEntries) {
        randomValue -= item.weight;
        if (randomValue <= 0) {
            return item.entry;
        }
    }

    return weightedEntries[weightedEntries.length - 1].entry;
}

export function selectMotionEntry({
    catalogIndex,
    currentMotionId = null,
    requestedMotionId = null,
    category = null,
    intensity = 'medium',
    legacyAction = null,
    failedMotionIds = new Set()
}) {
    if (!catalogIndex) {
        return null;
    }

    const safeIntensity = normalizeCueIntensity(intensity) || 'medium';

    if (requestedMotionId) {
        const directEntry = catalogIndex.byId.get(requestedMotionId);
        if (directEntry && !failedMotionIds.has(directEntry.id)) {
            return directEntry;
        }
    }

    if (legacyAction) {
        const legacyEntries = (catalogIndex.byLegacyAction.get(legacyAction) || [])
            .filter((entry) => !failedMotionIds.has(entry.id));
        const legacyPick = pickWeightedEntry(legacyEntries, currentMotionId, safeIntensity);
        if (legacyPick) {
            return legacyPick;
        }
    }

    const safeCategory = normalizeMotionCategory(category);
    if (!safeCategory) {
        return null;
    }

    const entries = (catalogIndex.byCategory.get(safeCategory) || [])
        .filter((entry) => !failedMotionIds.has(entry.id));
    return pickWeightedEntry(entries, currentMotionId, safeIntensity);
}
