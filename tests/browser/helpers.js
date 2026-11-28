import { expect } from '@playwright/test';
import { QUESTIONS } from '../../src/data/questions.js';

// These helpers only *read* the game (positions, pixels, text on screen) to decide what a player would do
// next; every action goes through visible controls with real key presses, clicks or taps.

export const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('catalyst.save.v1') || 'null'));
export const mode = (page) => page.evaluate(() => window.CATALYST?.mode);
/** The name of the focused control ('' when nothing is focused: the page body is not a control). */
export const focusedName = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return '';
  return (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim();
});

export async function boot(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.CATALYST?.mode === 'title', null, { timeout: 60_000 });
}

/** Press Tab (or Shift+Tab) until the focused control's name matches. Keyboard only. */
export async function tabTo(page, re, { back = false, max = 80 } = {}) {
  for (let i = 0; i < max; i++) {
    if (re.test(await focusedName(page))) return;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`${back ? 'Shift+' : ''}Tab never reached ${re}; focus is on "${await focusedName(page)}"`);
}

/** Press Enter on the dialogue's Continue button until the dialogue closes or shows choices. */
export async function continueDialogue(page) {
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => ({ open: !!document.querySelector('.dialogue'), choices: document.querySelectorAll('.dialogue .choice').length, next: !!document.querySelector('.dialogue button.next') }));
    if (!s.open || s.choices) return s;
    if (s.next) {
      expect(await focusedName(page)).toMatch(/Continue/);
      await page.keyboard.press('Enter'); // the first press finishes the typing, the next one moves on
    }
    await page.waitForTimeout(150); // the last line of a question has no Continue: its choices appear when typing ends
  }
  throw new Error('dialogue did not finish');
}

/** Move focus between a dialogue's choices with Tab / Shift+Tab until it is on the one matching `re`. */
export async function focusChoice(page, re) {
  const texts = await page.locator('.dialogue .choice').allTextContents();
  const target = texts.findIndex((t) => re.test(t));
  if (target < 0) throw new Error(`no choice matches ${re}`);
  for (let i = 0; i < 8; i++) {
    const cur = await page.evaluate(() => [...document.querySelectorAll('.dialogue .choice')].indexOf(document.activeElement));
    if (cur === target) return;
    await page.keyboard.press(cur < target ? 'Tab' : 'Shift+Tab');
  }
  throw new Error(`could not focus the choice ${re}`);
}

// ------------------------------------------------------------------ walking (W A S D)
/**
 * Walk with the movement keys towards a point of interest ({ poi }) or a resident ({ npc }) until the
 * on-screen prompt names it. The keys move the player relative to the camera, so each step reads where
 * the target is on screen-space terms (camera yaw) and holds the matching keys for a moment.
 */
export async function walkTo(page, target, promptRe, { timeout = 90_000 } = {}) {
  const t0 = Date.now();
  let held = [], best = Infinity, stuck = 0, dodge = 0;
  const set = async (want) => {
    for (const k of held) if (!want.includes(k)) await page.keyboard.up(k);
    for (const k of want) if (!held.includes(k)) await page.keyboard.down(k);
    held = want;
  };
  try {
    while (Date.now() - t0 < timeout) {
      const s = await page.evaluate((t) => {
        const w = window.CATALYST.world;
        const p = t.poi ? w.pois[t.poi].pos : w.npcs[t.npc].ch.root.position;
        const pr = document.querySelector('.prompt');
        return { dx: p.x - w.ppos.x, dz: p.z - w.ppos.z, yaw: w.camYaw, prompt: pr && !pr.classList.contains('hidden') ? pr.textContent : '' };
      }, target);
      if (promptRe.test(s.prompt)) return;
      const d = Math.hypot(s.dx, s.dz), ux = s.dx / d, uz = s.dz / d;
      const fwd = ux * -Math.sin(s.yaw) + uz * -Math.cos(s.yaw); // towards the target along the camera's forward
      const right = ux * Math.cos(s.yaw) + uz * -Math.sin(s.yaw);
      let want = [];
      if (fwd > 0.38) want.push('KeyW'); else if (fwd < -0.38) want.push('KeyS');
      if (right > 0.38) want.push('KeyD'); else if (right < -0.38) want.push('KeyA');
      if (d < best - 0.2) { best = d; stuck = 0; } else stuck++;
      if (stuck > 8) { dodge = 6; stuck = 0; } // blocked: sidestep for a moment
      if (dodge > 0) { dodge--; want = [right >= 0 ? 'KeyA' : 'KeyD', fwd >= 0 ? 'KeyW' : 'KeyS']; }
      await set(want);
      await page.waitForTimeout(90);
    }
    throw new Error(`could not walk to ${JSON.stringify(target)}`);
  } finally { await set([]); }
}

// ------------------------------------------------------------------ Cell Explorer
/** The readout text of a lab readout ("Sharpness" → 87). */
export const readout = (page, label) => page.evaluate((l) => {
  const r = [...document.querySelectorAll('.readout')].find((x) => x.querySelector('.rl')?.textContent === l);
  return parseFloat(r?.querySelector('.rv')?.textContent || 'NaN');
}, label);

/**
 * Look at the eyepiece image and find the onion nucleus nearest the middle of the view (its dark brown
 * stain), in eyepiece pixels. Read from the canvas pixels: what the player sees, without the blur.
 */
export const nucleusInView = (page) => page.evaluate(() => {
  const c = document.querySelector('.ep-canvas');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const W = c.width, C = W / 2, pts = [];
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - C, y - C) > 120) continue; // the vignette darkens the edge of the view
    const i = (y * W + x) * 4;
    if (Math.abs(data[i] - 122) < 12 && Math.abs(data[i + 1] - 90) < 12 && Math.abs(data[i + 2] - 28) < 12) pts.push([x, y]);
  }
  if (!pts.length) return null;
  pts.sort((a, b) => Math.hypot(a[0] - C, a[1] - C) - Math.hypot(b[0] - C, b[1] - C));
  const blob = pts.filter((p) => Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < 20);
  return { x: blob.reduce((s, p) => s + p[0], 0) / blob.length, y: blob.reduce((s, p) => s + p[1], 0) / blob.length };
});

/** What the eyepiece checklist shows as found on the current slide. */
export const foundOnSlide = (page) => page.evaluate(() => {
  const sec = [...document.querySelectorAll('.lp-sec')].find((s) => s.querySelector('.st')?.textContent.startsWith('Identify structures'));
  return [...sec.querySelectorAll('.lp-step.done')].map((s) => s.textContent.replace('✓', '').trim()).sort();
});
export const epStatus = (page) => page.evaluate(() => document.querySelector('.ep-status')?.textContent || '');

// ------------------------------------------------------------------ quiz answers (the answer key)
const plain = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
/** The correct answer for a quiz question shown on screen: the bank's first option, or a computed value. */
export function answerFor(question, options) {
  const q = QUESTIONS.find((x) => plain(x.q) === plain(question));
  if (q) return q.opts ? plain(q.opts[0]) : q.ans;
  // generated magnification questions (B2.2)
  let m = question.match(/A cell is ([\d.]+) mm wide\. In a photo it measures ([\d.]+) mm/);
  if (m) return +m[2] / +m[1];
  m = question.match(/image of a cell is ([\d.]+) mm wide at ×(\d+) magnification/);
  if (m) return +m[1] / +m[2];
  throw new Error(`no answer known for "${question}" (${options.join(' | ')})`);
}
