export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export interface Rgb { r: number; g: number; b: number; }
export interface ThemeState {
  timeOfDay: TimeOfDay; season: Season; transition: number;
  background: Rgb; star: Rgb; nebulaA: Rgb; nebulaB: Rgb;
  brightness: number; nebulaGlow: number; particleDensity: number; driftSpeed: number;
}
