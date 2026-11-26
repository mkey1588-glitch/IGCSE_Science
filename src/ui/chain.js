import { h, clear, rich, shuffle } from '../core/util.js';
import { audio } from '../core/audio.js';
import { sparkLink, raise, state, save, addXP } from '../core/state.js';
import { SUB } from '../data/curriculum.js';

/**
 * Cause-and-effect chain puzzle. The player orders cards from cause to effect;
 * each card is tagged with the sub-topic it draws on, so a solved chain makes
 * cross-subject links explicit (and sparks them in the Constellation).
 * def: { id, title, prompt, cards: [[text, tag], ...] (correct order), spark: [linkIds] }
 */
export function runChain(ui, def) {
  return new Promise((resolve) => {
    const cards = def.cards.map(([t, tag], i) => ({ t, tag, i }));
    let order = shuffle(cards);
    if (order.every((c, k) => c.i === k)) order = order.reverse();
    let tries = 0, solved = false;
    const wrap = h('div', { class: 'chain' });
    const m = ui.modal({ title: `🔗 ${def.title}`, body: h('div', { class: 'panel-body', style: { display: 'flex', justifyContent: 'center' } }, wrap), cls: 'panel mid', onClose: () => resolve(solved) });
    let dragIdx = null;
    const render = (marks = null) => {
      clear(wrap);
      wrap.append(h('div', { class: 'muted', style: { lineHeight: 1.6 }, html: rich(def.prompt) }),
        h('div', { class: 'faint', style: { fontSize: '.85em', marginTop: '6px' } }, 'Drag the cards (or use ▲▼) so each step causes the next — from the first cause at the top to the final effect at the bottom.'));
      const slots = h('div', { class: 'slots' });
      order.forEach((c, k) => {
        const st = SUB[c.tag];
        const card = h('div', { class: `card ${marks ? (marks[k] ? 'ok' : 'bad') : ''}`, draggable: 'true' },
          h('span', { class: 'n' }, String(k + 1)),
          h('div', { class: 'grow' }, h('div', { html: rich(c.t) }), h('div', { style: { marginTop: '5px' } }, h('span', { class: `chip ${c.tag[0]}` }, `${c.tag} ${st?.title || ''}`))),
          h('div', { class: 'mv' },
            h('button', { onClick: (e) => { e.stopPropagation(); if (k > 0) { [order[k - 1], order[k]] = [order[k], order[k - 1]]; audio.click(); render(); } } }, '▲'),
            h('button', { onClick: (e) => { e.stopPropagation(); if (k < order.length - 1) { [order[k + 1], order[k]] = [order[k], order[k + 1]]; audio.click(); render(); } } }, '▼')));
        card.addEventListener('dragstart', () => { dragIdx = k; card.style.opacity = '0.5'; });
        card.addEventListener('dragend', () => { card.style.opacity = ''; });
        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('sel'); });
        card.addEventListener('dragleave', () => card.classList.remove('sel'));
        card.addEventListener('drop', (e) => { e.preventDefault(); if (dragIdx == null || dragIdx === k) return; const [x] = order.splice(dragIdx, 1); order.splice(k, 0, x); dragIdx = null; audio.click(); render(); });
        slots.append(card);
        if (k < order.length - 1) slots.append(h('div', { class: 'arrow' }, '▼ causes'));
      });
      wrap.append(slots);
      const fb = h('div', { class: 'muted', style: { marginTop: '12px', minHeight: '22px' } });
      const btn = h('button', { class: 'btn primary', style: { marginTop: '8px' }, onClick: () => check(fb) }, 'Check the chain');
      wrap.append(fb, h('div', { class: 'row' }, h('div', { class: 'grow' }), btn));
    };
    const check = () => {
      const marks = order.map((c, k) => c.i === k);
      tries++;
      if (marks.every(Boolean)) {
        solved = true; audio.connect();
        render(marks);
        for (const id of def.spark || []) sparkLink(id);
        raise([...new Set(cards.map((c) => c.tag))], 2, 'chain');
        state.stats.chains++; save();
        addXP(40, 'chain');
        const done = h('div', { class: 'expl', style: { marginTop: '14px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,209,102,.08)', border: '1px solid rgba(255,209,102,.3)', lineHeight: 1.6 } },
          '✨ ', h('b', null, 'Chain complete! '), def.outro ? h('span', { html: rich(def.outro) }) : 'Every link in this chain is a connection between ideas — they now glow in your Constellation.');
        wrap.append(done, h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'grow' }), h('button', { class: 'btn gold', onClick: () => m.close() }, 'Continue ▸')));
        wrap.querySelector('.btn.primary')?.remove();
      } else {
        audio.fail();
        // hint: after 2 tries, fix the first wrong card into place
        if (tries >= 2) { const k = marks.findIndex((x) => !x); const j = order.findIndex((c) => c.i === k); [order[k], order[j]] = [order[j], order[k]]; }
        render(order.map((c, k) => c.i === k));
        const n = order.filter((c, k) => c.i === k).length;
        wrap.querySelector('.muted:last-of-type');
        const fb = wrap.querySelectorAll('.muted');
        fb[fb.length - 1].innerHTML = `${n} of ${order.length} cards are in the right place${tries >= 2 ? ' — I fixed one for you.' : '.'} Think about what must happen <b>first</b>.`;
      }
    };
    render();
  });
}
