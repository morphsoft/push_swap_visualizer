import type { Stacks, Verdict } from "./types";

export function check(final: Stacks): Verdict {
  const { a, b } = final;
  let sorted = true;
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] > a[i + 1]) {
      sorted = false;
      break;
    }
  }
  const bEmpty = b.length === 0;
  return { sorted, bEmpty, ok: sorted && bEmpty };
}
