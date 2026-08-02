export interface Capabilities { webgl: boolean; touch: boolean; reducedMotion: boolean; }

export function getCapabilities(): Capabilities {
  const canvas = document.createElement('canvas');
  const webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  return {
    webgl,
    touch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
}
