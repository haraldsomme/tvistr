// Runs `fn` over `items` with at most `n` in flight.
export async function kjorParallelt<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let neste = 0;
  const arbeider = async () => {
    while (neste < items.length) {
      const i = neste++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, arbeider));
}
