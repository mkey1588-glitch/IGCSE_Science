import { test, expect } from '@playwright/test';
import { boot, save, mode, focusedName, tabTo, continueDialogue, focusChoice, doCellExplorer } from './helpers.js';

test.describe('keyboard only: first chapter on the Core tier', () => {
  test('choose Core, enter and leave Cell Explorer, reload, Continue, and turn in the quest', async ({ page }) => {
    await boot(page);
    // title → new game, all by keyboard
    expect(await focusedName(page)).toMatch(/Start new game/);
    await page.keyboard.press('Enter');
    await expect.poll(() => focusedName(page)).toMatch(/scientist name/i);
    await page.keyboard.type('Kai');
    await page.keyboard.press('Tab'); // into the tier radio group (Extended is selected)
    expect(await page.evaluate(() => document.activeElement.matches('input[type=radio][name=tier]'))).toBe(true);
    await page.keyboard.press('ArrowLeft'); // arrow keys move the selection to Core
    expect(await page.evaluate(() => document.querySelector('input[name=tier][value=core]').checked)).toBe(true);
    await tabTo(page, /Begin adventure/);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await save(page))?.settings.tier).toBe('core');

    // prologue and Prof. Okafor's welcome
    await expect.poll(() => focusedName(page)).toMatch(/Step onto the island/);
    await page.keyboard.press('Enter');
    await expect(page.locator('.dialogue')).toBeVisible();
    await continueDialogue(page);
    await expect.poll(async () => (await save(page))?.quests.q_first_day?.step).toBe(0);

    // scanning the fig tree is a walk-and-press-E action; run the scan directly
    await page.evaluate(() => window.CATALYST.ui.scan('lab_fig'));
    await expect.poll(async () => (await save(page))?.quests.q_first_day?.step).toBe(1);

    // enter Cell Explorer from the quest tracker with Tab + Enter
    await page.locator('canvas').first().focus();
    await tabTo(page, /Open Cell Explorer/);
    await page.waitForTimeout(2500); // the quest card refreshes every second: focus must survive it
    expect(await focusedName(page)).toMatch(/Open Cell Explorer/);
    await page.keyboard.press('Enter');
    await expect.poll(() => mode(page)).toBe('lab');
    await expect.poll(() => focusedName(page)).toBe('Cell Explorer'); // focus moved into the lab panel
    // the Supplement question is marked optional on the Core tier
    await expect(page.locator('.aq.optional .qq')).toContainText('micrometres');

    await doCellExplorer(page); // cheek slide last
    await expect.poll(async () => (await save(page))?.exps.microscope?.done).toBe(true);
    await expect.poll(async () => (await save(page))?.quests.q_first_day?.step).toBe(2);

    // leave by keyboard: Shift+Tab from the panel heading reaches "Back to island"
    await page.locator('.lab-panel h2').focus();
    await tabTo(page, /Back to island/, { back: true });
    await page.keyboard.press('Enter');
    await expect.poll(() => mode(page)).toBe('world');
    await expect.poll(() => focusedName(page)).toMatch(/Answer the questions/); // focus lands on the next quest action

    // reload before turning in: Continue keeps the quest ready to hand in
    await page.reload();
    await page.waitForFunction(() => window.CATALYST?.mode === 'title');
    expect(await focusedName(page)).toMatch(/Continue/);
    await page.keyboard.press('Enter');
    await expect.poll(() => mode(page)).toBe('world');
    expect((await save(page)).quests.q_first_day).toMatchObject({ status: 'active', step: 2 });
    expect((await save(page)).mastery['B2.2.3'] || 0).toBe(0); // no credit for the Supplement question

    // the quiz step (covered by component tests) is passed directly; the turn-in is done by keyboard
    await page.evaluate(() => window.CATALYST.quests.advance('q_first_day'));
    await expect.poll(async () => (await save(page))?.quests.q_first_day?.step).toBe(3);
    await page.evaluate(() => { window.CATALYST.quests.talkTo('okafor'); }); // what pressing E next to her does
    const s = await continueDialogue(page);
    expect(s.choices).toBe(3);
    expect(await page.evaluate(() => document.activeElement.classList.contains('choice'))).toBe(true);
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
    await continueDialogue(page); // outro
    await expect.poll(() => focusedName(page)).toBe('Continue'); // quest-complete card
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await save(page))?.quests.q_first_day?.status).toBe('done');
  });
});

test.describe('390 × 844 touch screen: Knowledge Constellation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('filters work and Back to island is on screen and works, with no sideways scrolling', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: /Start new game/ }).tap();
    await page.getByRole('button', { name: /Begin adventure/ }).tap();
    await page.getByRole('button', { name: /Step onto the island/ }).tap();
    for (let i = 0; i < 12 && await page.locator('.dialogue').count(); i++) { await page.locator('.dialogue .text').tap({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(150); }
    await expect.poll(() => mode(page)).toBe('world');

    await page.getByRole('button', { name: 'Constellation' }).tap();
    await expect.poll(() => mode(page)).toBe('constellation');
    const exit = page.getByRole('button', { name: /Back to island/ });
    await expect(exit).toBeVisible();
    const box = await exit.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    for (const b of await page.locator('.cs-top button').all()) {
      const r = await b.boundingBox();
      expect(r.x + r.width, await b.textContent()).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.getByRole('button', { name: /Chemistry/ }).tap();
    await expect(page.getByRole('button', { name: /Chemistry/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.CATALYST.constellation.filter)).toBe('C');
    await page.getByRole('switch', { name: 'Show hidden links' }).tap();
    await expect(page.getByRole('switch', { name: 'Show hidden links' })).toHaveAttribute('aria-checked', 'true');
    await expect(exit).toBeVisible();

    await exit.tap();
    await expect.poll(() => mode(page)).toBe('world');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test('practice quiz cards show no stray "null" (Osmosis)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.CATALYST.ui.quiz({ title: 'Practice · B3.2 Osmosis', subs: ['B3.2'], n: 3 }); });
  await expect(page.locator('.quiz .q')).toBeVisible();
  expect(await page.locator('.quiz').innerText()).not.toMatch(/\bnull\b/);
});
