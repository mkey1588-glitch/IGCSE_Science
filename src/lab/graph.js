import { linearFit } from '../core/util.js';

/**
 * Lightweight canvas plotter for live experiment data.
 * opts: { x: {label, min, max}, y: {label, min, max}, series: [{name, color, line, points, fit}], height }
 */
export class Graph {
  constructor(opts) {
    this.o = { height: 190, ...opts };
    this.series = (opts.series || [{ name: 'data', color: '#5eead4', points: true }]).map((s) => ({ points: true, line: false, ...s, data: [] }));
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'graph';
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.el = this.canvas;
    this.extra = [];
    requestAnimationFrame(() => this.draw());
    this.canvas.addEventListener('mousemove', (e) => { this.hover = e; this.draw(); });
    this.canvas.addEventListener('mouseleave', () => { this.hover = null; this.draw(); });
  }
  add(i, x, y) { this.series[i].data.push([x, y]); this.autoscale(); this.draw(); }
  set(i, data) { this.series[i].data = data.slice(); this.autoscale(); this.draw(); }
  clear(i = null) { if (i == null) this.series.forEach((s) => (s.data = [])); else this.series[i].data = []; this.draw(); }
  setExtra(list) { this.extra = list; this.draw(); }
  autoscale() {
    if (!this.o.auto) return;
    let xm = this.o.x.min, xM = this.o.x.max, ym = this.o.y.min, yM = this.o.y.max;
    for (const s of this.series) for (const [x, y] of s.data) { if (x > xM) xM = x * 1.1; if (y > yM) yM = y * 1.15; if (y < ym) ym = y * 1.15; }
    this.o.x.max = xM; this.o.y.max = yM; this.o.y.min = ym;
  }
  draw() {
    const c = this.canvas, W = c.clientWidth || 340, H = this.o.height;
    if (c.width !== W * this.dpr) { c.width = W * this.dpr; c.height = H * this.dpr; c.style.height = H + 'px'; }
    const ctx = c.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const L = 44, R = 12, T = 12, B = 34;
    const { x, y } = this.o;
    const px = (v) => L + ((v - x.min) / (x.max - x.min || 1)) * (W - L - R);
    const py = (v) => H - B - ((v - y.min) / (y.max - y.min || 1)) * (H - T - B);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = 'rgba(200,210,235,0.7)';
    const ticks = (min, max, n = 5) => { const step = niceStep((max - min) / n); const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6)); return out; };
    for (const v of ticks(x.min, x.max)) { ctx.beginPath(); ctx.moveTo(px(v), T); ctx.lineTo(px(v), H - B); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(fmtTick(v), px(v), H - B + 13); }
    for (const v of ticks(y.min, y.max, 4)) { ctx.beginPath(); ctx.moveTo(L, py(v)); ctx.lineTo(W - R, py(v)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(fmtTick(v), L - 5, py(v) + 3); }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.fillStyle = 'rgba(220,228,250,0.9)'; ctx.font = '600 10.5px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(x.label || '', L + (W - L - R) / 2, H - 6);
    ctx.save(); ctx.translate(11, T + (H - T - B) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(y.label || '', 0, 0); ctx.restore();
    // extra overlays (e.g. lines)
    for (const ex of this.extra) {
      ctx.strokeStyle = ex.color || 'rgba(255,209,102,.8)'; ctx.setLineDash(ex.dash || [4, 4]); ctx.lineWidth = 1.5; ctx.beginPath();
      ex.pts.forEach(([a, b], i) => (i ? ctx.lineTo(px(a), py(b)) : ctx.moveTo(px(a), py(b)))); ctx.stroke(); ctx.setLineDash([]);
    }
    // series
    for (const s of this.series) {
      const d = s.data; if (!d.length) continue;
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = 2;
      if (s.line) { ctx.beginPath(); d.forEach(([a, b], i) => (i ? ctx.lineTo(px(a), py(b)) : ctx.moveTo(px(a), py(b)))); ctx.stroke(); }
      if (s.points) for (const [a, b] of d) { ctx.beginPath(); ctx.arc(px(a), py(b), 3.2, 0, Math.PI * 2); ctx.fill(); }
      if (s.fit && d.length >= 2) {
        const f = linearFit(d);
        if (f) { ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(px(x.min), py(f.m * x.min + f.c)); ctx.lineTo(px(x.max), py(f.m * x.max + f.c)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
      }
    }
    // legend
    if (this.series.length > 1) {
      let lx = L + 8; ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'left';
      for (const s of this.series) { if (!s.name) continue; ctx.fillStyle = s.color; ctx.fillRect(lx, T + 2, 8, 8); ctx.fillStyle = 'rgba(230,236,255,.9)'; ctx.fillText(s.name, lx + 11, T + 10); lx += ctx.measureText(s.name).width + 24; }
    }
    // hover readout
    if (this.hover) {
      const r = c.getBoundingClientRect(); const mx = this.hover.clientX - r.left;
      let best = null, bd = 1e9;
      for (const s of this.series) for (const p of s.data) { const d = Math.abs(px(p[0]) - mx); if (d < bd) { bd = d; best = { p, s }; } }
      if (best && bd < 20) {
        const [a, b] = best.p; ctx.fillStyle = 'rgba(8,12,24,.9)'; ctx.strokeStyle = best.s.color;
        const t = `${fmtTick(a)}, ${fmtTick(b)}`; ctx.font = '600 11px Inter'; const tw = ctx.measureText(t).width + 12;
        const bx = Math.min(W - tw - 4, px(a) + 8), by = Math.max(4, py(b) - 26);
        ctx.fillRect(bx, by, tw, 20); ctx.strokeRect(bx, by, tw, 20); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(t, bx + 6, by + 14);
      }
    }
  }
}
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function fmtTick(v) { const a = Math.abs(v); if (a >= 10000) return (v / 1000).toFixed(0) + 'k'; if (a >= 100) return v.toFixed(0); if (a >= 1) return +v.toFixed(2) + ''; if (a === 0) return '0'; return +v.toPrecision(2) + ''; }
