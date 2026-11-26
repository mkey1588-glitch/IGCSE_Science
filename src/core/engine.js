import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tweens } from './util.js';

export const QUALITY = {
  low: { pr: 1, samples: 0, bloom: false, shadows: false, shadowSize: 1024 },
  medium: { pr: 1.25, samples: 2, bloom: true, shadows: true, shadowSize: 1024 },
  high: { pr: 2, samples: 4, bloom: true, shadows: true, shadowSize: 2048 },
};

/**
 * Owns the single WebGL renderer, the post-processing chain and the main loop.
 * A "view" is any object with { scene, camera, update(dt,t), resize(w,h), bloom?, labels? }.
 */
export class Engine {
  constructor(container) {
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement);
    this.canvas = r.domElement;
    this.canvas.tabIndex = 0;

    const pmrem = new THREE.PMREMGenerator(r);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.views = [];
    this.labelLayers = [];
    this.view = null;
    this.time = 0;
    this._last = performance.now();
    this.fps = 60;
    this.setQuality('high');
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  register(view) { this.views.push(view); view.resize?.(innerWidth, innerHeight); }

  createLabelLayer() {
    const lr = new CSS2DRenderer();
    lr.domElement.className = 'label-layer';
    lr.domElement.style.display = 'none';
    this.container.appendChild(lr.domElement);
    lr.setSize(innerWidth, innerHeight);
    this.labelLayers.push(lr);
    return lr;
  }

  setQuality(q) {
    this.quality = QUALITY[q] ? q : 'high';
    const Q = QUALITY[this.quality];
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
    r.shadowMap.enabled = Q.shadows;
    r.shadowMap.needsUpdate = true;
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); }
    const w = innerWidth, h = innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: Q.samples });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.outlinePass = new OutlinePass(new THREE.Vector2(w, h), this.renderPass.scene, this.renderPass.camera);
    Object.assign(this.outlinePass, { edgeStrength: 4, edgeGlow: 0.6, edgeThickness: 1.6, pulsePeriod: 0 });
    this.outlinePass.visibleEdgeColor.set('#7ff7df');
    this.outlinePass.hiddenEdgeColor.set('#1d5d55');
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.55, 0.9);
    this.bloomPass.enabled = Q.bloom;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.outlinePass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    r.setSize(w, h);
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.setSize(w, h);
    for (const v of this.views) v.onQuality?.(Q);
    if (this.view) this.setView(this.view);
  }

  setView(view) {
    if (this.view && this.view.labels && this.view !== view) this.view.labels.domElement.style.display = 'none';
    this.view = view;
    this.renderPass.scene = view.scene;
    this.renderPass.camera = view.camera;
    this.outlinePass.renderScene = view.scene;
    this.outlinePass.renderCamera = view.camera;
    this.outlinePass.selectedObjects = [];
    const b = view.bloom || { strength: 0.5, radius: 0.55, threshold: 0.9 };
    this.bloomPass.strength = b.strength; this.bloomPass.radius = b.radius; this.bloomPass.threshold = b.threshold;
    this.renderer.toneMappingExposure = view.exposure || 1.0;
    if (view.labels) view.labels.domElement.style.display = '';
    view.resize?.(innerWidth, innerHeight);
  }

  setOutline(objs) { this.outlinePass.selectedObjects = objs || []; }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    for (const l of this.labelLayers) l.setSize(w, h);
    for (const v of this.views) v.resize?.(w, h);
  }

  /** Render one frame (also used by automated tests when rAF is throttled). */
  step(now = performance.now()) { this._frame(now); }
  start() {
    const loop = (now) => { requestAnimationFrame(loop); this._frame(now); };
    requestAnimationFrame(loop);
  }
  _frame(now) {
    {
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (!(dt > 0)) dt = 1 / 60;
      dt = Math.min(dt, 0.05);
      this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
      this.time += dt;
      tweens.update(dt);
      if (!this.view) return;
      this.view.update?.(dt, this.time);
      this.composer.render(dt);
      if (this.view.labels) this.view.labels.render(this.view.scene, this.view.camera);
      this.onFrame?.(dt);
    }
  }
}
