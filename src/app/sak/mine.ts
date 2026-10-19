"use server";

import { kjopt, type Kjopt } from "@/lib/app/saken";
import { innlogget } from "@/lib/innlogging/okt";
import { betalteSaker } from "@/lib/sak/db";

// The logged-in owner's paid cases, newest first; empty when logged out.
export async function mineKjop(): Promise<Kjopt[]> {
  const sub = await innlogget();
  if (!sub) return [];
  return (await betalteSaker(sub)).map((r) => kjopt(r.id, r.skjema));
}
