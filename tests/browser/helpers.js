import { expect } from '@playwright/test';

export const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('catalyst.save.v1') || 'null'));
export const mode = (page) => page.evaluate(() => window.CATALYST?.mode);
export const focusedName = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim() : ''; });

export async function boot(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.CATALYST?.mode === 'title', null, { timeout: 60_000 });
}

/** Press Tab (or Shift+Tab) until the focused control's name matches. Keyboard only. */
export async function tabTo(page, re, { back = false, max = 60 } = {}) {
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

/**
 * Do Cell Explorer's practical work and Core analysis the way a pointer user does (eyepiece clicks,
 * panel controls), with the cheek slide chosen last. Keyboard navigation is tested separately.
 */
export async function doCellExplorer(page) {
  await page.evaluate(async () => {
    const lab = window.CATALYST.lab, exp = lab.active, el = lab.ui.el;
    const row = (label) => [...el.querySelectorAll('.ctl')].find((c) => c.querySelector('.lbl').textContent.trim().startsWith(label));
    const slide = (v) => { const s = row('Slide on the stage').querySelector('select'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
    const lens = (m) => [...row('Objective lens').querySelectorAll('button')].find((b) => b.textContent === `×${m}`).click();
    const focus = (v) => { const r = row('Focus').querySelector('input'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); };
    slide('onion'); lens(4); focus(0.52); lens(40); focus(0.52);
    const rect = exp.ep.getBoundingClientRect(), sc = exp.ep.width / rect.width;
    for (const name of ['Cell wall', 'Nucleus', 'Cytoplasm', 'Vacuole']) {
      let hit = null;
      for (let y = 2; y < exp.ep.height && !hit; y += 3) for (let x = 2; x < exp.ep.width && !hit; x += 3) if (exp.hitTest(x, y) === name) hit = [x, y];
      exp.clickAt({ clientX: rect.left + hit[0] / sc, clientY: rect.top + hit[1] / sc });
    }
    slide('leaf');
    const answer = (frag, v) => {
      const box = [...el.querySelectorAll('.aq')].find((b) => b.querySelector('.qq').textContent.includes(frag));
      if (typeof v === 'number') { box.querySelector('input').value = String(v); [...box.querySelectorAll('button')].find((b) => b.textContent === 'Check').click(); }
      else [...box.querySelectorAll('button.ao')].find((b) => b.textContent === v).click();
    };
    answer('total magnification', 400); answer('actual length in mm', 0.25); answer('palisade', 'Chloroplasts');
    answer('no cell wall', 'It is an animal cell — only plant cells and bacteria have walls');
    slide('cheek');
  });
}
