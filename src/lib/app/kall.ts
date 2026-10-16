// Server-action calls from the browser that may fail on the network: a failure becomes a message the
// page shows, and only successful answers are kept for reuse.
type Svar = { ok: boolean };
type Feil = { ok: false; melding: string };

export const trygt = <T extends Svar>(p: Promise<T>, melding: string): Promise<T | Feil> => p.catch(() => ({ ok: false as const, melding }));

const minne = new Map<string, Promise<Svar>>();
// One call per key in this page session; a failed or rejected call is forgotten so the next try calls again.
export function husk<T extends Svar>(nokkel: string, kall: () => Promise<T>, melding: string): Promise<T | Feil> {
  if (!minne.has(nokkel))
    minne.set(
      nokkel,
      trygt(kall(), melding).then((s) => {
        if (!s.ok) minne.delete(nokkel);
        return s;
      }),
    );
  return minne.get(nokkel)! as Promise<T | Feil>;
}
