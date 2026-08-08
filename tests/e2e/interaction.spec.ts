import { test, expect } from '@playwright/test';

test('drag rotates the camera and choosing a planet focuses it', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.goto('/?debugDate=2026-08-08T12:00:00Z');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(500));
  const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.mouse.move(420, 360);
  await page.mouse.down();
  await page.mouse.move(620, 430, { steps: 8 });
  const dragging = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(dragging.pointer.dragging).toBe(true);
  await page.mouse.up();
  await page.evaluate(() => window.advanceTime(800));
  const rotated = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(rotated.camera.yaw).not.toBeCloseTo(before.camera.yaw, 2);

  await page.getByRole('button', { name: '木星を選択' }).click();
  await page.evaluate(() => window.advanceTime(1200));
  const focused = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(focused.selectedBody).toBe('jupiter');
  await expect(page.getByRole('heading', { name: '木星' })).toBeVisible();
  expect(focused.camera.distance).toBeLessThan(20);

  await page.getByRole('button', { name: '太陽系全体を見る' }).click();
  await page.evaluate(() => window.advanceTime(1200));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).selectedBody).toBeNull();
});

test('pointer cancellation ends a touch gesture without selecting a body', async ({ page }) => {
  await page.goto('/?debugDate=2026-08-08T12:00:00Z');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  const canvas = page.locator('#cosmic-canvas');
  await canvas.dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: 200, clientY: 220 });
  await canvas.dispatchEvent('pointermove', { pointerId: 11, pointerType: 'touch', clientX: 300, clientY: 260 });
  await canvas.dispatchEvent('pointercancel', { pointerId: 11, pointerType: 'touch', clientX: 300, clientY: 260 });
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.pointer.pressed).toBe(false);
  expect(state.selectedBody).toBeNull();
});
