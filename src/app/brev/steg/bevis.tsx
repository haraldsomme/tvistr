"use client";

import { useState } from "react";
import { vedleggFor } from "@/lib/brev/brev";
import { VEDLEGG, type Utfylling, type Vedlegg } from "@/lib/brev/utfylling";
import { JA_NEI_TEKST } from "@/app/vurdering/tekster";
import { JA_NEI, type Innsending } from "@/lib/vurdering/innsending";
import type { KlageInput } from "@/lib/vurdering/typer";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { HJELP, Sammendrag, Skjema, valgAv, Valgfelt, type Felles } from "../felt";

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
      <Valgfelt label="Har du en verksted- eller tilstandsrapport?" verdi={rapport} velg={setRapport} valg={valgAv(JA_NEI, JA_NEI_TEKST)} />
      {rapport === "ja" && <Valgfelt label="Sier rapporten at feilen sannsynligvis var til stede før kjøpet?" verdi={rapportSier} velg={setRapportSier} valg={valgAv(JA_NEI, JA_NEI_TEKST)} />}
      <div className="flex flex-col gap-2">
        <p className={HJELP}>Kryss av for det du legger ved brevet.</p>
        <div className="flex flex-col gap-1.5">
          {VEDLEGG.map((v) => (
            <Field key={v} orientation="horizontal" className="gap-2.5">
              <Checkbox id={`vedlegg-${v}`} checked={valgt.includes(v)} onCheckedChange={(c) => setValgt((x) => (c === true ? [...x, v] : x.filter((y) => y !== v)))} />
              <FieldLabel htmlFor={`vedlegg-${v}`} className="text-[14px] font-normal">
                {VEDLEGG_TEKST[v]}
              </FieldLabel>
            </Field>
          ))}
        </div>
      </div>
    </Skjema>
  );
}
