import { describe, it, expect } from "vitest";
import { tileRowHeight } from "../../src/ui/render";

describe("tileRowHeight", () => {
  it("caps the row height for few items (no giant slabs)", () => {
    // 600px / 2 items = 300px each — must be capped well below that
    expect(tileRowHeight(2, 600)).toBe(64);
    expect(tileRowHeight(3, 600)).toBe(64);
  });

  it("uses the full per-item share when many items", () => {
    expect(tileRowHeight(100, 600)).toBe(6); // 600/100 < 64, not capped
  });

  it("returns 0 for no items", () => {
    expect(tileRowHeight(0, 600)).toBe(0);
  });

  it("never exceeds the available height for a single item", () => {
    // a single item in a short canvas should not overflow it
    expect(tileRowHeight(1, 40)).toBe(40);
  });
});
