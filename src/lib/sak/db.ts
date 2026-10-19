// A paid case by its id, for the page and the server actions. Null for a malformed id, an unknown case
// or one not yet paid: the three look the same to the browser. And the owner's paid cases.
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { type Sak, sak } from "@/db/schema";
import { innlogget } from "@/lib/innlogging/okt";
import { erId } from "./id";

export async function hentBetaltSak(id: unknown): Promise<Sak | null> {
  if (!erId(id)) return null;
  const [r] = await db.select().from(sak).where(and(eq(sak.id, id), isNotNull(sak.betalt))).limit(1);
  return r ?? null;
}

// The owner's paid cases, newest first.
export async function betalteSaker(sub: string): Promise<Pick<Sak, "id" | "skjema" | "betalt">[]> {
  return db
    .select({ id: sak.id, skjema: sak.skjema, betalt: sak.betalt })
    .from(sak)
    .where(and(eq(sak.vippsSub, sub), isNotNull(sak.betalt)))
    .orderBy(desc(sak.betalt));
}

// A paid case that belongs to the logged-in Vipps account. Null when logged out, for another account,
// or for a case without an owner (a case with a null vippsSub is nobody's).
export async function hentEgenSak(id: unknown): Promise<Sak | null> {
  const r = await hentBetaltSak(id);
  if (!r?.vippsSub) return null;
  return r.vippsSub === (await innlogget()) ? r : null;
}
