import type { SjekkNokkel } from "@/lib/brev/utfylling";
import type { Faktorer } from "@/lib/vurdering/faktorer";
import { andel, MIN_N, type Andel, type BevisTall, type ForFa } from "../typer";

export type Sjekkpunkt = { nokkel: SjekkNokkel; tittel: string; tekst: string; andel?: Andel | ForFa; sjekket: boolean };

type Mal = { nokkel: SjekkNokkel; tittel: string; tekst: string; bevis?: keyof Omit<BevisTall, "nMedhold"> };

// The two most common reasons for losing: the defect was not shown to have been there at delivery, and
// it was seen as wear the buyer had to expect (see tiltak.ts). The first points answer those.
export function styrkPunkter(
  f: Pick<Faktorer, "verkstedrapport" | "bilder" | "rapportSierForKjop" | "feilOpplysninger" | "feilOpplysningerDokumentert">,
  b: BevisTall,
  sjekket: SjekkNokkel[],
): Sjekkpunkt[] {
  const mal: Mal[] = [];
  if (!f.verkstedrapport) {
    mal.push({
      nokkel: "rapport_tidspunkt",
      tittel: "Få en verksted- eller tilstandsrapport",
      tekst: "Be et uavhengig verksted skrive hva feilen er, årsaken, om den sannsynligvis var der da du kjøpte bilen, og om den er mer enn normal slitasje for alder og kilometerstand. Ta vare på fakturaen.",
      bevis: "verkstedrapport",
    });
  } else if (f.rapportSierForKjop === false) {
    mal.push({
      nokkel: "rapport_tidspunkt",
      tittel: "Be verkstedet vurdere når feilen oppsto",
      tekst: "Rapporten din sier ikke om feilen var der før kjøpet. Be om en kort vurdering av årsaken og om feilen er mer enn normal slitasje, gjerne som tillegg til rapporten.",
      bevis: "verkstedrapport",
    });
  }
  if (!f.verkstedrapport && !f.bilder) {
    mal.push({ nokkel: "bilder", tittel: "Dokumenter feilen med bilder eller film", tekst: "Ta bilder eller film av feilen slik den er nå. Vent med å utbedre noe til feilen er dokumentert.", bevis: "bilder" });
  } else {
    mal.push({ nokkel: "bilder", tittel: "Samle bilder og film av feilen", tekst: "Legg dem ved brevet, med dato der det går an.", bevis: "bilder" });
  }
  mal.push(
    { nokkel: "annonse", tittel: "Lagre annonsen", tekst: "Ta skjermbilder eller lagre annonsen bilen ble solgt med. Annonser blir ofte fjernet etter salget." },
    { nokkel: "meldinger", tittel: "Samle meldingene med forhandleren", tekst: "E-post, SMS og chat om bilen og om feilen, med datoer." },
    { nokkel: "kontrakt", tittel: "Finn kjøpekontrakten", tekst: "Se etter «som den er», garanti og hva som ble avtalt om tilstand." },
    { nokkel: "kvitteringer", tittel: "Samle kvitteringer for utgifter", tekst: "Verksted, tauing, leiebil og andre utgifter feilen har gitt deg. De kan kreves som erstatning.", bevis: "kvittering" },
  );
  return mal.map((m) => ({
    nokkel: m.nokkel,
    tittel: m.tittel,
    tekst: m.tekst,
    ...(m.bevis && { andel: andel(b[m.bevis], b.nMedhold, MIN_N) }),
    sjekket: sjekket.includes(m.nokkel),
  }));
}
