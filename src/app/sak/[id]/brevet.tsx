// The Brevet tab (artifact step «Brev»): place, date and tone, the decision the letter cites (picked in
// the Vedtak tab), copy buttons, the checklist and the letter on paper.
import { Kopier } from "@/app/deler/ikoner";
import { byggBrev, emne, tilTekst } from "@/lib/app/brev";
import { idag } from "@/lib/app/dato";
import { datoavvik } from "@/lib/app/datoer";
import { maal } from "@/lib/maling";
import type { Skjema } from "@/lib/app/skjema";
import { Bryter, Felt, Seg, type Sett } from "./felt";
import { Papir } from "./papir";
import { ETIKETT, mangler } from "./steg";
import type { Vedtaksvalg } from "./vedtaksfane";

export function Brevet({ s, sett, vedtak, onSteg, onVedtak, onToast }: { s: Skjema; sett: Sett; vedtak: Vedtaksvalg; onSteg: (i: number) => void; onVedtak: () => void; onToast: (m: string) => void }) {
  const { funn, valgt, venter } = vedtak;
  const blokker = byggBrev(s, venter ? "venter" : valgt, idag());
  const avvik = datoavvik(s, idag());

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
                {vedtak.mangler ? (
                  <p className="hint">Legg inn overtakelsesdato og når du oppdaget feilen, så finner vi lignende saker.</p>
                ) : !funn ? (
                  <p className="hint">Finner lignende saker …</p>
                ) : !funn.ok ? (
                  <div className="sugg">
                    <span>{funn.melding}</span>
                    <button type="button" className="btn sm" onClick={vedtak.provIgjen}>
                      Prøv igjen
                    </button>
                  </div>
                ) : !valgt ? (
                  <p className="hint">Vi fant ingen lignende sak med medhold. Brevet bygger på lovens vilkår.</p>
                ) : (
                  <div className="sugg">
                    <span>
                      Brevet viser til <b>{valgt.saksnummer ? `sak ${valgt.saksnummer}` : "vedtaket"}</b> · {valgt.bil} ({valgt.anbefalt ? "anbefalt, " : ""}likhet {valgt.likhet} %)
                    </span>
                    <button type="button" className="btn sm" onClick={onVedtak}>
                      Velg et annet vedtak
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="block d-copy" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn pri" disabled={venter} title={venter ? "Venter på den lignende saken" : undefined} onClick={() => {
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
              {avvik.map((a) => (
                <div key={a} className="mr">
                  <span style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span className="tag warn">Sjekk</span>
                    {a}
                  </span>
                </div>
              ))}
              {rader.map((r) => (
                  <div key={r.i} className="mr">
                    <span>
                      {r.navn}
                      <small>{r.felt.map((k) => ETIKETT[k]).join(", ")}</small>
                    </span>
                    <button type="button" className="btn sm" onClick={() => onSteg(r.i)}>
                      Fyll ut
                    </button>
                  </div>
              ))}
              {!rader.length && !avvik.length && (
                <div className="mr">
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="tag good">Klart</span>Alt sentralt er fylt ut.
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="fine d-fine">Brevet er en mal basert på forbrukerkjøpsloven og er ikke juridisk rådgivning. Forbrukerrådet gir gratis råd, og Forbrukertilsynet mekler hvis forhandleren avviser saken.</p>
        </div>
        <div className="paper d-paper">
          <Papir blokker={blokker} id="letterFull" />
        </div>
      </div>
    </section>
  );
}
