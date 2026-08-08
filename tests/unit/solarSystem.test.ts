import { describe, expect, test } from 'vitest';
import { heliocentricPosition, julianDay, orbitPath, solarSystemAt, solveKepler } from '../../src/astronomy/solarSystem';

describe('solar system calculations', () => {
  test('converts J2000 noon to its canonical Julian day', () => {
    expect(julianDay(new Date('2000-01-01T12:00:00Z'))).toBe(2451545);
  });

  test('solves Kepler equation to a small residual', () => {
    const mean = 2.1; const eccentricity = .2056;
    const eccentric = solveKepler(mean, eccentricity);
    expect(Math.abs(eccentric - eccentricity * Math.sin(eccentric) - mean)).toBeLessThan(1e-10);
  });

  test('keeps representative planets near their orbital scale', () => {
    const date = new Date('2026-08-08T00:00:00Z');
    expect(Math.hypot(...Object.values(heliocentricPosition('earth', date)))).toBeGreaterThan(.98);
    expect(Math.hypot(...Object.values(heliocentricPosition('earth', date)))).toBeLessThan(1.02);
    expect(Math.hypot(...Object.values(heliocentricPosition('jupiter', date)))).toBeGreaterThan(4.9);
    expect(Math.hypot(...Object.values(heliocentricPosition('jupiter', date)))).toBeLessThan(5.5);
  });

  test('returns the sun, eight planets and the moon with finite positions', () => {
    const bodies = solarSystemAt(new Date('2026-08-08T12:00:00Z'));
    expect(bodies).toHaveLength(10);
    expect(bodies.map((body) => body.id)).toEqual(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    for (const body of bodies) expect(Object.values(body.positionAU).every(Number.isFinite)).toBe(true);
  });

  test('generates a closed orbit path', () => {
    const path = orbitPath('mars', new Date('2026-08-08T00:00:00Z'), 32);
    expect(path).toHaveLength(33);
    expect(path[0].x).toBeCloseTo(path.at(-1)!.x, 10);
    expect(path[0].y).toBeCloseTo(path.at(-1)!.y, 10);
  });
});
