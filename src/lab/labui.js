import { h, clear, rich, shuffle } from '../core/util.js';
import { audio } from '../core/audio.js';
import { recordAnswer, requiredFor, raise, tierOK } from '../core/state.js';
import { SUBJECTS, SUB } from '../data/curriculum.js';
import { Graph } from './graph.js';
import { practicalFor } from './practical.js';

/**
 * Builds the side panel for a lab/holo module. Every control helper returns a
 * small handle so experiments stay compact.
 */
export class LabUI {
  constructor(root) {
    this.root = root;
    this.el = h('div', { class: 'hud hidden' });
    root.append(this.el);
    /** What a checklist does once its required steps are done; the experiment sets it (complete, or finish this tab). */
    this.stepsTarget = null;
    /** The open tab (null for an experiment without tabs): it picks the checklist's practical objectives. */
    this.tab = null;
    this.qsets = []; this.checklists = [];
  }

  mount(meta, { onExit, onReset, tabs, activeTab, onTab, done = {}, scenario, goalText } = {}) {
    clear(this.el); this.el.classList.remove('hidden');
    this.meta = meta; this.qsets = []; this.checklists = []; this.trialLabel = null; this.tab = null;
    const S = SUBJECTS[meta.subject];
    this.top = h('div', { class: 'lab-top glass' },
      h('div', { style: { fontSize: '22px' }, 'aria-hidden': 'true' }, meta.icon),
      h('div', null, h('div', { class: 'ttl' }, meta.title), h('div', { class: 'loc' }, `${meta.kind === 'holo' ? 'Holo-Theatre' : 'Lumen Lab'} · ${S.name}`)),
      h('div', { style: { width: '12px' } }),
      h('button', { type: 'button', class: 'btn small', onClick: () => { audio.click(); onExit?.(); } }, '↩ Back to island'));
    this.panel = h('div', { class: 'lab-panel glass', role: 'region', 'aria-label': `${meta.title} controls` });
    this.heading = h('h2', { tabindex: '-1' }, meta.title);
    const head = h('div', { class: 'lp-head' },
      h('div', { class: 'eyebrow', style: { color: S.color } }, `${S.icon} ${S.name} · ${meta.kind === 'holo' ? '3D model' : 'Virtual experiment'}`),
      this.heading,
      h('div', { class: 'row wrap', style: { gap: '4px' } }, ...meta.objectives.map((id) => h('span', { class: `chip ${id[0]}`, title: SUB[id]?.title || id }, id))),
      scenario ? h('div', { class: 'scen', html: '🌍 ' + rich(scenario) }) : null);
    this.tabsEl = null;
    if (tabs && tabs.length > 1) {
      this.tabsEl = h('div', { class: 'tabs', style: { marginTop: '10px', flexWrap: 'wrap' } });
      tabs.forEach(([id, label]) => this.tabsEl.append(h('button', { type: 'button', class: `tab ${id === activeTab ? 'on' : ''}`, 'data-id': id, 'aria-pressed': String(id === activeTab), onClick: () => { audio.click(); this.setTabActive(id); onTab?.(id); } }, `${done[id] ? '✓ ' : ''}${label}`)));
      head.append(this.tabsEl);
    }
    this.body = h('div', { class: 'lp-body' });
    const foot = h('div', { class: 'lp-foot' },
      onReset ? h('button', { type: 'button', class: 'btn small', onClick: () => { audio.click(); onReset(); } }, '⟲ Reset') : null,
      h('div', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn small', onClick: () => { audio.click(); onExit?.(); } }, 'Exit'));
    this.panel.append(head, this.body, foot);
    this.hintEl = h('div', { class: 'lab-hint glass', style: { opacity: 0 }, role: 'status' });
    this.goalEl = h('div', { class: 'lab-goal glass hidden' });
    this.el.append(this.top, this.panel, this.hintEl, this.goalEl);
    if (goalText) this.goal(goalText);
  }
  /** Move keyboard focus into the panel (its heading), so Tab continues through the lab's controls. */
  focusStart() { this.heading?.focus({ preventScroll: true }); }
  setTabActive(id) { this.tabsEl?.querySelectorAll('.tab').forEach((t) => { const on = t.dataset.id === id; t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on)); }); }
  markTab(id) { const t = this.tabsEl?.querySelector(`.tab[data-id="${id}"]`); if (t && !t.textContent.startsWith('✓')) t.textContent = '✓ ' + t.textContent; }
  hide() { this.el.classList.add('hidden'); clear(this.el); }
  reset() { clear(this.body); this._notes = null; this.trialLabel = null; }

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

  /**
   * Procedure checklist. Items are 'text' or { t: 'text', o: [objective ids], q: true }. A step whose objectives
   * are Supplement is an optional extra on the Core tier. Every done(i) runs one shared check, and the
   * checklist's target (complete the experiment, or finish this tab) runs once, when every required
   * step is done, whatever order the steps were done in.
   *
   * Practical evidence comes from the hands-on steps, never from answers. A step ticked by answering the
   * analysis questions ("Answer the analysis questions", or flagged `q: true`) is not practical work. When
   * every required hands-on step is done, the checklist's practical objectives (practical.js) are credited;
   * a hands-on step that names its own objectives (`o`) is credited for them when it is done.
   */
  steps(list, { onComplete = this.stepsTarget, parent } = {}) {
    const sec = this.section('Procedure', parent);
    const box = h('div', { class: 'lp-steps' });
    const items = list.map((it) => (typeof it === 'string' ? { t: it, o: [] } : { o: [], ...it }));
    const required = items.map((it) => requiredFor(it.o));
    const byAnswer = items.map((it) => !!it.q || /analysis questions/i.test(it.t));
    const practical = practicalFor(this.meta?.id, this.tab);
    const els = items.map((it, i) => h('div', { class: `lp-step${required[i] ? '' : ' optional'}` }, h('span', { class: 'ck' }), h('span', { html: rich(it.t) }), required[i] ? null : h('span', { class: 'chip S opt' }, 'optional')));
    box.append(...els); sec.append(box);
    const doneSet = new Set();
    let fired = false, practised = false;
    const refresh = () => { let cur = -1; els.forEach((el, i) => { const d = doneSet.has(i); el.classList.toggle('done', d); el.querySelector('.ck').textContent = d ? '✓' : ''; if (!d && cur < 0 && required[i]) cur = i; el.classList.toggle('cur', i === cur); }); };
    const all = () => required.every((r, i) => !r || doneSet.has(i));
    const check = () => { if (!fired && all()) { fired = true; onComplete?.(); } return fired; };
    const handsOnDone = () => items.every((_, i) => byAnswer[i] || !required[i] || doneSet.has(i)) && items.some((_, i) => !byAnswer[i] && doneSet.has(i));
    const credit = (i) => {
      if (i != null && !byAnswer[i] && items[i].o.length) raise(items[i].o, 2, 'lab');
      if (!practised && practical.length && handsOnDone()) { practised = true; const ids = practical.filter(tierOK); if (ids.length) raise(ids, 2, 'lab'); }
    };
    /** The step asks only for Supplement work on this tier: it becomes an optional extra instead of being ticked. */
    const waive = (i) => {
      if (!required[i] || doneSet.has(i)) return;
      required[i] = false; els[i].classList.add('optional');
      if (!els[i].querySelector('.opt')) els[i].append(h('span', { class: 'chip S opt' }, 'optional'));
      refresh();
      credit(null);
    };
    refresh();
    const handle = {
      done: (i) => { if (this.waiving) waive(i); else if (!doneSet.has(i)) { doneSet.add(i); audio.clink(); refresh(); credit(i); } check(); },
      isDone: (i) => doneSet.has(i), isRequired: (i) => required[i], all, check, count: () => doneSet.size,
      practised: () => practised, byAnswer: (i) => byAnswer[i], items: () => items.map((it) => it.t),
    };
    this.checklists.push({ sec, handle });
    return handle;
  }

  // ------------------------------------------------------------ controls
  slider({ label, min, max, step = 1, value, unit = '', fmt = null, onInput, parent = this.body }) {
    const f = fmt || ((v) => `${+(+v).toFixed(4)}`);
    const val = h('b', null, f(value) + (unit ? ' ' + unit : ''));
    const inp = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
    inp.addEventListener('input', () => { val.textContent = f(+inp.value) + (unit ? ' ' + unit : ''); onInput?.(+inp.value); });
    const el = h('div', { class: 'ctl' }, h('div', { class: 'lbl' }, h('span', null, label), val), inp);
    parent.append(el);
    return { el, get: () => +inp.value, set: (v, fire = false) => { inp.value = v; val.textContent = f(+v) + (unit ? ' ' + unit : ''); if (fire) onInput?.(+v); }, disable: (d) => { inp.disabled = d; } };
  }
  select({ label, options, value, onChange, parent = this.body }) {
    const sel = h('select', { style: { width: '100%' }, 'aria-label': label }, ...options.map(([v, l]) => h('option', { value: v, selected: v === value ? true : null }, l)));
    sel.addEventListener('change', () => { audio.click(); onChange?.(sel.value); });
    const el = h('div', { class: 'ctl' }, h('div', { class: 'lbl' }, h('span', null, label)), sel);
    parent.append(el);
    return { el, get: () => sel.value, set: (v) => { sel.value = v; }, disable: (d) => { sel.disabled = d; } };
  }
  /** Segmented choice: native buttons, so it works with Tab, Enter and Space. */
  seg({ label, options, value, onChange, parent = this.body }) {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label || null, style: { flexWrap: 'wrap' } });
    let cur = value;
    const mark = () => btns.forEach((b, i) => { const on = options[i][0] === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const btns = options.map(([v, l]) => h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': String(v === value), onClick: (e) => { if (e.currentTarget.disabled) return; audio.click(); cur = v; mark(); onChange?.(v); } }, l));
    wrap.append(...btns);
    const el = h('div', { class: 'ctl' }, label ? h('div', { class: 'lbl' }, h('span', null, label)) : null, wrap);
    parent.append(el);
    return { el, get: () => cur, set: (v) => { cur = v; mark(); }, disable: (d) => btns.forEach((b) => { b.disabled = d; }) };
  }
  buttons(list, parent = this.body) {
    const row = h('div', { class: 'ctl-row' });
    const out = list.map((b) => { const el = h('button', { type: 'button', class: `btn small ${b.kind || ''}`, onClick: () => { audio.click(); b.onClick?.(); } }, b.label); row.append(el); return el; });
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
   * Start a new trial (a new run of the experiment). An answer read from the previous trial's data is
   * no longer shown as the answer for this one: it moves to a history line, the box can be answered again
   * from the new data, and the progress and evidence it earned are kept.
   */
  newTrial(label) {
    const prev = this.trialLabel;
    this.trialLabel = label;
    for (const set of this.qsets) for (const rec of set.items) rec.rebind?.(prev);
  }

  /**
   * Analysis questions. list: [{ q, opts:[correct,...] } | { q, ans, tol, unit }], plus optional sub & o (objective numbers).
   * A question whose objectives are Supplement is an optional extra on the Core tier. onDone runs once,
   * when every required question has been answered correctly. Answers are recorded as evidence, once per
   * question; they never count as practical work (see steps()).
   * `ans` may be a function of the data collected so far; it returns null when the current data cannot answer
   * it, and `unavailable()` then says why. Such answers belong to the trial they were read from (newTrial).
   */
  questions(list, { sub, onDone, title = 'Analysis', parent = this.body } = {}) {
    const sec = this.section(title, parent);
    const set = { sec, items: [] };
    this.qsets.push(set);
    let fired = false, optionalOnly = false;
    // done when every required question is solved; a set of optional extras only counts when all are solved
    const check = () => { if (!fired && set.items.every((x) => x.solved || (!x.required && !optionalOnly))) { fired = true; onDone?.(); } };
    for (const item of list) {
      const ids = (item.o || []).map((n) => `${item.sub || sub}.${n}`);
      const tested = ids.length ? ids : [item.sub || sub];
      const required = requiredFor(ids);
      const rec = { item, ids: tested, required, solved: false, credited: false, tries: 0, answered: null };
      set.items.push(rec);
      const box = h('div', { class: `aq${required ? '' : ' optional'}` },
        required ? null : h('div', { class: 'aq-opt' }, h('span', { class: 'chip S' }, 'Supplement'), ' optional extra'),
        h('div', { class: 'qq', html: rich(item.q) }));
      const fb = h('div', { class: 'fb', role: 'status' });
      const key = `lab:${this.meta?.id || 'lab'}:${item.q}`;
      // first-time correctness is judged once per question: answering it again later is not new evidence
      const credit = (ok) => { if (rec.credited) return; rec.credited = true; recordAnswer(ok, tested, { key, source: 'lab' }); };
      const solve = () => { rec.solved = true; box.classList.add('solved'); check(); };
      if (item.opts) {
        const order = shuffle(item.opts.map((t, k) => ({ t, k })));
        order.forEach(({ t, k }) => {
          const b = h('button', { type: 'button', class: 'ao', html: rich(t), onClick: () => {
            if (box.classList.contains('solved')) return;
            if (k === 0) { b.classList.add('right'); fb.innerHTML = '✅ ' + rich(item.e || 'Correct.'); audio.success(); credit(rec.tries === 0); solve(); }
            else { b.classList.add('wrong'); rec.tries++; fb.innerHTML = '❌ ' + rich(item.hint || 'Not quite — look at your data again.'); audio.fail(); }
          } });
          box.append(b);
        });
      } else {
        const inp = h('input', { type: 'text', placeholder: item.unit ? `answer in ${item.unit}` : 'answer', inputmode: 'decimal', 'aria-label': 'Answer' });
        const hist = h('div', { class: 'aq-hist' });
        const go = h('button', { type: 'button', class: 'btn small primary', onClick: () => {
          if (box.classList.contains('solved')) return;
          const v = parseFloat(String(inp.value).replace(/[^0-9eE+\-.]/g, ''));
          if (Number.isNaN(v)) return;
          const target = typeof item.ans === 'function' ? item.ans() : item.ans;
          if (target == null) { fb.innerHTML = rich(item.unavailable?.() || 'Collect your data first.'); return; }
          const ok = Math.abs(v - target) <= Math.abs(target) * (item.tol ?? 0.05) + (item.abs ?? 1e-9);
          if (ok) {
            fb.innerHTML = '✅ ' + rich(item.e ? item.e.replace('{ans}', +target.toPrecision(3)) : 'Correct.'); audio.success();
            rec.answered = { trial: this.trialLabel, text: `${inp.value.trim()}${item.unit ? ' ' + item.unit : ''}` };
            hist.textContent = '';
            credit(rec.tries === 0); solve();
          } else { rec.tries++; fb.innerHTML = '❌ ' + rich(rec.tries > 1 && item.e ? 'Hint: ' + item.e.replace('{ans}', '?') : 'Check your calculation.'); audio.fail(); }
        } }, 'Check');
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
        box.append(h('div', { class: 'num' }, inp, item.unit ? h('span', { class: 'faint', style: { alignSelf: 'center' } }, item.unit) : null, go), hist);
        if (typeof item.ans === 'function') {
          // a new trial: what was shown for the old data becomes history, and the box is answerable again
          rec.rebind = (prev) => {
            if (rec.answered && rec.answered.trial === prev) hist.textContent = `${prev || 'Earlier run'} (an earlier run): ✅ ${rec.answered.text} was correct for that run. Read this run’s graphs to answer again.`;
            box.classList.remove('solved'); fb.innerHTML = ''; inp.value = ''; rec.tries = 0;
          };
        }
      }
      box.append(fb);
      sec.append(box);
    }
    // A set made only of Supplement questions asks nothing of a Core learner: whatever step it feeds
    // becomes an optional extra (not ticked). Answering all of them still ticks that step.
    if (set.items.length && set.items.every((x) => !x.required)) {
      optionalOnly = true;
      queueMicrotask(() => { this.waiving = true; try { onDone?.(); } finally { this.waiving = false; } });
    }
    return sec;
  }
}
