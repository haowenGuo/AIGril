import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
} from "@pixiv/three-vrm-animation";

const AVATAR_CONFIG = {
  modelPath: "/static/edu/avatar/AiGril.vrm",
  animations: [
    { name: "idle", path: "/static/edu/avatar/motions/Idle.vrma", loop: true },
    { name: "idle1", path: "/static/edu/avatar/motions/Idle1.vrma", loop: true },
    { name: "idle2", path: "/static/edu/avatar/motions/Idle2.vrma", loop: true },
    { name: "thinking", path: "/static/edu/avatar/motions/Thinking.vrma", loop: false },
    { name: "clapping", path: "/static/edu/avatar/motions/Clapping.vrma", loop: false },
    { name: "lookAround", path: "/static/edu/avatar/motions/LookAround.vrma", loop: false },
    { name: "goodbye", path: "/static/edu/avatar/motions/Goodbye.vrma", loop: false },
  ],
  idleActions: ["idle", "idle1", "idle2"],
  crossFadeSeconds: 0.35,
  blinkMinMs: 2200,
  blinkMaxMs: 5200,
  speakSpeed: 11,
  speakAmplitude: 0.56,
};

class ClassroomAvatarTeacher {
  constructor(container) {
    this.container = container;
    this.statusNode = document.querySelector("[data-avatar-status]");
    this.actionMap = new Map();
    this.clock = new THREE.Clock();
    this.currentAction = null;
    this.vrm = null;
    this.mixer = null;
    this.loaded = false;
    this.speaking = false;
    this.speakTime = 0;
    this.nextBlinkMs = this.randomBlinkDelay();
    this.blinkTimerMs = 0;
    this.rafId = null;
    this.resizeObserver = null;
    this.animate = this.animate.bind(this);
  }

  async init() {
    this.setStatus("AI 教师模型加载中...");

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
    this.camera.position.set(0, 1.22, 1.42);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute("aria-label", "AI 教师 3D 人物模型");
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableRotate = false;
    this.controls.target.set(0, 1.06, 0);

    this.addLights();
    this.observeResize();
    await this.loadModel();
    await this.loadAnimations();
    this.bindClassroomEvents();
    this.playAction("idle");
    this.loaded = true;
    this.container.classList.add("is-loaded");
    this.setStatus("AI 教师已就位");
    this.animate();
  }

  addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.1));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(2.4, 3.2, 2.8);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe9fff5, 1.1);
    fillLight.position.set(-2, 1.8, 1.5);
    this.scene.add(fillLight);
  }

  observeResize() {
    const resize = () => {
      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    };

    resize();
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.container);
  }

  async loadModel() {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await this.loadWith(loader, AVATAR_CONFIG.modelPath);
    this.vrm = gltf.userData.vrm;
    VRMUtils.rotateVRM0(this.vrm);
    this.vrm.scene.rotation.y = -0.08;
    this.vrm.scene.position.set(0, -0.04, 0);
    this.scene.add(this.vrm.scene);

    this.resetExpression();
  }

  async loadAnimations() {
    this.mixer = new THREE.AnimationMixer(this.vrm.scene);
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    await Promise.allSettled(
      AVATAR_CONFIG.animations.map(async (item) => {
        const gltf = await this.loadWith(loader, item.path);
        const vrmAnimation =
          gltf.userData.vrmAnimation || gltf.userData.vrmAnimations?.[0];
        const clip = vrmAnimation
          ? createVRMAnimationClip(vrmAnimation, this.vrm)
          : gltf.animations?.[0];

        if (!clip) {
          throw new Error(`无法解析动作文件：${item.name}`);
        }

        const action = this.mixer.clipAction(clip);
        action.setLoop(item.loop ? THREE.LoopRepeat : THREE.LoopOnce, item.loop ? Infinity : 1);
        action.clampWhenFinished = !item.loop;
        this.actionMap.set(item.name, action);
      }),
    );

    this.mixer.addEventListener("finished", (event) => {
      if (event.action === this.currentAction && !this.speaking) {
        this.playAction("idle");
      }
    });
  }

  loadWith(loader, path) {
    return new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, reject);
    });
  }

  bindClassroomEvents() {
    window.addEventListener("simclass:teacher-speaking-start", () => {
      this.startSpeaking();
    });

    window.addEventListener("simclass:teacher-speaking-end", () => {
      this.stopSpeaking();
    });

    document.querySelectorAll(".blackboard-choice input").forEach((input) => {
      input.addEventListener("change", () => this.playAction("thinking"));
    });

    document.querySelectorAll(".blackboard-question-form").forEach((form) => {
      form.addEventListener("submit", () => this.playAction("clapping"));
    });
  }

  playAction(name) {
    if (!this.mixer || this.actionMap.size === 0) return;

    const targetName = name === "idle" ? this.pickIdleAction() : name;
    const nextAction = this.actionMap.get(targetName) || this.actionMap.get("idle");
    if (!nextAction || nextAction === this.currentAction) return;

    nextAction.enabled = true;
    nextAction.reset();
    nextAction.play();

    if (this.currentAction) {
      this.currentAction.crossFadeTo(nextAction, AVATAR_CONFIG.crossFadeSeconds, true);
    }

    this.currentAction = nextAction;
  }

  pickIdleAction() {
    const available = AVATAR_CONFIG.idleActions.filter((name) =>
      this.actionMap.has(name),
    );
    if (available.length === 0) return "idle";
    return available[Math.floor(Math.random() * available.length)];
  }

  startSpeaking() {
    this.speaking = true;
    this.speakTime = 0;
    this.playAction("thinking");
    this.setStatus("AI 教师正在讲解");
  }

  stopSpeaking() {
    this.speaking = false;
    this.setMouth(0);
    this.resetExpression();
    this.playAction("idle");
    this.setStatus("AI 教师等待互动");
  }

  resetExpression() {
    if (!this.vrm?.expressionManager) return;
    ["aa", "ih", "ou", "ee", "oh", "blink", "happy", "relaxed"].forEach((name) => {
      this.vrm.expressionManager.setValue(name, 0);
    });
    this.vrm.expressionManager.setValue("neutral", 0.18);
  }

  setMouth(value) {
    if (!this.vrm?.expressionManager) return;
    this.vrm.expressionManager.setValue("aa", THREE.MathUtils.clamp(value, 0, 0.92));
  }

  updateSpeaking(delta) {
    if (!this.speaking) {
      this.setMouth(0);
      return;
    }

    this.speakTime += delta;
    const mouth =
      Math.abs(Math.sin(this.speakTime * AVATAR_CONFIG.speakSpeed)) *
      AVATAR_CONFIG.speakAmplitude;
    this.setMouth(mouth);
    this.vrm.expressionManager?.setValue("happy", 0.22);
  }

  updateBlink(delta) {
    this.blinkTimerMs += delta * 1000;
    if (this.blinkTimerMs < this.nextBlinkMs || !this.vrm?.expressionManager) return;

    this.vrm.expressionManager.setValue("blink", 1);
    window.setTimeout(() => {
      this.vrm?.expressionManager?.setValue("blink", 0);
    }, 130);
    this.blinkTimerMs = 0;
    this.nextBlinkMs = this.randomBlinkDelay();
  }

  randomBlinkDelay() {
    return (
      AVATAR_CONFIG.blinkMinMs +
      Math.random() * (AVATAR_CONFIG.blinkMaxMs - AVATAR_CONFIG.blinkMinMs)
    );
  }

  animate() {
    this.rafId = window.requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    this.vrm?.update(delta);
    this.mixer?.update(delta);
    this.updateBlink(delta);
    this.updateSpeaking(delta);
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }

  setStatus(text) {
    if (this.statusNode) {
      this.statusNode.textContent = text;
    }
  }

  destroy() {
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver?.disconnect();
    this.mixer?.stopAllAction();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
    this.actionMap.clear();
    this.vrm = null;
    this.loaded = false;
  }
}

async function bootAvatarTeacher() {
  const container = document.querySelector("[data-avatar-teacher]");
  if (!container) return;
  if (container.dataset.avatarMounted === "true") return;

  try {
    window.simClassAvatarTeacher?.destroy?.();
    container.dataset.avatarMounted = "true";
    const teacher = new ClassroomAvatarTeacher(container);
    window.simClassAvatarTeacher = teacher;
    await teacher.init();
  } catch (error) {
    console.error("AI 教师模型加载失败", error);
    const statusNode = document.querySelector("[data-avatar-status]");
    if (statusNode) {
      statusNode.textContent = "AI 教师模型加载失败，请检查 VRM 资源";
    }
  }
}

window.bootSimClassAvatarTeacher = bootAvatarTeacher;
window.addEventListener("simclass:rendered", bootAvatarTeacher);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAvatarTeacher);
} else {
  bootAvatarTeacher();
}
