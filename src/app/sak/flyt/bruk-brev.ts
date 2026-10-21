// The letter from the server (brevet-actions.ts) as the answers change: fetched 300 ms after the last
// change of `nokkel`, only the latest request's answer applies, and a failed call keeps the last good
// letter with the failure's message.
import { useEffect, useRef, useState } from "react";
import type { Blokk } from "@/lib/app/brevtyper";
import { trygt } from "@/lib/app/kall";
import { sisteVinner } from "@/lib/app/siste";

type Svar<T> = ({ ok: true; blokker: Blokk[] } & T) | { ok: false; melding: string };
type Tilstand<T> = { blokker: Blokk[] | null; svar: T | null; feil: string | null; nokkel: string | null };

export function useBrev<T>(hent: () => Promise<Svar<T>>, nokkel: string): { blokker: Blokk[] | null; svar: T | null; feil: string | null; venter: boolean } {
  const [siste] = useState(sisteVinner);
  const [t, settT] = useState<Tilstand<T>>({ blokker: null, svar: null, feil: null, nokkel: null });
  // The call as of the latest render, so a new closure alone does not fetch again.
  const hentNa = useRef(hent);
  useEffect(() => {
    hentNa.current = hent;
  });
  useEffect(() => {
    const tid = setTimeout(() => {
      const n = siste.start();
      trygt(hentNa.current(), "Vi fikk ikke kontakt. Prøv igjen.").then((r) => {
        if (!siste.gjelder(n)) return;
        settT((f) => (r.ok ? { blokker: r.blokker, svar: r, feil: null, nokkel } : { ...f, feil: r.melding, nokkel }));
      });
    }, 300);
    return () => clearTimeout(tid);
  }, [nokkel, siste]);
  return { blokker: t.blokker, svar: t.svar, feil: t.feil, venter: t.nokkel !== nokkel };
}
