// The purchase modal (artifact #buy). In the trial (GRATIS) it opens the letter for free, with no consent
// to give. Otherwise payment is a stub until Vipps is connected: kjop saves the case as paid in
// development and says so otherwise.
import { useEffect, useRef, useState } from "react";
import { kjop } from "@/app/sak/[id]/actions";
import { tall } from "@/lib/app/format";
import type { Kjopt, Sjekk } from "@/lib/app/saken";
import { trygt } from "@/lib/app/kall";
import { GRATIS, PRIS } from "@/lib/pris";
import { Hake, InfoSirkel, Lukk } from "./ikoner";

const PRISTEKST = GRATIS ? "Gratis" : `kr ${tall(PRIS)}`;

export function Kjop({ sjekk, forrige, apen, utvikling, onLukk, onBetalt }: { sjekk: Sjekk; forrige: string | null; apen: boolean; utvikling: boolean; onLukk: () => void; onBetalt: (k: Kjopt) => void }) {
  const [melding, settMelding] = useState<string | null>(null);
  const [venter, settVenter] = useState(false);
  // The right of withdrawal ends when the writer opens (angrerettloven § 22 n): the buyer must ask for that.
  const [samtykke, settSamtykke] = useState(false);
  const knapp = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!apen) return;
    const t = setTimeout(() => knapp.current?.focus(), 80);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onLukk();
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", esc);
    };
  }, [apen, onLukk]);

  async function betal() {
    settVenter(true);
    const r = await trygt(kjop({ sjekk, forrige, samtykke }), "Vi fikk ikke kontakt. Prøv igjen.");
    settVenter(false);
    if (r.ok) onBetalt(r.sak);
    else settMelding(r.melding);
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
          <span>{melding ?? (GRATIS ? "Brevet er gratis i en prøveperiode." : utvikling ? "Betaling er ikke koblet til ennå. I denne versjonen åpnes brevet direkte." : "Betaling er ikke koblet til ennå. Brevet kan ikke låses opp i denne versjonen.")}</span>
        </div>
        {!GRATIS && (
          <label className="ck">
            <input type="checkbox" checked={samtykke} onChange={(e) => settSamtykke(e.target.checked)} />
            <span className="ck-b" aria-hidden="true">
              <Hake />
            </span>
            <span>Jeg ber om at brevet åpnes med en gang, og forstår at angreretten da går tapt.</span>
          </label>
        )}
        <button ref={knapp} type="button" className="btn pri xl" onClick={betal} disabled={venter || (!GRATIS && !samtykke)}>
          {GRATIS ? "Åpne brevet" : "Gå til betaling"}
        </button>
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
