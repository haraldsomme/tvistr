// The Brevet tab (artifact step «Brev»): place, date and tone, the decision the letter cites (one of
// the top three from finnVedtak), copy buttons, the checklist and the letter on paper.
import { useEffect, useState } from "react";
import { Kopier } from "@/app/deler/ikoner";
import { byggBrev, emne, type Presedens, tilTekst } from "@/lib/app/brev";
import { idag } from "@/lib/app/dato";
import { husk } from "@/lib/app/kall";
import { nokkel, tilSvar } from "@/lib/app/saken";
import { maal } from "@/lib/maling";
import type { Skjema } from "@/lib/app/skjema";
import { type Funn, finnVedtak } from "./actions";
import { Bryter, Felt, Seg, type Sett } from "./felt";
import { Papir } from "./papir";
import { ETIKETT, mangler } from "./steg";

// One model call per set of answers in this page session, however often the tab is opened.
const hent = (svar: NonNullable<ReturnType<typeof tilSvar>>, ordreId: string) =>
  husk(`${ordreId}|${nokkel(svar)}`, () => finnVedtak({ svar, ordreId }), "Vi fikk ikke kontakt. Prøv igjen.");

export function Brevet({ s, sett, ordre, onSteg, onToast }: { s: Skjema; sett: Sett; ordre: string; onSteg: (i: number) => void; onToast: (m: string) => void }) {
  const svar = tilSvar(s);
  const n = nokkel(svar);
  const [funn, settFunn] = useState<{ n: string; f: Funn } | null>(null);

  useEffect(() => {
    if (!svar) return;
    let gjeldende = true;
    hent(svar, ordre).then((f) => {
      if (!gjeldende) return;
      settFunn({ n, f });
      // The picker starts on the decision the model chose.
      if (f.ok && f.valg.length && !f.valg.some((v) => v.id === s.prec_id)) sett({ prec_id: f.valg[0].id });
    });
    return () => {
      gjeldende = false;
    };
    // `n` stands for `svar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, ordre]);

  const aktuell = funn && funn.n === n ? funn.f : null;
  const valg: Presedens[] = aktuell?.ok ? aktuell.valg : [];
  const valgt = valg.find((v) => v.id === s.prec_id) ?? valg[0] ?? null;
  const blokker = byggBrev(s, valgt, idag());

  async function kopier(tekst: string, ok: string) {
    try {
      await navigator.clipboard.writeText(tekst);
      onToast(ok);
    } catch {
      const el = document.getElementById("letterFull");
      if (el) {
        const r = document.createRange();
        r.selectNodeContents(el);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(r);
      }
      onToast("Kopiering ble blokkert. Teksten er markert, trykk Ctrl/Cmd + C.");
    }
  }

  const rader = mangler(s);
  return (
    <section className="panel" data-step="4">
      <div className="head">
        <h2>Brevet ditt</h2>
        <p>Les gjennom, velg tone og kopier teksten inn i en e-post eller et dokument. Grå felt i brevet mangler fortsatt opplysninger.</p>
      </div>
      <div className="desk">
        <div className="desk-l">
          <div className="block d-set">
            <div className="grid">
              <Felt s={s} sett={sett} k="l_place" label="Sted" klasse="c3 m3" placeholder="Oslo" />
              <Felt s={s} sett={sett} k="l_date" label="Dato" klasse="c3 m3" type="date" />
              <div className="f c6">
                <span className="lb">Tone</span>
                <Seg navn="l_tone" verdi={s.l_tone} valg={[["saklig", "Saklig"], ["bestemt", "Bestemt"]]} onVelg={(l_tone) => sett({ l_tone })} />
              </div>
            </div>
          </div>
          <div className="block d-prec">
            <div className="bt">
              <h3>Vunnet sak i brevet</h3>
            </div>
            <Bryter s={s} sett={sett} k="prec_on" tittel="Vis til en lignende sak" tekst="Brevet sammenligner saken din med et vedtak fra Forbrukerklageutvalget der forbrukeren fikk medhold." />
            {s.prec_on && (
              <div className="rv-in" style={{ paddingBottom: 0 }}>
                {!svar ? (
                  <p className="hint">Legg inn overtakelsesdato og når du oppdaget feilen, så finner vi lignende saker.</p>
                ) : !aktuell ? (
                  <p className="hint">Finner lignende saker …</p>
                ) : !aktuell.ok ? (
                  <p className="hint">{aktuell.melding}</p>
                ) : !valg.length ? (
                  <p className="hint">Vi fant ingen lignende sak med medhold. Brevet bygger på lovens vilkår.</p>
                ) : (
                  <>
                    <div className="pp">
                      {valg.map((v) => (
                        <label key={v.id} className="pp-opt">
                          <input type="radio" name="prec_id" value={v.id} checked={v.id === valgt?.id} onChange={() => sett({ prec_id: v.id })} />
                          <span className="pp-b">
                            <span className="pp-t">
                              <span>
                                Sak {v.saksnummer} · {v.bil}
                              </span>
                              <em>{v.best ? "Best treff" : "Alternativ"}</em>
                            </span>
                            {v.utfall[0] && <span className="pp-d">Kjøperen fikk {v.utfall.join(" og ")}{v.vedtaksdato && `, ${v.vedtaksdato.slice(0, 4)}`}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                    {valgt?.kildeUrl && (
                      <p className="prec-src" style={{ margin: "10px 0 0" }}>
                        Les hele vedtaket:{" "}
                        <a href={valgt.kildeUrl} target="_blank" rel="noopener">
                          sak {valgt.saksnummer} hos Forbrukertilsynet
                        </a>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="block d-copy" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn pri" onClick={() => {
                maal("brev_kopiert");
                kopier(tilTekst(blokker), "Brevet er kopiert");
              }}>
              <Kopier />
              Kopier brevet
            </button>
            <button type="button" className="btn" onClick={() => kopier(emne(blokker), "Emnefeltet er kopiert")}>
              Kopier emnefelt
            </button>
            {s.d_email.trim() && (
              <div>
                <div className="hint" style={{ margin: "6px 0" }}>
                  Send til
                </div>
                <div className="mail">{s.d_email}</div>
              </div>
            )}
          </div>
          <div className="block d-miss">
            <div className="bt">
              <h3>Sjekkliste</h3>
            </div>
            <div className="miss">
              {rader.length ? (
                rader.map((r) => (
                  <div key={r.i} className="mr">
                    <span>
                      {r.navn}
                      <small>{r.felt.map((k) => ETIKETT[k]).join(", ")}</small>
                    </span>
                    <button type="button" className="btn sm" onClick={() => onSteg(r.i)}>
                      Fyll ut
                    </button>
                  </div>
                ))
              ) : (
                <div className="mr">
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="tag good">Klart</span>Alt sentralt er fylt ut.
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="fine d-fine">Brevet er en mal basert på forbrukerkjøpsloven og er ikke juridisk rådgivning. Forbrukerrådet hjelper gratis hvis forhandleren avviser saken.</p>
        </div>
        <div className="paper d-paper">
          <Papir blokker={blokker} id="letterFull" />
        </div>
      </div>
    </section>
  );
}
