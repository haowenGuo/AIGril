import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distRoot = resolve(projectRoot, 'dist');
const runtimeVrmDir = resolve(projectRoot, 'Resources', 'VRMA_MotionPack', 'vrma');

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
    'VRMA_01.vrma',
    'VRMA_02.vrma',
    'VRMA_10.vrma',
    'VRMA_11.vrma',
    'VRMA_12.vrma',
    'VRMA_13.vrma',
    'VRMA_14.vrma',
    'VRMA_15.vrma',
    'VRMA_16.vrma',
    'VRMA_17.vrma',
    'VRMA_18.vrma',
    'VRMA_19.vrma',
    'VRMA_20.vrma',
    'VRMA_21.vrma',
    'VRMA_22.vrma',
    'VRMA_23.vrma',
    'VRMA_24.vrma',
    'VRMA_25.vrma',
    'VRMA_26.vrma',
    'VRMA_27.vrma',
    'VRMA_28.vrma',
    'VRMA_29.vrma',
    'VRMA_30.vrma',
    'VRMA_31.vrma'
];

// 只复制前端实际会访问到的 VRM 与 VRMA 资源，避免把无关的大文件一起打进 Pages 产物。
const assetsToCopy = [
    {
        source: resolve(projectRoot, 'Resources', 'AiGril.vrm'),
        target: resolve(distRoot, 'Resources', 'AiGril.vrm')
    }
];

for (const fileName of runtimeAnimationFiles) {
    assetsToCopy.push({
        source: resolve(runtimeVrmDir, fileName),
        target: resolve(distRoot, 'Resources', 'VRMA_MotionPack', 'vrma', fileName)
    });
}

for (const asset of assetsToCopy) {
    if (!existsSync(asset.source)) {
        console.warn(`[build] skipped missing asset: ${asset.source}`);
        continue;
    }

    if (existsSync(asset.target)) {
        console.log(`[build] kept existing asset: ${asset.target}`);
        continue;
    }

    mkdirSync(dirname(asset.target), { recursive: true });
    try {
        cpSync(asset.source, asset.target, { recursive: true });
        console.log(`[build] copied: ${asset.source} -> ${asset.target}`);
    } catch (error) {
        console.warn(`[build] skipped asset copy due to ${error.code || error.name}: ${asset.target}`);
    }
}
