import { describe, it, expect } from 'vitest';
import { freshGame, flush } from './helpers/harness.js';

// Every experiment and model, opened on both tiers: it builds, and its "(S)"-labelled steps and
// questions are exactly the ones the syllabus data marks Supplement (optional on the Core tier).
const { META } = await import('../../src/lab/registry.js');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

async function openEveryTab(ctx, m) {
  const out = { steps: [], questions: [], errors: [] };
  const collect = (tab) => {
    const el = ctx.game.lab.ui.el;
    const sets = ctx.game.lab.ui.qsets.filter((s) => s.sec.isConnected);
    const allSupplementSet = sets.some((s) => s.items.length && s.items.every((q) => !q.required));
    for (const s of el.querySelectorAll('.lp-step')) out.steps.push({ tab, text: norm(s.children[1].textContent), optional: s.classList.contains('optional'), done: s.classList.contains('done'), allSupplementSet });
    for (const set of sets) for (const q of set.items) out.questions.push({ text: q.item.q, required: q.required, ids: q.ids });
  };
  const ok = await ctx.game.lab.open(m.id);
  if (!ok) { out.errors.push('did not open'); return out; }
  await flush();
  collect(m.tabs?.[0]);
  for (const tab of (m.tabs || []).slice(1)) { ctx.game.lab.active.setTab(tab); await flush(); collect(tab); }
  out.optionalTabs = ctx.game.lab.optionalTabs;
  await ctx.advance(0.5);
  ctx.game.lab.close(true);
  return out;
}

describe.each(['core', 'extended'])('every lab and model on the %s tier', (tier) => {
  it.each(META.map((m) => [m.id, m]))('%s builds and tags Supplement work from the syllabus data', async (id, m) => {
    const ctx = await freshGame({ tier });
    const errors = [];
    const orig = console.error; console.error = (...a) => errors.push(a.map(String).join(' ')); // the lab view logs build errors
    let r;
    try { r = await openEveryTab(ctx, m); } finally { console.error = orig; }
    expect(errors, errors.join('\n')).toEqual([]);
    expect(r.errors).toEqual([]);
    for (const s of r.steps) {
      const labelled = s.text.startsWith('(S)');
      if (tier === 'extended') expect(s.optional, `${id} step "${s.text}"`).toBe(false);
      else if (labelled) expect(s.optional, `${id} step "${s.text}"`).toBe(true);
      // any other optional step was fed only by Supplement questions, and is not shown as done
      else if (s.optional) expect(s.allSupplementSet && !s.done, `${id}/${s.tab} step "${s.text}"`).toBe(true);
    }
    const sTabs = { electromag: ['motor', 'generator', 'transformer'] }[id] || [];
    expect(r.optionalTabs || []).toEqual(tier === 'core' ? sTabs : []);
    for (const q of r.questions) {
      const labelled = q.text.trim().startsWith('(S)');
      const sup = q.ids.some((x) => ctx.curriculum.OBJ[x]?.tier === 'S');
      if (labelled) expect(sup, `${id} question labelled (S) but tests only Core objectives: "${q.text}"`).toBe(true);
      expect(q.required, `${id} question "${q.text.slice(0, 60)}"`).toBe(tier === 'extended' || !sup);
    }
  });
});
