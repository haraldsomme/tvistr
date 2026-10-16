// The purchase modal (artifact #buy). Payment is a stub until Vipps is connected: lasOpp unlocks in
// development and says so otherwise.
import { useEffect, useRef, useState } from "react";
import { lasOpp } from "@/app/brev/actions";
import { tall } from "@/lib/app/format";
import { PRIS } from "@/lib/pris";
import { InfoSirkel, Lukk } from "./ikoner";

const PRISTEKST = `kr ${tall(PRIS)}`;

export function Kjop({ apen, onLukk, onBetalt }: { apen: boolean; onLukk: () => void; onBetalt: (ordreId: string) => void }) {
  const [melding, settMelding] = useState<string | null>(null);
  const [venter, settVenter] = useState(false);
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
    const r = await lasOpp();
    settVenter(false);
    if (r.ok) onBetalt(r.ordreId);
    else settMelding(r.melding);
  }

  return (
    <div className={`modal${apen ? " open" : ""}`} aria-hidden={!apen} onClick={(e) => e.target === e.currentTarget && onLukk()}>
      <div className="modal-in" role="dialog" aria-modal="true" aria-labelledby="buyTitle">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="offer-k">Brevskriveren</div>
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
          <span>{melding ?? "Betaling er ikke koblet til ennå. I denne versjonen åpnes brevskriveren direkte."}</span>
        </div>
        <button ref={knapp} type="button" className="btn pri xl" onClick={betal} disabled={venter}>
          Gå til betaling
        </button>
        <p className="fine" style={{ margin: 0, textAlign: "center" }}>
          Svarene fra saksvurderingen fylles inn i brevet automatisk.
        </p>
      </div>
    </div>
  );
}
