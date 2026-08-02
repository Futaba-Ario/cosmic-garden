import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LIVE_URL = 'https://futaba-ario.github.io/cosmic-garden/';
const OUTPUT = join(process.cwd(), 'release-artifacts', 'live-pages', 'interaction');
const THEMES = [
  { name: 'spring-morning', date: '2026-04-01T06:00:00', season: 'spring', timeOfDay: 'morning' },
  { name: 'summer-day', date: '2026-07-01T12:00:00', season: 'summer', timeOfDay: 'day' },
  { name: 'autumn-evening', date: '2026-10-01T18:00:00', season: 'autumn', timeOfDay: 'evening' },
  { name: 'winter-night', date: '2026-01-01T23:00:00', season: 'winter', timeOfDay: 'night' },
] as const;

test('live Pages: themes, interactions, UI fallbacks and subpath assets', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await mkdir(OUTPUT, { recursive: true });
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const requestFailures: string[] = []; const badResponses: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400 && response.url().startsWith(LIVE_URL)) badResponses.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { Object.defineProperty(window, '__copiedLiveUrl', { configurable: true, value }); } } });
    class RejectedAudioContext { async resume(): Promise<void> { throw new Error('live audio denied'); } }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: RejectedAudioContext });
    let fullscreen = false;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen ? document.documentElement : null });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: async () => { fullscreen = true; } });
    Object.defineProperty(Document.prototype, 'exitFullscreen', { configurable: true, value: async () => { fullscreen = false; } });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const themeStates: Array<Record<string, unknown>> = [];
  for (const theme of THEMES) {
    await page.goto(`?debugDate=${theme.date}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
    await page.evaluate(() => window.advanceTime(3000));
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text())); themeStates.push(state);
    expect(state.fade).toBe(1); expect(state.season).toBe(theme.season); expect(state.timeOfDay).toBe(theme.timeOfDay); expect(state.mode).toBe('cosmos');
    const size = await page.locator('#cosmic-canvas').evaluate((canvas: HTMLCanvasElement) => ({ clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight }));
    expect(size).toEqual({ clientWidth: 1280, clientHeight: 720 });
    if (testInfo.project.name === 'chromium' && theme.name === 'spring-morning') await page.screenshot({ path: join(OUTPUT, 'pc.png') });
  }
  await page.mouse.move(640, 360); await page.evaluate(() => window.advanceTime(250));
  const attractionState = JSON.parse(await page.evaluate(() => window.render_game_to_text())); const attraction = attractionState.effects.starDisplacement as number;
  expect(attraction).toBeGreaterThan(0);
  await page.mouse.move(180, 280); await page.mouse.down(); await page.mouse.move(640, 360, { steps: 16 });
  const moving = JSON.parse(await page.evaluate(() => window.render_game_to_text())); expect(moving.effects.trails).toBeGreaterThan(0);
  await page.evaluate(() => window.advanceTime(800)); expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).pointer.holdRatio).toBe(1);
  await page.mouse.up(); await page.evaluate(() => window.advanceTime(900)); expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).effects.galaxies).toBe(1);
  if (testInfo.project.name === 'chromium') { await page.screenshot({ path: join(OUTPUT, 'interaction.png') }); await page.screenshot({ path: join(OUTPUT, 'interaction-detail.png'), clip: { x: 440, y: 160, width: 400, height: 400 } }); }
  await page.evaluate(() => window.advanceTime(2300)); expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).effects.galaxies).toBe(0);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: join(OUTPUT, 'decay.png') });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => typeof window.render_game_to_text === 'function'); await page.evaluate(() => window.advanceTime(3000));
  await page.getByRole('button', { name: '作品のURLを共有またはコピーする' }).click(); await expect(page.getByText('URLをコピーしました。')).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __copiedLiveUrl?: string }).__copiedLiveUrl)).toContain('/cosmic-garden/');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).ui.onboardingVisible).toBe(true);
  await page.getByRole('button', { name: '環境音をオンにする' }).click(); await expect(page.getByText('live audio denied')).toBeVisible();
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).mode).toBe('cosmos');
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '現在の宇宙をPNGとして保存する' }).click(); const download = await downloadEvent;
  const stream = await download.createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk)); const png = Buffer.concat(chunks); expect(png.length).toBeGreaterThan(10_000); expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  await page.keyboard.press('f'); expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).ui.fullscreen).toBe(true); await page.keyboard.press('Escape'); expect(JSON.parse(await page.evaluate(() => window.render_game_to_text())).ui.fullscreen).toBe(false);
  const finalState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const assetUrls = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.startsWith(location.origin)));
  const result = { verdict: 'PASS', project: testInfo.project.name, liveUrl: LIVE_URL, checkedAt: new Date().toISOString(), themes: themeStates.map((state) => ({ season: state.season, timeOfDay: state.timeOfDay, fade: state.fade, mode: state.mode })), attraction, pngBytes: png.length, assetUrls, finalState, consoleErrors, pageErrors, requestFailures, badResponses };
  await writeFile(join(OUTPUT, `${testInfo.project.name}.json`), `${JSON.stringify(result, null, 2)}\n`); await writeFile(join(OUTPUT, `${testInfo.project.name}.md`), `# Live Pages interaction — ${testInfo.project.name}\n\n- Verdict: **PASS**\n- URL: ${LIVE_URL}\n- Four themes: PASS\n- Attraction/trails/galaxy lifecycle: PASS\n- UI isolation/audio rejection/share fallback/PNG/fullscreen: PASS\n- PNG bytes: ${png.length}\n- Console/page/request/bad-response errors: ${consoleErrors.length}/${pageErrors.length}/${requestFailures.length}/${badResponses.length}\n`);
  expect(consoleErrors).toEqual([]); expect(pageErrors).toEqual([]); expect(requestFailures).toEqual([]); expect(badResponses).toEqual([]);
});
