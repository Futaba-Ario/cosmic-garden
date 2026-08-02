import { test, expect } from '@playwright/test';

test('pointer trails, charge and galaxy burst are visible and deterministic', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('http://127.0.0.1:4173/?debugDate=2026-12-01T23:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  await page.mouse.move(450, 300); await page.evaluate(() => window.advanceTime(250));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).effects.starDisplacement).toBeGreaterThan(0);
  await page.mouse.move(180, 250); await page.mouse.down();
  await page.mouse.move(650, 270, { steps: 12 });
  await page.waitForTimeout(80);
  const moving = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(moving.pointer.pressed).toBe(true); expect(moving.effects.trails).toBeGreaterThan(0);
  await page.evaluate(() => window.advanceTime(800));
  const charged = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(charged.pointer.holdRatio).toBe(1);
  await page.mouse.up(); await page.evaluate(() => window.advanceTime(30));
  const released = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(released.effects.galaxies).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('final-game-client.png') });
  await page.evaluate(() => window.advanceTime(2300));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).effects.galaxies).toBe(0);
  expect(errors).toEqual([]);
});

test('pointer cancellation and secondary pointers never create an accidental galaxy', async ({ page }) => {
  await page.goto('/?debugDate=2026-12-01T23:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  const canvas = page.locator('#cosmic-canvas');
  await canvas.dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: 200, clientY: 220 });
  await canvas.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', clientX: 700, clientY: 500 });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).pointer.worldX).toBeLessThan(0);
  await page.evaluate(() => window.advanceTime(800));
  await canvas.dispatchEvent('pointercancel', { pointerId: 11, pointerType: 'touch', clientX: 200, clientY: 220 });
  const cancelled = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(cancelled.pointer.pressed).toBe(false); expect(cancelled.effects.galaxies).toBe(0);
});
