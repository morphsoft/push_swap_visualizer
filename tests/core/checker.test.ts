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
