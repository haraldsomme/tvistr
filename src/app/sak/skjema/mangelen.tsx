// The faults (chosen before payment, locked to the purchase after), one card per area, how they
// affect the buyer (cards like the fault list), the workshop, the attachments to list, what the seller said and any earlier
// complaint, as blocks for a page to place under its own heading.
import { FeilIkon, FeilListe } from "@/app/deler/feilliste";
import { relText } from "@/lib/app/dato";
import { type Feilpost, feilposter } from "@/lib/app/feil";
import { docsValg, IKKE_SVART, IMPACT, impactToggle, type Omrade, SVAR, svarToggle } from "@/lib/app/skjema";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { Felt, Kortliste, type StegProps, Valgliste, Vis } from "./felt";

const TOM: Omrade = { found: "" };
// What the report says, under «Hva sier rapporten?».
const RAPPORT = [
  ["bekrefter", "Bekrefter feilen"],
  ["aarsak", "Angir årsaken"],
  ["levering", "Feilen var til stede ved levering"],
  ["ikke_slitasje", "Feilen er ikke normal slitasje"],
  ["frarader", "Fraråder bruk av bilen"],
  ["kostnad", "Inneholder et kostnadsoverslag"],
] as const;
// What the workshop said without a report: the same answers, in the past tense, and no estimate.
const SAGT = [
  ["bekrefter", "Bekreftet feilen"],
  ["aarsak", "Fant årsaken"],
  ["levering", "Feilen var til stede ved levering"],
  ["ikke_slitasje", "Feilen er ikke normal slitasje"],
  ["frarader", "Frarådet bruk av bilen"],
] as const;
const veksle = (liste: string[], v: string, pa: boolean) => (pa ? [...liste.filter((x) => x !== v), v] : liste.filter((x) => x !== v));

// One card per chosen area: when the faults were discovered and what they are. An area with two or
// more subcategories can date each on its own (f_under), when they showed up on different days.
function Omradekort({ s, sett, c, i, n }: StegProps & { c: string; i: number; n: number }) {
  const h = HOVEDKATEGORIER.find((x) => x.id === c)!;
  const valgt = s.f_parts[c] ?? [];
  const poster = feilposter(s).filter((p) => p.hoved === c);
  const delt = poster.some((p) => p.felt.startsWith("f_under."));
  // Splitting moves the area's date to each subcategory and its text to the first; joining moves them back.
  const del = (pa: boolean) => {
    const f_under = Object.fromEntries(Object.entries(s.f_under ?? {}).filter(([k]) => !k.startsWith(`${c}.`)));
    if (pa) {
      const a = s.f_area[c] ?? TOM;
      valgt.forEach((u, j) => (f_under[`${c}.${u}`] = { found: a.found, desc: j ? "" : (s.f_catdesc[c] ?? "") }));
      sett({ f_under, f_area: { ...s.f_area, [c]: { found: "" } }, f_catdesc: { ...s.f_catdesc, [c]: "" } });
    } else {
      const forste = poster.map((p) => p.found).filter(Boolean).sort()[0] ?? "";
      sett({ f_under, f_area: { ...s.f_area, [c]: { found: forste } }, f_catdesc: { ...s.f_catdesc, [c]: poster.map((p) => p.desc).filter(Boolean).join(" ") } });
    }
  };
  const settPost = (p: Feilpost, endring: { found?: string; desc?: string }) => {
    if (p.felt.startsWith("f_under.")) {
      const k = `${c}.${p.under[0]}`;
      const x = s.f_under[k];
      return sett({ f_under: { ...s.f_under, [k]: { ...x, ...endring } } });
    }
    if (endring.found !== undefined) sett({ f_area: { ...s.f_area, [c]: { ...(s.f_area[c] ?? TOM), found: endring.found } } });
    if (endring.desc !== undefined) sett({ f_catdesc: { ...s.f_catdesc, [c]: endring.desc } });
  };
  const underNavn = (p: Feilpost) => p.under.map((u) => h.under.find((x) => x.id === u)?.navn ?? u).join(", ");
  return (
    <div className="block area">
      <div className="bt">
        <h3>
          <FeilIkon id={c} />
          {h.navn}
        </h3>
        <span>{n > 1 ? `Feil ${i + 1} av ${n}` : ""}</span>
      </div>
      {valgt.length > 1 && (
        <label className="sw" htmlFor={`ar${i}u`} style={{ marginBottom: 14 }}>
          <div>
            <div className="sw-t">Feilene ble oppdaget på ulike datoer</div>
            <div className="sw-d">Da får hver feil sin egen dato, og brevet regner fristene for hver av dem.</div>
          </div>
          <input className="tg" type="checkbox" role="switch" id={`ar${i}u`} checked={delt} onChange={(e) => del(e.target.checked)} />
        </label>
      )}
      {poster.map((p, j) => {
        const id = `ar${i}${delt ? `-${j}` : ""}`;
        return (
          <div className="grid area-g" key={p.felt}>
            {delt && <div className="sub-h c6">{underNavn(p)}</div>}
            <div className="f c3">
              <label className="lb" htmlFor={`${id}f`}>
                Når oppdaget du feilen?
              </label>
              <input className="in" type="date" id={`${id}f`} value={p.found} onChange={(e) => settPost(p, { found: e.target.value })} />
              <span className="hint">{p.found ? relText(p.found, s.c_delivery) : ""}</span>
            </div>
            <div className="f c6">
              <label className="lb" htmlFor={`${id}d`}>
                Mer om feilen <em>valgfritt</em>
              </label>
              <textarea className="in cd-in" id={`${id}d`} rows={3} placeholder="Hva skjer, når skjer det og hvor ofte? Har bilen vist feilmeldinger?" value={p.felt.startsWith("f_under.") ? (s.f_under[`${c}.${p.under[0]}`]?.desc ?? "") : (s.f_catdesc[c] ?? "")} onChange={(e) => settPost(p, { desc: e.target.value })} />
            </div>
          </div>
        );
      })}
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
  verdi: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
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
  const rapport = s.ws === "rapport";
  const valg = rapport ? RAPPORT : SAGT;
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
        // A report is ticked as an attachment when the buyer says they have one; they can untick it.
        // Without a report there is no estimate to keep.
        onVelg={(ws) =>
          sett({
            ws,
            f_docs: ws === s.ws ? s.f_docs : veksle(s.f_docs, "verksted", ws === "rapport"),
            ws_says: ws === "uten" ? s.ws_says.filter((x) => x !== "kostnad") : s.ws_says,
          })
        }
      />
      <Vis pa={s.ws === "rapport" || s.ws === "uten"}>
        <div className="rv-in">
          <Vis pa={s.ws === "rapport"}>
            <div className="sub-h">Rapporten fra verkstedet</div>
          </Vis>
          <div className="grid">
            <Felt s={s} sett={sett} k="ws_name" label="Verkstedets navn" klasse="c4" placeholder="Bilservice Sandvika AS" />
          </div>
          <div className="f" style={{ marginTop: 18 }}>
            <span className="lb">{rapport ? "Hva sier rapporten?" : "Hva sa verkstedet?"}</span>
            <span className="hint" style={{ margin: "-2px 0 8px" }}>
              {rapport ? "Kryss bare av det rapporten faktisk sier. Forhandleren kan be om å få se den." : "Kryss bare av det verkstedet faktisk sa. Forhandleren kan kontakte verkstedet."}
            </span>
            <Kortliste
              flere
              navn={rapport ? "Hva sier rapporten?" : "Hva sa verkstedet?"}
              verdi={s.ws_says}
              valg={valg}
              onVelg={(v, pa) => sett({ ws_says: valg.map(([x]) => x).filter((x) => (x === v ? pa : s.ws_says.includes(x))) })}
            />
          </div>
          <div style={{ marginTop: 18 }}>
            {rapport ? (
              <Felt
                s={s}
                sett={sett}
                k="ws_quote"
                label={<>Rapportens konklusjon, ordrett <em>valgfritt</em></>}
                flerlinje={96}
                placeholder="For eksempel: «Feilkoder viser defekt batterimodul. Feilen skyldes ikke ytre påvirkning.»"
                hint="Skriv av rapportens konklusjon ordrett, gjerne én til tre setninger. Legg ved rapporten når du sender brevet."
              />
            ) : (
              <Felt
                s={s}
                sett={sett}
                k="ws_quote"
                label={<>Hva verkstedet sa, med dine ord <em>valgfritt</em></>}
                flerlinje={96}
                placeholder="For eksempel: «En battericelle er defekt. Det er ikke vanlig slitasje på en bil med så lav kjørelengde.»"
                hint="Gjengi så nøyaktig du kan det verkstedet sa, gjerne én til tre setninger."
              />
            )}
          </div>
        </div>
      </Vis>
    </div>
  );
}

// The documents to list as attachments (nothing is uploaded).
export function Vedlegg({ s, sett }: StegProps) {
  return (
    <div className="block">
      <Valgliste flere bredde={190} navn="f_docs" verdi={s.f_docs} valg={docsValg(s)} onVelg={(v, pa) => sett({ f_docs: veksle(s.f_docs, v, pa) })} />
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
          ["nei", "Nei, ikke ennå", "Brevet blir reklamasjonen din"],
          ["ja", "Ja, jeg har sagt fra", "Muntlig eller skriftlig"],
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
