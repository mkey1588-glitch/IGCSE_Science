import { h, clear, rich, clamp, store } from '../core/util.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';
import { state, save, levelProgress, rankOf, coverage, newGame, hasSave } from '../core/state.js';
import { SUB, SUBJECTS, COUNTS, SYLLABUS } from '../data/curriculum.js';
import { ZONES, ZONE, NPC, POIS } from '../data/world.js';
import { heightAt, coastRadius, EXTENT } from '../world/terrain.js';
import { game } from '../game.js';
import { openCodex } from './codex.js';
import { runQuiz } from './quiz.js';
import { runChain } from './chain.js';

export class UI {
  constructor(root) {
    this.root = root;
    this.hud = h('div', { class: 'hud hidden' });
    this.toasts = h('div', { class: 'toasts' });
    this.layer = h('div', { class: 'hud' });
    root.append(this.hud, this.layer, this.toasts);
    this.modalCount = 0;
    this.dialogOpen = false;
    this.titleOpen = false;
    this._buildHUD();
    this._bindEvents();
    this._mapImg = null;
  }

  isBlocking() { return this.modalCount > 0 || this.dialogOpen || this.titleOpen; }

  // ================================================================ HUD
  _buildHUD() {
    this.profile = h('div', { class: 'hud-profile glass pe', onClick: () => this.openCodex(null, 'progress') });
    this.quest = h('div', { class: 'hud-quest glass pe' });
    this.prompt = h('div', { class: 'prompt glass pe hidden', onClick: () => { const f = game.world?.focus; if (f) game.world.interact(f); } });
    const mm = h('div', { class: 'minimap', title: 'Open map (M)', onClick: () => this.openMap() });
    this.mmCanvas = h('canvas', { width: 352, height: 352 });
    this.mmZone = h('div', { class: 'zone-name' });
    mm.append(this.mmCanvas, this.mmZone);
    this.clock = h('div', { class: 'clock glass' });
    const right = h('div', { class: 'hud-right' }, mm, this.clock);
    const hb = (ic, lb, k, fn, id) => h('div', { class: 'hb', title: `${lb} (${k})`, onClick: () => { audio.click(); fn(); }, id }, h('span', { class: 'ic' }, ic), h('span', { class: 'lb' }, lb), h('span', { class: 'k' }, k));
    this.hotbar = h('div', { class: 'hotbar glass' },
      hb('📜', 'Quests', 'J', () => this.openQuestLog()),
      hb('📚', 'Codex', 'C', () => this.openCodex()),
      hb('✨', 'Constellation', 'K', () => game.openConstellation()),
      hb('🧪', 'Lab', 'L', () => this.openCatalog('exp')),
      hb('🧬', 'Holo', 'H', () => this.openCatalog('holo')),
      hb('🗺️', 'Map', 'M', () => this.openMap()),
      hb('⚙️', 'Settings', 'Esc', () => this.openSettings()));
    this.help = h('div', { class: 'controls-help glass' });
    this.help.innerHTML = '<span class="kbd">W A S D</span> move &nbsp; <span class="kbd">Shift</span> run &nbsp; <span class="kbd">Drag</span> look<br><span class="kbd">Click</span> walk / talk &nbsp; <span class="kbd">E</span> interact &nbsp; <span class="kbd">Wheel</span> zoom';
    this.hud.append(this.profile, this.quest, this.prompt, right, this.hotbar, this.help);
    setTimeout(() => this.help.classList.add('hidden'), 45000);
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (game.mode !== 'world') return;
      if (e.code === 'Escape') { if (this.modalCount > 0) this.closeTopModal(); else if (!this.dialogOpen && !this.titleOpen) this.openSettings(); return; }
      if (this.isBlocking()) return;
      const map = { KeyJ: () => this.openQuestLog(), KeyC: () => this.openCodex(), KeyK: () => game.openConstellation(), KeyM: () => this.openMap(), KeyL: () => this.openCatalog('exp'), KeyH: () => this.openCatalog('holo') };
      if (map[e.code]) { audio.click(); map[e.code](); }
    });
  }

  showHUD(on) { this.hud.classList.toggle('hidden', !on); if (on) this.updateHUD(); else this.layer.querySelectorAll('.zone-banner').forEach((b) => b.remove()); }

  updateHUD() {
    const lp = levelProgress();
    clear(this.profile).append(
      h('div', { class: 'avatar' }, (state.name || 'S')[0].toUpperCase()),
      h('div', { class: 'lvl' }, String(lp.level)),
      h('div', null,
        h('div', { class: 'name' }, state.name || 'Scientist'),
        h('div', { class: 'rank' }, rankOf(lp.level) + ` · ${state.settings.tier === 'extended' ? 'Extended' : 'Core'}`),
        h('div', { class: 'bar' }, h('i', { style: { width: `${(lp.into / lp.need) * 100}%` } })),
        h('div', { class: 'hud-subjects' }, ...['B', 'C', 'P'].map((s) => {
          const c = coverage(s); const pct = Math.round(((c.seen + c.practised + c.mastered) / (3 * c.total)) * 100);
          return h('span', { style: { color: SUBJECTS[s].color } }, `${SUBJECTS[s].icon} ${pct}%`);
        }))));
    this.updateQuestTracker();
  }

  updateQuestTracker() {
    const q = game.quests?.tracked();
    clear(this.quest);
    if (!q) {
      this.quest.classList.add('empty');
      const avail = game.quests?.availableCount() || 0;
      this.quest.append(h('div', { class: 'eyebrow' }, 'No active quest'), h('div', { style: { marginTop: '6px', lineHeight: 1.5 } }, avail ? `Look for residents with a golden ◆ marker — ${avail} quests are waiting.` : 'Explore Brightwater and scan the glowing ◈ points of interest.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn small', onClick: () => this.openQuestLog() }, '📜 Quest log')));
      return;
    }
    this.quest.classList.remove('empty');
    const step = game.quests.stepOf(q.id);
    const zone = ZONE[q.zone];
    this.quest.append(h('div', { class: 'eyebrow', style: { color: zone?.color } }, `${zone?.icon || ''} ${zone?.name || ''}${q.thread ? ' · ✦ Golden Thread' : ''}`),
      h('div', { class: 'qt' }, q.title));
    if (step) {
      this.quest.append(h('div', { class: 'step' }, h('span', { class: 'dot' }), h('span', { html: rich(step.text) })));
      const tgt = game.quests.currentTarget();
      if (tgt && game.world?.targetPos) {
        const d = Math.round(game.world.targetPos.distanceTo(game.world.ppos));
        if (d > 5) this.quest.append(h('div', { class: 'dist' }, `◆ ${d} m away — follow the golden beacon`));
      }
      const acts = h('div', { class: 'actions' });
      const a = game.quests.stepAction(q.id);
      if (a) acts.append(h('button', { class: 'btn small primary', onClick: () => { audio.click(); a.run(); } }, a.label));
      if (tgt && tgt.zone && game.world?.currentZone !== tgt.zone && state.visited[tgt.zone]) acts.append(h('button', { class: 'btn small', onClick: () => this.fastTravel(tgt.zone) }, '⚡ Travel'));
      acts.append(h('button', { class: 'btn small', onClick: () => this.openQuestLog(q.id) }, 'Details'));
      this.quest.append(acts);
    }
  }

  setPrompt(t) {
    if (!t) { this.prompt.classList.add('hidden'); return; }
    clear(this.prompt).append(h('span', { class: 'kbd' }, 'E'), h('span', null, `${t.icon || ''} ${t.label}`));
    this.prompt.classList.remove('hidden');
  }

  tick(dt) {
    this._t = (this._t || 0) + dt;
    if (this._t > 0.12) { this._t = 0; this.drawMinimap(); this._clockUpdate(); }
    this._qt = (this._qt || 0) + dt;
    if (this._qt > 1) { this._qt = 0; if (!this.isBlocking()) this.updateQuestTracker(); }
  }
  _clockUpdate() {
    const t = state.time, hh = Math.floor(t * 24), mm = Math.floor((t * 24 - hh) * 60);
    const night = game.world?.sky.night > 0.5;
    this.clock.textContent = `${night ? '🌙' : '☀️'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Day ${1 + Math.floor((Date.now() - state.created) / 86400000)}`;
  }

  // ---------------------------------------------------------------- map
  _islandImage(N = 512) {
    if (this._mapImg) return this._mapImg;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / N) * 2 * 160 - 160, z = (j / N) * 2 * 160 - 160;
      const hh = heightAt(x, z);
      let r, g, b;
      if (hh < -4) [r, g, b] = [14, 52, 96]; else if (hh < 0) [r, g, b] = [30, 120, 150];
      else if (hh < 1) [r, g, b] = [230, 214, 164]; else { const k = clamp(hh / 16, 0, 1); [r, g, b] = [96 - k * 30, 168 - k * 40, 86 - k * 20]; }
      const o = (j * N + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this._mapImg = c; return c;
  }
  drawMinimap() {
    const w = game.world; if (!w || this.hud.classList.contains('hidden')) return;
    const cv = this.mmCanvas, ctx = cv.getContext('2d'), S = cv.width;
    const img = this._islandImage();
    const R = 70; // metres radius shown
    const px = ((w.ppos.x + 160) / 320) * img.width, pz = ((w.ppos.z + 160) / 320) * img.height;
    const scale = (S / 2) / ((R / 320) * img.width);
    ctx.save(); ctx.clearRect(0, 0, S, S);
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0e3460'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2); ctx.rotate(w.camYaw); ctx.scale(scale, scale); ctx.translate(-px, -pz);
    ctx.drawImage(img, 0, 0);
    const toM = (x, z) => [((x + 160) / 320) * img.width, ((z + 160) / 320) * img.height];
    ctx.lineWidth = 1 / scale;
    for (const n of Object.values(w.npcs)) {
      const [mx, mz] = toM(n.ch.root.position.x, n.ch.root.position.z);
      const mk = game.quests?.npcMarker(n.def.id);
      ctx.fillStyle = mk === 'new' ? '#ffd166' : mk === 'turnin' ? '#4ade80' : mk === 'active' ? '#5ec8ff' : '#e2e8f0';
      ctx.beginPath(); ctx.arc(mx, mz, (mk ? 4.5 : 3) / scale * 2, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of Object.values(w.pois)) {
      if (state.scanned[p.def.id]) continue;
      const [mx, mz] = toM(p.pos.x, p.pos.z); ctx.fillStyle = '#5eead4'; ctx.fillRect(mx - 2 / scale * 2, mz - 2 / scale * 2, 4 / scale * 2, 4 / scale * 2);
    }
    if (w.targetPos) {
      const [mx, mz] = toM(w.targetPos.x, w.targetPos.z);
      ctx.restore(); ctx.save();
      // clamp target to edge
      const dx = (mx - px) * scale, dz = (mz - pz) * scale;
      const c = Math.cos(w.camYaw), s = Math.sin(w.camYaw);
      let rx = dx * c - dz * s, rz = dx * s + dz * c;
      const L = Math.hypot(rx, rz), maxL = S / 2 - 14;
      if (L > maxL) { rx = (rx / L) * maxL; rz = (rz / L) * maxL; }
      ctx.translate(S / 2 + rx, S / 2 + rz);
      ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#2a1600'; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 5 : 12; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // player arrow
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-w.pyaw + w.camYaw + Math.PI);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    const z = w.currentZone ? ZONE[w.currentZone] : null;
    this.mmZone.textContent = z ? z.name : 'Brightwater Island';
    this.mmZone.style.color = z ? z.color : '#cbd5e1';
  }

  openMap() {
    const w = game.world;
    const N = 640;
    const cv = h('canvas', { width: N, height: N, style: { width: 'min(78vh, 90vw)', height: 'min(78vh, 90vw)' } });
    const draw = () => {
      const ctx = cv.getContext('2d');
      ctx.drawImage(this._islandImage(), 0, 0, N, N);
      const toM = (x, z) => [((x + 160) / 320) * N, ((z + 160) / 320) * N];
      for (const z of ZONES) {
        const [mx, mz] = toM(z.x, z.z);
        ctx.fillStyle = state.visited[z.id] ? z.color : 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(mx, mz, 9, 0, Math.PI * 2); ctx.fill();
        ctx.font = '700 15px Outfit, Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
        const lbl = `${z.icon} ${z.name}`; ctx.strokeText(lbl, mx, mz - 16); ctx.fillText(lbl, mx, mz - 16);
      }
      for (const n of Object.values(w.npcs)) {
        const mk = game.quests?.npcMarker(n.def.id); if (!mk) continue;
        const [mx, mz] = toM(n.ch.root.position.x, n.ch.root.position.z);
        ctx.fillStyle = mk === 'new' ? '#ffd166' : mk === 'turnin' ? '#4ade80' : '#5ec8ff';
        ctx.beginPath(); ctx.moveTo(mx, mz - 7); ctx.lineTo(mx + 5, mz); ctx.lineTo(mx, mz + 7); ctx.lineTo(mx - 5, mz); ctx.closePath(); ctx.fill();
      }
      const [px, pz] = toM(w.ppos.x, w.ppos.z);
      ctx.save(); ctx.translate(px, pz); ctx.rotate(-w.pyaw + Math.PI); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
      if (w.targetPos) { const [tx, tz] = toM(w.targetPos.x, w.targetPos.z); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, tz, 12, 0, Math.PI * 2); ctx.stroke(); }
    };
    draw();
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 320 - 160, z = ((e.clientY - r.top) / r.height) * 320 - 160;
      const zone = ZONES.find((zz) => Math.hypot(zz.x - x, zz.z - z) < 14);
      if (zone) { if (state.visited[zone.id] || state.settings.teacher) { this.closeTopModal(); this.fastTravel(zone.id); } else this.toast('🔒', `Visit <b>${zone.name}</b> on foot first to unlock fast travel.`); }
    });
    const legend = h('div', { class: 'map-legend glass' }, h('div', null, '◆ Quest marker'), h('div', null, '⬆ You'), h('div', null, '◯ Quest target'), h('div', { class: 'faint' }, 'Click a visited district to fast-travel'));
    this.modal({ title: '🗺️ Brightwater Island', cls: 'panel', body: h('div', { class: 'map-wrap' }, cv, legend) });
  }

  fastTravel(zoneId) {
    game.fade(async () => { game.world.teleport(game.world.zoneSpawn(zoneId)); });
    audio.whoosh();
  }

  // ================================================================ toasts & banners
  toast(icon, html, kind = '') {
    const el = h('div', { class: `toast glass ${kind}` }, h('span', { class: 'ti' }, icon), h('div', { html }));
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'gold' ? 6500 : 4200);
  }
  zoneBanner(id) {
    const z = ZONE[id]; if (!z) return;
    const b = h('div', { class: 'zone-banner' }, h('div', { class: 'zn', style: { color: z.color } }, `${z.icon} ${z.name}`), h('div', { class: 'zd' }, z.desc));
    this.layer.append(b); setTimeout(() => b.remove(), 3700);
  }

  _bindEvents() {
    bus.on('xp', () => this.updateHUD());
    bus.on('levelup', (l) => { audio.levelUp(); this.toast('⭐', `<b>Level ${l}!</b> You are now a ${rankOf(l)}.`, 'gold'); });
    bus.on('mastery', (ids, level, src) => {
      const subs = new Set(ids.map((i) => i.split('.').slice(0, -1).join('.')));
      const fresh = [...subs].filter((s) => SUB[s] && level === 1 && !this._seenSubs?.has(s));
      this._seenSubs = this._seenSubs || new Set();
      fresh.slice(0, 2).forEach((s) => { this._seenSubs.add(s); this.toast(SUBJECTS[s[0]].icon, `New topic discovered: <b>${s} ${SUB[s].title}</b>`); });
      this.updateHUD();
    });
    bus.on('links', (links) => {
      audio.connect();
      links.slice(0, 2).forEach((l) => this.toast('✨', `<b>Connection sparked:</b> ${l.a} ${SUB[l.a].title} ↔ ${l.b} ${SUB[l.b].title}<br><span class="muted">${l.text}</span>`, 'gold'));
      if (links.length > 2) this.toast('✨', `+${links.length - 2} more connections lit up in your Constellation.`, 'gold');
    });
    bus.on('achievement', (a) => { audio.success(); this.toast(a.icon, `<b>Achievement unlocked — ${a.name}</b><br><span class="muted">${a.desc}</span>`, 'gold'); });
    bus.on('zone:enter', (id, first) => { this.zoneBanner(id); if (first) { audio.discover(); } });
  }

  // ================================================================ dialogue
  /**
   * lines: [{ who: npcId|'you'|'narrator', text }], choices?: [{ label, ok?, fb?, value }]
   * Returns the chosen choice (or null).
   */
  dialogue(lines, { choices = null, retry = true, tags = null } = {}) {
    return new Promise((resolve) => {
      this.dialogOpen = true;
      const box = h('div', { class: 'dialogue glass' });
      this.layer.append(box);
      let i = 0, typing = null, full = '';
      const speakerOf = (who) => {
        if (who === 'you') return { name: state.name || 'You', role: 'You', emoji: '🧑‍🔬', color: '#4f46e5' };
        if (who === 'narrator') return { name: 'Brightwater', role: '', emoji: '🏝️', color: '#0ea5e9' };
        const n = NPC[who]; return { name: n.name, role: n.role, emoji: n.emoji, color: ZONE[n.zone]?.color || '#8ea2ff' };
      };
      const finish = (v) => { this.dialogOpen = false; box.remove(); game.world?.npcs && Object.values(game.world.npcs).forEach((n) => n.ch.setTalking(false)); resolve(v); };
      const render = () => {
        const L = lines[i];
        const sp = speakerOf(L.who);
        const npc = game.world?.npcs?.[L.who];
        Object.values(game.world?.npcs || {}).forEach((n) => n.ch.setTalking(n === npc));
        clear(box);
        const textEl = h('div', { class: `text ${L.who === 'you' ? 'player' : ''}` });
        box.append(h('div', { class: 'portrait', style: { background: `linear-gradient(135deg, ${sp.color}, #1e293b)` } }, sp.emoji),
          h('div', { class: 'grow' }, h('div', { class: 'speaker' }, sp.name, h('span', { class: 'role' }, sp.role)), textEl,
            tags && i === lines.length - 1 ? h('div', { class: 'tags' }, ...tags) : null,
            h('div', { class: 'next' }, i < lines.length - 1 || !choices ? 'Click / Space ▸' : '')));
        full = L.text;
        let k = 0;
        clearInterval(typing);
        typing = setInterval(() => {
          k += 2; textEl.innerHTML = rich(full.slice(0, k));
          if (k % 6 === 0) audio.blip();
          if (k >= full.length) { clearInterval(typing); typing = null; textEl.innerHTML = rich(full); if (i === lines.length - 1 && choices) showChoices(textEl.parentNode); }
        }, 16);
      };
      const showChoices = (parent) => {
        const wrap = h('div', { class: 'choices' });
        const fb = h('div', { class: 'feedback hidden' });
        choices.forEach((c) => {
          const b = h('button', { class: 'choice', onClick: () => {
            audio.click();
            if (c.ok === false) {
              b.classList.add('wrong'); fb.classList.remove('hidden'); fb.innerHTML = '❌ ' + rich(c.fb || 'Not quite — think again.'); audio.fail();
              if (!retry) setTimeout(() => finish(c), 1600);
              return;
            }
            if (c.ok === true) { b.classList.add('right'); fb.classList.remove('hidden'); fb.innerHTML = '✅ ' + rich(c.fb || 'Exactly right!'); audio.success(); setTimeout(() => finish(c), 1800); return; }
            finish(c);
          } }, c.label);
          wrap.append(b);
        });
        parent.append(wrap, fb);
      };
      const advance = () => {
        if (typing) { clearInterval(typing); typing = null; box.querySelector('.text').innerHTML = rich(full); if (i === lines.length - 1 && choices) showChoices(box.querySelector('.text').parentNode); return; }
        if (i === lines.length - 1 && choices) return;
        i++;
        if (i >= lines.length) { cleanup(); finish(null); return; }
        render();
      };
      const onKey = (e) => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); advance(); } };
      const cleanup = () => window.removeEventListener('keydown', onKey);
      box.addEventListener('click', (e) => { if (!e.target.closest('.choice')) advance(); });
      window.addEventListener('keydown', onKey);
      const origFinish = finish;
      render();
      box._cleanup = cleanup;
      // ensure listener removed on choice finish too
      const obs = new MutationObserver(() => { if (!box.isConnected) { cleanup(); obs.disconnect(); } });
      obs.observe(this.layer, { childList: true });
      void origFinish;
    });
  }

  // ================================================================ modals
  modal({ title, body, cls = 'panel', onClose, head = null, wide }) {
    this.modalCount++;
    const back = h('div', { class: 'modal-back' });
    const close = () => { if (!back.isConnected) return; back.remove(); this.modalCount--; audio.close(); onClose?.(); };
    const panel = h('div', { class: `${cls} glass` },
      h('div', { class: 'panel-head' }, h('h2', null, title), h('div', { class: 'grow' }), head, h('button', { class: 'icon-btn', title: 'Close (Esc)', onClick: close }, '✕')),
      body);
    back.append(panel);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    back._close = close;
    this.layer.append(back);
    audio.open();
    return { close, panel, back };
  }
  closeTopModal() { const all = this.layer.querySelectorAll('.modal-back'); const top = all[all.length - 1]; if (top) (top._close ? top._close() : top.remove()); }
  closeAllModals() { this.layer.querySelectorAll('.modal-back').forEach((m) => (m._close ? m._close() : m.remove())); }

  // ---------------------------------------------------------------- scan card
  scan(poiId) {
    const p = POIS.find((x) => x.id === poiId); if (!p) return;
    audio.scan();
    const ring = h('div', { class: 'scan-ring' });
    this.layer.append(ring);
    this.dialogOpen = true;
    setTimeout(() => {
      ring.remove(); this.dialogOpen = false;
      const first = !state.scanned[p.id];
      game.onScanned(p, first);
      const card = h('div', { class: 'scan-card glass' },
        h('div', { class: 'eyebrow' }, `◈ Field scan · ${ZONE[p.zone].name}`),
        h('h3', null, p.title),
        h('p', { html: rich(p.text) }),
        h('div', { class: 'row wrap', style: { gap: '6px', marginTop: '8px' } }, ...p.ids.map((id) => this.chip(id, true))),
        h('div', { class: 'row', style: { marginTop: '12px' } },
          h('button', { class: 'btn small', onClick: () => { card.remove(); this.openCodex(p.ids[0]); } }, '📚 Open lesson'),
          h('div', { class: 'grow' }),
          h('button', { class: 'btn small primary', onClick: () => card.remove() }, 'Got it')));
      this.layer.querySelectorAll('.scan-card').forEach((c) => c.remove());
      this.layer.append(card);
      setTimeout(() => card.isConnected && card.remove(), 22000);
    }, 1100);
  }

  chip(id, click = false) {
    const st = SUB[id] || SUB[id.split('.').slice(0, -1).join('.')];
    const subj = id[0];
    const el = h('span', { class: `chip ${subj} ${click ? 'click' : ''}`, title: st ? st.title : id, onClick: click ? () => this.openCodex(st?.id || id) : null }, id, st ? ` ${st.title}` : '');
    return el;
  }

  // ---------------------------------------------------------------- quest log
  openQuestLog(selectId = null) {
    const Q = game.quests;
    const left = h('div'), right = h('div', { class: 'q-detail' });
    const groups = [['Active', Q.list('active')], ['Available', Q.list('available')], ['Completed', Q.list('done')], ['Locked', Q.list('locked')]];
    let sel = selectId || Q.tracked()?.id || groups.find((g) => g[1].length)?.[1][0]?.id;
    const renderDetail = () => {
      clear(right);
      const q = Q.get(sel); if (!q) return;
      const st = Q.status(q.id), z = ZONE[q.zone], giver = NPC[q.giver];
      right.append(h('div', { class: 'eyebrow', style: { color: z.color } }, `${z.icon} ${z.name} · given by ${giver.name}${q.thread ? ' · ✦ Golden Thread' : ''}`),
        h('h3', { style: { margin: '6px 0 10px' } }, q.title),
        h('p', { class: 'muted', style: { lineHeight: 1.6 }, html: rich(q.summary) }),
        h('div', { class: 'row wrap', style: { gap: '6px' } }, ...q.objectives.map((id) => this.chip(id, true))));
      const steps = h('div', { class: 'q-steps' });
      const cur = state.quests[q.id]?.step ?? -1;
      q.steps.forEach((s, i) => {
        const done = st === 'done' || i < cur, isCur = st === 'active' && i === cur;
        steps.append(h('div', { class: `q-step ${done ? 'done' : ''} ${isCur ? 'cur' : ''} ${!done && !isCur ? 'locked' : ''}` }, h('span', { class: 'ck' }, done ? '✓' : ''), h('span', { html: rich(done || isCur ? s.text : '???') })));
      });
      right.append(steps);
      const acts = h('div', { class: 'row', style: { marginTop: '16px', gap: '8px' } });
      if (st === 'active') {
        acts.append(h('button', { class: 'btn primary', onClick: () => { state.tracked = q.id; save(); this.updateQuestTracker(); renderList(); } }, state.tracked === q.id ? '✓ Tracking' : '◆ Track this quest'));
        const a = Q.stepAction(q.id); if (a) acts.append(h('button', { class: 'btn', onClick: () => { this.closeTopModal(); a.run(); } }, a.label));
      } else if (st === 'available') acts.append(h('div', { class: 'muted' }, `Talk to ${giver.name} in ${z.name} to begin.`), state.visited[q.zone] ? h('button', { class: 'btn small', onClick: () => { this.closeTopModal(); this.fastTravel(q.zone); } }, '⚡ Travel there') : null);
      else if (st === 'locked') acts.append(h('div', { class: 'muted' }, 'Complete earlier quests to unlock: ' + (q.requires || []).map((r) => Q.get(r)?.title).join(', ')));
      right.append(acts);
    };
    const renderList = () => {
      clear(left);
      for (const [name, list] of groups) {
        if (!list.length) continue;
        left.append(h('div', { class: 'eyebrow ql-group' }, `${name} · ${list.length}`));
        for (const q of list) {
          left.append(h('div', { class: `ql-item ${q.id === sel ? 'on' : ''}`, onClick: () => { sel = q.id; renderList(); renderDetail(); } },
            h('div', { class: 't' }, `${state.tracked === q.id ? '◆ ' : ''}${q.title}`), h('div', { class: 'z' }, `${ZONE[q.zone].icon} ${ZONE[q.zone].name}${q.thread ? ' · ✦' : ''}`)));
        }
      }
    };
    renderList(); renderDetail();
    const done = Q.list('done').length, total = Q.all().length;
    this.modal({ title: '📜 Quest Log', body: h('div', { class: 'panel-body split' }, left, right), head: h('span', { class: 'chip gold' }, `${done} / ${total} complete`) });
  }

  // ---------------------------------------------------------------- catalogs
  openCatalog(kind) {
    const reg = game.lab.registry.filter((e) => e.kind === kind);
    const body = h('div', { class: 'panel-body' });
    for (const s of ['B', 'C', 'P']) {
      const list = reg.filter((e) => e.subject === s);
      if (!list.length) continue;
      body.append(h('div', { class: 'row', style: { margin: '6px 0 12px' } }, h('h3', { style: { color: SUBJECTS[s].color } }, `${SUBJECTS[s].icon} ${SUBJECTS[s].name}`), h('span', { class: 'faint' }, `${list.length} ${kind === 'exp' ? 'experiments' : 'models'}`)));
      const grid = h('div', { class: 'cat-grid', style: { marginBottom: '18px' } });
      for (const e of list) {
        const unlocked = game.lab.isUnlocked(e.id);
        const done = state.exps[e.id]?.done || state.holos[e.id]?.done;
        grid.append(h('div', { class: `cat-card ${unlocked ? '' : 'locked'}`, style: { '--c': SUBJECTS[s].color }, onClick: () => {
          if (!unlocked) { this.toast('🔒', `Unlock <b>${e.title}</b> through a quest, or enable Teacher mode in Settings.`); return; }
          this.closeTopModal(); game.openLab(e.id);
        } },
          done ? h('div', { class: 'done' }, '✓') : null,
          h('div', { class: 'ic' }, unlocked ? e.icon : '🔒'), h('h4', null, e.title), h('p', null, e.blurb),
          h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '8px' } }, ...e.objectives.slice(0, 4).map((id) => h('span', { class: `chip ${id[0]}` }, id)))));
      }
      body.append(grid);
    }
    this.modal({ title: kind === 'exp' ? '🧪 Virtual Lab — Experiments' : '🧬 Holo-Theatre — 3D Models', body, head: h('span', { class: 'faint' }, kind === 'exp' ? 'Hands-on investigations' : 'Explore interactive 3D models') });
  }

  // ---------------------------------------------------------------- settings
  openSettings() {
    const S = state.settings;
    const seg = (opts, val, fn) => { const el = h('div', { class: 'seg' }); opts.forEach(([v, l]) => el.append(h('span', { class: v === val ? 'on' : '', onClick: () => { fn(v); el.querySelectorAll('span').forEach((x) => x.classList.toggle('on', x.textContent === l)); } }, l))); return el; };
    const sw = (val, fn) => { const el = h('div', { class: `switch ${val ? 'on' : ''}` }); el.addEventListener('click', () => { const v = !el.classList.contains('on'); el.classList.toggle('on', v); fn(v); }); return el; };
    const range = (val, fn) => { const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: val, style: { width: '160px' } }); r.addEventListener('input', () => fn(+r.value)); return r; };
    const row = (l, d, ctl) => h('div', { class: 'set-row' }, h('div', null, h('div', { class: 'l' }, l), d ? h('div', { class: 'd' }, d) : null), ctl);
    const body = h('div', { class: 'panel-body' },
      row('Syllabus tier', 'Core shows only Core objectives; Extended adds Supplement (S) content.', seg([['core', 'Core'], ['extended', 'Extended']], S.tier, (v) => { S.tier = v; save(); this.updateHUD(); game.world.refreshSky(); })),
      row('Graphics quality', 'Lower this if the game feels slow.', seg([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], S.quality, (v) => { S.quality = v; save(); game.engine.setQuality(v); })),
      row('Music & ambience', null, range(S.music, (v) => { S.music = v; audio.setVolumes({ music: v }); save(); })),
      row('Sound effects', null, range(S.sfx, (v) => { S.sfx = v; audio.setVolumes({ sfx: v }); save(); })),
      row('Day / night cycle', 'Night reveals the Constellation of Knowledge in the sky.', sw(S.cycle, (v) => { S.cycle = v; save(); })),
      row('Skip to night', 'See your constellation overhead right now.', h('button', { class: 'btn small', onClick: () => { state.time = 0.9; this.closeTopModal(); } }, '🌙 Night')),
      row('Teacher / free-play mode', 'Unlocks every experiment, model and fast-travel point.', sw(S.teacher, (v) => { S.teacher = v; save(); })),
      row('Text size', null, seg([[0.9, 'S'], [1, 'M'], [1.12, 'L']], S.textScale, (v) => { S.textScale = v; document.documentElement.style.setProperty('--ts', v); save(); })),
      row('About this game', `${SYLLABUS.name} · ${SYLLABUS.years}`, h('button', { class: 'btn small', onClick: () => this.openAbout() }, 'ℹ️ About')),
      row('Return to title', 'Your progress is saved automatically.', h('button', { class: 'btn small', onClick: () => { save(); location.reload(); } }, '↩ Title screen')),
      // two-click confirm in the page itself (browser confirm() dialogs are blocked in embedded viewers)
      row('Reset all progress', 'Permanently erases this save on this device.', h('button', { class: 'btn small danger', onClick: (e) => {
        const b = e.currentTarget;
        if (b.dataset.armed) { game.mode = 'title'; /* stops the unload autosave re-writing it */ store.del('catalyst.save.v1'); location.reload(); return; }
        b.dataset.armed = '1'; b.textContent = 'Click again to erase';
        setTimeout(() => { delete b.dataset.armed; b.textContent = 'Reset'; }, 4000);
      } }, 'Reset')));
    this.modal({ title: '⚙️ Settings', body, cls: 'panel narrow' });
  }

  openAbout() {
    const body = h('div', { class: 'panel-body', style: { lineHeight: 1.7 } },
      h('p', null, h('b', null, 'CATALYST — Mysteries of Brightwater Island'), ' is a 3D science adventure built around the ', h('b', null, `${SYLLABUS.name} (${SYLLABUS.years})`), '.'),
      h('p', { class: 'muted' }, `It maps all ${COUNTS.total} learning objectives (${COUNTS.core} Core, ${COUNTS.supplement} Supplement) across ${COUNTS.subtopics} sub-topics. ${SYLLABUS.note}`),
      h('p', null, 'Every quest is a real-life problem on the island. Investigate with ', h('b', null, 'field scans'), ', run ', h('b', null, 'virtual experiments'), ' in the Lumen Lab, explore ', h('b', null, '3D holo-models'), ', and solve ', h('b', null, 'cause-and-effect chains'), ' that link Biology, Chemistry and Physics. Each idea you learn becomes a star in the ', h('b', null, 'Constellation of Knowledge'), '; each connection you make draws a golden line between them.'),
      h('p', { class: 'faint' }, 'Mastery levels: ● discovered → ●● practised (experiment or model) → ●●● mastered (questions answered correctly). Progress is stored only in this browser.'));
    this.modal({ title: 'ℹ️ About CATALYST', body, cls: 'panel narrow' });
  }

  // ---------------------------------------------------------------- reward
  bigReward({ title, subtitle, xp, objectives = [], icon = '🏆', extra = null }) {
    return new Promise((resolve) => {
      this.modalCount++;
      audio.complete();
      const wrap = h('div', { class: 'big-reward' });
      const close = () => { wrap.remove(); this.modalCount--; resolve(); };
      wrap.append(h('div', { class: 'card glass' },
        h('div', { class: 'star' }, icon),
        h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, 'Quest complete'),
        h('h2', { style: { fontSize: '1.8em', margin: '6px 0' } }, title),
        subtitle ? h('p', { class: 'muted', style: { lineHeight: 1.6 }, html: rich(subtitle) }) : null,
        h('div', { class: 'row wrap', style: { justifyContent: 'center', gap: '6px', margin: '12px 0' } }, ...objectives.map((id) => this.chip(id))),
        extra,
        h('div', { style: { fontFamily: 'var(--display)', fontSize: '1.4em', color: 'var(--gold)', margin: '10px 0 16px' } }, `+${xp} XP`),
        h('button', { class: 'btn primary', onClick: close }, 'Continue')));
      this.layer.append(wrap);
    });
  }

  // ================================================================ delegates
  openCodex(subId = null, tab = null) { return openCodex(this, subId, tab); }
  quiz(opts) { return runQuiz(this, opts); }
  chain(def) { return runChain(this, def); }

  // ================================================================ title & new game
  showTitle({ onContinue, onNew }) {
    this.titleOpen = true;
    const saved = hasSave();
    const t = h('div', { id: 'title' },
      h('div', { class: 'logo' }, 'CATALYST'),
      h('div', { class: 'tag' }, 'Mysteries of Brightwater Island'),
      h('div', { class: 'desc' }, 'A 3D science adventure across Biology, Chemistry and Physics. Solve real-life mysteries for the islanders, run hands-on virtual experiments, and connect every idea into one Constellation of Knowledge.'),
      h('div', { class: 'menu' },
        saved ? h('button', { class: 'btn primary', onClick: () => { audio.init(); audio.click(); this.titleOpen = false; t.remove(); onContinue(); } }, '▶  Continue') : null,
        h('button', { class: `btn ${saved ? '' : 'primary'}`, onClick: () => { audio.init(); audio.click(); this._newGameDialog(t, onNew); } }, saved ? '✦  New game' : '▶  Start new game'),
        h('button', { class: 'btn', onClick: () => { audio.init(); this.openAbout(); } }, 'ℹ️  About & syllabus')),
      h('div', { class: 'badges' },
        h('span', { class: 'chip B' }, `🧬 Biology`), h('span', { class: 'chip C' }, `⚗️ Chemistry`), h('span', { class: 'chip P' }, `⚛️ Physics`),
        h('span', { class: 'chip gold' }, `${COUNTS.total} learning objectives`), h('span', { class: 'chip' }, 'IGCSE 0654')),
      h('div', { class: 'foot' }, 'Best with headphones · Mouse & keyboard or touch'));
    this.layer.append(t);
  }

  _newGameDialog(titleEl, onNew) {
    let tier = 'extended';
    const name = h('input', { type: 'text', placeholder: 'Your scientist name', maxlength: 18, value: '' });
    const opt = (v, t, d) => { const el = h('div', { class: `tier-opt ${v === tier ? 'on' : ''}`, onClick: () => { tier = v; el.parentNode.querySelectorAll('.tier-opt').forEach((x) => x.classList.remove('on')); el.classList.add('on'); } }, h('h4', null, t), h('p', null, d)); return el; };
    const body = h('div', { class: 'panel-body' },
      h('div', { class: 'eyebrow' }, 'Who are you?'), h('div', { style: { margin: '8px 0 18px' } }, name),
      h('div', { class: 'eyebrow' }, 'Choose your syllabus tier'),
      h('div', { class: 'tier-opts' }, opt('core', 'Core', `${COUNTS.core} Core objectives. Supplement content is shown as optional extras.`), opt('extended', 'Extended', `All ${COUNTS.total} objectives — Core plus Supplement (S). Recommended for A*–C.`)),
      h('p', { class: 'faint', style: { fontSize: '.85em' } }, 'You can change this any time in Settings.'),
      h('div', { class: 'row', style: { marginTop: '16px' } }, h('div', { class: 'grow' }), h('button', { class: 'btn primary', onClick: () => {
        const nm = name.value.trim() || 'Sam';
        m.close(); this.titleOpen = false; titleEl.remove();
        newGame(nm, tier); onNew();
      } }, 'Begin adventure ▸')));
    const m = this.modal({ title: 'New game', body, cls: 'panel narrow' });
    setTimeout(() => name.focus(), 50);
  }

  story(paragraphs) {
    return new Promise((resolve) => {
      this.modalCount++;
      const wrap = h('div', { class: 'modal-back', style: { background: 'rgba(3,5,12,.72)' } });
      const close = () => { if (!wrap.isConnected) return; wrap.remove(); this.modalCount--; resolve(); };
      wrap._close = close;
      wrap.append(h('div', { class: 'story glass' }, h('div', { class: 'eyebrow' }, 'Prologue'), ...paragraphs.map((p) => h('p', { html: rich(p) })),
        h('div', { class: 'row' }, h('div', { class: 'grow' }), h('button', { class: 'btn primary', onClick: close }, 'Step onto the island ▸'))));
      this.layer.append(wrap);
    });
  }
}
