// The Brevet tab (artifact step «Brev»): the decision the letter cites (picked in the Vedtak tab), copy
// buttons, the checklist and the letter on paper; place, date and tone are the form's step Brevet. The
// letter comes from the server (fulltBrev), built from these answers with the car and the faults as bought.
import { Kopier } from "@/app/deler/ikoner";
import { fulltBrev } from "@/app/sak/brevet-actions";
import { useBrev } from "@/app/sak/flyt/bruk-brev";
import { idag } from "@/lib/app/dato";
import { datoavvik } from "@/lib/app/datoer";
import { maal } from "@/lib/maling";
import type { Skjema } from "@/lib/app/skjema";
import { Bryter, type Sett } from "@/app/sak/skjema/felt";
import { Papir } from "./papir";
import { ETIKETT, mangler } from "@/app/sak/skjema/steg";
import type { Vedtaksvalg } from "./vedtaksfane";

export function Brevet({ id, s, sett, vedtak, onSteg, onVedtak, onToast }: { id: string; s: Skjema; sett: Sett; vedtak: Vedtaksvalg; onSteg: (id: string) => void; onVedtak: () => void; onToast: (m: string) => void }) {
  const { funn, valgt, venter } = vedtak;
  const presedens = venter ? "venter" : valgt;
  const brev = useBrev(() => fulltBrev({ id, skjema: s, presedens }), JSON.stringify([id, s, presedens]));
  // Copying waits for the letter built from the answers as they are now; after a failed call the
  // letter shown is an older one.
  const klar = brev.svar && !brev.venter && !brev.feil ? brev.svar : null;
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
                  <p className="hint">{vedtak.endres ? "Svarene dine er endret. Vi finner vedtakene som ligner mest på nytt …" : "Finner lignende saker …"}</p>
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
                  <div className="sugg" role={vedtak.endring?.byttetFra ? "status" : undefined}>
                    <span>
                      {vedtak.endring?.byttetFra && (
                        <>
                          Svarene dine er endret, så brevet viser nå til den saken som ligner mest{vedtak.endring.byttetFra.saksnummer ? ` (før: sak ${vedtak.endring.byttetFra.saksnummer})` : ""}.{" "}
                        </>
                      )}
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
            <button type="button" className="btn pri" disabled={venter || !klar} title={venter ? "Venter på den lignende saken" : !klar ? "Brevet oppdateres" : undefined} onClick={() => {
                if (!klar) return;
                maal("brev_kopiert");
                kopier(klar.tekst, "Brevet er kopiert");
              }}>
              <Kopier />
              Kopier brevet
            </button>
            <button type="button" className="btn" disabled={!klar} onClick={() => klar && kopier(klar.emne, "Emnefeltet er kopiert")}>
              Kopier emnefelt
            </button>
            {brev.feil && (
              <p className="hint" role="status">
                {brev.feil}
              </p>
            )}
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
                  <div key={r.id} className="mr">
                    <span>
                      {r.navn}
                      <small>{r.felt.map((k) => ETIKETT[k]).join(", ")}</small>
                    </span>
                    <button type="button" className="btn sm" onClick={() => onSteg(r.id)}>
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
          <p className="fine d-fine">
            Brevet er en mal basert på forbrukerkjøpsloven og er ikke juridisk rådgivning. Forbrukerrådet gir gratis råd, og Forbrukertilsynet mekler hvis forhandleren avviser saken.{" "}
            <a href="/hvis-forhandleren-avviser" target="_blank" rel="noopener">
              Hva du kan gjøre hvis forhandleren avviser
            </a>
          </p>
        </div>
        <div className="paper d-paper">
          {brev.blokker ? <Papir blokker={brev.blokker} id="letterFull" /> : <p className="hint">Brevet hentes …</p>}
        </div>
      </div>
    </section>
  );
}
