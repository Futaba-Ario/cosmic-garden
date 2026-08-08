import { test, expect } from '@playwright/test';

test('smoke: deterministic solar system, labels and utility UI render', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/?debugDate=2026-08-08T12:00:00Z');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(1200));
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.mode).toBe('solar-system');
  expect(state.bodyCount).toBe(10);
  expect(state.bodies.map((body: { id: string }) => body.id)).toContain('neptune');
  await expect(page.getByRole('button', { name: '地球を選択' })).toBeVisible();
  await expect(page.getByRole('button', { name: '現在の太陽系をPNGとして保存する' })).toBeVisible();
  expect(errors).toEqual([]);
});
