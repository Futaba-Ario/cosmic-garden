import { resolveTheme } from '../theme/resolveTheme';
import { CosmicRenderer } from '../rendering/CosmicRenderer';
import { getCapabilities } from '../utils/capabilities';
import type { AppState } from './AppState';
import { PointerController } from '../interaction/PointerController';
import { emptyPointerState, type PointerState } from '../interaction/PointerState';
import { QualityManager } from '../performance/QualityManager';
import { getHardwareHints, selectInitialQuality } from '../performance/qualityProfiles';
import { StaticFallback, type FallbackReason } from '../fallback/StaticFallback';
import { bindPageVisibility } from '../utils/lifecycle';

const FADE_DURATION_MS = 2600;
export class CosmicGardenApp {
  private renderer: CosmicRenderer | null = null;
  private frameId = 0;
  private lastTime = 0;
  private pointer: PointerController | null = null;
  private readonly qualityManager: QualityManager;
  private readonly fallbackView: StaticFallback;
  private unbindVisibility: (() => void) | null = null;
  private motionQuery: MediaQueryList | null = null;
  onFirstInteraction: (() => void) | null = null;
  onFrame: ((date: Date, theme: AppState['theme']) => void) | null = null;
  onPauseChange: ((paused: boolean) => void) | null = null;
  private hasInteracted = false;
  readonly state: AppState;
  constructor(private readonly canvas: HTMLCanvasElement, private readonly fallback: HTMLElement, private readonly dateProvider: () => Date = () => new Date()) {
    const capabilities = getCapabilities();
    const quality = selectInitialQuality(getHardwareHints(capabilities.reducedMotion));
    this.state = { running: false, paused: false, elapsedMs: 0, fade: 0, theme: resolveTheme(dateProvider()), capabilities, quality, fps: 60, fallbackReason: null };
    this.qualityManager = new QualityManager(quality);
    this.fallbackView = new StaticFallback(fallback);
  }
  start(): void {
    if (this.state.running) return;
    this.state.running = true;
    this.unbindVisibility = bindPageVisibility(this.handleVisibility);
    this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    this.motionQuery?.addEventListener?.('change', this.handleMotionPreference);
    if (!this.state.capabilities.webgl) { this.activateFallback('webgl-unavailable'); return; }
    try { this.renderer = new CosmicRenderer(this.canvas, this.state.theme, this.state.quality, () => this.activateFallback('context-lost')); this.pointer = new PointerController(this.canvas, (state) => { if (!this.hasInteracted) { this.hasInteracted = true; this.onFirstInteraction?.(); } this.renderer?.spawnGalaxy(state.worldX, state.worldY); }); this.canvas.addEventListener('pointerdown', this.markInteracted, { passive: true }); this.lastTime = performance.now(); this.frameId = requestAnimationFrame(this.loop); }
    catch { this.activateFallback('initialization-failed'); }
  }
  private activateFallback(reason: FallbackReason): void { cancelAnimationFrame(this.frameId); this.state.fallbackReason = reason; this.canvas.hidden = true; this.pointer?.dispose(); this.pointer = null; this.fallbackView.show(this.state.theme, reason); }
  private loop = (now: number): void => { this.advance(Math.min(now - this.lastTime, 100), true); this.lastTime = now; if (this.state.running && !this.state.paused && this.renderer && !this.state.fallbackReason) this.frameId = requestAnimationFrame(this.loop); };
  private markInteracted = (): void => { if (!this.hasInteracted) { this.hasInteracted = true; this.onFirstInteraction?.(); } };
  private handleVisibility = (paused: boolean): void => { this.state.paused = paused; this.onPauseChange?.(paused); cancelAnimationFrame(this.frameId); if (!paused && this.state.running && this.renderer && !this.state.fallbackReason) { this.lastTime = performance.now(); this.frameId = requestAnimationFrame(this.loop); } };
  private handleMotionPreference = (event: MediaQueryListEvent): void => { this.state.capabilities.reducedMotion = event.matches; const next = event.matches ? 'reduced' : selectInitialQuality(getHardwareHints(false)); this.qualityManager.force(next); this.state.quality = next; this.renderer?.setQuality(next); };
  advance(ms: number, monitorFrame = false): void { if (!this.state.running || this.state.paused || !this.renderer || this.state.fallbackReason) return; const safeMs = Math.max(ms, 0); if (monitorFrame) { const changed = this.qualityManager.recordFrame(safeMs); this.state.fps = this.qualityManager.fps; if (changed) { this.state.quality = changed; this.renderer.setQuality(changed); } } this.state.elapsedMs += safeMs; this.state.fade = Math.min(1, this.state.elapsedMs / FADE_DURATION_MS); const date = this.dateProvider(); this.state.theme = resolveTheme(date); this.pointer?.update(safeMs); this.renderer.render(safeMs, this.state.theme, this.state.fade, this.pointer?.state ?? emptyPointerState()); this.onFrame?.(date, this.state.theme); }
  resize = (): void => this.renderer?.resize(window.innerWidth, window.innerHeight);
  stop(): void { this.state.running = false; cancelAnimationFrame(this.frameId); }
  renderCurrentFrame(): void { this.renderer?.render(0, this.state.theme, this.state.fade, this.pointer?.state ?? emptyPointerState()); }
  async toggleFullscreen(): Promise<void> { if (document.fullscreenElement) await document.exitFullscreen(); else await this.canvas.requestFullscreen?.(); this.resize(); }
  async exitFullscreen(): Promise<void> { if (document.fullscreenElement) await document.exitFullscreen(); this.resize(); }
  destroy(): void { this.stop(); this.unbindVisibility?.(); this.unbindVisibility = null; this.motionQuery?.removeEventListener?.('change', this.handleMotionPreference); this.canvas.removeEventListener('pointerdown', this.markInteracted); this.pointer?.dispose(); this.pointer = null; this.renderer?.dispose(); this.renderer = null; }
  renderGameToText(): string { const { theme, fade, elapsedMs, capabilities, quality, fps, paused, fallbackReason } = this.state; const pointer: PointerState = this.pointer?.state ?? emptyPointerState(); const rendererEffects = this.renderer?.effectState ?? { trails: 0, galaxies: 0, starDisplacement: 0 }; const effects = { ...rendererEffects, starDisplacement: Number(rendererEffects.starDisplacement.toFixed(4)) }; return JSON.stringify({ mode: fallbackReason ? 'fallback' : 'cosmos', coordinateSystem: 'screen origin is top-left; x increases right and y increases down; world is normalized -1..1', timeOfDay: theme.timeOfDay, season: theme.season, fade: Number(fade.toFixed(3)), elapsedMs: Math.round(elapsedMs), quality, fps: Number(fps.toFixed(1)), paused, reducedMotion: capabilities.reducedMotion, fallbackReason, canvas: { width: this.canvas.width, height: this.canvas.height }, ui: { onboardingVisible: !this.hasInteracted, fullscreen: Boolean(document.fullscreenElement) }, pointer: { active: pointer.active, pressed: pointer.pressed, type: pointer.pointerType, worldX: Number(pointer.worldX.toFixed(3)), worldY: Number(pointer.worldY.toFixed(3)), velocity: Number(pointer.velocity.toFixed(3)), holdRatio: Number(pointer.holdRatio.toFixed(3)) }, effects }); }
}
