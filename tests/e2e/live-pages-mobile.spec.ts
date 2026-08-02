import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LIVE_URL = 'https://futaba-ario.github.io/cosmic-garden/';
type Box = { x: number; y: number; width: number; height: number };

async function tap(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('タッチ対象が表示されていません。');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function touchPointer(page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number, pointerId = 51): Promise<void> {
  await page.locator('#cosmic-canvas').dispatchEvent(type, {
    pointerId, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
  });
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function assertLayout(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewportを取得できません。');
  const canvas = await page.locator('#cosmic-canvas').boundingBox();
  expect(canvas?.width).toBe(viewport.width); expect(canvas?.height).toBe(viewport.height);
  const locators = [page.locator('.status'), page.locator('.controls'), page.locator('.toast.is-visible')];
  const boxes: Box[] = [];
  for (const locator of locators) {
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

test('published Pages mobile acceptance journey', async ({ page }, testInfo) => {
  const output = join(process.cwd(), 'release-artifacts', 'live-pages', 'mobile');
  await mkdir(output, { recursive: true });
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const networkErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => networkErrors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    class RejectedAudioContext {
      state: AudioContextState = 'suspended';
      async resume(): Promise<void> { throw new Error('audio denied on live mobile'); }
      async close(): Promise<void> { this.state = 'closed'; }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: RejectedAudioContext });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
  });

  const response = await page.goto('?debugDate=2026-07-01T12:00:00', { waitUntil: 'networkidle' });
  expect(response?.status()).toBe(200);
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(initial.mode).toBe('cosmos'); expect(initial.fade).toBe(1);
  const portrait = page.viewportSize();
  if (!portrait) throw new Error('端末viewportを取得できません。');
  await assertLayout(page);
  await page.touchscreen.tap(Math.round(portrait.width * .5), Math.round(portrait.height * .42));
  await page.waitForTimeout(500);
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).pointer.type).toBe('touch');

  await touchPointer(page, 'pointermove', portrait.width * .52, portrait.height * .44, 41);
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
  expect(dragging.pointer.type).toBe('touch'); expect(dragging.effects.trails).toBeGreaterThan(0);
  await page.evaluate(() => window.advanceTime(800));
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).pointer.holdRatio).toBe(1);
  await touchPointer(page, 'pointerup', endX, y);
  await page.evaluate(() => window.advanceTime(30));
  const galaxy = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(galaxy.effects.galaxies).toBe(1);
  const slug = testInfo.project.name;
  await page.evaluate(() => window.advanceTime(250));
  await page.screenshot({ path: join(output, `${slug}-portrait.png`) });
  await page.evaluate(() => window.advanceTime(2300));
  const decayed = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(decayed.effects.galaxies).toBe(0);

  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(250); await page.evaluate(() => window.advanceTime(100));
  await assertLayout(page);
  // Playwright WebKitのresize直後のheadless screenshot合成回避。回転時のDOM/canvas検証は上で実施済み。
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  const landscape = page.viewportSize();
  if (!landscape) throw new Error('landscape viewportを取得できません。');
  await page.touchscreen.tap(Math.round(landscape.width * .5), Math.round(landscape.height * .42));
  await page.waitForTimeout(500); await assertLayout(page);
  await page.screenshot({ path: join(output, `${slug}-landscape.png`) });

  await tap(page, page.getByRole('button', { name: '環境音をオンにする' }));
  await expect(page.getByText('audio denied on live mobile')).toBeVisible();
  await tap(page, page.getByRole('button', { name: '作品のURLを共有またはコピーする' }));
  await expect(page.getByText('URLをコピーしました。')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await tap(page, page.getByRole('button', { name: '現在の宇宙をPNGとして保存する' }));
  const download = await downloadPromise; const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.length).toBeGreaterThan(10_000); expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  await assertLayout(page);
  expect(consoleErrors).toEqual([]); expect(pageErrors).toEqual([]); expect(networkErrors).toEqual([]);

  await writeFile(join(output, `${slug}.json`), JSON.stringify({
    project: slug, url: LIVE_URL, verifiedAt: new Date().toISOString(), portrait, landscape,
    checks: { http200: true, touchscreenTap: true, attraction: true, dragTrail: true, holdGalaxy: true, decay: true, viewportRotation: true, uiNoOverlap: true, audioRejectionHandled: true, shareFallback: true, pngDownload: true },
    states: { initial, attracted, dragging, galaxy, decayed }, pngBytes: png.length,
    errors: { console: consoleErrors, page: pageErrors, network: networkErrors }, limitation: 'Playwright device-profile emulation; not a physical device.',
  }, null, 2), 'utf8');
});
