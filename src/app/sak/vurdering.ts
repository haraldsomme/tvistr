"use server";

// «Lignende saker» for the verdict page: the counted figures and the three closest decisions, as
// fields only (lignende-db.ts). Code and database only: this file must never reach the model
// (vurdering.test.ts checks the imports).
import { headers } from "next/headers";
import { lagGrense } from "@/lib/rategrense";
import type { Tallblokk, Vedtakskort } from "@/lib/vurdering/vurdering";
import { lignendeFor } from "./lignende-db";
import { rensSvar } from "./rens";

export type Lignende = { ok: true; tall: Tallblokk[]; kort: Vedtakskort[]; sammenligning: string | null } | { ok: false; melding: string };

const forMange = lagGrense({ antall: 30, vinduMs: 60_000 });

export async function vurderSaken(inn: unknown): Promise<Lignende> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const svar = rensSvar(inn);
  if (!svar) return { ok: false, melding: "Noe er galt med svarene. Prøv igjen." };
  try {
    const r = await lignendeFor(svar);
    // One line per request for the operator, without personal data.
    console.info("lignende", JSON.stringify({ kategorier: svar.feil.map((f) => f.hoved), kort: r.kort.map((k) => k.saksnummer) }));
    return { ok: true, ...r };
  } catch (e) {
    console.error("lignende saker feilet", e);
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
