import { test, expect } from '@playwright/test';

test('WebGL unavailable shows themed static fallback with a reason', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: function (type: string, ...args: unknown[]) { if (type === 'webgl' || type === 'webgl2') return null; return Reflect.apply(original, this, [type, ...args]); } });
  });
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('/?debugDate=2026-10-01T18:00:00');
  await expect(page.getByText('静かな星明かりの庭')).toBeVisible();
  await expect(page.locator('#fallback')).toHaveAttribute('data-reason', 'webgl-unavailable');
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.mode).toBe('fallback'); expect(state.fallbackReason).toBe('webgl-unavailable'); expect(state.season).toBe('autumn');
  await page.screenshot({ path: 'test-results/phase-5-fallback.png' });
  expect(errors).toEqual([]);
});

test('reduced motion chooses reduced quality and keeps the experience usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('/?debugDate=2026-04-01T06:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.mode).toBe('cosmos'); expect(state.reducedMotion).toBe(true); expect(state.quality).toBe('reduced');
  await page.screenshot({ path: 'test-results/phase-5-reduced-motion.png' });
  expect(errors).toEqual([]);
});

test('WebGL context loss switches to the static fallback', async ({ page }) => {
  await page.goto('/?debugDate=2026-07-01T12:00:00');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'cosmos');
  await page.locator('#cosmic-canvas').dispatchEvent('webglcontextlost');
  await expect(page.locator('#fallback')).toHaveAttribute('data-reason', 'context-lost');
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.mode).toBe('fallback'); expect(state.fallbackReason).toBe('context-lost');
});

test('visibility pauses deterministic updates and resumes them', async ({ page }) => {
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
  const resumed = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(resumed.paused).toBe(false); expect(resumed.elapsedMs).toBeGreaterThan(paused.elapsedMs);
});
