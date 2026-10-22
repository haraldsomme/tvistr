// Builds `statistikk_kategori` from the decisions (statistikk.ts) and reads it. Run at the end of every
// import that changes what is counted (feilvurdering, avgjorende) and with `npm run statistikk:bygg`.
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { statistikkKategori, vedtak } from "@/db/schema";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { BASIS } from "@/lib/matching/grunnfilter";
import { byggStatistikk, type Statistikkrad, type Tellevedtak, UTFALL_I_TELLINGEN } from "./statistikk";

// The letter's set without the medhold filter (src/lib/matching/grunnfilter.ts).
export const TELLEFILTER = and(BASIS, inArray(vedtak.utfall, [...UTFALL_I_TELLINGEN]), isNotNull(vedtak.feilvurdering));

export async function lesTellevedtak(): Promise<Tellevedtak[]> {
  return db
    .select({
      id: vedtak.id,
      utfall: vedtak.utfall,
      sanksjoner: vedtak.sanksjoner,
      feil: sql<AvledetFeil[]>`coalesce(${vedtak.feilvurdering}->'feil', '[]'::jsonb)`,
      avgjorende: vedtak.avgjorende,
    })
    .from(vedtak)
    .where(TELLEFILTER);
}

// Replaces the table in one batch, so a reader never sees it half built.
export async function lagreStatistikk(): Promise<Statistikkrad[]> {
  const rader = byggStatistikk(await lesTellevedtak());
  await db.batch([db.delete(statistikkKategori), db.insert(statistikkKategori).values(rader)]);
  return rader;
}

export async function lesStatistikk(): Promise<Map<string, Statistikkrad>> {
  const rader = await db
    .select({
      nokkel: statistikkKategori.nokkel,
      antallSaker: statistikkKategori.antallSaker,
      antallMedhold: statistikkKategori.antallMedhold,
      heving: statistikkKategori.heving,
      prisavslag: statistikkKategori.prisavslag,
      retting: statistikkKategori.retting,
      erstatning: statistikkKategori.erstatning,
    })
    .from(statistikkKategori);
  return new Map(rader.map((r) => [r.nokkel, r]));
}
