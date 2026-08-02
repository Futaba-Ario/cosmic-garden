import type { Rgb, Season, TimeOfDay } from './themeTypes';

export const SEASON_COLORS: Record<Season, { primary: Rgb; secondary: Rgb }> = {
  spring: { primary: { r: 1, g: 0.38, b: 0.68 }, secondary: { r: 0.72, g: 0.48, b: 1 } },
  summer: { primary: { r: 0.1, g: 0.85, b: 0.9 }, secondary: { r: 0.18, g: 0.4, b: 1 } },
  autumn: { primary: { r: 1, g: 0.48, b: 0.16 }, secondary: { r: 0.86, g: 0.18, b: 0.22 } },
  winter: { primary: { r: 0.7, g: 0.9, b: 1 }, secondary: { r: 0.48, g: 0.62, b: 1 } },
};

export const TIME_PROFILES: Record<TimeOfDay, { background: Rgb; star: Rgb; brightness: number; glow: number; density: number; drift: number }> = {
  morning: { background: { r: 0.13, g: 0.1, b: 0.25 }, star: { r: 1, g: 0.84, b: 0.62 }, brightness: 0.8, glow: 0.72, density: 0.8, drift: 0.58 },
  day: { background: { r: 0.08, g: 0.16, b: 0.32 }, star: { r: 0.78, g: 0.92, b: 1 }, brightness: 0.58, glow: 0.55, density: 0.62, drift: 0.42 },
  evening: { background: { r: 0.17, g: 0.07, b: 0.25 }, star: { r: 1, g: 0.67, b: 0.42 }, brightness: 0.92, glow: 0.95, density: 0.9, drift: 0.72 },
  night: { background: { r: 0.015, g: 0.03, b: 0.12 }, star: { r: 0.55, g: 0.78, b: 1 }, brightness: 1, glow: 1.08, density: 1, drift: 0.84 },
};
