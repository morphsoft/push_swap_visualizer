import type { Stacks } from "../core/types";

export interface RenderOptions {
  tileThreshold?: number;
}

export class StackRenderer {
  private ctx: CanvasRenderingContext2D;
  private tileThreshold: number;

  constructor(private canvas: HTMLCanvasElement, opts: RenderOptions = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.tileThreshold = opts.tileThreshold ?? 25;
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private hue(value: number, min: number, max: number): string {
    const frac = max > min ? (value - min) / (max - min) : 0.5;
    return `hsl(${Math.round(220 - frac * 220)}, 70%, 55%)`;
  }

  render(stacks: Stacks, valueRange: { min: number; max: number }): void {
    const { ctx } = this;
    const rect = this.canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const halfW = W / 2;
    const largest = Math.max(stacks.a.length, stacks.b.length);
    const useTiles = largest > 0 && largest <= this.tileThreshold;

    this.drawColumn(stacks.a, 0, halfW, H, valueRange, useTiles);
    this.drawColumn(stacks.b, halfW, halfW, H, valueRange, useTiles);

    // divider
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, H);
    ctx.stroke();
  }

  private drawColumn(
    stack: number[],
    x0: number,
    width: number,
    height: number,
    range: { min: number; max: number },
    useTiles: boolean,
  ): void {
    const { ctx } = this;
    const n = stack.length;
    if (n === 0) return;
    const rowH = height / Math.max(n, 1);
    const span = range.max - range.min || 1;

    for (let i = 0; i < n; i++) {
      const value = stack[i];
      const y = i * rowH;
      const color = this.hue(value, range.min, range.max);
      if (useTiles) {
        ctx.fillStyle = color;
        ctx.fillRect(x0 + 8, y + 1, width - 16, rowH - 2);
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.font = `${Math.min(16, rowH - 4)}px monospace`;
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), x0 + 14, y + rowH / 2);
      } else {
        const barW = ((value - range.min) / span) * (width - 12) + 2;
        ctx.fillStyle = color;
        ctx.fillRect(x0 + 4, y, barW, Math.max(1, rowH - 1));
      }
    }
  }
}
