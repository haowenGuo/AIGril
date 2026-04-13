import {
    createRuntimeIdentity,
    getActiveRuntimePackage,
    loadRuntimePackageRegistry
} from './runtime-package-registry.js';


export async function loadActiveRuntimeIdentity() {
    const registry = await loadRuntimePackageRegistry();
    const activePackage = getActiveRuntimePackage(registry);
    return {
        registry,
        activePackage,
        identity: createRuntimeIdentity(activePackage)
    };
}


export function applyRuntimeIdentityToDocument(identity) {
    if (!identity || typeof document === 'undefined') {
        return;
    }

    document.documentElement.style.setProperty('--runtime-accent', identity.accentColor || '#73b8e5');

    const labelEl = document.getElementById('runtime-package-label');
    if (labelEl) {
        labelEl.textContent = identity.displayName || identity.packageName || 'AIGL';
    }

    const metaEl = document.getElementById('runtime-package-meta');
    if (metaEl) {
        metaEl.textContent = [
            identity.archetype || '',
            identity.versionTag ? `v${identity.versionTag}` : ''
        ].filter(Boolean).join(' · ');
    }
}
