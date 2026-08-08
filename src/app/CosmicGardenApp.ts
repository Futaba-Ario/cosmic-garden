import { solarSystemAt, type BodyId, type BodyPosition } from '../astronomy/solarSystem';
import { CosmicRenderer, type ScreenLabel } from '../rendering/CosmicRenderer';
import { getCapabilities } from '../utils/capabilities';
import type { AppState } from './AppState';
import { QualityManager } from '../performance/QualityManager';
import { getHardwareHints, selectInitialQuality } from '../performance/qualityProfiles';
import { StaticFallback, type FallbackReason } from '../fallback/StaticFallback';
import { bindPageVisibility } from '../utils/lifecycle';

interface PointerRecord { x: number; y: number; startX: number; startY: number; moved: boolean; type: string; }

export class CosmicGardenApp {
  private renderer: CosmicRenderer | null = null;
  private frameId = 0;
  private lastTime = 0;
  private readonly qualityManager: QualityManager;
  private readonly fallbackView: StaticFallback;
  private unbindVisibility: (() => void) | null = null;
  private motionQuery: MediaQueryList | null = null;
  private readonly pointers = new Map<number, PointerRecord>();
  private pinchDistance = 0;
  private hasInteracted = false;
  onFirstInteraction: (() => void) | null = null;
  onFrame: ((date: Date, bodies: BodyPosition[], labels: ScreenLabel[]) => void) | null = null;
  onSelection: ((body: BodyPosition | null) => void) | null = null;
  onPauseChange: ((paused: boolean) => void) | null = null;
  readonly state: AppState;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly fallback: HTMLElement, private readonly dateProvider: () => Date = () => new Date()) {
    const capabilities = getCapabilities();
    const quality = selectInitialQuality(getHardwareHints(capabilities.reducedMotion));
    const date = this.safeDate();
    this.state = { running: false, paused: false, elapsedMs: 0, date, bodies: solarSystemAt(date), selectedId: null, capabilities, quality, fps: 60, fallbackReason: null };
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
    try {
      this.renderer = new CosmicRenderer(this.canvas, this.state.date, this.state.quality, () => this.activateFallback('context-lost'));
      this.renderer.setBodies(this.state.bodies);
      this.bindPointerEvents();
      this.lastTime = performance.now();
      this.frameId = requestAnimationFrame(this.loop);
    } catch {
      this.activateFallback('initialization-failed');
    }
  }

  private safeDate(): Date {
    const candidate = this.dateProvider();
    return Number.isFinite(candidate.getTime()) ? candidate : new Date();
  }

  private activateFallback(reason: FallbackReason): void {
    cancelAnimationFrame(this.frameId);
    this.state.fallbackReason = reason;
    this.canvas.hidden = true;
    this.unbindPointerEvents();
    this.fallbackView.show(this.state.date, this.state.bodies, reason);
    this.onFrame?.(this.state.date, this.state.bodies, []);
  }

  private loop = (now: number): void => {
    this.advance(Math.min(now - this.lastTime, 100), true);
    this.lastTime = now;
    if (this.state.running && !this.state.paused && this.renderer && !this.state.fallbackReason) this.frameId = requestAnimationFrame(this.loop);
  };

  private handleVisibility = (paused: boolean): void => {
    this.state.paused = paused;
    this.onPauseChange?.(paused);
    cancelAnimationFrame(this.frameId);
    if (!paused && this.state.running && this.renderer && !this.state.fallbackReason) {
      this.lastTime = performance.now();
      this.frameId = requestAnimationFrame(this.loop);
    }
  };

  private handleMotionPreference = (event: MediaQueryListEvent): void => {
    this.state.capabilities.reducedMotion = event.matches;
    const next = event.matches ? 'reduced' : selectInitialQuality(getHardwareHints(false));
    this.qualityManager.force(next);
    this.state.quality = next;
    this.renderer?.setQuality(next);
  };

  advance(ms: number, monitorFrame = false): void {
    if (!this.state.running || this.state.paused || !this.renderer || this.state.fallbackReason) return;
    const safeMs = Math.max(ms, 0);
    if (monitorFrame) {
      const changed = this.qualityManager.recordFrame(safeMs);
      this.state.fps = this.qualityManager.fps;
      if (changed) { this.state.quality = changed; this.renderer.setQuality(changed); }
    }
    this.state.elapsedMs += safeMs;
    this.state.date = this.safeDate();
    this.state.bodies = solarSystemAt(this.state.date);
    this.renderer.setBodies(this.state.bodies);
    this.renderer.render(safeMs);
    this.onFrame?.(this.state.date, this.state.bodies, this.renderer.labels());
  }

  selectBody(id: BodyId | null): void {
    if (id) this.markInteracted();
    this.state.selectedId = id;
    this.renderer?.focus(id);
    this.onSelection?.(id ? this.state.bodies.find((body) => body.id === id) ?? null : null);
  }

  resetView(): void { this.selectBody(null); this.renderer?.resetView(); }

  private markInteracted(): void {
    if (this.hasInteracted) return;
    this.hasInteracted = true;
    this.onFirstInteraction?.();
  }

  private bindPointerEvents(): void {
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('pointermove', this.pointerMove);
    this.canvas.addEventListener('pointerup', this.pointerUp);
    this.canvas.addEventListener('pointercancel', this.pointerCancel);
    this.canvas.addEventListener('wheel', this.wheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.doubleClick);
  }

  private unbindPointerEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointercancel', this.pointerCancel);
    this.canvas.removeEventListener('wheel', this.wheel);
    this.canvas.removeEventListener('dblclick', this.doubleClick);
    this.pointers.clear();
  }

  private pointerDown = (event: PointerEvent): void => {
    this.markInteracted();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, type: event.pointerType });
    try { this.canvas.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointers may not support capture */ }
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinchDistance();
  };

  private pointerMove = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5) pointer.moved = true;
    if (this.pointers.size === 1) this.renderer?.rotate(deltaX, deltaY);
    else if (this.pointers.size === 2) {
      const nextDistance = this.currentPinchDistance();
      if (this.pinchDistance > 0) this.renderer?.zoom((this.pinchDistance - nextDistance) * 2.2);
      this.pinchDistance = nextDistance;
      this.pointers.forEach((entry) => { entry.moved = true; });
    }
  };

  private finishPointer(event: PointerEvent, allowSelection: boolean): void {
    const pointer = this.pointers.get(event.pointerId);
    const wasSingle = this.pointers.size === 1;
    if (pointer && allowSelection && wasSingle && !pointer.moved) {
      const selected = this.renderer?.pick(event.clientX, event.clientY) ?? null;
      if (selected) this.selectBody(selected);
    }
    this.pointers.delete(event.pointerId);
    this.pinchDistance = this.pointers.size === 2 ? this.currentPinchDistance() : 0;
  }

  private pointerUp = (event: PointerEvent): void => this.finishPointer(event, true);
  private pointerCancel = (event: PointerEvent): void => this.finishPointer(event, false);
  private currentPinchDistance(): number {
    const [first, second] = [...this.pointers.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  }
  private wheel = (event: WheelEvent): void => { event.preventDefault(); this.markInteracted(); this.renderer?.zoom(event.deltaY); };
  private doubleClick = (): void => { this.markInteracted(); this.resetView(); };

  resize = (): void => this.renderer?.resize(window.innerWidth, window.innerHeight);
  stop(): void { this.state.running = false; cancelAnimationFrame(this.frameId); }
  renderCurrentFrame(): void { this.renderer?.render(0); }
  async toggleFullscreen(): Promise<void> { if (document.fullscreenElement) await document.exitFullscreen(); else await this.canvas.requestFullscreen?.(); this.resize(); }
  async exitFullscreen(): Promise<void> { if (document.fullscreenElement) await document.exitFullscreen(); this.resize(); }

  destroy(): void {
    this.stop();
    this.unbindVisibility?.(); this.unbindVisibility = null;
    this.motionQuery?.removeEventListener?.('change', this.handleMotionPreference);
    this.unbindPointerEvents();
    this.renderer?.dispose(); this.renderer = null;
  }

  renderGameToText(): string {
    return JSON.stringify({
      mode: this.state.fallbackReason ? 'fallback' : 'solar-system',
      date: this.state.date.toISOString(),
      coordinateSystem: 'heliocentric ecliptic J2000 approximation; display distance is logarithmically compressed',
      elapsedMs: Math.round(this.state.elapsedMs),
      quality: this.state.quality,
      fps: Number(this.state.fps.toFixed(1)),
      paused: this.state.paused,
      reducedMotion: this.state.capabilities.reducedMotion,
      fallbackReason: this.state.fallbackReason,
      selectedBody: this.state.selectedId,
      bodyCount: this.state.bodies.length,
      bodies: this.state.bodies.map((body) => ({ id: body.id, distanceAU: Number(body.distanceAU.toFixed(6)), longitudeDeg: Number(body.longitudeDeg.toFixed(3)) })),
      camera: this.renderer?.cameraState ?? null,
      pointer: { active: this.pointers.size > 0, pressed: this.pointers.size > 0, count: this.pointers.size, type: [...this.pointers.values()][0]?.type ?? 'none', dragging: [...this.pointers.values()].some((pointer) => pointer.moved) },
      ui: { onboardingVisible: !this.hasInteracted, fullscreen: Boolean(document.fullscreenElement) },
    });
  }
}
