export type QualityLevel = 'high' | 'medium' | 'low' | 'reduced';

export interface QualityProfile {
  level: QualityLevel;
  dprCap: number;
  starCount: number;
  nebulaDetail: number;
  trailLimit: number;
  galaxyLimit: number;
  motionScale: number;
  attractionScale: number;
  trailLifetimeScale: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: { level: 'high', dprCap: 2, starCount: 8000, nebulaDetail: 1, trailLimit: 180, galaxyLimit: 8, motionScale: 1, attractionScale: 1, trailLifetimeScale: 1 },
  medium: { level: 'medium', dprCap: 1.5, starCount: 5000, nebulaDetail: .72, trailLimit: 120, galaxyLimit: 6, motionScale: .85, attractionScale: .82, trailLifetimeScale: .82 },
  low: { level: 'low', dprCap: 1, starCount: 2600, nebulaDetail: .3, trailLimit: 70, galaxyLimit: 4, motionScale: .62, attractionScale: .58, trailLifetimeScale: .58 },
  reduced: { level: 'reduced', dprCap: 1, starCount: 1500, nebulaDetail: 0, trailLimit: 24, galaxyLimit: 2, motionScale: .12, attractionScale: .08, trailLifetimeScale: .25 },
};

export interface HardwareHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  width: number;
  height: number;
  devicePixelRatio: number;
  reducedMotion: boolean;
}

export function selectInitialQuality(hints: HardwareHints): QualityLevel {
  if (hints.reducedMotion) return 'reduced';
  const cores = hints.hardwareConcurrency ?? 4;
  const memory = hints.deviceMemory ?? 4;
  const renderedPixels = hints.width * hints.height * Math.min(hints.devicePixelRatio, 3) ** 2;
  if (cores <= 2 || memory <= 2) return 'low';
  if (cores <= 4 || memory <= 4 || renderedPixels > 5_000_000 || hints.devicePixelRatio > 2.5) return 'medium';
  return 'high';
}

export function getHardwareHints(reducedMotion: boolean): HardwareHints {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return { hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigatorWithMemory.deviceMemory, width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1, reducedMotion };
}
