import {
    buildRuntimeManifest,
    cloneCharacterPackage,
    normalizeCharacterPackage,
    summarizeCharacterPackage,
    validateCharacterPackage
} from './aigril-package-contract.js';


const PACKAGE_REGISTRY_STORAGE_KEY = 'aigril_runtime_package_registry';


function nowIso() {
    return new Date().toISOString();
}


function isDesktopRuntime() {
    return typeof window !== 'undefined' && typeof window.aigrilDesktop === 'object';
}


export function createEmptyRuntimePackageRegistry() {
    return {
        version: 1,
        updatedAt: null,
        activePackageId: '',
        packages: []
    };
}


function normalizeRegistry(inputRegistry) {
    return {
        ...createEmptyRuntimePackageRegistry(),
        ...(inputRegistry || {}),
        packages: Array.isArray(inputRegistry?.packages)
            ? inputRegistry.packages.map((entry) => ({
                packageId: String(entry?.packageId || ''),
                summary: entry?.summary || null,
                manifest: entry?.manifest || null,
                validation: entry?.validation || null,
                payload: entry?.payload || null,
                publishedAt: entry?.publishedAt || null,
                lastActivatedAt: entry?.lastActivatedAt || null
            })).filter((entry) => entry.packageId)
            : []
    };
}


export async function loadRuntimePackageRegistry() {
    if (isDesktopRuntime() && typeof window.aigrilDesktop.loadRuntimePackageRegistry === 'function') {
        return normalizeRegistry(await window.aigrilDesktop.loadRuntimePackageRegistry());
    }

    try {
        const raw = window.localStorage.getItem(PACKAGE_REGISTRY_STORAGE_KEY);
        if (!raw) {
            return createEmptyRuntimePackageRegistry();
        }
        return normalizeRegistry(JSON.parse(raw));
    } catch (error) {
        console.warn('⚠️ 读取 Runtime 角色包注册表失败：', error);
        return createEmptyRuntimePackageRegistry();
    }
}


export async function saveRuntimePackageRegistry(nextRegistry) {
    const normalizedRegistry = normalizeRegistry({
        ...nextRegistry,
        updatedAt: nowIso()
    });

    if (isDesktopRuntime() && typeof window.aigrilDesktop.saveRuntimePackageRegistry === 'function') {
        const saved = normalizeRegistry(await window.aigrilDesktop.saveRuntimePackageRegistry(normalizedRegistry));
        window.dispatchEvent(new CustomEvent('runtimePackageRegistryChanged', { detail: saved }));
        return saved;
    }

    window.localStorage.setItem(PACKAGE_REGISTRY_STORAGE_KEY, JSON.stringify(normalizedRegistry));
    window.dispatchEvent(new CustomEvent('runtimePackageRegistryChanged', { detail: normalizedRegistry }));
    return normalizedRegistry;
}


export function getActiveRuntimePackage(registry) {
    const normalizedRegistry = normalizeRegistry(registry);
    return normalizedRegistry.packages.find((entry) => entry.packageId === normalizedRegistry.activePackageId) || null;
}


export function upsertRuntimePackage(registry, characterPackage) {
    const normalizedRegistry = normalizeRegistry(registry);
    const validation = validateCharacterPackage(characterPackage);
    const payload = cloneCharacterPackage(validation.normalizedPackage);
    const packageId = payload.packageId;

    const nextEntry = {
        packageId,
        summary: summarizeCharacterPackage(payload),
        manifest: buildRuntimeManifest(payload),
        validation: {
            score: validation.score,
            errors: validation.errors,
            warnings: validation.warnings,
            readyToPublish: validation.readyToPublish
        },
        payload,
        publishedAt: nowIso(),
        lastActivatedAt: normalizedRegistry.activePackageId === packageId ? nowIso() : null
    };

    const nextPackages = [...normalizedRegistry.packages];
    const existingIndex = nextPackages.findIndex((entry) => entry.packageId === packageId);
    if (existingIndex >= 0) {
        nextPackages[existingIndex] = {
            ...nextPackages[existingIndex],
            ...nextEntry
        };
    } else {
        nextPackages.unshift(nextEntry);
    }

    return normalizeRegistry({
        ...normalizedRegistry,
        packages: nextPackages,
        activePackageId: normalizedRegistry.activePackageId || packageId
    });
}


export function activateRuntimePackage(registry, packageId) {
    const normalizedRegistry = normalizeRegistry(registry);
    const nextPackages = normalizedRegistry.packages.map((entry) => ({
        ...entry,
        lastActivatedAt: entry.packageId === packageId ? nowIso() : entry.lastActivatedAt
    }));

    return normalizeRegistry({
        ...normalizedRegistry,
        packages: nextPackages,
        activePackageId: packageId
    });
}


export function removeRuntimePackage(registry, packageId) {
    const normalizedRegistry = normalizeRegistry(registry);
    const nextPackages = normalizedRegistry.packages.filter((entry) => entry.packageId !== packageId);
    return normalizeRegistry({
        ...normalizedRegistry,
        packages: nextPackages,
        activePackageId: normalizedRegistry.activePackageId === packageId
            ? (nextPackages[0]?.packageId || '')
            : normalizedRegistry.activePackageId
    });
}


export function createRuntimeIdentity(runtimePackageEntry) {
    if (!runtimePackageEntry?.manifest) {
        return null;
    }

    const manifest = runtimePackageEntry.manifest;
    return {
        packageId: runtimePackageEntry.packageId,
        packageName: manifest.packageName,
        displayName: manifest.displayName,
        greeting: manifest.greeting,
        tagline: manifest.tagline,
        archetype: manifest.archetype,
        accentColor: manifest.accentColor,
        eyeColor: manifest.eyeColor,
        runtimeFit: manifest.runtimeFit,
        personalitySummary: manifest.personalitySummary,
        catchphrase: manifest.catchphrase,
        defaultMotionCategory: manifest.defaultMotionCategory,
        spotlightWork: manifest.spotlightWork,
        voice: manifest.voice,
        versionTag: manifest.publishMeta?.versionTag || ''
    };
}
