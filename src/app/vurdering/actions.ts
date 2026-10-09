"use server";

import { db } from "@/db";
import { sammenlign, type Resultat, type Skjema } from "@/lib/sammenligning";
import { lagHentKandidater } from "@/lib/sammenligning/kandidater";

export type Svar = { ok: true; resultat: Resultat } | { ok: false; feil: string };

// Runs the comparison engine on the form against the database (the same as `npm run sammenlign`).
export async function vurder(skjema: Skjema, idag: string): Promise<Svar> {
  try {
    return { ok: true, resultat: await sammenlign(skjema, lagHentKandidater(db), idag || undefined) };
  } catch (e) {
    return { ok: false, feil: e instanceof Error ? e.message : String(e) };
  }
}
