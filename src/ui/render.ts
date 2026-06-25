import type { Stacks } from "../core/types";

export interface RenderOptions {
  tileThreshold?: number;
}

export interface RenderContext {
  valueRange: { min: number; max: number };
  rankOf: Map<number, number>;
  n: number;
}

// Largest height a single stack element may occupy. Without a cap, a stack of
// 2-3 items stretches each element across the whole canvas, reading as giant
// slabs instead of discrete, legible elements.
const MAX_ROW_HEIGHT = 64;

export function tileRowHeight(count: number, height: number): number {
  if (count <= 0) return 0;
  return Math.min(MAX_ROW_HEIGHT, height / count);
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

  private hueByRank(rank: number, n: number): string {
    const frac = n > 1 ? rank / (n - 1) : 0.5;
    return `hsl(${Math.round(220 - frac * 220)}, 70%, 55%)`;
  }

  render(stacks: Stacks, rc: RenderContext): void {
    const { ctx } = this;
    const rect = this.canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const halfW = W / 2;
    const largest = Math.max(stacks.a.length, stacks.b.length);
    const useTiles = largest > 0 && largest <= this.tileThreshold;

    this.drawColumn(stacks.a, 0, halfW, H, rc, useTiles);
    this.drawColumn(stacks.b, halfW, halfW, H, rc, useTiles);

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
    rc: RenderContext,
    useTiles: boolean,
  ): void {
    const { ctx } = this;
    const n = stack.length;
    if (n === 0) return;
    const rowH = tileRowHeight(n, height);
    const span = rc.valueRange.max - rc.valueRange.min || 1;

    for (let i = 0; i < n; i++) {
      const value = stack[i];
      const rank = rc.rankOf.get(value) ?? 0;
      const y = i * rowH;
      const isTop = i === 0;
      const color = this.hueByRank(rank, rc.n);

      if (useTiles) {
        ctx.fillStyle = color;
        ctx.fillRect(x0 + 8, y + 1, width - 16, rowH - 2);
        if (isTop) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 8, y + 1, width - 16, rowH - 2);
        }
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.textBaseline = "middle";
        if (rowH >= 22) {
          ctx.font = `bold ${Math.min(15, rowH * 0.4)}px monospace`;
          ctx.fillText(String(value), x0 + 14, y + rowH * 0.4);
          ctx.font = `${Math.min(11, rowH * 0.28)}px monospace`;
          ctx.fillText(`#${rank}`, x0 + 14, y + rowH * 0.74);
        } else {
          ctx.font = `${Math.min(14, rowH - 4)}px monospace`;
          ctx.fillText(`${value} #${rank}`, x0 + 14, y + rowH / 2);
        }
      } else {
        const barW = ((value - rc.valueRange.min) / span) * (width - 12) + 2;
        ctx.fillStyle = color;
        ctx.fillRect(x0 + 4, y, barW, Math.max(1, rowH - 1));
        if (isTop) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x0 + 4, y, barW, Math.max(1, rowH - 1));
        }
        if (rowH >= 10) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = `${Math.min(10, rowH - 2)}px monospace`;
          ctx.textBaseline = "middle";
          ctx.fillText(`#${rank}`, x0 + 6, y + rowH / 2);
        }
      }
    }
  }
}
