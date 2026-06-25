import type { Timeline } from "../core/engine";
import type { StackRenderer } from "./render";

export class Animator {
  private idx = 0;
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private opsPerSecond = 8;

  constructor(
    private timeline: Timeline,
    private renderer: StackRenderer,
    private valueRange: { min: number; max: number },
    private onFrame: (index: number) => void,
  ) {
    this.renderCurrent();
  }

  get index(): number {
    return this.idx;
  }

  get playing(): boolean {
    return this.rafId !== null;
  }

  setSpeed(opsPerSecond: number): void {
    this.opsPerSecond = Math.max(0.5, opsPerSecond);
  }

  private renderCurrent(): void {
    this.renderer.render(this.timeline.stateAt(this.idx), this.valueRange);
    this.onFrame(this.idx);
  }

  seek(index: number): void {
    this.idx = Math.max(0, Math.min(index, this.timeline.length));
    this.renderCurrent();
  }

  stepForward(): void {
    if (this.idx < this.timeline.length) this.seek(this.idx + 1);
  }

  stepBack(): void {
    if (this.idx > 0) this.seek(this.idx - 1);
  }

  reset(): void {
    this.pause();
    this.seek(0);
  }

  play(): void {
    if (this.rafId !== null) return;
    if (this.idx >= this.timeline.length) this.seek(0);
    this.lastTime = performance.now();
    this.accumulator = 0;
    const tick = (now: number) => {
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.accumulator += dt * this.opsPerSecond;
      let advanced = false;
      while (this.accumulator >= 1 && this.idx < this.timeline.length) {
        this.idx++;
        this.accumulator -= 1;
        advanced = true;
      }
      if (advanced) this.renderCurrent();
      if (this.idx >= this.timeline.length) {
        this.pause();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  pause(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
