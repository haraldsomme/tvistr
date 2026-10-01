import type { Faktorer } from "./faktorer";

// `steg` points back to the form step where the user can fix it.
export type Tiltak = { tittel: string; tekst: string; steg?: 2 };

// What the user can get hold of before the letter is written, based on the evidence they did not tick.
export function foreslaTiltak(f: Faktorer): Tiltak[] {
  const b = f.bevisValgt;
  const tiltak: Tiltak[] = [];

  if (f.beskrivelseKvalitet === "ubrukelig") {
    tiltak.push({
      tittel: "Beskriv feilen",
      tekst:
        "Beskrivelsen din sier ikke hva som er galt med bilen, og da kan vi verken vurdere saken eller skrive et brev. Skriv hva som skjer, når det begynte, og hva et verksted eventuelt har funnet.",
      steg: 2,
    });
  } else if (f.beskrivelseKvalitet === "tynn") {
    tiltak.push({
      tittel: "Beskriv feilen mer detaljert",
      tekst:
        "Beskrivelsen din sier hva som er galt, men lite om når det begynte, hvordan det arter seg, og hva et verksted har funnet. Med det blir både vurderingen og brevet mer treffsikre.",
      steg: 2,
    });
  }

  if (!b.kjopekontrakt) {
    tiltak.push({
      tittel: "Finn kjøpekontrakten",
      tekst:
        "Den viser hva som ble avtalt, om bilen ble solgt «som den er», og hva forhandleren har lovet. Har du ikke en kopi, be forhandleren sende den.",
    });
  }
  // The single most common reason for losing: the buyer must show that the defect was there at
  // delivery, and a report that only names the fault does not do that.
  if (!b.verkstedrapport) {
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
  const gjelderOpplysninger =
    f.mangelsgrunnlag.some((g) => g === "feil_opplysninger" || g === "avvik_fra_avtale") ||
    f.feiltyper.some((t) => t === "km_avvik" || t === "servicehistorikk" || t === "bruktimport_opplysning");
  if (!b.annonse && gjelderOpplysninger) {
    tiltak.push({
      tittel: "Ta vare på annonsen",
      tekst:
        "Ta skjermbilder eller lagre annonsen bilen ble solgt med. Annonser blir ofte fjernet etter salget, og det forhandleren oppga der kan ha betydning for saken.",
    });
  }
  if (!b.bilder) {
    tiltak.push({
      tittel: "Dokumenter feilen med bilder eller film",
      tekst: "Ta bilder eller film av feilen slik den er nå, og av det som er skadet. Vent med å utbedre noe til feilen er dokumentert.",
    });
  }
  return tiltak;
}
