// Requests whose answers may come back out of order: only the one started last applies.
export function sisteVinner(): { start(): number; gjelder(n: number): boolean } {
  let siste = 0;
  return { start: () => ++siste, gjelder: (n) => n === siste };
}
