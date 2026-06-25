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
