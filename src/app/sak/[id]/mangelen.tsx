// Steps 5–7: the faults (one card per area, locked to the purchase), the workshop and attachments (file
// names only, nothing is uploaded), and what the seller said and any earlier complaint.
import { useState } from "react";
import { Fil, Fold, Hake, Lukk, Opplast } from "@/app/deler/ikoner";
import { relText } from "@/lib/app/dato";
import { DOCS, IMPACT, impactToggle, KNOWN, type Omrade } from "@/lib/app/skjema";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { Bryter, Chips, Felt, Seg, type StegProps, Vis } from "./felt";

const TOM: Omrade = { found: "", impact: [], known: "" };
const RAPPORT = [
  ["bekrefter", "Rapporten bekrefter feilen"],
  ["aarsak", "Rapporten angir årsaken"],
  ["levering", "Rapporten sier at feilen har utviklet seg over tid / var til stede ved levering"],
  ["ikke_slitasje", "Rapporten sier at feilen ikke er normal slitasje"],
  ["frarader", "Rapporten fraråder bruk av bilen"],
  ["kostnad", "Rapporten inneholder kostnadsoverslag"],
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
        <h3>{h.navn}</h3>
        <span>{n > 1 ? `Feil ${i + 1} av ${n}` : ""}</span>
      </div>
      {h.under.length > 0 && (
        <div className="f">
          <span className="lb">
            Hva gjelder det? <em>låst til kjøpet</em>
          </span>
          <Chips flere disabled navn={`${id}p`} verdi={s.f_parts[c] ?? []} valg={h.under.map((u) => [u.id, u.navn] as const)} onVelg={(v, pa) => sett({ f_parts: { ...s.f_parts, [c]: h.under.map((u) => u.id).filter((x) => (x === v ? pa : (s.f_parts[c] ?? []).includes(x))) } })} />
        </div>
      )}
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
        <div className="f c6">
          <span className="lb">
            Hvordan påvirker feilen deg? <em>velg alt som passer</em>
          </span>
          <span className="hint" style={{ margin: "-2px 0 4px" }}>
            Er feilen bare kosmetisk, velger du bare det.
          </span>
          <Chips flere navn={`${id}i`} verdi={a.impact} valg={IMPACT.map(([v, l]) => [v, l] as const)} onVelg={(v, pa) => settA({ impact: impactToggle(a.impact, v, pa) })} />
        </div>
        <div className="f c6">
          <span className="lb">Visste du om feilen da du kjøpte bilen?</span>
          <Seg navn={`${id}k`} verdi={a.known} valg={KNOWN} onVelg={(known) => settA({ known })} />
        </div>
      </div>
    </div>
  );
}
export function Feilen({ s, sett }: StegProps) {
  return (
    <section className="panel">
      <div className="head">
        <h2>Hva er feil med bilen?</h2>
        <p>Vær konkret og hold deg til fakta. En presis beskrivelse gjør det vanskeligere å avvise saken.</p>
      </div>
      <div className="block">
        <div className="bt">
          <h3>Hvilke deler gjelder det?</h3>
          <span>Låst til kjøpet</span>
        </div>
        <Chips
          flere
          disabled
          navn="f_cats"
          verdi={s.f_cats}
          valg={HOVEDKATEGORIER.map((h) => [h.id, h.navn] as const)}
          onVelg={(v, pa) => {
            const cats = HOVEDKATEGORIER.map((h) => h.id).filter((x) => (x === v ? pa : s.f_cats.includes(x)));
            sett({ f_cats: cats, f_area: pa && !s.f_area[v] ? { ...s.f_area, [v]: TOM } : s.f_area });
          }}
        />
        <div className="hint" style={{ marginTop: 12 }}>
          Brevet gjelder feilene du valgte før du betalte. Et brev om en annen feil krever et nytt kjøp. Under hvert område kan du beskrive feilen og når du oppdaget den.
        </div>
      </div>
      <div id="areaCards">
        {s.f_cats.map((c, i) => (
          <Omradekort key={c} s={s} sett={sett} c={c} i={i} n={s.f_cats.length} />
        ))}
      </div>
    </section>
  );
}

export function Verksted({ s, sett }: StegProps) {
  const [over, settOver] = useState(false);
  const leggTil = (filer: FileList | null) => filer && sett({ files: [...new Set([...s.files, ...[...filer].map((f) => f.name)])] });
  const nd = s.f_docs.length + s.files.length;
  return (
    <section className="panel">
      <div className="head">
        <h2>Verksted og vedlegg</h2>
        <p>En verkstedrapport og dokumentasjon gjør saken mye sterkere. Alt du krysser av for, føres opp i brevet.</p>
      </div>
      <div className="block">
        <div className="bt">
          <h3>Er feilen undersøkt av et verksted?</h3>
        </div>
        <Chips
          navn="ws"
          verdi={s.ws}
          valg={[["rapport", "Ja, og jeg har en rapport"], ["uten", "Ja, men uten rapport"], ["nei", "Nei"]]}
          onVelg={(ws) => sett({ ws, ...(ws === "rapport" && !s.f_docs.includes("verksted") && { f_docs: [...s.f_docs, "verksted"] }) })}
        />
        <Vis pa={s.ws === "rapport" || s.ws === "uten"}>
          <div className="rv-in">
            <Vis pa={s.ws === "rapport"}>
              <div className="sub-h">Rapporten fra verkstedet</div>
            </Vis>
            <div className="f">
              <span className="lb">Hvem undersøkte bilen?</span>
              <Chips navn="ws_who" verdi={s.ws_who} valg={[["uavhengig", "Uavhengig verksted"], ["selger", "Selgers eget verksted"], ["merke", "Merkeverksted"]]} onVelg={(ws_who) => sett({ ws_who })} />
            </div>
            <div className="grid" style={{ marginTop: 16 }}>
              <Felt s={s} sett={sett} k="ws_name" label="Verkstedets navn" klasse="c4" placeholder="Bilservice Sandvika AS" />
              <Vis pa={s.ws === "rapport"} klasse="c2">
                <Felt s={s} sett={sett} k="ws_date" label="Dato for rapporten" type="date" />
              </Vis>
            </div>
            <Vis pa={s.ws === "rapport"}>
              <div className="f" style={{ marginTop: 18 }}>
                <span className="lb">Hva sier rapporten?</span>
                <span className="hint" style={{ margin: "-2px 0 8px" }}>
                  Kryss bare av det rapporten faktisk sier. Forhandleren kan be om å få se den.
                </span>
                <div className="cks">
                  {RAPPORT.map(([v, l]) => (
                    <label key={v} className="ck">
                      <input type="checkbox" checked={s.ws_says.includes(v)} onChange={(e) => sett({ ws_says: RAPPORT.map(([x]) => x).filter((x) => (x === v ? e.target.checked : s.ws_says.includes(x))) })} />
                      <span className="ck-b" aria-hidden="true">
                        <Hake />
                      </span>
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
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
      <details className="block fold" open>
        <summary className="fold-s">
          <h3>Dokumentasjon</h3>
          <span className="fold-m">
            <span>{nd ? `${nd} valgt` : "Føres opp som vedlegg"}</span>
            <Fold />
          </span>
        </summary>
        <Chips flere navn="f_docs" verdi={s.f_docs} valg={DOCS} onVelg={(v, pa) => sett({ f_docs: veksle(s.f_docs, v, pa) })} />
        <div style={{ marginTop: 16 }}>
          <div
            className={`drop${over ? " over" : ""}`}
            onDragEnter={(e) => (e.preventDefault(), settOver(true))}
            onDragOver={(e) => (e.preventDefault(), settOver(true))}
            onDragLeave={() => settOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              settOver(false);
              leggTil(e.dataTransfer.files);
            }}
          >
            <input type="file" multiple aria-label="Legg til vedlegg" onChange={(e) => (leggTil(e.target.files), (e.target.value = ""))} />
            <Opplast />
            <div style={{ marginTop: 6 }}>
              <b style={{ fontWeight: 600, color: "var(--ink)" }}>Slipp filer her</b> eller klikk for å velge
            </div>
            <small>Bare filnavnene brukes i vedleggslisten. Filene lastes ikke opp.</small>
          </div>
          <div className="files">
            {s.files.map((f, i) => (
              <div key={f} className="file">
                <Fil />
                <span>{f}</span>
                <button type="button" className="x" aria-label={`Fjern ${f}`} onClick={() => sett({ files: s.files.filter((_, j) => j !== i) })}>
                  <Lukk s={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

export function Kontakt({ s, sett }: StegProps) {
  return (
    <section className="panel">
      <div className="head">
        <h2>Kontakt med selger</h2>
        <p>Hva selgeren sa før kjøpet, og om du allerede har sagt fra om feilen.</p>
      </div>
      <div className="block">
        <div className="bt">
          <h3>Sa selger noe om denne feilen før kjøpet?</h3>
        </div>
        <span className="hint" style={{ display: "block", margin: "-6px 0 12px" }}>
          For eksempel i annonsen, kontrakten eller en melding.
        </span>
        <Chips navn="seller_said" verdi={s.seller_said} valg={[["nei", "Nei"], ["lovet", "Ja, at bilen var fri for slike feil"], ["opplyste", "Ja, de opplyste om feilen"]]} onVelg={(seller_said) => sett({ seller_said })} />
        <Vis pa={s.seller_said === "lovet" || s.seller_said === "opplyste"}>
          <div className="rv-in">
            <Felt s={s} sett={sett} k="seller_txt" label={<>Hva sa selger? <em>så ordrett som mulig</em></>} flerlinje={84} placeholder="For eksempel: «Bilen er nylig gjennomgått og har ingen kjente feil»" />
          </div>
        </Vis>
      </div>
      <div className="block">
        <Bryter s={s} sett={sett} k="f_prior" tittel="Jeg har allerede sagt fra til forhandleren" tekst="Muntlig eller skriftlig. Det er datoen for første reklamasjon som teller for fristen." />
        <Vis pa={s.f_prior}>
          <div className="rv-in grid">
            <Felt s={s} sett={sett} k="f_prior_date" label="Dato du sa fra" klasse="c3" type="date" />
            <div className="f c3">
              <span className="lb">Hvordan?</span>
              <Seg navn="f_prior_how" verdi={s.f_prior_how} valg={[["telefon", "Telefon"], ["e-post", "E-post"], ["oppmøte", "Oppmøte"]]} onVelg={(f_prior_how) => sett({ f_prior_how })} />
            </div>
            <Felt s={s} sett={sett} k="f_prior_resp" label={<>Hva svarte forhandleren? <em>valgfritt</em></>} flerlinje={92} placeholder="For eksempel: de mente feilen skyldes normal slitasje" />
          </div>
        </Vis>
      </div>
    </section>
  );
}
