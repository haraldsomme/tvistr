import { erOpplysning } from "@/lib/feil/kategorier";

// A fault in what the seller said or promised (incl. a warranty): it existed at the sale, so the
// presumption for defects that show themselves later does not apply. Without a subcategory the main
// categories about what the seller said count as such.
export const opplysningsfeil = (hoved: string, under: string[]) =>
  hoved === "garanti" || (under.length ? under.every((u) => erOpplysning(hoved, u)) : ["historikk", "service", "utstyr"].includes(hoved));
