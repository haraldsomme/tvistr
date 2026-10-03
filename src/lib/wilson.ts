// 95 % Wilson interval for a proportion; honest for small groups.
export function wilson(vunnet: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = vunnet / n;
  const d = 1 + (z * z) / n;
  const senter = (p + (z * z) / (2 * n)) / d;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, senter - margin), Math.min(1, senter + margin)];
}
