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
    expect(efficiencyPct(bound, 100)).toBe(100);
    expect(efficiencyPct(bound * 2, 100)).toBe(50);
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
