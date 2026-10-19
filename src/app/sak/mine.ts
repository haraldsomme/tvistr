"use server";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { sak } from "@/db/schema";
import { type Kjopt, kjopt } from "@/lib/app/saken";
import { innlogget } from "@/lib/innlogging/okt";

// The logged-in owner's paid cases, newest first; empty when logged out.
export async function mineKjop(): Promise<Kjopt[]> {
  const sub = await innlogget();
  if (!sub) return [];
  const rader = await db
    .select({ id: sak.id, skjema: sak.skjema })
    .from(sak)
    .where(and(eq(sak.vippsSub, sub), isNotNull(sak.betalt)))
    .orderBy(desc(sak.betalt));
  return rader.map((r) => kjopt(r.id, r.skjema));
}
