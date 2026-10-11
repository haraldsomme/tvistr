// Writes one text file per decision for the feilvurdering agents (src/lib/feilvurdering/instruks.md),
// plus an id list for the Workflow run (scripts/workflows/feilvurdering.js).
//
//   npm run feilvurdering:hent -- --pilot [--navn pilot2]   100 decisions pass 2 also analysed, none from an earlier list
//   npm run feilvurdering:hent -- --id 12,34 [--navn x]
//   npm run feilvurdering:hent -- --mangler   every decision without an assessment for the current version
//   npm run feilvurdering:hent -- --alle

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { FEILVURDERING_VERSJON } from "../src/lib/feilvurdering/skjema";

const { values: args } = parseArgs({
  options: {
    pilot: { type: "boolean", default: false },
    mangler: { type: "boolean", default: false },
    alle: { type: "boolean", default: false },
    id: { type: "string" },
    navn: { type: "string" },
  },
});

export const MAPPE = "data/feilvurdering";
const ider = async (q: SQL) => (await db.execute(q)).rows.map((r) => Number(r.id));

// Ids in earlier lists; a new pilot never reuses them, since the instruction's examples come from them.
function tidligere(): number[] {
  const mappe = join(MAPPE, "lister");
  if (!existsSync(mappe)) return [];
  return readdirSync(mappe).flatMap((f) => JSON.parse(readFileSync(join(mappe, f), "utf8")) as number[]);
}

// Stratified like the pass 2 pilot: multi-defect partial wins are where claimed and accepted part.
async function pilot() {
  const brukt = tidligere();
  const trekk = (filter: SQL, n: number, unntatt: number[]) =>
    ider(sql`select v.id from vedtak v join vedtak_analyse a on a.vedtak_id = v.id
      where v.fulltekst_renset is not null and ${filter} ${unntatt.length ? sql`and v.id not in (${sql.join(unntatt.map((i) => sql`${i}`), sql`, `)})` : sql``}
      order by md5(v.id::text || 'feilvurdering-pilot') limit ${n}`);
  const a = await trekk(sql`v.utfall in ('medhold','delvis_medhold') and cardinality(v.feiltyper) >= 2`, 50, brukt);
  const b = await trekk(sql`v.utfall in ('medhold','delvis_medhold')`, 25, [...brukt, ...a]);
  const c = await trekk(sql`v.utfall = 'ikke_medhold'`, 25, [...brukt, ...a, ...b]);
  return [...a, ...b, ...c];
}

async function velg(): Promise<{ navn: string; valgte: number[] }> {
  if (args.pilot) return { navn: args.navn ?? "pilot", valgte: await pilot() };
  if (args.id) return { navn: args.navn ?? "id", valgte: args.id.split(",").map(Number) };
  if (args.mangler)
    return {
      navn: args.navn ?? "mangler",
      valgte: await ider(sql`select id from vedtak where fulltekst_renset is not null and feilvurdering_versjon is distinct from ${FEILVURDERING_VERSJON} order by id`),
    };
  if (args.alle) return { navn: args.navn ?? "alle", valgte: await ider(sql`select id from vedtak where fulltekst_renset is not null order by id`) };
  throw new Error("Velg --pilot, --id, --mangler eller --alle.");
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
          kjopsdato: vedtak.kjopsdato,
          overtakelsesdato: vedtak.overtakelsesdato,
          vedtaksdato: vedtak.vedtaksdato,
          utfall: vedtak.utfall,
          kravtyper: vedtak.kravtyper,
          fulltekst: vedtak.fulltekstRenset,
        })
        .from(vedtak)
        .where(inArray(vedtak.id, valgte))
    : [];
  for (const r of rader) {
    if (!r.fulltekst) continue;
    const hode = [
      `VEDTAK_ID: ${r.id}`,
      `SAKSNUMMER: ${r.saksnummer ?? "ukjent"}`,
      `KJØPSDATO: ${r.kjopsdato ?? "ukjent"}`,
      `OVERTAKELSESDATO: ${r.overtakelsesdato ?? "ukjent"}`,
      `VEDTAKSDATO: ${r.vedtaksdato ?? "ukjent"}`,
      `UTFALL: ${r.utfall ?? "ukjent"}`,
      `KRAV: ${(r.kravtyper ?? []).join(", ") || "ukjent"}`,
    ].join("\n");
    writeFileSync(join(MAPPE, "inn", `${r.id}.txt`), `${hode}\n\n<vedtak>\n${r.fulltekst}\n</vedtak>\n`);
  }
  // Keep the chosen order; it is also the order the agents get.
  const skrevet = valgte.filter((i) => rader.some((r) => r.id === i && r.fulltekst));
  writeFileSync(join(MAPPE, "lister", `${navn}.json`), JSON.stringify(skrevet));
  console.log(`${skrevet.length} inn-filer skrevet, liste: ${join(MAPPE, "lister", `${navn}.json`)}`);
  const uten = valgte.length - skrevet.length;
  if (uten) console.log(`${uten} uten fulltekst ble hoppet over.`);
  process.exit(0);
}
main();
