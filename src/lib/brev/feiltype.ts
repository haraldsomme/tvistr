import { komponenttype } from "@/lib/feil/kategorier";

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
