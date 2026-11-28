import { describe, it, expect } from 'vitest';
import { freshGame, seedRandom, setSlider, choose, clickButton, answer, stepStates } from './helpers/harness.js';

const rows = (el, section) => {
  const sec = [...el.querySelectorAll('.lp-sec')].find((s) => s.querySelector('.st')?.textContent.trim() === section) || el;
  return [...sec.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
};
const control = (el, label) => [...el.querySelectorAll('.ctl')].find((c) => c.querySelector('.lbl')?.textContent.trim().startsWith(label));

describe('Pondweed Lab: each count keeps the conditions it started with', () => {
  it('a setting change during counting cannot relabel the result', async () => {
    seedRandom(7);
    const ctx = await freshGame();
    await ctx.game.lab.open('photosynthesis');
    const el = ctx.game.lab.ui.el;
    setSlider(el, 'Lamp distance', 10); choose(el, 'CO₂ (sodium hydrogencarbonate)', 'Medium'); setSlider(el, 'Water temperature', 25);
    clickButton(el, 'Count bubbles');
    await ctx.advance(2);
    // the controls are locked while measuring
    expect(control(el, 'Lamp distance').querySelector('input').disabled).toBe(true);
    // try to change everything mid-count anyway
    setSlider(el, 'Lamp distance', 50); setSlider(el, 'Water temperature', 10);
    try { choose(el, 'CO₂ (sodium hydrogencarbonate)', 'High'); } catch { /* locked */ }
    await ctx.advance(4);
    const [row] = rows(el, 'Results');
    expect(row.slice(0, 4)).toEqual(['10', '1.000', 'medium', '25']);
    expect(+row[4]).toBeGreaterThanOrEqual(40);
    expect(+row[4]).toBeLessThanOrEqual(44);
    expect(control(el, 'Lamp distance').querySelector('input').disabled).toBe(false);
    const medium = ctx.game.lab.active.graph.series[2].data;
    expect(medium).toEqual([[1, +row[4]]]);
  });

  it('consecutive counts at different distances are recorded against their own settings', async () => {
    seedRandom(3);
    const ctx = await freshGame();
    await ctx.game.lab.open('photosynthesis');
    const el = ctx.game.lab.ui.el;
    for (const d of [10, 20, 40]) { setSlider(el, 'Lamp distance', d); clickButton(el, 'Count bubbles'); await ctx.advance(5.5); }
    const r = rows(el, 'Results');
    expect(r.map((x) => x[0])).toEqual(['10', '20', '40']);
    const n = r.map((x) => +x[4]);
    expect(n[0]).toBeGreaterThan(n[1]);
    expect(n[1]).toBeGreaterThan(n[2]);
  });
});

describe('Motion Lab timing bench: each pendulum timing keeps its length', () => {
  async function timing() {
    const ctx = await freshGame();
    await ctx.game.lab.open('motion', { tab: 'timing' });
    return { ctx, el: ctx.game.lab.ui.el };
  }
  it('changing the length while timing does not move the result to the new length', async () => {
    seedRandom(11);
    const { ctx, el } = await timing();
    setSlider(el, 'String length', 0.2);
    clickButton(el, 'Time 10 swings');
    await ctx.advance(3);
    setSlider(el, 'String length', 1.0);
    await ctx.advance(8);
    const [row] = rows(el, 'Pendulum');
    expect(row[0]).toBe('0.2');
    expect(+row[3]).toBeCloseTo(0.9, 1);
  });

  it('consecutive timings at two lengths are recorded separately', async () => {
    seedRandom(5);
    const { ctx, el } = await timing();
    setSlider(el, 'String length', 0.2); clickButton(el, 'Time 10 swings'); await ctx.advance(9.5);
    setSlider(el, 'String length', 1.0); clickButton(el, 'Time 10 swings'); await ctx.advance(20.5);
    const r = rows(el, 'Pendulum');
    expect(r.map((x) => x[0])).toEqual(['0.2', '1.0']);
    expect(+r[0][3]).toBeCloseTo(0.9, 1);
    expect(+r[1][3]).toBeCloseTo(2.0, 1);
  });

  const swings = (ctx, el) => async (n, L) => { setSlider(el, 'String length', L); clickButton(el, `Time ${n} swing`); await ctx.advance(n * 2 * Math.PI * Math.sqrt(L / 9.81) + 0.5); };
  const notes = (el) => [...el.querySelectorAll('.note')].map((n) => n.textContent).join('\n');

  it('repeats are only grouped under matching conditions', async () => {
    seedRandom(9);
    const { ctx, el } = await timing();
    const time = swings(ctx, el);
    await time(10, 0.2); await time(10, 0.2); await time(10, 1.0);
    await time(1, 0.2); await time(1, 0.2); await time(1, 1.0);
    expect(stepStates(el).slice(0, 2)).toEqual([false, false]); // three timings of each kind, but not three at one length
    await time(1, 0.2);
    expect(stepStates(el)[0]).toBe(true);
  });

  it('single swings at 0.2 m and ten-swing runs at 1.0 m are recorded, but cannot satisfy the spread comparison', async () => {
    seedRandom(19);
    const { ctx, el } = await timing();
    const time = swings(ctx, el);
    for (let i = 0; i < 3; i++) await time(1, 0.2);
    for (let i = 0; i < 3; i++) await time(10, 1.0);
    expect(rows(el, 'Pendulum').map((r) => [r[0], r[1]])).toEqual([['0.2', '1'], ['0.2', '1'], ['0.2', '1'], ['1.0', '10'], ['1.0', '10'], ['1.0', '10']]);
    expect(stepStates(el)[0]).toBe(true); // three single swings at one length
    expect(stepStates(el)[1]).toBe(false); // the comparison needs both groups at the same length
    expect(notes(el)).toMatch(/same length/i);
    expect(notes(el)).not.toMatch(/Spread of periods/);
  });

  it('matching groups at one length satisfy the spread comparison', async () => {
    seedRandom(23);
    const { ctx, el } = await timing();
    const time = swings(ctx, el);
    for (let i = 0; i < 3; i++) await time(10, 1.0);
    expect(stepStates(el)[1]).toBe(false); // ten-swing repeats alone are not a comparison
    for (let i = 0; i < 3; i++) await time(1, 1.0);
    expect(stepStates(el).slice(0, 2)).toEqual([true, true]);
    expect(notes(el)).toMatch(/Spread of periods at 1\.0 m/);
  });
});

describe('Pondweed Lab: comparisons only use counts made under matching conditions', () => {
  async function pondweed(seed) {
    seedRandom(seed);
    const ctx = await freshGame();
    await ctx.game.lab.open('photosynthesis');
    const el = ctx.game.lab.ui.el;
    const count = async (d, co2, T = 25) => {
      setSlider(el, 'Lamp distance', d); choose(el, 'CO₂ (sodium hydrogencarbonate)', co2); setSlider(el, 'Water temperature', T);
      clickButton(el, 'Count bubbles'); await ctx.advance(5.5);
    };
    return { ctx, el, count };
  }
  const notes = (el) => [...el.querySelectorAll('.note')].map((n) => n.textContent).join('\n');

  it('10 cm Medium CO₂ then 12 cm High CO₂ earns no CO₂ comparison: the lamp distance changed too', async () => {
    const { el, count } = await pondweed(31);
    await count(10, 'Medium'); await count(12, 'High');
    expect(rows(el, 'Results').map((r) => r.slice(0, 4))).toEqual([['10', '1.000', 'medium', '25'], ['12', '0.694', 'high', '25']]);
    expect(stepStates(el)[2]).toBe(false);
    expect(notes(el)).toMatch(/same lamp distance and temperature/i);
  });

  it('a pair at different temperatures earns no CO₂ comparison either', async () => {
    const { el, count } = await pondweed(32);
    await count(10, 'Medium', 25); await count(10, 'High', 35);
    expect(stepStates(el)[2]).toBe(false);
  });

  it('a pair with the same distance and temperature and different CO₂ earns it', async () => {
    const { el, count } = await pondweed(33);
    await count(10, 'Medium'); await count(12, 'High');
    await count(10, 'High');
    expect(stepStates(el)[2]).toBe(true);
  });

  it('lamp distances are compared at one CO₂ level, at the graph temperature', async () => {
    const { el, count } = await pondweed(34);
    await count(10, 'Medium'); await count(20, 'High'); await count(30, 'Medium'); await count(40, 'Low');
    expect(stepStates(el)[1]).toBe(false); // four distances, but at three CO₂ levels
    await count(20, 'Medium'); await count(40, 'Medium');
    expect(stepStates(el)[1]).toBe(true);
  });
});

describe('Motion Lab track: segment answers need that segment in the current, successful run', () => {
  async function track(seed) {
    seedRandom(seed);
    const ctx = await freshGame();
    await ctx.game.lab.open('motion', { tab: 'track' });
    const el = ctx.game.lab.ui.el;
    const box = () => [...el.querySelectorAll('.aq')].find((b) => b.textContent.includes('constant-speed section'));
    const run = async (p, seconds) => {
      for (const [label, v] of Object.entries(p)) setSlider(el, label, v);
      clickButton(el, 'Run program');
      await ctx.advance(seconds);
    };
    return { ctx, el, box, run };
  }
  const VALID = { '2 · Acceleration': 2, '2 · …for': 4, '3 · Constant speed for': 6 }; // 8 m/s cruise, 72 m
  const CRASH = { '2 · Acceleration': 4, '2 · …for': 6, '3 · Constant speed for': 10 }; // 24 m/s: hits the barrier

  it('a run with no constant-speed section cannot earn the straight-section gradient; a cruise run can', async () => {
    const { ctx, el, box, run } = await track(41);
    await run({ ...VALID, '3 · Constant speed for': 0 }, 14);
    expect(ctx.game.lab.active.result).toMatchObject({ v: 8 }); // the run finished, peaking at 8 m/s
    answer(el, [['constant-speed section', 8]]);
    expect(box().classList.contains('solved')).toBe(false);
    expect(box().querySelector('.fb').textContent).toMatch(/no constant-speed section/i);
    expect(stepStates(el)[1]).toBe(false);
    expect(ctx.state.evidence['P1.2.6']?.c?.length || 0).toBe(0);
    await run(VALID, 20);
    answer(el, [['constant-speed section', 8]]);
    expect(box().classList.contains('solved')).toBe(true);
    await ctx.advance(0.1);
    expect(stepStates(el)[1]).toBe(true);
  });

  it('after a failed run, an earlier correct answer is shown as history, the new run cannot reuse it, and progress is kept', async () => {
    const { ctx, el, box, run } = await track(42);
    await run(VALID, 20);
    answer(el, [['constant-speed section', 8]]);
    await ctx.advance(0.1);
    expect(box().classList.contains('solved')).toBe(true);
    expect(stepStates(el)[1]).toBe(true);
    const evidence = JSON.stringify(ctx.state.evidence);
    await run(CRASH, 0.2); // a new run has started
    expect(box().classList.contains('solved')).toBe(false); // not shown as answered for this run
    expect(box().querySelector('.fb').textContent).toBe('');
    expect(box().querySelector('.aq-hist').textContent).toMatch(/run 1/i);
    expect(box().querySelector('input').value).toBe('');
    await ctx.advance(25); // … and it hits the barrier
    answer(el, [['constant-speed section', 8]]);
    expect(box().classList.contains('solved')).toBe(false);
    expect(box().querySelector('.fb').textContent).toMatch(/crash/i);
    expect(stepStates(el)[1]).toBe(true); // earlier progress is kept
    expect(JSON.stringify(ctx.state.evidence)).toBe(evidence); // and nothing new is credited
  });

  it('after a failed run, an unanswered question cannot be scored against the earlier run', async () => {
    const { ctx, el, box, run } = await track(43);
    await run(VALID, 20);
    await run(CRASH, 25);
    expect(box().querySelector('.aq-hist')?.textContent || '').toBe('');
    answer(el, [['constant-speed section', 8]]);
    expect(box().classList.contains('solved')).toBe(false);
    expect(box().querySelector('.fb').textContent).toMatch(/crash/i);
    expect(stepStates(el)[1]).toBe(false);
    expect(ctx.state.evidence['P1.2.6']?.c?.length || 0).toBe(0);
  });
});

describe('Motion Lab track: questions are scored against the run on the graphs', () => {
  it('after a valid run, a run that hits the barrier cannot be scored with the old run', async () => {
    seedRandom(2);
    const ctx = await freshGame();
    await ctx.game.lab.open('motion', { tab: 'track' });
    const el = ctx.game.lab.ui.el;
    clickButton(el, 'Run program');
    await ctx.advance(15); // defaults: 8 m/s cruise, 72 m, no crash
    expect(ctx.game.lab.active.result).toMatchObject({ v: 8 });
    setSlider(el, '2 · Acceleration', 4); setSlider(el, '2 · …for', 6); setSlider(el, '3 · Constant speed for', 10);
    clickButton(el, 'Run program');
    await ctx.advance(25); // 24 m/s: hits the 100 m barrier
    answer(el, [['constant-speed section', 8]]);
    const box = [...el.querySelectorAll('.aq')].find((b) => b.textContent.includes('constant-speed section'));
    expect(box.classList.contains('solved')).toBe(false);
    expect(box.querySelector('.fb').textContent).toMatch(/crashed .* cannot be analysed/i);
    // a new valid run can be scored
    setSlider(el, '2 · Acceleration', 1); setSlider(el, '2 · …for', 4); setSlider(el, '3 · Constant speed for', 6);
    clickButton(el, 'Run program');
    await ctx.advance(20);
    answer(el, [['constant-speed section', 4]]);
    expect(box.classList.contains('solved')).toBe(true);
  });

  it('a run still in progress cannot be scored', async () => {
    seedRandom(4);
    const ctx = await freshGame();
    await ctx.game.lab.open('motion', { tab: 'track' });
    const el = ctx.game.lab.ui.el;
    clickButton(el, 'Run program'); await ctx.advance(15);
    clickButton(el, 'Run program'); await ctx.advance(3);
    answer(el, [['constant-speed section', 8]]);
    const box = [...el.querySelectorAll('.aq')].find((b) => b.textContent.includes('constant-speed section'));
    expect(box.classList.contains('solved')).toBe(false);
  });
});

describe('Titration Lab: agreement between readings', () => {
  it('19.90, 20.00, 20.00 and 20.10 cm³: a subset qualifies, the whole set does not', async () => {
    const { concordantSubset } = await import('../../src/lab/experiments/titration.js');
    const titres = [19.9, 20.0, 20.0, 20.1];
    const pick = concordantSubset(titres);
    expect(pick.length).toBe(3);
    const vals = pick.map((i) => titres[i]);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(pick).not.toEqual([0, 1, 2, 3]);
  });
  it('needs two titres within 0.10 cm³, and picks the tighter set on a tie', async () => {
    const { concordantSubset } = await import('../../src/lab/experiments/titration.js');
    expect(concordantSubset([20.0])).toEqual([]);
    expect(concordantSubset([20.0, 20.2, 20.45])).toEqual([]);
    expect(concordantSubset([20.0, 20.1])).toEqual([0, 1]);
    expect(concordantSubset([19.5, 20.0, 20.05, 20.6, 20.65])).toEqual([1, 2]);
  });
});

describe('Titration Lab: end-point validity is judged separately from agreement', () => {
  async function titrate(ctx, overshoot) {
    const exp = ctx.game.lab.active;
    exp.newFlask(); exp.fill();
    const p = exp.pipette(); await ctx.advance(3); await p;
    exp.addIndicator('mo');
    for (let i = 0; i < 2000 && exp.endV == null; i++) { exp.oneDrop(); await ctx.advance(0.05, 0.05); }
    if (overshoot) { exp.addAcid(overshoot); exp.refreshFlask(); }
    exp.record();
  }

  it('overshot titres stay in the table as feedback but never form the qualifying mean', async () => {
    seedRandom(21);
    const ctx = await freshGame();
    await ctx.game.lab.open('titration');
    const exp = ctx.game.lab.active;
    await titrate(ctx, 0); // rough
    await titrate(ctx, 1.0);
    await titrate(ctx, 1.0);
    const recs = exp.records.filter((r) => !r.rough);
    expect(recs).toHaveLength(2);
    expect(Math.abs(recs[0].titre - recs[1].titre)).toBeLessThanOrEqual(0.1);
    expect(recs.every((r) => r.valid === false)).toBe(true);
    expect(exp.mean.A).toBeNull();
    const use = [...ctx.game.lab.ui.el.querySelectorAll('tbody tr')].slice(1).map((tr) => tr.lastChild.textContent);
    expect(use.every((t) => /overshot/i.test(t))).toBe(true);
    // two good titres then qualify
    await titrate(ctx, 0);
    await titrate(ctx, 0);
    expect(exp.mean.A).not.toBeNull();
    expect(stepStates(ctx.game.lab.ui.el)[4]).toBe(true);
  });
});
