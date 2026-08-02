import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

type Box = { x: number; y: number; width: number; height: number };

async function tap(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('タッチ対象が表示されていません。');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function touchPointer(page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number, pointerId = 23): Promise<void> {
  await page.locator('#cosmic-canvas').dispatchEvent(type, {
    pointerId, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
  });
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function expectMobileLayout(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewportを取得できません。');
  const canvas = await page.locator('#cosmic-canvas').boundingBox();
  expect(canvas?.width).toBe(viewport.width); expect(canvas?.height).toBe(viewport.height);
  const visibleUi = [page.locator('.status'), page.locator('.controls'), page.locator('.toast.is-visible')];
  const boxes: Box[] = [];
  for (const locator of visibleUi) {
    if (await locator.count() === 0 || !(await locator.isVisible())) continue;
    const box = await locator.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + .5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + .5);
    boxes.push(box);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(intersects(boxes[i], boxes[j])).toBe(false);
}

test('mobile touch journey: attraction, trail, hold galaxy, rotation and utility UI', async ({ page }, testInfo) => {
  const releaseOutput = join(process.cwd(), 'release-artifacts', 'mobile');
  await mkdir(releaseOutput, { recursive: true });
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  await page.addInitScript(() => {
    class RejectedAudioContext {
      state: AudioContextState = 'suspended';
      async resume(): Promise<void> { throw new Error('audio denied on mobile'); }
      async close(): Promise<void> { this.state = 'closed'; }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: RejectedAudioContext });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
  });

  await page.goto('/?debugDate=2026-07-01T12:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  const portrait = page.viewportSize();
  if (!portrait) throw new Error('端末viewportを取得できません。');
  await expectMobileLayout(page);

  await page.touchscreen.tap(Math.round(portrait.width * .5), Math.round(portrait.height * .42));
  await expect(page.locator('[data-onboarding]')).toHaveClass(/is-hidden/);
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).pointer.type).toBe('touch');

  // Touchscreen APIにはdrag/holdのdown/move/upがないため、mouseを使わずtouch Pointer Eventsで継続操作する。
  await touchPointer(page, 'pointermove', portrait.width * .52, portrait.height * .44, 17);
  await page.evaluate(() => window.advanceTime(220));
  const attracted = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(attracted.effects.starDisplacement).toBeGreaterThan(0);

  const startX = portrait.width * .2; const endX = portrait.width * .78; const y = portrait.height * .52;
  await touchPointer(page, 'pointerdown', startX, y);
  for (let step = 1; step <= 9; step++) {
    await touchPointer(page, 'pointermove', startX + (endX - startX) * step / 9, y + Math.sin(step) * 9);
    await page.waitForTimeout(12);
  }
  const dragging = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(dragging.pointer.type).toBe('touch'); expect(dragging.pointer.pressed).toBe(true); expect(dragging.effects.trails).toBeGreaterThan(0);
  await page.evaluate(() => window.advanceTime(800));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).pointer.holdRatio).toBe(1);
  await touchPointer(page, 'pointerup', endX, y);
  await page.evaluate(() => window.advanceTime(30));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).effects.galaxies).toBe(1);

  const slug = testInfo.project.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  await page.screenshot({ path: join(releaseOutput, `${slug}-portrait.png`) });
  await page.evaluate(() => window.advanceTime(2300));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).effects.galaxies).toBe(0);

  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.advanceTime(100));
  await page.waitForTimeout(100);
  await expectMobileLayout(page);
  // WebKitのmobile viewport resize直後はheadless screenshot合成が黒くなるため、
  // 同じlandscape viewportで再読込して目視用画像を取得する。回転時の寸法検証は上で完了済み。
  await page.reload();
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  const landscape = page.viewportSize();
  if (!landscape) throw new Error('landscape viewportを取得できません。');
  await page.touchscreen.tap(Math.round(landscape.width * .5), Math.round(landscape.height * .42));
  await page.waitForTimeout(500);
  await expectMobileLayout(page);
  await page.screenshot({ path: join(releaseOutput, `${slug}-landscape.png`) });

  await tap(page, page.getByRole('button', { name: '環境音をオンにする' }));
  await expect(page.getByText('audio denied on mobile')).toBeVisible();
  await tap(page, page.getByRole('button', { name: '作品のURLを共有またはコピーする' }));
  await expect(page.getByText('URLをコピーしました。')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await tap(page, page.getByRole('button', { name: '現在の宇宙をPNGとして保存する' }));
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cosmic-garden-\d{4}-\d{2}-\d{2}\.png$/);
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks); expect(png.length).toBeGreaterThan(10_000); expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

  await expectMobileLayout(page);
  expect(consoleErrors).toEqual([]);
});
