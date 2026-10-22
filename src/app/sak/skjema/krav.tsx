// «Hva krever du?» (asked by the page): the claim, the alternative and expenses.
import type { ReactNode } from "react";
import { Kravikon, Lukk, Pluss, Trekant } from "@/app/deler/ikoner";
import { regler } from "@/lib/app/lov";
import { tall } from "@/lib/app/format";
import { Felt, Kortliste, type StegProps, Vis } from "./felt";

const KRAV = [
  ["retting", "Retting", "Forhandleren reparerer feilen uten kostnad for deg"],
  ["prisavslag", "Prisavslag", "Du beholder bilen og får igjen et beløp som svarer til verdiforskjellen"],
  ["heving", "Heving", "Du leverer bilen tilbake og får kjøpesummen tilbake"],
] as const;
// The claim if the repair does not succeed: the two that follow retting, or none.
const ALTERNATIV = [
  ["heving", "Heving", "Du leverer bilen tilbake og får kjøpesummen tilbake"],
  ["prisavslag", "Prisavslag", "Du beholder bilen og får igjen et beløp som svarer til verdiforskjellen"],
  ["ingen", "Ingenting mer", "Brevet krever bare retting"],
] as const;

// One part of the claim under its own heading, as the other screens ask.
function Del({ tittel, hint, children }: { tittel: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="f" style={{ marginTop: 22 }}>
      <span className="lb">
        {tittel}
      </span>
      {hint && (
        <span className="hint" style={{ margin: "-2px 0 8px" }}>
          {hint}
        </span>
      )}
      {children}
    </div>
  );
}

// The repair attempts as the law counts them: one is enough to refuse more from 2024, two before.
// An older «2» or «3+» shows as «to ganger eller flere».
const FORSOK = [
  ["0", "Nei"],
  ["1", "Ja, én gang"],
  ["2+", "Ja, to ganger eller flere"],
] as const;

export function Krav({ s, sett }: StegProps) {
  const L = regler(s.c_purchase || s.c_delivery);
  const sum = s.exp.reduce((a, x) => a + (+x.a || 0), 0);
  const settUtgift = (i: number, p: Partial<{ t: string; a: number }>) => sett({ exp: s.exp.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const heving = s.k_main === "heving" || (s.k_main === "retting" && s.k_alt === "heving");
  const forsok = s.k_forsok === "2" || s.k_forsok === "3+" ? "2+" : s.k_forsok;
  // One container: the screen's gap would otherwise stand for each hidden part.
  return (
    <div>
      <Kortliste navn="Hva krever du?" verdi={s.k_main} valg={KRAV} onVelg={(k_main) => sett({ k_main })} ikon={(v) => <Kravikon id={v} />} />
      <Vis pa={s.k_main === "retting"}>
        <Del tittel="Hvis rettingen ikke lykkes, krever jeg">
          <Kortliste navn="Hvis rettingen ikke lykkes, krever jeg" verdi={s.k_alt} valg={ALTERNATIV} onVelg={(k_alt) => sett({ k_alt })} ikon={(v) => <Kravikon id={v} />} />
        </Del>
      </Vis>
      <Vis pa={s.k_main === "prisavslag"}>
        <div className="grid" style={{ marginTop: 22 }}>
          <Felt s={s} sett={sett} k="k_amount" label="Hvor stort prisavslag krever du?" fmt="num" inputMode="numeric" placeholder="35 000" suffiks="kr" hint="Prisavslaget skal svare til verdiforskjellen mellom bilen med og uten mangelen. Hva det koster å rette feilen, er et godt utgangspunkt." />
        </div>
      </Vis>
      {/* Whether the seller has lost the right to repair (§ 30): for a claim that comes after repair. */}
      <Vis pa={s.k_main === "prisavslag" || heving}>
        <Del
          tittel="Har forhandleren forsøkt å rette feilen uten å lykkes?"
          hint={L.versjon === "før_2024" ? "For kjøp før 2024 har forhandleren normalt to forsøk på å rette samme feil." : "Etter ett mislykket forsøk kan du normalt avvise flere og gå videre til prisavslag eller heving."}
        >
          <Kortliste navn="Har forhandleren forsøkt å rette feilen uten å lykkes?" verdi={forsok} valg={FORSOK} onVelg={(k_forsok) => sett({ k_forsok })} />
        </Del>
        <Vis pa={s.k_main === "heving" && (s.k_forsok === "" || s.k_forsok === "0")}>
          <div className="note warn" style={{ marginTop: 14 }}>
            <Trekant />
            <div>
              <b>Heving krever at mangelen ikke er uvesentlig.</b> Har forhandleren ikke fått forsøke å rette feilen, er det ofte klokest å kreve retting og sette heving som subsidiært krav.
            </div>
          </div>
        </Vis>
      </Vis>
      {/* For heving the letter sets the cost against the price (§ 32, not insignificant). */}
      <Vis pa={heving}>
        <div className="grid" style={{ marginTop: 22 }}>
          <Felt s={s} sett={sett} k="k_cost" label={<>Hva koster det å rette feilen? <em>valgfritt</em></>} fmt="num" inputMode="numeric" placeholder="85 000" suffiks="kr" hint="Et overslag fra verkstedet eller en takst. Brevet setter kostnaden mot kjøpesummen." />
        </div>
      </Vis>
      <Del tittel="Har du hatt utgifter på grunn av feilen?">
        <Kortliste
          navn="Har du hatt utgifter på grunn av feilen?"
          verdi={s.k_exp ? "ja" : "nei"}
          valg={[
            ["nei", "Nei"],
            ["ja", "Ja", "Feilsøking, slep, leiebil, taxi og andre dokumenterte tap"],
          ]}
          onVelg={(v) => sett(v === "ja" ? { k_exp: true, exp: s.exp.length ? s.exp : [{ t: "", a: 0 }] } : { k_exp: false })}
        />
      </Del>
      <Vis pa={s.k_exp}>
        <div className="rv-in" style={{ paddingTop: 14 }}>
          <div className="exp">
            {s.exp.map((x, i) => (
              <div key={i} className="exp-row">
                <input className="in" value={x.t} placeholder="Hva gjelder utgiften?" aria-label={`Utgift ${i + 1}`} onChange={(e) => settUtgift(i, { t: e.target.value })} />
                <div className="ad">
                  <input className="in" value={x.a ? tall(x.a) : ""} inputMode="numeric" placeholder="0" aria-label={`Beløp ${i + 1}`} onChange={(e) => settUtgift(i, { a: +e.target.value.replace(/\D/g, "").slice(0, 8) || 0 })} />
                  <span className="sx">kr</span>
                </div>
                <button type="button" className="x" aria-label="Fjern" onClick={() => sett({ exp: s.exp.filter((_, j) => j !== i) })}>
                  <Lukk s={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="exp-foot">
            <button type="button" className="btn sm" onClick={() => sett({ exp: [...s.exp, { t: "", a: 0 }] })}>
              <Pluss />
              Legg til utgift
            </button>
            <span className="sum">
              {s.exp.length ? (
                <>
                  Sum <b>kr {tall(sum)}</b>
                </>
              ) : (
                "Ingen utgifter lagt til"
              )}
            </span>
          </div>
        </div>
      </Vis>
    </div>
  );
}
