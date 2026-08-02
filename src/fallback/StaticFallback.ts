import type { ThemeState } from '../theme/themeTypes';

export type FallbackReason = 'webgl-unavailable' | 'initialization-failed' | 'context-lost';
const rgb = ({ r, g, b }: { r: number; g: number; b: number }) => `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;

export class StaticFallback {
  constructor(private readonly element: HTMLElement) {}
  show(theme: ThemeState, reason: FallbackReason): void {
    this.element.hidden = false;
    this.element.dataset.reason = reason;
    this.element.style.setProperty('--fallback-background', rgb(theme.background));
    this.element.style.setProperty('--fallback-primary', rgb(theme.nebulaA));
    this.element.style.setProperty('--fallback-secondary', rgb(theme.nebulaB));
    this.element.innerHTML = '<div class="fallback-stars" aria-hidden="true"></div><p>静かな星明かりの庭</p><small>この端末では、今の季節と時刻を映した静止画でお楽しみください。</small>';
  }
  hide(): void { this.element.hidden = true; this.element.removeAttribute('data-reason'); }
}
