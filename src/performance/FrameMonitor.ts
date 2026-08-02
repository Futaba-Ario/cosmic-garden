export class FrameMonitor {
  private fpsValue = 60;
  private initialized = false;
  constructor(private readonly smoothing = .08) {}
  record(deltaMs: number): number {
    if (deltaMs <= 0 || deltaMs > 500) return this.fpsValue;
    const instant = Math.min(120, 1000 / deltaMs);
    this.fpsValue = this.initialized ? this.fpsValue + (instant - this.fpsValue) * this.smoothing : instant;
    this.initialized = true;
    return this.fpsValue;
  }
  get fps(): number { return this.fpsValue; }
}
