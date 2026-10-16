// «Dette sier loven om din sak»: one row per factor of the verdict (artifact lawHTML). In the writer each
// row can link to the step that changes it.
import type { Faktor } from "@/lib/app/vurdering";
import { Faktorikon } from "./ikoner";

export function Lovrader({ faktorer, endre }: { faktorer: Faktor[]; endre?: (f: Faktor) => void }) {
  if (!faktorer.length) return null;
  return (
    <section className="lawsec" aria-label="Dette sier loven om din sak">
      <h3 className="sec-h">Dette sier loven om din sak</h3>
      <div className="facs">
        {faktorer.map((f) => (
          <div key={f.t} className={`fac fac-${f.s}`}>
            <span className={`fi ${f.s}`}>
              <Faktorikon s={f.s} />
            </span>
            <div className="fac-b">
              <div className="fac-t">{f.t}</div>
              <p>{f.d}</p>
              {f.law && <span className="tag law">{f.law.replace(/^forbrkjl\./, "Forbrukerkjøpsloven")}</span>}
            </div>
            {endre && (
              <button type="button" className="lnk" onClick={() => endre(f)} aria-label={`Endre: ${f.t}`}>
                Endre
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
