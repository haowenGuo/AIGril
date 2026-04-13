import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distRoot = resolve(projectRoot, 'dist');
const runtimeVrmDir = resolve(projectRoot, 'Resources', 'VRMA_MotionPack', 'vrma');
const includeHarvestedMotions = process.env.AIGRIL_INCLUDE_HARVESTED_MOTIONS === '1';
const includeAuthorizedLibrary = process.env.AIGRIL_INCLUDE_AUTHORIZED_LIBRARY === '1';

const runtimeAnimationFiles = [
    'Angry.vrma',
    'Blush.vrma',
    'Clapping.vrma',
    'Goodbye.vrma',
    'Idle.vrma',
    'Idle1.vrma',
    'Idle2.vrma',
    'Jump.vrma',
    'LookAround.vrma',
    'Sad.vrma',
    'Sleepy.vrma',
    'Surprised.vrma',
    'Thinking.vrma',
    'VRMA_17.vrma',
    'VRMA_25.vrma'
];

const assetsToCopy = [
    {
        source: resolve(projectRoot, 'Resources', 'AiGril.vrm'),
        target: resolve(distRoot, 'Resources', 'AiGril.vrm'),
        overwrite: false
    },
    {
        source: resolve(projectRoot, 'Resources', 'motion-catalog.json'),
        target: resolve(distRoot, 'Resources', 'motion-catalog.json'),
        overwrite: true
    },
    {
        source: resolve(projectRoot, 'Resources', 'resource-library.json'),
        target: resolve(distRoot, 'Resources', 'resource-library.json'),
        overwrite: true
    }
];

for (const fileName of runtimeAnimationFiles) {
    assetsToCopy.push({
        source: resolve(runtimeVrmDir, fileName),
        target: resolve(distRoot, 'Resources', 'VRMA_MotionPack', 'vrma', fileName),
        overwrite: false
    });
}

if (includeHarvestedMotions) {
    assetsToCopy.push({
        source: resolve(projectRoot, 'Resources', 'harvested', 'motions', 'vrma'),
        target: resolve(distRoot, 'Resources', 'harvested', 'motions', 'vrma'),
        overwrite: true
    });
}

if (includeAuthorizedLibrary) {
    assetsToCopy.push({
        source: resolve(projectRoot, 'Resources', 'library'),
        target: resolve(distRoot, 'Resources', 'library'),
        overwrite: true
    });
}

for (const asset of assetsToCopy) {
    if (!existsSync(asset.source)) {
        console.warn(`[build] skipped missing asset: ${asset.source}`);
        continue;
    }

    if (existsSync(asset.target) && !asset.overwrite) {
        console.log(`[build] kept existing asset: ${asset.target}`);
        continue;
    }

    mkdirSync(dirname(asset.target), { recursive: true });
    try {
        cpSync(asset.source, asset.target, { recursive: true, force: asset.overwrite });
        console.log(`[build] copied: ${asset.source} -> ${asset.target}`);
    } catch (error) {
        console.warn(`[build] skipped asset copy due to ${error.code || error.name}: ${asset.target}`);
    }
}
