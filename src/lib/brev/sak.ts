import { randomBytes } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { brevsak } from "@/db/schema";
import { iDag } from "@/lib/vurdering/faktorer";
import { lesInnsending, type Innsending } from "@/lib/vurdering/innsending";
import type { Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import { erSakId, medEndring, tilpassTilSvar, utloperEtter, type Endring, type Utfylling } from "./utfylling";

// The stored letter cases. A case holds personal data, so: the id is unguessable and is the only
// way in, nothing from a case is logged, and a case is deleted when it expires or the user asks.

export type Sak = { id: string; svar: Innsending; utfylling: Utfylling };

// The vehicle is chosen in the assessment and is part of the case from the start; it cannot be changed.
export async function opprettSak(svar: Innsending, kjoretoy: Kjoretoy): Promise<string> {
  const id = randomBytes(16).toString("base64url");
  await db.insert(brevsak).values({ id, svar, utfylling: { kjoretoy }, utloper: utloperEtter(new Date()) });
  return id;
}

// null when there is no such case. An expired case is deleted on the way.
export async function hentSak(id: string): Promise<Sak | null> {
  if (!erSakId(id)) return null;
  const [rad] = await db.select().from(brevsak).where(eq(brevsak.id, id)).limit(1);
  if (!rad) return null;
  if (rad.utloper <= new Date()) {
    await slettSak(id);
    return null;
  }
  // Read through `lesInnsending`, so a case saved with the purchase month only still opens.
  return { id: rad.id, svar: lesInnsending(rad.svar as unknown as Record<string, unknown>), utfylling: rad.utfylling };
}

// Applies one save to a case just read with `hentSak`, and pushes the expiry forward. The merge is
// done by the database in one statement, so two saves of different fields at the same time (a tick in
// the checklist and a chosen decision, say) cannot overwrite each other.
export async function endreSak(id: string, endring: Endring, sak: Sak): Promise<Utfylling> {
  const satt: Record<string, unknown> = {};
  const fjernet: string[] = [];
  for (const [felt, verdi] of Object.entries(endring)) {
    if (verdi === null) fjernet.push(felt);
    else satt[felt] = verdi;
  }
  const na = new Date();
  const sammenslatt = fjernet.reduce((uttrykk, felt) => sql`(${uttrykk}) - ${felt}::text`, sql`${brevsak.utfylling} || ${JSON.stringify(satt)}::jsonb`);
  const [rad] = await db.update(brevsak).set({ utfylling: sammenslatt, endret: na, utloper: utloperEtter(na) }).where(eq(brevsak.id, id)).returning({ utfylling: brevsak.utfylling });
  // The case can have been deleted between the read and the save; the answer then is what the read saw.
  return rad?.utfylling ?? medEndring(sak.utfylling, endring);
}

// Counts one more suggestion from the language model for a case just read with `hentSak`.
export async function tellSprakvask(sak: Sak): Promise<void> {
  await db
    .update(brevsak)
    .set({ utfylling: sql`jsonb_set(${brevsak.utfylling}, '{sprakvask}', to_jsonb(coalesce((${brevsak.utfylling}->>'sprakvask')::int, 0) + 1))` })
    .where(eq(brevsak.id, sak.id));
}

// Changed answers from the assessment for a case just read with `hentSak`, and the fill-in that
// results: what was filled in keeps its value, except dates the new answers make impossible.
export async function settSvar(sak: Sak, svar: Innsending): Promise<Utfylling> {
  const na = new Date();
  const utfylling = tilpassTilSvar(sak.utfylling, svar, iDag());
  await db.update(brevsak).set({ svar, utfylling, endret: na, utloper: utloperEtter(na) }).where(eq(brevsak.id, sak.id));
  return utfylling;
}

export async function slettSak(id: string): Promise<void> {
  if (erSakId(id)) await db.delete(brevsak).where(eq(brevsak.id, id));
}

// Deletes every expired case and returns how many there were. Run by `npm run rydd`.
export async function ryddUtlopte(): Promise<number> {
  const slettet = await db.delete(brevsak).where(lt(brevsak.utloper, new Date())).returning({ id: brevsak.id });
  return slettet.length;
}
