// Writes one text file per decision for the avgjorende agents (src/lib/avgjorende/instruks.md),
// plus an id list for the Workflow run (scripts/workflows/avgjorende.js). Only decisions the letter
// can cite (GRUNNFILTER) with an assessment that has accepted defects.
//
//   npm run avgjorende:hent -- --pilot [id,...] [--antall 30] [--navn pilot]   the given ids plus a random draw
//   npm run avgjorende:hent -- --id 12,34 [--navn x]
//   npm run avgjorende:hent -- --mangler                every decision without an answer for the current version

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { and, inArray, isNotNull, ne, or, isNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { AVGJORENDE_VERSJON } from "../src/lib/avgjorende/skjema";
import { delOpp } from "../src/lib/avgjorende/verifiser";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";

const { values: args } = parseArgs({
  options: {
    pilot: { type: "string" },
    antall: { type: "string", default: "30" },
    mangler: { type: "boolean", default: false },
    id: { type: "string" },
    navn: { type: "string" },
  },
});

const MAPPE = "data/avgjorende";
const UTVALG = and(GRUNNFILTER, isNotNull(vedtak.fulltekstRenset), isNotNull(vedtak.feilvurdering));
const tall = (s: string) => s.split(",").filter(Boolean).map(Number);

async function velg(): Promise<{ navn: string; valgte: number[] }> {
  if (args.pilot !== undefined) {
    const gitt = tall(args.pilot);
    const trukket = await db
      .select({ id: vedtak.id })
      .from(vedtak)
      .where(and(UTVALG, gitt.length ? sql`${vedtak.id} not in (${sql.join(gitt.map((i) => sql`${i}`), sql`, `)})` : undefined))
      .orderBy(sql`md5(${vedtak.id}::text || 'avgjorende-pilot')`)
      .limit(Math.max(0, Number(args.antall) - gitt.length));
    return { navn: args.navn ?? "pilot", valgte: [...gitt, ...trukket.map((r) => r.id)] };
  }
  if (args.id) return { navn: args.navn ?? "id", valgte: tall(args.id) };
  if (args.mangler) {
    const r = await db
      .select({ id: vedtak.id })
      .from(vedtak)
      .where(and(UTVALG, or(isNull(vedtak.avgjorendeVersjon), ne(vedtak.avgjorendeVersjon, AVGJORENDE_VERSJON))))
      .orderBy(vedtak.id);
    return { navn: args.navn ?? "mangler", valgte: r.map((x) => x.id) };
  }
  throw new Error("Velg --pilot [id,...], --id eller --mangler.");
}

async function main() {
  const { navn, valgte } = await velg();
  mkdirSync(join(MAPPE, "inn"), { recursive: true });
  mkdirSync(join(MAPPE, "lister"), { recursive: true });
  const rader = valgte.length
    ? await db
        .select({
          id: vedtak.id,
          saksnummer: vedtak.saksnummer,
          sanksjoner: vedtak.sanksjoner,
          feilvurdering: vedtak.feilvurdering,
          fulltekst: vedtak.fulltekstRenset,
        })
        .from(vedtak)
        .where(inArray(vedtak.id, valgte))
    : [];
  const skrevet: number[] = [];
  for (const id of valgte) {
    const r = rader.find((x) => x.id === id);
    const medhold = r?.feilvurdering?.feil.filter((f) => f.utfall === "medhold") ?? [];
    if (!r?.fulltekst || !medhold.length) continue;
    const feil = medhold.map((f) => {
      const kat = f.underkategori ? `${f.hovedkategori}.${f.underkategori}` : f.hovedkategori;
      return `- ${f.id}: ${kat}${f.komponent ? ` (${f.komponent})` : ""}`;
    });
    const hode = [
      `VEDTAK_ID: ${r.id}`,
      `SAKSNUMMER: ${r.saksnummer ?? "ukjent"}`,
      `SANKSJONER I VEDTAKET: ${(r.sanksjoner ?? []).join(", ") || "ukjent"}`,
      "",
      "FEIL MED MEDHOLD:",
      ...feil,
    ].join("\n");
    const { saksfremstilling, vurdering } = delOpp(r.fulltekst);
    const tekst = vurdering
      ? `<saksfremstilling>\n${saksfremstilling}\n</saksfremstilling>\n\n<utvalgets_vurdering>\n${vurdering}\n</utvalgets_vurdering>`
      : `<utvalgets_vurdering>\n${saksfremstilling}\n</utvalgets_vurdering>`;
    writeFileSync(join(MAPPE, "inn", `${r.id}.txt`), `${hode}\n\n${tekst}\n`);
    skrevet.push(id);
  }
  writeFileSync(join(MAPPE, "lister", `${navn}.json`), JSON.stringify(skrevet));
  console.log(`${skrevet.length} inn-filer skrevet, liste: ${join(MAPPE, "lister", `${navn}.json`)}`);
  const uten = valgte.length - skrevet.length;
  if (uten) console.log(`${uten} uten fulltekst eller feil med medhold ble hoppet over.`);
  process.exit(0);
}
main();
