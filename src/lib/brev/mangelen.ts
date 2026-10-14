import { dato, FORSOK, liste, naar, smaa } from "./format";
import { feilnavn, ledd } from "./feiltype";
import { forsokAv, RAPPORT_PUNKTER, reklamerte, VERKSTED_HVEM } from "./rapport";
import type { Brevfeil, Brevsak, Setning } from "./typer";
import { kategorivedlegg } from "./vedlegg";

// «Turbo», «Turbo og lys»: the defects a sentence is about, the first with a capital.
const navnene = (fs: Brevfeil[], stor: boolean) => liste(fs.map((f, i) => (i === 0 && stor ? feilnavn(f) : smaa(feilnavn(f)))));
const kilder = (s: Brevsak, fs: Brevfeil[], felt: string) => fs.map((f) => `skjema:feil[${s.feil.indexOf(f)}].${felt}`).join("; ");

// 2. Mangelen: the complaint, one block per defect in the order the buyer chose, then what this letter
// complains about besides the earlier complaint, and the repair attempts.
export function mangelen(s: Brevsak): Setning[][] {
  const { tidligere, nye } = reklamerte(s);
  // Without an earlier complaint the letter is the complaint, and says so. A symptom with no known
  // cause is not called a defect.
  const innledning: Setning[][] = s.kontakt
    ? []
    : [[{ tekst: `Jeg reklamerer herved på følgende ${s.feil.every((f) => f.hoved === "vet_ikke") ? "feil" : s.feil.length > 1 ? "mangler" : "mangel"}.`, kilde: "skjema:kontakt" }]];
  const blokker = s.feil.map((f, i): Setning[] => {
    const k = `skjema:feil[${i}]`;
    const ut: Setning[] = [{ tekst: `${feilnavn(f)}: Feilen viste seg ${naar(f.oppdaget, f.omtrentlig)}.`, kilde: `${k}.oppdaget` }];
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
    // The documents the kind of defect is shown with, by name, as in the list of enclosures.
    const dok = kategorivedlegg(f);
    if (dok.length) ut.push({ tekst: `${liste(dok)} vedlegges.`, kilde: `${k}.under` });
    return ut;
  });
  // Defects discovered after the earlier complaint were not in it: this letter complains about them.
  if (s.kontakt && nye.length) blokker.push([{ tekst: `${navnene(nye, true)} reklameres herved.`, kilde: `skjema:kontakt; ${kilder(s, nye, "oppdaget")}` }]);
  // The repairs tried were on the defects of the earlier complaint.
  const forsok = forsokAv(s);
  if (forsok > 0 && tidligere.length)
    blokker.push([
      {
        tekst: `Dere har forsøkt å rette ${nye.length ? navnene(tidligere, false) : tidligere.length > 1 ? "feilene" : "feilen"} ${FORSOK[forsok]} uten at det har lykkes.`,
        kilde: `skjema:kontakt.forsok${nye.length ? `; ${kilder(s, tidligere, "oppdaget")}` : ""}`,
      },
    ]);
  return [...innledning, ...blokker];
}
