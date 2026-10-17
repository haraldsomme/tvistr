// Used only from client components.
import { useState } from "react";
import { FMT, validReg } from "@/lib/app/format";
import { NYTT_KJOP } from "@/lib/pris";
import { Hake, Info, Skiltband } from "./ikoner";

export type Bil = { make: string; model: string; year: string; lastReg: string };
type Status = { s: "idle" } | { s: "loading" } | { s: "found"; bil: Bil; note?: string } | { s: "none"; melding?: string };

const TOM = "Skriv registreringsnummeret og trykk «Hent bilen», så fyller vi inn merke, modell og årsmodell.";

// The plate and «Hent bilen»: Statens vegvesen through /api/kjoretoy, on demand only.
// `laast`: the car the letter was bought for; it cannot be changed.
export function Skilt({ id, verdi, onEndre, onBil, funnet, laast }: { id: string; verdi: string; onEndre: (v: string) => void; onBil: (b: Bil) => void; funnet?: Bil | null; laast?: boolean }) {
  const [status, settStatus] = useState<Status>(funnet ? { s: "found", bil: funnet, note: "fylt inn" } : { s: "idle" });

  async function hent() {
    if (!validReg(verdi)) return;
    settStatus({ s: "loading" });
    try {
      const r = await fetch(`/api/kjoretoy?regnr=${encodeURIComponent(verdi)}`);
      const j = (await r.json()) as { kjoretoy?: { merke: string; modell: string; ar: number | null }; eierFra?: string | null; feil?: string };
      if (!r.ok || !j.kjoretoy) return settStatus({ s: "none", melding: j.feil });
      const bil = { make: j.kjoretoy.merke, model: j.kjoretoy.modell, year: j.kjoretoy.ar ? String(j.kjoretoy.ar) : "", lastReg: j.eierFra ?? "" };
      onBil(bil);
      settStatus({ s: "found", bil, note: "fylt inn" });
    } catch {
      settStatus({ s: "none", melding: "Vi fikk ikke kontakt med Statens vegvesen. Prøv igjen om litt." });
    }
  }

  return (
    <div className="reg-row">
      <div className="plate">
        <Skiltband />
        <input
          id={id}
          value={verdi}
          onChange={(e) => {
            onEndre(FMT.reg(e.target.value));
            settStatus({ s: "idle" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              hent();
            }
          }}
          enterKeyHint="search"
          placeholder="AB 12345"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          readOnly={laast}
        />
      </div>
      {!laast && (
        <button type="button" className="btn reg-btn" disabled={!validReg(verdi)} onClick={hent}>
          Hent bilen
        </button>
      )}
      <div className="lk" data-state={laast ? "found" : status.s} aria-live="polite">
        {laast ? (
          <span>Brevet gjelder denne bilen. Et brev for en annen bil krever {NYTT_KJOP}.</span>
        ) : status.s === "loading" ? (
          <>
            <span className="spin" aria-hidden="true" />
            Henter bilen …
          </>
        ) : status.s === "found" ? (
          <>
            <Hake s={13} />
            <span>
              <b>
                {status.bil.make} {status.bil.model}
              </b>
              {status.bil.year && `, årsmodell ${status.bil.year}`}
              {status.note && ` · ${status.note}`}
            </span>
          </>
        ) : status.s === "none" ? (
          <>
            <Info />
            <span>{status.melding ?? "Fant ikke bilen."} Fyll inn merke og modell selv.</span>
          </>
        ) : (
          <span>{TOM}</span>
        )}
      </div>
    </div>
  );
}
