// The unpaid draft as the browser keeps it before payment: the form, plus the three check answers the
// form has no field for (who sold, who bought, and «vet ikke» for «som den er», which c_asis cannot
// carry). They only decide whether the case is covered, and a case that is not cannot be bought, so the
// paid case keeps only the form.
import type { Svar } from "@/lib/vedtaksvalg/kjoper";
import { fraSjekk, type Sjekk, tilSvar } from "./saken";
import { type Skjema, standard, syncAreas } from "./skjema";
import { evaluate, type Resultat, type Sjekksvar, wsFactors, writerQ } from "./vurdering";

export type Utkast = { skjema: Skjema; seller?: "forhandler" | "privat" | "leasing"; buyer?: "privat" | "naering"; asis?: "ja" | "nei" | "vetikke" };

export const standardUtkast = (idag: string): Utkast => ({ skjema: standard(idag) });

// A check stored by the old flow (tvistr-sjekk) as a draft.
export function fraGammelSjekk(a: Sjekk, idag: string): Utkast {
  const u: Utkast = { skjema: fraSjekk(a, standard(idag)) };
  if (a.seller) u.seller = a.seller;
  if (a.buyer) u.buyer = a.buyer;
  if (a.asis) u.asis = a.asis;
  return u;
}

// The verdict's answers: the writer's, with the draft's own where the buyer has given them.
export function utkastSvar(u: Utkast): Sjekksvar {
  const q = writerQ(syncAreas(u.skjema));
  return { ...q, seller: u.seller ?? q.seller, buyer: u.buyer ?? q.buyer, asis: u.asis ?? q.asis };
}

// As skriverResultat: the check's rules plus the workshop and what the seller said.
export function utkastResultat(u: Utkast, idag: string): Resultat {
  const r = evaluate(utkastSvar(u), idag);
  return { ...r, factors: [...r.factors, ...wsFactors({ ...u.skjema, dato: u.skjema.c_purchase || u.skjema.c_delivery })] };
}

// The ranking's answers. «Vet ikke» about «som den er» is unknown, not «nei».
export function utkastTilSvar(u: Utkast): Svar | null {
  const svar = tilSvar(syncAreas(u.skjema));
  return svar && u.asis === "vetikke" ? { ...svar, somDenEr: null } : svar;
}
