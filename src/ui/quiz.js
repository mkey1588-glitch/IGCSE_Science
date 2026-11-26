import { h, clear, rich, shuffle } from '../core/util.js';
import { audio } from '../core/audio.js';
import { state, recordAnswer, raise } from '../core/state.js';
import { questionsFor } from '../data/questions.js';
import { SUB } from '../data/curriculum.js';

/**
 * Runs an exam-style quiz. opts: { title, subs: [subTopicIds], n, pass, intro }
 * Resolves { correct, total, passed }.
 */
export function runQuiz(ui, { title = 'Challenge', subs, n = 3, pass = null, intro = null }) {
  return new Promise((resolve) => {
    const qs = questionsFor(subs, n, state.settings.tier);
    if (!qs.length) { ui.toast('ℹ️', 'No questions available for this topic yet.'); resolve({ correct: 0, total: 0, passed: true }); return; }
    const need = pass ?? Math.ceil(qs.length * 0.6);
    let i = 0, correct = 0;
    const results = [];
    const card = h('div', { class: 'quiz' });
    const m = ui.modal({ title: `🎯 ${title}`, body: h('div', { class: 'panel-body', style: { display: 'flex', justifyContent: 'center' } }, card), cls: 'panel mid', onClose: () => resolve({ correct, total: qs.length, passed: correct >= need }) });
    const render = () => {
      clear(card);
      const q = qs[i];
      const prog = h('div', { class: 'prog' }, ...qs.map((_, k) => h('i', { class: k < i ? (results[k] ? 'ok' : 'no') : k === i ? 'cur' : '' })));
      const st = SUB[q.t];
      card.append(prog, h('div', { class: 'row', style: { marginTop: '14px', gap: '6px' } }, h('span', { class: `chip ${q.t[0]}` }, `${q.t} ${st?.title || ''}`), q.s ? h('span', { class: 'chip S' }, 'Supplement') : null, q.gen ? h('span', { class: 'chip' }, '🔢 calculation') : null),
        intro && i === 0 ? h('div', { class: 'muted', style: { marginTop: '10px' }, html: rich(intro) }) : null,
        h('div', { class: 'q', html: rich(q.q) }));
      const expl = h('div', { class: 'expl hidden' });
      const next = h('button', { class: 'btn primary hidden', style: { marginTop: '14px' }, onClick: () => { i++; if (i >= qs.length) finish(); else render(); } }, i === qs.length - 1 ? 'See results ▸' : 'Next question ▸');
      const answered = (ok, shown) => {
        results[i] = ok; if (ok) correct++;
        recordAnswer(ok, q.o && q.o.length ? q.o.map((k) => `${q.t}.${k}`) : [q.t]);
        if (!ok) raise([q.t], 1, 'quiz');
        ok ? audio.success() : audio.fail();
        expl.classList.remove('hidden');
        expl.innerHTML = (ok ? '✅ <b>Correct.</b> ' : `❌ <b>Not quite.</b> ${shown ? `The answer is <b>${shown}</b>. ` : ''}`) + rich(q.e || '');
        next.classList.remove('hidden');
      };
      if (q.o_ && q.opts) {
        // (unused branch kept for clarity)
      }
      if (q.opts) {
        const order = shuffle(q.opts.map((t, k) => ({ t, k })));
        const box = h('div', { class: 'opts' });
        order.forEach(({ t, k }) => {
          const b = h('button', { class: 'opt', html: rich(t), onClick: () => {
            if (box.dataset.done) return; box.dataset.done = '1';
            const ok = k === q.a;
            b.classList.add(ok ? 'right' : 'wrong');
            if (!ok) [...box.children][order.findIndex((x) => x.k === q.a)].classList.add('right');
            answered(ok, null);
          } });
          box.append(b);
        });
        card.append(box);
      } else {
        const inp = h('input', { type: 'text', placeholder: 'Your answer', inputmode: 'decimal' });
        const go = h('button', { class: 'btn primary', onClick: () => submit() }, 'Check');
        const submit = () => {
          if (go.disabled) return;
          const v = parseFloat(String(inp.value).replace(/[^0-9eE+\-.]/g, ''));
          if (Number.isNaN(v)) { inp.focus(); return; }
          go.disabled = true; inp.disabled = true;
          const tol = q.tol ?? 0.02;
          const ok = Math.abs(v - q.ans) <= Math.abs(q.ans) * tol + 1e-9 + (q.abs || 0);
          answered(ok, `${+q.ans.toPrecision(4)} ${q.unit || ''}`);
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        card.append(h('div', { class: 'num' }, inp, q.unit ? h('span', { class: 'muted' }, q.unit) : null, go));
        setTimeout(() => inp.focus(), 60);
      }
      card.append(expl, next);
    };
    const finish = () => {
      clear(card);
      const passed = correct >= need;
      card.append(h('div', { style: { textAlign: 'center' } },
        h('div', { style: { fontSize: '48px' } }, passed ? '🏅' : '📘'),
        h('h2', { style: { margin: '8px 0' } }, `${correct} / ${qs.length} correct`),
        h('p', { class: 'muted' }, passed ? 'Great work — those objectives are now marked as mastered.' : `You need ${need} to pass. Review the lesson and try again — new questions are drawn each time.`),
        h('button', { class: 'btn primary', style: { marginTop: '10px' }, onClick: () => m.close() }, passed ? 'Continue' : 'Close')));
    };
    render();
  });
}
