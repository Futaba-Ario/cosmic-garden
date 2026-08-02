/* global console, document, navigator, performance, URL, window */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const TARGET_URL = 'https://futaba-ario.github.io/cosmic-garden/';
const OUTPUT_DIR = path.join(process.cwd(), 'release-artifacts', 'live-pages', 'network');
const TRIALS = 5;
const PASS_CRITERIA = {
  trials: TRIALS,
  allResponsesSuccessful: true,
  productionAssetsPresent: true,
  cacheHits: 0,
  notFoundResponses: 0,
  consoleErrors: 0,
  medianRenderReadyMsMax: 5_000,
  maximumFadeOneMsMax: 10_000,
};

const round = (value) => value === null || value === undefined ? null : Math.round(value * 10) / 10;
const formatMs = (value) => value === null ? 'n/a' : `${value} ms`;
const formatBytes = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;

function stats(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (usable.length === 0) return { samples: 0, median: null, maximum: null };
  usable.sort((a, b) => a - b);
  const middle = Math.floor(usable.length / 2);
  const median = usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
  return { samples: usable.length, median: round(median), maximum: round(Math.max(...usable)) };
}

function timingDuration(timing, start, end) {
  if (!timing || timing[start] < 0 || timing[end] < 0) return null;
  return round(Math.max(0, timing[end] - timing[start]));
}

function headerValue(headers, name) {
  const key = Object.keys(headers ?? {}).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : null;
}

async function measureTrial(number) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const responses = new Map();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));

  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  cdp.on('Network.responseReceived', (event) => {
    const response = event.response;
    responses.set(event.requestId, {
      url: response.url,
      type: event.type,
      status: response.status,
      statusText: response.statusText,
      mimeType: response.mimeType,
      protocol: response.protocol,
      encodedDataLength: 0,
      fromDiskCache: response.fromDiskCache,
      fromServiceWorker: response.fromServiceWorker,
      fromPrefetchCache: response.fromPrefetchCache,
      remoteIPAddress: response.remoteIPAddress,
      remotePort: response.remotePort,
      cdnCache: headerValue(response.headers, 'x-cache'),
      cdnAgeSeconds: headerValue(response.headers, 'age'),
      timing: response.timing ?? null,
    });
  });
  cdp.on('Network.loadingFinished', (event) => {
    const response = responses.get(event.requestId);
    if (response) response.encodedDataLength = event.encodedDataLength;
  });

  try {
    const navigationResponse = await page.goto(`${TARGET_URL}?liveNetworkTrial=${number}`, { waitUntil: 'commit', timeout: 30_000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', undefined, { timeout: 15_000 });
    const renderReadyMs = await page.evaluate(() => performance.now());
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).fade >= 1, undefined, { timeout: 15_000 });
    const pageMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        responseStartMs: navigation?.responseStart ?? 0,
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
        fadeOneMs: performance.now(),
        state: JSON.parse(window.render_game_to_text()),
        scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
        styles: [...document.styleSheets].map((sheet) => sheet.href).filter(Boolean),
        userAgent: navigator.userAgent,
      };
    });
    await page.waitForTimeout(250);

    const responseList = [...responses.values()].filter((response) => response.url.startsWith('https://futaba-ario.github.io/cosmic-garden/'));
    const documentResponse = responseList.find((response) => response.type === 'Document') ?? null;
    const resourceResponses = responseList.filter((response) => ['Document', 'Script', 'Stylesheet'].includes(response.type));
    const productionAssets = [...pageMetrics.scripts, ...pageMetrics.styles];
    const productionAssetsValid = productionAssets.length >= 2
      && productionAssets.every((url) => /\/cosmic-garden\/assets\/[^/]+-[A-Za-z0-9_-]+\.(js|css)$/.test(new URL(url).pathname));
    const transfer = {
      htmlBytes: resourceResponses.filter((response) => response.type === 'Document').reduce((sum, response) => sum + response.encodedDataLength, 0),
      javascriptBytes: resourceResponses.filter((response) => response.type === 'Script').reduce((sum, response) => sum + response.encodedDataLength, 0),
      cssBytes: resourceResponses.filter((response) => response.type === 'Stylesheet').reduce((sum, response) => sum + response.encodedDataLength, 0),
      totalBytes: responseList.reduce((sum, response) => sum + response.encodedDataLength, 0),
    };
    const timing = documentResponse?.timing ?? null;
    const trial = {
      trial: number,
      measuredAt: new Date().toISOString(),
      finalUrl: page.url(),
      navigationStatus: navigationResponse?.status() ?? null,
      responseStartMs: round(pageMetrics.responseStartMs),
      domContentLoadedMs: round(pageMetrics.domContentLoadedMs),
      renderReadyMs: round(renderReadyMs),
      fadeOneMs: round(pageMetrics.fadeOneMs),
      fade: pageMetrics.state.fade,
      mode: pageMetrics.state.mode,
      networkTimingMs: {
        dns: timingDuration(timing, 'dnsStart', 'dnsEnd'),
        connect: timingDuration(timing, 'connectStart', 'connectEnd'),
        ssl: timingDuration(timing, 'sslStart', 'sslEnd'),
        ttfb: timing?.receiveHeadersEnd >= 0 && timing?.sendEnd >= 0 ? round(timing.receiveHeadersEnd - timing.sendEnd) : null,
      },
      transfer,
      productionAssets,
      productionAssetsValid,
      cacheHits: responseList.filter((response) => response.fromDiskCache || response.fromServiceWorker || response.fromPrefetchCache).length,
      notFoundResponses: responseList.filter((response) => response.status === 404).map((response) => response.url),
      unsuccessfulResponses: responseList.filter((response) => response.status < 200 || response.status >= 400).map((response) => ({ url: response.url, status: response.status })),
      failedRequests,
      consoleErrors,
      resources: resourceResponses.map((response) => {
        const resource = { ...response };
        delete resource.timing;
        return resource;
      }),
      userAgent: pageMetrics.userAgent,
    };
    return trial;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const trials = [];
  for (let trial = 1; trial <= TRIALS; trial += 1) trials.push(await measureTrial(trial));
  const summary = {
    responseStartMs: stats(trials.map((trial) => trial.responseStartMs)),
    domContentLoadedMs: stats(trials.map((trial) => trial.domContentLoadedMs)),
    renderReadyMs: stats(trials.map((trial) => trial.renderReadyMs)),
    fadeOneMs: stats(trials.map((trial) => trial.fadeOneMs)),
    dnsMs: stats(trials.map((trial) => trial.networkTimingMs.dns)),
    connectMs: stats(trials.map((trial) => trial.networkTimingMs.connect)),
    sslMs: stats(trials.map((trial) => trial.networkTimingMs.ssl)),
    ttfbMs: stats(trials.map((trial) => trial.networkTimingMs.ttfb)),
    transfer: {
      htmlBytes: stats(trials.map((trial) => trial.transfer.htmlBytes)),
      javascriptBytes: stats(trials.map((trial) => trial.transfer.javascriptBytes)),
      cssBytes: stats(trials.map((trial) => trial.transfer.cssBytes)),
      totalBytes: stats(trials.map((trial) => trial.transfer.totalBytes)),
    },
  };
  const pass = trials.every((trial) => trial.navigationStatus === 200 && trial.productionAssetsValid && trial.fade === 1
    && trial.cacheHits === 0 && trial.notFoundResponses.length === 0 && trial.unsuccessfulResponses.length === 0
    && trial.failedRequests.length === 0 && trial.consoleErrors.length === 0)
    && summary.renderReadyMs.median <= PASS_CRITERIA.medianRenderReadyMsMax
    && summary.fadeOneMs.maximum <= PASS_CRITERIA.maximumFadeOneMsMax;
  const result = {
    generatedAt: new Date().toISOString(),
    target: TARGET_URL,
    measurement: {
      runner: `${process.platform} ${process.arch}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      connection: 'Current runner connection; no CDP throttling',
      browserCache: 'Disabled with Network.setCacheDisabled(true); a fresh browser process/context is used per trial',
      serviceWorkers: 'Blocked',
      trials: TRIALS,
    },
    passCriteria: PASS_CRITERIA,
    pass,
    trials,
    summary,
    limitations: [
      'Results depend on the runner location, current internet route, GitHub Pages CDN edge/cache state, and measurement time.',
      'Fresh browser processes disable Chromium HTTP cache reuse, but operating-system DNS caches and upstream/CDN caches can still be warm.',
      'This is one measurement location and is not representative of every geography, ISP, radio network, or device.',
    ],
  };
  await writeFile(path.join(OUTPUT_DIR, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  const rows = trials.map((trial) => {
    const cdnCache = [...new Set(trial.resources.map((resource) => resource.cdnCache).filter(Boolean))].join('/') || 'n/a';
    return `| ${trial.trial} | ${trial.navigationStatus} | ${trial.responseStartMs} | ${trial.domContentLoadedMs} | ${trial.renderReadyMs} | ${trial.fadeOneMs} | ${formatMs(trial.networkTimingMs.dns)} | ${formatMs(trial.networkTimingMs.connect)} | ${formatMs(trial.networkTimingMs.ssl)} | ${formatMs(trial.networkTimingMs.ttfb)} | ${formatBytes(trial.transfer.totalBytes)} | ${trial.cacheHits} | ${cdnCache} | ${trial.notFoundResponses.length} | ${trial.consoleErrors.length} |`;
  }).join('\n');
  const markdown = `# GitHub Pages 実公開経路ロード計測\n\n判定: **${pass ? 'PASS' : 'FAIL'}**\n\n- URL: ${TARGET_URL}\n- 計測時刻: ${result.generatedAt}\n- 実行環境: ${result.measurement.runner} / ${result.measurement.timezone}\n- 接続: 現在の実接続、CDP throttlingなし\n- cold条件: 各試行でChromiumプロセス/Contextを作り直し、HTTP cache無効、Service Worker無効\n\n| 試行 | status | response | DCL | state API | fade=1 | DNS | connect | SSL | TTFB | 総転送 | browser cache | CDN x-cache | 404 | console error |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |\n${rows}\n\n## 集計（中央値 / 最大値）\n\n- response: ${formatMs(summary.responseStartMs.median)} / ${formatMs(summary.responseStartMs.maximum)}\n- DCL: ${formatMs(summary.domContentLoadedMs.median)} / ${formatMs(summary.domContentLoadedMs.maximum)}\n- render_game_to_text: ${formatMs(summary.renderReadyMs.median)} / ${formatMs(summary.renderReadyMs.maximum)}\n- fade=1: ${formatMs(summary.fadeOneMs.median)} / ${formatMs(summary.fadeOneMs.maximum)}\n- DNS: ${formatMs(summary.dnsMs.median)} / ${formatMs(summary.dnsMs.maximum)} (${summary.dnsMs.samples} samples)\n- connect: ${formatMs(summary.connectMs.median)} / ${formatMs(summary.connectMs.maximum)} (${summary.connectMs.samples} samples)\n- SSL: ${formatMs(summary.sslMs.median)} / ${formatMs(summary.sslMs.maximum)} (${summary.sslMs.samples} samples)\n- TTFB: ${formatMs(summary.ttfbMs.median)} / ${formatMs(summary.ttfbMs.maximum)} (${summary.ttfbMs.samples} samples)\n- HTML / JS / CSS / 総転送中央値: ${formatBytes(summary.transfer.htmlBytes.median)} / ${formatBytes(summary.transfer.javascriptBytes.median)} / ${formatBytes(summary.transfer.cssBytes.median)} / ${formatBytes(summary.transfer.totalBytes.median)}\n\n## PASS基準\n\n- 5試行すべてstatus 200、ハッシュ付きproduction JS/CSS、状態API、fade=1を確認\n- browser disk/prefetch cache hit、Service Worker、404、失敗request、console errorがすべて0\n- 状態API中央値5秒以下、fade=1最大10秒以下\n\n## 限界\n\n計測値は実行地点、時刻、現在のインターネット経路、GitHub Pages CDN edge/cache状態に依存する。ブラウザcacheはcoldだがCDNの\`x-cache: HIT\`は配信経路として利用され、OSのDNS cacheや上流/CDN cacheのcoldは保証できない。単一地点の結果であり、他地域・ISP・無線回線・端末を代表しない。\n`;
  await writeFile(path.join(OUTPUT_DIR, 'report.md'), markdown);
  process.stdout.write(`${markdown}\nJSON: ${path.join(OUTPUT_DIR, 'results.json')}\n`);
  if (!pass) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
