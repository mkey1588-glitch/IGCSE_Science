import * as THREE from 'three';
import { createNoise2D, smoothstep, lerp, clamp } from '../core/util.js';
import { ZONES } from '../data/world.js';

const n1 = createNoise2D(11), n2 = createNoise2D(29), n3 = createNoise2D(47), nc = createNoise2D(83);
export const ISLAND_R = 138;
export const EXTENT = 210; // half-size of terrain/depth map
const HARBOUR_ANG = Math.atan2(12, 104);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function coastRadius(a) {
  let r = ISLAND_R + 9 * n1(Math.cos(a) * 1.2 + 3, Math.sin(a) * 1.2 + 3) + 4 * n2(Math.cos(a) * 3, Math.sin(a) * 3);
  const da = angDiff(a, HARBOUR_ANG);
  r -= 17 * Math.exp(-(da * da) / (2 * 0.13 * 0.13));
  return r;
}
const fbm = (x, z) => n1(x, z) * 0.6 + n2(x * 2.1, z * 2.1) * 0.28 + n3(x * 4.3, z * 4.3) * 0.12;

/** Road network: radial roads from the plaza + a ring road linking districts. */
export const ROADS = (() => {
  const segs = [];
  const ring = ['observatory', 'power', 'harbour', 'market', 'clinic', 'farm', 'eco', 'woods'];
  const Z = Object.fromEntries(ZONES.map((z) => [z.id, z]));
  for (const id of ring) {
    const z = Z[id];
    const mid = { x: z.x * 0.5 + z.z * 0.08, z: z.z * 0.5 - z.x * 0.08 };
    segs.push([0, 0, mid.x, mid.z], [mid.x, mid.z, z.x, z.z]);
  }
  for (let i = 0; i < ring.length; i++) {
    const a = Z[ring[i]], b = Z[ring[(i + 1) % ring.length]];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const k = 0.92; // pull ring slightly inward so it stays on land
    segs.push([a.x, a.z, mx * k, mz * k], [mx * k, mz * k, b.x, b.z]);
  }
  return segs;
})();
export function roadDist(x, z) {
  let best = 1e9;
  for (const [ax, az, bx, bz] of ROADS) {
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * t - x, pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function zoneAt(x, z) {
  let best = null, bd = 1e9;
  for (const zn of ZONES) { const d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < bd) { bd = d; best = zn; } }
  return bd < 1.25 ? best : null;
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const t = r / coastRadius(a);
  let h = lerp(2.0, -9, smoothstep(0.84, 1.1, t));
  const inland = 1 - smoothstep(0.62, 0.95, t);
  h += fbm(x * 0.011, z * 0.011) * 6.5 * inland;
  h += 10 * Math.exp(-(x * x + (z + 98) * (z + 98)) / (2 * 30 * 30)) * inland;
  h += 3 * Math.exp(-((x + 66) ** 2 + (z + 72) ** 2) / (2 * 40 * 40)) * inland;
  for (const zn of ZONES) {
    const d = Math.hypot(x - zn.x, z - zn.z);
    const w = 1 - smoothstep(zn.r * 0.8, zn.r * 1.35, d);
    if (w > 0) h = lerp(h, zn.h, w);
  }
  // soften roads into the landscape
  const rd = roadDist(x, z);
  if (rd < 6 && h > 0.6) { const w = (1 - smoothstep(1.5, 6, rd)) * 0.35; h = lerp(h, Math.max(0.9, h * 0.9), w); }
  return h;
}

const C = (hex) => new THREE.Color(hex);
const PAL = {
  deep: C('#7d6b48'), wet: C('#bca878'), sand: C('#ecd9a6'), grass1: C('#74b85a'), grass2: C('#5aa24c'), dry: C('#a7b65a'),
  rock: C('#8f8d82'), rock2: C('#a29f92'), road: C('#dccb9e'), woods: C('#4b8744'),
};

export function buildTerrain() {
  const SEG = 230;
  const geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const zoneCols = ZONES.map((z) => C(z.ground));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const v = nc(x * 0.05, z * 0.05) * 0.5 + 0.5;
    if (y < -0.3) tmp.copy(PAL.wet).lerp(PAL.deep, smoothstep(-0.3, -6, y));
    else if (y < 1.0) tmp.copy(PAL.sand).lerp(PAL.wet, smoothstep(0.5, -0.3, y));
    else {
      tmp.copy(PAL.grass1).lerp(PAL.grass2, v).lerp(PAL.dry, smoothstep(0.55, 0.95, nc(x * 0.013 + 9, z * 0.013)) * 0.6);
      tmp.lerp(PAL.sand, smoothstep(1.7, 1.0, y));
      // woods darker
      const dw = Math.hypot(x + 66, z + 72);
      tmp.lerp(PAL.woods, (1 - smoothstep(20, 46, dw)) * 0.75);
      // district ground
      ZONES.forEach((zn, k) => {
        const d = Math.hypot(x - zn.x, z - zn.z);
        const w = 1 - smoothstep(zn.r * 0.55, zn.r * 0.95, d);
        if (w > 0 && zn.id !== 'woods') tmp.lerp(zoneCols[k], w * 0.9);
      });
      const rd = roadDist(x, z);
      tmp.lerp(PAL.road, 1 - smoothstep(1.4, 2.6, rd));
      if (slope > 0.32) tmp.lerp(v > 0.5 ? PAL.rock : PAL.rock2, smoothstep(0.32, 0.55, slope));
    }
    // subtle noise variation
    const j = (nc(x * 0.35, z * 0.35)) * 0.035;
    col[i * 3] = Math.max(0, tmp.r + j); col[i * 3 + 1] = Math.max(0, tmp.g + j); col[i * 3 + 2] = Math.max(0, tmp.b + j);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Height map baked into a texture so the water shader knows the depth (for shallows and foam). */
export function buildDepthTexture(N = 256) {
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 * EXTENT - EXTENT, z = (j / (N - 1)) * 2 * EXTENT - EXTENT;
    const h = heightAt(x, z);
    const v = Math.round(clamp((h + 10) / 20, 0, 1) * 255);
    const k = (j * N + i) * 4; data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

export function buildWater(depthTex) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uDepth: { value: null }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color('#fff4d6') },
    uDeep: { value: new THREE.Color('#0a3f73') }, uShallow: { value: new THREE.Color('#2cc9c4') }, uSky: { value: new THREE.Color('#a9d8ff') },
    uFoam: { value: new THREE.Color('#ffffff') }, uNight: { value: 0 }, uExtent: { value: EXTENT },
  }]);
  uniforms.uDepth.value = depthTex;
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, fog: true, depthWrite: false,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uTime; uniform sampler2D uDepth; uniform vec3 uSunDir; uniform vec3 uSunColor;
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uFoam; uniform float uNight; uniform float uExtent;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
      float waves(vec2 p) { float t = uTime;
        return sin(p.x * 0.21 + t * 1.3) * 0.5 + sin(p.y * 0.17 - t * 1.1) * 0.5 + sin((p.x + p.y) * 0.43 + t * 2.1) * 0.25
          + vnoise(p * 0.6 + t * 0.4) * 0.6 + vnoise(p * 1.7 - t * 0.7) * 0.3; }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.4;
        float h0 = waves(p), hx = waves(p + vec2(e, 0.0)), hz = waves(p + vec2(0.0, e));
        vec3 n = normalize(vec3(-(hx - h0) / e * 0.32, 1.0, -(hz - h0) / e * 0.32));
        vec2 uv = p / (2.0 * uExtent) + 0.5;
        float th = -10.0;
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) th = texture2D(uDepth, uv).r * 20.0 - 10.0;
        float depth = max(0.0, -th);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.2, 7.5, depth));
        col = mix(col, uSky, clamp(fres * 0.85, 0.0, 1.0));
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(n, H), 0.0), 220.0);
        col += uSunColor * spec * 4.0 * smoothstep(-0.05, 0.1, uSunDir.y);
        float foam = smoothstep(1.3, 0.0, depth) * (0.5 + 0.5 * sin(depth * 9.0 - uTime * 2.2 + vnoise(p * 0.8) * 4.0));
        foam += smoothstep(0.3, 0.0, depth);
        col = mix(col, uFoam * (1.0 - uNight * 0.75), clamp(foam, 0.0, 1.0) * 0.7);
        float alpha = mix(0.7, 0.96, smoothstep(0.0, 3.0, depth));
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.renderOrder = 2;
  mesh.name = 'water';
  return mesh;
}

/** Random-but-deterministic scatter points satisfying a predicate. */
export function scatter(count, rnd, pred, tries = 20) {
  const out = [];
  for (let i = 0; i < count * tries && out.length < count; i++) {
    const x = (rnd() * 2 - 1) * EXTENT * 0.75, z = (rnd() * 2 - 1) * EXTENT * 0.75;
    const h = heightAt(x, z);
    if (pred(x, z, h)) out.push([x, h, z]);
  }
  return out;
}
