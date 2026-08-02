import { describe, expect, it } from 'vitest';
import { QualityManager } from '../../src/performance/QualityManager';
import { QUALITY_PROFILES, selectInitialQuality } from '../../src/performance/qualityProfiles';

describe('quality selection', () => {
  it('uses reduced whenever reduced motion is requested', () => expect(selectInitialQuality({ width: 800, height: 600, devicePixelRatio: 1, hardwareConcurrency: 12, deviceMemory: 16, reducedMotion: true })).toBe('reduced'));
  it('uses low for constrained processors or memory', () => expect(selectInitialQuality({ width: 800, height: 600, devicePixelRatio: 1, hardwareConcurrency: 2, deviceMemory: 2, reducedMotion: false })).toBe('low'));
  it('uses medium for high-DPR or mid-range devices', () => expect(selectInitialQuality({ width: 1200, height: 800, devicePixelRatio: 3, hardwareConcurrency: 8, deviceMemory: 8, reducedMotion: false })).toBe('medium'));
  it('uses high when hardware and render size allow it', () => expect(selectInitialQuality({ width: 1200, height: 800, devicePixelRatio: 1, hardwareConcurrency: 8, deviceMemory: 8, reducedMotion: false })).toBe('high'));
  it('profiles lower DPR, particles and effect limits progressively', () => {
    expect(QUALITY_PROFILES.high.dprCap).toBeGreaterThan(QUALITY_PROFILES.medium.dprCap);
    expect(QUALITY_PROFILES.medium.starCount).toBeGreaterThan(QUALITY_PROFILES.low.starCount);
    expect(QUALITY_PROFILES.low.trailLimit).toBeGreaterThan(QUALITY_PROFILES.reduced.trailLimit);
  });
});

describe('quality transitions', () => {
  it('ignores a transient frame drop', () => { const manager = new QualityManager('high', { sustainedMs: 1000 }); manager.recordFrame(50); manager.recordFrame(16); expect(manager.level).toBe('high'); });
  it('drops exactly one level after sustained low FPS', () => { const manager = new QualityManager('high', { sustainedMs: 200, cooldownMs: 1000 }); let changed = null; for (let i = 0; i < 20; i++) changed = manager.recordFrame(50) ?? changed; expect(changed).toBe('medium'); expect(manager.level).toBe('medium'); });
  it('uses cooldown to prevent rapid repeated drops', () => { const manager = new QualityManager('high', { sustainedMs: 100, cooldownMs: 1000 }); for (let i = 0; i < 10; i++) manager.recordFrame(50); expect(manager.level).toBe('medium'); for (let i = 0; i < 10; i++) manager.recordFrame(50); expect(manager.level).toBe('medium'); });
  it('uses recovery hysteresis to clear accumulated low time', () => { const manager = new QualityManager('high', { sustainedMs: 400 }); for (let i = 0; i < 5; i++) manager.recordFrame(50); for (let i = 0; i < 30; i++) manager.recordFrame(10); for (let i = 0; i < 5; i++) manager.recordFrame(50); expect(manager.level).toBe('high'); });
});
