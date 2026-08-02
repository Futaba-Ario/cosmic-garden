export interface PointerState {
  active: boolean;
  pointerId: number | null;
  pointerType: string;
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  velocity: number;
  pressed: boolean;
  holdRatio: number;
  holdMs: number;
}

export const emptyPointerState = (): PointerState => ({ active: false, pointerId: null, pointerType: 'none', screenX: 0, screenY: 0, worldX: 0, worldY: 0, velocity: 0, pressed: false, holdRatio: 0, holdMs: 0 });
