"use client";

import { useId, useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { RAPPORT_SITAT_MAKS, type Rapport } from "@/lib/brev/utfylling";
import { JA_NEI_TEKST } from "@/app/vurdering/tekster";
import { JA_NEI, kjopsdatoAv, type Innsending } from "@/lib/vurdering/innsending";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Datofelt } from "../datofelt";
import { HJELP, Sammendrag, Skjema, Tekstfelt, valgAv, Valgfelt, type Felles } from "../felt";

const jaNei = (v: string): v is "ja" | "nei" => v === "ja" || v === "nei";

// Both report answers are given (they come from the assessment, so a new case starts with them).
export const rapportBesvart = (svar: Innsending) => jaNei(svar.verkstedrapport) && (svar.verkstedrapport !== "ja" || jaNei(svar.rapportSierForKjop));

// Whether there is a workshop or condition report, whether it says the defect was there before the
// purchase, and, when it does, what it says. The answers come from the assessment and are corrected
// here; a report that points backward in time is the strongest evidence a buyer has (`brev.ts`). What it
// says is the buyer's own transcript, quoted as written in the letter, and may be left out.
export function RapportFelt({ svar, verdi, idag, aktiv, lagre, avbryt }: Felles & { svar: Innsending; verdi: Rapport | undefined; idag: string }) {
  const id = useId();
  const [rapport, setRapport] = useState(svar.verkstedrapport);
  const [rapportSier, setRapportSier] = useState(svar.rapportSierForKjop);
  const [fra, setFra] = useState(verdi?.fra ?? "");
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [sitat, setSitat] = useState(verdi?.sitat ?? "");

  if (!aktiv) {
    if (!rapportBesvart(svar)) return null;
    if (svar.verkstedrapport !== "ja") return <Sammendrag linjer={["Ingen verksted- eller tilstandsrapport"]} />;
    if (svar.rapportSierForKjop !== "ja") return <Sammendrag linjer={["Rapporten sier ikke om feilen var der før kjøpet"]} />;
    return (
      <Sammendrag
        linjer={
          verdi
            ? [`${verdi.fra}, ${norskDato(verdi.dato)}`, `«${verdi.sitat}»`]
            : ["Rapporten sier at feilen var der før kjøpet", "Du kan gjengi hva den sier, så står det i brevet."]
        }
      />
    );
  }

  const pekerBakover = rapport === "ja" && rapportSier === "ja";
  const tom = fra.trim() === "" && dato === "" && sitat.trim() === "";
  const fylt = fra.trim().length >= 2 && dato !== "" && sitat.trim().length >= 5;
  const klar = jaNei(rapport) && (rapport !== "ja" || jaNei(rapportSier)) && (!pekerBakover || tom || fylt);
  const send = () =>
    lagre({
      svar: { ...svar, verkstedrapport: rapport, rapportSierForKjop: rapport === "ja" ? rapportSier : "" },
      rapport: pekerBakover && fylt ? { fra, dato, sitat } : null,
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <Valgfelt label="Har du en verksted- eller tilstandsrapport?" verdi={rapport} velg={setRapport} valg={valgAv(JA_NEI, JA_NEI_TEKST)} />
      {rapport === "ja" && <Valgfelt label="Sier rapporten at feilen sannsynligvis var til stede før kjøpet?" verdi={rapportSier} velg={setRapportSier} valg={valgAv(JA_NEI, JA_NEI_TEKST)} />}
      {pekerBakover && (
        <>
          <Tekstfelt label="Hvem skrev rapporten?" hjelp="Navnet på verkstedet, NAF-senteret eller takstmannens firma." value={fra} onChange={(e) => setFra(e.target.value.slice(0, 100))} />
          <Datofelt label="Datoen på rapporten" verdi={dato} settVerdi={setDato} min={kjopsdatoAv(svar, idag)} max={idag} />
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`${id}-sitat`}>Hva sier rapporten om årsaken og når feilen oppsto?</FieldLabel>
            <Textarea
              id={`${id}-sitat`}
              aria-describedby={`${id}-sitat-hjelp`}
              value={sitat}
              onChange={(e) => setSitat(e.target.value.slice(0, RAPPORT_SITAT_MAKS))}
              placeholder="Slitasjen på clutchen tilsier at den var defekt før september 2025"
              className="min-h-[96px]"
            />
            <FieldDescription id={`${id}-sitat-hjelp`} className={HJELP}>
              Skriv så ordrett du kan, dette vil stå sitert i anførselstegn i brevet. Du kan la de tre feltene stå tomme.
            </FieldDescription>
          </Field>
        </>
      )}
    </Skjema>
  );
}
