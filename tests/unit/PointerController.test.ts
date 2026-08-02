import { describe, expect, it } from 'vitest';
import { HOLD_DURATION_MS } from '../../src/interaction/PointerController';
import { resolveTrailLifetime } from '../../src/effects/TrailSystem';

describe('pointer gesture thresholds', () => {
  it('uses a bounded long-press duration', () => { expect(HOLD_DURATION_MS).toBeGreaterThan(300); expect(HOLD_DURATION_MS).toBeLessThanOrEqual(1000); });
  it('gives fast movement a longer trail than slow movement and caps its lifetime', () => {
    expect(resolveTrailLifetime(.8)).toBeGreaterThan(resolveTrailLifetime(.05));
    expect(resolveTrailLifetime(100)).toBe(900);
  });
});
