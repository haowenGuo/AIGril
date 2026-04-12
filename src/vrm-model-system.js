import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createVRMAnimationClip, VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';

import { CONFIG } from './config.js';
import { normalizeCueIntensity } from './cue-utils.js';
import { buildMotionCatalogIndex, fetchMotionCatalog, selectMotionEntry } from './motion-catalog.js';


export class VRMModelSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        this.vrm = null;
        this.mixer = null;
        this.actionMap = {};
        this.currentAction = null;
        this.currentMotionEntry = null;
        this.motionCatalog = null;
        this.motionCatalogIndex = null;
        this.motionLoader = null;
        this.failedMotionIds = new Set();
        this.loadingMotionPromises = new Map();

        this.isModelLoaded = false;
        this.autoBlinkEnabled = true;
        this.nextBlinkTime = 0;
        this.blinkTimer = 0;

        // 口型状态：优先由真实音频驱动，兜底才用正弦波。
        this.isSpeaking = false;
        this.useExternalLipSync = false;
        this.speakTimeAccumulator = 0;
        this.externalLipSyncValue = 0;
        this.smoothedLipSyncValue = 0;

        this.activeExpressions = new Set();
        this.expressionResetTimer = null;
        this.animate = this.animate.bind(this);
    }

    isBlinkExpression(expressionName) {
        return ['blink', 'blinkLeft', 'blinkRight'].includes(expressionName);
    }

    hasActiveBlinkExpression() {
        for (const expressionName of this.activeExpressions) {
            if (this.isBlinkExpression(expressionName)) {
                return true;
            }
        }
        return false;
    }

    hasBlockingEmotionExpression() {
        for (const expressionName of this.activeExpressions) {
            if (
                expressionName !== 'aa' &&
                !this.isBlinkExpression(expressionName)
            ) {
                return true;
            }
        }
        return false;
    }

    getExpressionPresets() {
        return { ...CONFIG.EXPRESSION_PRESETS };
    }

    getExpressionPresetValue(expressionName) {
        return CONFIG.EXPRESSION_PRESETS[expressionName];
    }

    setExpressionPresetValue(expressionName, value) {
        if (!(expressionName in CONFIG.EXPRESSION_PRESETS)) {
            console.warn(`⚠️ 表情预设 "${expressionName}" 不存在，无法更新`);
            return;
        }

        CONFIG.EXPRESSION_PRESETS[expressionName] = THREE.MathUtils.clamp(value, 0, 1);
    }

    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ 画布容器不存在');
            return;
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f8ff);

        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.copy(CONFIG.CAMERA_POSITION);
        this.camera.lookAt(CONFIG.CAMERA_TARGET);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(CONFIG.RENDER_PIXEL_RATIO);
        container.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.copy(CONFIG.CAMERA_TARGET);
        this.controls.enablePan = false;
        this.controls.minDistance = CONFIG.CAMERA_MIN_DISTANCE;
        this.controls.maxDistance = CONFIG.CAMERA_MAX_DISTANCE;
        this.controls.minPolarAngle = Math.PI * 0.3;
        this.controls.maxPolarAngle = Math.PI * 0.7;
        this.controls.minAzimuthAngle = -Math.PI / 6;
        this.controls.maxAzimuthAngle = Math.PI / 6;

        this.initLight();
        window.addEventListener('resize', () => this.onWindowResize(container));
        this.animate();

        console.log('✅ 3D场景初始化完成');
    }

    initLight() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);

        directionalLight.position.set(5, 5, 5);
        this.scene.add(ambientLight);
        this.scene.add(directionalLight);
    }

    async loadModel() {
        try {
            console.log('⏳ 开始加载VRM模型...');
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));

            const gltf = await new Promise((resolve, reject) => {
                loader.load(
                    CONFIG.MODEL_PATH,
                    resolve,
                    (progress) => {
                        const percent = (progress.loaded / progress.total * 100).toFixed(2);
                        console.log(`模型加载中：${percent}%`);
                    },
                    reject
                );
            });

            this.vrm = gltf.userData.vrm;
            VRMUtils.rotateVRM0(this.vrm);
            this.vrm.scene.scale.set(1, 1, 1);
            this.scene.add(this.vrm.scene);

            this.initExpressionSystem();
            await this.loadMotionCatalog();
            this.isModelLoaded = true;
            await this.preloadInitialMotions();

            console.log('✅ VRM模型和动作全部加载完成！');
            console.log('📦 当前已加载的动作列表:', Object.keys(this.actionMap));
            window.dispatchEvent(new CustomEvent('modelLoaded'));
        } catch (error) {
            console.error('❌ 模型加载失败：', error);
            window.dispatchEvent(new CustomEvent('modelLoadError', { detail: error }));
        }
    }

    initExpressionSystem() {
        if (!this.vrm) return;
        console.log('✅ 可用表情列表:', this.vrm.expressionManager.expressions.map((item) => item.expressionName));
        this.resetExpression();
    }

    async loadMotionCatalog() {
        console.log('⏳ 开始加载动作目录...');

        this.mixer = new THREE.AnimationMixer(this.vrm.scene);
        this.motionLoader = new GLTFLoader();
        this.motionLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

        const catalog = await fetchMotionCatalog(CONFIG.MOTION_CATALOG_PATH);
        this.motionCatalog = catalog;
        this.motionCatalogIndex = buildMotionCatalogIndex(catalog, {
            includeDesktopOnly: CONFIG.IS_ELECTRON_SHELL
        });

        console.log(
            '📚 动作目录加载完成:',
            `${this.motionCatalogIndex.entries.length} entries`,
            `version=${this.motionCatalogIndex.meta.version}`
        );
    }

    async preloadInitialMotions() {
        const preloadEntries = this.motionCatalogIndex?.entries?.filter((entry) => entry.preload) || [];
        console.log(`⏳ 预加载 ${preloadEntries.length} 个基础动作...`);

        for (const entry of preloadEntries) {
            try {
                await this.ensureMotionLoaded(entry);
            } catch (error) {
                console.error(`❌ 预加载动作失败: ${entry.id}`, error);
            }
        }

        this.setupActionFinishListener();
        await this.playMotionCue({ category: 'idle', intensity: 'low', legacyAction: 'idle' });
        console.log('🎬 默认动作：IDLE 目录模式启动');
    }

    ensureMotionLoaded(entry) {
        if (!entry?.id) {
            return Promise.reject(new Error('动作目录项缺少 id'));
        }

        if (this.actionMap[entry.id]) {
            return Promise.resolve(this.actionMap[entry.id]);
        }

        const existingPromise = this.loadingMotionPromises.get(entry.id);
        if (existingPromise) {
            return existingPromise;
        }

        const loadPromise = new Promise((resolve, reject) => {
            this.motionLoader.load(
                entry.path,
                (gltf) => {
                    let vrmAnimation = gltf.userData.vrmAnimation;
                    if (!vrmAnimation && gltf.userData.vrmAnimations?.length > 0) {
                        vrmAnimation = gltf.userData.vrmAnimations[0];
                    }

                    let clip;
                    if (!vrmAnimation && gltf.animations?.length > 0) {
                        clip = gltf.animations[0];
                    } else if (vrmAnimation) {
                        clip = createVRMAnimationClip(vrmAnimation, this.vrm);
                    } else {
                        reject(new Error(`无法解析动作文件: ${entry.path}`));
                        return;
                    }

                    const action = this.mixer.clipAction(clip);
                    this.configureActionLoop(action, entry);
                    this.actionMap[entry.id] = action;
                    this.failedMotionIds.delete(entry.id);
                    resolve(action);
                },
                () => {},
                (error) => {
                    this.failedMotionIds.add(entry.id);
                    reject(error);
                }
            );
        }).finally(() => {
            this.loadingMotionPromises.delete(entry.id);
        });

        this.loadingMotionPromises.set(entry.id, loadPromise);
        return loadPromise;
    }

    configureActionLoop(action, entry) {
        const shouldLoop = Boolean(entry?.loop) || entry?.category === 'idle';
        if (shouldLoop) {
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            return;
        }

        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
    }

    setupActionFinishListener() {
        if (!this.mixer) return;

        this.mixer.addEventListener('finished', (event) => {
            const finishedAction = event.action;
            const finishedName = this.getActionNameByInstance(finishedAction);
            const finishedEntry = finishedName ? this.motionCatalogIndex?.byId?.get(finishedName) : null;
            const isIdleAction = finishedEntry?.category === 'idle';
            const isCurrentAction = finishedAction === this.currentAction;

            if (isIdleAction) {
                console.log(`🔄 IDLE动作(${finishedName})播放完毕，继续下一个IDLE`);
                return;
            }

            if (!isCurrentAction) {
                console.log(`⏭️ 忽略已结束的旧动作(${finishedName})，当前动作仍在播放`);
                return;
            }

            console.log(`🔄 交互动作(${finishedName})播放完毕，切回IDLE`);
            void this.playMotionCue({ category: 'idle', intensity: 'low', legacyAction: 'idle' });
        });
    }

    getActionNameByInstance(actionInstance) {
        return Object.keys(this.actionMap).find((name) => this.actionMap[name] === actionInstance);
    }

    async playMotionCue({ category = null, intensity = 'medium', legacyAction = null, motionId = null } = {}) {
        if (!this.isModelLoaded) {
            console.warn('⚠️ 模型未加载');
            return;
        }

        const entry = selectMotionEntry({
            catalogIndex: this.motionCatalogIndex,
            currentMotionId: this.currentMotionEntry?.id || null,
            requestedMotionId: motionId,
            category,
            intensity,
            legacyAction,
            failedMotionIds: this.failedMotionIds
        });

        if (!entry) {
            console.warn(`⚠️ 没有找到匹配动作: category=${category}, legacyAction=${legacyAction}, motionId=${motionId}`);
            return;
        }

        let nextAction;
        try {
            nextAction = await this.ensureMotionLoaded(entry);
        } catch (error) {
            console.error(`❌ 懒加载动作失败: ${entry.id}`, error);
            if (entry.category !== 'idle') {
                await this.playMotionCue({ category: 'idle', intensity: 'low', legacyAction: 'idle' });
            }
            return;
        }

        if (this.currentAction === nextAction) return;

        this.configureActionLoop(nextAction, entry);

        if (this.currentAction) {
            this.currentAction.enabled = true;
            nextAction.enabled = true;
            nextAction.reset();
            nextAction.time = 0;
            this.currentAction.crossFadeTo(nextAction, CONFIG.CROSS_FADE_DURATION, true);
            nextAction.play();
        } else {
            nextAction.reset();
            nextAction.play();
        }

        this.currentAction = nextAction;
        this.currentMotionEntry = entry;

        if (entry.category !== 'idle') {
            console.log(`🎬 播放动作: ${entry.id} (${entry.category}/${entry.intensity})`);
        }
    }

    playAction(actionName) {
        return this.playMotionCue({ legacyAction: actionName, category: actionName });
    }

    getExpressionIntensityMultiplier(intensity) {
        const normalizedIntensity = normalizeCueIntensity(intensity) || 'medium';
        if (normalizedIntensity === 'low') {
            return 0.78;
        }
        if (normalizedIntensity === 'high') {
            return 1.18;
        }
        return 1;
    }

    applyExpressionCue({ name, intensity = 'medium' } = {}) {
        this.applyExpressionPreset(name, intensity);
    }

    applyExpressionPreset(expressionName, intensity = 'medium') {
        if (expressionName === 'neutral') {
            this.resetExpression();
            return;
        }

        const presetValue = this.getExpressionPresetValue(expressionName);
        if (typeof presetValue !== 'number') {
            console.warn(`⚠️ 表情预设 "${expressionName}" 不存在`);
            return;
        }

        const adjustedValue = THREE.MathUtils.clamp(
            presetValue * this.getExpressionIntensityMultiplier(intensity),
            0,
            1
        );

        if (this.isBlinkExpression(expressionName)) {
            this.vrm.expressionManager.setValue('blink', 0);
            this.vrm.expressionManager.setValue('blinkLeft', 0);
            this.vrm.expressionManager.setValue('blinkRight', 0);
            this.activeExpressions.delete('blink');
            this.activeExpressions.delete('blinkLeft');
            this.activeExpressions.delete('blinkRight');
            this.blinkTimer = 0;
            this.nextBlinkTime = CONFIG.BLINK_MIN_INTERVAL +
                Math.random() * (CONFIG.BLINK_MAX_INTERVAL - CONFIG.BLINK_MIN_INTERVAL);
        }

        this.setExpression(expressionName, adjustedValue);
        this.scheduleNeutralReset(expressionName);
    }

    setExpression(expressionName, value) {
        if (!this.isModelLoaded || !this.vrm) return;
        this.clearExpressionValues({ preserveLipSync: this.isSpeaking });

        if (value > 0) {
            this.activeExpressions.add(expressionName);
        } else {
            this.activeExpressions.delete(expressionName);
        }

        this.vrm.expressionManager.setValue(expressionName, value);
    }

    clearExpressionValues({ preserveLipSync = false } = {}) {
        if (!this.isModelLoaded || !this.vrm) return;

        if (this.expressionResetTimer) {
            clearTimeout(this.expressionResetTimer);
            this.expressionResetTimer = null;
        }

        const nextActiveExpressions = new Set();
        this.activeExpressions.forEach((expressionName) => {
            if (preserveLipSync && expressionName === 'aa') {
                nextActiveExpressions.add('aa');
                return;
            }
            this.vrm.expressionManager.setValue(expressionName, 0);
        });

        this.activeExpressions = nextActiveExpressions;

        if (!preserveLipSync) {
            this.vrm.expressionManager.setValue('aa', 0);
        }

        this.vrm.expressionManager.setValue('neutral', this.getExpressionPresetValue('neutral') ?? 0);
    }

    resetExpression() {
        this.clearExpressionValues({ preserveLipSync: this.isSpeaking });
    }

    scheduleNeutralReset(expressionName) {
        if (!this.isModelLoaded || !this.vrm) return;
        if (!expressionName || expressionName === 'neutral') return;

        if (this.expressionResetTimer) {
            clearTimeout(this.expressionResetTimer);
        }

        this.expressionResetTimer = setTimeout(() => {
            this.resetExpression();
        }, this.isBlinkExpression(expressionName) ? CONFIG.BLINK_EXPRESSION_HOLD_MS : CONFIG.EXPRESSION_HOLD_MS);
    }

    startAudioDrivenSpeech() {
        if (!this.isModelLoaded) return;
        this.isSpeaking = true;
        this.useExternalLipSync = true;
        this.externalLipSyncValue = 0;
    }

    startFallbackSpeech() {
        if (!this.isModelLoaded) return;
        this.isSpeaking = true;
        this.useExternalLipSync = false;
        this.speakTimeAccumulator = 0;
    }

    setLipSyncValue(value) {
        if (!this.isModelLoaded) return;
        this.isSpeaking = true;
        this.useExternalLipSync = true;
        this.externalLipSyncValue = THREE.MathUtils.clamp(value, 0, CONFIG.MAX_MOUTH_OPEN);
    }

    stopSpeaking() {
        if (!this.isModelLoaded || !this.vrm) return;
        this.isSpeaking = false;
        this.useExternalLipSync = false;
        this.externalLipSyncValue = 0;
        this.smoothedLipSyncValue = 0;
        this.vrm.expressionManager.setValue('aa', 0);
        this.activeExpressions.delete('aa');
    }

    triggerBlink() {
        if (!this.isModelLoaded || !this.autoBlinkEnabled) return;
        if (this.hasBlockingEmotionExpression()) return;
        if (this.hasActiveBlinkExpression()) return;

        this.vrm.expressionManager.setValue('blink', this.getExpressionPresetValue('blink') ?? 0.8);
        this.activeExpressions.add('blink');

        setTimeout(() => {
            if (!this.vrm) return;
            this.vrm.expressionManager.setValue('blink', 0);
            this.activeExpressions.delete('blink');
        }, 150);
    }

    onWindowResize(container) {
        if (!this.camera || !this.renderer || !this.composer) return;

        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.composer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);
        const deltaTime = this.clock.getDelta();

        if (this.vrm) this.vrm.update(deltaTime);
        if (this.mixer) this.mixer.update(deltaTime);

        this.updateAutoBlink(deltaTime);
        this.updateSpeaking(deltaTime);

        this.controls.update();
        this.composer.render();
    }

    updateAutoBlink(deltaTime) {
        if (!this.autoBlinkEnabled || !this.isModelLoaded) return;
        if (this.hasBlockingEmotionExpression()) return;
        if (this.hasActiveBlinkExpression()) return;

        this.blinkTimer += deltaTime * 1000;
        if (this.blinkTimer >= this.nextBlinkTime) {
            this.triggerBlink();
            this.blinkTimer = 0;
            this.nextBlinkTime = CONFIG.BLINK_MIN_INTERVAL +
                Math.random() * (CONFIG.BLINK_MAX_INTERVAL - CONFIG.BLINK_MIN_INTERVAL);
        }
    }

    updateSpeaking(deltaTime) {
        if (!this.isModelLoaded || !this.vrm) return;

        let targetLipSyncValue = 0;
        if (this.isSpeaking) {
            if (this.useExternalLipSync) {
                targetLipSyncValue = this.externalLipSyncValue;
            } else {
                this.speakTimeAccumulator += deltaTime;
                targetLipSyncValue =
                    Math.abs(Math.sin(this.speakTimeAccumulator * CONFIG.SPEAK_SPEED)) * CONFIG.SPEAK_AMPLITUDE;
            }
        }

        this.smoothedLipSyncValue = THREE.MathUtils.lerp(
            this.smoothedLipSyncValue,
            targetLipSyncValue,
            CONFIG.LIP_SYNC_SMOOTHING
        );

        this.applyLipSyncValue(this.smoothedLipSyncValue);
    }

    applyLipSyncValue(value) {
        if (!this.vrm) return;

        const safeValue = THREE.MathUtils.clamp(value, 0, CONFIG.MAX_MOUTH_OPEN);
        this.vrm.expressionManager.setValue('aa', safeValue);

        if (safeValue > 0.02) {
            this.activeExpressions.add('aa');
        } else {
            this.activeExpressions.delete('aa');
        }
    }
}
