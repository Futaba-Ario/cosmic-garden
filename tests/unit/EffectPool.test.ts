import { describe, expect, it } from 'vitest';
import { EffectPool } from '../../src/effects/EffectPool';

describe('effect pool', () => {
  it('reuses a bounded item instead of allocating indefinitely', () => {
    const items = [{ active: true }, { active: false }];
    const pool = new EffectPool(items);
    expect(pool.acquire()).toBe(items[1]);
    items[1].active = true;
    expect(pool.acquire()).toBe(items[0]);
    expect(pool.activeCount).toBe(2);
  });
});
