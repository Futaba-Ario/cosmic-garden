import './styles.css';
import { CosmicGardenApp } from './app/CosmicGardenApp';
import { OverlayUI } from './ui/OverlayUI';
import { AmbientAudio } from './audio/AmbientAudio';
import { shareCurrentUrl } from './ui/ShareController';
import { saveCanvasPng } from './ui/CaptureController';

const canvas = document.querySelector<HTMLCanvasElement>('#cosmic-canvas');
const fallback = document.querySelector<HTMLElement>('#fallback');
if (!canvas || !fallback) throw new Error('太陽系の表示領域を初期化できませんでした。');
const debugDate = new URLSearchParams(location.search).get('debugDate');
const fixedDate = debugDate ? new Date(debugDate) : null;
const app = new CosmicGardenApp(canvas, fallback, () => fixedDate ?? new Date());
const layer = document.querySelector<HTMLElement>('#ui-layer');
if (!layer) throw new Error('UIレイヤーを初期化できませんでした。');
const audio = new AmbientAudio();
const ui = new OverlayUI(layer, {
  onSound: () => void audio.toggle().then((enabled) => { ui.setSound(enabled); ui.showToast(enabled ? '環境音をオンにしました。' : '環境音をオフにしました。'); }).catch((error: unknown) => ui.showToast(error instanceof Error ? error.message : '環境音を開始できませんでした。')),
  onShare: () => void shareCurrentUrl().then((message) => ui.showToast(message)).catch(() => ui.showToast('共有できませんでした。')),
  onCapture: () => { app.renderCurrentFrame(); void saveCanvasPng(canvas).then(() => ui.showToast('PNGを保存しました。')).catch(() => ui.showToast('PNGを保存できませんでした。')); },
  onSelectBody: (id) => app.selectBody(id),
  onResetView: () => app.resetView(),
}, Boolean(fixedDate));
app.onFirstInteraction = () => ui.dismissOnboarding();
app.onFrame = (date, _bodies, labels) => ui.update(date, labels);
app.onSelection = (body) => ui.showDetails(body);
app.onPauseChange = (paused) => { if (paused) void audio.pause(); else void audio.resume(); };
app.start();
window.addEventListener('resize', app.resize, { passive: true });
window.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'f') void app.toggleFullscreen(); if (event.key === 'Escape') void app.exitFullscreen(); });
window.addEventListener('beforeunload', () => { audio.dispose(); app.destroy(); }, { once: true });
declare global { interface Window { render_game_to_text: () => string; advanceTime: (ms: number) => void; } }
window.render_game_to_text = () => app.renderGameToText();
window.advanceTime = (ms) => app.advance(ms);
