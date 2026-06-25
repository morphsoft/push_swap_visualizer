import {
  type OpToken,
  type ParseResult,
  type ParseError,
  OP_TOKENS,
  INT_MIN,
  INT_MAX,
} from "./types";

export function parseNumbers(input: string): ParseResult<number[]> {
  const tokens = input.trim().split(/\s+/).filter((t) => t.length > 0);
  const errors: ParseError[] = [];
  const value: number[] = [];
  const seen = new Set<number>();

  tokens.forEach((token, i) => {
    if (!/^-?\d+$/.test(token)) {
      errors.push({ kind: "non-integer", token, line: i + 1 });
      return;
    }
    const n = Number(token);
    if (n < INT_MIN || n > INT_MAX) {
      errors.push({ kind: "out-of-range", token, line: i + 1 });
      return;
    }
    if (seen.has(n)) {
      errors.push({ kind: "duplicate", token, line: i + 1 });
      return;
    }
    seen.add(n);
    value.push(n);
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function parseOps(input: string): ParseResult<OpToken[]> {
  const tokens = input.trim().split(/\s+/).filter((t) => t.length > 0);
  const errors: ParseError[] = [];
  const value: OpToken[] = [];
  const valid = new Set<string>(OP_TOKENS);

  tokens.forEach((token, i) => {
    if (valid.has(token)) {
      value.push(token as OpToken);
    } else {
      errors.push({ kind: "unknown-op", token, line: i + 1 });
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
