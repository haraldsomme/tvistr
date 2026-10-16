// «Lignende saker i Forbrukerklageutvalget» (artifact simHTML): the counted figures for the buyer's
// first category with enough decisions, and the three closest decisions with medhold. The cards are not
// links: the decisions' text reaches the buyer only in the letter, after payment.
import type { ReactNode } from "react";
import { cap, tall } from "@/lib/app/format";
import type { Tallblokk, Vedtakskort } from "@/lib/vurdering/vurdering";
import { Hake } from "./ikoner";

const UTFALL = ["heving", "prisavslag", "retting", "erstatning"] as const;

export function Lignende({ tall: blokker, kort, sammenligning, brukes, fot }: { tall: Tallblokk[]; kort: Vedtakskort[]; sammenligning: string | null; brukes?: number | null; fot: ReactNode }) {
  const b = blokker.find((x) => x.tall);
  if (!b && !kort.length) return null;
  const t = b?.tall;
  const deler = t ? UTFALL.filter((k) => t[k] > 0) : [];
  return (
    <section className="sim" aria-label="Lignende saker i Forbrukerklageutvalget">
      <h3 className="sec-h">Lignende saker i Forbrukerklageutvalget</h3>
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
            Utvalget har behandlet {tall(t.saker)} saker om {b.tema} i brukte biler kjøpt fra forhandler. I {tall(t.medhold)} av dem fikk kjøperen medhold.
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
              const meta = [k.somDenEr ? "«som den er»" : "", k.km !== null ? `${tall(k.km)} km` : ""].filter(Boolean).join(" · ");
              return (
                <div key={k.id} className="sim-c">
                  <div className="sim-c-h">
                    <b>{k.bil}</b>
                    <span className="sim-o">{k.fikk[0] ? cap(k.fikk[0]) : "Medhold"}</span>
                  </div>
                  {meta && <div className="sim-c-m">{meta}</div>}
                  <div className="sim-c-f">
                    <span className="sim-chip">
                      Sak {k.saksnummer}
                      {k.ar && ` · ${k.ar}`}
                    </span>
                    {brukes === k.id && <span className="sim-use">Brukes i brevet</span>}
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
