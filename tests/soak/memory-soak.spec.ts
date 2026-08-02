import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SOAK_MS = 180_000;
const MIDPOINT_MS = SOAK_MS / 2;
const HEAP_ABSOLUTE_ALLOWANCE = 4 * 1024 * 1024;
const HEAP_RELATIVE_ALLOWANCE = .25;
const EFFECT_LIMITS = { high: { trails: 180, galaxies: 8 }, medium: { trails: 120, galaxies: 6 }, low: { trails: 70, galaxies: 4 }, reduced: { trails: 24, galaxies: 2 } } as const;

type Snapshot = { label: string; realElapsedMs: number; jsHeapUsedSize: number; state: Record<string, unknown> };

test('three-minute production soak keeps effects and post-GC heap bounded', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleErrors: string[] = []; const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => { Object.defineProperty(window, '__soakContextLosses', { configurable: true, writable: true, value: 0 }); document.addEventListener('webglcontextlost', () => { (window as typeof window & { __soakContextLosses: number }).__soakContextLosses++; }, true); });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debugDate=2026-12-01T23:00:00');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(3000)); await page.waitForTimeout(3000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable'); await cdp.send('HeapProfiler.enable');
  const startedAt = Date.now(); const snapshots: Snapshot[] = [];
  const snapshot = async (label: string): Promise<void> => { await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(500); const metrics = await cdp.send('Performance.getMetrics') as { metrics: Array<{ name: string; value: number }> }; const heap = metrics.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0; snapshots.push({ label, realElapsedMs: Date.now() - startedAt, jsHeapUsedSize: heap, state: JSON.parse(await page.evaluate(() => window.render_game_to_text())) as Record<string, unknown> }); };
  await snapshot('baseline');
  let moves = 0; let galaxyReleases = 0; let midpointTaken = false; let maxTrails = 0; let maxGalaxies = 0;
  while (Date.now() - startedAt < SOAK_MS) {
    const x = 40 + ((moves * 97) % 1200); const y = 40 + ((moves * 53) % 640);
    await page.mouse.move(x, y, { steps: 2 }); moves++;
    if (moves % 4 === 0) { await page.mouse.down(); await page.evaluate(() => window.advanceTime(720)); await page.mouse.up(); galaxyReleases++; }
    if (moves % 20 === 0) { const state = JSON.parse(await page.evaluate(() => window.render_game_to_text())); maxTrails = Math.max(maxTrails, state.effects.trails); maxGalaxies = Math.max(maxGalaxies, state.effects.galaxies); }
    if (!midpointTaken && Date.now() - startedAt >= MIDPOINT_MS) { await snapshot('midpoint'); midpointTaken = true; }
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => window.advanceTime(6000)); await page.waitForTimeout(2500); await snapshot('final');
  const finalState = JSON.parse(await page.evaluate(() => window.render_game_to_text())); const contextLosses = await page.evaluate(() => (window as typeof window & { __soakContextLosses: number }).__soakContextLosses);
  const baselineHeap = snapshots[0].jsHeapUsedSize; const finalHeap = snapshots.at(-1)!.jsHeapUsedSize; const heapGrowthBytes = finalHeap - baselineHeap; const heapGrowthRate = baselineHeap ? heapGrowthBytes / baselineHeap : 0; const heapAllowance = Math.max(HEAP_ABSOLUTE_ALLOWANCE, baselineHeap * HEAP_RELATIVE_ALLOWANCE);
  const quality = finalState.quality as keyof typeof EFFECT_LIMITS; const limits = EFFECT_LIMITS[quality]; const durationMs = Date.now() - startedAt;
  const result = { verdict: heapGrowthBytes <= heapAllowance && consoleErrors.length === 0 && pageErrors.length === 0 && contextLosses === 0 ? 'PASS' : 'FAIL', durationMs, moves, galaxyReleases, maxTrails, maxGalaxies, limits, snapshots, baselineHeap, finalHeap, heapGrowthBytes, heapGrowthRate, heapAllowance, finalFps: finalState.fps, finalEffects: finalState.effects, contextLosses, consoleErrors, pageErrors, thresholdRationale: 'Post-GC growth must remain within max(4 MiB, 25% of baseline). Four MiB permits bounded V8/JIT/Three.js caches for this 514 kB bundle while remaining far below iteration-proportional retention across hundreds of effects. CDP JSHeapUsedSize does not include GPU-driver allocations.' };
  const output = join(process.cwd(), 'release-artifacts', 'soak'); await mkdir(output, { recursive: true }); await writeFile(join(output, 'soak-results.json'), `${JSON.stringify(result, null, 2)}\n`); await writeFile(join(output, 'soak-results.md'), `# Cosmic Garden soak validation\n\n- Verdict: **${result.verdict}**\n- Real runtime: ${(durationMs / 1000).toFixed(1)} s\n- Pointer moves: ${moves}\n- Long-press galaxy releases: ${galaxyReleases}\n- Heap baseline/final: ${(baselineHeap / 1048576).toFixed(2)} / ${(finalHeap / 1048576).toFixed(2)} MiB\n- Heap growth: ${(heapGrowthBytes / 1048576).toFixed(2)} MiB (${(heapGrowthRate * 100).toFixed(1)}%)\n- Allowance: ${(heapAllowance / 1048576).toFixed(2)} MiB\n- Maximum trails/galaxies: ${maxTrails}/${maxGalaxies} (limits ${limits.trails}/${limits.galaxies})\n- Final FPS: ${finalState.fps}\n- Final active trails/galaxies: ${finalState.effects.trails}/${finalState.effects.galaxies}\n- Console/page errors: ${consoleErrors.length}/${pageErrors.length}\n- WebGL context losses: ${contextLosses}\n\nThreshold: max(4 MiB, 25% of baseline) after explicit V8 GC. GPU-driver memory is outside JSHeapUsedSize and remains an external measurement limitation.\n`);
  await page.screenshot({ path: join(output, 'soak-final.png') });
  expect(moves).toBeGreaterThan(500); expect(galaxyReleases).toBeGreaterThan(125); expect(maxTrails).toBeLessThanOrEqual(limits.trails); expect(maxGalaxies).toBeLessThanOrEqual(limits.galaxies); expect(finalState.effects.trails).toBe(0); expect(finalState.effects.galaxies).toBe(0); expect(finalState.mode).toBe('cosmos'); expect(finalState.fps).toBeGreaterThan(30); expect(contextLosses).toBe(0); expect(consoleErrors).toEqual([]); expect(pageErrors).toEqual([]); expect(heapGrowthBytes).toBeLessThanOrEqual(heapAllowance);
});
