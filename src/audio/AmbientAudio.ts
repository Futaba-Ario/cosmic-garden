export class AmbientAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private oscillator: OscillatorNode | null = null;
  private enabled = false;

  async toggle(): Promise<boolean> {
    if (this.enabled) { this.stop(); return false; }
    await this.start();
    return this.enabled;
  }

  async start(): Promise<void> {
    if (this.enabled) return;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error('このブラウザは環境音に対応していません。');
    this.context = new AudioContextCtor();
    await this.context.resume();
    this.gain = this.context.createGain();
    this.gain.gain.value = 0.018;
    this.oscillator = this.context.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = 174;
    this.oscillator.connect(this.gain).connect(this.context.destination);
    this.oscillator.start();
    this.enabled = true;
  }

  stop(): void {
    this.oscillator?.stop();
    this.oscillator?.disconnect();
    this.gain?.disconnect();
    void this.context?.close();
    this.context = null; this.gain = null; this.oscillator = null; this.enabled = false;
  }

  async pause(): Promise<void> { if (this.enabled && this.context?.state === 'running') await this.context.suspend(); }
  async resume(): Promise<void> { if (this.enabled && this.context?.state === 'suspended') await this.context.resume(); }

  get isEnabled(): boolean { return this.enabled; }
  dispose(): void { this.stop(); }
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext; } }
