# Push-Swap Visualizer UX/UI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the push-swap visualizer more didactic and pleasant — dual value+normalized-index stack labels with an always-visible top-of-stack readout, optional rank-pitched movement sounds, richer metrics (efficiency, max B depth, live progress, op-type chart, threshold gauge), and a cohesive UI restyle with onboarding.

**Architecture:** Add one pure, unit-tested core module (`analysis.ts`) and one Web-Audio UI wrapper (`audio.ts`); extend the renderer (rank-based color + dual labels + top highlight), the animator (a render-context object + a forward-only `onOp` callback for sound/live-metrics), the panels (chart/gauge/progress DOM renderers), and the app/styles. Core stays DOM-free and tested; UI verified via build + manual run.

**Tech Stack:** TypeScript (strict), Vite, Canvas 2D, Web Audio API, Vitest.

## Global Constraints

- TypeScript strict mode.
- Vanilla TS + Vite, no UI framework.
- `src/core/**` MUST NOT import from the DOM or the UI layer (pure, testable).
- All user-facing strings go through `i18n`; `pt` and `en` key sets stay identical.
- User-controlled strings must never reach an `innerHTML` sink — render via `textContent`/DOM nodes. i18n values interpolated into the layout template are escaped via the existing `esc()`.
- Vite `base` stays `/push_swap_visualizer/`.
- Sound is OFF by default; AudioContext is created/resumed only on a user gesture.
- Normalized index = rank: a value's 0-based position in ascending sorted order (0 = smallest). Color hue is driven by rank, not raw value.
- Commit after every task. Do not skip hooks or signing.

---

## File Structure

```
src/core/analysis.ts      # NEW pure: rankMap, theoreticalBound, efficiencyPct,
                          #   maxBDepth, sortedness, movedElement, rankToFrequency
src/ui/audio.ts           # NEW: SoundPlayer (Web Audio wrapper)
src/ui/render.ts          # MOD: RenderContext, rank color, dual labels, top highlight
src/ui/animator.ts        # MOD: RenderContext param + onOp callback + redraw()
src/ui/panels.ts          # MOD: renderOpChart, renderThresholdGauge,
                          #   renderExtraMetrics, renderProgress (remove renderMetrics in Task 7)
src/ui/i18n.ts            # MOD: new keys (both locales)
src/ui/app.ts             # MOD: restyle DOM, wire sound/progress/example/readout
src/style.css             # MOD: full restyle + chart/gauge/progress styles
tests/core/analysis.test.ts  # NEW
```

---

### Task 1: Core analysis module

**Files:**
- Create: `src/core/analysis.ts`
- Test: `tests/core/analysis.test.ts`

**Interfaces:**
- Consumes: `OpToken`, `Stacks` from `src/core/types.ts`; `Timeline` from `src/core/engine.ts`.
- Produces:
  - `rankMap(numbers: number[]): Map<number, number>` — value → 0-based ascending rank.
  - `theoreticalBound(n: number): number` — `⌈n·log₂n⌉` for `n ≥ 2`, else `0`.
  - `efficiencyPct(opCount: number, n: number): number` — `round(bound/opCount × 100)`; returns `100` when `n < 2` or `opCount ≤ 0`.
  - `maxBDepth(timeline: Timeline): number` — peak `b.length` across all states `0..length`.
  - `sortedness(stacks: Stacks): number` — in `[0,1]`: length of the longest ascending run from the top of A, divided by total element count (A+B); `1` when both empty.
  - `movedElement(stateBefore: Stacks, op: OpToken): number | null` — the value the op acts on, computed from the pre-op state (null if the relevant stack is empty).
  - `rankToFrequency(rank: number, n: number): number` — `round(200 + (rank/(n-1))·700)` for `n > 1`, else `round(200 + 0.5·700)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  rankMap, theoreticalBound, efficiencyPct, maxBDepth,
  sortedness, movedElement, rankToFrequency,
} from "../../src/core/analysis";
import { Timeline } from "../../src/core/engine";

describe("rankMap", () => {
  it("maps values to ascending ranks", () => {
    const m = rankMap([40, 10, 30]);
    expect(m.get(10)).toBe(0);
    expect(m.get(30)).toBe(1);
    expect(m.get(40)).toBe(2);
  });
  it("handles negatives", () => {
    const m = rankMap([-5, 0, -10]);
    expect(m.get(-10)).toBe(0);
    expect(m.get(-5)).toBe(1);
    expect(m.get(0)).toBe(2);
  });
});

describe("theoreticalBound", () => {
  it("is 0 for n<2", () => {
    expect(theoreticalBound(0)).toBe(0);
    expect(theoreticalBound(1)).toBe(0);
  });
  it("is ceil(n*log2 n)", () => {
    expect(theoreticalBound(2)).toBe(2);
    expect(theoreticalBound(100)).toBe(Math.ceil(100 * Math.log2(100)));
  });
});

describe("efficiencyPct", () => {
  it("returns 100 for trivial inputs", () => {
    expect(efficiencyPct(0, 1)).toBe(100);
    expect(efficiencyPct(5, 1)).toBe(100);
  });
  it("is round(bound/opCount*100)", () => {
    const bound = theoreticalBound(100); // 664
    expect(efficiencyPct(664, 100)).toBe(100);
    expect(efficiencyPct(1328, 100)).toBe(50);
  });
});

describe("maxBDepth", () => {
  it("finds the peak B size across the run", () => {
    // push two to B, then one back
    const t = new Timeline([3, 1, 2], ["pb", "pb", "pa"]);
    expect(maxBDepth(t)).toBe(2);
  });
  it("is 0 when B never used", () => {
    expect(maxBDepth(new Timeline([1, 2, 3], ["ra", "rra"]))).toBe(0);
  });
});

describe("sortedness", () => {
  it("is 1 for empty", () => {
    expect(sortedness({ a: [], b: [] })).toBe(1);
  });
  it("is 1 for sorted A, empty B", () => {
    expect(sortedness({ a: [1, 2, 3], b: [] })).toBe(1);
  });
  it("is <1 when B has elements", () => {
    expect(sortedness({ a: [1, 2], b: [3] })).toBeCloseTo(2 / 3);
  });
  it("counts only the ascending run from the top", () => {
    // run from top: 1,2 then break at 0 -> run=2 of 3
    expect(sortedness({ a: [1, 2, 0], b: [] })).toBeCloseTo(2 / 3);
  });
});

describe("movedElement", () => {
  const s = { a: [5, 6, 7], b: [8, 9] };
  it("pb -> top of A", () => expect(movedElement(s, "pb")).toBe(5));
  it("pa -> top of B", () => expect(movedElement(s, "pa")).toBe(8));
  it("ra -> top of A", () => expect(movedElement(s, "ra")).toBe(5));
  it("rra -> bottom of A", () => expect(movedElement(s, "rra")).toBe(7));
  it("rrb -> bottom of B", () => expect(movedElement(s, "rrb")).toBe(9));
  it("returns null when stack empty", () =>
    expect(movedElement({ a: [], b: [] }, "pb")).toBeNull());
});

describe("rankToFrequency", () => {
  it("maps rank 0 to 200 Hz", () => expect(rankToFrequency(0, 10)).toBe(200));
  it("maps top rank to 900 Hz", () => expect(rankToFrequency(9, 10)).toBe(900));
  it("uses mid for n<=1", () => expect(rankToFrequency(0, 1)).toBe(550));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/analysis.test.ts`
Expected: FAIL — cannot find module `analysis`.

- [ ] **Step 3: Write `src/core/analysis.ts`**

```ts
import type { OpToken, Stacks } from "./types";
import type { Timeline } from "./engine";

export function rankMap(numbers: number[]): Map<number, number> {
  const sorted = [...numbers].sort((a, b) => a - b);
  const m = new Map<number, number>();
  sorted.forEach((v, i) => m.set(v, i));
  return m;
}

export function theoreticalBound(n: number): number {
  if (n < 2) return 0;
  return Math.ceil(n * Math.log2(n));
}

export function efficiencyPct(opCount: number, n: number): number {
  if (n < 2 || opCount <= 0) return 100;
  return Math.round((theoreticalBound(n) / opCount) * 100);
}

export function maxBDepth(timeline: Timeline): number {
  let max = 0;
  for (let i = 0; i <= timeline.length; i++) {
    const len = timeline.stateAt(i).b.length;
    if (len > max) max = len;
  }
  return max;
}

export function sortedness(stacks: Stacks): number {
  const n = stacks.a.length + stacks.b.length;
  if (n === 0) return 1;
  let run = stacks.a.length === 0 ? 0 : 1;
  for (let i = 1; i < stacks.a.length; i++) {
    if (stacks.a[i] >= stacks.a[i - 1]) run++;
    else break;
  }
  return run / n;
}

export function movedElement(stateBefore: Stacks, op: OpToken): number | null {
  const { a, b } = stateBefore;
  switch (op) {
    case "pa": return b.length ? b[0] : null;
    case "pb": return a.length ? a[0] : null;
    case "sa":
    case "ss": return a.length ? a[0] : null;
    case "sb": return b.length ? b[0] : null;
    case "ra":
    case "rr": return a.length ? a[0] : null;
    case "rb": return b.length ? b[0] : null;
    case "rra":
    case "rrr": return a.length ? a[a.length - 1] : null;
    case "rrb": return b.length ? b[b.length - 1] : null;
  }
}

export function rankToFrequency(rank: number, n: number): number {
  const frac = n > 1 ? rank / (n - 1) : 0.5;
  return Math.round(200 + frac * 700);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/analysis.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/analysis.ts tests/core/analysis.test.ts
git commit -m "feat(core): add analysis (ranks, bound, efficiency, sortedness)"
```

---

### Task 2: i18n keys for new UI

**Files:**
- Modify: `src/ui/i18n.ts`

**Interfaces:**
- Produces: 11 new `StringKey`s available via `t()`, present in BOTH `pt` and `en`: `sound`, `volume`, `load_example`, `hint_empty`, `efficiency`, `theoretical`, `max_b_depth`, `progress`, `sortedness`, `op_breakdown`, `not_graded`.

- [ ] **Step 1: Add the keys to the `pt` record**

In `src/ui/i18n.ts`, inside the `pt: { ... }` object, add these entries (place them after `total_ops:`):

```ts
    sound: "Som",
    volume: "Volume",
    load_example: "Carregar exemplo",
    hint_empty: "Insira números e operações (ou carregue um exemplo) e clique em Executar.",
    efficiency: "Eficiência",
    theoretical: "teórico",
    max_b_depth: "Profundidade máx. B",
    progress: "Progresso",
    sortedness: "Ordenação",
    op_breakdown: "Operações por tipo",
    not_graded: "Sem nota neste tamanho",
```

- [ ] **Step 2: Add the SAME keys to the `en` record**

Inside the `en: { ... }` object, add (after its `total_ops:`):

```ts
    sound: "Sound",
    volume: "Volume",
    load_example: "Load example",
    hint_empty: "Enter numbers and operations (or load an example), then click Run.",
    efficiency: "Efficiency",
    theoretical: "theoretical",
    max_b_depth: "Max B depth",
    progress: "Progress",
    sortedness: "Sortedness",
    op_breakdown: "Ops by type",
    not_graded: "Not graded at this size",
```

- [ ] **Step 3: Verify type-check and key parity**

Run: `npx tsc --noEmit`
Expected: PASS. (StringKey is derived from `strings.pt`; if `en` is missing any key, tsc fails — that's the parity guard.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/i18n.ts
git commit -m "feat(ui): add i18n keys for sound, metrics, onboarding"
```

---

### Task 3: SoundPlayer (Web Audio wrapper)

**Files:**
- Create: `src/ui/audio.ts`

**Interfaces:**
- Consumes: `rankToFrequency` from `src/core/analysis.ts`.
- Produces: `class SoundPlayer` with:
  - `setEnabled(on: boolean): void`
  - `setVolume(v: number): void` (clamped 0–1)
  - `resume(): void` — lazily creates and resumes the AudioContext (call on a user gesture)
  - `playRank(rank: number, n: number): void` — short sine tone pitched by rank; no-op when disabled or context absent; throttled to ≥16 ms between tones.

- [ ] **Step 1: Write `src/ui/audio.ts`**

```ts
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
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/audio.ts
git commit -m "feat(ui): add SoundPlayer web-audio wrapper"
```

---

### Task 4: Renderer — rank color, dual labels, top highlight

**Files:**
- Modify: `src/ui/render.ts`

**Interfaces:**
- Consumes: `Stacks` from `src/core/types.ts`.
- Produces:
  - `interface RenderContext { valueRange: { min: number; max: number }; rankOf: Map<number, number>; n: number }`
  - `StackRenderer.render(stacks: Stacks, rc: RenderContext): void` (signature CHANGED from `(stacks, valueRange)`).
  - Tile mode: value (large) + `#rank` (small) per element; top element outlined and marked. Bar mode: bar width ∝ value, hue ∝ rank, top element outlined, `#rank` drawn when row height ≥ 10px.
  - `RenderOptions` and the constructor are unchanged.

- [ ] **Step 1: Replace the contents of `src/ui/render.ts`**

```ts
import type { Stacks } from "../core/types";

export interface RenderOptions {
  tileThreshold?: number;
}

export interface RenderContext {
  valueRange: { min: number; max: number };
  rankOf: Map<number, number>;
  n: number;
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
    const rowH = height / Math.max(n, 1);
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
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: FAIL — `animator.ts` and `app.ts` still call `render(stacks, valueRange)`. This is expected; Tasks 5 and 7 update those call sites. To confirm THIS file is internally valid, check that the only errors reference `animator.ts`/`app.ts` argument types, not `render.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/ui/render.ts
git commit -m "feat(ui): rank-based color, dual labels, top highlight in renderer"
```

Note: the build is intentionally red between Tasks 4–7 because the render/animator signature change ripples through callers; each of those tasks updates its own call sites, and Task 7 restores a green `npm run build`.

---

### Task 5: Animator — RenderContext + onOp + redraw

**Files:**
- Modify: `src/ui/animator.ts`

**Interfaces:**
- Consumes: `Timeline` from `src/core/engine.ts`; `StackRenderer`, `RenderContext` from `src/ui/render.ts`.
- Produces: `Animator` constructed as `new Animator(timeline, renderer, renderContext: RenderContext, onFrame: (index:number)=>void, onOp?: (opIndex:number)=>void)`.
  - `onOp(opIndex)` fires ONLY when moving forward (play tick advance, `stepForward`), with the index of the op just applied. It does NOT fire on `seek`, `stepBack`, or `reset`.
  - Adds `redraw(): void` (re-renders current frame; used after resize).
  - All existing methods (`play/pause/reset/seek/stepForward/stepBack/setSpeed`, getters `index`/`playing`) keep their behavior.

- [ ] **Step 1: Replace the contents of `src/ui/animator.ts`**

```ts
import type { Timeline } from "../core/engine";
import type { StackRenderer, RenderContext } from "./render";

export class Animator {
  private idx = 0;
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private opsPerSecond = 8;

  constructor(
    private timeline: Timeline,
    private renderer: StackRenderer,
    private renderContext: RenderContext,
    private onFrame: (index: number) => void,
    private onOp?: (opIndex: number) => void,
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
    this.renderer.render(this.timeline.stateAt(this.idx), this.renderContext);
    this.onFrame(this.idx);
  }

  redraw(): void {
    this.renderCurrent();
  }

  seek(index: number): void {
    this.idx = Math.max(0, Math.min(index, this.timeline.length));
    this.renderCurrent();
  }

  stepForward(): void {
    if (this.idx < this.timeline.length) {
      const applied = this.idx;
      this.seek(this.idx + 1);
      this.onOp?.(applied);
    }
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
      if (advanced) {
        this.renderCurrent();
        this.onOp?.(this.idx - 1);
      }
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
```

- [ ] **Step 2: Verify it type-checks against render**

Run: `npx tsc --noEmit`
Expected: still FAIL, but only with errors in `app.ts` (which still constructs `Animator` with the old `valueRange` arg and calls the removed `renderMetrics`). Confirm there are NO errors in `animator.ts` or `render.ts` themselves.

- [ ] **Step 3: Commit**

```bash
git add src/ui/animator.ts
git commit -m "feat(ui): animator render-context + forward-only onOp + redraw"
```

---

### Task 6: Panels — chart, gauge, extra metrics, progress

**Files:**
- Modify: `src/ui/panels.ts`

**Interfaces:**
- Consumes: `Grade` from `src/core/types.ts`; `t` from `src/ui/i18n.ts`.
- Produces (all render via DOM nodes + `textContent`/`style`, never `innerHTML`):
  - `renderExtraMetrics(el: HTMLElement, info: { opCount: number; efficiencyPct: number; theoretical: number; maxBDepth: number; grade: Grade }): void`
  - `renderOpChart(el: HTMLElement, breakdown: Record<string, number>): void`
  - `renderThresholdGauge(el: HTMLElement, size: number, opCount: number, grade: Grade): void`
  - `renderProgress(el: HTMLElement, stepIndex: number, total: number, sortednessPct: number): void`
  - Keep existing `breakdownOf`, `formatError`, `renderVerdict`, `gradeKey`, and (for now) `renderMetrics` — Task 7 removes `renderMetrics`.

- [ ] **Step 1: Append the new functions to `src/ui/panels.ts`**

Add these to the end of the file (keep all existing exports as-is):

```ts
function gradeLabel(grade: Grade): string {
  return t(gradeKey[grade.label]);
}

export function renderExtraMetrics(
  el: HTMLElement,
  info: {
    opCount: number;
    efficiencyPct: number;
    theoretical: number;
    maxBDepth: number;
    grade: Grade;
  },
): void {
  el.replaceChildren();
  const rows: string[] = [];
  rows.push(`${t("total_ops")}: ${info.opCount}`);
  if (info.theoretical > 0) {
    rows.push(
      `${t("efficiency")}: ${info.efficiencyPct}% ` +
        `(${info.opCount}/${info.theoretical} ${t("theoretical")})`,
    );
  }
  rows.push(`${t("max_b_depth")}: ${info.maxBDepth}`);
  if (info.grade.applicable) {
    rows.push(`${info.grade.points}/5 — ${gradeLabel(info.grade)}`);
  }
  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "metric-row";
    div.textContent = r;
    el.appendChild(div);
  }
}

export function renderOpChart(
  el: HTMLElement,
  breakdown: Record<string, number>,
): void {
  el.replaceChildren();
  const title = document.createElement("div");
  title.className = "chart-title";
  title.textContent = t("op_breakdown");
  el.appendChild(title);

  const entries = Object.entries(breakdown).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const maxN = entries.reduce((m, [, n]) => Math.max(m, n), 1);
  for (const [op, n] of entries) {
    const row = document.createElement("div");
    row.className = "op-row";
    const label = document.createElement("span");
    label.className = "op-label";
    label.textContent = op;
    const track = document.createElement("div");
    track.className = "op-track";
    const bar = document.createElement("div");
    bar.className = "op-bar";
    bar.style.width = `${(n / maxN) * 100}%`;
    const count = document.createElement("span");
    count.className = "op-count";
    count.textContent = String(n);
    track.appendChild(bar);
    row.append(label, track, count);
    el.appendChild(row);
  }
}

export function renderThresholdGauge(
  el: HTMLElement,
  size: number,
  opCount: number,
  grade: Grade,
): void {
  el.replaceChildren();
  if (!grade.applicable) {
    const note = document.createElement("div");
    note.className = "gauge-note";
    note.textContent = t("not_graded");
    el.appendChild(note);
    return;
  }
  const bands = size <= 120
    ? [700, 800, 900, 1000, 1100]
    : [5500, 7000, 8500, 10000, 11500];
  const scale = bands[bands.length - 1] * 1.1;

  const track = document.createElement("div");
  track.className = "gauge-track";
  for (const b of bands) {
    const tick = document.createElement("div");
    tick.className = "gauge-tick";
    tick.style.left = `${(b / scale) * 100}%`;
    tick.title = String(b);
    track.appendChild(tick);
  }
  const marker = document.createElement("div");
  marker.className = `gauge-marker grade-${grade.label}`;
  marker.style.left = `${(Math.min(opCount, scale) / scale) * 100}%`;
  track.appendChild(marker);
  el.appendChild(track);

  const caption = document.createElement("div");
  caption.className = "gauge-caption";
  caption.textContent = `${opCount} — ${grade.points}/5 ${gradeLabel(grade)}`;
  el.appendChild(caption);
}

export function renderProgress(
  el: HTMLElement,
  stepIndex: number,
  total: number,
  sortednessPct: number,
): void {
  el.replaceChildren();
  const text = document.createElement("div");
  text.className = "progress-text";
  text.textContent =
    `${t("progress")}: ${stepIndex}/${total} · ` +
    `${t("sortedness")}: ${sortednessPct}%`;
  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = total > 0 ? `${(stepIndex / total) * 100}%` : "0%";
  track.appendChild(fill);
  el.append(text, track);
}
```

- [ ] **Step 2: Verify it type-checks (panels in isolation)**

Run: `npx tsc --noEmit`
Expected: still FAIL only in `app.ts` (old Animator call / removed-later renderMetrics). Confirm NO errors originate in `panels.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/panels.ts
git commit -m "feat(ui): op chart, threshold gauge, extra metrics, progress renderers"
```

---

### Task 7: App wiring + restyle (integration — restores green build)

**Files:**
- Modify: `src/ui/app.ts`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: everything above — `rankMap`, `theoreticalBound`, `efficiencyPct`, `maxBDepth`, `sortedness`, `movedElement` from `core/analysis`; `SoundPlayer` from `ui/audio`; `RenderContext` from `ui/render`; new panel renderers; existing parser/engine/checker/grader/generator/solver/controls/i18n.
- Produces: a working restyled app — sound toggle + volume, live progress + sortedness, top-of-stack readout, op chart, threshold gauge, efficiency + max B depth, a "Load example" button, and an empty-state hint. Removes the now-unused `renderMetrics` import. `npm run build` passes again.

- [ ] **Step 1: Replace the contents of `src/ui/app.ts`**

```ts
import { parseNumbers, parseOps } from "../core/parser";
import { Timeline } from "../core/engine";
import { check } from "../core/checker";
import { grade } from "../core/grader";
import { suggestSequence } from "../core/generator";
import { solve } from "../core/solver";
import {
  rankMap, theoreticalBound, efficiencyPct, maxBDepth, sortedness, movedElement,
} from "../core/analysis";
import type { OpToken } from "../core/types";
import { StackRenderer, type RenderContext } from "./render";
import { Animator } from "./animator";
import { SoundPlayer } from "./audio";
import { wireControls } from "./controls";
import {
  formatError, renderVerdict, breakdownOf,
  renderExtraMetrics, renderOpChart, renderThresholdGauge, renderProgress,
} from "./panels";
import { t, setLang, getLang, type Lang } from "./i18n";

type Mode = "visualizer" | "solver";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EXAMPLE_NUMBERS = "2 1 3 6 5 8";
const EXAMPLE_OPS = "pb\npb\nsa\npa\npa";

export function mountApp(root: HTMLElement): void {
  let mode: Mode = "visualizer";
  let cleanupControls: (() => void) | null = null;
  let cleanupResize: (() => void) | null = null;
  let soundOn = false;
  let volume = 0.5;
  const sound = new SoundPlayer();

  const render = () => {
    if (cleanupControls) { cleanupControls(); cleanupControls = null; }
    if (cleanupResize) { cleanupResize(); cleanupResize = null; }
    root.innerHTML = "";
    root.appendChild(buildLayout());
  };

  function buildLayout(): HTMLElement {
    const el = document.createElement("div");
    el.className = "layout";
    el.innerHTML = `
      <header class="topbar">
        <h1>${esc(t("title"))}</h1>
        <nav class="modes">
          <button data-mode="visualizer" class="${mode === "visualizer" ? "active" : ""}">${esc(t("mode_visualizer"))}</button>
          <button data-mode="solver" class="${mode === "solver" ? "active" : ""}">${esc(t("mode_solver"))}</button>
          <button disabled title="${esc(t("coming_soon"))}">${esc(t("mode_interpreter"))} (${esc(t("coming_soon"))})</button>
        </nav>
        <div class="audio-ctl">
          <button id="soundToggle" class="${soundOn ? "active" : ""}" title="${esc(t("sound"))}">${soundOn ? "🔊" : "🔇"}</button>
          <input id="volume" type="range" min="0" max="1" step="0.01" value="${volume}" title="${esc(t("volume"))}" />
        </div>
        <button id="langToggle">${getLang() === "pt" ? "EN" : "PT"}</button>
      </header>
      <main class="main">
        <section class="panel inputs">
          <label>${esc(t("numbers_label"))}</label>
          <textarea id="numbers" rows="3"></textarea>
          <div class="suggest-row">
            <select id="size"><option>3</option><option>5</option><option selected>100</option><option>500</option></select>
            <button id="suggest">${esc(t("suggest"))}</button>
            <button id="example">${esc(t("load_example"))}</button>
          </div>
          <div id="opsBlock" style="${mode === "solver" ? "display:none" : ""}">
            <label>${esc(t("ops_label"))}</label>
            <textarea id="ops" rows="6"></textarea>
          </div>
          <button id="run" class="run-btn">${esc(t("run"))}</button>
          <div id="errors" class="errors"></div>
        </section>
        <section class="panel stage">
          <div class="readout"><span id="topA" class="top-readout"></span><span id="topB" class="top-readout"></span></div>
          <div class="canvas-wrap">
            <canvas id="canvas"></canvas>
            <div id="hint" class="hint">${esc(t("hint_empty"))}</div>
          </div>
          <div id="progress" class="progress"></div>
          <div class="transport">
            <button id="reset" title="${esc(t("reset"))}">⏮</button>
            <button id="stepBack" title="${esc(t("step_back"))}">◀</button>
            <button id="play" title="${esc(t("play"))}">▶</button>
            <button id="stepFwd" title="${esc(t("step_fwd"))}">▶▶</button>
            <input id="speed" type="range" min="1" max="200" value="8" title="${esc(t("speed"))}" />
            <input id="scrubber" type="range" min="0" max="0" value="0" />
            <span id="counter" class="counter"></span>
          </div>
        </section>
        <aside class="panel metrics">
          <div id="verdict" class="verdict"></div>
          <div id="extraMetrics" class="metric-block"></div>
          <div id="gauge" class="metric-block"></div>
          <div id="opChart" class="metric-block"></div>
        </aside>
      </main>
    `;

    el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.dataset.mode as Mode;
        render();
      }),
    );
    el.querySelector("#langToggle")!.addEventListener("click", () => {
      setLang(getLang() === "pt" ? "en" : ("pt" as Lang));
      render();
    });
    el.querySelector("#suggest")!.addEventListener("click", () => {
      const size = Number((el.querySelector("#size") as HTMLSelectElement).value);
      (el.querySelector("#numbers") as HTMLTextAreaElement).value =
        suggestSequence(size).join(" ");
    });
    el.querySelector("#example")!.addEventListener("click", () => {
      (el.querySelector("#numbers") as HTMLTextAreaElement).value = EXAMPLE_NUMBERS;
      const opsArea = el.querySelector("#ops") as HTMLTextAreaElement | null;
      if (opsArea) opsArea.value = EXAMPLE_OPS;
    });
    const soundBtn = el.querySelector("#soundToggle") as HTMLButtonElement;
    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      sound.resume();
      sound.setEnabled(soundOn);
      soundBtn.classList.toggle("active", soundOn);
      soundBtn.textContent = soundOn ? "🔊" : "🔇";
    });
    const volEl = el.querySelector("#volume") as HTMLInputElement;
    volEl.addEventListener("input", () => {
      volume = Number(volEl.value);
      sound.setVolume(volume);
    });
    sound.setEnabled(soundOn);
    sound.setVolume(volume);

    el.querySelector("#run")!.addEventListener("click", () => run(el));
    return el;
  }

  function readErrors(errorsEl: HTMLElement, errors: { token: string; kind: string; line?: number }[]): void {
    for (const e of errors) {
      const div = document.createElement("div");
      div.textContent = formatError(e as Parameters<typeof formatError>[0]);
      errorsEl.appendChild(div);
    }
  }

  function run(el: HTMLElement): void {
    const errorsEl = el.querySelector("#errors") as HTMLElement;
    errorsEl.replaceChildren();

    const numbersRaw = (el.querySelector("#numbers") as HTMLTextAreaElement).value;
    const numbersResult = parseNumbers(numbersRaw);
    if (!numbersResult.ok) {
      readErrors(errorsEl, numbersResult.errors);
      return;
    }
    const numbers = numbersResult.value;

    let ops: OpToken[];
    if (mode === "solver") {
      ops = solve(numbers);
      const opsArea = el.querySelector("#ops") as HTMLTextAreaElement | null;
      if (opsArea) opsArea.value = ops.join("\n");
    } else {
      const opsRaw = (el.querySelector("#ops") as HTMLTextAreaElement).value;
      const opsResult = parseOps(opsRaw);
      if (!opsResult.ok) {
        readErrors(errorsEl, opsResult.errors);
        return;
      }
      ops = opsResult.value;
    }

    const hint = el.querySelector("#hint") as HTMLElement | null;
    if (hint) hint.style.display = "none";

    const timeline = new Timeline(numbers, ops);
    const n = numbers.length;
    const min = n ? Math.min(...numbers) : 0;
    const max = n ? Math.max(...numbers) : 1;
    const rankOf = rankMap(numbers);
    const renderContext: RenderContext = { valueRange: { min, max }, rankOf, n };

    const canvas = el.querySelector("#canvas") as HTMLCanvasElement;
    const renderer = new StackRenderer(canvas);

    const counter = el.querySelector("#counter") as HTMLElement;
    const scrubber = el.querySelector("#scrubber") as HTMLInputElement;
    const progressEl = el.querySelector("#progress") as HTMLElement;
    const topAEl = el.querySelector("#topA") as HTMLElement;
    const topBEl = el.querySelector("#topB") as HTMLElement;

    const updateFrame = (index: number) => {
      scrubber.value = String(index);
      counter.textContent =
        index >= timeline.length
          ? `op ${index} / ${timeline.length}`
          : `op ${index + 1} / ${timeline.length}: ${timeline.opAt(index)}`;
      const st = timeline.stateAt(index);
      renderProgress(
        progressEl, index, timeline.length,
        Math.round(sortedness(st) * 100),
      );
      const a0 = st.a[0];
      const b0 = st.b[0];
      topAEl.textContent =
        a0 === undefined ? "A —" : `A.top ${a0} (#${rankOf.get(a0) ?? 0})`;
      topBEl.textContent =
        b0 === undefined ? "B —" : `B.top ${b0} (#${rankOf.get(b0) ?? 0})`;
    };

    const animator = new Animator(
      timeline, renderer, renderContext, updateFrame,
      (opIndex) => {
        const before = timeline.stateAt(opIndex);
        const moved = movedElement(before, timeline.opAt(opIndex));
        if (moved !== null) sound.playRank(rankOf.get(moved) ?? 0, n);
      },
    );

    if (cleanupResize) cleanupResize();
    const onResize = () => { renderer.resize(); animator.redraw(); };
    window.addEventListener("resize", onResize);
    cleanupResize = () => window.removeEventListener("resize", onResize);

    if (cleanupControls) cleanupControls();
    cleanupControls = wireControls(
      animator,
      {
        play: el.querySelector("#play") as HTMLButtonElement,
        reset: el.querySelector("#reset") as HTMLButtonElement,
        stepBack: el.querySelector("#stepBack") as HTMLButtonElement,
        stepFwd: el.querySelector("#stepFwd") as HTMLButtonElement,
        speed: el.querySelector("#speed") as HTMLInputElement,
        scrubber,
        counter,
      },
      timeline.length,
      (i) => timeline.opAt(i),
    );

    renderVerdict(el.querySelector("#verdict") as HTMLElement, check(timeline.stateAt(timeline.length)));
    const theoretical = theoreticalBound(n);
    renderExtraMetrics(el.querySelector("#extraMetrics") as HTMLElement, {
      opCount: ops.length,
      efficiencyPct: efficiencyPct(ops.length, n),
      theoretical,
      maxBDepth: maxBDepth(timeline),
      grade: grade(n, ops.length),
    });
    renderThresholdGauge(
      el.querySelector("#gauge") as HTMLElement, n, ops.length, grade(n, ops.length),
    );
    renderOpChart(el.querySelector("#opChart") as HTMLElement, breakdownOf(ops));
  }

  render();
}
```

- [ ] **Step 2: Remove the now-unused `renderMetrics` from `src/ui/panels.ts`**

Delete the entire `export function renderMetrics(...) { ... }` block (the old text-rows function). Leave `breakdownOf`, `formatError`, `renderVerdict`, `gradeKey`, `gradeLabel`, and the Task-6 renderers in place.

- [ ] **Step 3: Replace the contents of `src/style.css`**

```css
:root {
  color-scheme: dark;
  --bg: #0e1117;
  --panel: #161b23;
  --panel-2: #1a2029;
  --line: #2a3340;
  --text: #e6edf3;
  --muted: #9aa6ba;
  --accent: #3b82f6;
  --good: #22c55e;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
}
.layout { height: 100vh; display: flex; flex-direction: column; }
.topbar {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.6rem 1rem; background: var(--panel-2);
  border-bottom: 1px solid var(--line);
}
.topbar h1 { font-size: 1.05rem; margin: 0; font-weight: 700; letter-spacing: 0.2px; }
.modes { display: flex; gap: 0.3rem; }
.modes button, .topbar button, .audio-ctl button {
  background: #232a36; color: #cfd6e4; border: 1px solid var(--line);
  padding: 0.35rem 0.7rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem;
}
.modes button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.modes button[disabled] { opacity: 0.45; cursor: not-allowed; }
.audio-ctl { display: flex; align-items: center; gap: 0.4rem; margin-left: auto; }
.audio-ctl button.active { background: var(--accent); color: #fff; }
.audio-ctl input[type=range] { width: 90px; }
#langToggle { }
.main {
  flex: 1; display: grid; grid-template-columns: 300px 1fr 320px;
  gap: 0.75rem; padding: 0.75rem; min-height: 0;
}
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 0.9rem; overflow: auto; }
.inputs label { display: block; margin: 0.6rem 0 0.3rem; font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.inputs textarea {
  width: 100%; background: #0b0e13; color: var(--text);
  border: 1px solid var(--line); border-radius: 8px; padding: 0.5rem;
  font-family: ui-monospace, monospace; font-size: 0.9rem; resize: vertical;
}
.suggest-row { display: flex; gap: 0.4rem; margin: 0.5rem 0; flex-wrap: wrap; }
.suggest-row select, .suggest-row button { background: #232a36; color: #cfd6e4; border: 1px solid var(--line); border-radius: 8px; padding: 0.35rem 0.5rem; cursor: pointer; }
.run-btn { width: 100%; margin-top: 0.8rem; background: var(--good); color: #04220f; border: none; padding: 0.6rem; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 0.95rem; }
.errors { color: #f87171; margin-top: 0.8rem; font-size: 0.85rem; line-height: 1.5; }
.stage { display: flex; flex-direction: column; min-height: 0; gap: 0.5rem; }
.readout { display: flex; gap: 1rem; font-family: ui-monospace, monospace; font-size: 0.85rem; color: var(--muted); }
.top-readout { background: #0b0e13; border: 1px solid var(--line); border-radius: 6px; padding: 0.2rem 0.5rem; }
.canvas-wrap { position: relative; flex: 1; min-height: 0; }
#canvas { width: 100%; height: 100%; display: block; background: #0b0e13; border-radius: 8px; }
.hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; color: var(--muted); pointer-events: none; }
.progress { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--muted); }
.progress-track { height: 6px; background: #0b0e13; border-radius: 4px; overflow: hidden; margin-top: 0.25rem; border: 1px solid var(--line); }
.progress-fill { height: 100%; background: var(--accent); width: 0; transition: width 0.05s linear; }
.transport { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; }
.transport button { background: #232a36; color: #cfd6e4; border: 1px solid var(--line); border-radius: 8px; padding: 0.35rem 0.6rem; cursor: pointer; }
.transport #scrubber { flex: 1; }
.transport #speed { width: 110px; }
.counter { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--muted); white-space: nowrap; }
.verdict { font-weight: 800; font-size: 1.5rem; padding: 0.5rem; border-radius: 8px; text-align: center; }
.verdict.ok { background: #14532d; color: #4ade80; }
.verdict.ko { background: #4c1d1d; color: #f87171; }
.metric-block { margin-top: 1rem; }
.metric-row { font-family: ui-monospace, monospace; font-size: 0.85rem; line-height: 1.7; }
.chart-title { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem; }
.op-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.2rem 0; font-family: ui-monospace, monospace; font-size: 0.8rem; }
.op-label { width: 34px; color: var(--muted); }
.op-track { flex: 1; background: #0b0e13; border-radius: 4px; height: 14px; overflow: hidden; border: 1px solid var(--line); }
.op-bar { height: 100%; background: var(--accent); }
.op-count { width: 44px; text-align: right; color: var(--muted); }
.gauge-track { position: relative; height: 18px; background: #0b0e13; border: 1px solid var(--line); border-radius: 6px; margin: 0.3rem 0; }
.gauge-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.25); }
.gauge-marker { position: absolute; top: -2px; width: 3px; height: 22px; border-radius: 2px; background: #fff; }
.gauge-marker.grade-outstanding { background: #4ade80; }
.gauge-marker.grade-good { background: #60a5fa; }
.gauge-marker.grade-needs-work { background: #fbbf24; }
.gauge-marker.grade-fail { background: #f87171; }
.gauge-caption, .gauge-note { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--muted); }
@media (max-width: 1000px) {
  .main { grid-template-columns: 1fr; grid-auto-rows: minmax(220px, auto); }
}
```

- [ ] **Step 4: Build and manually verify**

Run: `npm run build`
Expected: `tsc --noEmit` passes (green again) and Vite build succeeds.

Run: `npm run dev`, open the local URL, and verify:
- Empty state shows the hint; "Load example" fills numbers + ops; Run animates and the hint disappears.
- Stacks show value + `#rank`; the top element is outlined; `A.top`/`B.top` readouts update during playback.
- Progress bar + sortedness update while playing; reaching the end shows OK/KO.
- Metrics panel shows total ops, efficiency % (with theoretical), max B depth, grade; the op-type chart and the threshold gauge render; gauge shows "not graded" note for sizes far from 100/500.
- Sound: toggle 🔇→🔊, press play — tones play, pitch rises with rank; volume slider changes loudness; toggling off silences it. (First toggle resumes the AudioContext.)
- Solver mode hides the ops box and still animates + grades. Language toggle flips PT/EN across all new labels.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app.ts src/ui/panels.ts src/style.css
git commit -m "feat(ui): restyle app, wire sound, live metrics, gauge, chart, onboarding"
```

---

## Self-Review

**Spec coverage:**
- Dual value + normalized-index labels, rank-based hue → Task 4 (+ rankMap Task 1). ✓
- Always-visible top-of-stack highlight + readout → Task 4 (canvas) + Task 7 (`A.top`/`B.top`). ✓
- Sound, off by default, pitch by rank, toggle + volume, gesture-resumed, throttled → Tasks 1 (`rankToFrequency`), 3 (`SoundPlayer`), 5 (`onOp`), 7 (wiring). ✓
- Efficiency vs theoretical, max B depth, live progress/sortedness, op-type chart, threshold gauge → Tasks 1 (analysis) + 6 (renderers) + 7 (wiring). ✓
- Full restyle + onboarding (example loader, empty-state hint) → Task 7. ✓
- i18n PT-BR/EN parity for all new strings → Task 2 (+ esc() retained in Task 7). ✓
- Core stays DOM-free + unit-tested → Task 1 (`analysis.ts` pure, tested); no DOM imports added to core. ✓
- No user string reaches innerHTML; layout i18n escaped → Task 6/7 use textContent/DOM nodes; `esc()` retained. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The intentionally-red build across Tasks 4–6 is called out explicitly with the reason and the exact "errors only in app.ts/animator.ts" expectation, and Task 7 restores green — this is a sequencing note, not a placeholder.

**Type consistency:** `RenderContext { valueRange, rankOf, n }` defined in Task 4, consumed identically by Animator (Task 5) and app (Task 7). `Animator(timeline, renderer, renderContext, onFrame, onOp?)` matches between Tasks 5 and 7. Panel renderer signatures in Task 6 match their Task 7 call sites (`renderExtraMetrics` info object fields, `renderThresholdGauge(el,size,opCount,grade)`, `renderProgress(el,stepIndex,total,sortednessPct)`, `renderOpChart(el,breakdown)`). `movedElement`/`rankToFrequency`/`sortedness`/`maxBDepth`/`efficiencyPct`/`theoreticalBound`/`rankMap` names consistent across Tasks 1, 3, 7. The 11 i18n keys added in Task 2 are exactly those referenced in Tasks 6–7.

**Note:** `renderMetrics` exists through Task 6 (so each task builds in isolation where it can) and is removed in Task 7 Step 2 alongside the app switch to the new renderers — avoiding a dangling import.
