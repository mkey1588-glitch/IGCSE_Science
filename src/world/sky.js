import * as THREE from 'three';
import { smoothstep, lerp, mulberry32, TAU } from '../core/util.js';
import { constellationLayout } from '../constellation/layout.js';
import { SUBJECTS } from '../data/curriculum.js';
import { LINKS } from '../data/links.js';

// time-of-day keyframes: t in [0,1), 0.25 sunrise, 0.5 noon, 0.75 sunset
const KEYS = [
  [0.0, '#040815', '#0a1631', '#03060f'],
  [0.2, '#0d1838', '#2a2850', '#05070f'],
  [0.25, '#3a5a9a', '#f6a46c', '#2b2a3a'],
  [0.31, '#4f8fe0', '#cfe6ff', '#6b8fb3'],
  [0.5, '#3a7fe6', '#d3ebff', '#7aa6cc'],
  [0.69, '#4a7fd0', '#f2d9b8', '#6b84a8'],
  [0.75, '#34407a', '#ff9a5c', '#2a2440'],
  [0.8, '#121a3d', '#3a2d5c', '#070a16'],
  [1.0, '#040815', '#0a1631', '#03060f'],
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function sampleKeys(t, idx, out) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      return out.copy(tmpA.set(a[idx])).lerp(tmpB.set(b[idx]), k);
    }
  }
  return out.set(KEYS[0][idx]);
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.t = 0.32;
    this.sunDir = new THREE.Vector3();
    this.top = new THREE.Color(); this.horizon = new THREE.Color(); this.bottom = new THREE.Color();
    this.night = 0;

    this.uniforms = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color('#fff2cf') }, uStars: { value: 0 }, uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uStars; uniform float uTime;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 col = mix(uHorizon, uTop, pow(smoothstep(0.0, 0.9, y), 0.65));
          col = mix(col, uBottom, smoothstep(0.0, -0.3, y));
          float s = max(dot(d, uSunDir), 0.0);
          float above = smoothstep(-0.08, 0.04, uSunDir.y);
          col += uSunColor * (pow(s, 1400.0) * 40.0 * above + pow(s, 14.0) * 0.32 + pow(s, 3.0) * 0.1);
          if (uStars > 0.01 && y > -0.02) {
            vec3 c = floor(d * 190.0);
            float h = hash(c);
            if (h > 0.9963) {
              vec3 f = fract(d * 190.0) - 0.5;
              float tw = 0.55 + 0.45 * sin(uTime * 2.3 + h * 120.0);
              col += vec3(1.0, 0.96, 0.9) * smoothstep(0.32, 0.0, length(f)) * tw * uStars * 1.6;
            }
            // faint milky way band
            float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.2, 1.0))) * 4.0, 2.0));
            col += vec3(0.25, 0.28, 0.45) * band * uStars * 0.12 * (0.6 + 0.4 * hash(floor(d * 60.0)));
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 20), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // lights
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.moon = new THREE.DirectionalLight('#8fb2ff', 0.0);
    scene.add(this.moon, this.moon.target);
    this.hemi = new THREE.HemisphereLight('#bfe3ff', '#6b8a4a', 0.9);
    scene.add(this.hemi);

    // moon disc
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.8), fog: false }));
    this.moonMesh.renderOrder = -9;
    scene.add(this.moonMesh);

    this._buildClouds();
    this._buildConstellation();
    scene.fog = new THREE.Fog('#cfe6ff', 160, 900);
  }

  _buildClouds() {
    const rnd = mulberry32(77);
    this.clouds = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#3a4660', emissiveIntensity: 0.15 });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const n = 4 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(5 + rnd() * 6, 0), mat);
        m.position.set((k - n / 2) * 6 + rnd() * 3, rnd() * 3, rnd() * 6 - 3);
        m.scale.y = 0.6;
        g.add(m);
      }
      const a = rnd() * TAU, r = 60 + rnd() * 220;
      g.position.set(Math.cos(a) * r, 55 + rnd() * 30, Math.sin(a) * r);
      g.userData.speed = 0.6 + rnd() * 0.8;
      this.clouds.add(g);
    }
    this.cloudMat = mat;
    this.scene.add(this.clouds);
  }

  _buildConstellation() {
    const L = constellationLayout();
    this.starDirs = [];
    const R = 1700;
    const pos = new Float32Array(L.nodes.length * 3);
    const col = new Float32Array(L.nodes.length * 3);
    const size = new Float32Array(L.nodes.length);
    L.nodes.forEach((n, i) => {
      const d = new THREE.Vector3(n.x * 1.15, 210 + n.z * 0.4, -n.y * 1.15 - 40).normalize();
      this.starDirs.push(d);
      pos.set([d.x * R, d.y * R, d.z * R], i * 3);
      const c = new THREE.Color(SUBJECTS[n.subject].glow);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = 0;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.starUniforms = { uOpacity: { value: 0 }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`
        attribute float size; attribute vec3 color; varying vec3 vC; varying float vS; uniform float uTime;
        void main() { vC = color; vS = size; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * 0.9999;
          gl_PointSize = size * (1.0 + 0.15 * sin(uTime * 2.0 + position.x)); }`,
      fragmentShader: /* glsl */`
        varying vec3 vC; varying float vS; uniform float uOpacity;
        void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p); float a = smoothstep(0.5, 0.0, d); a = a * a;
          float core = smoothstep(0.12, 0.0, d); gl_FragColor = vec4(vC * (a * 2.2 + core * 3.0), a * uOpacity); }`,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false; this.stars.renderOrder = -8;
    this.scene.add(this.stars);
    // links
    const lp = new Float32Array(LINKS.length * 6), lc = new Float32Array(LINKS.length * 6);
    LINKS.forEach((l, i) => {
      const a = this.starDirs[L.index[l.a]], b = this.starDirs[L.index[l.b]];
      lp.set([a.x * R, a.y * R, a.z * R, b.x * R, b.y * R, b.z * R], i * 6);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    this.linkMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.links = new THREE.LineSegments(lg, this.linkMat);
    this.links.frustumCulled = false; this.links.renderOrder = -8;
    this.scene.add(this.links);
    this.layout = L;
  }

  /** Update star sizes/colours and link colours from progress. */
  refreshConstellation(subStats, linkState) {
    const L = this.layout;
    const size = this.stars.geometry.attributes.size;
    L.nodes.forEach((n, i) => {
      const st = subStats(n.id);
      size.array[i] = st.any ? 14 + st.frac * 34 : 5;
    });
    size.needsUpdate = true;
    const col = this.links.geometry.attributes.color;
    const gold = new THREE.Color('#ffd166'), dim = new THREE.Color('#2a3558');
    LINKS.forEach((l, i) => {
      const s = linkState(l);
      const c = s === 2 ? gold : s === 1 ? dim : new THREE.Color(0, 0, 0);
      col.array.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    col.needsUpdate = true;
  }

  setTime(t) { this.t = ((t % 1) + 1) % 1; }

  update(dt, focus, elapsed) {
    const t = this.t;
    const ang = (t - 0.25) * TAU;
    this.sunDir.set(Math.cos(ang) * 0.8, Math.sin(ang), 0.42).normalize();
    sampleKeys(t, 1, this.top); sampleKeys(t, 2, this.horizon); sampleKeys(t, 3, this.bottom);
    const u = this.uniforms;
    u.uTop.value.copy(this.top); u.uHorizon.value.copy(this.horizon); u.uBottom.value.copy(this.bottom);
    u.uSunDir.value.copy(this.sunDir);
    const day = smoothstep(-0.1, 0.2, this.sunDir.y);
    this.night = 1 - smoothstep(-0.18, 0.06, this.sunDir.y);
    u.uStars.value = this.night;
    u.uTime.value = elapsed;
    const low = 1 - smoothstep(0.05, 0.4, this.sunDir.y);
    u.uSunColor.value.set('#fff2cf').lerp(tmpA.set('#ff9a52'), low * 0.8);

    this.sun.intensity = 2.15 * day;
    this.sun.color.set('#fff1d6').lerp(tmpA.set('#ffb070'), low * 0.7);
    const f = focus;
    this.sun.position.set(f.x + this.sunDir.x * 150, f.y + Math.max(0.15, this.sunDir.y) * 150, f.z + this.sunDir.z * 150);
    this.sun.target.position.copy(f);
    this.moon.intensity = 0.65 * this.night;
    this.moon.position.set(f.x - this.sunDir.x * 150, f.y + 120, f.z - this.sunDir.z * 150);
    this.moon.target.position.copy(f);
    // daylight sky fill by day; a dim moonlit blue at night (no grey wash)
    this.hemi.intensity = lerp(0.25 + 0.5 * day, 0.38, this.night);
    this.hemi.color.copy(this.top).lerp(tmpA.set('#ffffff'), 0.3).lerp(tmpB.set('#3d4f7a'), this.night * 0.85);
    this.hemi.groundColor.set('#4d5f3a').lerp(tmpA.set('#141a2a'), this.night);
    const md = this.sunDir.clone().multiplyScalar(-1); md.y = Math.abs(md.y) * 0.7 + 0.25; md.normalize();
    this.moonMesh.position.copy(md.multiplyScalar(1500)).add(f);
    this.moonMesh.visible = this.night > 0.05;
    this.dome.position.copy(f);
    this.stars.position.copy(f); this.links.position.copy(f);
    this.starUniforms.uOpacity.value = this.night;
    this.starUniforms.uTime.value = elapsed;
    this.linkMat.opacity = this.night * 0.85;
    this.scene.fog.color.copy(this.horizon).lerp(this.top, 0.25);
    this.scene.fog.near = lerp(140, 90, this.night); this.scene.fog.far = lerp(950, 600, this.night);
    this.cloudMat.color.set('#ffffff').lerp(tmpA.set('#3b4566'), this.night * 0.85).lerp(tmpB.set('#ffb38a'), low * (1 - this.night) * 0.5);
    for (const c of this.clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 320) c.position.x = -320;
    }
  }
}
