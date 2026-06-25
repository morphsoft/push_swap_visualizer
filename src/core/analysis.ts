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
