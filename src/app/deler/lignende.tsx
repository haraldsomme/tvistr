// «Lignende saker i klageutvalgene» (artifact simHTML): all decided dealer cases first, then the
// counted figures for the buyer's first category with enough decisions, and the three closest
// decisions with medhold. Medhold is full or partial, by one definition (statistikk.ts). The cards are not
// links: the decisions' text reaches the buyer only in the letter, after payment.
import type { ReactNode } from "react";
import { cap, tall } from "@/lib/app/format";
import { sakTekst } from "@/lib/app/saken";
import type { Overskrift, Tallblokk, Vedtakskort } from "@/lib/vurdering/vurdering";
import { Hake } from "./ikoner";

const UTFALL = ["heving", "prisavslag", "retting", "erstatning"] as const;

export function Lignende({
  overskrift,
  tall: blokker,
  kort,
  sammenligning,
  brukes,
  fot,
}: {
  overskrift?: Overskrift | null;
  tall: Tallblokk[];
  kort: Vedtakskort[];
  sammenligning: string | null;
  // The decisions the letter cites (one per fault), marked on their cards.
  brukes?: readonly number[];
  fot: ReactNode;
}) {
  const b = blokker.find((x) => x.tall);
  if (!b && !kort.length) return null;
  const t = b?.tall;
  const deler = t ? UTFALL.filter((k) => t[k] > 0) : [];
  return (
    <section className="sim" aria-label="Lignende saker i klageutvalgene">
      <h3 className="sec-h">Lignende saker i klageutvalgene</h3>
      {overskrift && (
        <p className="sim-lede">
          Av {tall(overskrift.saker)} saker der forhandleren ikke ga seg og saken endte med vedtak i Forbrukerklageutvalget, fikk kjøperen helt eller delvis medhold i {tall(overskrift.medhold)}.
        </p>
      )}
      {b && t && (
        <div className="sim-card">
          <div className="sim-n">
            <b>{tall(t.medhold)}</b>
            <span>
              av {tall(t.saker)} saker
              <br />
              med medhold
            </span>
          </div>
          <p className="sim-lede">
            Utvalget har behandlet {tall(t.saker)} saker om {b.tema} i brukte biler kjøpt fra forhandler. I {tall(t.medhold)} av dem fikk kjøperen helt eller delvis medhold.
          </p>
          <p className="fine" style={{ margin: 0 }}>
            Tallene gjelder saker som endte med vedtak. Hver sak vurderes konkret.
          </p>
          {deler.length > 0 && (
            <>
              <div className="sim-bar" role="img" aria-label={deler.map((k) => `${cap(k)} ${t[k]}`).join(", ")}>
                {deler.map((k, i) => (
                  <i key={k} className={`o${i}`} style={{ flex: t[k] }} />
                ))}
              </div>
              <div className="sim-leg">
                {deler.map((k, i) => (
                  <span key={k}>
                    <i className={`o${i}`} />
                    {cap(k)} {tall(t[k])}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {kort.length > 0 && (
        <>
          <div className="sec-k">Saker som ligner din</div>
          <div className="sim-cases">
            {kort.map((k) => {
              const meta = [k.feil ? cap(k.feil) : "", k.somDenEr ? "«som den er»" : "", k.km !== null ? `${tall(k.km)} km` : ""].filter(Boolean).join(" · ");
              return (
                <div key={k.id} className="sim-c">
                  <div className="sim-c-h">
                    <b>{k.bil}</b>
                    <span className="sim-o">{k.fikk[0] ? cap(k.fikk[0]) : "Medhold"}</span>
                  </div>
                  {meta && <div className="sim-c-m">{meta}</div>}
                  <div className="sim-c-f">
                    <span className="sim-chip">{sakTekst(k.saksnummer, k.ar)}</span>
                    {brukes?.includes(k.id) && <span className="sim-use">Brukes i brevet</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {sammenligning && (
        <div className="sim-cmp">
          <span className="sim-ck">
            <Hake />
          </span>
          {sammenligning}
        </div>
      )}
      <div className="sim-foot">{fot}</div>
    </section>
  );
}
