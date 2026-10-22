// The faults (chosen before payment, locked to the purchase after), one card per area, how they
// affect the buyer (cards like the fault list), the workshop, the attachments to list, what the seller said and any earlier
// complaint, as blocks for a page to place under its own heading.
import { FeilIkon, FeilListe } from "@/app/deler/feilliste";
import { relText } from "@/lib/app/dato";
import { DOCS_VALG, IKKE_SVART, IMPACT, impactToggle, type Omrade, SVAR, svarToggle } from "@/lib/app/skjema";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { Felt, Kortliste, type StegProps, Valgliste, Vis } from "./felt";

const TOM: Omrade = { found: "" };
// What the report says, under «Hva sier rapporten?».
const RAPPORT = [
  ["bekrefter", "Bekrefter feilen"],
  ["aarsak", "Angir årsaken"],
  ["levering", "Feilen har utviklet seg over tid eller var til stede ved levering"],
  ["ikke_slitasje", "Feilen er ikke normal slitasje"],
  ["frarader", "Fraråder bruk av bilen"],
  ["kostnad", "Inneholder et kostnadsoverslag"],
] as const;
const veksle = (liste: string[], v: string, pa: boolean) => (pa ? [...liste.filter((x) => x !== v), v] : liste.filter((x) => x !== v));

function Omradekort({ s, sett, c, i, n }: StegProps & { c: string; i: number; n: number }) {
  const h = HOVEDKATEGORIER.find((x) => x.id === c)!;
  const a = s.f_area[c] ?? TOM;
  const settA = (p: Partial<Omrade>) => sett({ f_area: { ...s.f_area, [c]: { ...a, ...p } } });
  const id = `ar${i}`;
  return (
    <div className="block area">
      <div className="bt">
        <h3>
          <FeilIkon id={c} />
          {h.navn}
        </h3>
        <span>{n > 1 ? `Feil ${i + 1} av ${n}` : ""}</span>
      </div>
      <div className="grid area-g">
        <div className="f c3">
          <label className="lb" htmlFor={`${id}f`}>
            Når oppdaget du feilen?
          </label>
          <input className="in" type="date" id={`${id}f`} value={a.found} onChange={(e) => settA({ found: e.target.value })} />
          <span className="hint">{a.found ? relText(a.found, s.c_delivery) : ""}</span>
        </div>
        <div className="f c6">
          <label className="lb" htmlFor={`${id}d`}>
            Mer om feilen <em>valgfritt</em>
          </label>
          <textarea className="in cd-in" id={`${id}d`} rows={3} placeholder="Hva skjer, når skjer det og hvor ofte? Har bilen vist feilmeldinger?" value={s.f_catdesc[c] ?? ""} onChange={(e) => sett({ f_catdesc: { ...s.f_catdesc, [c]: e.target.value } })} />
        </div>
      </div>
    </div>
  );
}

// The fault list to choose from, categories and parts kept in HOVEDKATEGORIER order.
export function Feilvalg({ s, sett }: StegProps) {
  // The one clicked flips; the others stay as they are.
  const veksle = (c: string) => sett({ f_cats: HOVEDKATEGORIER.map((h) => h.id).filter((x) => (x === c) !== s.f_cats.includes(x)) });
  const veksleUnder = (c: string, u: string) =>
    sett({ f_parts: { ...s.f_parts, [c]: HOVEDKATEGORIER.find((x) => x.id === c)!.under.map((x) => x.id).filter((x) => (x === u) !== (s.f_parts[c] ?? []).includes(x)) } });
  return <FeilListe valgt={s.f_cats} under={s.f_parts} onKategori={veksle} onUnder={veksleUnder} />;
}

// One card per chosen area.
export function Omrader({ s, sett }: StegProps) {
  return (
    <div id="areaCards">
      {s.f_cats.map((c, i) => (
        <Omradekort key={c} s={s} sett={sett} c={c} i={i} n={s.f_cats.length} />
      ))}
    </div>
  );
}

const VIRKNING_IKON: Record<string, string> = {
  kosmetisk: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  plagsom: "M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14",
  bruk: "M12 14l4-4M3.3 19a10 10 0 1 1 17.4 0",
  palitelig: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  sikkerhet: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01",
  stopp: "M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9zM15 9l-6 6M9 9l6 6",
};

// How the faults affect the buyer, once for all of them. «Bare kosmetisk» rules out the others (impactToggle).
export function Virkning({ s, sett }: StegProps) {
  return (
    <Kortliste
      flere
      navn="Hvordan feilene påvirker deg"
      verdi={s.f_impact}
      valg={IMPACT.map(([v, l, d]) => [v, l, d] as const)}
      onVelg={(v, pa) => sett({ f_impact: impactToggle(s.f_impact, v, pa) })}
      ikon={(v) => (
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d={VIRKNING_IKON[v]} />
        </svg>
      )}
    />
  );
}

// «Er feilen undersøkt av et verksted?», asked by the page.
export function Verksted({ s, sett }: StegProps) {
  return (
    <div className="block">
      <Kortliste
        navn="Er feilen undersøkt av et verksted?"
        verdi={s.ws}
        valg={[
          ["rapport", "Ja, og jeg har en rapport", "En skriftlig vurdering fra verkstedet"],
          ["uten", "Ja, men uten rapport", "Verkstedet har sett på bilen"],
          ["nei", "Nei"],
        ]}
        onVelg={(ws) => sett({ ws })}
      />
      <Vis pa={s.ws === "rapport" || s.ws === "uten"}>
        <div className="rv-in">
          <Vis pa={s.ws === "rapport"}>
            <div className="sub-h">Rapporten fra verkstedet</div>
          </Vis>
          <div className="grid">
            <Felt s={s} sett={sett} k="ws_name" label="Verkstedets navn" klasse="c4" placeholder="Bilservice Sandvika AS" />
          </div>
          <Vis pa={s.ws === "rapport"}>
            <div className="f" style={{ marginTop: 18 }}>
              <span className="lb">Hva sier rapporten?</span>
              <span className="hint" style={{ margin: "-2px 0 8px" }}>
                Kryss bare av det rapporten faktisk sier. Forhandleren kan be om å få se den.
              </span>
              <Kortliste flere navn="Hva sier rapporten?" verdi={s.ws_says} valg={RAPPORT} onVelg={(v, pa) => sett({ ws_says: RAPPORT.map(([x]) => x).filter((x) => (x === v ? pa : s.ws_says.includes(x))) })} />
            </div>
            <div style={{ marginTop: 18 }}>
              <Felt
                s={s}
                sett={sett}
                k="ws_quote"
                label={<>Rapportens konklusjon, ordrett <em>valgfritt</em></>}
                flerlinje={96}
                placeholder="For eksempel: «Feilkoder viser defekt batterimodul. Feilen skyldes ikke ytre påvirkning.»"
                hint="Skriv av rapportens konklusjon ordrett, gjerne én til tre setninger. Legg ved rapporten når du sender brevet."
              />
            </div>
          </Vis>
        </div>
      </Vis>
    </div>
  );
}

// The documents to list as attachments (nothing is uploaded).
export function Vedlegg({ s, sett }: StegProps) {
  return (
    <div className="block">
      <Valgliste flere bredde={190} navn="f_docs" verdi={s.f_docs} valg={DOCS_VALG} onVelg={(v, pa) => sett({ f_docs: veksle(s.f_docs, v, pa) })} />
    </div>
  );
}

// «Sa selger noe om denne feilen før kjøpet?», asked by the page.
export function SelgerSa({ s, sett }: StegProps) {
  return (
    <div className="block">
      <Kortliste
        navn="Sa selger noe om denne feilen før kjøpet?"
        verdi={s.seller_said}
        valg={[
          ["nei", "Nei", "Du fikk ingen opplysning om feilen"],
          ["lovet", "Ja, at bilen var fri for slike feil", "For eksempel at den var feilfri eller nylig gjennomgått"],
          ["opplyste", "Ja, de opplyste om feilen", "Du fikk vite om feilen før du kjøpte bilen"],
        ]}
        onVelg={(seller_said) => sett({ seller_said })}
      />
      {/* The letter quotes only a promise: what the seller disclosed is no argument for the buyer. */}
      <Vis pa={s.seller_said === "lovet"}>
        <div className="rv-in">
          <Felt s={s} sett={sett} k="seller_txt" label={<>Hva sa selger? <em>så ordrett som mulig</em></>} flerlinje={84} placeholder="For eksempel: «Bilen er nylig gjennomgått og har ingen kjente feil»" />
        </div>
      </Vis>
    </div>
  );
}

// «Har du sagt fra til forhandleren?»: yes or not yet, and for yes the day and what the dealer answered.
// «Har ikke svart» rules out the answers (svarToggle).
export function SagtFra({ s, sett }: StegProps) {
  // One container: the screen's gap would otherwise stand for the hidden part.
  return (
    <div>
      <Kortliste
        navn="Har du sagt fra til forhandleren?"
        verdi={s.f_prior ? "ja" : "nei"}
        valg={[
          ["ja", "Ja, jeg har sagt fra", "Muntlig eller skriftlig"],
          ["nei", "Nei, ikke ennå", "Brevet blir reklamasjonen din"],
        ]}
        onVelg={(v) => sett({ f_prior: v === "ja" })}
      />
      <Vis pa={s.f_prior}>
        <div className="rv-in">
          <div className="grid">
            <Felt s={s} sett={sett} k="f_prior_date" label="Når sa du fra?" klasse="c3" type="date" hint="Datoen du først sa fra, teller for fristen." />
          </div>
          <div className="f" style={{ marginTop: 18 }}>
            <span className="lb">
              Hva svarte forhandleren? <em>velg alt som passer</em>
            </span>
            <span className="hint" style={{ margin: "-2px 0 8px" }}>
              Brevet svarer på hver innvending med det loven sier.
            </span>
            <Kortliste
              flere
              navn="Hva svarte forhandleren?"
              verdi={s.f_prior_svar}
              valg={[[IKKE_SVART, "Har ikke svart"] as const, ...SVAR.map(([v, l]) => [v, l] as const)]}
              onVelg={(v, pa) => sett({ f_prior_svar: svarToggle(s.f_prior_svar, v, pa) })}
            />
          </div>
        </div>
      </Vis>
    </div>
  );
}
