import { bestemtForm, HOVEDKATEGORIER, komponenttype } from "@/lib/feil/kategorier";
import { liste, smaa } from "./format";
import type { Brevfeil } from "./typer";

// What kind of defect a choice is, which decides how the letter argues it:
//   teknisk     a part that fails: «does not match what I could expect» (§ 16 a)
//   opplysning  what the seller said or kept back (§ 16 b and c)
//   garanti     a promised warranty that was not delivered
//   vet_ikke    a symptom with no known cause: the letter only gives notice
export type Feiltype = "teknisk" | "opplysning" | "garanti" | "vet_ikke";

// Main categories about what the seller said or promised, which count as such without a subcategory.
const OPPLYSNING_UTEN_UNDER = ["historikk", "service", "utstyr"];

export function feiltype(hoved: string, under: string | null): Feiltype {
  if (hoved === "vet_ikke") return "vet_ikke";
  if (hoved === "garanti") return "garanti";
  if (under ? komponenttype(hoved, under) === "opplysning" : OPPLYSNING_UTEN_UNDER.includes(hoved)) return "opplysning";
  return "teknisk";
}

// One defect choice may hold several subcategories of different kinds (equipment: tyres and keys), so
// the letter works on one entry per subcategory, or one for the main category when none is ticked.
export type Ledd = { feil: Brevfeil; i: number; under: string | null; type: Feiltype };

export const ledd = (feil: Brevfeil[]): Ledd[] =>
  feil.flatMap((f, i) => (f.under.length ? f.under : [null]).map((under) => ({ feil: f, i, under, type: feiltype(f.hoved, under) })));

// «Turbo», «Turbo og kjøling og topplokk», or the main category's name when no subcategory is ticked.
export function feilnavn(f: Brevfeil): string {
  const h = HOVEDKATEGORIER.find((x) => x.id === f.hoved);
  if (!h) throw new Error(`Ukjent hovedkategori: ${f.hoved}`);
  const navn = f.under.map((u) => h.under.find((x) => x.id === u)?.navn ?? u);
  if (!navn.length) return h.navn;
  const smaaNavn = navn.map((n, i) => (i ? smaa(n) : n));
  // A name that has «og» or a comma in it would read as several with «og» between them.
  return smaaNavn.some((n) => /\bog\b|,/.test(n)) ? smaaNavn.join("; ") : liste(smaaNavn);
}

// «servicehistorikken», for sentences about what the seller said.
export function form(l: Ledd): string {
  const f = bestemtForm(l.feil.hoved, l.under);
  if (!f) throw new Error(`Ingen bestemt form for ${l.feil.hoved}.${l.under ?? ""}`);
  return f;
}
