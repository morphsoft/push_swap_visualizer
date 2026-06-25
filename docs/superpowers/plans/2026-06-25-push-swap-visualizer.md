# Push-Swap Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, client-side web app that animates 42 push_swap stack operations, validates correctness (OK/KO), and reports performance metrics against 42 grading thresholds, deployed to GitHub Pages.

**Architecture:** A framework-agnostic core (pure TS, no DOM, unit-tested with Vitest) holds the parser, engine, checker, grader, and generator. A UI layer (Canvas + DOM controls) consumes the core to render an adaptive animation with full playback transport. Two modes: Visualizer (paste numbers + ops) and Solver (built-in sort generates ops); Interpreter is a disabled *em breve* placeholder.

**Tech Stack:** TypeScript, Vite, Canvas 2D, Vitest. GitHub Actions → GitHub Pages.

## Global Constraints

- TypeScript strict mode enabled (`"strict": true` in tsconfig).
- No UI framework — Vanilla TS + DOM only.
- Core modules (`src/core/**`) MUST NOT import from the DOM or the UI layer (keeps them pure and testable, reusable by the future interpreter mode).
- Integers validated as 32-bit signed range: `-2147483648` to `2147483647`.
- Supported op tokens (exact set): `sa sb ss ra rb rr rra rrb rrr pa pb`.
- Ops input accepts both space- and newline-separated tokens.
- UI language: PT-BR default, EN toggle. All user-facing strings go through `i18n`.
- Grading thresholds (verbatim): 100 numbers → 5 pts if `< 700`, scaling down to 1 pt if `< 1100`. 500 numbers → 5 pts if `< 5500`, scaling down to 1 pt if `< 11500`.
- Vite `base` must be set to `/push_swap_visualizer/` so GitHub Pages asset paths resolve.
- Commit after every task. Do not skip git hooks or signing.

---

## File Structure

```
package.json
tsconfig.json
vite.config.ts
index.html
.github/workflows/deploy.yml
src/
  core/
    types.ts          # shared types: Op, OpToken, Stacks, ParseResult, Verdict, Grade
    parser.ts         # parseNumbers, parseOps
    engine.ts         # applyOp, Timeline (buildTimeline, stateAt)
    checker.ts        # check(final) -> OK/KO
    grader.ts         # grade(size, opCount) -> Grade
    generator.ts      # suggestSequence(size) -> number[]
    solver.ts         # solve(numbers) -> OpToken[]
  ui/
    i18n.ts           # string tables + t() + language state
    render.ts         # Canvas renderer (adaptive tiles/bars)
    animator.ts       # rAF loop, op transition interpolation
    controls.ts       # transport wiring + keyboard shortcuts
    panels.ts         # input forms, errors, verdict, metrics, grade gauge
    app.ts            # top-level wiring, mode switching
  main.ts             # entry point
  style.css
tests/
  core/
    parser.test.ts
    engine.test.ts
    checker.test.ts
    grader.test.ts
    generator.test.ts
    solver.test.ts
```

---

### Task 1: Project scaffold (Vite + TS + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `.gitignore`

**Interfaces:**
- Produces: a runnable Vite dev server and a working `npm test` (Vitest) command.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "push-swap-visualizer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/push_swap_visualizer/",
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Push-Swap Visualizer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.ts`**

```ts
const app = document.querySelector<HTMLDivElement>("#app");
if (app) app.textContent = "Push-Swap Visualizer";
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 7: Install and verify dev server + test runner**

Run: `npm install && npm run build`
Expected: build succeeds, `dist/` produced.

Run: `npx vitest run`
Expected: "No test files found" (exit 0) — runner works.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts .gitignore
git commit -m "chore: scaffold Vite + TS + Vitest project"
```

---

### Task 2: Core types

**Files:**
- Create: `src/core/types.ts`

**Interfaces:**
- Produces:
  - `type OpToken = "sa"|"sb"|"ss"|"ra"|"rb"|"rr"|"rra"|"rrb"|"rrr"|"pa"|"pb"`
  - `const OP_TOKENS: readonly OpToken[]`
  - `interface Stacks { a: number[]; b: number[] }` (index 0 = top of stack)
  - `interface ParseError { kind: "duplicate"|"non-integer"|"out-of-range"|"unknown-op"; token: string; line?: number }`
  - `type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ParseError[] }`
  - `interface Verdict { sorted: boolean; bEmpty: boolean; ok: boolean }`
  - `interface Grade { points: number; label: "outstanding"|"good"|"needs-work"|"fail"; applicable: boolean }`

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
export type OpToken =
  | "sa" | "sb" | "ss"
  | "ra" | "rb" | "rr"
  | "rra" | "rrb" | "rrr"
  | "pa" | "pb";

export const OP_TOKENS: readonly OpToken[] = [
  "sa", "sb", "ss", "ra", "rb", "rr", "rra", "rrb", "rrr", "pa", "pb",
];

// index 0 is the TOP of each stack
export interface Stacks {
  a: number[];
  b: number[];
}

export type ParseErrorKind =
  | "duplicate"
  | "non-integer"
  | "out-of-range"
  | "unknown-op";

export interface ParseError {
  kind: ParseErrorKind;
  token: string;
  line?: number;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ParseError[] };

export interface Verdict {
  sorted: boolean;
  bEmpty: boolean;
  ok: boolean;
}

export interface Grade {
  points: number; // 0..5
  label: "outstanding" | "good" | "needs-work" | "fail";
  applicable: boolean; // false when size is not near 100 or 500
}

export const INT_MIN = -2147483648;
export const INT_MAX = 2147483647;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add shared types"
```

---

### Task 3: Parser

**Files:**
- Create: `src/core/parser.ts`
- Test: `tests/core/parser.test.ts`

**Interfaces:**
- Consumes: `OpToken`, `OP_TOKENS`, `ParseResult`, `ParseError`, `INT_MIN`, `INT_MAX` from `src/core/types.ts`.
- Produces:
  - `parseNumbers(input: string): ParseResult<number[]>`
  - `parseOps(input: string): ParseResult<OpToken[]>`
  - `parseNumbers` splits on any whitespace; rejects non-integers, out-of-range, duplicates.
  - `parseOps` splits on any whitespace; rejects unknown tokens, attaches 1-based `line` (token index counted as line for newline-separated input).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseNumbers, parseOps } from "../../src/core/parser";

describe("parseNumbers", () => {
  it("parses space-separated integers", () => {
    const r = parseNumbers("4 2 1 3");
    expect(r).toEqual({ ok: true, value: [4, 2, 1, 3] });
  });

  it("parses newline-separated integers", () => {
    const r = parseNumbers("4\n2\n1");
    expect(r).toEqual({ ok: true, value: [4, 2, 1] });
  });

  it("rejects duplicates", () => {
    const r = parseNumbers("1 2 2");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].kind).toBe("duplicate");
  });

  it("rejects non-integers", () => {
    const r = parseNumbers("1 abc 3");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].kind).toBe("non-integer");
  });

  it("rejects out-of-range ints", () => {
    const r = parseNumbers("2147483648");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].kind).toBe("out-of-range");
  });

  it("accepts empty input as empty list", () => {
    expect(parseNumbers("   ")).toEqual({ ok: true, value: [] });
  });
});

describe("parseOps", () => {
  it("parses newline-separated ops", () => {
    const r = parseOps("pb\nra\nsa");
    expect(r).toEqual({ ok: true, value: ["pb", "ra", "sa"] });
  });

  it("rejects unknown op with line number", () => {
    const r = parseOps("pb\nxyz\nsa");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].kind).toBe("unknown-op");
      expect(r.errors[0].token).toBe("xyz");
      expect(r.errors[0].line).toBe(2);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/parser.test.ts`
Expected: FAIL — cannot find module `parser`.

- [ ] **Step 3: Write `src/core/parser.ts`**

```ts
import {
  type OpToken,
  type ParseResult,
  type ParseError,
  OP_TOKENS,
  INT_MIN,
  INT_MAX,
} from "./types";

export function parseNumbers(input: string): ParseResult<number[]> {
  const tokens = input.trim().split(/\s+/).filter((t) => t.length > 0);
  const errors: ParseError[] = [];
  const value: number[] = [];
  const seen = new Set<number>();

  tokens.forEach((token, i) => {
    if (!/^-?\d+$/.test(token)) {
      errors.push({ kind: "non-integer", token, line: i + 1 });
      return;
    }
    const n = Number(token);
    if (n < INT_MIN || n > INT_MAX) {
      errors.push({ kind: "out-of-range", token, line: i + 1 });
      return;
    }
    if (seen.has(n)) {
      errors.push({ kind: "duplicate", token, line: i + 1 });
      return;
    }
    seen.add(n);
    value.push(n);
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function parseOps(input: string): ParseResult<OpToken[]> {
  const tokens = input.trim().split(/\s+/).filter((t) => t.length > 0);
  const errors: ParseError[] = [];
  const value: OpToken[] = [];
  const valid = new Set<string>(OP_TOKENS);

  tokens.forEach((token, i) => {
    if (valid.has(token)) {
      value.push(token as OpToken);
    } else {
      errors.push({ kind: "unknown-op", token, line: i + 1 });
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/parser.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/parser.ts tests/core/parser.test.ts
git commit -m "feat(core): add input parser with validation"
```

---

### Task 4: Engine (applyOp + timeline)

**Files:**
- Create: `src/core/engine.ts`
- Test: `tests/core/engine.test.ts`

**Interfaces:**
- Consumes: `OpToken`, `Stacks` from `src/core/types.ts`.
- Produces:
  - `applyOp(stacks: Stacks, op: OpToken): void` — mutates stacks in place.
  - `class Timeline` constructed as `new Timeline(initialA: number[], ops: OpToken[])`.
    - `Timeline.length: number` — number of ops.
    - `Timeline.stateAt(index: number): Stacks` — state after applying `index` ops (index 0 = initial, deep-copied; index === length = final). Uses snapshots every 200 ops internally.
    - `Timeline.opAt(index: number): OpToken` — the op applied to go from state `index` to `index+1`.
  - Convention: index 0 = top of each stack. Initial stack A is `initialA` with index 0 = top.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { applyOp, Timeline } from "../../src/core/engine";
import type { Stacks } from "../../src/core/types";

const s = (a: number[], b: number[]): Stacks => ({ a: [...a], b: [...b] });

describe("applyOp", () => {
  it("sa swaps top two of a", () => {
    const st = s([1, 2, 3], []);
    applyOp(st, "sa");
    expect(st).toEqual(s([2, 1, 3], []));
  });

  it("pb moves top of a to top of b", () => {
    const st = s([1, 2], [9]);
    applyOp(st, "pb");
    expect(st).toEqual(s([2], [1, 9]));
  });

  it("pa moves top of b to top of a", () => {
    const st = s([2], [1, 9]);
    applyOp(st, "pa");
    expect(st).toEqual(s([1, 2], [9]));
  });

  it("ra rotates a up (top to bottom)", () => {
    const st = s([1, 2, 3], []);
    applyOp(st, "ra");
    expect(st).toEqual(s([2, 3, 1], []));
  });

  it("rra rotates a down (bottom to top)", () => {
    const st = s([1, 2, 3], []);
    applyOp(st, "rra");
    expect(st).toEqual(s([3, 1, 2], []));
  });

  it("ss swaps both", () => {
    const st = s([1, 2], [3, 4]);
    applyOp(st, "ss");
    expect(st).toEqual(s([2, 1], [4, 3]));
  });

  it("rr rotates both up", () => {
    const st = s([1, 2, 3], [4, 5, 6]);
    applyOp(st, "rr");
    expect(st).toEqual(s([2, 3, 1], [5, 6, 4]));
  });

  it("rrr rotates both down", () => {
    const st = s([1, 2, 3], [4, 5, 6]);
    applyOp(st, "rrr");
    expect(st).toEqual(s([3, 1, 2], [6, 4, 5]));
  });

  it("noops on empty/size-1 stacks", () => {
    const st = s([1], []);
    applyOp(st, "sa");
    applyOp(st, "ra");
    expect(st).toEqual(s([1], []));
  });
});

describe("Timeline", () => {
  it("stateAt(0) is the initial state", () => {
    const t = new Timeline([3, 1, 2], ["ra"]);
    expect(t.stateAt(0)).toEqual(s([3, 1, 2], []));
  });

  it("stateAt(length) is the final state", () => {
    const t = new Timeline([3, 1, 2], ["pb", "pb"]);
    expect(t.stateAt(t.length)).toEqual(s([2], [1, 3]));
  });

  it("stateAt is consistent across long runs with snapshots", () => {
    const ops = Array.from({ length: 500 }, () => "ra" as const);
    const t = new Timeline([1, 2, 3], ops);
    // 500 rotations of a 3-element stack returns to start (500 % 3 = 2 rotations net)
    expect(t.stateAt(3)).toEqual(s([1, 2, 3], []));
    expect(t.stateAt(500)).toEqual(t.stateAt(500 % 3 === 0 ? 0 : 500 % 3));
  });

  it("does not mutate returned states", () => {
    const t = new Timeline([1, 2], ["sa"]);
    const st = t.stateAt(0);
    st.a.push(99);
    expect(t.stateAt(0)).toEqual(s([1, 2], []));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/engine.test.ts`
Expected: FAIL — cannot find module `engine`.

- [ ] **Step 3: Write `src/core/engine.ts`**

```ts
import type { OpToken, Stacks } from "./types";

function swapTop(stack: number[]): void {
  if (stack.length >= 2) {
    [stack[0], stack[1]] = [stack[1], stack[0]];
  }
}

function rotateUp(stack: number[]): void {
  if (stack.length >= 2) {
    const top = stack.shift()!;
    stack.push(top);
  }
}

function rotateDown(stack: number[]): void {
  if (stack.length >= 2) {
    const bottom = stack.pop()!;
    stack.unshift(bottom);
  }
}

function push(from: number[], to: number[]): void {
  if (from.length > 0) {
    to.unshift(from.shift()!);
  }
}

export function applyOp(stacks: Stacks, op: OpToken): void {
  switch (op) {
    case "sa": swapTop(stacks.a); break;
    case "sb": swapTop(stacks.b); break;
    case "ss": swapTop(stacks.a); swapTop(stacks.b); break;
    case "ra": rotateUp(stacks.a); break;
    case "rb": rotateUp(stacks.b); break;
    case "rr": rotateUp(stacks.a); rotateUp(stacks.b); break;
    case "rra": rotateDown(stacks.a); break;
    case "rrb": rotateDown(stacks.b); break;
    case "rrr": rotateDown(stacks.a); rotateDown(stacks.b); break;
    case "pa": push(stacks.b, stacks.a); break;
    case "pb": push(stacks.a, stacks.b); break;
  }
}

const SNAPSHOT_INTERVAL = 200;

function cloneStacks(s: Stacks): Stacks {
  return { a: [...s.a], b: [...s.b] };
}

export class Timeline {
  readonly length: number;
  private readonly ops: OpToken[];
  private readonly snapshots: Stacks[]; // snapshots[k] = state after k*SNAPSHOT_INTERVAL ops

  constructor(initialA: number[], ops: OpToken[]) {
    this.ops = ops;
    this.length = ops.length;
    this.snapshots = [];
    const work: Stacks = { a: [...initialA], b: [] };
    this.snapshots.push(cloneStacks(work));
    for (let i = 0; i < ops.length; i++) {
      applyOp(work, ops[i]);
      if ((i + 1) % SNAPSHOT_INTERVAL === 0) {
        this.snapshots.push(cloneStacks(work));
      }
    }
  }

  stateAt(index: number): Stacks {
    const clamped = Math.max(0, Math.min(index, this.length));
    const snapIdx = Math.floor(clamped / SNAPSHOT_INTERVAL);
    const state = cloneStacks(this.snapshots[snapIdx]);
    const start = snapIdx * SNAPSHOT_INTERVAL;
    for (let i = start; i < clamped; i++) {
      applyOp(state, this.ops[i]);
    }
    return state;
  }

  opAt(index: number): OpToken {
    return this.ops[index];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/engine.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/engine.ts tests/core/engine.test.ts
git commit -m "feat(core): add engine with applyOp and Timeline"
```

---

### Task 5: Checker

**Files:**
- Create: `src/core/checker.ts`
- Test: `tests/core/checker.test.ts`

**Interfaces:**
- Consumes: `Stacks`, `Verdict` from `src/core/types.ts`.
- Produces: `check(final: Stacks): Verdict` — `ok` is true when A is ascending (index 0 top is smallest) and B is empty.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { check } from "../../src/core/checker";

describe("check", () => {
  it("OK when a sorted ascending and b empty", () => {
    expect(check({ a: [1, 2, 3], b: [] })).toEqual({
      sorted: true, bEmpty: true, ok: true,
    });
  });

  it("KO when a not sorted", () => {
    const v = check({ a: [2, 1, 3], b: [] });
    expect(v.ok).toBe(false);
    expect(v.sorted).toBe(false);
  });

  it("KO when b not empty even if a sorted", () => {
    const v = check({ a: [1, 2], b: [3] });
    expect(v.ok).toBe(false);
    expect(v.bEmpty).toBe(false);
  });

  it("OK for empty a and empty b", () => {
    expect(check({ a: [], b: [] }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/checker.test.ts`
Expected: FAIL — cannot find module `checker`.

- [ ] **Step 3: Write `src/core/checker.ts`**

```ts
import type { Stacks, Verdict } from "./types";

export function check(final: Stacks): Verdict {
  const { a, b } = final;
  let sorted = true;
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] > a[i + 1]) {
      sorted = false;
      break;
    }
  }
  const bEmpty = b.length === 0;
  return { sorted, bEmpty, ok: sorted && bEmpty };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/checker.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/checker.ts tests/core/checker.test.ts
git commit -m "feat(core): add checker for OK/KO verdict"
```

---

### Task 6: Grader

**Files:**
- Create: `src/core/grader.ts`
- Test: `tests/core/grader.test.ts`

**Interfaces:**
- Consumes: `Grade` from `src/core/types.ts`.
- Produces: `grade(size: number, opCount: number): Grade`.
  - For size ≈ 100 (band 81–120) use the 100-tier thresholds; for size ≈ 500 (band 400–600) use the 500-tier. Otherwise `applicable: false`.
  - 100-tier point bands by op count: `<700`→5, `<800`→4, `<900`→3, `<1000`→2, `<1100`→1, else 0.
  - 500-tier point bands: `<5500`→5, `<7000`→4, `<8500`→3, `<10000`→2, `<11500`→1, else 0.
  - Label: 5→"outstanding", 3–4→"good", 1–2→"needs-work", 0→"fail".

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { grade } from "../../src/core/grader";

describe("grade", () => {
  it("outstanding for 100 numbers under 700 ops", () => {
    const g = grade(100, 650);
    expect(g.points).toBe(5);
    expect(g.label).toBe("outstanding");
    expect(g.applicable).toBe(true);
  });

  it("1 point for 100 numbers just under 1100", () => {
    expect(grade(100, 1099).points).toBe(1);
  });

  it("fail for 100 numbers at/over 1100", () => {
    const g = grade(100, 1100);
    expect(g.points).toBe(0);
    expect(g.label).toBe("fail");
  });

  it("outstanding for 500 numbers under 5500", () => {
    expect(grade(500, 5000).points).toBe(5);
  });

  it("needs-work for 500 numbers around 10000-11500", () => {
    expect(grade(500, 11000).label).toBe("needs-work");
  });

  it("not applicable for sizes far from 100 or 500", () => {
    expect(grade(5, 12).applicable).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/grader.test.ts`
Expected: FAIL — cannot find module `grader`.

- [ ] **Step 3: Write `src/core/grader.ts`**

```ts
import type { Grade } from "./types";

function bandToGrade(points: number): Grade {
  let label: Grade["label"];
  if (points === 5) label = "outstanding";
  else if (points >= 3) label = "good";
  else if (points >= 1) label = "needs-work";
  else label = "fail";
  return { points, label, applicable: true };
}

function pointsFor(opCount: number, thresholds: number[]): number {
  // thresholds ascending; points = 5 for below first, decreasing by one each band
  for (let i = 0; i < thresholds.length; i++) {
    if (opCount < thresholds[i]) return 5 - i;
  }
  return 0;
}

export function grade(size: number, opCount: number): Grade {
  if (size >= 81 && size <= 120) {
    return bandToGrade(pointsFor(opCount, [700, 800, 900, 1000, 1100]));
  }
  if (size >= 400 && size <= 600) {
    return bandToGrade(pointsFor(opCount, [5500, 7000, 8500, 10000, 11500]));
  }
  return { points: 0, label: "fail", applicable: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/grader.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/grader.ts tests/core/grader.test.ts
git commit -m "feat(core): add 42 grade verdict"
```

---

### Task 7: Generator (suggest sequence)

**Files:**
- Create: `src/core/generator.ts`
- Test: `tests/core/generator.test.ts`

**Interfaces:**
- Produces: `suggestSequence(size: number, rng?: () => number): number[]` — returns `size` unique integers `0..size-1` shuffled (Fisher–Yates). `rng` defaults to `Math.random`, injectable for deterministic tests.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { suggestSequence } from "../../src/core/generator";

describe("suggestSequence", () => {
  it("returns the requested count", () => {
    expect(suggestSequence(100).length).toBe(100);
  });

  it("returns unique values", () => {
    const seq = suggestSequence(50);
    expect(new Set(seq).size).toBe(50);
  });

  it("returns empty for size 0", () => {
    expect(suggestSequence(0)).toEqual([]);
  });

  it("is deterministic with an injected rng", () => {
    const rng = () => 0; // always picks index 0 in the swap
    expect(suggestSequence(3, rng)).toEqual(suggestSequence(3, rng));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/generator.test.ts`
Expected: FAIL — cannot find module `generator`.

- [ ] **Step 3: Write `src/core/generator.ts`**

```ts
export function suggestSequence(
  size: number,
  rng: () => number = Math.random,
): number[] {
  const arr = Array.from({ length: Math.max(0, size) }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/generator.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/generator.ts tests/core/generator.test.ts
git commit -m "feat(core): add sequence generator"
```

---

### Task 8: Solver

**Files:**
- Create: `src/core/solver.ts`
- Test: `tests/core/solver.test.ts`

**Interfaces:**
- Consumes: `OpToken`, `Stacks` from `src/core/types.ts`; `applyOp` from `src/core/engine.ts`; `check` from `src/core/checker.ts`.
- Produces: `solve(numbers: number[]): OpToken[]` — returns ops that sort the input ascending into A. Uses a chunk-based insertion: push all to B in value-ranked chunks, then push back selecting the max, rotating optimally. Must be **correct** for any input (verified by replaying ops through `applyOp` and `check`). Op-count quality is secondary.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { solve } from "../../src/core/solver";
import { applyOp } from "../../src/core/engine";
import { check } from "../../src/core/checker";
import { suggestSequence } from "../../src/core/generator";
import type { Stacks } from "../../src/core/types";

function runSolved(numbers: number[]) {
  const ops = solve(numbers);
  const st: Stacks = { a: [...numbers], b: [] };
  for (const op of ops) applyOp(st, op);
  return { ops, verdict: check(st) };
}

describe("solve", () => {
  it("returns no ops for empty input", () => {
    expect(solve([])).toEqual([]);
  });

  it("returns no ops for single element", () => {
    expect(solve([42])).toEqual([]);
  });

  it("sorts a small already-sorted list to OK with zero ops", () => {
    const { ops, verdict } = runSolved([1, 2, 3]);
    expect(verdict.ok).toBe(true);
    expect(ops.length).toBe(0);
  });

  it("sorts a small reversed list", () => {
    expect(runSolved([3, 2, 1]).verdict.ok).toBe(true);
  });

  it("sorts a 100-element shuffle correctly", () => {
    const rng = (() => { let s = 42; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const nums = suggestSequence(100, rng);
    expect(runSolved(nums).verdict.ok).toBe(true);
  });

  it("sorts a list with negative numbers", () => {
    expect(runSolved([-5, 3, -1, 0, 2]).verdict.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/solver.test.ts`
Expected: FAIL — cannot find module `solver`.

- [ ] **Step 3: Write `src/core/solver.ts`**

```ts
import type { OpToken, Stacks } from "./types";
import { applyOp } from "./engine";

// Chunk-based sort: assign each value a rank (0..n-1), push to B in chunks,
// then push back the highest-rank element each time to build A ascending.
export function solve(numbers: number[]): OpToken[] {
  if (numbers.length <= 1) return [];

  // already sorted? no-op
  const sortedAlready = numbers.every((v, i) => i === 0 || numbers[i - 1] <= v);
  if (sortedAlready) return [];

  const ops: OpToken[] = [];
  const st: Stacks = { a: [...numbers], b: [] };
  const emit = (op: OpToken) => {
    ops.push(op);
    applyOp(st, op);
  };

  // rank map: value -> index in ascending order (0 = smallest)
  const ranked = [...numbers].sort((x, y) => x - y);
  const rankOf = new Map<number, number>();
  ranked.forEach((v, i) => rankOf.set(v, i));

  const n = numbers.length;
  const chunkSize = n > 100 ? Math.ceil(n / 14) : Math.max(1, Math.ceil(n / 5));

  // Phase 1: push everything to B in chunks, keeping B roughly value-ordered.
  let pushed = 0;
  let target = 0;
  while (st.a.length > 0) {
    const topRank = rankOf.get(st.a[0])!;
    if (topRank < target + chunkSize) {
      emit("pb");
      // keep small ranks deeper: if just-pushed is in lower half of the chunk, rotate b
      if (rankOf.get(st.b[0])! < target + Math.floor(chunkSize / 2)) {
        emit("rb");
      }
      pushed++;
      if (pushed % chunkSize === 0) target += chunkSize;
    } else {
      emit("ra");
    }
  }

  // Phase 2: push back from B, always bringing the current max rank to top of B.
  while (st.b.length > 0) {
    // find position of max rank in B
    let maxPos = 0;
    let maxRank = -1;
    for (let i = 0; i < st.b.length; i++) {
      const r = rankOf.get(st.b[i])!;
      if (r > maxRank) {
        maxRank = r;
        maxPos = i;
      }
    }
    // rotate B to bring maxPos to top, choosing shorter direction
    if (maxPos <= st.b.length - maxPos) {
      for (let i = 0; i < maxPos; i++) emit("rb");
    } else {
      for (let i = 0; i < st.b.length - maxPos; i++) emit("rrb");
    }
    emit("pa");
  }

  return ops;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/solver.test.ts`
Expected: PASS (all). If correctness fails, fix the algorithm — correctness is mandatory, op-count quality is not.

- [ ] **Step 5: Commit**

```bash
git add src/core/solver.ts tests/core/solver.test.ts
git commit -m "feat(core): add chunk-based solver"
```

---

### Task 9: i18n

**Files:**
- Create: `src/ui/i18n.ts`

**Interfaces:**
- Produces:
  - `type Lang = "pt" | "en"`
  - `let currentLang: Lang` (default `"pt"`), `setLang(l: Lang): void`, `getLang(): Lang`
  - `t(key: keyof typeof strings.pt): string` — returns the string for the current language.
  - `strings` object with `pt` and `en` records sharing identical keys.
  - Keys (at minimum): `title`, `mode_visualizer`, `mode_solver`, `mode_interpreter`, `coming_soon`, `numbers_label`, `ops_label`, `suggest`, `run`, `play`, `pause`, `reset`, `step_fwd`, `step_back`, `speed`, `verdict_ok`, `verdict_ko`, `total_ops`, `grade_outstanding`, `grade_good`, `grade_needs_work`, `grade_fail`, `err_duplicate`, `err_non_integer`, `err_out_of_range`, `err_unknown_op`.

- [ ] **Step 1: Write `src/ui/i18n.ts`**

```ts
export type Lang = "pt" | "en";

export const strings = {
  pt: {
    title: "Visualizador Push-Swap",
    mode_visualizer: "Visualizador",
    mode_solver: "Solver",
    mode_interpreter: "Interpretador",
    coming_soon: "em breve",
    numbers_label: "Números",
    ops_label: "Operações",
    suggest: "Sugerir sequência",
    run: "Executar",
    play: "Play",
    pause: "Pausar",
    reset: "Reiniciar",
    step_fwd: "Avançar",
    step_back: "Voltar",
    speed: "Velocidade",
    verdict_ok: "OK",
    verdict_ko: "KO",
    total_ops: "Total de operações",
    grade_outstanding: "excelente",
    grade_good: "bom",
    grade_needs_work: "precisa melhorar",
    grade_fail: "reprovado",
    err_duplicate: "número duplicado",
    err_non_integer: "não é um inteiro",
    err_out_of_range: "fora do intervalo de int",
    err_unknown_op: "operação inválida",
  },
  en: {
    title: "Push-Swap Visualizer",
    mode_visualizer: "Visualizer",
    mode_solver: "Solver",
    mode_interpreter: "Interpreter",
    coming_soon: "coming soon",
    numbers_label: "Numbers",
    ops_label: "Operations",
    suggest: "Suggest sequence",
    run: "Run",
    play: "Play",
    pause: "Pause",
    reset: "Reset",
    step_fwd: "Step forward",
    step_back: "Step back",
    speed: "Speed",
    verdict_ok: "OK",
    verdict_ko: "KO",
    total_ops: "Total operations",
    grade_outstanding: "outstanding",
    grade_good: "good",
    grade_needs_work: "needs work",
    grade_fail: "fail",
    err_duplicate: "duplicate number",
    err_non_integer: "not an integer",
    err_out_of_range: "out of int range",
    err_unknown_op: "invalid operation",
  },
} as const;

export type StringKey = keyof typeof strings.pt;

let currentLang: Lang = "pt";

export function setLang(l: Lang): void {
  currentLang = l;
}

export function getLang(): Lang {
  return currentLang;
}

export function t(key: StringKey): string {
  return strings[currentLang][key];
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/i18n.ts
git commit -m "feat(ui): add i18n string tables (PT-BR default, EN)"
```

---

### Task 10: Canvas renderer (adaptive)

**Files:**
- Create: `src/ui/render.ts`

**Interfaces:**
- Consumes: `Stacks` from `src/core/types.ts`.
- Produces:
  - `interface RenderOptions { tileThreshold?: number }` (default 25).
  - `class StackRenderer` constructed `new StackRenderer(canvas: HTMLCanvasElement, opts?: RenderOptions)`.
    - `render(stacks: Stacks, valueRange: { min: number; max: number }): void` — draws A on the left half, B on the right half. Uses numbered tiles when the larger stack ≤ `tileThreshold`, else bars with height ∝ value. Color hue maps value across `[min,max]`.
    - `resize(): void` — syncs canvas backing store to its CSS size and device pixel ratio.

- [ ] **Step 1: Write `src/ui/render.ts`**

```ts
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
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/render.ts
git commit -m "feat(ui): add adaptive canvas renderer"
```

---

### Task 11: Animator (rAF transitions)

**Files:**
- Create: `src/ui/animator.ts`

**Interfaces:**
- Consumes: `Timeline` from `src/core/engine.ts`; `StackRenderer` from `src/ui/render.ts`.
- Produces:
  - `class Animator` constructed `new Animator(timeline: Timeline, renderer: StackRenderer, valueRange: {min:number;max:number}, onFrame: (index: number) => void)`.
    - `play(): void`, `pause(): void`, `reset(): void`.
    - `stepForward(): void`, `stepBack(): void`.
    - `seek(index: number): void` — jump to op index, render, fire `onFrame`.
    - `setSpeed(opsPerSecond: number): void`.
    - `get index(): number`, `get playing(): boolean`.
  - For v1, transitions render the discrete `stateAt(index)` each step (snap). Per-op tween interpolation is a deferred enhancement; the `onFrame` callback drives the op counter/scrubber. (This keeps the animator correct and testable; smoothing is additive later.)

- [ ] **Step 1: Write `src/ui/animator.ts`**

```ts
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
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/animator.ts
git commit -m "feat(ui): add rAF animator with transport + seek"
```

---

### Task 12: Panels (inputs, errors, verdict, metrics)

**Files:**
- Create: `src/ui/panels.ts`

**Interfaces:**
- Consumes: `ParseError` from `src/core/types.ts`; `Verdict`, `Grade` from `src/core/types.ts`; `t`, `StringKey` from `src/ui/i18n.ts`.
- Produces:
  - `formatError(e: ParseError): string` — localized message like `linha 12: 'xyz' operação inválida` using `t()`.
  - `renderVerdict(el: HTMLElement, v: Verdict): void` — sets OK/KO badge text + class.
  - `renderMetrics(el: HTMLElement, opCount: number, breakdown: Record<string, number>, grade: Grade): void` — total ops, per-op breakdown, and grade gauge text (only shows grade when `grade.applicable`).
  - `breakdownOf(ops: string[]): Record<string, number>` — counts per op token.

- [ ] **Step 1: Write `src/ui/panels.ts`**

```ts
import type { ParseError, Verdict, Grade } from "../core/types";
import { t } from "./i18n";

export function breakdownOf(ops: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const op of ops) counts[op] = (counts[op] ?? 0) + 1;
  return counts;
}

export function formatError(e: ParseError): string {
  const keyByKind = {
    duplicate: "err_duplicate",
    "non-integer": "err_non_integer",
    "out-of-range": "err_out_of_range",
    "unknown-op": "err_unknown_op",
  } as const;
  const where = e.line !== undefined ? `linha ${e.line}: ` : "";
  return `${where}'${e.token}' ${t(keyByKind[e.kind])}`;
}

export function renderVerdict(el: HTMLElement, v: Verdict): void {
  el.textContent = v.ok ? t("verdict_ok") : t("verdict_ko");
  el.className = v.ok ? "verdict ok" : "verdict ko";
}

const gradeKey = {
  outstanding: "grade_outstanding",
  good: "grade_good",
  "needs-work": "grade_needs_work",
  fail: "grade_fail",
} as const;

export function renderMetrics(
  el: HTMLElement,
  opCount: number,
  breakdown: Record<string, number>,
  grade: Grade,
): void {
  const parts: string[] = [];
  parts.push(`${t("total_ops")}: ${opCount}`);
  const bd = Object.entries(breakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([op, n]) => `${op}:${n}`)
    .join("  ");
  if (bd) parts.push(bd);
  if (grade.applicable) {
    parts.push(`${grade.points}/5 — ${t(gradeKey[grade.label])}`);
  }
  el.innerHTML = parts.map((p) => `<div>${p}</div>`).join("");
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/panels.ts
git commit -m "feat(ui): add panels for errors, verdict, metrics"
```

---

### Task 13: Controls (transport wiring + keyboard)

**Files:**
- Create: `src/ui/controls.ts`

**Interfaces:**
- Consumes: `Animator` from `src/ui/animator.ts`.
- Produces:
  - `interface ControlRefs { play: HTMLButtonElement; pauseLabel?: never; reset: HTMLButtonElement; stepBack: HTMLButtonElement; stepFwd: HTMLButtonElement; speed: HTMLInputElement; scrubber: HTMLInputElement; counter: HTMLElement }`
  - `wireControls(animator: Animator, refs: ControlRefs, totalOps: number, opLabelAt: (i: number) => string): () => void` — binds button clicks, speed slider, scrubber input, and keyboard shortcuts (←/→ step, space play/pause). Updates scrubber + counter via the animator's `onFrame`. Returns a cleanup function that removes the keyboard listener.

- [ ] **Step 1: Write `src/ui/controls.ts`**

```ts
import type { Animator } from "./animator";

export interface ControlRefs {
  play: HTMLButtonElement;
  reset: HTMLButtonElement;
  stepBack: HTMLButtonElement;
  stepFwd: HTMLButtonElement;
  speed: HTMLInputElement;
  scrubber: HTMLInputElement;
  counter: HTMLElement;
}

export function wireControls(
  animator: Animator,
  refs: ControlRefs,
  totalOps: number,
  opLabelAt: (i: number) => string,
): () => void {
  refs.scrubber.min = "0";
  refs.scrubber.max = String(totalOps);
  refs.scrubber.value = "0";

  const updateUi = (index: number) => {
    refs.scrubber.value = String(index);
    refs.play.textContent = animator.playing ? "⏸" : "▶";
    refs.counter.textContent =
      index >= totalOps
        ? `op ${index} / ${totalOps}`
        : `op ${index + 1} / ${totalOps}: ${opLabelAt(index)}`;
  };

  // animator was constructed with an onFrame that calls this via app wiring;
  // here we also refresh on direct control actions.
  const refresh = () => updateUi(animator.index);

  refs.play.addEventListener("click", () => {
    if (animator.playing) animator.pause();
    else animator.play();
    refresh();
  });
  refs.reset.addEventListener("click", () => {
    animator.reset();
    refresh();
  });
  refs.stepFwd.addEventListener("click", () => {
    animator.stepForward();
    refresh();
  });
  refs.stepBack.addEventListener("click", () => {
    animator.stepBack();
    refresh();
  });
  refs.speed.addEventListener("input", () => {
    animator.setSpeed(Number(refs.speed.value));
  });
  refs.scrubber.addEventListener("input", () => {
    animator.seek(Number(refs.scrubber.value));
    refresh();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
      return;
    }
    if (e.key === "ArrowRight") { animator.stepForward(); refresh(); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { animator.stepBack(); refresh(); e.preventDefault(); }
    else if (e.key === " ") {
      if (animator.playing) animator.pause(); else animator.play();
      refresh();
      e.preventDefault();
    }
  };
  window.addEventListener("keydown", onKey);

  updateUi(0);
  return () => window.removeEventListener("keydown", onKey);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/controls.ts
git commit -m "feat(ui): add transport controls + keyboard shortcuts"
```

---

### Task 14: App wiring + styles + entry

**Files:**
- Create: `src/ui/app.ts`, `src/style.css`
- Modify: `src/main.ts`, `index.html`

**Interfaces:**
- Consumes: everything from core + ui.
- Produces: `mountApp(root: HTMLElement): void` — builds the DOM (top bar with title, language toggle, mode switch; left input panel; center canvas + transport; right metrics panel), wires Run for both Visualizer and Solver modes, shows localized parse errors, builds a `Timeline`, constructs `StackRenderer` + `Animator`, calls `wireControls`. Interpreter button is rendered disabled with the `coming_soon` suffix.

- [ ] **Step 1: Write `src/ui/app.ts`**

```ts
import { parseNumbers, parseOps } from "../core/parser";
import { Timeline } from "../core/engine";
import { check } from "../core/checker";
import { grade } from "../core/grader";
import { suggestSequence } from "../core/generator";
import { solve } from "../core/solver";
import type { OpToken } from "../core/types";
import { StackRenderer } from "./render";
import { Animator } from "./animator";
import { wireControls } from "./controls";
import { formatError, renderVerdict, renderMetrics, breakdownOf } from "./panels";
import { t, setLang, getLang, type Lang } from "./i18n";

type Mode = "visualizer" | "solver";

export function mountApp(root: HTMLElement): void {
  let mode: Mode = "visualizer";
  let cleanupControls: (() => void) | null = null;

  const render = () => {
    root.innerHTML = "";
    root.appendChild(buildLayout());
  };

  function buildLayout(): HTMLElement {
    const el = document.createElement("div");
    el.className = "layout";
    el.innerHTML = `
      <header class="topbar">
        <h1>${t("title")}</h1>
        <nav class="modes">
          <button data-mode="visualizer" class="${mode === "visualizer" ? "active" : ""}">${t("mode_visualizer")}</button>
          <button data-mode="solver" class="${mode === "solver" ? "active" : ""}">${t("mode_solver")}</button>
          <button disabled title="${t("coming_soon")}">${t("mode_interpreter")} (${t("coming_soon")})</button>
        </nav>
        <button id="langToggle">${getLang() === "pt" ? "EN" : "PT"}</button>
      </header>
      <main class="main">
        <section class="inputs">
          <label>${t("numbers_label")}</label>
          <textarea id="numbers" rows="3"></textarea>
          <div class="suggest-row">
            <select id="size"><option>3</option><option>5</option><option selected>100</option><option>500</option></select>
            <button id="suggest">${t("suggest")}</button>
          </div>
          <div id="opsBlock" style="${mode === "solver" ? "display:none" : ""}">
            <label>${t("ops_label")}</label>
            <textarea id="ops" rows="6"></textarea>
          </div>
          <button id="run">${t("run")}</button>
          <div id="errors" class="errors"></div>
        </section>
        <section class="stage">
          <canvas id="canvas"></canvas>
          <div class="transport">
            <button id="reset">⏮</button>
            <button id="stepBack">◀</button>
            <button id="play">▶</button>
            <button id="stepFwd">▶▶</button>
            <input id="speed" type="range" min="1" max="200" value="8" />
            <input id="scrubber" type="range" min="0" max="0" value="0" />
            <span id="counter" class="counter"></span>
          </div>
        </section>
        <aside class="metrics">
          <div id="verdict" class="verdict"></div>
          <div id="metricsBody"></div>
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
    el.querySelector("#run")!.addEventListener("click", () => run(el));

    return el;
  }

  function run(el: HTMLElement): void {
    const errorsEl = el.querySelector("#errors") as HTMLElement;
    errorsEl.innerHTML = "";

    const numbersRaw = (el.querySelector("#numbers") as HTMLTextAreaElement).value;
    const numbersResult = parseNumbers(numbersRaw);
    if (!numbersResult.ok) {
      errorsEl.innerHTML = numbersResult.errors.map((e) => `<div>${formatError(e)}</div>`).join("");
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
        errorsEl.innerHTML = opsResult.errors.map((e) => `<div>${formatError(e)}</div>`).join("");
        return;
      }
      ops = opsResult.value;
    }

    const timeline = new Timeline(numbers, ops);
    const min = numbers.length ? Math.min(...numbers) : 0;
    const max = numbers.length ? Math.max(...numbers) : 1;

    const canvas = el.querySelector("#canvas") as HTMLCanvasElement;
    const renderer = new StackRenderer(canvas);
    window.addEventListener("resize", () => renderer.resize());

    const counter = el.querySelector("#counter") as HTMLElement;
    const scrubber = el.querySelector("#scrubber") as HTMLInputElement;
    const animator = new Animator(timeline, renderer, { min, max }, (index) => {
      scrubber.value = String(index);
      counter.textContent =
        index >= timeline.length
          ? `op ${index} / ${timeline.length}`
          : `op ${index + 1} / ${timeline.length}: ${timeline.opAt(index)}`;
    });

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

    const finalState = timeline.stateAt(timeline.length);
    renderVerdict(el.querySelector("#verdict") as HTMLElement, check(finalState));
    renderMetrics(
      el.querySelector("#metricsBody") as HTMLElement,
      ops.length,
      breakdownOf(ops),
      grade(numbers.length, ops.length),
    );
  }

  render();
}
```

- [ ] **Step 2: Write `src/style.css`**

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #11141a; color: #e6e6e6; }
.layout { height: 100vh; display: flex; flex-direction: column; }
.topbar { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem; background: #1a1f29; }
.topbar h1 { font-size: 1rem; margin: 0; flex: 0 0 auto; }
.modes { display: flex; gap: 0.25rem; }
.modes button, .topbar #langToggle { background: #232a36; color: #cfd6e4; border: 1px solid #313a4a; padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; }
.modes button.active { background: #3b82f6; color: white; }
.modes button[disabled] { opacity: 0.5; cursor: not-allowed; }
#langToggle { margin-left: auto; }
.main { flex: 1; display: grid; grid-template-columns: 280px 1fr 280px; min-height: 0; }
.inputs, .metrics { padding: 1rem; overflow: auto; background: #161b23; }
.inputs textarea { width: 100%; background: #0e1117; color: #e6e6e6; border: 1px solid #313a4a; border-radius: 6px; font-family: monospace; }
.inputs label { display: block; margin: 0.5rem 0 0.25rem; font-size: 0.85rem; color: #9aa6ba; }
.suggest-row { display: flex; gap: 0.5rem; margin: 0.5rem 0; }
.inputs #run { width: 100%; margin-top: 0.75rem; background: #22c55e; color: #03210f; border: none; padding: 0.5rem; border-radius: 6px; font-weight: 700; cursor: pointer; }
.errors { color: #f87171; margin-top: 0.75rem; font-size: 0.85rem; }
.stage { display: flex; flex-direction: column; min-height: 0; }
#canvas { flex: 1; width: 100%; min-height: 0; background: #0b0e13; }
.transport { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #161b23; }
.transport button { background: #232a36; color: #cfd6e4; border: 1px solid #313a4a; border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer; }
.transport #scrubber { flex: 1; }
.counter { font-family: monospace; font-size: 0.85rem; color: #9aa6ba; white-space: nowrap; }
.verdict { font-weight: 800; font-size: 1.5rem; padding: 0.5rem; border-radius: 6px; text-align: center; }
.verdict.ok { background: #14532d; color: #4ade80; }
.verdict.ko { background: #4c1d1d; color: #f87171; }
#metricsBody { margin-top: 1rem; font-family: monospace; font-size: 0.85rem; line-height: 1.6; }
```

- [ ] **Step 3: Replace `src/main.ts`**

```ts
import "./style.css";
import { mountApp } from "./ui/app";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) mountApp(root);
```

- [ ] **Step 4: Build and manually verify**

Run: `npm run build`
Expected: `tsc --noEmit` passes, Vite build succeeds.

Run: `npm run dev`, open the local URL. Manually verify:
- Visualizer: paste `4 2 1 3` and ops `pb\npb\nra\npa\npa`, click Run → animation plays, OK/KO badge shows, op counter advances, scrubber + arrow keys + space work.
- Solver: pick size 100, Suggest, switch to Solver, Run → animation plays, verdict OK, metrics show 5/5 or a grade.
- Language toggle flips PT/EN.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app.ts src/style.css src/main.ts
git commit -m "feat(ui): wire app layout, modes, and playback"
```

---

### Task 15: GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: a workflow that builds on push to `main` and publishes `dist/` to GitHub Pages.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the build command the workflow runs**

Run locally: `npm ci && npm test && npm run build`
Expected: tests pass, build produces `dist/`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deployment workflow"
```

- [ ] **Step 4: Push and enable Pages (manual, one-time)**

After pushing to GitHub: Settings → Pages → Source = "GitHub Actions". The app deploys at `https://<user>.github.io/push_swap_visualizer/`.

---

## Self-Review

**Spec coverage:**
- Static client-side app, Vanilla TS + Vite → Task 1. ✓
- Core/UI separation → Tasks 2–8 (core), 9–14 (ui); enforced by Global Constraints. ✓
- Parser with all 4 error kinds, space/newline → Task 3. ✓
- Engine state machine + timeline with snapshots → Task 4. ✓
- Checker OK/KO → Task 5. ✓
- Grader (100 & 500 thresholds, labels) → Task 6. ✓
- Generator (suggest) → Task 7. ✓
- Solver (built-in sort) → Task 8. ✓
- i18n PT-BR default + EN → Task 9. ✓
- Adaptive hybrid rendering (tiles/bars, hue) → Task 10. ✓
- Animation rAF loop, transport, op counter → Tasks 11, 13. ✓ (per-op tween deferred, noted explicitly)
- Layout: top bar/modes/interpreter em breve, left inputs, center canvas, right metrics → Task 14. ✓
- Visualizer + Solver modes, Interpreter disabled → Task 14. ✓
- Validation up front + OK/KO after playback → Tasks 12, 14. ✓
- 42 grade gauge in metrics → Tasks 12, 14. ✓
- Vitest tests on core → Tasks 3–8. ✓
- GitHub Actions → Pages, base path → Tasks 1, 15. ✓

**Placeholder scan:** No TBD/TODO; all code steps contain full code. The per-op tween is explicitly scoped out of v1 (a deliberate decision, not a placeholder).

**Type consistency:** `Stacks` (a/b, index 0 = top) consistent across engine/checker/render/animator. `Timeline.stateAt/opAt/length` used consistently in animator/app/controls. `Grade`/`Verdict`/`ParseError` shapes consistent across grader/checker/parser/panels. `OpToken` used uniformly. `t(key)`/`StringKey` consistent in panels/app.

Note: per-op smooth tweening (visual polish) is intentionally deferred; v1 renders discrete states per step, which satisfies all correctness/feature requirements.
