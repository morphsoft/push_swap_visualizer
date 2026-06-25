export type OpToken =
  | "sa" | "sb" | "ss"
  | "ra" | "rb" | "rr"
  | "rra" | "rrb" | "rrr"
  | "pa" | "pb";

export const OP_TOKENS: readonly OpToken[] = [
  "sa", "sb", "ss", "ra", "rb", "rr", "rra", "rrb", "rrr", "pa", "pb",
];

// index 0 is the TOP of each stack
export interface Stacks {
  a: number[];
  b: number[];
}

export type ParseErrorKind =
  | "duplicate"
  | "non-integer"
  | "out-of-range"
  | "unknown-op";

export interface ParseError {
  kind: ParseErrorKind;
  token: string;
  line?: number;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ParseError[] };

export interface Verdict {
  sorted: boolean;
  bEmpty: boolean;
  ok: boolean;
}

export interface Grade {
  points: number; // 0..5
  label: "outstanding" | "good" | "needs-work" | "fail";
  applicable: boolean; // false when size is not near 100 or 500
}

export const INT_MIN = -2147483648;
export const INT_MAX = 2147483647;
