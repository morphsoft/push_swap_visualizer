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
