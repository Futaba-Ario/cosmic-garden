import { BODY_DEFINITIONS, type BodyPosition } from '../astronomy/solarSystem';

export type FallbackReason = 'webgl-unavailable' | 'initialization-failed' | 'context-lost';

export class StaticFallback {
  constructor(private readonly element: HTMLElement) {}
  show(date: Date, bodies: BodyPosition[], reason: FallbackReason): void {
    this.element.hidden = false;
    this.element.dataset.reason = reason;
    const planets = bodies.filter((body) => body.id !== 'sun');
    const outer = Math.max(...planets.map((body) => Math.hypot(body.positionAU.x, body.positionAU.y)), 1);
    const markers = bodies.map((body) => {
      const x = body.id === 'sun' ? 50 : 50 + body.positionAU.x / outer * 42;
      const y = body.id === 'sun' ? 50 : 50 + body.positionAU.y / outer * 42;
      const size = body.id === 'sun' ? 22 : Math.max(6, BODY_DEFINITIONS[body.id].radius * 7);
      return `<span class="fallback-body fallback-body--${body.id}" style="--x:${x}%;--y:${y}%;--size:${size}px;--color:#${body.color.toString(16).padStart(6, '0')}" aria-label="${body.name}"></span>`;
    }).join('');
    this.element.innerHTML = `<div class="fallback-stars" aria-hidden="true"></div><div class="fallback-system" aria-label="現在日時の簡略太陽系">${markers}</div><div class="fallback-copy"><p>いまの、太陽系。</p><small>${date.toLocaleString('ja-JP')} の近似位置を2Dで表示しています。</small></div>`;
  }
  hide(): void { this.element.hidden = true; this.element.removeAttribute('data-reason'); }
}
