// «Lignende saker» for the paid case's answers (vurderSaken), fetched again (debounced) only when what
// the cards depend on changes.
import { useEffect, useState } from "react";
import { type Lignende, vurderSaken } from "@/app/sak/vurdering";
import { nokkel, tilSvar } from "@/lib/app/saken";
import type { Skjema } from "@/lib/app/skjema";

export function useLignende(s: Skjema): Lignende | null {
  const [svar, settSvar] = useState<Lignende | null>(null);
  // Only what the cards depend on: a description typed in the form does not fetch them again.
  const fullt = tilSvar(s);
  const t = fullt && { ...fullt, krav: null, feil: fullt.feil.map((f) => ({ ...f, beskrivelse: null })) };
  const n = nokkel(t);
  useEffect(() => {
    if (!t) return;
    let gjeldende = true;
    const tid = setTimeout(() => vurderSaken(t).then((x) => gjeldende && settSvar(x)), 600);
    return () => {
      gjeldende = false;
      clearTimeout(tid);
    };
    // `n` stands for `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return t ? svar : null;
}
