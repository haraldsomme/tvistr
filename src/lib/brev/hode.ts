import type { Adresse } from "@/lib/brreg";
import { bilnavn, dato, sted } from "./format";
import type { Brevsak, Setning } from "./typer";

// The address as lines: the street lines, then «0150 Oslo». Empty when there is no address, so the
// letter is written without the lines.
const adresselinjer = (a: Adresse | null | undefined, kilde: string): Setning[] =>
  a ? [...a.linjer.map((tekst) => ({ tekst, kilde })), { tekst: `${a.postnummer} ${sted(a.poststed)}`, kilde }] : [];

// Sender top left: the buyer as Vipps gives them. Empty before payment, when the profile is not fetched.
export const avsender = (s: Brevsak): Setning[] =>
  s.kjoper ? [{ tekst: s.kjoper.navn, kilde: "vipps:navn" }, ...adresselinjer(s.kjoper.adresse, "vipps:adresse")] : [];

// Top right: «Oslo, 12. mai 2026», or only the date when the buyer's place is not known.
export const stedDato = (s: Brevsak): Setning => {
  const poststed = s.kjoper?.adresse?.poststed;
  return poststed ? { tekst: `${sted(poststed)}, ${dato(s.dato)}`, kilde: "vipps:adresse; fast:dato" } : { tekst: dato(s.dato), kilde: "fast:dato" };
};

// The seller as the register gives them: name and postal address.
export const mottaker = (s: Brevsak): Setning[] => [{ tekst: s.selger.navn, kilde: "brreg:navn" }, ...adresselinjer(s.selger.adresse, "brreg:adresse")];

export const tittel = (s: Brevsak): Setning => ({
  tekst: `REKLAMASJON – ${bilnavn(s.bil)}, reg.nr. ${s.bil.regnr}, kjøpt ${dato(s.kjopsdato)}`,
  kilde: "vegvesen:bil; skjema:kjopsdato",
});
