// The writer's Vurdering tab (artifact renderCase): the verdict on the writer's answers, updated as they
// change, with «Endre» links to the step, and «Lignende saker» from the database.
import { useEffect, useState } from "react";
import { Info } from "@/app/deler/ikoner";
import { Lignende } from "@/app/deler/lignende";
import { Lovrader } from "@/app/deler/lovrader";
import { type Lignende as LignendeSvar, vurderSaken } from "@/app/sak/vurdering";
import { nokkel, tilSvar } from "@/lib/app/saken";
import type { Skjema } from "@/lib/app/skjema";
import type { Resultat } from "@/lib/app/vurdering";
import { stegFor } from "./steg";


// «Lignende saker» for the writer's answers, fetched again (debounced) only when they change.
export function useLignende(s: Skjema): LignendeSvar | null {
  const [svar, settSvar] = useState<LignendeSvar | null>(null);
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

export function Vurderingsfane({ s, r, lignende, brukes, onSteg, onBrevet, onSkjema }: { s: Skjema; r: Resultat; lignende: LignendeSvar | null; brukes: number | null; onSteg: (i: number) => void; onBrevet: () => void; onSkjema: () => void }) {
  const mangler = !s.f_known || !s.c_delivery || !s.f_found;
  return (
    <section className="wcase" role="tabpanel" aria-label="Vurdering">
      <div className="head">
        <h2>Hvor sterk er saken din?</h2>
        <p>Vurderingen oppdateres når du endrer svarene i skjemaet. Trykk «Endre» for å gå rett til det som påvirker den.</p>
      </div>
      <div className={`cp t-${r.tier}`}>
        <div className="cp-top">
          <span className="vbadge">
            <i />
            {r.badge}
          </span>
          <span className="cp-live">
            <i />
            Oppdateres mens du skriver
          </span>
        </div>
        <h3>{r.title}</h3>
        {r.tier === "ukjent" ? (
          <p className="cp-p">{r.summary}</p>
        ) : (
          <div className="m3" aria-hidden="true">
            <div className="m3-bar">
              <span />
              <span />
              <span />
              <i style={{ left: r.pos }} />
            </div>
            <div className="m3-l">
              <span>Svak</span>
              <span>Usikker</span>
              <span>Sterk</span>
            </div>
          </div>
        )}
        {mangler && (
          <div className="cp-hint">
            <Info />
            <span>{!s.c_delivery || !s.f_found ? "Legg inn overtakelsesdato og når du oppdaget feilen" : "Svar på om du visste om feilen da du kjøpte bilen"} for en sikrere vurdering.</span>
            <button type="button" className="lnk" onClick={() => onSteg(stegFor(!s.c_delivery ? "Datoene mangler" : "Feilen var ukjent ved kjøpet"))}>
              Fyll inn
            </button>
          </div>
        )}
      </div>
      <Lovrader faktorer={r.factors} endre={(f) => onSteg(stegFor(f.t))} />
      {lignende?.ok && (
        <Lignende
          tall={lignende.tall}
          kort={lignende.kort}
          sammenligning={lignende.sammenligning}
          brukes={brukes}
          fot={
            <>
              {s.prec_on ? "Brevet viser til saken du har valgt, og forklarer hvorfor du har krav på samme resultat." : "Du har slått av henvisningen til en lignende sak i brevet."}{" "}
              <button type="button" className="lnk" onClick={onBrevet}>
                Se brevet
              </button>
            </>
          }
        />
      )}
      <div className="wcase-cta">
        <button type="button" className="btn gh" onClick={onSkjema}>
          Til skjemaet
        </button>
        <button type="button" className="btn pri" onClick={onBrevet}>
          Se brevet
        </button>
      </div>
    </section>
  );
}
