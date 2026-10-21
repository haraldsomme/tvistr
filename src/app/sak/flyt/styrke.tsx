// «Styrken på saken» (mockup): the verdict's level, one bar segment per factor of `evaluate` in its
// colour, how many of them speak for the buyer, and the factor rows when open.
import { Lovrader } from "@/app/deler/lovrader";
import type { Faktor, Resultat } from "@/lib/app/vurdering";

export function Styrke({ r, apen, onEndre }: { r: Resultat; apen: boolean; onEndre?: (f: Faktor) => void }) {
  const gode = r.factors.filter((f) => f.s === "good").length;
  const linje = r.tier === "ukjent" || !r.factors.length ? r.summary : `${gode} av ${r.factors.length} punkter taler for deg.`;
  return (
    <section className="fl-styrke" aria-label="Styrken på saken">
      <div className="fl-styrke-h">
        <span>Styrken på saken</span>
        <span className="fl-niva" data-niva={r.tier}>
          {r.badge}
        </span>
      </div>
      {r.factors.length > 0 && (
        <div className="fl-segs" aria-hidden="true">
          {r.factors.map((f) => (
            <span key={f.t} data-s={f.s} />
          ))}
        </div>
      )}
      <p className="fl-styrke-l">{linje}</p>
      {apen && <Lovrader faktorer={r.factors} endre={onEndre} />}
    </section>
  );
}
