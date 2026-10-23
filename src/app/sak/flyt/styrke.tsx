// «Styrken på saken» (mockup): the verdict's level, one bar from Krever mer to Sterk sak with a marker
// for the strength (none before there is a verdict, `styrke`), how many rows speak for the buyer, and
// the rows when open.
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Lovrader } from "@/app/deler/lovrader";
import { type Faktor, type Resultat, styrke } from "@/lib/app/vurdering";

export function Styrke({ r, apen, onEndre }: { r: Resultat; apen: boolean; onEndre?: (f: Faktor) => void }) {
  const gode = r.factors.filter((f) => f.s === "good").length;
  const linje = r.tier === "ukjent" || !r.factors.length ? r.summary : `${gode} av ${r.factors.length} punkter taler for deg.`;
  const x = styrke(r);
  // The marker pulses while it moves, so an answer that changes the strength is seen.
  const forrige = useRef(x);
  const [flytter, settFlytter] = useState(false);
  useEffect(() => {
    const fra = forrige.current;
    forrige.current = x;
    if (fra === null || x === null || fra === x) return;
    settFlytter(true);
    const t = setTimeout(() => settFlytter(false), 700);
    return () => clearTimeout(t);
  }, [x]);
  return (
    <section className="fl-styrke" aria-label="Styrken på saken">
      <div className="fl-styrke-h">
        <span>Styrken på saken</span>
        <span className="fl-niva" data-niva={r.tier}>
          {r.badge}
        </span>
      </div>
      <div className="fl-maal" data-tom={x === null || undefined} aria-hidden="true">
        {x !== null && <span data-flytter={flytter || undefined} style={{ "--x": `${(x * 100).toFixed(1)}%` } as CSSProperties} />}
      </div>
      <p className="fl-styrke-l">{linje}</p>
      {apen && <Lovrader faktorer={r.factors} endre={onEndre} />}
    </section>
  );
}
