# Push-Swap Visualizer — UX/UI Enhancements Design Spec

**Date:** 2026-06-25
**Status:** Approved (brainstorming)
**Builds on:** [2026-06-25-push-swap-visualizer-design.md](2026-06-25-push-swap-visualizer-design.md) (v1, merged)

## Overview

Make the existing push-swap visualizer more **didactic** and pleasant to use:
elements show both their raw value and a normalized rank, the top of each
stack (where operations act) is always obvious, movements can be heard,
richer reference metrics are shown, and the whole UI gets a cohesive restyle
with onboarding.

## Goals

- Make stacks easy to *read and feel*: dual value + normalized-index labels,
  rank-based color, and an always-visible "top of stack" readout.
- Add optional movement sounds (pitch by rank), off by default.
- Show richer reference metrics: efficiency vs theoretical bound, max B depth,
  live progress/sortedness, per-op-type bar chart, and a threshold gauge.
- A cohesive visual restyle with onboarding (example loader, empty-state hint).
- Keep the framework-agnostic core pure and unit-tested; all new user-facing
  strings go through i18n (PT-BR default, EN).

## Non-Goals (YAGNI)

- No per-op smooth tween animation (still deferred from v1).
- No multi-track/musical sequencing — sound is one short tone per op.
- No new app modes; Interpreter remains an *em breve* placeholder.
- No backend, accounts, or persistence.

## Global Constraints (carried from v1)

- TypeScript strict mode.
- Vanilla TS + Vite, no UI framework.
- `src/core/**` must NOT import from the DOM or the UI layer (pure, testable).
- All user-facing strings go through `i18n` (PT-BR default, EN toggle); `pt`
  and `en` key sets stay identical.
- User-controlled strings must never reach an `innerHTML` sink — render via
  `textContent`/DOM nodes. i18n values interpolated into the layout template
  are escaped via `esc()`.
- Vite `base` stays `/push_swap_visualizer/`.

## Concepts

### Normalized index (rank)

For the input numbers, each value's **rank** is its 0-based position in
ascending sorted order (0 = smallest, n−1 = largest). Ranks are shown as
`#rank` next to values and drive color hue, so the gradient and "sortedness"
read consistently regardless of the raw value range. When stack A is fully
sorted (ascending, top = smallest), ranks read `#0, #1, #2 …` top to bottom.

A pure `rankMap(numbers): Map<number, number>` produces value → rank.

## Architecture

### New modules

- **`src/core/analysis.ts`** (pure, no DOM, unit-tested):
  - `rankMap(numbers: number[]): Map<number, number>` — value → 0-based rank.
  - `theoreticalBound(n: number): number` — `Math.ceil(n * Math.log2(n))` for
    `n >= 2`, else 0.
  - `efficiencyPct(opCount: number, n: number): number` — `bound/opCount`
    clamped to a sensible percentage (bound ÷ opCount × 100, rounded; returns
    100 when opCount is 0 with n ≤ 1).
  - `maxBDepth(timeline: Timeline): number` — peak size of stack B across all
    timeline states.
  - `sortedness(stacks: Stacks): number` — fraction in `[0,1]` of stack A that
    forms the longest ascending run from the top divided by total element count
    `n` (B elements count as not-yet-sorted). Used for the live meter.

- **`src/ui/audio.ts`** (Web Audio wrapper, manual-verified):
  - `class SoundPlayer`:
    - `setEnabled(on: boolean): void`, `setVolume(v: number): void` (0–1).
    - `resume(): void` — creates/resumes the AudioContext (call on first user
      gesture).
    - `playRank(rank: number, n: number): void` — short tone, frequency mapped
      from rank across ~200–900 Hz, with a quick envelope. No-op when disabled.
    - Internal throttle: ignores calls that arrive faster than a minimum
      interval (e.g. 16 ms) and caps concurrent voices, so high-speed/large-n
      runs never stack thousands of oscillators. Audio never affects state.

### Modified modules

- **`src/ui/render.ts`** — `StackRenderer.render` gains a `rankOf: Map<number,
  number>` and `n` (via an extended options/params object). Tile mode shows
  value + `#rank`; bar mode hues by rank and draws a normalized-index ruler;
  both modes outline the top element and mark it "TOP". Hue is computed from
  rank, not raw value.
- **`src/ui/animator.ts`** — on each advanced op, calls an injected
  `onOp(opIndex)` (or reuses `onFrame`) so the app can (a) play the op's sound
  and (b) update live metrics. Exposes the value/rank of the element the op
  acted on for pitch (derived from the state transition).
- **`src/ui/panels.ts`** — add DOM-node renderers (textContent-safe):
  - `renderOpChart(el, breakdown)` — horizontal bars per op token.
  - `renderThresholdGauge(el, size, opCount, grade)` — visual band gauge.
  - `renderExtraMetrics(el, { efficiencyPct, maxBDepth })`.
  - `renderProgress(el, stepIndex, total, sortednessPct)` — live progress.
- **`src/ui/app.ts`** — restyled DOM; wire sound toggle + volume slider
  (calls `SoundPlayer.resume()` on first interaction), live progress updates
  via the animator callback, a "Load example" button and empty-state hint,
  the top-of-stack readout, and pass `rankOf`/`n` to the renderer.
- **`src/ui/i18n.ts`** — new keys in both locales (sound on/off, volume,
  load example, hint text, metric labels: efficiency, max B depth, progress,
  sortedness, top-of-stack, etc.).
- **`src/style.css`** — full restyle: type scale, spacing, card panels,
  polished transport bar, gauges/charts, responsive tweaks.

## Data Flow

```
input → parser → rankMap(numbers); Timeline(numbers, ops)
      → analysis: theoreticalBound, efficiencyPct, maxBDepth
      → StackRenderer.render(state, {min,max}, rankOf, n)  [per frame]
      → animator.onOp(i): SoundPlayer.playRank(rank, n); renderProgress(...)
      → checker → verdict; grader → threshold gauge
```

## Sound Details

- Frequency: `freq = 200 + (rank / Math.max(1, n-1)) * 700` (≈200–900 Hz).
- Envelope: short attack/decay (~60–120 ms), gain scaled by the volume slider.
- Off by default; toggle persists for the session (no storage required).
- The op's "sound rank" = rank of the element moved/swapped (for `pa/pb` the
  pushed element; for `sa/sb/ss` the new top; for rotates the element wrapped).
  Combined ops (`ss/rr/rrr`) play a single tone for the A-side element.
- Throttling guarantees ≤ ~60 tones/sec regardless of playback speed.

## Metrics Details

- **Efficiency vs theoretical:** `theoreticalBound(n)` = `⌈n·log₂n⌉`; display
  `opCount / bound` context and an efficiency % = `bound/opCount × 100` (a value
  ≥100% means at/under the theoretical bound). Shown only when `n ≥ 2`.
- **Max B depth:** computed once from the Timeline; static per run.
- **Live progress:** `step N / total` plus a sortedness meter (`sortedness()`
  of the current state × 100), updated on each frame/op.
- **Per-op-type bar chart:** one labeled horizontal bar per op token present,
  widths proportional to counts.
- **Threshold gauge:** a horizontal gauge with the 42 bands marked
  (100-tier: 700/800/900/1000/1100; 500-tier: 5500/7000/8500/10000/11500), a
  marker at the run's op count, colored by grade label. Shown only when the
  grade is applicable (size near 100 or 500); otherwise a neutral
  "not graded at this size" note.

## UI / UX Details

- **Layout:** retains three columns (inputs · stage · metrics), restyled with
  card panels, a clear type scale, and a polished transport bar (icon buttons
  with tooltips, speed slider, scrubber, op counter, live progress bar).
- **Top bar:** title, language toggle, mode switch (Interpreter disabled), and
  the sound toggle + volume slider.
- **Onboarding:** a "Load example" button that fills a small sample (e.g.
  `2 1 3 6 5 8` + a short op list) so Run works immediately; an empty-state
  hint in the stage before the first Run.
- **Top-of-stack readout:** always-visible `A.top` / `B.top` value + `#rank`.

## Testing

- **Vitest unit tests** for `src/core/analysis.ts`: `rankMap` (including
  duplicates-free contract and negative values), `theoreticalBound` (n=0,1,2,
  100, 500), `efficiencyPct`, `maxBDepth` (peak detection across a known run),
  `sortedness` (empty, fully sorted, reversed, partial).
- Audio, rendering, charts/gauges, and overall UI verified manually
  (`npm run dev`), plus `npm run build` must pass.

## Out-of-scope follow-ups (from v1 review, optional)

- Parser space-separated-ops and INT boundary happy-path tests.
- `Timeline.opAt` bounds guard and `stateAt(200)` snapshot-boundary test.
- DRY the op-counter formatting shared by `app.ts` and `controls.ts`.

These may be folded in opportunistically if a task already touches the file,
but are not required by this spec.
