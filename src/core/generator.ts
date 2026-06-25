export function suggestSequence(
  size: number,
  rng: () => number = Math.random,
): number[] {
  const arr = Array.from({ length: Math.max(0, size) }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
