// How long a case is kept (the privacy statement on /personvern): three years after payment, and 30 days
// for a purchase never paid. The orders go with the case (on delete cascade); the accounts keep the
// payments. Expired login sessions and abandoned login starts go too. Run once a day by Vercel Cron (src/app/api/slett-saker, vercel.json).
import { and, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { innlogging, innloggingStart, sak } from "@/db/schema";
import { grenser } from "./lagringstid";

export async function slettGamleSaker(na = new Date()): Promise<number> {
  const g = grenser(na);
  const slettet = await db
    .delete(sak)
    .where(or(and(isNotNull(sak.betalt), lt(sak.betalt, g.betalt)), and(isNull(sak.betalt), lt(sak.opprettet, g.ufullfort))))
    .returning({ id: sak.id });
  return slettet.length;
}

// Sessions past their expiry (the cookie is gone by then) and login starts never completed (the
// state cookie lasts 10 minutes). Returns how many rows went.
export async function slettUtlopteInnlogginger(na = new Date()): Promise<number> {
  const gammel = new Date(na.getTime() - 10 * 60_000);
  const okter = await db.delete(innlogging).where(lt(innlogging.utloper, na)).returning({ h: innlogging.tokenHash });
  const start = await db.delete(innloggingStart).where(lt(innloggingStart.opprettet, gammel)).returning({ s: innloggingStart.state });
  return okter.length + start.length;
}
