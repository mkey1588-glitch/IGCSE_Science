import { test, expect } from '@playwright/test';
import { boot, mode, readout, nucleusInView, foundOnSlide, epStatus } from './helpers.js';

// 390 × 844 with touch emulation (a phone-sized viewport in desktop Chrome, not a physical device):
// Cell Explorer specimen work by tapping, and the Knowledge Constellation's filters and exit.
test.describe('390 × 844 touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  async function newGame(page) {
    await boot(page);
    await page.getByRole('button', { name: /Start new game/ }).tap();
    await page.getByRole('button', { name: /Begin adventure/ }).tap();
    await page.getByRole('button', { name: /Step onto the island/ }).tap();
    for (let i = 0; i < 12 && await page.locator('.dialogue').count(); i++) { await page.locator('.dialogue .text').tap({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(150); }
    await expect.poll(() => mode(page)).toBe('world');
  }

  /** Tap along the Focus slider, watching the Sharpness readout, until the image is sharp enough. */
  async function focusByTapping(page, min) {
    const slider = page.getByRole('slider', { name: 'Focus' });
    await slider.scrollIntoViewIfNeeded();
    const r = await slider.boundingBox(), y = r.y + r.height / 2;
    const sharpAt = async (x) => { await page.touchscreen.tap(x, y); return readout(page, 'Sharpness'); };
    let best = { x: r.x, s: -1 };
    for (let k = 0; k <= 40; k++) { const x = r.x + 2 + ((r.width - 4) * k) / 40; const s = await sharpAt(x); if (s > best.s) best = { x, s }; }
    for (let d = 1; best.s < min && d < 30; d++) for (const x of [best.x - d, best.x + d]) { const s = await sharpAt(x); if (s > best.s) best = { x, s }; }
    expect(await sharpAt(best.x)).toBeGreaterThanOrEqual(min);
  }

  test('Cell Explorer by touch: the eyepiece is on screen above the panel, and structures are identified by tapping', async ({ page }) => {
    await newGame(page);
    // Teacher mode opens the lab catalogue straight away (in the story, the first quest unlocks Cell Explorer)
    await page.getByRole('button', { name: 'Settings' }).tap();
    await page.getByRole('switch', { name: 'Teacher free-play mode' }).tap();
    await page.getByRole('button', { name: 'Close' }).tap();
    await page.getByRole('button', { name: 'Lab', exact: true }).tap();
    await page.getByRole('button', { name: /^Cell Explorer/ }).tap();
    await expect.poll(() => mode(page)).toBe('lab');

    // the eyepiece fits between the title bar and the panel, at a usable size
    const ep = await page.locator('.eyepiece').boundingBox();
    const top = await page.locator('.lab-top').boundingBox();
    const panel = await page.locator('.lab-panel').boundingBox();
    expect(ep.x).toBeGreaterThanOrEqual(0);
    expect(ep.x + ep.width).toBeLessThanOrEqual(390);
    expect(ep.y).toBeGreaterThan(top.y + top.height);
    expect(ep.y + ep.height).toBeLessThanOrEqual(panel.y);
    expect(ep.width).toBeGreaterThanOrEqual(250);

    // ×40, focused by tapping the slider
    await page.getByRole('button', { name: '×40' }).tap();
    await focusByTapping(page, 60);

    // tap the nucleus (the dark stain), then tap upwards through the cell towards its wall
    const tapAt = async (x, y) => { const r = await page.locator('.ep-canvas').boundingBox(); await page.touchscreen.tap(r.x + (x * r.width) / 460, r.y + (y * r.height) / 460); };
    const n = await nucleusInView(page);
    expect(n).not.toBeNull();
    await tapAt(n.x, n.y);
    await expect.poll(() => epStatus(page)).toMatch(/Nucleus identified/);
    for (let i = 1; i <= 30 && (await foundOnSlide(page)).length < 4; i++) await tapAt(n.x, n.y - 4 * i);
    expect(await foundOnSlide(page)).toEqual(['Cell wall', 'Cytoplasm', 'Nucleus', 'Vacuole']);
    await expect(page.locator('.lp-step').filter({ hasText: 'Find all structures' })).toHaveClass(/done/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('Knowledge Constellation: filters work and Back to island is on screen and works, with no sideways scrolling', async ({ page }) => {
    await newGame(page);
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
