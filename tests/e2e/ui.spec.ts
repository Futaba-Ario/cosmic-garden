import { test, expect } from '@playwright/test';

test('onboarding, accessible controls, sharing fallback and UI pointer isolation work', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => undefined }, configurable: true });
    let fullscreen = false;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen ? document.documentElement : null });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: async function () { fullscreen = true; } });
    Object.defineProperty(Document.prototype, 'exitFullscreen', { configurable: true, value: async function () { fullscreen = false; } });
  });
  await page.goto('http://127.0.0.1:4173/?debugDate=2026-04-01T06:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000));
  await expect(page.getByText('触れて、あなただけの銀河を。')).toBeVisible();
  await expect(page.getByText(/近づけると星が集まり/)).toBeVisible();
  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(initial.ui.onboardingVisible).toBe(true);
  await page.getByRole('button', { name: '作品のURLを共有またはコピーする' }).click();
  await expect(page.getByText('URLをコピーしました。')).toBeVisible();
  const afterUiClick = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(afterUiClick.ui.onboardingVisible).toBe(true);
  await page.mouse.click(160, 300);
  await expect(page.locator('[data-onboarding]')).toHaveClass(/is-hidden/);
  await page.waitForTimeout(500);
  const afterCanvasClick = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(afterCanvasClick.ui.onboardingVisible).toBe(false);
  await page.getByRole('button', { name: '環境音をオンにする' }).click();
  await expect(page.getByRole('button', { name: '環境音をオフにする' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '現在の宇宙をPNGとして保存する' }).click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/^cosmic-garden-\d{4}-\d{2}-\d{2}\.png$/);
  await png.saveAs(testInfo.outputPath('captured-cosmos.png'));
  const stream = await png.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks); expect(bytes.length).toBeGreaterThan(10_000); expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  await page.keyboard.press('f');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).ui.fullscreen).toBe(true);
  await page.keyboard.press('Escape');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).ui.fullscreen).toBe(false);
  await page.screenshot({ path: 'test-results/phase-4-ui.png' });
  expect(errors).toEqual([]);
});

test('audio, sharing and PNG failures are non-destructive', async ({ page }) => {
  await page.addInitScript(() => {
    class RejectedAudioContext { async resume(): Promise<void> { throw new Error('audio denied'); } }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: RejectedAudioContext });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { configurable: true, value: (callback: BlobCallback) => callback(null) });
  });
  await page.goto('/?debugDate=2026-04-01T06:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.getByRole('button', { name: '環境音をオンにする' }).click();
  await expect(page.getByText('audio denied')).toBeVisible();
  await page.getByRole('button', { name: '作品のURLを共有またはコピーする' }).click();
  await expect(page.getByText('共有できませんでした。')).toBeVisible();
  await page.getByRole('button', { name: '現在の宇宙をPNGとして保存する' }).click();
  await expect(page.getByText('PNGを保存できませんでした。')).toBeVisible();
  const before = JSON.parse(await page.evaluate(() => window.render_game_to_text())).elapsedMs;
  await page.evaluate(() => window.advanceTime(100));
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(state.mode).toBe('cosmos'); expect(state.elapsedMs).toBeGreaterThan(before);
});
