import { test, expect } from '@playwright/test';

const dates = ['2026-01-01T00:00:00Z', '2026-04-01T00:00:00Z', '2026-08-08T12:00:00Z', '2026-12-01T00:00:00Z'];

test('representative dates produce deterministic finite body positions', async ({ page }) => {
  test.setTimeout(45_000);
  for (const date of dates) {
    await page.goto(`/?debugDate=${date}`);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.evaluate(() => window.advanceTime(500));
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    expect(state.mode).toBe('solar-system'); expect(state.bodyCount).toBe(10);
    expect(state.bodies.every((body: { distanceAU: number; longitudeDeg: number }) => Number.isFinite(body.distanceAU) && Number.isFinite(body.longitudeDeg))).toBe(true);
  }
});

test('responsive canvas and controls fit portrait and landscape sizes', async ({ page }) => {
  const sizes = [[360, 800], [800, 360], [768, 1024], [1440, 900]] as const;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/?debugDate=2026-08-08T12:00:00Z');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.evaluate(() => window.advanceTime(300));
    await expect(page.locator('#cosmic-canvas')).toHaveJSProperty('clientWidth', width);
    await expect(page.locator('#cosmic-canvas')).toHaveJSProperty('clientHeight', height);
    const controls = await page.locator('.controls').boundingBox();
    expect(controls?.x).toBeGreaterThanOrEqual(0); expect((controls?.x ?? 0) + (controls?.width ?? 0)).toBeLessThanOrEqual(width + .5);
  }
});
