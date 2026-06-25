import { rankToFrequency } from "../core/analysis";

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private volume = 0.5;
  private lastPlay = 0;
  private readonly minIntervalMs = 16;

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  playRank(rank: number, n: number): void {
    if (!this.enabled || !this.ctx) return;
    const now = performance.now();
    if (now - this.lastPlay < this.minIntervalMs) return;
    this.lastPlay = now;

    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = rankToFrequency(rank, n);
    const peak = Math.max(0.0002, this.volume * 0.3);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.13);
  }
}
