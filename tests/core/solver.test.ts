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
