# Push-Swap Visualizer — Design Spec

**Date:** 2026-06-25
**Status:** Approved (brainstorming)

## Overview

A static, client-side web app that visualizes the 42 *push_swap* project: the
user provides a sequence of numbers and a list of operations, and the app plays
a smooth animation of the two stacks (A and B) moving, validates correctness
(OK/KO), and reports performance metrics against the official 42 grading
thresholds.

Runs entirely in the browser and deploys to GitHub Pages (no backend).

## Goals

- Animate push_swap stack operations clearly and attractively.
- Let a 42 student paste their own numbers + ops to debug and validate output.
- Provide a built-in solver so users can visualize without their own binary.
- Report op count, per-op breakdown, OK/KO verdict, and a 42 grade verdict.
- PT-BR (default) and EN interfaces.

## Non-Goals (YAGNI)

- No backend / accounts / persistence.
- No world-record solver — the built-in algorithm aims for a believable,
  well-performing demo, not optimal op counts.
- The "Interpreter" mode (running push_swap C source) is a future placeholder
  shown as *em breve* (coming soon), not implemented now.
- No charts/time-series analysis in v1 (possible later enhancement).

## Tech Stack

- **Vanilla TypeScript + Vite** (no UI framework).
- **Canvas** for the animation surface.
- **Vitest** for unit tests on the core modules.
- **GitHub Actions → GitHub Pages** for deployment.

Rationale: the hard part is the animation loop and stack-state engine, not UI
complexity. Vanilla keeps the bundle tiny, the animation smooth, and the core
framework-agnostic (reusable by the future interpreter mode).

## Architecture

The code splits into a **framework-agnostic core** (pure TS, no DOM,
unit-tested) and a **UI layer**.

### Core (pure TS, no DOM)

- **`parser`** — parses the numbers input and the operations input into
  validated data. Emits structured errors: duplicate number, non-integer,
  out-of-int-range (32-bit signed), unknown op token. Accepts ops separated by
  spaces or newlines (real push_swap output is newline-separated).
- **`engine`** — the push_swap state machine. Holds stacks A & B; applies a
  single op; builds the full timeline so the scrubber and step-back are instant.
- **`checker`** — given the final state, returns OK/KO (A sorted ascending and
  B empty).
- **`grader`** — given input size + op count, returns the 42 verdict (points
  0–5 + label) using the 100 & 500 thresholds, interpolated for other sizes.
- **`generator`** — "suggest a sequence": produces N unique shuffled ints for a
  chosen size (3, 5, 100, 500, custom).

### UI layer

- **`render`** — Canvas-based stack visualizer with adaptive hybrid rendering.
- **`controls`** — play/pause/reset, speed, step fwd/back, scrubber, op
  counter, keyboard shortcuts.
- **`panels`** — input forms, validation/error display, OK/KO verdict, metrics
  + grade gauge.
- **`i18n`** — PT-BR (default) / EN string tables + toggle.

### Data flow

```
input → parser → engine.buildTimeline() → UI renders frames from timeline
                                         → checker + grader (final state) → metrics panel
```

## Operations

Supported op tokens: `sa sb ss ra rb rr rra rrb rrr pa pb`.

- `sa/sb` — swap top two of A / B. `ss` — both simultaneously.
- `pa/pb` — push top of one stack onto top of the other.
- `ra/rb` — rotate up (top wraps to bottom). `rr` — both.
- `rra/rrb` — rotate down (bottom wraps to top). `rrr` — both.

## Timeline Model

When the user submits, `engine.buildTimeline()` represents the run as the
**initial state + the op list**. Any state at op index `i` is derived by
replaying ops up to `i`. Periodic snapshots (e.g. every 200 ops) prevent
replaying from zero when scrubbing far ahead. Step-back and scrubber become
near-instant lookups. This keeps memory sane at 500 elements × thousands of ops.

## Animation

A `requestAnimationFrame` loop on a single Canvas. Each op animates as a real
transition (not a snap):

- `sa/sb/ss` — top two elements swap positions.
- `pa/pb` — an element flies from the top of one stack to the top of the other.
- `ra/rb/rr` — stack rotates up (top wraps to bottom).
- `rra/rrb/rrr` — rotates down.
- Combined ops (`ss/rr/rrr`) animate both stacks simultaneously.

The speed slider controls per-op duration. At very high speed / very large
inputs, transitions auto-shorten or batch to hold ~60fps. **Correctness of the
final state never depends on animation timing.**

## Rendering (adaptive hybrid)

- Below a threshold (~25 elements per stack): numbered tiles with value labels.
- Above it: plain bars with height ∝ value.
- A subtle hue maps across the value range so "sortedness" reads instantly as a
  smooth gradient.
- Op counter displays `op 142 / 873: pb`, synced to the scrubber.

## Layout (single page)

- **Top bar** — title, language toggle (PT-BR/EN), mode switch:
  **Visualizer | Solver | Interpreter (em breve, disabled)**.
- **Left panel — inputs:**
  - Numbers field + "Sugerir sequência" button → size picker (3, 5, 100, 500,
    custom).
  - Operations field (Visualizer mode only) — paste area, space/newline ops.
  - Validate/Run button; inline errors here (e.g. "linha 12: 'xyz' não é uma
    operação válida", "número duplicado: 42").
- **Center** — Canvas visualizer (A left, B right) + transport controls beneath
  (play/pause/reset, speed, step ±, scrubber, op counter).
- **Right panel — metrics:** OK/KO verdict badge, total op count, per-op-type
  breakdown, 42 grade gauge ("X/5 — outstanding/good/needs work") shown when
  input size is near 100 or 500.

## Modes

- **Visualizer** (primary) — paste numbers + ops; animate, validate, grade.
- **Solver** — type/suggest numbers only; built-in sort generates ops, then
  animates the same way. Clearly labeled as the app's own algorithm.
- **Interpreter** — *em breve*, disabled placeholder.

## Solver Algorithm

A clean chunk-based insertion sort (Turkish-sort / radix-style chunking)
targeting good-but-not-obsessive op counts. Goal: a believable, well-performing
demo.

## Grading Thresholds

- **100 numbers:** 5 pts if < 700 ops, scaling down to 1 pt if < 1100.
- **500 numbers:** 5 pts if < 5500 ops, scaling down to 1 pt if < 11500.
- Other sizes: interpolated; the gauge is most meaningful near 100 and 500.

## Validation & Error Handling

- Reject bad input up front with clear, localized messages: non-integer,
  duplicate, out-of-32-bit-int-range, unknown op token (with line reference).
- After playback, show OK/KO verdict (A sorted ascending, B empty).

## Internationalization

- PT-BR (default) and EN string tables, toggle in the top bar.

## Testing

- Vitest unit tests for the core: parser, engine, checker, grader, generator
  (pure, high-value).
- UI/animation verified manually.

## Deployment

- Vite build → GitHub Actions workflow builds and publishes to GitHub Pages on
  push to `main`.
- Vite `base` set to the repo name so asset paths resolve on Pages.
