import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Compact 2D simplex noise (Gustavson). Returns f(x, y) in roughly [-1, 1]. */
export function createNoise2D(seed = 1) {
  const r = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  const g = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { const gi = pm12[ii + perm[jj]] * 2; t0 *= t0; n0 = t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { const gi = pm12[ii + i1 + perm[jj + j1]] * 2; t1 *= t1; n1 = t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { const gi = pm12[ii + 1 + perm[jj + 1]] * 2; t2 *= t2; n2 = t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2); }
    return 70 * (n0 + n1 + n2);
  };
}

export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

/** Minimal tween engine driven by the main loop. */
export class Tweens {
  constructor() { this.items = []; }
  to(target, props, duration = 0.5, opts = {}) {
    const from = {};
    for (const k in props) from[k] = target[k];
    return this._add({ target, from, to: props, duration, ...opts });
  }
  tween(duration, fn, opts = {}) { return this._add({ fn, duration, ...opts }); }
  _add(o) {
    const tw = { t: -(o.delay || 0), dead: false, ...o }; tw.ease = o.ease || ease.inOut;
    tw.promise = new Promise((r) => (tw.resolve = r));
    tw.kill = () => { tw.dead = true; tw.resolve(); };
    this.items.push(tw);
    return tw;
  }
  killOf(target) { for (const tw of this.items) if (tw.target === target) tw.kill(); }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const tw = this.items[i];
      if (tw.dead) { this.items.splice(i, 1); continue; }
      tw.t += dt;
      if (tw.t < 0) continue;
      const p = tw.duration <= 0 ? 1 : Math.min(1, tw.t / tw.duration);
      const e = tw.ease(p);
      if (tw.fn) tw.fn(e, p);
      else for (const k in tw.to) tw.target[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      tw.onUpdate && tw.onUpdate(e);
      if (p >= 1) { this.items.splice(i, 1); tw.onComplete && tw.onComplete(); tw.resolve(); }
    }
  }
}
export const tweens = new Tweens();
export const wait = (s) => tweens.tween(s, () => {}).promise;

/** DOM element helper: h('div', {class:'x', onClick}, children...) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
/** Lightweight rich text: _x_ subscript digits in formulas are written directly as unicode; **bold** supported. */
export function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }

export function canvasTex(w, hgt, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = hgt;
  const ctx = canvas.getContext('2d');
  if (draw) draw(ctx, w, hgt);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx, tex, redraw(fn) { ctx.clearRect(0, 0, w, hgt); fn(ctx, w, hgt); tex.needsUpdate = true; } };
}

export function roundRect(ctx, x, y, w, hh, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** A flat sign/plane with text drawn on a canvas. */
export function textPlane(text, { width = 2, fg = '#ffffff', bg = 'rgba(0,0,0,0)', font = '700 72px Outfit, Inter, sans-serif', pad = 24, emissive = 0, border = null, doubleSide = true } = {}) {
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = font;
  const tw = Math.ceil(tmp.measureText(text).width) + pad * 2;
  const fs = parseInt(font.match(/(\d+)px/)[1], 10);
  const th = Math.ceil(fs * 1.5);
  const { tex } = canvasTex(tw, th, (ctx, w, hh) => {
    ctx.fillStyle = bg; roundRect(ctx, 0, 0, w, hh, hh * 0.18); ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 6; roundRect(ctx, 3, 3, w - 6, hh - 6, hh * 0.16); ctx.stroke(); }
    ctx.font = font; ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, hh / 2 + fs * 0.04);
  });
  const mat = emissive
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide, color: new THREE.Color(emissive, emissive, emissive), toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide, roughness: 0.8 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (th / tw)), mat);
  return mesh;
}

export const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function fmt(v, dp = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return '∞';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(2).replace('e', '×10^');
  return v.toFixed(dp);
}
export function sigfig(v, n = 3) { if (v === 0) return '0'; return Number(v.toPrecision(n)).toString(); }
export function linearFit(pts) {
  const n = pts.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const d = n * sxx - sx * sx; if (Math.abs(d) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / d; return { m, c: (sy - m * sx) / n };
}
export function colorLerp(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    if (o.isCSS2DObject && o.element && o.element.parentNode) o.element.parentNode.removeChild(o.element);
  });
}
