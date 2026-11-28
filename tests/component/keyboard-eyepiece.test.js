import { describe, it, expect, vi } from 'vitest';
import { freshGame, answer, stepStates } from './helpers/harness.js';
import { microscope, aimButton, reachablePoint, STEP, CORE_ANSWERS } from './helpers/microscope.js';

/** Focusable controls in the order Tab visits them (document order; nothing here sets a positive tabindex). */
const tabOrder = (root) => [...root.querySelectorAll('button, input, select, textarea, [tabindex]')]
  .filter((el) => !el.disabled && el.getAttribute('tabindex') !== '-1' && !el.closest('.hidden'));

async function openCellExplorer(tier = 'core') {
  const ctx = await freshGame({ tier });
  await ctx.game.quests.kickoff();
  ctx.game.onScanned(ctx.world.POIS.find((p) => p.id === 'lab_fig'));
  await ctx.advance(1);
  await ctx.game.lab.open('microscope', { quest: 'q_first_day' });
  return { ctx, m: microscope(ctx), el: ctx.game.lab.ui.el, exp: ctx.game.lab.active, complete: vi.spyOn(ctx.game.lab, 'complete') };
}
const found = (exp, spec = exp.spec) => [...(exp.found[spec] || [])].sort();
const status = (el) => el.querySelector('.ep-status')?.textContent || '';

describe('Cell Explorer: identifying structures with the keyboard', () => {
  it('Tab goes from the Focus slider to the eyepiece control, before the analysis answers', async () => {
    const { el } = await openCellExplorer();
    const order = tabOrder(el);
    const focusSlider = [...el.querySelectorAll('input[type=range]')].find((i) => i.getAttribute('aria-label') === 'Focus');
    const next = order[order.indexOf(focusSlider) + 1];
    expect(next).toBe(aimButton(el));
    expect(next.tagName).toBe('BUTTON');
    expect(order.indexOf(next)).toBeLessThan(order.indexOf(el.querySelector('.aq input, .aq button')));
    // it says how to use it
    const help = document.getElementById(next.getAttribute('aria-describedby'));
    expect(help.textContent).toMatch(/arrow keys/i);
  });

  it('arrow keys move the crosshair; the control shows it on the eyepiece while focused', async () => {
    const { m, el, exp } = await openCellExplorer();
    m.step0(); m.step1();
    const btn = aimButton(el);
    btn.focus();
    expect(exp.overlay.classList.contains('aiming')).toBe(true);
    const start = { ...exp.reticle };
    expect(m.key('ArrowRight').defaultPrevented).toBe(true); // the page does not scroll
    m.key('ArrowDown');
    expect(exp.reticle).toEqual({ x: start.x + STEP, y: start.y + STEP });
    m.key('ArrowLeft', true);
    expect(exp.reticle.x).toBe(start.x + STEP - 8 * STEP);
    btn.blur();
    expect(exp.overlay.classList.contains('aiming')).toBe(false);
  });

  it('identifies the onion structures with arrow keys and Enter, and ticks the same step as the pointer', async () => {
    const { ctx, m, el, exp } = await openCellExplorer();
    m.step0(); m.step1();
    m.identifyByKeyboard('Nucleus');
    expect(found(exp)).toEqual(['Nucleus']);
    expect(status(el)).toMatch(/Nucleus/);
    expect(stepStates(el)[2]).toBe(false);
    for (const name of ['Cell wall', 'Cytoplasm', 'Vacuole']) m.identifyByKeyboard(name);
    expect(found(exp)).toEqual(['Cell wall', 'Cytoplasm', 'Nucleus', 'Vacuole']);
    expect(stepStates(el)[2]).toBe(true);
    // the same observation counts as practical evidence for identifying structures in micrographs
    expect(ctx.state.evidence['B2.1.3']?.p).toBe(1);
  });

  it('respects the focus requirement: a blurred image identifies nothing and says why', async () => {
    const { m, el, exp } = await openCellExplorer();
    m.step0(); m.step1();
    m.blur();
    const btn = aimButton(el);
    btn.focus();
    btn.click();
    expect(found(exp)).toEqual([]);
    expect(status(el)).toMatch(/focus/i);
  });

  it('respects the specimen: structures count for the slide on the stage only', async () => {
    const { m, el, exp } = await openCellExplorer();
    m.step0(); m.step1(); m.findAllByKeyboard('onion');
    m.slide('cheek'); m.focus('cheek');
    expect(found(exp, 'cheek')).toEqual([]);
    m.identifyByKeyboard('Cell membrane');
    expect(found(exp, 'cheek')).toEqual(['Cell membrane']);
    expect(found(exp, 'onion')).toHaveLength(4);
    // nothing under the crosshair: says so
    const btn = aimButton(el);
    const c = exp.ep.width / 2;
    let empty = null;
    for (let j = -50; j <= 50 && !empty; j++) for (let i = -50; i <= 50 && !empty; i++) { const x = exp.reticle.x + i * STEP, y = exp.reticle.y + j * STEP; if (Math.hypot(x - c, y - c) < c - 12 && !exp.hitTest(x, y)) empty = { i, j }; }
    for (let k = 0; k < Math.abs(empty.i); k++) m.key(empty.i > 0 ? 'ArrowRight' : 'ArrowLeft');
    for (let k = 0; k < Math.abs(empty.j); k++) m.key(empty.j > 0 ? 'ArrowDown' : 'ArrowUp');
    btn.click();
    expect(status(el)).toMatch(/nothing identifiable/i);
  });

  it('a keyboard-only run completes the lab once, with the cheek slide last, without the optional question', async () => {
    const { ctx, m, el, complete } = await openCellExplorer('core');
    m.step0(); m.step1(); m.findAllByKeyboard('onion');
    m.slide('leaf');
    answer(el, CORE_ANSWERS);
    expect(complete).not.toHaveBeenCalled();
    m.slide('cheek');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(stepStates(el)).toEqual([true, true, true, true, true, true]);
    m.slide('onion'); m.findAllByKeyboard('onion'); m.slide('cheek');
    expect(complete).toHaveBeenCalledTimes(1);
    await ctx.advance(0.5);
    expect(ctx.state.quests.q_first_day.step).toBe(2);
  });

  it('pointer and keyboard identifications share one record of what was found', async () => {
    const { m, exp } = await openCellExplorer();
    m.step0(); m.step1();
    m.identifyByKeyboard('Nucleus');
    exp.ep.getBoundingClientRect = () => ({ left: 0, top: 0, width: exp.ep.width, height: exp.ep.height });
    const p = reachablePoint(exp, 'Nucleus');
    exp.clickAt({ clientX: p.x, clientY: p.y }); // the same structure by pointer is not new
    expect(found(exp)).toEqual(['Nucleus']);
    expect(exp.reticle).toEqual({ x: p.x, y: p.y }); // a click also moves the crosshair there
  });
});
