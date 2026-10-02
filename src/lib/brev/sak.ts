import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { brevsak } from "@/db/schema";
import { iDag } from "@/lib/vurdering/faktorer";
import { lesInnsending, type Innsending } from "@/lib/vurdering/innsending";
import { erSakId, medEndring, tilpassTilSvar, utloperEtter, type Endring, type Utfylling } from "./utfylling";

// The stored letter cases. A case holds personal data, so: the id is unguessable and is the only
// way in, nothing from a case is logged, and a case is deleted when it expires or the user asks.

export type Sak = { id: string; svar: Innsending; utfylling: Utfylling };

export async function opprettSak(svar: Innsending): Promise<string> {
  const id = randomBytes(16).toString("base64url");
  await db.insert(brevsak).values({ id, svar, utfylling: {}, utloper: utloperEtter(new Date()) });
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

// Applies one save to a case just read with `hentSak`, and pushes the expiry forward.
export async function endreSak(id: string, endring: Endring, sak: Sak): Promise<Utfylling> {
  const utfylling = medEndring(sak.utfylling, endring);
  const na = new Date();
  await db.update(brevsak).set({ utfylling, endret: na, utloper: utloperEtter(na) }).where(eq(brevsak.id, id));
  return utfylling;
}

// Counts one more suggestion from the language model for a case just read with `hentSak`.
export async function tellSprakvask(sak: Sak): Promise<void> {
  const utfylling = { ...sak.utfylling, sprakvask: (sak.utfylling.sprakvask ?? 0) + 1 };
  await db.update(brevsak).set({ utfylling }).where(eq(brevsak.id, sak.id));
}

// New answers from the assessment form for an existing case. false when there is no such case.
export async function settSvar(id: string, svar: Innsending): Promise<boolean> {
  const sak = await hentSak(id);
  if (!sak) return false;
  const na = new Date();
  // What was filled in keeps its value, except dates the new answers make impossible.
  const utfylling = tilpassTilSvar(sak.utfylling, svar, iDag());
  await db.update(brevsak).set({ svar, utfylling, endret: na, utloper: utloperEtter(na) }).where(eq(brevsak.id, id));
  return true;
}

export async function slettSak(id: string): Promise<void> {
  if (erSakId(id)) await db.delete(brevsak).where(eq(brevsak.id, id));
}

// Deletes every expired case and returns how many there were. Run by `npm run rydd`.
export async function ryddUtlopte(): Promise<number> {
  const slettet = await db.delete(brevsak).where(lt(brevsak.utloper, new Date())).returning({ id: brevsak.id });
  return slettet.length;
}
