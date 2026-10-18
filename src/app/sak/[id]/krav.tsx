// Step 4, «Hva krever du?»: the claim, the alternative, expenses, holding back payment and the deadline.
import { Kravikon, Lukk, Pluss, Trekant } from "@/app/deler/ikoner";
import { addDays, fmtD, idag, parseD } from "@/lib/app/dato";
import { regler } from "@/lib/app/lov";
import { tall } from "@/lib/app/format";
import { Bryter, Felt, Seg, type StegProps, Vis } from "./felt";

const KRAV = [
  ["retting", "Retting", "Forhandleren reparerer feilen uten kostnad for deg.", "retting"],
  ["prisavslag", "Prisavslag", "Du beholder bilen og får igjen et beløp som svarer til verdiforskjellen.", "prisavslag"],
  ["heving", "Heving", "Du leverer bilen tilbake og får kjøpesummen tilbake.", "heving"],
] as const;

export function Krav({ s, sett }: StegProps) {
  const L = regler(s.c_purchase || s.c_delivery);
  const ld = parseD(s.l_date) ?? parseD(idag())!;
  const sum = s.exp.reduce((a, x) => a + (+x.a || 0), 0);
  const settUtgift = (i: number, p: Partial<{ t: string; a: number }>) => sett({ exp: s.exp.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <section className="panel">
      <div className="head">
        <h2>Hva krever du?</h2>
        <p>Forhandleren har normalt rett til å forsøke å rette feilen først. Prisavslag og heving blir aktuelt når retting ikke skjer, ikke lykkes eller ikke er mulig.</p>
      </div>
      <div className="tiles">
        {KRAV.map(([v, t, d, p]) => (
          <label key={v} className="tile">
            <input type="radio" name="k_main" value={v} checked={s.k_main === v} onChange={() => sett({ k_main: v })} />
            <div className="tb">
              <div className="tb-top">
                <span className="ico">
                  <Kravikon id={v} />
                </span>
                <span className="rad" />
              </div>
              <span className="tb-t">{t}</span>
              <span className="tb-d">{d}</span>
              <span className="tb-f">
                <span className="tag law">{L.ref(p)}</span>
              </span>
            </div>
          </label>
        ))}
      </div>
      <div className="block" style={{ marginTop: 14 }}>
        <Vis pa={s.k_main === "prisavslag"}>
          <div className="rv-in grid">
            <Felt s={s} sett={sett} k="k_amount" label="Prisavslag" klasse="c3" fmt="num" inputMode="numeric" placeholder="35 000" suffiks="kr" />
            <Felt s={s} sett={sett} k="k_basis" label={<>Grunnlag <em>valgfritt</em></>} klasse="c3" placeholder="et prisoverslag fra verksted" />
            <div className="c6 hint">Prisavslaget skal svare til verdiforskjellen mellom bilen med og uten mangelen. Et verkstedsoverslag er et godt utgangspunkt.</div>
          </div>
        </Vis>
        <Vis pa={s.k_main === "heving" || s.k_alt === "heving" || s.k_main === "prisavslag"}>
          <div className="rv-in grid">
            <div className="f c6">
              <span className="lb">
                Hvor mange ganger har forhandleren forsøkt å rette feilen? <em>valgfritt</em>
              </span>
              <Seg navn="k_forsok" verdi={s.k_forsok} valg={[["0", "Ingen"], ["1", "Én"], ["2", "To"], ["3+", "Tre eller flere"]]} onVelg={(k_forsok) => sett({ k_forsok: k_forsok === s.k_forsok ? "" : k_forsok })} />
            </div>
            <Felt s={s} sett={sett} k="k_cost" label={<>Anslått utbedringskostnad <em>valgfritt</em></>} klasse="c3" fmt="num" inputMode="numeric" placeholder="85 000" suffiks="kr" />
            <div className="c3 hint">
              Et overslag fra verkstedet eller en takst. Brevet setter kostnaden mot kjøpesummen.{" "}
              {L.versjon === "før_2024"
                ? "For kjøp før 2024 har forhandleren normalt to forsøk på å rette samme feil."
                : "Har forhandleren forsøkt å rette feilen én gang uten å lykkes, kan du normalt avvise flere forsøk og gå videre til prisavslag eller heving."}
            </div>
          </div>
        </Vis>
        <Vis pa={s.k_main === "heving"}>
          <div className="rv-in">
            <div className="note warn">
              <Trekant />
              <div>
                <b>Heving krever at mangelen ikke er uvesentlig.</b> Har forhandleren ikke fått forsøke å rette feilen, er det ofte klokest å kreve retting og sette heving som subsidiært krav.
              </div>
            </div>
          </div>
        </Vis>
        <Vis pa={s.k_main === "retting"}>
          <div className="rv-in">
            <div className="f">
              <span className="lb">Hvis kravet ikke oppfylles, krever jeg subsidiært</span>
              <Seg navn="k_alt" verdi={s.k_alt} valg={[["ingen", "Ingenting"], ["prisavslag", "Prisavslag"], ["heving", "Heving"]]} onVelg={(k_alt) => sett({ k_alt })} />
            </div>
          </div>
        </Vis>
        <Vis pa={s.k_main === "retting"}>
          <Bryter
            s={s}
            sett={sett}
            k="k_loaner"
            tittel="Be om lånebil under reparasjonen"
            tekst={
              L.versjon === "før_2024"
                ? "For kjøp før 2024 kan du kreve lånebil hvis reparasjonen tar mer enn en uke og kravet er rimelig. Utgifter til leiebil kan også kreves dekket som erstatning."
                : "Loven gir ikke automatisk rett til lånebil, men det teller om forhandleren tilbyr det. Utgifter til leiebil kan kreves dekket som erstatning."
            }
            stil={{ borderTop: "1px solid var(--line)" }}
          />
        </Vis>
        <Bryter s={s} sett={sett} k="k_exp" tittel="Krev erstatning for utgifter" tekst="Feilsøking, slep, leiebil, taxi og andre dokumenterte tap som følge av mangelen." />
        <Vis pa={s.k_exp}>
          <div className="rv-in">
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
        <Bryter s={s} sett={sett} k="k_hold" tittel="Hold tilbake betaling" tekst="Skylder du forhandleren penger, kan du holde tilbake det som trengs for å sikre kravet ditt." />
        <Vis pa={s.k_hold}>
          <div className="rv-in grid">
            <Felt s={s} sett={sett} k="k_hold_amt" label="Beløp" klasse="c3" fmt="num" inputMode="numeric" placeholder="20 000" suffiks="kr" />
          </div>
        </Vis>
      </div>
      <div className="block">
        <div className="f">
          <span className="lb">
            Svarfrist for forhandleren <em>{s.k_days ? `svar innen ${fmtD(addDays(ld, +s.k_days))}` : ""}</em>
          </span>
          <Seg navn="k_days" verdi={s.k_days} valg={[["7", "7 dager"], ["14", "14 dager"], ["21", "21 dager"]]} onVelg={(k_days) => sett({ k_days })} />
          <span className="hint">14 dager er vanlig og regnes som rimelig i de fleste saker.</span>
        </div>
      </div>
    </section>
  );
}
