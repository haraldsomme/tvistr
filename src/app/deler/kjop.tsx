// The purchase modal (artifact #buy), a <dialog>. The buyer gives up the right of withdrawal and pays
// with Vipps: kjop saves the draft as the case and answers with Vipps' page, and Vipps sends them back
// to the confirmation (/betaling/[ref]). In development (TVISTR_HELT_BREV_UTEN_BETALING) the case opens
// without Vipps.
import { useEffect, useRef, useState } from "react";
import { kjop } from "@/app/sak/[id]/actions";
import { tall } from "@/lib/app/format";
import { trygt } from "@/lib/app/kall";
import type { Utkast } from "@/lib/app/utkast";
import { PRIS } from "@/lib/pris";
import { Hake, InfoSirkel, Lukk } from "./ikoner";
import { VippsKnapp } from "./vipps-knapp";

const PRISTEKST = `kr ${tall(PRIS)}`;

export function Kjop({ utkast, apen, utvikling, onLukk }: { utkast: Utkast; apen: boolean; utvikling: boolean; onLukk: () => void }) {
  const [melding, settMelding] = useState<string | null>(null);
  const [venter, settVenter] = useState(false);
  // The right of withdrawal ends when the writer opens (angrerettloven § 22 n): the buyer must ask for that.
  const [samtykke, settSamtykke] = useState(false);
  const vindu = useRef<HTMLDialogElement>(null);
  const avkrysning = useRef<HTMLInputElement>(null);

  // Escape closes the dialog itself, and its close event tells the page.
  useEffect(() => {
    const d = vindu.current;
    if (!d) return;
    if (apen && !d.open) {
      d.showModal();
      avkrysning.current?.focus();
    } else if (!apen && d.open) d.close();
  }, [apen]);

  async function betal() {
    settVenter(true);
    const r = await trygt(kjop({ utkast, samtykke }), "Vi fikk ikke kontakt. Prøv igjen.");
    // Vipps' page is opened as it is, in this window, and so is the confirmation; the button stays off
    // until the browser leaves.
    if (r.ok) return void (window.location.href = r.url);
    settVenter(false);
    settMelding(r.melding);
  }

  return (
    <dialog ref={vindu} className="modal" aria-labelledby="buyTitle" onClose={onLukk} onClick={(e) => e.target === e.currentTarget && onLukk()}>
      <div className="modal-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="offer-k">Brevet</div>
            <h3 id="buyTitle" style={{ fontSize: 22, letterSpacing: "-.02em", fontWeight: 600, marginTop: 6 }}>
              Fullfør kjøpet
            </h3>
          </div>
          <button type="button" className="x" onClick={onLukk} aria-label="Lukk">
            <Lukk />
          </button>
        </div>
        <div className="order">
          <div>
            <span>Reklamasjonsbrev for bil</span>
            <span>{PRISTEKST}</span>
          </div>
          <div>
            <span>Totalt, engangsbeløp</span>
            <span>{PRISTEKST}</span>
          </div>
        </div>
        <div className="demo-note">
          <InfoSirkel />
          <span>{melding ?? (utvikling ? "Utvikling: brevet åpnes uten Vipps." : "Du betaler i Vipps-appen og deler navn, e-post og adresse til brevet. Lenken til saken sendes på e-post.")}</span>
        </div>
        <label className="ck">
          <input ref={avkrysning} type="checkbox" checked={samtykke} onChange={(e) => settSamtykke(e.target.checked)} />
          <span className="ck-b" aria-hidden="true">
            <Hake />
          </span>
          <span>Jeg ber om at brevet åpnes med en gang, og forstår at angreretten da går tapt.</span>
        </label>
        <VippsKnapp onClick={betal} deaktivert={venter || !samtykke} bred />
        <p className="fine" style={{ margin: 0, textAlign: "center" }}>
          Svarene fra saksvurderingen fylles inn i brevet automatisk. Ved å betale godtar du{" "}
          <a href="/vilkar" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>
            vilkårene
          </a>
          . Les hvordan vi behandler opplysningene i{" "}
          <a href="/personvern" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>
            personvernerklæringen
          </a>
          .
        </p>
      </div>
    </dialog>
  );
}
