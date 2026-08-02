/* global console, document, fetch, performance, setTimeout, URL, window */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');
const OUTPUT_DIR = path.join(ROOT, 'release-artifacts', 'network');
const BASE_URL = 'http://127.0.0.1:4175';
const TRIALS = 5;
const NETWORK = {
  label: 'Slow 4G equivalent (local CDP throttling)',
  offline: false,
  latencyMs: 150,
  downloadBitsPerSecond: 1_600_000,
  uploadBitsPerSecond: 750_000,
  downloadThroughputBytesPerSecond: 200_000,
  uploadThroughputBytesPerSecond: 93_750,
  cacheDisabled: true,
};
const PASS_CRITERIA = {
  allTrialsReachRenderState: true,
  allTrialsReachFadeOne: true,
  consoleErrors: 0,
  medianRenderReadyMsMax: 5_000,
  medianFadeOneMsMax: 8_000,
  maximumFadeOneMsMax: 10_000,
};

const round = (value) => Math.round(value * 10) / 10;
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function stats(trials, key) {
  const values = trials.map((trial) => trial[key]);
  return { median: round(median(values)), maximum: round(Math.max(...values)) };
}
const formatBytes = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;

async function waitForPreview(url, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the production preview server.');
}

async function measureTrial(browser, number) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const requests = new Map();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: NETWORK.offline,
    latency: NETWORK.latencyMs,
    downloadThroughput: NETWORK.downloadThroughputBytesPerSecond,
    uploadThroughput: NETWORK.uploadThroughputBytesPerSecond,
    connectionType: 'cellular4g',
  });
  cdp.on('Network.responseReceived', (event) => {
    requests.set(event.requestId, {
      url: event.response.url,
      mimeType: event.response.mimeType,
      encodedBytes: 0,
      fromDiskCache: event.response.fromDiskCache,
      fromServiceWorker: event.response.fromServiceWorker,
    });
  });
  cdp.on('Network.loadingFinished', (event) => {
    const request = requests.get(event.requestId);
    if (request) request.encodedBytes = event.encodedDataLength;
  });

  const startedAt = Date.now();
  await page.goto(`${BASE_URL}/?debugDate=2026-12-01T23:00:00&networkTrial=${number}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function', undefined, { timeout: 10_000 });
  const renderReadyMs = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).fade >= 1, undefined, { timeout: 12_000 });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const state = JSON.parse(window.render_game_to_text());
    return {
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
      fadeOneMs: performance.now(),
      state,
      scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
      styles: [...document.styleSheets].map((sheet) => sheet.href).filter(Boolean),
    };
  });
  await page.waitForTimeout(150);

  const completedRequests = [...requests.values()].filter((request) => request.url.startsWith(BASE_URL));
  const transfer = {
    javascriptBytes: completedRequests.filter((request) => request.mimeType.includes('javascript')).reduce((sum, request) => sum + request.encodedBytes, 0),
    cssBytes: completedRequests.filter((request) => request.mimeType.includes('css')).reduce((sum, request) => sum + request.encodedBytes, 0),
    totalBytes: completedRequests.reduce((sum, request) => sum + request.encodedBytes, 0),
  };
  const trial = {
    trial: number,
    wallClockMs: Date.now() - startedAt,
    domContentLoadedMs: round(metrics.domContentLoadedMs),
    renderReadyMs: round(renderReadyMs),
    fadeOneMs: round(metrics.fadeOneMs),
    fade: metrics.state.fade,
    mode: metrics.state.mode,
    transfer,
    productionAssets: [...metrics.scripts, ...metrics.styles].every((url) => /\/assets\/[^/]+-[A-Za-z0-9_-]+\.(js|css)$/.test(new URL(url).pathname)),
    cacheHits: completedRequests.filter((request) => request.fromDiskCache || request.fromServiceWorker).length,
    consoleErrors,
  };
  await context.close();
  return trial;
}

async function main() {
  const distHtml = await readFile(DIST_INDEX, 'utf8');
  if (!/\/assets\/[^"']+-[A-Za-z0-9_-]+\.js/.test(distHtml)) throw new Error('dist/index.html is not a hashed production build. Run npm run build first.');
  await mkdir(OUTPUT_DIR, { recursive: true });
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const preview = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let previewOutput = '';
  preview.stdout.on('data', (chunk) => { previewOutput += chunk.toString(); });
  preview.stderr.on('data', (chunk) => { previewOutput += chunk.toString(); });
  let browser;
  try {
    await waitForPreview(BASE_URL, preview);
    browser = await chromium.launch({ headless: true });
    const trials = [];
    for (let trial = 1; trial <= TRIALS; trial += 1) trials.push(await measureTrial(browser, trial));
    const summary = {
      domContentLoadedMs: stats(trials, 'domContentLoadedMs'),
      renderReadyMs: stats(trials, 'renderReadyMs'),
      fadeOneMs: stats(trials, 'fadeOneMs'),
      transfer: {
        javascriptBytes: stats(trials.map((trial) => ({ value: trial.transfer.javascriptBytes })), 'value'),
        cssBytes: stats(trials.map((trial) => ({ value: trial.transfer.cssBytes })), 'value'),
        totalBytes: stats(trials.map((trial) => ({ value: trial.transfer.totalBytes })), 'value'),
      },
    };
    const pass = trials.every((trial) => trial.productionAssets && trial.fade === 1 && trial.consoleErrors.length === 0 && trial.cacheHits === 0)
      && summary.renderReadyMs.median <= PASS_CRITERIA.medianRenderReadyMsMax
      && summary.fadeOneMs.median <= PASS_CRITERIA.medianFadeOneMsMax
      && summary.fadeOneMs.maximum <= PASS_CRITERIA.maximumFadeOneMsMax;
    const result = {
      generatedAt: new Date().toISOString(),
      target: `${BASE_URL} (Vite production preview serving dist/)`,
      productionEvidence: { distIndexHasHashedAssets: true, previewOutput: previewOutput.trim(), allTrialsLoadedHashedAssets: trials.every((trial) => trial.productionAssets) },
      network: NETWORK,
      passCriteria: PASS_CRITERIA,
      pass,
      trials,
      summary,
      limitations: [
        'Chromium CDP throttling runs against localhost; it does not include a real radio network, carrier contention, CDN edge selection, DNS variability, or public TLS negotiation.',
        'Transfer byte counts are CDP encodedDataLength values and include protocol overhead reported by Chromium.',
      ],
    };
    await writeFile(path.join(OUTPUT_DIR, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
    const rows = trials.map((trial) => `| ${trial.trial} | ${trial.domContentLoadedMs} | ${trial.renderReadyMs} | ${trial.fadeOneMs} | ${formatBytes(trial.transfer.javascriptBytes)} | ${formatBytes(trial.transfer.cssBytes)} | ${formatBytes(trial.transfer.totalBytes)} | ${trial.cacheHits} | ${trial.consoleErrors.length} |`).join('\n');
    const markdown = `# 低速4G production preview検証\n\n判定: **${pass ? 'PASS' : 'FAIL'}**\n\n## 条件\n\n- 対象: Vite production preview（\`dist/\` のハッシュ付きJS/CSSを全試行で確認）\n- Chromium CDP: 下り1.6 Mbps、上り750 Kbps、遅延150 ms、\`cellular4g\`\n- キャッシュ: \`Network.setCacheDisabled(true)\`、Service Worker無効\n- 試行数: ${TRIALS}\n- fade: \`window.advanceTime\`を使わず実時間で1.0到達を測定\n\n## 計測結果（navigation開始からのms）\n\n| 試行 | DOMContentLoaded | render_game_to_text | fade=1 | JS転送 | CSS転送 | 総転送 | cache hit | console error |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n## 集計\n\n| 指標 | 中央値 | 最大値 |\n| --- | ---: | ---: |\n| DOMContentLoaded | ${summary.domContentLoadedMs.median} ms | ${summary.domContentLoadedMs.maximum} ms |\n| render_game_to_text | ${summary.renderReadyMs.median} ms | ${summary.renderReadyMs.maximum} ms |\n| fade=1 | ${summary.fadeOneMs.median} ms | ${summary.fadeOneMs.maximum} ms |\n| JS転送 | ${formatBytes(summary.transfer.javascriptBytes.median)} | ${formatBytes(summary.transfer.javascriptBytes.maximum)} |\n| CSS転送 | ${formatBytes(summary.transfer.cssBytes.median)} | ${formatBytes(summary.transfer.cssBytes.maximum)} |\n| 総転送 | ${formatBytes(summary.transfer.totalBytes.median)} | ${formatBytes(summary.transfer.totalBytes.maximum)} |\n\n## PASS基準\n\n- 全試行でハッシュ付きproduction asset、\`render_game_to_text\`、\`fade=1\`を確認\n- cache hit 0、console error 0\n- \`render_game_to_text\` 中央値 ${PASS_CRITERIA.medianRenderReadyMsMax} ms以下\n- \`fade=1\` 中央値 ${PASS_CRITERIA.medianFadeOneMsMax} ms以下、最大 ${PASS_CRITERIA.maximumFadeOneMsMax} ms以下\n\n## 限界\n\nこの結果はlocalhostに対するChromium CDP throttlingで、実CDN、公開TLS、DNS変動、無線品質、基地局混雑を再現しない。公開先と実端末での再計測が必要。転送量はChromiumの\`encodedDataLength\`で、ブラウザが報告するプロトコルオーバーヘッドを含む。\n`;
    await writeFile(path.join(OUTPUT_DIR, 'report.md'), markdown);
    process.stdout.write(`${markdown}\nJSON: ${path.join(OUTPUT_DIR, 'results.json')}\n`);
    if (!pass) process.exitCode = 1;
  } finally {
    await browser?.close();
    preview.kill('SIGTERM');
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
