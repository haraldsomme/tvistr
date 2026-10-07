import { TOM_INNSENDING, type Innsending } from "@/lib/vurdering/innsending";
import type { Feilen, Utfylling } from "../utfylling";
import { lagSaksmodell, type Grunnlag, type Saksmodell } from "./saksmodell";

// Made-up answers and fill-in for the tests of the writing engine: no real names, addresses or plates.
export const IDAG = "2026-10-02";

export const svar = (endring: Partial<Innsending> = {}): Innsending => ({
  ...TOM_INNSENDING,
  kjopsform: "forhandler",
  kjopAlder: "under_2",
  kjopsdato: "2026-03-12",
  kjopesum: "250000",
  kmVedKjop: "80000",
  feiltyper: ["motor"],
  oppdaget: "innen_6_mnd",
  opplystForKjop: "nei",
  feilOpplysning: "nei",
  kontakt: "nei",
  verkstedrapport: "nei",
  bilder: "nei",
  ...endring,
});

export const feilen: Feilen = { dato: "2026-04-02", egen: "Motorlampen lyser og bilen mister kraft i motbakker.", feil: ["Motoren"], avsnitt: ["Motorlampen lyser, og bilen mister kraft i motbakker."] };

export const avsender = { navn: "Test Testesen", adresse: "Testveien 1", postnummer: "0184", poststed: "Oslo", telefon: "912 34 567", epost: "test@example.com", kontonummer: "12345678903" };

export function modell(g: Partial<Grunnlag> = {}, idag = IDAG): Saksmodell {
  const utfylling: Utfylling = g.utfylling ?? { feilen };
  const lest = lagSaksmodell({ svar: g.svar ?? svar(), utfylling, kilder: g.kilder, avklaringer: g.avklaringer }, idag);
  if (!lest.ok) throw new Error(lest.feil);
  return lest.modell;
}
