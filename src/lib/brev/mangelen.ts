import { FORSOK, TIDSFRASE } from "./format";
import { feilnavn, ledd } from "./feiltype";
import type { Brevsak, Setning } from "./typer";

// 2. Mangelen: one block per defect in the order the buyer chose, then the repair attempts.
export function mangelen(s: Brevsak): Setning[][] {
  const blokker = s.feil.map((f, i): Setning[] => {
    const k = `skjema:feil[${i}]`;
    const ut: Setning[] = [{ tekst: `${feilnavn(f)}: Feilen viste seg ${TIDSFRASE[f.tid]}.`, kilde: `${k}.tid` }];
    // The buyer's own words, unchanged.
    if (f.beskrivelse) ut.push({ tekst: `«${f.beskrivelse}»`, kilde: `${k}.beskrivelse` });
    if (f.verksted === "skriftlig") ut.push({ tekst: "Feilen er undersøkt av verksted, og verkstedets skriftlige vurdering følger vedlagt.", kilde: `${k}.verksted` });
    if (f.verksted === "muntlig") ut.push({ tekst: "Feilen er undersøkt av verksted.", kilde: `${k}.verksted` });
    const typer = ledd([f]).map((l) => l.type);
    if (typer.includes("vet_ikke"))
      ut.push({ tekst: "Årsaken er ennå ikke klarlagt, og jeg tar forbehold om å utvide reklamasjonen når den er det.", kilde: `${k}.hoved` });
    if (typer.includes("teknisk") && f.opplysning === "nei") ut.push({ tekst: "Dere ga ingen opplysninger om dette før kjøpet.", kilde: `${k}.opplysning` });
    return ut;
  });
  if (s.forsok > 0)
    blokker.push([
      {
        tekst: `Dere har forsøkt å rette ${s.feil.length > 1 ? "feilene" : "feilen"} ${FORSOK[s.forsok]} uten at det har lykkes.`,
        kilde: "skjema:forsok",
      },
    ]);
  return blokker;
}
