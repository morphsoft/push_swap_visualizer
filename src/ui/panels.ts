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
  const where = e.line !== undefined ? `${t("line_prefix")} ${e.line}: ` : "";
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
  el.replaceChildren();
  for (const p of parts) {
    const div = document.createElement("div");
    div.textContent = p;
    el.appendChild(div);
  }
}

function gradeLabel(grade: Grade): string {
  return t(gradeKey[grade.label]);
}

export function renderExtraMetrics(
  el: HTMLElement,
  info: {
    opCount: number;
    efficiencyPct: number;
    theoretical: number;
    maxBDepth: number;
    grade: Grade;
  },
): void {
  el.replaceChildren();
  const rows: string[] = [];
  rows.push(`${t("total_ops")}: ${info.opCount}`);
  if (info.theoretical > 0) {
    rows.push(
      `${t("efficiency")}: ${info.efficiencyPct}% ` +
        `(${info.opCount}/${info.theoretical} ${t("theoretical")})`,
    );
  }
  rows.push(`${t("max_b_depth")}: ${info.maxBDepth}`);
  if (info.grade.applicable) {
    rows.push(`${info.grade.points}/5 — ${gradeLabel(info.grade)}`);
  }
  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "metric-row";
    div.textContent = r;
    el.appendChild(div);
  }
}

export function renderOpChart(
  el: HTMLElement,
  breakdown: Record<string, number>,
): void {
  el.replaceChildren();
  const title = document.createElement("div");
  title.className = "chart-title";
  title.textContent = t("op_breakdown");
  el.appendChild(title);

  const entries = Object.entries(breakdown).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const maxN = entries.reduce((m, [, n]) => Math.max(m, n), 1);
  for (const [op, n] of entries) {
    const row = document.createElement("div");
    row.className = "op-row";
    const label = document.createElement("span");
    label.className = "op-label";
    label.textContent = op;
    const track = document.createElement("div");
    track.className = "op-track";
    const bar = document.createElement("div");
    bar.className = "op-bar";
    bar.style.width = `${(n / maxN) * 100}%`;
    const count = document.createElement("span");
    count.className = "op-count";
    count.textContent = String(n);
    track.appendChild(bar);
    row.append(label, track, count);
    el.appendChild(row);
  }
}

export function renderThresholdGauge(
  el: HTMLElement,
  size: number,
  opCount: number,
  grade: Grade,
): void {
  el.replaceChildren();
  if (!grade.applicable) {
    const note = document.createElement("div");
    note.className = "gauge-note";
    note.textContent = t("not_graded");
    el.appendChild(note);
    return;
  }
  const bands = size <= 120
    ? [700, 800, 900, 1000, 1100]
    : [5500, 7000, 8500, 10000, 11500];
  const scale = bands[bands.length - 1] * 1.1;

  const track = document.createElement("div");
  track.className = "gauge-track";
  for (const b of bands) {
    const tick = document.createElement("div");
    tick.className = "gauge-tick";
    tick.style.left = `${(b / scale) * 100}%`;
    tick.title = String(b);
    track.appendChild(tick);
  }
  const marker = document.createElement("div");
  marker.className = `gauge-marker grade-${grade.label}`;
  marker.style.left = `${(Math.min(opCount, scale) / scale) * 100}%`;
  track.appendChild(marker);
  el.appendChild(track);

  const caption = document.createElement("div");
  caption.className = "gauge-caption";
  caption.textContent = `${opCount} — ${grade.points}/5 ${gradeLabel(grade)}`;
  el.appendChild(caption);
}

export function renderProgress(
  el: HTMLElement,
  stepIndex: number,
  total: number,
  sortednessPct: number,
): void {
  el.replaceChildren();
  const text = document.createElement("div");
  text.className = "progress-text";
  text.textContent =
    `${t("progress")}: ${stepIndex}/${total} · ` +
    `${t("sortedness")}: ${sortednessPct}%`;
  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = total > 0 ? `${(stepIndex / total) * 100}%` : "0%";
  track.appendChild(fill);
  el.append(text, track);
}
