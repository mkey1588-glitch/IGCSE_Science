import { test, expect } from '@playwright/test';
import { boot, save, mode, focusedName, tabTo, continueDialogue, focusChoice, walkTo, readout, nucleusInView, foundOnSlide, epStatus, answerFor } from './helpers.js';

// Release gate: the whole first chapter with the keyboard only. Every action is a real key event on a
// visible control or in the 3D world (W A S D to walk, E to scan and talk). The test reads positions,
// pixels and text to decide what to press, as a player reads the screen; it calls no game methods.

const press = async (page, key, times = 1) => { for (let i = 0; i < times; i++) await page.keyboard.press(key); };
const plain = (s) => s.replace(/\s+/g, ' ').trim();

/** With the Focus slider focused: Page Up through the blur, then arrow keys towards the sharpest image. */
async function focusUntilSharp(page, min) {
  for (let i = 0; i < 12 && (await readout(page, 'Sharpness')) === 0; i++) await page.keyboard.press('PageUp');
  let dir = 'ArrowRight', prev = await readout(page, 'Sharpness');
  for (let i = 0; i < 300 && prev < min; i++) {
    await page.keyboard.press(dir);
    const s = await readout(page, 'Sharpness');
    if (s < prev) dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
    prev = s;
  }
  expect(prev).toBeGreaterThanOrEqual(min);
}

/** Choose a slide with the keyboard: on the focused select, type the first letters of its name. */
async function chooseSlide(page, typed, value) {
  await tabTo(page, /^Slide on the stage$/, { back: true });
  await page.waitForTimeout(1100); // the select's type-ahead joins letters typed within a second of each other
  await page.keyboard.type(typed);
  await expect.poll(() => page.evaluate(() => document.activeElement.value)).toBe(value);
}

/** Tab to the analysis question containing `frag` and answer it with the keyboard. */
async function answerQuestion(page, frag, value) {
  for (let i = 0; i < 60; i++) {
    const at = await page.evaluate(() => document.activeElement.closest('.aq')?.querySelector('.qq')?.textContent || '');
    if (at.includes(frag) && (typeof value === 'number' ? await page.evaluate(() => document.activeElement.tagName === 'INPUT') : plain(await focusedName(page)) === value)) break;
    await page.keyboard.press('Tab');
  }
  if (typeof value === 'number') { await page.keyboard.type(String(value)); await page.keyboard.press('Enter'); } else await page.keyboard.press('Enter');
  await expect(page.locator('.aq', { hasText: frag })).toHaveClass(/solved/);
}

test('keyboard only: a fresh Core profile plays First Day at the Lumen Lab through to the quest-complete card', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await boot(page);

  // ---- a new Core profile
  expect(await focusedName(page)).toMatch(/Start new game/);
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedName(page)).toMatch(/scientist name/i);
  await page.keyboard.type('Kai');
  await page.keyboard.press('Tab'); // into the tier radio group (Extended is selected)
  await page.keyboard.press('ArrowLeft'); // arrow keys move the selection to Core
  expect(await page.evaluate(() => document.querySelector('input[name=tier][value=core]').checked)).toBe(true);
  await tabTo(page, /Begin adventure/);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await save(page))?.settings.tier).toBe('core');

  // ---- accept the quest: the prologue, then Prof. Okafor's welcome
  await expect.poll(() => focusedName(page)).toMatch(/Step onto the island/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.dialogue')).toBeVisible();
  await continueDialogue(page);
  await expect.poll(async () => (await save(page))?.quests.q_first_day).toMatchObject({ status: 'active', step: 0 });

  // ---- walk to the Old Fig Tree (W A S D) and scan it (E)
  await walkTo(page, { poi: 'lab_fig' }, /Scan: The Old Fig Tree/);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await save(page))?.quests.q_first_day?.step, { timeout: 10_000 }).toBe(1);

  // ---- open Cell Explorer from the quest card
  await tabTo(page, /Open Cell Explorer/);
  await page.keyboard.press('Enter');
  await expect.poll(() => mode(page)).toBe('lab');
  await expect.poll(() => focusedName(page)).toBe('Cell Explorer'); // focus moved into the lab panel
  await expect(page.locator('.aq.optional .qq')).toContainText('micrometres'); // the Supplement question is optional on Core

  // onion slide (already on the stage) at ×4: focus it
  await tabTo(page, /^Focus$/);
  await focusUntilSharp(page, 76);
  // ×40, then refocus
  await tabTo(page, /^×40$/, { back: true });
  await page.keyboard.press('Enter');
  await tabTo(page, /^Focus$/);
  await focusUntilSharp(page, 76);
  // Tab from the Focus slider reaches the eyepiece control (the reported gap: it used to reach the first answer)
  await page.keyboard.press('Tab');
  expect(await focusedName(page)).toMatch(/Identify at crosshair/);
  await expect(page.locator('.eyepiece')).toHaveClass(/aiming/); // visible focus on the eyepiece too

  // identify the onion structures: crosshair onto the nucleus (seen as the dark stain), Enter; then up through
  // the cell towards its wall, pressing Enter at each step, reading the feedback
  const n = await nucleusInView(page);
  expect(n).not.toBeNull();
  const sx = Math.round((n.x - 230) / 4), sy = Math.round((n.y - 230) / 4);
  await press(page, sx > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(sx));
  await press(page, sy > 0 ? 'ArrowDown' : 'ArrowUp', Math.abs(sy));
  await page.keyboard.press('Enter');
  await expect.poll(() => epStatus(page)).toMatch(/Nucleus identified/);
  for (let i = 0; i < 30 && (await foundOnSlide(page)).length < 4; i++) { await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); }
  expect(await foundOnSlide(page)).toEqual(['Cell wall', 'Cytoplasm', 'Nucleus', 'Vacuole']);
  await expect(page.locator('.lp-step').filter({ hasText: 'Find all structures' })).toHaveClass(/done/);

  // the leaf slide, then the required analysis (the optional mm → µm conversion is skipped)
  await chooseSlide(page, 'Le', 'leaf');
  await answerQuestion(page, 'total magnification', 400);
  await answerQuestion(page, 'actual length in mm', 0.25);
  await answerQuestion(page, 'palisade', 'Chloroplasts');
  await answerQuestion(page, 'no cell wall', 'It is an animal cell — only plant cells and bacteria have walls');
  expect((await save(page)).exps.microscope?.done).toBeFalsy();
  // the cheek slide last: the lab completes, once
  await chooseSlide(page, 'Hu', 'cheek');
  await expect.poll(async () => (await save(page))?.exps.microscope?.done).toBe(true);
  await expect(page.locator('.note', { hasText: 'Experiment complete' })).toHaveCount(1);
  await chooseSlide(page, 'On', 'onion');
  await chooseSlide(page, 'Hu', 'cheek'); // repeating actions does not complete it again
  await expect(page.locator('.note', { hasText: 'Experiment complete' })).toHaveCount(1);
  expect((await save(page)).stats.experiments).toBe(1);
  await expect(page.locator('.aq.optional')).not.toHaveClass(/solved/);
  expect((await save(page)).quests.q_first_day.step).toBe(2);

  // ---- leave the lab: focus returns to the quest card's next action
  await tabTo(page, /^Exit$/);
  await page.keyboard.press('Enter');
  await expect.poll(() => mode(page)).toBe('world');
  await expect.poll(() => focusedName(page)).toMatch(/Answer the questions/);

  // ---- reload; Continue keeps the quest where it was
  await page.reload();
  await page.waitForFunction(() => window.CATALYST?.mode === 'title');
  expect(await focusedName(page)).toMatch(/Continue/);
  await page.keyboard.press('Enter');
  await expect.poll(() => mode(page)).toBe('world');
  const s = await save(page);
  expect(s.quests.q_first_day).toMatchObject({ status: 'active', step: 2 });
  expect(s.mastery['B2.2.3'] || 0).toBe(0); // no credit for the skipped Supplement question

  // ---- the Professor's quiz, by keyboard
  await tabTo(page, /Answer the questions/);
  await page.keyboard.press('Enter');
  for (let k = 0; k < 3; k++) {
    await expect(page.locator('.quiz .q')).toBeVisible();
    const ans = answerFor(await page.locator('.quiz .q').innerText(), await page.locator('.quiz .opt').allInnerTexts());
    if (typeof ans === 'string') {
      await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('opt'))).toBe(true); // focus starts on the first option
      for (let i = 0; i < 6 && plain(await focusedName(page)) !== ans; i++) await page.keyboard.press('Tab');
      expect(plain(await focusedName(page))).toBe(ans);
    } else {
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT');
      await page.keyboard.type(String(+ans.toPrecision(6)));
    }
    await page.keyboard.press('Enter');
    await expect(page.locator('.quiz .expl')).toContainText('Correct');
    await expect.poll(() => focusedName(page)).toMatch(/Next question|See results/);
    await page.keyboard.press('Enter');
  }
  await expect.poll(() => focusedName(page)).toBe('Continue');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await save(page))?.quests.q_first_day?.step).toBe(3);

  // ---- walk to Prof. Okafor (W A S D), talk (E) and turn the quest in
  await walkTo(page, { npc: 'okafor' }, /Talk to Prof\. Ada Okafor/);
  await page.keyboard.press('KeyE');
  await expect(page.locator('.dialogue')).toBeVisible();
  const d = await continueDialogue(page);
  expect(d.choices).toBe(3);
  // a wrong choice with Space: feedback, and the conversation stays open
  await focusChoice(page, /it is green/);
  await page.keyboard.press('Space');
  await expect(page.locator('.dialogue .choice.wrong')).toHaveCount(1);
  await expect(page.locator('.dialogue .feedback')).toBeVisible();
  // the right one with Enter
  await focusChoice(page, /seven life processes/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.dialogue .choice.right')).toHaveCount(1);
  await page.waitForTimeout(2000);
  await continueDialogue(page); // the Professor's closing lines
  const done = page.getByRole('dialog', { name: 'Quest complete: First Day at the Lumen Lab' });
  await expect(done).toBeVisible();
  await expect(done).toContainText('Quest complete');
  await expect(done).toContainText('First Day at the Lumen Lab');
  expect(await focusedName(page)).toBe('Continue');
  await page.keyboard.press('Enter');
  await expect(done).toHaveCount(0);
  await expect.poll(async () => (await save(page))?.quests.q_first_day?.status).toBe('done');
  expect(errors).toEqual([]);
});
