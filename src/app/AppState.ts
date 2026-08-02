import type { Capabilities } from '../utils/capabilities';
import type { ThemeState } from '../theme/themeTypes';
import type { QualityLevel } from '../performance/qualityProfiles';
import type { FallbackReason } from '../fallback/StaticFallback';
export interface AppState { running: boolean; paused: boolean; elapsedMs: number; fade: number; theme: ThemeState; capabilities: Capabilities; quality: QualityLevel; fps: number; fallbackReason: FallbackReason | null; }
