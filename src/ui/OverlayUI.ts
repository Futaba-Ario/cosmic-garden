import type { ThemeState } from '../theme/themeTypes';

export type UIHandlers = { onSound: () => void; onShare: () => void; onCapture: () => void; };

export class OverlayUI {
  private readonly onboarding: HTMLElement;
  private readonly time: HTMLElement;
  private readonly sound: HTMLButtonElement;
  private readonly toast: HTMLElement;
  constructor(private readonly root: HTMLElement, handlers: UIHandlers) {
    root.innerHTML = `
      <section class="onboarding" data-onboarding aria-label="操作案内"><p>触れて、あなただけの銀河を。</p><small>近づけると星が集まり、なぞると光の軌跡。長押しして離すと銀河が生まれます。</small></section>
      <aside class="status" aria-label="現在の空"><span data-time></span></aside>
      <nav class="controls" aria-label="作品の操作">
        <button type="button" data-sound aria-pressed="false" aria-label="環境音をオンにする">音: オフ</button>
        <button type="button" data-share aria-label="作品のURLを共有またはコピーする">共有</button>
        <button type="button" data-capture aria-label="現在の宇宙をPNGとして保存する">PNG保存</button>
      </nav>
      <p class="toast" data-toast role="status" aria-live="polite"></p>`;
    this.onboarding = root.querySelector('[data-onboarding]')!;
    this.time = root.querySelector('[data-time]')!;
    this.sound = root.querySelector('[data-sound]')!;
    this.toast = root.querySelector('[data-toast]')!;
    root.querySelector('[data-sound]')!.addEventListener('click', handlers.onSound);
    root.querySelector('[data-share]')!.addEventListener('click', handlers.onShare);
    root.querySelector('[data-capture]')!.addEventListener('click', handlers.onCapture);
  }
  update(date: Date, theme: ThemeState): void { this.time.textContent = `${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} · ${({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[theme.season])}の${({ morning: '朝', day: '昼', evening: '夕方', night: '深夜' }[theme.timeOfDay])}`; }
  dismissOnboarding(): void { this.onboarding.classList.add('is-hidden'); }
  setSound(enabled: boolean): void { this.sound.textContent = `音: ${enabled ? 'オン' : 'オフ'}`; this.sound.setAttribute('aria-pressed', String(enabled)); this.sound.setAttribute('aria-label', `環境音を${enabled ? 'オフ' : 'オン'}にする`); }
  showToast(message: string): void { this.toast.textContent = message; this.toast.classList.add('is-visible'); window.setTimeout(() => this.toast.classList.remove('is-visible'), 2600); }
}
