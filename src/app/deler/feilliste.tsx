// The buyer's defects as a checklist (mockup 4b, 4c on mobile): one card per main category, and
// under a chosen card its subcategories as rows to tick. Locked, it shows what the case holds.
import { Hake } from "@/app/deler/ikoner";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";

const C = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const IKON: Record<string, string> = {
  motor: "M4 10h2V8h3V6h6v2h2l2 2h1v6h-1l-2 2H9l-2-2H6v-2H4zM2 11v4M12 6V4M10 4h4",
  drivlinje: C(6, 5, 2) + C(12, 5, 2) + C(18, 5, 2) + C(6, 19, 2) + C(12, 19, 2) + "M6 7v10M12 7v10M18 7v5H6",
  understell: C(12, 12, 9) + C(12, 12, 2) + "M3.5 10.5l6.6 1M13.9 11.5l6.6-1M12 14v7",
  karosseri: "M19 17h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4a1 1 0 0 0 1 1h2M9 17h6" + C(7, 17, 2) + C(17, 17, 2),
  fukt: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  elektrisk: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  klima: "M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z",
  hoyvolt: "M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1M11 7l-3 5h4l-3 5M22 11v2",
  utstyr: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  service: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  historikk: C(12, 12, 9) + "M12 7v5l3 2",
  garanti: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  vet_ikke: C(12, 12, 9) + "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
};
const SPORSMAL: Record<string, string> = {
  motor: "Hva merker du på motoren eller eksosen?",
  drivlinje: "Hvor i drivlinjen ligger feilen?",
  understell: "Hva er det som ikke fungerer?",
  karosseri: "Hva slags skade gjelder det?",
  fukt: "Hva har du funnet i kupeen?",
  elektrisk: "Hva virker ikke som det skal?",
  klima: "Hva fungerer ikke?",
  hoyvolt: "Hva er problemet med batteriet eller ladingen?",
  utstyr: "Hva stemmer ikke med det som ble lovet?",
  service: "Hva stemmer ikke med servicen?",
  historikk: "Hva ble ikke opplyst før kjøpet?",
  vet_ikke: "Hva merker du?",
};

// The category's icon in its tile, also on the form's card for each defect.
export function FeilIkon({ id }: { id: string }) {
  return (
    <span className="ico" aria-hidden="true">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={IKON[id]} />
      </svg>
    </span>
  );
}

type Props = {
  valgt: string[];
  under: Record<string, string[]>;
  // Without these the list is locked, and shows only the chosen categories.
  onKategori?: (c: string) => void;
  onUnder?: (c: string, u: string) => void;
};

export function FeilListe({ valgt, under, onKategori, onUnder }: Props) {
  const laast = !onKategori;
  const kategorier = laast ? HOVEDKATEGORIER.filter((h) => valgt.includes(h.id)) : HOVEDKATEGORIER;
  return (
    <div className={`fl${laast ? " laast" : ""}`}>
      {kategorier.map((h) => {
        const pa = valgt.includes(h.id);
        const sel = under[h.id] ?? [];
        const n = h.under.filter((u) => sel.includes(u.id)).length;
        return (
          <div key={h.id} className={`fl-c${pa ? " on" : ""}`}>
            <button type="button" role="checkbox" aria-checked={pa} className="fl-h" disabled={laast} onClick={() => onKategori?.(h.id)}>
              <FeilIkon id={h.id} />
              <span className="fl-n">{h.navn}</span>
              {pa && n > 0 && <span className="fl-cnt">{n} valgt</span>}
              <span className="fl-box" aria-hidden="true">
                <Hake />
              </span>
            </button>
            {pa && h.under.length > 0 && (
              <div className="fl-s">
                <span className="fl-q">{SPORSMAL[h.id] ?? "Hva gjelder det?"}</span>
                <div className="fl-g" role="group" aria-label={h.navn}>
                  {h.under.map((u) => (
                    <button key={u.id} type="button" role="checkbox" aria-checked={sel.includes(u.id)} className="fl-u" disabled={laast} onClick={() => onUnder?.(h.id, u.id)}>
                      <span className="fl-box" aria-hidden="true">
                        <Hake />
                      </span>
                      {u.navn}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
