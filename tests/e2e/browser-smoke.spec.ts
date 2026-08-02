import { test, expect } from '@playwright/test';

test('smoke: deterministic render, pointer trail, hold-release galaxy, and UI buttons', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/?debugDate=2026-10-01T18:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  await page.mouse.move(180, 300); await page.mouse.down(); await page.mouse.move(580, 500, { steps: 8 });
  const moving = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(moving.effects.trails).toBeGreaterThan(0);
  await page.evaluate(() => window.advanceTime(800)); await page.mouse.up(); await page.evaluate(() => window.advanceTime(30));
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.effects.galaxies).toBe(1);
  await expect(page.getByRole('button', { name: '現在の宇宙をPNGとして保存する' })).toBeVisible();
  expect(errors).toEqual([]);
});
