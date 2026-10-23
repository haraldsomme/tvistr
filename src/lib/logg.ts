// An error as one log line without personal data: Drizzle puts the query's parameters (the whole form
// on a save) in the message after «params:», so that part is cut, here and in the cause.
const kutt = (m: string) => m.split("\nparams:")[0];
export function feiltekst(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  return e.cause instanceof Error ? `${kutt(e.message)} ← ${kutt(e.cause.message)}` : kutt(e.message);
}
