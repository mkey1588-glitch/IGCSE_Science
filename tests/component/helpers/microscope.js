// Drives Cell Explorer through its real panel controls and eyepiece.
import { setSelect, setSlider, choose, answer } from './harness.js';

const FOCUS = { onion: 0.52, cheek: 0.47, leaf: 0.58, root: 0.44, blood: 0.61, bacteria: 0.5 };
const FIND = { onion: ['Cell wall', 'Nucleus', 'Cytoplasm', 'Vacuole'] };

export const CORE_ANSWERS = [
  ['total magnification', 400],
  ['actual length in mm', 0.25],
  ['palisade', 'Chloroplasts'],
  ['no cell wall', 'It is an animal cell — only plant cells and bacteria have walls'],
];
export const SUPPLEMENT_ANSWERS = [['into micrometres', 250]];

export function microscope(ctx) {
  const ui = () => ctx.game.lab.ui.el;
  const exp = () => ctx.game.lab.active;
  const api = {
    slide(spec) { setSelect(ui(), 'Slide on the stage', spec); },
    lens(mag) { choose(ui(), 'Objective lens', `×${mag}`); },
    focus(spec) { setSlider(ui(), 'Focus', FOCUS[spec]); },
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
