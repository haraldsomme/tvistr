"use server";

import { kjopt, type Kjopt } from "@/lib/app/saken";
import { feilnavn } from "@/lib/feil/kategorier";
import { innlogget } from "@/lib/innlogging/okt";
import { betalteSaker } from "@/lib/sak/db";

// The logged-in owner's paid cases, newest first; empty when logged out.
export async function mineKjop(): Promise<Kjopt[]> {
  const sub = await innlogget();
  if (!sub) return [];
  return (await betalteSaker(sub)).map((r) => kjopt(r.id, r.skjema));
}

export type MittBrev = { id: string; bil: string; reg: string; feil: string; dato: string; betalt: Date | null };

// The account menu: the owner's name (the newest case's that has one) and one row per paid case,
// newest first, as /min-side lists them. Empty when logged out.
export async function mineBrev(): Promise<{ navn: string | null; brev: MittBrev[] }> {
  const sub = await innlogget();
  if (!sub) return { navn: null, brev: [] };
  const saker = await betalteSaker(sub);
  return {
    navn: saker.map((r) => r.skjema.b_name?.trim()).find((n) => !!n) ?? null,
    brev: saker.map((r) => ({
      id: r.id,
      bil: `${r.skjema.c_make} ${r.skjema.c_model}`.trim(),
      reg: r.skjema.c_reg,
      feil: feilnavn(r.skjema.f_cats, r.skjema.f_parts),
      // The day of payment in Norway, whatever the server's time zone.
      dato: r.betalt ? r.betalt.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Oslo" }) : "",
      betalt: r.betalt,
    })),
  };
}
