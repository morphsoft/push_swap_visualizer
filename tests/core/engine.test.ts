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
