// Server-action calls from the browser that may fail on the network: a failure becomes a message the
// page shows.
type Svar = { ok: boolean };
type Feil = { ok: false; melding: string };

export const trygt = <T extends Svar>(p: Promise<T>, melding: string): Promise<T | Feil> => p.catch(() => ({ ok: false as const, melding }));
