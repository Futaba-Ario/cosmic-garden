import { emptyPointerState, type PointerState } from './PointerState';

export const HOLD_DURATION_MS = 700;
const SMOOTHING = 0.26;

export class PointerController {
  readonly state = emptyPointerState();
  private lastX = 0; private lastY = 0; private lastMs = 0;
  constructor(private readonly element: HTMLElement, private readonly onRelease: (state: PointerState) => void) {
    element.addEventListener('pointerdown', this.down);
    element.addEventListener('pointermove', this.move);
    element.addEventListener('pointerup', this.up);
    element.addEventListener('pointercancel', this.cancel);
    element.addEventListener('pointerleave', this.leave);
    window.addEventListener('blur', this.cancel);
  }
  private position(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const now = event.timeStamp || performance.now();
    const dt = Math.max(1, now - this.lastMs);
    const rawVelocity = Math.hypot(x - this.lastX, y - this.lastY) / dt;
    this.state.velocity += (rawVelocity - this.state.velocity) * SMOOTHING;
    this.state.screenX = x; this.state.screenY = y;
    this.state.worldX = rect.width ? x / rect.width * 2 - 1 : 0;
    this.state.worldY = rect.height ? 1 - y / rect.height * 2 : 0;
    this.lastX = x; this.lastY = y; this.lastMs = now;
  }
  private down = (event: PointerEvent): void => {
    if (this.state.pointerId !== null) return;
    this.state.active = true; this.state.pressed = true; this.state.pointerId = event.pointerId; this.state.pointerType = event.pointerType;
    const rect = this.element.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width); const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    this.state.velocity = 0; this.lastX = x; this.lastY = y; this.lastMs = event.timeStamp || performance.now();
    this.state.screenX = x; this.state.screenY = y; this.state.worldX = rect.width ? x / rect.width * 2 - 1 : 0; this.state.worldY = rect.height ? 1 - y / rect.height * 2 : 0;
    try { this.element.setPointerCapture?.(event.pointerId); } catch { /* pointer capture may be unavailable for synthetic or cancelled touch streams */ }
  };
  private move = (event: PointerEvent): void => { if (this.state.pointerId === null || event.pointerId === this.state.pointerId) { this.state.active = true; this.position(event); } };
  private finish(release: boolean, event?: PointerEvent): void {
    if (event && this.state.pointerId !== event.pointerId) return;
    if (release && this.state.pressed && this.state.holdRatio >= 1) this.onRelease({ ...this.state });
    this.state.pressed = false; this.state.active = false; this.state.pointerId = null; this.state.holdRatio = 0; this.state.holdMs = 0;
  }
  private up = (event: PointerEvent): void => this.finish(true, event);
  private cancel = (event?: Event): void => this.finish(false, event instanceof PointerEvent ? event : undefined);
  private leave = (event: PointerEvent): void => { if (event.pointerType === 'mouse' && !this.state.pressed) this.finish(false, event); };
  update(deltaMs: number): void { if (this.state.pressed) { this.state.holdMs += deltaMs; this.state.holdRatio = Math.min(1, this.state.holdMs / HOLD_DURATION_MS); } else this.state.velocity *= Math.pow(.002, deltaMs / 1000); }
  dispose(): void { this.element.removeEventListener('pointerdown', this.down); this.element.removeEventListener('pointermove', this.move); this.element.removeEventListener('pointerup', this.up); this.element.removeEventListener('pointercancel', this.cancel); this.element.removeEventListener('pointerleave', this.leave); window.removeEventListener('blur', this.cancel); }
}
