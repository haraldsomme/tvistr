import { dato } from "./format";
import { rapporter } from "./rapport";
import type { Brevsak, Setning } from "./typer";

// The enclosures follow from the answers: no input of their own. One line per report (a report that
// covers several defects is one line), then what the buyer has marked as written. Empty when none.
export function vedlegg(s: Brevsak): Setning[] {
  const ut: Setning[] = rapporter(s).map(({ rapport, feil }) => ({
    tekst: `Rapport fra ${rapport.navn} av ${dato(rapport.dato)}`,
    kilde: feil.map((f) => `skjema:feil[${s.feil.indexOf(f)}].rapport`).join("; "),
  }));
  if (s.feil.some((f) => f.opplysning === "skriftlig")) ut.push({ tekst: "Annonse/kjøpekontrakt", kilde: "skjema:feil[].opplysning" });
  if (s.utlegg.length) ut.push({ tekst: "Kvitteringer for utlegg", kilde: "skjema:utlegg" });
  if (s.kontakt?.form === "skriftlig") ut.push({ tekst: "Tidligere reklamasjon", kilde: "skjema:kontakt" });
  return ut;
}
