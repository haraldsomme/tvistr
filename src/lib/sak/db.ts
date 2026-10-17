// A paid case by its id, for the page and the server actions. Null for a malformed id, an unknown case
// or one not yet paid: the three look the same to the browser.
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { type Sak, sak } from "@/db/schema";
import { erId } from "./id";

export async function hentBetaltSak(id: unknown): Promise<Sak | null> {
  if (!erId(id)) return null;
  const [r] = await db.select().from(sak).where(and(eq(sak.id, id), isNotNull(sak.betalt))).limit(1);
  return r ?? null;
}
