import { test, expect } from '@playwright/test';

test('onboarding, accessible controls, sharing fallback and PNG capture work', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => undefined }, configurable: true });
  });
  await page.goto('/?debugDate=2026-08-08T12:00:00Z');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(700));
  await expect(page.getByText('太陽系を、手のひらで。')).toBeVisible();
  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  expect(initial.ui.onboardingVisible).toBe(true);
  await page.getByRole('button', { name: '作品のURLを共有またはコピーする' }).click();
  await expect(page.getByText('URLをコピーしました。')).toBeVisible();
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).ui.onboardingVisible).toBe(true);

  await page.mouse.move(160, 300); await page.mouse.down(); await page.mouse.move(200, 330); await page.mouse.up();
  await expect(page.locator('[data-onboarding]')).toHaveClass(/is-hidden/);

  await page.getByRole('button', { name: '地球を選択' }).click();
  await expect(page.getByRole('heading', { name: '地球' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '現在の太陽系をPNGとして保存する' }).click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/^solar-system-now-\d{4}-\d{2}-\d{2}\.png$/);
  await png.saveAs(testInfo.outputPath('captured-solar-system.png'));
  const stream = await png.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).length).toBeGreaterThan(10_000);
});

test('audio, sharing and PNG failures are non-destructive', async ({ page }) => {
  await page.addInitScript(() => {
    class RejectedAudioContext { async resume(): Promise<void> { throw new Error('audio denied'); } }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: RejectedAudioContext });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { configurable: true, value: (callback: BlobCallback) => callback(null) });
  });
  await page.goto('/'); await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.getByRole('button', { name: '環境音をオンにする' }).click();
  await expect(page.getByText('audio denied')).toBeVisible();
  await page.getByRole('button', { name: '作品のURLを共有またはコピーする' }).click();
  await expect(page.getByText('共有できませんでした。')).toBeVisible();
  await page.getByRole('button', { name: '現在の太陽系をPNGとして保存する' }).click();
  await expect(page.getByText('PNGを保存できませんでした。')).toBeVisible();
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).mode).toBe('solar-system');
});
