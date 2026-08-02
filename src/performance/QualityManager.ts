import { FrameMonitor } from './FrameMonitor';
import type { QualityLevel } from './qualityProfiles';

const ORDER: QualityLevel[] = ['high', 'medium', 'low', 'reduced'];
export interface QualityManagerOptions { lowFps?: number; recoveryFps?: number; sustainedMs?: number; cooldownMs?: number; }

export class QualityManager {
  private readonly monitor = new FrameMonitor();
  private lowDuration = 0;
  private cooldown = 0;
  private readonly lowFps: number;
  private readonly recoveryFps: number;
  private readonly sustainedMs: number;
  private readonly cooldownMs: number;
  constructor(private currentLevel: QualityLevel, options: QualityManagerOptions = {}) {
    this.lowFps = options.lowFps ?? 32;
    this.recoveryFps = options.recoveryFps ?? 42;
    this.sustainedMs = options.sustainedMs ?? 3200;
    this.cooldownMs = options.cooldownMs ?? 8000;
  }
  recordFrame(deltaMs: number): QualityLevel | null {
    const fps = this.monitor.record(deltaMs);
    this.cooldown = Math.max(0, this.cooldown - deltaMs);
    if (this.cooldown > 0) { this.lowDuration = 0; return null; }
    if (fps < this.lowFps) this.lowDuration += deltaMs;
    else if (fps > this.recoveryFps) this.lowDuration = 0;
    if (this.lowDuration < this.sustainedMs) return null;
    const index = ORDER.indexOf(this.currentLevel);
    if (index >= ORDER.length - 1) { this.lowDuration = 0; return null; }
    this.currentLevel = ORDER[index + 1];
    this.lowDuration = 0;
    this.cooldown = this.cooldownMs;
    return this.currentLevel;
  }
  force(level: QualityLevel): void { this.currentLevel = level; this.lowDuration = 0; this.cooldown = this.cooldownMs; }
  get level(): QualityLevel { return this.currentLevel; }
  get fps(): number { return this.monitor.fps; }
}
