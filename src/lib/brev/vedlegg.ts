import { dato } from "./format";
import { tekniskFeil, tekniskSa } from "./feiltype";
import { rapporter } from "./rapport";
import type { Brevfeil, Brevsak, Setning } from "./typer";

// What a kind of defect is documented with, whatever the buyer has answered: the vehicle register for
// the mileage, the service book for the service history, and so on.
const VEDLEGG_AV_UNDER: Record<string, string> = {
  "historikk.km": "Utskrift fra Statens vegvesen",
  // Not for «Servicehefte mangler»: the book that is missing cannot be enclosed.
  "service.service": "Servicehefte",
  "historikk.skade": "Utskrift fra Statens vegvesen eller skaderapport",
  "historikk.eu": "EU-kontrollseddel",
};

// The advert or contract is enclosed for what the seller wrote about the defect: always for what the
// seller said or promised, and for a technical defect only when the seller wrote that it was in order.
export const annonse = (f: Brevfeil) => f.opplysning === "skriftlig" && (!tekniskFeil(f) || tekniskSa(f) === "i_orden");

// The enclosures one defect brings by its category, each once.
export const kategorivedlegg = (f: Brevfeil): string[] => [...new Set(f.under.flatMap((u) => VEDLEGG_AV_UNDER[`${f.hoved}.${u}`] ?? []))];

// The enclosures follow from the answers: no input of their own. One line per report (a report that
// covers several defects is one line), then the documents that belong to the kind of defect, then what
// the buyer has marked as written. A text already in the list is not added twice. Empty when none.
export function vedlegg(s: Brevsak): Setning[] {
  const ut: Setning[] = rapporter(s).map(({ rapport, feil }) => ({
    tekst: `Rapport fra ${rapport.navn} av ${dato(rapport.dato)}`,
    kilde: feil.map((f) => `skjema:feil[${s.feil.indexOf(f)}].rapport`).join("; "),
  }));
  for (const [i, f] of s.feil.entries())
    for (const tekst of kategorivedlegg(f)) {
      const finnes = ut.find((x) => x.tekst === tekst);
      if (finnes) finnes.kilde += `; skjema:feil[${i}].under`;
      else ut.push({ tekst, kilde: `skjema:feil[${i}].under` });
    }
  // What the seller wrote, when it helps the buyer: not a written word about the technical defect itself.
  if (s.feil.some(annonse)) ut.push({ tekst: "Annonse/kjøpekontrakt", kilde: "skjema:feil[].opplysning" });
  if (s.utlegg.length) ut.push({ tekst: "Kvitteringer for utlegg", kilde: "skjema:utlegg" });
  if (s.kontakt?.form === "skriftlig") ut.push({ tekst: "Tidligere reklamasjon", kilde: "skjema:kontakt" });
  return ut;
}
