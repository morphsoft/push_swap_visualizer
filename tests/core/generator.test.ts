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
