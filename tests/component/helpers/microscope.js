// Drives Cell Explorer through its real panel controls and eyepiece.
import { setSelect, setSlider, choose, answer } from './harness.js';

const FOCUS = { onion: 0.52, cheek: 0.47, leaf: 0.58, root: 0.44, blood: 0.61, bacteria: 0.5 };
export const FIND = { onion: ['Cell wall', 'Nucleus', 'Cytoplasm', 'Vacuole'], cheek: ['Cell membrane', 'Nucleus', 'Cytoplasm'] };
export const STEP = 4; // crosshair movement per arrow key press, in eyepiece pixels

export const CORE_ANSWERS = [
  ['total magnification', 400],
  ['actual length in mm', 0.25],
  ['palisade', 'Chloroplasts'],
  ['no cell wall', 'It is an animal cell — only plant cells and bacteria have walls'],
];
export const SUPPLEMENT_ANSWERS = [['into micrometres', 250]];

const key = (el, code, shift = false) => {
  const ev = new KeyboardEvent('keydown', { key: code, code, shiftKey: shift, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
};

/** The keyboard control for the eyepiece (a native button in the panel). */
export const aimButton = (root) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes('Identify at crosshair'));

/** A point the crosshair can reach (whole arrow-key steps from where it is) that lies on `name`. */
export function reachablePoint(e, name) {
  const W = e.ep.width, c = W / 2, r0 = e.reticle;
  let best = null;
  for (let j = -60; j <= 60; j++) for (let i = -60; i <= 60; i++) {
    const x = r0.x + i * STEP, y = r0.y + j * STEP;
    if (Math.hypot(x - c, y - c) > c - 12) continue;
    if (e.hitTest(x, y) !== name) continue;
    const d = Math.abs(i) + Math.abs(j);
    if (!best || d < best.d) best = { x, y, i, j, d };
  }
  return best;
}

export function microscope(ctx) {
  const ui = () => ctx.game.lab.ui.el;
  const exp = () => ctx.game.lab.active;
  const api = {
    slide(spec) { setSelect(ui(), 'Slide on the stage', spec); },
    lens(mag) { choose(ui(), 'Objective lens', `×${mag}`); },
    focus(spec) { setSlider(ui(), 'Focus', FOCUS[spec]); },
    blur() { setSlider(ui(), 'Focus', 0.2); },
    /** Click every structure on the current slide in the eyepiece (through the real hit test). */
    findAll(spec = 'onion') {
      const e = exp();
      e.ep.getBoundingClientRect = () => ({ left: 0, top: 0, width: e.ep.width, height: e.ep.height });
      for (const name of FIND[spec]) {
        let hit = null;
        for (let y = 2; y < e.ep.height && !hit; y += 3) for (let x = 2; x < e.ep.width && !hit; x += 3) if (e.hitTest(x, y) === name) hit = [x, y];
        if (!hit) throw new Error(`Could not find ${name} in the eyepiece`);
        e.clickAt({ clientX: hit[0], clientY: hit[1] });
      }
    },
    /** Move the crosshair with arrow keys onto `name`, then press the control (Enter on a focused button). */
    identifyByKeyboard(name) {
      const e = exp(), btn = aimButton(ui());
      if (!btn) throw new Error('No keyboard identification control');
      btn.focus();
      const p = reachablePoint(e, name);
      if (!p) throw new Error(`Could not reach ${name} with the crosshair`);
      for (let k = 0; k < Math.abs(p.i); k++) key(btn, p.i > 0 ? 'ArrowRight' : 'ArrowLeft');
      for (let k = 0; k < Math.abs(p.j); k++) key(btn, p.j > 0 ? 'ArrowDown' : 'ArrowUp');
      btn.click(); // what the browser does for Enter or Space on a focused button
      return p;
    },
    findAllByKeyboard(spec = 'onion') { for (const name of FIND[spec]) api.identifyByKeyboard(name); },
    key: (code, shift) => key(aimButton(ui()), code, shift),
    // checklist steps, each done the way a player does it
    step0() { api.slide('onion'); api.lens(4); api.focus('onion'); },
    step1() { api.lens(40); api.focus('onion'); },
    step2() { api.findAll('onion'); },
    step3() { api.slide('cheek'); },
    step4(which = 'leaf') { api.slide(which); },
    step5(tier = 'extended') { answer(ui(), tier === 'core' ? CORE_ANSWERS : [...CORE_ANSWERS, ...SUPPLEMENT_ANSWERS]); },
    answerSupplement() { answer(ui(), SUPPLEMENT_ANSWERS); },
  };
  return api;
}
