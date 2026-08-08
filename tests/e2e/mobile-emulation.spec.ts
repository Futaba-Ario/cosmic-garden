import { test, expect, type Page } from '@playwright/test';

async function touch(page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', id: number, x: number, y: number): Promise<void> {
  await page.locator('#cosmic-canvas').dispatchEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true });
}

test('mobile journey supports touch rotation, pinch zoom, planet detail and utilities', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
  });
  await page.goto('/?debugDate=2026-08-08T12:00:00Z');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(500));
  const viewport = page.viewportSize()!;
  const canvas = await page.locator('#cosmic-canvas').boundingBox();
  expect(canvas?.width).toBe(viewport.width); expect(canvas?.height).toBe(viewport.height);

  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await touch(page, 'pointerdown', 1, viewport.width * .35, viewport.height * .4);
  await touch(page, 'pointermove', 1, viewport.width * .7, viewport.height * .48);
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).pointer.dragging).toBe(true);
  await touch(page, 'pointerup', 1, viewport.width * .7, viewport.height * .48);
  await page.evaluate(() => window.advanceTime(600));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).camera.yaw).not.toBeCloseTo(initial.camera.yaw, 2);

  const beforePinch = JSON.parse(await page.evaluate(() => window.render_game_to_text())).camera.distance;
  await touch(page, 'pointerdown', 1, viewport.width * .35, viewport.height * .48);
  await touch(page, 'pointerdown', 2, viewport.width * .65, viewport.height * .48);
  await touch(page, 'pointermove', 2, viewport.width * .82, viewport.height * .48);
  await touch(page, 'pointerup', 2, viewport.width * .82, viewport.height * .48);
  await touch(page, 'pointerup', 1, viewport.width * .35, viewport.height * .48);
  await page.evaluate(() => window.advanceTime(900));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).camera.distance).toBeLessThan(beforePinch);

  await page.getByRole('button', { name: '地球を選択' }).click();
  await expect(page.getByRole('heading', { name: '地球' })).toBeVisible();
  const detail = await page.locator('[data-detail]').boundingBox();
  expect(detail?.x).toBeGreaterThanOrEqual(0); expect((detail?.x ?? 0) + (detail?.width ?? 0)).toBeLessThanOrEqual(viewport.width + .5);
  await page.getByRole('button', { name: '作品のURLを共有またはコピーする' }).click();
  await expect(page.getByText('URLをコピーしました。')).toBeVisible();
  expect(errors).toEqual([]);
});
