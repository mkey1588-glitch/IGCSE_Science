import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test('practice quiz cards show no stray "null" (Osmosis)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.CATALYST.ui.quiz({ title: 'Practice · B3.2 Osmosis', subs: ['B3.2'], n: 3 }); });
  await expect(page.locator('.quiz .q')).toBeVisible();
  expect(await page.locator('.quiz').innerText()).not.toMatch(/\bnull\b/);
});
