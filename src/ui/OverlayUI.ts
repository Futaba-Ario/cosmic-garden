import { BODY_DEFINITIONS, BODY_IDS, type BodyId, type BodyPosition } from '../astronomy/solarSystem';
import type { ScreenLabel } from '../rendering/CosmicRenderer';

export type UIHandlers = { onSound: () => void; onShare: () => void; onCapture: () => void; onSelectBody: (id: BodyId) => void; onResetView: () => void; };

export class OverlayUI {
  private readonly onboarding: HTMLElement;
  private readonly time: HTMLElement;
  private readonly sound: HTMLButtonElement;
  private readonly toast: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly labels = new Map<BodyId, HTMLButtonElement>();

  constructor(private readonly root: HTMLElement, handlers: UIHandlers, private readonly fixedTime = false) {
    const labelButtons = BODY_IDS.map((id) => `<button type="button" class="body-label" data-body-label="${id}" aria-label="${BODY_DEFINITIONS[id].name}を選択"><span class="body-label__dot" style="--body-color:#${BODY_DEFINITIONS[id].color.toString(16).padStart(6, '0')}"></span>${BODY_DEFINITIONS[id].name}</button>`).join('');
    root.innerHTML = `
      <header class="masthead">
        <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>${fixedTime ? 'TIME REPLAY' : 'LIVE ORBITAL VIEW'}</p>
        <h1>いまの、太陽系。</h1>
        <p class="status" data-time></p>
      </header>
      <section class="onboarding" data-onboarding aria-label="操作案内"><p>太陽系を、手のひらで。</p><small>ドラッグで回転 · ホイール／ピンチでズーム · 惑星を選んでフォーカス</small></section>
      <div class="body-labels" aria-label="天体ラベル">${labelButtons}</div>
      <aside class="planet-detail" data-detail hidden aria-live="polite"></aside>
      <p class="scale-note">軌道距離は対数圧縮、天体サイズは拡大表示 · 鑑賞／教育向け近似値</p>
      <nav class="controls" aria-label="太陽系ビューアの操作">
        <button type="button" class="control control--primary" data-reset aria-label="太陽系全体を見る">全体を見る</button>
        <button type="button" class="control" data-sound aria-pressed="false" aria-label="環境音をオンにする">音: オフ</button>
        <button type="button" class="control" data-share aria-label="作品のURLを共有またはコピーする">共有</button>
        <button type="button" class="control" data-capture aria-label="現在の太陽系をPNGとして保存する">PNG保存</button>
      </nav>
      <p class="toast" data-toast role="status" aria-live="polite"></p>`;
    this.onboarding = root.querySelector('[data-onboarding]')!;
    this.time = root.querySelector('[data-time]')!;
    this.sound = root.querySelector('[data-sound]')!;
    this.toast = root.querySelector('[data-toast]')!;
    this.detail = root.querySelector('[data-detail]')!;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-body-label]')) {
      const id = button.dataset.bodyLabel as BodyId;
      this.labels.set(id, button);
      button.addEventListener('click', () => handlers.onSelectBody(id));
    }
    root.querySelector('[data-reset]')!.addEventListener('click', handlers.onResetView);
    root.querySelector('[data-sound]')!.addEventListener('click', handlers.onSound);
    root.querySelector('[data-share]')!.addEventListener('click', handlers.onShare);
    root.querySelector('[data-capture]')!.addEventListener('click', handlers.onCapture);
  }

  update(date: Date, labels: ScreenLabel[]): void {
    this.time.textContent = `${date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}  ${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}  JST`;
    for (const label of labels) {
      const button = this.labels.get(label.id);
      if (!button) continue;
      const moonOffsetX = label.id === 'moon' ? 42 : 0;
      const moonOffsetY = label.id === 'moon' ? 14 : 0;
      button.style.transform = `translate3d(${Math.round(label.x + moonOffsetX)}px, ${Math.round(label.y + moonOffsetY)}px, 0) translate(-50%, calc(-100% - 10px))`;
      button.hidden = !label.visible;
      button.classList.toggle('is-selected', label.selected);
    }
  }

  showDetails(body: BodyPosition | null): void {
    this.root.classList.toggle('has-detail', Boolean(body));
    if (!body) { this.detail.hidden = true; this.detail.innerHTML = ''; return; }
    const distance = body.id === 'sun' ? '中心' : body.id === 'moon' ? '地球から 約38.4万 km' : `${body.distanceAU.toFixed(body.distanceAU < 10 ? 3 : 2)} AU`;
    const period = body.periodDays === 0 ? '—' : body.periodDays < 1000 ? `${body.periodDays.toLocaleString('ja-JP', { maximumFractionDigits: 1 })} 日` : `${(body.periodDays / 365.256).toLocaleString('ja-JP', { maximumFractionDigits: 1 })} 年`;
    this.detail.hidden = false;
    this.detail.innerHTML = `
      <div class="detail-heading"><span class="detail-planet" style="--body-color:#${body.color.toString(16).padStart(6, '0')}"></span><div><p>${body.englishName}</p><h2>${body.name}</h2></div></div>
      <p class="detail-description">${body.description}</p>
      <dl><div><dt>太陽からの距離</dt><dd>${distance}</dd></div><div><dt>公転周期</dt><dd>${period}</dd></div><div><dt>太陽中心黄経</dt><dd>${body.longitudeDeg.toFixed(1)}°</dd></div></dl>`;
  }

  dismissOnboarding(): void { this.onboarding.classList.add('is-hidden'); }
  setSound(enabled: boolean): void { this.sound.textContent = `音: ${enabled ? 'オン' : 'オフ'}`; this.sound.setAttribute('aria-pressed', String(enabled)); this.sound.setAttribute('aria-label', `環境音を${enabled ? 'オフ' : 'オン'}にする`); }
  showToast(message: string): void { this.toast.textContent = message; this.toast.classList.add('is-visible'); window.setTimeout(() => this.toast.classList.remove('is-visible'), 2600); }
}
