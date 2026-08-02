import { describe, expect, it } from 'vitest';
import { getSeason, getTimeOfDay, resolveTheme } from '../../src/theme/resolveTheme';

describe('theme resolver', () => {
  it.each([[0, 'night'], [4, 'night'], [5, 'morning'], [10, 'morning'], [11, 'day'], [16, 'day'], [17, 'evening'], [21, 'evening'], [22, 'night']])('classifies hour %i as %s', (hour, expected) => expect(getTimeOfDay(hour)).toBe(expected));
  it.each([[0, 'winter'], [2, 'spring'], [4, 'spring'], [5, 'summer'], [7, 'summer'], [8, 'autumn'], [10, 'autumn'], [11, 'winter']])('classifies month %i as %s', (month, expected) => expect(getSeason(month)).toBe(expected));
  it('selects all four intended theme combinations and keeps numeric values bounded', () => {
    for (const date of [new Date(2026, 2, 1, 6), new Date(2026, 5, 1, 12), new Date(2026, 8, 1, 18), new Date(2026, 11, 1, 23)]) {
      const theme = resolveTheme(date);
      expect(theme.transition).toBeGreaterThanOrEqual(0);
      expect(theme.transition).toBeLessThanOrEqual(1);
      expect(theme.brightness).toBeGreaterThan(0);
      expect(theme.particleDensity).toBeGreaterThan(0);
    }
  });
  it('interpolates continuously across a time boundary', () => {
    const before = resolveTheme(new Date(2026, 2, 1, 10, 59, 59));
    const after = resolveTheme(new Date(2026, 2, 1, 11, 0, 1));
    expect(Math.abs(before.brightness - after.brightness)).toBeLessThan(.01);
    expect(Math.abs(before.background.r - after.background.r)).toBeLessThan(.01);
  });
});
