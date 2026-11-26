import { h, clear, rich, shuffle } from '../core/util.js';
import { audio } from '../core/audio.js';
import { recordAnswer } from '../core/state.js';
import { SUBJECTS, SUB } from '../data/curriculum.js';
import { Graph } from './graph.js';

/**
 * Builds the side panel for a lab/holo module. Every control helper returns a
 * small handle so experiments stay compact.
 */
export class LabUI {
  constructor(root) {
    this.root = root;
    this.el = h('div', { class: 'hud hidden' });
    root.append(this.el);
  }

  mount(meta, { onExit, onReset, tabs, activeTab, onTab, done = {}, scenario, goalText } = {}) {
    clear(this.el); this.el.classList.remove('hidden');
    const S = SUBJECTS[meta.subject];
    this.top = h('div', { class: 'lab-top glass' },
      h('div', { style: { fontSize: '22px' } }, meta.icon),
      h('div', null, h('div', { class: 'ttl' }, meta.title), h('div', { class: 'loc' }, `${meta.kind === 'holo' ? 'Holo-Theatre' : 'Lumen Lab'} · ${S.name}`)),
      h('div', { style: { width: '12px' } }),
      h('button', { class: 'btn small', onClick: () => { audio.click(); onExit?.(); } }, '↩ Back to island'));
    this.panel = h('div', { class: 'lab-panel glass' });
    const head = h('div', { class: 'lp-head' },
      h('div', { class: 'eyebrow', style: { color: S.color } }, `${S.icon} ${S.name} · ${meta.kind === 'holo' ? '3D model' : 'Virtual experiment'}`),
      h('h2', null, meta.title),
      h('div', { class: 'row wrap', style: { gap: '4px' } }, ...meta.objectives.map((id) => h('span', { class: `chip ${id[0]}`, title: SUB[id]?.title || id }, id))),
      scenario ? h('div', { class: 'scen', html: '🌍 ' + rich(scenario) }) : null);
    this.tabsEl = null;
    if (tabs && tabs.length > 1) {
      this.tabsEl = h('div', { class: 'tabs', style: { marginTop: '10px', flexWrap: 'wrap' } });
      tabs.forEach(([id, label]) => this.tabsEl.append(h('div', { class: `tab ${id === activeTab ? 'on' : ''}`, 'data-id': id, onClick: () => { audio.click(); this.setTabActive(id); onTab?.(id); } }, `${done[id] ? '✓ ' : ''}${label}`)));
      head.append(this.tabsEl);
    }
    this.body = h('div', { class: 'lp-body' });
    const foot = h('div', { class: 'lp-foot' },
      onReset ? h('button', { class: 'btn small', onClick: () => { audio.click(); onReset(); } }, '⟲ Reset') : null,
      h('div', { class: 'grow' }),
      h('button', { class: 'btn small', onClick: () => { audio.click(); onExit?.(); } }, 'Exit'));
    this.panel.append(head, this.body, foot);
    this.hintEl = h('div', { class: 'lab-hint glass', style: { opacity: 0 } });
    this.goalEl = h('div', { class: 'lab-goal glass hidden' });
    this.el.append(this.top, this.panel, this.hintEl, this.goalEl);
    if (goalText) this.goal(goalText);
  }
  setTabActive(id) { this.tabsEl?.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.id === id)); }
  markTab(id) { const t = this.tabsEl?.querySelector(`.tab[data-id="${id}"]`); if (t && !t.textContent.startsWith('✓')) t.textContent = '✓ ' + t.textContent; }
  hide() { this.el.classList.add('hidden'); clear(this.el); }
  reset() { clear(this.body); this._notes = null; }

  // ------------------------------------------------------------ layout
  section(title, parent = this.body) {
    const s = h('div', { class: 'lp-sec' }, h('div', { class: 'st' }, title));
    parent.append(s);
    return s;
  }
  text(html, parent = this.body) { const p = h('div', { class: 'muted', style: { fontSize: '.88em', lineHeight: 1.55, margin: '6px 0' }, html: rich(html) }); parent.append(p); return p; }
  hint(text, ms = 0) {
    this.hintEl.innerHTML = rich(text || ''); this.hintEl.style.opacity = text ? 1 : 0;
    clearTimeout(this._ht); if (ms) this._ht = setTimeout(() => { this.hintEl.style.opacity = 0; }, ms);
  }
  goal(text) { if (!text) { this.goalEl.classList.add('hidden'); return; } this.goalEl.classList.remove('hidden'); this.goalEl.innerHTML = `<div class="gt">◆ Quest objective</div>${rich(text)}`; }

  steps(list, parent) {
    const sec = this.section('Procedure', parent);
    const box = h('div', { class: 'lp-steps' });
    const items = list.map((t) => h('div', { class: 'lp-step' }, h('span', { class: 'ck' }), h('span', { html: rich(t) })));
    box.append(...items); sec.append(box);
    const doneSet = new Set();
    const refresh = () => { let cur = -1; items.forEach((el, i) => { const d = doneSet.has(i); el.classList.toggle('done', d); el.querySelector('.ck').textContent = d ? '✓' : ''; if (!d && cur < 0) cur = i; el.classList.toggle('cur', i === cur); }); };
    refresh();
    return { done: (i) => { if (!doneSet.has(i)) { doneSet.add(i); audio.clink(); refresh(); } }, isDone: (i) => doneSet.has(i), all: () => doneSet.size === list.length, count: () => doneSet.size };
  }

  // ------------------------------------------------------------ controls
  slider({ label, min, max, step = 1, value, unit = '', fmt = null, onInput, parent = this.body }) {
    const f = fmt || ((v) => `${+(+v).toFixed(4)}`);
    const val = h('b', null, f(value) + (unit ? ' ' + unit : ''));
    const inp = h('input', { type: 'range', min, max, step, value });
    inp.addEventListener('input', () => { val.textContent = f(+inp.value) + (unit ? ' ' + unit : ''); onInput?.(+inp.value); });
    const el = h('div', { class: 'ctl' }, h('div', { class: 'lbl' }, h('span', null, label), val), inp);
    parent.append(el);
    return { el, get: () => +inp.value, set: (v, fire = false) => { inp.value = v; val.textContent = f(+v) + (unit ? ' ' + unit : ''); if (fire) onInput?.(+v); }, disable: (d) => { inp.disabled = d; } };
  }
  select({ label, options, value, onChange, parent = this.body }) {
    const sel = h('select', { style: { width: '100%' } }, ...options.map(([v, l]) => h('option', { value: v, selected: v === value ? true : null }, l)));
    sel.addEventListener('change', () => { audio.click(); onChange?.(sel.value); });
    const el = h('div', { class: 'ctl' }, h('div', { class: 'lbl' }, h('span', null, label)), sel);
    parent.append(el);
    return { el, get: () => sel.value, set: (v) => { sel.value = v; } };
  }
  seg({ label, options, value, onChange, parent = this.body }) {
    const wrap = h('div', { class: 'seg', style: { flexWrap: 'wrap' } });
    let cur = value;
    const spans = options.map(([v, l]) => { const s = h('span', { class: v === value ? 'on' : '', onClick: () => { audio.click(); cur = v; spans.forEach((x) => x.classList.toggle('on', x === s)); onChange?.(v); } }, l); return s; });
    wrap.append(...spans);
    const el = h('div', { class: 'ctl' }, label ? h('div', { class: 'lbl' }, h('span', null, label)) : null, wrap);
    parent.append(el);
    return { el, get: () => cur, set: (v) => { cur = v; spans.forEach((x, i) => x.classList.toggle('on', options[i][0] === v)); } };
  }
  buttons(list, parent = this.body) {
    const row = h('div', { class: 'ctl-row' });
    const out = list.map((b) => { const el = h('button', { class: `btn small ${b.kind || ''}`, onClick: () => { audio.click(); b.onClick?.(); } }, b.label); row.append(el); return el; });
    parent.append(row);
    return out;
  }
  readouts(list, parent = this.body) {
    const grid = h('div', { class: 'readouts' });
    const map = {};
    for (const r of list) { const v = h('div', { class: 'rv' }, r.value ?? '—'); grid.append(h('div', { class: 'readout' }, h('div', { class: 'rl' }, r.label), v)); map[r.id] = { v, unit: r.unit || '' }; }
    parent.append(grid);
    return { set: (id, val) => { const m = map[id]; if (m) m.v.textContent = typeof val === 'number' ? `${+val.toFixed(3)}${m.unit ? ' ' + m.unit : ''}` : `${val}${m.unit && val !== '—' ? ' ' + m.unit : ''}`; } };
  }
  table(columns, parent = this.body) {
    const tb = h('tbody');
    const wrap = h('div', { class: 'table-wrap' }, h('table', { class: 'dtable' }, h('thead', null, h('tr', null, ...columns.map((c) => h('th', null, c)))), tb));
    parent.append(wrap);
    const rows = [];
    return {
      el: wrap, rows,
      add(cells) { rows.push(cells); const tr = h('tr', null, ...cells.map((c) => h('td', { html: String(c) }))); tb.append(tr); wrap.scrollTop = wrap.scrollHeight; return tr; },
      clear() { rows.length = 0; clear(tb); },
    };
  }
  graph(opts, parent = this.body) { const g = new Graph(opts); parent.append(g.el); return g; }
  notes(parent = this.body) {
    const sec = this.section('Observations', parent);
    this._notes = h('div', { class: 'notes' }); sec.append(this._notes);
    return this._notes;
  }
  note(text, kind = '') {
    if (!this._notes) this.notes();
    const n = h('div', { class: `note ${kind}`, html: rich(text) });
    this._notes.prepend(n);
    while (this._notes.children.length > 8) this._notes.lastChild.remove();
    return n;
  }

  /**
   * Analysis questions. list: [{ q, opts:[correct,...] } | { q, ans, tol, unit }], plus optional sub & o (objective numbers).
   * onDone is called once every question is answered correctly.
   */
  questions(list, { sub, onDone, title = 'Analysis', parent = this.body } = {}) {
    const sec = this.section(title, parent);
    let solved = 0;
    const tick = () => { solved++; if (solved === list.length) onDone?.(); };
    for (const item of list) {
      const box = h('div', { class: 'aq' }, h('div', { class: 'qq', html: rich(item.q) }));
      const fb = h('div', { class: 'fb' });
      const ids = (item.o || []).map((n) => `${item.sub || sub}.${n}`);
      const credit = (ok) => recordAnswer(ok, ids.length ? ids : [item.sub || sub]);
      if (item.opts) {
        const order = shuffle(item.opts.map((t, k) => ({ t, k })));
        let tries = 0;
        order.forEach(({ t, k }) => {
          const b = h('button', { class: 'ao', html: rich(t), onClick: () => {
            if (box.classList.contains('solved')) return;
            if (k === 0) { b.classList.add('right'); box.classList.add('solved'); fb.innerHTML = '✅ ' + rich(item.e || 'Correct.'); audio.success(); credit(tries === 0); tick(); }
            else { b.classList.add('wrong'); tries++; fb.innerHTML = '❌ ' + rich(item.hint || 'Not quite — look at your data again.'); audio.fail(); }
          } });
          box.append(b);
        });
      } else {
        const inp = h('input', { type: 'text', placeholder: item.unit ? `answer in ${item.unit}` : 'answer', inputmode: 'decimal' });
        let tries = 0;
        const go = h('button', { class: 'btn small primary', onClick: () => {
          if (box.classList.contains('solved')) return;
          const v = parseFloat(String(inp.value).replace(/[^0-9eE+\-.]/g, ''));
          if (Number.isNaN(v)) return;
          const target = typeof item.ans === 'function' ? item.ans() : item.ans;
          if (target == null) { fb.innerHTML = 'Collect your data first.'; return; }
          const ok = Math.abs(v - target) <= Math.abs(target) * (item.tol ?? 0.05) + (item.abs ?? 1e-9);
          if (ok) { box.classList.add('solved'); fb.innerHTML = '✅ ' + rich(item.e ? item.e.replace('{ans}', +target.toPrecision(3)) : 'Correct.'); audio.success(); credit(tries === 0); tick(); }
          else { tries++; fb.innerHTML = '❌ ' + rich(tries > 1 && item.e ? 'Hint: ' + item.e.replace('{ans}', '?') : 'Check your calculation.'); audio.fail(); }
        } }, 'Check');
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
        box.append(h('div', { class: 'num' }, inp, item.unit ? h('span', { class: 'faint', style: { alignSelf: 'center' } }, item.unit) : null, go));
      }
      box.append(fb);
      sec.append(box);
    }
    return sec;
  }
}
