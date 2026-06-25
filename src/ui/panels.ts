import type { ParseError, Verdict, Grade } from "../core/types";
import { t } from "./i18n";

export function breakdownOf(ops: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const op of ops) counts[op] = (counts[op] ?? 0) + 1;
  return counts;
}

export function formatError(e: ParseError): string {
  const keyByKind = {
    duplicate: "err_duplicate",
    "non-integer": "err_non_integer",
    "out-of-range": "err_out_of_range",
    "unknown-op": "err_unknown_op",
  } as const;
  const where = e.line !== undefined ? `linha ${e.line}: ` : "";
  return `${where}'${e.token}' ${t(keyByKind[e.kind])}`;
}

export function renderVerdict(el: HTMLElement, v: Verdict): void {
  el.textContent = v.ok ? t("verdict_ok") : t("verdict_ko");
  el.className = v.ok ? "verdict ok" : "verdict ko";
}

const gradeKey = {
  outstanding: "grade_outstanding",
  good: "grade_good",
  "needs-work": "grade_needs_work",
  fail: "grade_fail",
} as const;

export function renderMetrics(
  el: HTMLElement,
  opCount: number,
  breakdown: Record<string, number>,
  grade: Grade,
): void {
  const parts: string[] = [];
  parts.push(`${t("total_ops")}: ${opCount}`);
  const bd = Object.entries(breakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([op, n]) => `${op}:${n}`)
    .join("  ");
  if (bd) parts.push(bd);
  if (grade.applicable) {
    parts.push(`${grade.points}/5 — ${t(gradeKey[grade.label])}`);
  }
  el.innerHTML = parts.map((p) => `<div>${p}</div>`).join("");
}
