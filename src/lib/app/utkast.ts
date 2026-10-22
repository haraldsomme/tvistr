// The unpaid draft as the browser keeps it before payment: the form, plus the three check answers the
// form has no field for (who sold, who bought, and «vet ikke» for «som den er», which c_asis cannot
// carry). They only decide whether the case is covered, and a case that is not cannot be bought, so the
// paid case keeps only the form.
import type { Svar } from "@/lib/vedtaksvalg/kjoper";
import { tilSvar } from "./saken";
import { type Skjema, standard, syncAreas } from "./skjema";
import { type Resultat, type Sjekksvar, skriverResultat, writerQ } from "./vurdering";

export type Utkast = { skjema: Skjema; seller?: "forhandler" | "privat" | "leasing"; buyer?: "privat" | "naering"; asis?: "ja" | "nei" | "vetikke" };

export const standardUtkast = (idag: string): Utkast => ({ skjema: standard(idag) });

// The verdict's answers: the writer's, with the draft's own where the buyer has given them.
export function utkastSvar(u: Utkast): Sjekksvar {
  const q = writerQ(syncAreas(u.skjema));
  return { ...q, seller: u.seller ?? q.seller, buyer: u.buyer ?? q.buyer, asis: u.asis ?? q.asis };
}

// As skriverResultat, on the draft's own answers.
export const utkastResultat = (u: Utkast, idag: string): Resultat => skriverResultat(u.skjema, idag, utkastSvar(u));

// The ranking's answers. «Vet ikke» about «som den er» is unknown, not «nei».
export function utkastTilSvar(u: Utkast): Svar | null {
  const svar = tilSvar(syncAreas(u.skjema));
  return svar && u.asis === "vetikke" ? { ...svar, somDenEr: null } : svar;
}
