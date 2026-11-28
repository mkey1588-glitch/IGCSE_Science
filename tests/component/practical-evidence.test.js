import { describe, it, expect } from 'vitest';
import { freshGame, flush, seedRandom, setSlider, choose, clickButton } from './helpers/harness.js';

// Practical evidence comes from what the learner does at the bench; answers are answer evidence only.
const { META } = await import('../../src/lab/registry.js');
const { PRACTICAL } = await import('../../src/lab/practical.js');
const EXPS = META.filter((m) => m.kind === 'exp');
const practicalIds = (ctx) => Object.entries(ctx.state.evidence).filter(([, e]) => e.p).map(([id]) => id).sort();

describe('the practical map', () => {
  it('gives every experiment checklist (every tab) practical objectives from its own syllabus content', async () => {
    const ctx = await freshGame();
    const { OBJ, expandIds } = ctx.curriculum;
    for (const m of EXPS) {
      if (m.id === 'microscope') { expect(PRACTICAL.microscope).toBeUndefined(); continue; } // credits each observation itself
      const scope = new Set(expandIds(m.objectives, 'extended'));
      for (const tab of m.tabs || ['main']) {
        const ids = PRACTICAL[m.id]?.[tab];
        expect(ids?.length, `${m.id}/${tab}`).toBeGreaterThan(0);
        for (const id of ids) {
          expect(OBJ[id], `${m.id}/${tab}: ${id} is not an objective`).toBeTruthy();
          expect(scope.has(id), `${m.id}/${tab}: ${id} is outside the lab's content`).toBe(true);
        }
      }
      expect(Object.keys(PRACTICAL[m.id]).sort(), m.id).toEqual([...(m.tabs || ['main'])].sort());
    }
    expect(Object.keys(PRACTICAL).sort()).toEqual(EXPS.filter((m) => m.id !== 'microscope').map((m) => m.id).sort());
  });
});

/** Answer every analysis question that the data collected so far can answer, correctly, through the panel. */
function answerEverything(ctx) {
  const el = document.createElement('div');
  const text = (html) => { el.innerHTML = ctx.rich(html); return el.textContent.replace(/\s+/g, ' ').trim(); };
  for (const set of ctx.game.lab.ui.qsets) {
    if (!set.sec.isConnected) continue;
    const boxes = [...set.sec.querySelectorAll('.aq')];
    set.items.forEach((rec, i) => {
      const box = boxes[i], item = rec.item;
      if (item.opts) [...box.querySelectorAll('button.ao')].find((b) => b.textContent.replace(/\s+/g, ' ').trim() === text(item.opts[0]))?.click();
      else {
        const v = typeof item.ans === 'function' ? item.ans() : item.ans;
        if (v == null) return;
        box.querySelector('input').value = String(v);
        [...box.querySelectorAll('button')].find((b) => b.textContent === 'Check').click();
      }
    });
  }
}

describe.each(['core', 'extended'])('answers without the practical work, %s tier', (tier) => {
  it.each(EXPS.map((m) => [m.id, m]))('%s: answering its analysis questions creates no practical evidence', async (id, m) => {
    const ctx = await freshGame({ tier });
    await ctx.game.lab.open(id);
    await flush();
    let solved = 0;
    const lists = () => ctx.game.lab.ui.checklists.filter((c) => c.sec.isConnected).map((c) => c.handle);
    for (const tab of m.tabs || [null]) {
      if (tab && ctx.game.lab.active.tab !== tab) { ctx.game.lab.active.setTab(tab); await flush(); }
      await ctx.advance(0.3); // let the bench settle first: some apparatus starts running on its own
      const before = lists().map((h) => h.items().map((_, i) => h.isDone(i)));
      answerEverything(ctx);
      await ctx.advance(0.3); // steps that watch for solved questions
      solved += ctx.game.lab.ui.qsets.filter((s) => s.sec.isConnected).flatMap((s) => s.items).filter((r) => r.solved).length;
      // every step that answering ticked is marked as an answer step, so it can never gate or create practical credit
      lists().forEach((h, k) => h.items().forEach((t, i) => { if (h.isDone(i) && !before[k][i]) expect(h.byAnswer(i), `${id}${tab ? '/' + tab : ''}: "${t}" was ticked by answers`).toBe(true); }));
    }
    expect(solved, 'the sweep answered questions').toBeGreaterThan(0);
    expect(practicalIds(ctx)).toEqual([]);
    ctx.game.lab.close(true);
  });
});

describe('the hands-on work is what credits practical evidence', () => {
  it('Pondweed Lab: the counts, indicator and starch test credit their objectives before any answer (tier-filtered)', async () => {
    for (const tier of ['core', 'extended']) {
      seedRandom(51);
      const ctx = await freshGame({ tier });
      await ctx.game.lab.open('photosynthesis');
      const el = ctx.game.lab.ui.el;
      const count = async (d, co2) => { setSlider(el, 'Lamp distance', d); choose(el, 'CO₂ (sodium hydrogencarbonate)', co2); clickButton(el, 'Count bubbles'); await ctx.advance(5.5); };
      for (const d of [10, 20, 30, 40]) await count(d, 'Medium');
      await count(10, 'High');
      clickButton(el, 'Leave indicator tubes');
      expect(practicalIds(ctx)).toEqual([]); // the starch test is still to do
      clickButton(el, 'Test leaves for starch');
      await ctx.advance(5);
      expect(practicalIds(ctx)).toEqual(tier === 'core' ? ['B6.1.4'] : ['B6.1.10', 'B6.1.4', 'B6.1.9']);
      expect(ctx.state.exps.photosynthesis?.done).toBeFalsy(); // the analysis is still to do
    }
  });

  it('Motion Lab track: a full trip credits reading motion graphs; the graph answers only add answer evidence', async () => {
    seedRandom(52);
    const ctx = await freshGame({ tier: 'extended' });
    await ctx.game.lab.open('motion', { tab: 'track' });
    const el = ctx.game.lab.ui.el;
    clickButton(el, 'Run program');
    await ctx.advance(20);
    expect(practicalIds(ctx)).toEqual(['P1.2.3', 'P1.2.5']);
    answerEverything(ctx);
    await ctx.advance(0.3);
    expect(practicalIds(ctx)).toEqual(['P1.2.3', 'P1.2.5']);
    expect(ctx.state.evidence['P1.2.6'].c).toHaveLength(1);
  });

  it('a Supplement hands-on step credits its own objectives when done; a Supplement calculation step does not', async () => {
    seedRandom(53);
    const ctx = await freshGame({ tier: 'core' });
    await ctx.game.lab.open('motion', { tab: 'timing' });
    clickButton(ctx.game.lab.ui.el, 'Drop the ball');
    await ctx.advance(3);
    expect(ctx.state.evidence['P1.2.13']?.p).toBe(1); // the learner timed the fall: optional extra, genuinely done
    answerEverything(ctx);
    await ctx.advance(0.3);
    expect(ctx.state.evidence['P1.2.13'].p).toBe(1);
    expect(practicalIds(ctx)).toEqual(['P1.2.13']);
  });
});
