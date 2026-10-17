// How long a case is kept (the privacy statement on /personvern): three years after payment, and 30 days
// for a purchase never paid. The orders go with the case (on delete cascade); the accounts keep the
// payments. Run once a day by Vercel Cron (src/app/api/slett-saker, vercel.json).
import { and, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { sak } from "@/db/schema";
import { grenser } from "./lagringstid";

export async function slettGamleSaker(na = new Date()): Promise<number> {
  const g = grenser(na);
  const slettet = await db
    .delete(sak)
    .where(or(and(isNotNull(sak.betalt), lt(sak.betalt, g.betalt)), and(isNull(sak.betalt), lt(sak.opprettet, g.ufullfort))))
    .returning({ id: sak.id });
  return slettet.length;
}
