const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus']);
const LYRICS_EXTENSIONS = new Set(['.lrc', '.txt', '.vtt', '.srt', '.ass']);
const SCORE_EXTENSIONS = new Set(['.musicxml', '.mxl', '.mei', '.abc', '.krn', '.ly', '.mid', '.midi']);
const MOTION_EXTENSIONS = new Set(['.vrma', '.fbx', '.glb', '.gltf', '.vmd']);
const TEXT_LYRIC_HINTS = ['lyric', 'lyrics', '歌词', 'lrc', 'subtitle', 'subtitles', 'caption', 'captions'];
const TEXT_SKIP_HINTS = ['license', 'readme', 'notice', 'credit', 'credits', 'attribution'];
const SAFE_NAME_RE = /[^A-Za-z0-9._-]+/g;
const ROLE_TOKEN_RE = /(?:^|[\s._\-()[\]【】]+)(?:instrumental|伴奏|karaoke|backing|accompaniment|inst|offvocal|off-vocal|lyrics|歌词|lrc|vocal|lead|acapella|score|sheet|midi|musicxml)(?:$|[\s._\-()[\]【】]+)/gi;

const MOTION_CATEGORY_RULES = [
    ['dance', ['dance', '舞', 'hiphop', 'hip-hop', 'macarena']],
    ['idle', ['idle', 'stand', 'relax']],
    ['walk', ['walk', 'stroll']],
    ['run', ['run', 'sprint', 'jog']],
    ['fight', ['fight', 'kick', 'punch', 'combat']],
    ['sports', ['sport', 'golf', 'baseball', 'basketball', 'pingpong', 'swim']],
    ['superhero', ['hero', 'superhero', 'magic', 'flying']],
    ['zombie', ['zombie', 'undead', 'dead']]
];

function nowIso() {
    return new Date().toISOString();
}

function createEmptyPlatformState() {
    return {
        version: 1,
        updatedAt: null,
        importedAssets: [],
        importedWorks: [],
        performances: [],
        activePerformanceId: ''
    };
}

function createEmptyPackageRegistry() {
    return {
        version: 1,
        updatedAt: null,
        activePackageId: '',
        packages: []
    };
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function safeName(value, fallback) {
    const cleaned = String(value || '').replace(SAFE_NAME_RE, '_').replace(/^[._]+|[._]+$/g, '');
    return (cleaned || fallback).slice(0, 180);
}

function slugify(value, fallback) {
    return safeName(String(value || '').toLowerCase(), fallback).replace(/\./g, '-');
}

function normalizeText(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isAbsoluteFilePath(filePath) {
    return typeof filePath === 'string' && path.isAbsolute(filePath);
}

function getPlatformPaths(app) {
    const root = path.join(app.getPath('userData'), 'resource-platform');
    return {
        root,
        assetsRoot: path.join(root, 'assets'),
        statePath: path.join(root, 'workspace.json'),
        packageRegistryPath: path.join(root, 'runtime-packages.json')
    };
}

function readJsonSafe(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function loadPlatformState(app) {
    const paths = getPlatformPaths(app);
    ensureDir(paths.root);
    ensureDir(paths.assetsRoot);

    if (!fs.existsSync(paths.statePath)) {
        const initialState = createEmptyPlatformState();
        fs.writeFileSync(paths.statePath, JSON.stringify(initialState, null, 2), 'utf8');
        return initialState;
    }

    const loaded = readJsonSafe(paths.statePath, createEmptyPlatformState());
    return {
        ...createEmptyPlatformState(),
        ...loaded,
        importedAssets: Array.isArray(loaded.importedAssets) ? loaded.importedAssets : [],
        importedWorks: Array.isArray(loaded.importedWorks) ? loaded.importedWorks : [],
        performances: Array.isArray(loaded.performances) ? loaded.performances : []
    };
}

function savePlatformState(app, state) {
    const paths = getPlatformPaths(app);
    ensureDir(paths.root);
    const nextState = {
        ...createEmptyPlatformState(),
        ...state,
        updatedAt: nowIso(),
        importedAssets: Array.isArray(state.importedAssets) ? state.importedAssets : [],
        importedWorks: Array.isArray(state.importedWorks) ? state.importedWorks : [],
        performances: Array.isArray(state.performances) ? state.performances : []
    };
    fs.writeFileSync(paths.statePath, JSON.stringify(nextState, null, 2), 'utf8');
    return nextState;
}

function loadPackageRegistry(app) {
    const paths = getPlatformPaths(app);
    ensureDir(paths.root);

    if (!fs.existsSync(paths.packageRegistryPath)) {
        const initialRegistry = createEmptyPackageRegistry();
        fs.writeFileSync(paths.packageRegistryPath, JSON.stringify(initialRegistry, null, 2), 'utf8');
        return initialRegistry;
    }

    const loaded = readJsonSafe(paths.packageRegistryPath, createEmptyPackageRegistry());
    return {
        ...createEmptyPackageRegistry(),
        ...loaded,
        packages: Array.isArray(loaded.packages) ? loaded.packages : []
    };
}

function savePackageRegistry(app, registry) {
    const paths = getPlatformPaths(app);
    ensureDir(paths.root);
    const nextRegistry = {
        ...createEmptyPackageRegistry(),
        ...registry,
        updatedAt: nowIso(),
        packages: Array.isArray(registry.packages) ? registry.packages : []
    };
    fs.writeFileSync(paths.packageRegistryPath, JSON.stringify(nextRegistry, null, 2), 'utf8');
    return nextRegistry;
}

function loadSidecar(sourcePath) {
    const parsed = path.parse(sourcePath);
    const sidecarPath = path.join(parsed.dir, `${parsed.name}.meta.json`);
    if (!fs.existsSync(sidecarPath)) {
        return {};
    }

    return readJsonSafe(sidecarPath, {});
}

function detectKind(sourcePath, metadata) {
    const ext = path.extname(sourcePath).toLowerCase();
    if (AUDIO_EXTENSIONS.has(ext)) {
        return 'audio';
    }
    if (ext !== '.txt' && LYRICS_EXTENSIONS.has(ext)) {
        return 'lyrics';
    }
    if (ext === '.txt') {
        const lowered = sourcePath.toLowerCase();
        if (TEXT_SKIP_HINTS.some((token) => lowered.includes(token))) {
            return null;
        }
        if (
            String(metadata.role || '').toLowerCase() === 'lyrics' ||
            TEXT_LYRIC_HINTS.some((token) => lowered.includes(token))
        ) {
            return 'lyrics';
        }
        return null;
    }
    if (SCORE_EXTENSIONS.has(ext)) {
        return 'score';
    }
    if (MOTION_EXTENSIONS.has(ext)) {
        return 'motion';
    }
    return null;
}

function inferRole(kind, sourcePath, metadata) {
    if (metadata.role) {
        return String(metadata.role).trim().toLowerCase();
    }

    const lowered = sourcePath.toLowerCase();
    if (kind === 'audio') {
        if (/(伴奏|instrumental|karaoke|backing|accompaniment|offvocal|off-vocal|inst)/i.test(lowered)) {
            return 'accompaniment';
        }
        if (/(vocal|lead|acapella)/i.test(lowered)) {
            return 'voice';
        }
        return 'song';
    }
    if (kind === 'lyrics') {
        return 'lyrics';
    }
    if (kind === 'score') {
        return 'score';
    }
    if (kind === 'motion') {
        return 'motion';
    }
    return kind;
}

function inferMotionCategory(sourcePath, metadata) {
    if (metadata.motion_category) {
        return String(metadata.motion_category).trim().toLowerCase();
    }

    const lowered = path.parse(sourcePath).name.toLowerCase();
    for (const [category, tokens] of MOTION_CATEGORY_RULES) {
        if (tokens.some((token) => lowered.includes(token))) {
            return category;
        }
    }
    return 'general';
}

function inferGroupId(sourcePath, kind, metadata) {
    if (metadata.group_id) {
        return slugify(metadata.group_id, 'group');
    }

    let stem = normalizeText(path.parse(sourcePath).name);
    stem = stem.replace(ROLE_TOKEN_RE, ' ').replace(/\s+/g, ' ').trim();

    if (kind === 'motion' && metadata.motion_category) {
        stem = `${stem} ${metadata.motion_category}`.trim();
    }

    return slugify(stem || path.parse(sourcePath).name, 'group');
}

function inferTitle(sourcePath, metadata) {
    if (metadata.title) {
        return String(metadata.title).trim();
    }
    if (metadata.work_title) {
        return String(metadata.work_title).trim();
    }

    let stem = normalizeText(path.parse(sourcePath).name);
    stem = stem.replace(ROLE_TOKEN_RE, ' ').replace(/\s+/g, ' ').trim();
    return stem || path.parse(sourcePath).name;
}

function computeSha256(sourcePath) {
    const hash = crypto.createHash('sha256');
    const buffer = fs.readFileSync(sourcePath);
    hash.update(buffer);
    return hash.digest('hex');
}

function inferTags(kind, metadata) {
    const tags = new Set(['authorized', 'desktop-import', kind]);
    if (Array.isArray(metadata.tags)) {
        metadata.tags
            .map((tag) => String(tag || '').trim())
            .filter(Boolean)
            .forEach((tag) => tags.add(tag));
    }
    return Array.from(tags);
}

function buildTargetPath(assetsRoot, kind, role, sourcePath, sha256) {
    const parsed = path.parse(sourcePath);
    const fileName = safeName(parsed.base, `asset${parsed.ext.toLowerCase()}`);
    const targetDir = path.join(assetsRoot, 'authorized', kind, role);
    ensureDir(targetDir);
    const targetPath = path.join(targetDir, fileName);

    if (!fs.existsSync(targetPath)) {
        return targetPath;
    }

    const existingDigest = computeSha256(targetPath);
    if (existingDigest === sha256) {
        return targetPath;
    }

    return path.join(targetDir, `${safeName(parsed.name, 'asset')}_${sha256.slice(0, 8)}${parsed.ext.toLowerCase()}`);
}

function buildImportedWorks(importedAssets) {
    const groups = new Map();

    for (const asset of importedAssets) {
        const groupId = asset.group_id || 'ungrouped';
        if (!groups.has(groupId)) {
            groups.set(groupId, {
                id: groupId,
                title: asset.metadata?.work_title || asset.title || normalizeText(groupId),
                artist: asset.artist || '',
                storage: 'desktop',
                tags: new Set(),
                assets: {
                    audio: [],
                    lyrics: [],
                    scores: [],
                    motions: []
                }
            });
        }

        const group = groups.get(groupId);
        if (asset.artist && !group.artist) {
            group.artist = asset.artist;
        }

        for (const tag of asset.tags || []) {
            if (tag) {
                group.tags.add(tag);
            }
        }

        const assetRecord = {
            id: asset.asset_id,
            title: asset.title,
            role: asset.role,
            kind: asset.kind,
            ext: asset.ext,
            path: asset.imported_path,
            storage: 'desktop',
            size: asset.size,
            sha256: asset.sha256,
            metadata: asset.metadata || {}
        };

        if (asset.kind === 'audio') {
            group.assets.audio.push(assetRecord);
        } else if (asset.kind === 'lyrics') {
            group.assets.lyrics.push(assetRecord);
        } else if (asset.kind === 'score') {
            group.assets.scores.push(assetRecord);
        } else if (asset.kind === 'motion') {
            group.assets.motions.push(assetRecord);
        }
    }

    return Array.from(groups.values())
        .map((group) => {
            const tags = Array.from(group.tags).sort();
            return {
                id: group.id,
                title: group.title,
                artist: group.artist,
                storage: group.storage,
                tags,
                assets: group.assets,
                searchText: [
                    group.title,
                    group.artist,
                    tags.join(' '),
                    Object.values(group.assets)
                        .flat()
                        .map((asset) => asset.title)
                        .join(' ')
                ].join(' ').trim()
            };
        })
        .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
}

function importAssets(app, filePaths) {
    const paths = getPlatformPaths(app);
    const state = loadPlatformState(app);
    const importedAssets = [...state.importedAssets];
    const skipped = [];
    let importedCount = 0;

    for (const sourcePath of filePaths || []) {
        if (!isAbsoluteFilePath(sourcePath) || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
            skipped.push({ path: sourcePath, reason: 'invalid-file' });
            continue;
        }

        const metadata = loadSidecar(sourcePath);
        const kind = detectKind(sourcePath, metadata);
        if (!kind) {
            skipped.push({ path: sourcePath, reason: 'unsupported-kind' });
            continue;
        }

        const role = inferRole(kind, sourcePath, metadata);
        const sha256 = computeSha256(sourcePath);
        const targetPath = buildTargetPath(paths.assetsRoot, kind, role, sourcePath, sha256);

        if (!fs.existsSync(targetPath)) {
            fs.copyFileSync(sourcePath, targetPath);
        }

        const title = inferTitle(sourcePath, metadata);
        const groupId = inferGroupId(sourcePath, kind, metadata);
        const assetId = `${groupId}-${kind}-${role}-${slugify(title, 'asset')}-${sha256.slice(0, 8)}`;
        const tags = inferTags(kind, metadata);
        const ext = path.extname(sourcePath).toLowerCase();
        const nextMetadata = { ...metadata };

        if (kind === 'motion' && !nextMetadata.motion_category) {
            nextMetadata.motion_category = inferMotionCategory(sourcePath, metadata);
        }

        const nextAsset = {
            asset_id: assetId,
            group_id: groupId,
            title,
            artist: String(metadata.artist || '').trim(),
            kind,
            role,
            ext,
            original_path: sourcePath,
            imported_path: targetPath,
            imported_at: nowIso(),
            size: fs.statSync(targetPath).size,
            sha256,
            tags,
            metadata: nextMetadata
        };

        const existingIndex = importedAssets.findIndex((item) => item.asset_id === assetId);
        if (existingIndex >= 0) {
            importedAssets[existingIndex] = nextAsset;
        } else {
            importedAssets.push(nextAsset);
        }
        importedCount += 1;
    }

    const nextState = savePlatformState(app, {
        ...state,
        importedAssets,
        importedWorks: buildImportedWorks(importedAssets)
    });

    return {
        importedCount,
        skipped,
        state: nextState
    };
}

function validateReadableAssetPath(assetPath) {
    if (!isAbsoluteFilePath(assetPath)) {
        throw new Error('只能读取桌面资源平台导入的本地绝对路径');
    }
    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
        throw new Error('资源文件不存在');
    }
}

function readAssetText(assetPath, maxChars = 2400) {
    validateReadableAssetPath(assetPath);
    const content = fs.readFileSync(assetPath, 'utf8');
    if (content.length <= maxChars) {
        return content;
    }
    return `${content.slice(0, maxChars)}\n...`;
}

function resolveAssetUrl(assetPath) {
    validateReadableAssetPath(assetPath);
    return pathToFileURL(assetPath).toString();
}

module.exports = {
    createEmptyPackageRegistry,
    createEmptyPlatformState,
    getPlatformPaths,
    importAssets,
    loadPackageRegistry,
    loadPlatformState,
    readAssetText,
    resolveAssetUrl,
    savePackageRegistry,
    savePlatformState
};
