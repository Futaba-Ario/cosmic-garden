import { test, expect } from '@playwright/test';

const themes = [
  ['spring-morning', '2026-04-01T06:00:00'], ['spring-day', '2026-04-01T12:00:00'], ['spring-evening', '2026-04-01T18:00:00'], ['spring-night', '2026-04-01T23:00:00'],
  ['summer-morning', '2026-07-01T06:00:00'], ['summer-day', '2026-07-01T12:00:00'], ['summer-evening', '2026-07-01T18:00:00'], ['summer-night', '2026-07-01T23:00:00'],
  ['autumn-morning', '2026-10-01T06:00:00'], ['autumn-day', '2026-10-01T12:00:00'], ['autumn-evening', '2026-10-01T18:00:00'], ['autumn-night', '2026-10-01T23:00:00'],
  ['winter-morning', '2026-01-01T06:00:00'], ['winter-day', '2026-01-01T12:00:00'], ['winter-evening', '2026-01-01T18:00:00'], ['winter-night', '2026-01-01T23:00:00'],
] as const;

test('all sixteen deterministic time and season themes render without overlap or console errors', async ({ page }, testInfo) => {
  test.setTimeout(75_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [name, date] of themes) {
    await page.goto(`/?debugDate=${date}`);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.evaluate(() => window.advanceTime(3000));
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    expect(state.mode).toBe('cosmos'); expect(state.fade).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  }
  expect(errors).toEqual([]);
});

test('responsive canvas and controls cover portrait and landscape target sizes', async ({ page }, testInfo) => {
  const sizes = [[360, 800], [800, 360], [768, 1024], [1024, 768], [1440, 900]] as const;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/?debugDate=2026-07-01T12:00:00');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.evaluate(() => window.advanceTime(3000));
    const canvas = page.locator('#cosmic-canvas');
    await expect(canvas).toHaveJSProperty('clientWidth', width);
    await expect(canvas).toHaveJSProperty('clientHeight', height);
    const controls = page.locator('.controls');
    const box = await controls.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0); expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`${width}x${height}.png`) });
  }
});
