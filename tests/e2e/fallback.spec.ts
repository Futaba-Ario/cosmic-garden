import { test, expect } from '@playwright/test';

test('WebGL unavailable shows a dated 2D solar-system fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: function (type: string, ...args: unknown[]) { if (type === 'webgl' || type === 'webgl2') return null; return Reflect.apply(original, this, [type, ...args]); } });
  });
  await page.goto('/?debugDate=2026-08-08T12:00:00Z');
  await expect(page.locator('#fallback')).toHaveAttribute('data-reason', 'webgl-unavailable');
  await expect(page.locator('#fallback').getByText('いまの、太陽系。')).toBeVisible();
  await expect(page.locator('.fallback-body')).toHaveCount(10);
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.mode).toBe('fallback'); expect(state.fallbackReason).toBe('webgl-unavailable'); expect(state.bodyCount).toBe(10);
});

test('reduced motion chooses reduced quality and keeps the experience usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debugDate=2026-08-08T12:00:00Z');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(500));
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.mode).toBe('solar-system'); expect(state.reducedMotion).toBe(true); expect(state.quality).toBe('reduced');
});

test('WebGL context loss switches to fallback', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'solar-system');
  await page.locator('#cosmic-canvas').dispatchEvent('webglcontextlost');
  await expect(page.locator('#fallback')).toHaveAttribute('data-reason', 'context-lost');
});

test('visibility pauses and resumes deterministic updates', async ({ page }) => {
  await page.addInitScript(() => {
    let state: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
    Object.defineProperty(window, '__setTestVisibility', { value: (next: DocumentVisibilityState) => { state = next; document.dispatchEvent(new Event('visibilitychange')); } });
  });
  await page.goto('/'); await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(100));
  await page.evaluate(() => (window as typeof window & { __setTestVisibility: (state: DocumentVisibilityState) => void }).__setTestVisibility('hidden'));
  const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.evaluate(() => window.advanceTime(1000));
  const paused = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(paused.paused).toBe(true); expect(paused.elapsedMs).toBe(before.elapsedMs);
  await page.evaluate(() => (window as typeof window & { __setTestVisibility: (state: DocumentVisibilityState) => void }).__setTestVisibility('visible'));
  await page.evaluate(() => window.advanceTime(100));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).paused).toBe(false);
});
