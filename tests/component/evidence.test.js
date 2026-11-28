import { describe, it, expect } from 'vitest';
import { freshGame, seedRandom, answer } from './helpers/harness.js';
import { microscope, CORE_ANSWERS, SUPPLEMENT_ANSWERS } from './helpers/microscope.js';

async function realUI(opts) {
  const ctx = await freshGame(opts);
  const { UI } = await import('../../src/ui/ui.js');
  const ui = new UI(ctx.uiRoot);
  ctx.game.ui = ui;
  return { ctx, ui };
}

describe('generated questions: an identical question is one item of evidence', () => {
  const STONE = 'A stone has a mass of 24 g and displaces 50 cm³ of water. Calculate its density.';

  it('drawing the same density question twice gives it the same identity', async () => {
    const ctx = await freshGame({ tier: 'extended' });
    seedRandom(5);
    const draws = [];
    for (let i = 0; i < 600 && draws.length < 2; i++) {
      const [q] = ctx.questions.questionsFor(['P1.4'], 1, 'extended');
      if (q.gen && q.q === STONE) draws.push(q);
    }
    expect(draws).toHaveLength(2);
    expect(draws[0]).not.toBe(draws[1]); // two separate draws …
    expect(draws[0].id).toBe(draws[1].id); // … of one question
  });

  it('answering it right first time twice, through the quiz, is one item: practised, not mastered', async () => {
    const { ctx, ui } = await realUI({ tier: 'extended' });
    const { runQuiz } = await import('../../src/ui/quiz.js');
    seedRandom(6);
    // take practice quizzes; answer the stone question whenever it comes up, skip the rest
    const answerQuiz = (value) => {
      const card = document.querySelector('.quiz');
      card.querySelector('input').value = String(value);
      [...card.querySelectorAll('button')].find((b) => b.textContent === 'Check').click();
    };
    let answered = 0;
    for (let i = 0; i < 600 && answered < 2; i++) {
      runQuiz(ui, { title: 'Practice · P1.4 Density', subs: ['P1.4'], n: 1 });
      if (document.querySelector('.quiz .q')?.textContent === STONE) { answerQuiz(0.48); answered++; }
      ui.closeAllModals();
    }
    expect(answered).toBe(2);
    expect(ctx.state.evidence['P1.4.1'].c).toHaveLength(1);
    expect(ctx.state.mastery['P1.4.1']).toBe(2);
    expect(ctx.state.mastery['P1.4.2']).toBe(2);
    // a genuinely different question answered right first time is a second item: mastered
    for (let i = 0; i < 600 && ctx.state.mastery['P1.4.1'] < 3; i++) {
      runQuiz(ui, { title: 'Practice · P1.4 Density', subs: ['P1.4'], n: 1 });
      const text = document.querySelector('.quiz .q')?.textContent || '';
      const m = text.match(/mass of (\d+) g and displaces (\d+) cm³/);
      if (m && text !== STONE) answerQuiz(+m[1] / +m[2]);
      ui.closeAllModals();
    }
    expect(ctx.state.evidence['P1.4.1'].c).toHaveLength(2);
    expect(ctx.state.mastery['P1.4.1']).toBe(3);
  });

  it('generated identities are stable across sessions: a reload draws the same identity for the same question', async () => {
    const first = await freshGame({ tier: 'extended' });
    seedRandom(7);
    let a = null;
    for (let i = 0; i < 600 && !a; i++) { const [q] = first.questions.questionsFor(['P1.4'], 1, 'extended'); if (q.gen && q.q === STONE) a = q; }
    const second = await freshGame({ tier: 'extended', keepSave: true });
    let b = null;
    for (let i = 0; i < 600 && !b; i++) { const [q] = second.questions.questionsFor(['P1.4'], 1, 'extended'); if (q.gen && q.q === STONE) b = q; }
    expect(a.id).toBe(b.id);
  });
});

/** Cell Explorer on the Core tier: the same practical work and answers, with the optional conversion at a chosen point. */
async function cellExplorer(conversion) {
  const ctx = await freshGame({ tier: 'core' });
  await ctx.game.quests.kickoff();
  ctx.game.onScanned(ctx.world.POIS.find((p) => p.id === 'lab_fig'));
  await ctx.advance(1);
  await ctx.game.lab.open('microscope', { quest: 'q_first_day' });
  const m = microscope(ctx), el = ctx.game.lab.ui.el;
  m.step0(); m.step1(); m.step2(); m.step4('leaf'); m.step3();
  answer(el, CORE_ANSWERS.slice(0, 3));
  if (conversion === 'before') answer(el, SUPPLEMENT_ANSWERS);
  answer(el, CORE_ANSWERS.slice(3)); // the last required answer completes the lab
  expect(ctx.state.exps.microscope.done).toBe(true);
  if (conversion === 'after') answer(el, SUPPLEMENT_ANSWERS);
  return { ctx, evidence: structuredClone(ctx.state.evidence), mastery: { ...ctx.state.mastery } };
}

describe('Cell Explorer: the same learning work gives the same evidence, whatever the order', () => {
  it('the optional mm → µm conversion before or after the last required answer: identical evidence and levels', async () => {
    const before = await cellExplorer('before');
    const after = await cellExplorer('after');
    expect(after.evidence).toEqual(before.evidence);
    expect(after.mastery).toEqual(before.mastery);
    expect(before.mastery['B2.2.3']).toBe(2); // one conversion answer is practised, not mastered
    expect(before.evidence['B2.2.3']).toEqual({ v: 1, c: ['lab:microscope:Convert **0.25 mm** into micrometres.'] });
  });

  it('answers never create practical evidence; the observations do', async () => {
    const { evidence } = await cellExplorer('after');
    for (const id of ['B2.2.1', 'B2.2.2', 'B2.2.3']) expect(evidence[id]?.p, id).toBeUndefined(); // calculations: answers only
    expect(evidence['B2.1.3'].p).toBe(1); // identifying structures in the eyepiece
  });

  it('answering the analysis questions without the practical work gives answer evidence only', async () => {
    const ctx = await freshGame({ tier: 'core' });
    await ctx.game.lab.open('microscope');
    answer(ctx.game.lab.ui.el, [...CORE_ANSWERS, ...SUPPLEMENT_ANSWERS]);
    expect(Object.entries(ctx.state.evidence).filter(([, e]) => e.p)).toEqual([]);
    expect(ctx.state.mastery['B2.2.3']).toBe(2);
  });

  it('switching Core → Extended afterwards creates no Supplement credit', async () => {
    const { ctx } = await cellExplorer('after');
    const supplement = () => ctx.curriculum.OBJECTIVES.filter((o) => o.tier === 'S' && ctx.state.mastery[o.id]).map((o) => [o.id, ctx.state.mastery[o.id]]);
    const before = supplement();
    expect(before).toEqual([['B2.2.3', 2]]); // the one Supplement item the learner actually did
    ctx.state.settings.tier = 'extended';
    expect(supplement()).toEqual(before);
    expect(ctx.subStats('B2.2')).toMatchObject({ total: 3 });
  });
});

describe('existing saves', () => {
  // A save written by the reviewed build (format 2), including evidence recorded under the old rules.
  const round1Save = () => ({
    v: 2, name: 'Round One', created: 1, playTime: 5400, xp: 2210, level: 9,
    mastery: { 'B2.1.3': 2, 'B2.2.1': 3, 'B2.2.3': 3, 'P1.4.1': 3 },
    evidence: {
      'B2.1.3': { v: 1, p: 1 },
      'B2.2.1': { v: 1, p: 1, c: ['lab:microscope:You used a ×10 eyepiece with the ×40 objective. What is the **total magnification**?'] },
      'B2.2.3': { v: 1, p: 1, c: ['lab:microscope:Convert **0.25 mm** into micrometres.'] },
      'P1.4.1': { v: 1, c: ['gen-P1.4-0.31', 'gen-P1.4-0.77'] },
    },
    quests: { q_first_day: { status: 'done', step: 4 }, q_measure: { status: 'active', step: 1 } },
    tracked: 'q_measure', scanned: { lab_fig: true }, exps: { microscope: { unlocked: true, done: true, goals: { complete: true } } },
    holos: {}, links: { 'B2.1-B3.1': 5 }, visited: { lab: true }, flags: { first: true }, achievements: { q1: 9, first_exp: 9 },
    stats: { answered: 20, correct: 17, streak: 3, best: 6, experiments: 1, scans: 4, chains: 0 },
    pos: [1, 2, 3], time: 0.4, settings: { tier: 'core', quality: 'high', music: 0.4, sfx: 0.7, teacher: false, cycle: true, textScale: 1, hints: true },
  });

  it('a save from the reviewed build loads with its quests, XP, links, achievements and evidence as they were', async () => {
    const saved = round1Save();
    localStorage.setItem('catalyst.save.v1', JSON.stringify(saved));
    const ctx = await freshGame({ keepSave: true });
    const s = ctx.state;
    expect(s.v).toBe(2);
    expect(s.xp).toBe(2210);
    expect(s.quests).toEqual(saved.quests);
    expect(s.links).toEqual(saved.links);
    expect(s.achievements).toEqual(saved.achievements);
    expect(s.exps).toEqual(saved.exps);
    expect(s.evidence).toEqual(saved.evidence);
    expect(s.mastery).toEqual(saved.mastery);
    expect(ctx.game.quests.status('q_measure')).toBe('active');
    // play continues under the new rules: a generated question now has a stable identity
    ctx.recordAnswer(true, ['P1.4.1'], { key: 'gen:P1.4:abc' });
    ctx.recordAnswer(true, ['P1.4.1'], { key: 'gen:P1.4:abc' });
    expect(s.evidence['P1.4.1'].c).toEqual(['gen-P1.4-0.31', 'gen-P1.4-0.77', 'gen:P1.4:abc']);
  });
});
