// The letter chain on buyer cases drawn at random from the test bench in scripts/ferdig-dekning.ts
// (ranking, one call for the choice, the template): counts level A, level B and the law sentence,
// with cost and time (docs/ferdigkriterier.md).
//
//   npm run ferdig:brevlop -- [antall=100] [utfil.json]

import { writeFileSync } from "node:fs";
import { inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { TID_MND } from "../src/lib/brev/testsak";
import { plussManeder } from "../src/lib/brev/tidslinje";
import { HOVEDKATEGORIER, type VisteSegValg } from "../src/lib/feil/kategorier";
import type { AvledetFeil } from "../src/lib/feilvurdering/skjema";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";
import { ranger } from "../src/lib/matching/ranger";
import type { Kandidat, Krav } from "../src/lib/matching/typer";
import { kjorParallelt } from "../src/lib/parallell";
import { byggSaken } from "../src/lib/vedtaksvalg/kjoper";
import { LOVSETNING, UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "../src/lib/vedtaksvalg/valg";

const TIDER: [VisteSegValg, string][] = [
  ["innen_6_mnd", "2024-06-01"],
  ["6_til_24_mnd", "2024-06-01"],
  ["6_til_24_mnd", "2023-03-01"],
  ["over_24_mnd", "2022-01-01"],
];
const PROFILER = [
  { alder: 3, km: 40_000, somDenEr: "nei" as const },
  { alder: 8, km: 150_000, somDenEr: "nei" as const },
  { alder: 15, km: 260_000, somDenEr: "ja" as const },
];
const KRAV: Krav[] = ["retting", "prisavslag", "heving"];

// A fixed draw, so the measurement can be repeated.
function trekk<T>(alle: T[], n: number): T[] {
  let s = 20261013;
  const neste = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const kopi = [...alle];
  for (let i = kopi.length - 1; i > 0; i--) {
    const j = Math.floor(neste() * (i + 1));
    [kopi[i], kopi[j]] = [kopi[j], kopi[i]];
  }
  return kopi.slice(0, n);
}

async function main() {
  const antall = Number(process.argv[2] ?? 100);
  const utfil = process.argv[3];
  const alle: Kandidat[] = await db
    .select({
      id: vedtak.id,
      saksnummer: vedtak.saksnummer,
      vedtaksdato: vedtak.vedtaksdato,
      km: vedtak.kmVedKjop,
      alder: vedtak.alderVedKjop,
      somDenEr: vedtak.somDenEr,
      sanksjoner: vedtak.sanksjoner,
      mangelsgrunnlag: vedtak.mangelsgrunnlag,
      paragrafer: vedtak.paragrafer,
      tvistetema: vedtak.tvistetema,
      feil: sql<AvledetFeil[]>`coalesce(${vedtak.feilvurdering}->'feil', '[]'::jsonb)`,
      avgjorende: vedtak.avgjorende,
    })
    .from(vedtak)
    .where(GRUNNFILTER);
  const etterId = new Map(alle.map((k) => [k.id, k]));

  const benk = HOVEDKATEGORIER.flatMap((h) =>
    [null, ...h.under.map((u) => u.id)].flatMap((under) => TIDER.flatMap(([tid, dato]) => PROFILER.flatMap((p) => KRAV.map((krav) => ({ hoved: h.id, under, tid, dato, p, krav }))))),
  );
  const saker = trekk(benk, antall);

  const resultater: { sak: string; niva: string; kostnad: number; sekunder: number; avsnitt: string; vedtak_id: number | null; kjoper: unknown }[] = [];
  await kjorParallelt(saker, 5, async (x) => {
    const { sak, kjoper } = byggSaken({
      kjopsdato: x.dato,
      km: x.p.km,
      ar: Number(x.dato.slice(0, 4)) - x.p.alder,
      somDenEr: x.p.somDenEr,
      krav: x.krav,
      forsok: 0,
            // The defect is discovered within the interval the bench names (TID_MND), so the time level is as before.
      feil: [{ hoved: x.hoved, under: x.under ? [x.under] : [], oppdaget: plussManeder(x.dato, TID_MND[x.tid]), beskrivelse: null, opplysning: null, verksted: "skriftlig" }],
    });
    const { kandidater } = ranger(alle, sak);
    const navn = `${x.hoved}.${x.under ?? "-"} ${x.tid} ${x.dato.slice(0, 4)} ${x.krav} ${x.p.alder} år`;
    if (!kandidater.length) {
      resultater.push({ sak: navn, niva: "lovsetning", kostnad: 0, sekunder: 0, avsnitt: LOVSETNING, vedtak_id: null, kjoper });
      return;
    }
    const rader = await db
      .select({ id: vedtak.id, kildeUrl: vedtak.kildeUrl, utvalg: UTVALG_I_TEKSTEN, merke: vedtak.merke, modell: vedtak.modell, arsmodell: vedtak.arsmodell })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const detaljer = new Map<number, Vedtaksdetaljer>(rader.map(({ id, ...d }) => [id, d]));
    const start = Date.now();
    const svar = await velgVedtak({ kjoper, sak, kandidater, alle: etterId, detaljer });
    resultater.push({ sak: navn, niva: svar.niva, kostnad: svar.forbruk.kostnadUsd, sekunder: (Date.now() - start) / 1000, avsnitt: svar.avsnitt, vedtak_id: svar.r.id, kjoper });
  });

  if (utfil) writeFileSync(utfil, JSON.stringify(resultater, null, 1));
  const telling = new Map<string, number>();
  for (const r of resultater) telling.set(r.niva, (telling.get(r.niva) ?? 0) + 1);
  const sek = resultater.map((r) => r.sekunder).sort((a, b) => a - b);
  console.log(`${resultater.length} saker: ${[...telling].map(([k, n]) => `${k} ${n}`).join(", ")}.`);
  console.log(`Kostnad snitt $${(resultater.reduce((s, r) => s + r.kostnad, 0) / resultater.length).toFixed(3)}, tid median ${sek[sek.length >> 1]?.toFixed(0)} s, maks ${sek.at(-1)?.toFixed(0)} s.`);
  process.exit(0);
}
main();
