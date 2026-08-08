import type { BodyId, BodyPosition } from '../astronomy/solarSystem';
import type { Capabilities } from '../utils/capabilities';
import type { QualityLevel } from '../performance/qualityProfiles';
import type { FallbackReason } from '../fallback/StaticFallback';

export interface AppState {
  running: boolean;
  paused: boolean;
  elapsedMs: number;
  date: Date;
  bodies: BodyPosition[];
  selectedId: BodyId | null;
  capabilities: Capabilities;
  quality: QualityLevel;
  fps: number;
  fallbackReason: FallbackReason | null;
}
