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
