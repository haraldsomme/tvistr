// The buyer as Vipps gives them after payment. Nothing here is asked for in the form, and nothing is
// stored beyond the session that builds the letter.
//
// This is a stub. The Vipps integration is a task of its own (docs/brev.md, «Vipps»): the real
// version fetches the profile on the server, after a confirmed payment, for the order id.
import type { Adresse } from "@/lib/brreg";

export type Vippsprofil = {
  navn: string;
  telefon: string;
  // Not every Vipps user has one registered.
  epost?: string;
  // Missing when the user has not shared an address; the letter is then written without the lines.
  adresse?: Adresse;
};

// A fictitious buyer, for development and the golden letters.
export const STUB_PROFIL: Vippsprofil = {
  navn: "Kari Testesen",
  telefon: "+47 900 00 000",
  epost: "kari.testesen@example.com",
  adresse: { linjer: ["Testveien 1"], postnummer: "0150", poststed: "Oslo" },
};

// Development only: the letter is shown in full without paying.
export const HELT_BREV_UTEN_BETALING = () => process.env.NODE_ENV !== "production" && process.env.TVISTR_HELT_BREV_UTEN_BETALING === "1";

// null until the Vipps integration exists (or outside development): nobody has paid.
export async function hentProfil(ordreId: string | null): Promise<Vippsprofil | null> {
  // The real version looks the order up and returns the profile only if the payment is confirmed.
  void ordreId;
  return HELT_BREV_UTEN_BETALING() ? STUB_PROFIL : null;
}
