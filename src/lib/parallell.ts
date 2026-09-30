// Runs `fn` over `items` with at most `n` in flight. Stops starting new work once `stopp()` is true.
export async function kjorParallelt<T>(
  items: T[],
  n: number,
  fn: (item: T, i: number) => Promise<void>,
  stopp: () => boolean = () => false,
): Promise<void> {
  let neste = 0;
  const arbeider = async () => {
    while (neste < items.length && !stopp()) {
      const i = neste++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, arbeider));
}
