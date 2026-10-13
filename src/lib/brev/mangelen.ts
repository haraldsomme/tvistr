import { dato, FORSOK, TIDSFRASE } from "./format";
import { feilnavn, ledd } from "./feiltype";
import { forsokAv, RAPPORT_PUNKTER, VERKSTED_HVEM } from "./rapport";
import type { Brevsak, Setning } from "./typer";

// 2. Mangelen: one block per defect in the order the buyer chose, then the repair attempts.
export function mangelen(s: Brevsak): Setning[][] {
  const blokker = s.feil.map((f, i): Setning[] => {
    const k = `skjema:feil[${i}]`;
    const ut: Setning[] = [{ tekst: `${feilnavn(f)}: Feilen viste seg ${TIDSFRASE[f.tid]}.`, kilde: `${k}.tid` }];
    // The buyer's own words, unchanged.
    if (f.beskrivelse) ut.push({ tekst: `«${f.beskrivelse}»`, kilde: `${k}.beskrivelse` });
    if (f.verksted === "muntlig") ut.push({ tekst: "Feilen er undersøkt av verksted.", kilde: `${k}.verksted` });
    // A written report: who, when, what the buyer ticked (each tick is one fixed sentence, in the order
    // of the list) and the conclusion in the buyer's own words.
    const r = f.rapport;
    if (f.verksted === "skriftlig" && r) {
      const hvem = VERKSTED_HVEM.find((x) => x.id === r.hvem)!.brev;
      ut.push({ tekst: `Feilen er undersøkt av ${r.navn} (${hvem}) den ${dato(r.dato)}.`, kilde: `${k}.rapport.navn; ${k}.rapport.hvem; ${k}.rapport.dato` });
      for (const p of RAPPORT_PUNKTER) if (p.setning && r.punkter.includes(p.id)) ut.push({ tekst: p.setning, kilde: `${k}.rapport.punkter.${p.id}` });
      // The conclusion as the buyer copied it: a full stop after the quotes only when it ends without one.
      if (r.konklusjon) ut.push({ tekst: `Rapporten konkluderer: «${r.konklusjon}»${/[.!?]$/.test(r.konklusjon) ? "" : "."}`, kilde: `${k}.rapport.konklusjon` });
      ut.push({ tekst: "Rapporten følger vedlagt.", kilde: `${k}.rapport` });
    }
    const typer = ledd([f]).map((l) => l.type);
    if (typer.includes("vet_ikke"))
      ut.push({ tekst: "Årsaken er ennå ikke klarlagt, og jeg tar forbehold om å utvide reklamasjonen når den er det.", kilde: `${k}.hoved` });
    if (typer.includes("teknisk") && f.opplysning === "nei") ut.push({ tekst: "Dere ga ingen opplysninger om dette før kjøpet.", kilde: `${k}.opplysning` });
    return ut;
  });
  const forsok = forsokAv(s);
  if (forsok > 0)
    blokker.push([
      {
        tekst: `Dere har forsøkt å rette ${s.feil.length > 1 ? "feilene" : "feilen"} ${FORSOK[forsok]} uten at det har lykkes.`,
        kilde: "skjema:kontakt.forsok",
      },
    ]);
  return blokker;
}
