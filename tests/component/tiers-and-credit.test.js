import { describe, it, expect, vi } from 'vitest';
import { freshGame, answer, choose, setSlider, clickButton, stepStates } from './helpers/harness.js';
import { microscope, CORE_ANSWERS, SUPPLEMENT_ANSWERS } from './helpers/microscope.js';

async function startFirstQuestLab(tier) {
  const ctx = await freshGame({ tier });
  await ctx.game.quests.kickoff();
  ctx.game.onScanned(ctx.world.POIS.find((p) => p.id === 'lab_fig'));
  await ctx.advance(1);
  await ctx.game.lab.open('microscope', { quest: 'q_first_day' });
  return { ctx, m: microscope(ctx), complete: vi.spyOn(ctx.game.lab, 'complete') };
}
const practical = (m) => { m.step0(); m.step1(); m.step2(); m.step3(); m.step4('leaf'); };

describe('Cell Explorer requirements follow the syllabus tier', () => {
  it('a new Core profile completes the lab and turns in the first quest without the Supplement question', async () => {
    const { ctx, m, complete } = await startFirstQuestLab('core');
    practical(m);
    answer(ctx.game.lab.ui.el, CORE_ANSWERS);
    expect(complete).toHaveBeenCalledTimes(1);
    const sup = [...ctx.game.lab.ui.el.querySelectorAll('.aq')].find((b) => b.textContent.includes('into micrometres'));
    expect(sup.classList.contains('solved')).toBe(false);
    expect(sup.classList.contains('optional')).toBe(true);
    await ctx.advance(0.5);
    expect(ctx.state.quests.q_first_day.step).toBe(2);
    // the quest's quiz draws Core questions only
    let asked = null;
    ctx.game.ui.onQuiz = (opts) => { asked = opts; return { correct: 3, total: 3, passed: true }; };
    await ctx.game.quests.runQuiz('q_first_day');
    for (let i = 0; i < 40; i++) {
      for (const q of ctx.questions.questionsFor(asked.subs, asked.n, 'core')) {
        const ids = (q.o || []).map((n) => `${q.t}.${n}`);
        expect(ids.some((id) => ctx.curriculum.OBJ[id]?.tier === 'S'), `${q.id} ${q.q}`).toBe(false);
      }
    }
    ctx.game.ui.onDialogue = (lines, opts) => (opts.choices ? opts.choices.find((c) => c.ok) : null);
    await ctx.game.quests.talkTo('okafor');
    expect(ctx.state.quests.q_first_day.status).toBe('done');
    // no credit for the Supplement objective the learner never did
    expect(ctx.state.mastery['B2.2.3'] || 0).toBe(0);
  });

  it('an Extended learner must complete the Supplement question, and can', async () => {
    const { ctx, m, complete } = await startFirstQuestLab('extended');
    practical(m);
    answer(ctx.game.lab.ui.el, CORE_ANSWERS);
    expect(complete).not.toHaveBeenCalled();
    answer(ctx.game.lab.ui.el, SUPPLEMENT_ANSWERS);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(ctx.state.mastery['B2.2.3']).toBeGreaterThanOrEqual(2);
  });

  it('a Core learner may answer the Supplement question as an extra and is credited for that work only', async () => {
    const { ctx, m } = await startFirstQuestLab('core');
    practical(m);
    answer(ctx.game.lab.ui.el, [...CORE_ANSWERS, ...SUPPLEMENT_ANSWERS]);
    expect(ctx.state.mastery['B2.2.3']).toBeGreaterThanOrEqual(2);
  });
});

/** Build tab of the circuits lab, driven through its controls. */
async function circuitsBuild(tier) {
  const ctx = await freshGame({ tier });
  await ctx.game.lab.open('circuits');
  const goal = vi.spyOn(ctx.game.lab, 'goal');
  const el = ctx.game.lab.ui.el;
  const recordIV = (component) => {
    choose(el, 'Layout', 'I–V tester');
    if (component) choose(el, 'Component', component);
    for (const v of [-3, -1, 0, 1, 2, 3, 4]) { setSlider(el, 'Applied p.d.', v); clickButton(el, 'Record point'); }
  };
  const core = () => {
    choose(el, 'Layout', 'Series'); clickButton(el, 'Unscrew lamp 1'); clickButton(el, 'Unscrew lamp 1');
    choose(el, 'Layout', 'Parallel'); clickButton(el, 'Unscrew lamp 1'); clickButton(el, 'Unscrew lamp 1');
    recordIV('Resistor');
  };
  const supplementIV = () => { recordIV('Filament lamp'); recordIV('Diode (S)'); };
  const coreAnswers = [['resistance?', 10], ['wired in **parallel**'.replace(/\*/g, ''), 'Each lamp gets the full voltage and can be switched on and off independently'], ['12 V battery', 24]];
  const supAnswers = [['6 Ω and 3 Ω', 2], ['Current in a metal wire', 'free (delocalised) electrons'], ['3.0 C of charge', 0.3]];
  return { ctx, el, goal, core, supplementIV, coreAnswers, supAnswers };
}

describe('Circuit Builder required steps follow the syllabus tier', () => {
  it('Core: the Build tab completes without the lamp/diode I–V step and the Supplement questions', async () => {
    const t = await circuitsBuild('core');
    t.core();
    answer(t.el, t.coreAnswers);
    expect(t.goal).toHaveBeenCalledWith('build');
    expect(stepStates(t.el)[4]).toBe(false);
  });

  it('Extended: the Build tab needs the lamp/diode I–V step and the Supplement questions', async () => {
    const t = await circuitsBuild('extended');
    t.core();
    answer(t.el, t.coreAnswers);
    expect(t.goal).not.toHaveBeenCalledWith('build');
    t.supplementIV();
    expect(t.goal).not.toHaveBeenCalledWith('build');
    answer(t.el, t.supAnswers);
    expect(t.goal).toHaveBeenCalledWith('build');
  });
});

describe('Supplement-only tabs and quest steps', () => {
  it('Core: the Electromagnetism lab completes without its Supplement-only tabs; Extended needs all five', async () => {
    for (const tier of ['core', 'extended']) {
      const ctx = await freshGame({ tier });
      await ctx.game.lab.open('electromag');
      const complete = vi.spyOn(ctx.game.lab, 'complete');
      ctx.game.lab.goal('magnets'); ctx.game.lab.goal('electromagnet');
      expect(complete).toHaveBeenCalledTimes(tier === 'core' ? 1 : 0);
      if (tier === 'extended') { ctx.game.lab.goal('motor'); ctx.game.lab.goal('generator'); ctx.game.lab.goal('transformer'); expect(complete).toHaveBeenCalledTimes(1); }
      const labels = [...ctx.game.lab.ui.el.querySelectorAll('.tabs .tab')].map((t) => t.textContent);
      expect(labels.filter((l) => l.includes('optional')).length).toBe(tier === 'core' ? 3 : 0);
    }
  });

  it('quest steps tagged as Supplement-only match the lab tabs they point at', async () => {
    const ctx = await freshGame();
    await ctx.game.lab.open('electromag');
    const tabObjectives = ctx.game.lab.active.tabObjectives;
    const { QUESTS } = await import('../../src/data/quests.js');
    for (const q of QUESTS) for (const s of q.steps) if (s.type === 'exp' && s.id === 'electromag' && s.goal) {
      const supOnly = ctx.curriculum.isSupplementOnly(tabObjectives[s.goal]);
      expect(!!s.o && ctx.curriculum.isSupplementOnly(s.o), `${q.id} → ${s.goal}`).toBe(supOnly);
    }
  });

  it('Core: quest steps that ask only for Supplement work are skipped with a message; Extended keeps them', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      for (const tier of ['core', 'extended']) {
        const ctx = await freshGame({ tier });
        ctx.state.quests.q_first_day = { status: 'done', step: 4 };
        ctx.state.quests.q_power = { status: 'active', step: 2 }; // the generator bench
        ctx.game.quests._enterStep('q_power');
        vi.advanceTimersByTime(700); // generator skipped …
        vi.advanceTimersByTime(700); // … then the transformer
        const step = ctx.state.quests.q_power.step;
        if (tier === 'core') {
          expect(step).toBeGreaterThanOrEqual(4);
          expect(ctx.game.ui.toasts.some((t) => /Optional on the Core tier/.test(t))).toBe(true);
        } else expect(step).toBe(2);
      }
    } finally { vi.useRealTimers(); }
  });
});

describe('mastery credit', () => {
  it('one ordinary correct answer is evidence, not mastery', async () => {
    const ctx = await freshGame({ tier: 'extended' });
    ctx.recordAnswer(true, ['B5.1.2'], { key: 'q-a' });
    expect(ctx.state.mastery['B5.1.2']).toBe(2);
    ctx.recordAnswer(true, ['B5.1.2'], { key: 'q-a' }); // the same question again is not new evidence
    expect(ctx.state.mastery['B5.1.2']).toBe(2);
    ctx.recordAnswer(true, ['B5.1.2'], { key: 'q-b' }); // a different question answered correctly
    expect(ctx.state.mastery['B5.1.2']).toBe(3);
  });

  it('a correct answer plus practical work on the same objective is mastery', async () => {
    const ctx = await freshGame({ tier: 'extended' });
    ctx.raise(['B6.1.9'], 2, 'lab');
    expect(ctx.state.mastery['B6.1.9']).toBe(2);
    ctx.recordAnswer(true, ['B6.1.9'], { key: 'q-limit' });
    expect(ctx.state.mastery['B6.1.9']).toBe(3);
  });

  it('a wrong or second-try answer records exposure only', async () => {
    const ctx = await freshGame({ tier: 'extended' });
    ctx.recordAnswer(false, ['B5.1.2'], { key: 'q-a' });
    expect(ctx.state.mastery['B5.1.2']).toBe(1);
  });

  it('credit for a sub-topic never spreads into Supplement objectives for a Core learner', async () => {
    const ctx = await freshGame({ tier: 'core' });
    ctx.raise(['B2.2'], 2, 'lab');
    ctx.recordAnswer(true, ['B2.2'], { key: 'q-x' });
    expect(ctx.state.mastery['B2.2.1']).toBeGreaterThanOrEqual(2);
    expect(ctx.state.mastery['B2.2.3'] || 0).toBe(0);
    ctx.state.settings.tier = 'extended'; // switching tier does not create Supplement credit
    expect(ctx.state.mastery['B2.2.3'] || 0).toBe(0);
    expect(ctx.subStats('B2.2')).toMatchObject({ total: 3, seen: 2 });
  });

  it('a whole sub-topic is not credited from one answer', async () => {
    const ctx = await freshGame({ tier: 'extended' });
    ctx.recordAnswer(true, ['B2.1.1'], { key: 'q-y' });
    for (const o of ['B2.1.2', 'B2.1.3', 'B2.1.5', 'B2.1.7']) expect(ctx.state.mastery[o] || 0).toBe(0);
  });

  it('the quest quiz bank uses objective tiers: Supplement items never reach Core quizzes', async () => {
    const ctx = await freshGame({ tier: 'core' });
    const { OBJ } = ctx.curriculum;
    const subs = ['P3.1', 'P2.2.1', 'B2.2', 'P4.2.2', 'P4.3.2'];
    for (let i = 0; i < 60; i++) for (const q of ctx.questions.questionsFor(subs, 5, 'core')) {
      const ids = (q.o || []).map((n) => `${q.t}.${n}`);
      expect(ids.some((id) => OBJ[id]?.tier === 'S'), `${q.id} ${q.q}`).toBe(false);
    }
  });
});

describe('existing saves', () => {
  const legacy = (tier) => ({
    v: 1, name: 'Old Save', created: 1, playTime: 3600, xp: 1234, level: 7,
    mastery: { 'B2.2.1': 3, 'B2.2.3': 2, 'B2.1.1': 2, 'B2.1.2': 1, 'P1.2.11': 3 },
    quests: { q_first_day: { status: 'done', step: 4 }, q_measure: { status: 'active', step: 1 } },
    tracked: 'q_measure', scanned: { lab_fig: true }, exps: { microscope: { unlocked: true, done: true, goals: { complete: true } } },
    holos: {}, links: { 'B2.1-B3.1': 5 }, visited: { lab: true }, flags: { first: true }, achievements: { q1: 9 },
    stats: { answered: 12, correct: 9, streak: 2, best: 5, experiments: 1, scans: 1, chains: 0 },
    pos: [1, 2, 3], time: 0.4, settings: { tier, quality: 'high', music: 0.4, sfx: 0.7, teacher: false, cycle: true, textScale: 1, hints: true },
  });

  it('a Core save keeps story progress and XP; unearned Supplement credit and one-answer mastery are re-graded', async () => {
    localStorage.setItem('catalyst.save.v1', JSON.stringify(legacy('core')));
    const ctx = await freshGame({ keepSave: true });
    const s = ctx.state;
    expect(s.xp).toBe(1234);
    expect(s.quests).toMatchObject({ q_first_day: { status: 'done' }, q_measure: { status: 'active', step: 1 } });
    expect(s.links['B2.1-B3.1']).toBe(5);
    expect(s.achievements.q1).toBe(9);
    expect(s.flags.first).toBe(true);
    expect(s.exps.microscope.done).toBe(true);
    expect(s.mastery['B2.2.1']).toBe(2);
    expect(s.mastery['B2.2.3'] || 0).toBe(0);
    expect(s.mastery['P1.2.11'] || 0).toBe(0);
    expect(s.mastery['B2.1.1']).toBe(2);
    expect(ctx.game.quests.status('q_measure')).toBe('active');
    ctx.recordAnswer(true, ['B2.2.1'], { key: 'new-q' });
    expect(s.mastery['B2.2.1']).toBe(3);
  });

  it('an Extended save keeps its Supplement credit', async () => {
    localStorage.setItem('catalyst.save.v1', JSON.stringify(legacy('extended')));
    const ctx = await freshGame({ keepSave: true });
    expect(ctx.state.mastery['B2.2.3']).toBe(2);
    expect(ctx.state.mastery['P1.2.11']).toBe(2);
    expect(ctx.state.xp).toBe(1234);
  });
});
