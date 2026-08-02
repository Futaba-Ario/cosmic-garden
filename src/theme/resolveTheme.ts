import { SEASON_COLORS, TIME_PROFILES } from './themePalette';
import type { Rgb, Season, ThemeState, TimeOfDay } from './themeTypes';

const schedule: Array<{ start: number; name: TimeOfDay }> = [
  { start: 0, name: 'night' }, { start: 5, name: 'morning' }, { start: 11, name: 'day' }, { start: 17, name: 'evening' }, { start: 22, name: 'night' },
];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const scalar = (a: number, b: number, t: number) => a + (b - a) * t;

export function getSeason(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function resolveTheme(date: Date): ThemeState {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const index = schedule.reduce((active, item, i) => hour >= item.start ? i : active, 0);
  const current = schedule[index].name;
  const next = schedule[(index + 1) % schedule.length].name;
  const start = schedule[index].start;
  const end = index === schedule.length - 1 ? 29 : schedule[index + 1].start;
  const transition = (hour - start) / (end - start);
  const now = TIME_PROFILES[current], later = TIME_PROFILES[next], season = getSeason(date.getMonth());
  const colors = SEASON_COLORS[season];
  return { timeOfDay: current, season, transition, background: mix(now.background, later.background, transition), star: mix(now.star, later.star, transition), nebulaA: colors.primary, nebulaB: colors.secondary, brightness: scalar(now.brightness, later.brightness, transition), nebulaGlow: scalar(now.glow, later.glow, transition), particleDensity: scalar(now.density, later.density, transition), driftSpeed: scalar(now.drift, later.drift, transition) };
}
