// The letter from the server (brevet-actions.ts) as the answers change: fetched 300 ms after the last
// change of `nokkel`, only the latest request's answer applies, and a failed call keeps the last good
// letter with the failure's message. While the latest call for the current answers has failed, the
// same call is tried again every 5 s, until one succeeds or the answers change.
import { useEffect, useRef, useState } from "react";
import type { Blokk } from "@/lib/app/brevtyper";
import { trygt } from "@/lib/app/kall";
import { sisteVinner } from "@/lib/app/siste";

type Svar<T> = ({ ok: true; blokker: Blokk[] } & T) | { ok: false; melding: string };
type Tilstand<T> = { blokker: Blokk[] | null; svar: T | null; feil: string | null; nokkel: string | null };

const PROV_IGJEN_MS = 5000;

// The state after an answer for `nokkel`: a good one replaces the letter, a failure keeps it.
export function etterSvar<T>(f: Tilstand<T>, r: Svar<T>, nokkel: string): Tilstand<T> {
  return r.ok ? { blokker: r.blokker, svar: r, feil: null, nokkel } : { ...f, feil: r.melding, nokkel };
}

// How long to wait before trying the same call again: only while the latest answer for the current
// answers was a failure.
export function provIgjenOm(t: { feil: string | null; nokkel: string | null }, nokkel: string): number | null {
  return t.feil !== null && t.nokkel === nokkel ? PROV_IGJEN_MS : null;
}

export function useBrev<T>(hent: () => Promise<Svar<T>>, nokkel: string): { blokker: Blokk[] | null; svar: T | null; feil: string | null; venter: boolean } {
  const [siste] = useState(sisteVinner);
  const [t, settT] = useState<Tilstand<T>>({ blokker: null, svar: null, feil: null, nokkel: null });
  // Bumped to make the same call again after a failure.
  const [forsok, settForsok] = useState(0);
  // The call as of the latest render, so a new closure alone does not fetch again.
  const hentNa = useRef(hent);
  useEffect(() => {
    hentNa.current = hent;
  });
  useEffect(() => {
    const tid = setTimeout(() => {
      const n = siste.start();
      trygt(hentNa.current(), "Vi fikk ikke kontakt. Prøv igjen.").then((r) => {
        if (siste.gjelder(n)) settT((f) => etterSvar(f, r, nokkel));
      });
    }, 300);
    return () => clearTimeout(tid);
  }, [nokkel, forsok, siste]);
  // Each failure (a new `t`) schedules one retry; a change of answers or unmounting cancels it.
  const vent = provIgjenOm(t, nokkel);
  useEffect(() => {
    if (vent === null) return;
    const tid = setTimeout(() => settForsok((n) => n + 1), vent);
    return () => clearTimeout(tid);
  }, [vent, t]);
  return { blokker: t.blokker, svar: t.svar, feil: t.feil, venter: t.nokkel !== nokkel };
}
