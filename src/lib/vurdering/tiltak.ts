import type { Faktorer } from "./faktorer";

export type Tiltak = { tittel: string; tekst: string };

// What the user can do to strengthen the case, based on the answers about evidence. A well
// documented case gets few or none.
export function foreslaTiltak(f: Faktorer): Tiltak[] {
  const tiltak: Tiltak[] = [];

  // The single most common reason for losing: the buyer must show that the defect was there at
  // delivery, and a report that only names the fault does not do that.
  if (!f.verkstedrapport) {
    tiltak.push({
      tittel: "Få en verksted- eller tilstandsrapport",
      tekst:
        "Be et uavhengig verksted undersøke feilen og skrive hva den er, hva som er årsaken, og om den sannsynligvis var til stede da du kjøpte bilen. Det siste er ofte avgjørende for resultatet. Ta vare på fakturaen.",
    });
  } else if (f.rapportSierForKjop === false) {
    tiltak.push({
      tittel: "Be et uavhengig verksted vurdere når feilen oppsto",
      tekst:
        "Rapporten din sier ikke om feilen var til stede før kjøpet, og det er ofte avgjørende for resultatet. Be verkstedet skrive en kort vurdering av årsaken og om feilen sannsynligvis fantes da du overtok bilen, gjerne som et tillegg til rapporten.",
    });
  }
  if (!f.verkstedrapport && !f.bilder) {
    tiltak.push({
      tittel: "Dokumenter feilen med bilder eller film",
      tekst: "Ta bilder eller film av feilen slik den er nå, og av det som er skadet. Vent med å utbedre noe til feilen er dokumentert.",
    });
  }
  if (f.opplystForKjop === "usikker") {
    tiltak.push({
      tittel: "Sjekk annonsen og kontrakten",
      tekst:
        "Se etter hva som ble sagt eller skrevet om feilen før kjøpet, i annonsen, kontrakten og meldinger. Var feilen nevnt, svekker det saken. Var den ikke nevnt, eller beskrevet som noe annet, styrker det den.",
    });
  }
  if (f.feilOpplysninger && !f.feilOpplysningerDokumentert) {
    tiltak.push({
      tittel: "Ta vare på annonsen og meldingene",
      tekst:
        "Ta skjermbilder eller lagre annonsen bilen ble solgt med, og meldinger med forhandleren. Annonser blir ofte fjernet etter salget, og det forhandleren oppga der kan ha stor betydning for saken.",
    });
  }
  return tiltak;
}
