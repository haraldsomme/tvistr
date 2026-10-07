"use client";

import { useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { medKilde, type Kilder, type Rapport } from "@/lib/brev/utfylling";
import { JA_NEI_TEKST } from "@/app/vurdering/tekster";
import { JA_NEI, kjopsdatoAv, type Innsending } from "@/lib/vurdering/innsending";
import { Datofelt } from "../datofelt";
import { Kildefelt, Sammendrag, Skjema, Tekstfelt, valgAv, Valgfelt, type Felles } from "../felt";

const jaNei = (v: string): v is "ja" | "nei" => v === "ja" || v === "nei";

// Both report answers are given (they come from the assessment, so a new case starts with them).
export const rapportBesvart = (svar: Innsending) => jaNei(svar.verkstedrapport) && (svar.verkstedrapport !== "ja" || jaNei(svar.rapportSierForKjop));

// Whether there is a workshop or condition report, whether it says the defect was there before the
// purchase, and, when it does, what it says. The answers come from the assessment and are corrected
// here; a report that points backward in time is the strongest evidence a buyer has (`brev.ts`). Its text
// can be pasted in (`kilder.rapport`); the written letter quotes only from that. A transcript saved
// before (`sitat`) is kept as it is.
export function RapportFelt({ svar, verdi, kilder, idag, aktiv, lagre, avbryt }: Felles & { svar: Innsending; verdi: Rapport | undefined; kilder: Kilder | undefined; idag: string }) {
  const [rapport, setRapport] = useState(svar.verkstedrapport);
  const [rapportSier, setRapportSier] = useState(svar.rapportSierForKjop);
  const [fra, setFra] = useState(verdi?.fra ?? "");
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [tekst, setTekst] = useState(kilder?.rapport ?? "");

  if (!aktiv) {
    if (!rapportBesvart(svar)) return null;
    if (svar.verkstedrapport !== "ja") return <Sammendrag linjer={["Ingen verksted- eller tilstandsrapport"]} />;
    if (svar.rapportSierForKjop !== "ja") return <Sammendrag linjer={["Rapporten sier ikke om feilen var der før kjøpet"]} />;
    return (
      <Sammendrag
        linjer={
          verdi
            ? [`${verdi.fra}, ${norskDato(verdi.dato)}`, kilder?.rapport ? "Teksten fra rapporten er limt inn" : verdi.sitat ? `«${verdi.sitat}»` : null]
            : ["Rapporten sier at feilen var der før kjøpet", "Du kan lime inn teksten fra rapporten, så kan brevet sitere den."]
        }
      />
    );
  }

  const pekerBakover = rapport === "ja" && rapportSier === "ja";
  const tom = fra.trim() === "" && dato === "";
  const fylt = fra.trim().length >= 2 && dato !== "";
  const klar = jaNei(rapport) && (rapport !== "ja" || jaNei(rapportSier)) && (!pekerBakover || tom || fylt);
  const send = () =>
    lagre({
      svar: { ...svar, verkstedrapport: rapport, rapportSierForKjop: rapport === "ja" ? rapportSier : "" },
      rapport: pekerBakover && fylt ? { fra, dato, ...(verdi?.sitat && { sitat: verdi.sitat }) } : null,
      kilder: medKilde(kilder, "rapport", rapport === "ja" ? tekst : ""),
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <Valgfelt label="Har du en verksted- eller tilstandsrapport?" verdi={rapport} velg={setRapport} valg={valgAv(JA_NEI, JA_NEI_TEKST)} />
      {rapport === "ja" && <Valgfelt label="Sier rapporten at feilen sannsynligvis var til stede før kjøpet?" verdi={rapportSier} velg={setRapportSier} valg={valgAv(JA_NEI, JA_NEI_TEKST)} />}
      {pekerBakover && (
        <>
          <Tekstfelt label="Hvem skrev rapporten?" hjelp="Navnet på verkstedet, NAF-senteret eller takstmannens firma." value={fra} onChange={(e) => setFra(e.target.value.slice(0, 100))} />
          <Datofelt label="Datoen på rapporten" verdi={dato} settVerdi={setDato} min={kjopsdatoAv(svar, idag)} max={idag} />
        </>
      )}
      {rapport === "ja" && (
        <Kildefelt
          label="Lim inn teksten fra rapporten (valgfritt)"
          hjelp="Lim inn hele rapporten eller delen om feilen. Brevet siterer bare det som står her."
          verdi={tekst}
          sett={setTekst}
        />
      )}
    </Skjema>
  );
}
