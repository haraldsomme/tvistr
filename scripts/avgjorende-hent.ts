// Writes one text file per decision for the avgjorende agents (src/lib/avgjorende/instruks.md),
// plus an id list for the Workflow run (scripts/workflows/uttrekk.js, oppgave avgjorende). Only
// decisions the letter can cite (GRUNNFILTER) with an assessment that has accepted defects.
//
//   npm run avgjorende:hent -- --pilot [id,...] [--antall 30] [--navn pilot]   the given ids plus a random draw
//   npm run avgjorende:hent -- --id 12,34 [--navn x]
//   npm run avgjorende:hent -- --mangler                every decision without an answer for the current version

import { parseArgs } from "node:util";
import { and, inArray, isNotNull, ne, notInArray, or, isNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { AVGJORENDE_VERSJON } from "../src/lib/avgjorende/skjema";
import { delOpp } from "../src/lib/avgjorende/verifiser";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";
import { skrivInnfiler, tall, velg } from "./agentfiler";

const { values: args } = parseArgs({
  options: {
    pilot: { type: "string" },
    antall: { type: "string", default: "30" },
    mangler: { type: "boolean", default: false },
    id: { type: "string" },
    navn: { type: "string" },
  },
});

const UTVALG = and(GRUNNFILTER, isNotNull(vedtak.fulltekstRenset), isNotNull(vedtak.feilvurdering));

async function pilot(gitt: number[]) {
  const trukket = await db
    .select({ id: vedtak.id })
    .from(vedtak)
    .where(and(UTVALG, gitt.length ? notInArray(vedtak.id, gitt) : undefined))
    .orderBy(sql`md5(${vedtak.id}::text || 'avgjorende-pilot')`)
    .limit(Math.max(0, Number(args.antall) - gitt.length));
  return [...gitt, ...trukket.map((r) => r.id)];
}

async function mangler() {
  const r = await db
    .select({ id: vedtak.id })
    .from(vedtak)
    .where(and(UTVALG, or(isNull(vedtak.avgjorendeVersjon), ne(vedtak.avgjorendeVersjon, AVGJORENDE_VERSJON))))
    .orderBy(vedtak.id);
  return r.map((x) => x.id);
}

async function main() {
  const { navn, valgte } = await velg(args.navn, {
    pilot: args.pilot !== undefined ? () => pilot(tall(args.pilot!)) : undefined,
    id: args.id ? async () => tall(args.id!) : undefined,
    mangler: args.mangler ? mangler : undefined,
  });
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
  skrivInnfiler("data/avgjorende", navn, valgte, rader, (r) => {
    const medhold = r.feilvurdering?.feil.filter((f) => f.utfall === "medhold") ?? [];
    if (!r.fulltekst || !medhold.length) return null;
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
    return `${hode}\n\n${tekst}\n`;
  }, "fulltekst eller feil med medhold");
  process.exit(0);
}
main();
