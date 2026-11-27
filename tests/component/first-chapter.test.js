import { describe, it, expect, vi } from 'vitest';
import { freshGame, stepStates } from './helpers/harness.js';
import { microscope } from './helpers/microscope.js';

/** Open Cell Explorer for the first quest and count how often the lab is completed. */
async function openCellExplorer(tier = 'extended') {
  const ctx = await freshGame({ tier });
  await ctx.game.quests.kickoff();
  ctx.game.onScanned(ctx.world.POIS.find((p) => p.id === 'lab_fig'));
  await ctx.advance(1); // the quest moves on to the microscope step
  await ctx.game.lab.open('microscope', { quest: 'q_first_day' });
  const complete = vi.spyOn(ctx.game.lab, 'complete');
  return { ctx, m: microscope(ctx), complete };
}

describe('First Day at the Lumen Lab: Cell Explorer completion', () => {
  it('completes once when the steps are done in the guided order', async () => {
    const { ctx, m, complete } = await openCellExplorer();
    m.step0(); m.step1(); m.step2(); m.step3(); m.step4('leaf'); m.step5();
    expect(stepStates(ctx.game.lab.ui.el)).toEqual([true, true, true, true, true, true]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(ctx.state.exps.microscope.done).toBe(true);
  });

  it('completes once when the cheek specimen is chosen last', async () => {
    const { ctx, m, complete } = await openCellExplorer();
    m.step0(); m.step1(); m.step2(); m.step4('leaf'); m.step5();
    expect(complete).not.toHaveBeenCalled();
    m.step3();
    expect(stepStates(ctx.game.lab.ui.el)).toEqual([true, true, true, true, true, true]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('completes once when the leaf specimen is chosen last', async () => {
    const { ctx, m, complete } = await openCellExplorer();
    m.step0(); m.step1(); m.step2(); m.step3(); m.step5();
    expect(complete).not.toHaveBeenCalled();
    m.step4('leaf');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('completes once when the root hair slide is chosen last', async () => {
    const { m, complete } = await openCellExplorer();
    m.step0(); m.step1(); m.step2(); m.step3(); m.step5();
    m.step4('root');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('does not complete again when actions are repeated after completion', async () => {
    const { m, complete } = await openCellExplorer();
    m.step0(); m.step1(); m.step2(); m.step3(); m.step4('leaf'); m.step5();
    expect(complete).toHaveBeenCalledTimes(1);
    m.step3(); m.step4('root'); m.step4('leaf'); m.step0(); m.step1(); m.step2(); m.step3();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('answering the analysis questions alone does not complete the experiment', async () => {
    const { ctx, m, complete } = await openCellExplorer();
    m.step5();
    expect(stepStates(ctx.game.lab.ui.el)).toEqual([false, false, false, false, false, true]);
    expect(complete).not.toHaveBeenCalled();
    expect(ctx.state.exps.microscope?.done).toBeFalsy();
  });

  it('lets the learner turn the quest in, and keeps that ability across a reload', async () => {
    const { ctx, m } = await openCellExplorer();
    m.step0(); m.step1(); m.step2(); m.step4('leaf'); m.step5(); m.step3(); // cheek last
    await ctx.advance(0.5);
    expect(ctx.state.quests.q_first_day).toMatchObject({ status: 'active', step: 2 });
    ctx.save();

    // reload: new module instances read the save, as "Continue" does
    const again = await freshGame({ keepSave: true });
    expect(again.state.quests.q_first_day).toMatchObject({ status: 'active', step: 2 });
    expect(again.state.exps.microscope.done).toBe(true);
    again.game.ui.onQuiz = () => ({ correct: 3, total: 3, passed: true });
    await again.game.quests.runQuiz('q_first_day');
    expect(again.game.quests.npcMarker('okafor')).toBe('turnin');
    again.game.ui.onDialogue = (lines, opts) => (opts.choices ? opts.choices.find((c) => c.ok) : null);
    await again.game.quests.talkTo('okafor');
    expect(again.state.quests.q_first_day.status).toBe('done');
  });
});
