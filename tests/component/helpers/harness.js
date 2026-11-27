// Loads the real game modules into a fresh module graph for each test, with a stand-in
// engine and a stand-in for the parts of the HUD that only show messages.
import { vi } from 'vitest';

const ROOT = '../../../src';

/** A 3D engine stand-in: LabView only needs a canvas, an environment map and label layers. */
function fakeEngine() {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  return {
    canvas,
    envMap: null,
    view: null,
    createLabelLayer() { const domElement = document.createElement('div'); return { domElement, setSize() {}, render() {} }; },
    setOutline() {},
    setView(v) { this.view = v; },
  };
}

/** HUD stand-in: records toasts; dialogue/quiz/reward resolve through handlers the test sets. */
function fakeUI() {
  const ui = {
    toasts: [],
    toast(icon, html) { ui.toasts.push(html); },
    updateQuestTracker() {}, updateHUD() {}, closeAllModals() {}, closeTopModal() {}, showHUD() {},
    chip: (id) => { const s = document.createElement('span'); s.textContent = id; return s; },
    onDialogue: null, onQuiz: null,
    dialogue(lines, opts = {}) { ui.lastDialogue = { lines, opts }; return Promise.resolve(ui.onDialogue ? ui.onDialogue(lines, opts) : null); },
    quiz(opts) { ui.lastQuiz = opts; return Promise.resolve(ui.onQuiz ? ui.onQuiz(opts) : { correct: 0, total: 0, passed: false }); },
    bigReward() { return Promise.resolve(); },
  };
  return ui;
}

/**
 * Fresh game: new module instances (state, event bus, quests, lab), an empty save,
 * and a new player on the given tier. `keepSave` keeps localStorage (used to test reloads).
 */
export async function freshGame({ tier = 'extended', name = 'Tester', keepSave = false } = {}) {
  vi.resetModules();
  if (!keepSave) localStorage.clear();
  document.body.innerHTML = '';
  const stateMod = await import(`${ROOT}/core/state.js`);
  const util = await import(`${ROOT}/core/util.js`);
  const { bus } = await import(`${ROOT}/core/events.js`);
  const { game } = await import(`${ROOT}/game.js`);
  const { QuestSystem } = await import(`${ROOT}/quests/questSystem.js`);
  const { LabView } = await import(`${ROOT}/lab/lab.js`);
  const { META } = await import(`${ROOT}/lab/registry.js`);
  const curriculum = await import(`${ROOT}/data/curriculum.js`);
  const questions = await import(`${ROOT}/data/questions.js`);
  const world = await import(`${ROOT}/data/world.js`);
  if (keepSave) stateMod.load(); else stateMod.newGame(name, tier);
  const uiRoot = document.createElement('div');
  document.body.append(uiRoot);
  game.engine = fakeEngine();
  game.ui = fakeUI();
  game.mode = 'world';
  game.quests = new QuestSystem();
  game.lab = new LabView(game.engine, uiRoot);
  game.openLab = (id, opts = {}) => game.lab.open(id, opts);
  game.closeLab = async () => { game.lab.close(); };
  game.onScanned = (poi) => { stateMod.state.scanned[poi.id] = true; stateMod.raise(poi.ids, 1, 'scan'); bus.emit('scan', poi.id); stateMod.save(); };
  const ctx = { ...stateMod, ...util, bus, game, META, curriculum, questions, world, uiRoot };
  ctx.advance = (seconds, dt) => advance(ctx, seconds, dt);
  return ctx;
}

/** Run the frame loop for `seconds` of game time (tweens + the open experiment), letting promises settle. */
export async function advance(ctx, seconds, dt = 1 / 30) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) {
    ctx.tweens.update(dt);
    if (ctx.game.lab?.active) ctx.game.lab.update(dt, i * dt);
    await Promise.resolve();
  }
  await flush();
}
export const flush = () => new Promise((r) => setTimeout(r, 0));

/** Deterministic Math.random for a test. */
export function seedRandom(seed = 1) {
  let a = seed >>> 0;
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

// ------------------------------------------------------------------ panel helpers (drive the real controls)
const norm = (s) => s.replace(/\s+/g, ' ').trim();
/** The control row whose label starts with `label`. */
export function control(root, label) {
  const row = [...root.querySelectorAll('.ctl')].find((c) => norm(c.querySelector('.lbl')?.textContent || '').startsWith(label));
  if (!row) throw new Error(`No control labelled "${label}"`);
  return row;
}
export function setSlider(root, label, value) {
  const inp = control(root, label).querySelector('input[type=range]');
  inp.value = String(value);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return inp;
}
export function setSelect(root, label, value) {
  const sel = control(root, label).querySelector('select');
  sel.value = String(value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return sel;
}
/** Click the option or button whose text matches inside a control row (segmented choices). */
export function choose(root, label, text) {
  const el = [...control(root, label).querySelectorAll('button, span')].find((b) => norm(b.textContent) === text);
  if (!el) throw new Error(`No option "${text}" in "${label}"`);
  el.click();
  return el;
}
export function clickButton(root, text) {
  const el = [...root.querySelectorAll('button')].find((b) => norm(b.textContent).includes(text));
  if (!el) throw new Error(`No button "${text}"`);
  el.click();
  return el;
}
/** Answer analysis questions. answers: [[question text fragment, correct option text | number]]. */
export function answer(root, answers) {
  for (const [frag, value] of answers) {
    const box = [...root.querySelectorAll('.aq')].find((b) => norm(b.querySelector('.qq').textContent).includes(frag));
    if (!box) throw new Error(`No question containing "${frag}"`);
    if (typeof value === 'number') {
      box.querySelector('input').value = String(value);
      [...box.querySelectorAll('button')].find((b) => norm(b.textContent) === 'Check').click();
    } else {
      const opt = [...box.querySelectorAll('button.ao')].find((b) => norm(b.textContent) === value);
      if (!opt) throw new Error(`No option "${value}" for "${frag}"`);
      opt.click();
    }
  }
}
export const stepStates = (root, sectionTitle = 'Procedure') => {
  const sec = [...root.querySelectorAll('.lp-sec')].find((s) => norm(s.querySelector('.st')?.textContent || '') === sectionTitle);
  return [...sec.querySelectorAll('.lp-step')].map((s) => s.classList.contains('done'));
};
