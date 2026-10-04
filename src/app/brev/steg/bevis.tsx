"use client";

import { useState } from "react";
import { vedleggFor } from "@/lib/brev/brev";
import { VEDLEGG, type Utfylling, type Vedlegg } from "@/lib/brev/utfylling";
import { JA_NEI_TEKST } from "@/app/vurdering/tekster";
import { JA_NEI, type Innsending } from "@/lib/vurdering/innsending";
import type { KlageInput } from "@/lib/vurdering/typer";
import { HJELP, Nedtrekk, Sammendrag, Skjema, type Felles } from "../felt";

const VEDLEGG_TEKST: Record<Vedlegg, string> = {
  kjopekontrakt: "Kjøpekontrakt",
  verkstedrapport: "Verksted- eller tilstandsrapport",
  bilder: "Bilder eller video av feilen",
  annonse: "Annonsen bilen ble solgt med",
  meldinger: "E-post eller SMS med forhandleren",
  kvitteringer: "Kvitteringer for utgifter",
};

const jaNei = (v: string): v is "ja" | "nei" => v === "ja" || v === "nei";

// Whether there is a report that points to the defect, and what the buyer encloses with the letter.
// The report answer comes from the assessment and is corrected here; a report that points backward in
// time is the strongest evidence a buyer has (`brev.ts`), inside the presumption period or outside it.
export function BevisFelt({ input, svar, utfylling, aktiv, lagre, avbryt }: Felles & { input: KlageInput; svar: Innsending; utfylling: Utfylling }) {
  const [rapport, setRapport] = useState(svar.verkstedrapport);
  const [rapportSier, setRapportSier] = useState(svar.rapportSierForKjop);
  const [valgt, setValgt] = useState<Vedlegg[]>(() => vedleggFor(input, utfylling));

  if (!aktiv) {
    if (!utfylling.vedlegg) return null;
    const rapportLinje = rapport === "ja" ? (rapportSier === "ja" ? "Verkstedrapport som sier feilen var der før kjøpet" : "Verkstedrapport") : "Ingen verkstedrapport";
    return <Sammendrag linjer={[rapportLinje, utfylling.vedlegg.length ? utfylling.vedlegg.map((v) => VEDLEGG_TEKST[v]).join(", ") : "Ingen vedlegg"]} />;
  }

  const klar = jaNei(rapport) && (rapport !== "ja" || jaNei(rapportSier));
  const send = () => lagre({ svar: { ...svar, verkstedrapport: rapport, rapportSierForKjop: rapport === "ja" ? rapportSier : "" }, vedlegg: valgt });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt} knapp="Bekreft vedlegg">
      <Nedtrekk label="Har du en verksted- eller tilstandsrapport?" value={rapport} onChange={(e) => setRapport(e.target.value as Innsending["verkstedrapport"])}>
        <option value="">Velg</option>
        {JA_NEI.map((v) => (
          <option key={v} value={v}>
            {JA_NEI_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      {rapport === "ja" && (
        <Nedtrekk label="Sier rapporten at feilen sannsynligvis var til stede før kjøpet?" value={rapportSier} onChange={(e) => setRapportSier(e.target.value as Innsending["rapportSierForKjop"])}>
          <option value="">Velg</option>
          {JA_NEI.map((v) => (
            <option key={v} value={v}>
              {JA_NEI_TEKST[v]}
            </option>
          ))}
        </Nedtrekk>
      )}
      <div className="flex flex-col gap-2">
        <p className={HJELP}>Kryss av for det du legger ved brevet.</p>
        <div className="flex flex-col gap-1.5">
          {VEDLEGG.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-[14px]">
              <input type="checkbox" checked={valgt.includes(v)} onChange={(e) => setValgt((x) => (e.target.checked ? [...x, v] : x.filter((y) => y !== v)))} className="h-[18px] w-[18px] accent-[#17263d]" />
              {VEDLEGG_TEKST[v]}
            </label>
          ))}
        </div>
      </div>
    </Skjema>
  );
}
