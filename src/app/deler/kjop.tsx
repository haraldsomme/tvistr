// The purchase modal (artifact #buy). The buyer gives up the right of withdrawal and pays with Vipps:
// kjop saves the case and answers with Vipps' page, and Vipps sends them back to the confirmation
// (/betaling/[ref]). In
// development (TVISTR_HELT_BREV_UTEN_BETALING) the case opens without Vipps; in a trial (GRATIS) it is
// free, with no consent to give.
import { useEffect, useRef, useState } from "react";
import { kjop } from "@/app/sak/[id]/actions";
import { tall } from "@/lib/app/format";
import type { Sjekk } from "@/lib/app/saken";
import { trygt } from "@/lib/app/kall";
import { GRATIS, PRIS } from "@/lib/pris";
import { Hake, InfoSirkel, Lukk } from "./ikoner";
import { VippsKnapp } from "./vipps-knapp";

const PRISTEKST = GRATIS ? "Gratis" : `kr ${tall(PRIS)}`;

export function Kjop({ sjekk, apen, utvikling, onLukk }: { sjekk: Sjekk; apen: boolean; utvikling: boolean; onLukk: () => void }) {
  const [melding, settMelding] = useState<string | null>(null);
  const [venter, settVenter] = useState(false);
  // The right of withdrawal ends when the writer opens (angrerettloven § 22 n): the buyer must ask for that.
  const [samtykke, settSamtykke] = useState(false);
  const knapp = useRef<HTMLButtonElement>(null);
  const avkrysning = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!apen) return;
    const t = setTimeout(() => (knapp.current ?? avkrysning.current)?.focus(), 80);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onLukk();
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", esc);
    };
  }, [apen, onLukk]);

  async function betal() {
    settVenter(true);
    const r = await trygt(kjop({ sjekk, samtykke }), "Vi fikk ikke kontakt. Prøv igjen.");
    // Vipps' page is opened as it is, in this window, and so is the confirmation; the button stays off
    // until the browser leaves.
    if (r.ok) return void (window.location.href = r.url);
    settVenter(false);
    settMelding(r.melding);
  }

  return (
    <div className={`modal${apen ? " open" : ""}`} aria-hidden={!apen} onClick={(e) => e.target === e.currentTarget && onLukk()}>
      <div className="modal-in" role="dialog" aria-modal="true" aria-labelledby="buyTitle">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="offer-k">Brevet</div>
            <h3 id="buyTitle" style={{ fontSize: 22, letterSpacing: "-.02em", fontWeight: 600, marginTop: 6 }}>
              {GRATIS ? "Åpne brevet" : "Fullfør kjøpet"}
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
            <span>{GRATIS ? "Totalt" : "Totalt, engangsbeløp"}</span>
            <span>{PRISTEKST}</span>
          </div>
        </div>
        <div className="demo-note">
          <InfoSirkel />
          <span>{melding ?? (GRATIS ? "Brevet er gratis i en prøveperiode." : utvikling ? "Utvikling: brevet åpnes uten Vipps." : "Du betaler i Vipps-appen og deler navn, e-post og adresse til brevet. Lenken til saken sendes på e-post.")}</span>
        </div>
        {!GRATIS && (
          <label className="ck">
            <input ref={avkrysning} type="checkbox" checked={samtykke} onChange={(e) => settSamtykke(e.target.checked)} />
            <span className="ck-b" aria-hidden="true">
              <Hake />
            </span>
            <span>Jeg ber om at brevet åpnes med en gang, og forstår at angreretten da går tapt.</span>
          </label>
        )}
        {GRATIS ? (
          <button ref={knapp} type="button" className="btn pri xl" onClick={betal} disabled={venter}>
            Åpne brevet
          </button>
        ) : (
          <VippsKnapp onClick={betal} deaktivert={venter || !samtykke} bred />
        )}
        <p className="fine" style={{ margin: 0, textAlign: "center" }}>
          Svarene fra saksvurderingen fylles inn i brevet automatisk. Ved å {GRATIS ? "åpne brevet" : "betale"} godtar du{" "}
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
    </div>
  );
}
