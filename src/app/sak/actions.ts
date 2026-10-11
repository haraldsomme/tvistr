"use server";

import { headers } from "next/headers";
import { and, arrayOverlaps, count, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { brukerNiva, HOVEDKATEGORIER, rensFeilvalg, rensTidsvalg } from "@/lib/feil/kategorier";
import { lagGrense } from "@/lib/rategrense";

// One count per chosen main category; null for «vet ikke ennå», which is never compared. `under`
// says the count is narrowed to the chosen subcategories; false means the whole main category.
export type Telling =
  | {
      ok: true;
      totalt: number;
      kategorier: { id: string; navn: string; antall: number | null; under: boolean }[];
    }
  | { ok: false; melding: string };

const forMange = lagGrense({ antall: 20, vinduMs: 60_000 });
// Fewer subcategory matches than this, and the count falls back to the main category.
const MIN_UNDER = 5;

// Decisions with medhold for a dealer sale of a car or van under the consumer purchase act, where
// the committee accepted a defect of the same kind that showed itself at the same time level
// (vedtak.godtatte_niva). The registry lookup does not give the vehicle type, so both are counted.
const medhold = (vilkar: SQL | undefined) =>
  db
    .select({ n: count() })
    .from(vedtak)
    .where(
      and(
        vilkar,
        inArray(vedtak.utfall, ["medhold", "delvis_medhold"]),
        inArray(vedtak.kjoretoytype, ["personbil", "varebil"]),
        eq(vedtak.lov, "forbrukerkjøpsloven"),
        eq(vedtak.selgerType, "forhandler"),
      ),
    )
    .then((r) => r[0]?.n ?? 0);

const gyldigDato = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// kjopsdato: the day the car was registered on its current owner, as the registry lookup gave it.
export async function tellVedtak(valg: unknown, tid: unknown, kjopsdato: unknown): Promise<Telling> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip))
    return {
      ok: false,
      melding: "For mange forsøk. Vent et minutt og prøv igjen.",
    };
  const rent = rensFeilvalg(valg);
  const valgte = HOVEDKATEGORIER.filter((h) => h.id in rent);
  if (!valgte.length) return { ok: false, melding: "Velg minst én feil." };
  const tider = rensTidsvalg(tid);
  if (valgte.some((h) => !tider[h.id])) return { ok: false, melding: "Velg når hver feil viste seg." };
  const dato = gyldigDato(kjopsdato);
  try {
    // Each category narrows to its chosen subcategories when they give enough decisions; the total
    // uses the same conditions, so it is never wider than the rows above it.
    const per = await Promise.all(
      valgte.map(async (h) => {
        if (h.id === "vet_ikke") return { rad: { id: h.id, navn: h.navn, antall: null, under: false }, vilkar: undefined };
        const n = brukerNiva(tider[h.id]!, dato);
        const under = rent[h.id];
        if (under.length) {
          const vilkar = arrayOverlaps(vedtak.godtatteNiva, under.map((u) => `${h.id}.${u}:${n}`));
          const antall = await medhold(vilkar);
          if (antall >= MIN_UNDER) return { rad: { id: h.id, navn: h.navn, antall, under: true }, vilkar };
        }
        const vilkar = arrayOverlaps(vedtak.godtatteNiva, [`${h.id}:${n}`]);
        return { rad: { id: h.id, navn: h.navn, antall: await medhold(vilkar), under: false }, vilkar };
      }),
    );
    const vilkar = per.map((p) => p.vilkar).filter((v): v is SQL => v !== undefined);
    const totalt = vilkar.length ? await medhold(or(...vilkar)) : 0;
    return { ok: true, totalt, kategorier: per.map((p) => p.rad) };
  } catch (e) {
    console.error("telling feilet", e);
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
