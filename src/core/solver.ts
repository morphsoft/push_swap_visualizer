import type { OpToken, Stacks } from "./types";
import { applyOp } from "./engine";

// Chunk-based sort: assign each value a rank (0..n-1), push to B in chunks,
// then push back the highest-rank element each time to build A ascending.
export function solve(numbers: number[]): OpToken[] {
  if (numbers.length <= 1) return [];

  // already sorted? no-op
  const sortedAlready = numbers.every((v, i) => i === 0 || numbers[i - 1] <= v);
  if (sortedAlready) return [];

  const ops: OpToken[] = [];
  const st: Stacks = { a: [...numbers], b: [] };
  const emit = (op: OpToken) => {
    ops.push(op);
    applyOp(st, op);
  };

  // rank map: value -> index in ascending order (0 = smallest)
  const ranked = [...numbers].sort((x, y) => x - y);
  const rankOf = new Map<number, number>();
  ranked.forEach((v, i) => rankOf.set(v, i));

  const n = numbers.length;
  const chunkSize = n > 100 ? Math.ceil(n / 14) : Math.max(1, Math.ceil(n / 5));

  // Phase 1: push everything to B in chunks, keeping B roughly value-ordered.
  // We iterate through all elements; for each top of A, if its rank falls in
  // the current chunk window, push it to B (and rotate B if it's in the lower
  // half of the chunk so higher-ranked items stay on top). Otherwise rotate A.
  let pushed = 0;
  let target = 0;
  // Safety cap: each element requires at most n rotations of A, so max ops is O(n^2)
  const maxRotations = n * n + n;
  let rotations = 0;
  while (st.a.length > 0) {
    if (rotations > maxRotations) break; // safety escape
    const topRank = rankOf.get(st.a[0])!;
    if (topRank < target + chunkSize) {
      emit("pb");
      // keep small ranks deeper: if just-pushed is in lower half of the chunk, rotate b
      if (rankOf.get(st.b[0])! < target + Math.floor(chunkSize / 2)) {
        emit("rb");
      }
      pushed++;
      if (pushed % chunkSize === 0) target += chunkSize;
    } else {
      emit("ra");
      rotations++;
    }
  }

  // Phase 2: push back from B, always bringing the current max rank to top of B.
  while (st.b.length > 0) {
    // find position of max rank in B
    let maxPos = 0;
    let maxRank = -1;
    for (let i = 0; i < st.b.length; i++) {
      const r = rankOf.get(st.b[i])!;
      if (r > maxRank) {
        maxRank = r;
        maxPos = i;
      }
    }
    // rotate B to bring maxPos to top, choosing shorter direction
    if (maxPos <= st.b.length - maxPos) {
      for (let i = 0; i < maxPos; i++) emit("rb");
    } else {
      for (let i = 0; i < st.b.length - maxPos; i++) emit("rrb");
    }
    emit("pa");
  }

  return ops;
}
