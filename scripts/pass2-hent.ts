// Writes one text file per decision for the pass 2 extraction agents, plus an id list for the
// Workflow run (docs/pass2-design.md § 3, § 9.1).
//
//   npm run pass2:hent -- --pilot [--navn pilot-pass2-v2]   100 stratified decisions not in any earlier list
//   npm run pass2:hent -- --prove            5 decisions outside the pilot → lister/prove.json
//   npm run pass2:hent -- --stabilitet [--fra pilot-pass2-v2] [--navn stabilitet-pass2-v2]   20 of a pilot for the second run
//   npm run pass2:hent -- --id 12,34 [--navn x]
//   npm run pass2:hent -- --mangler [--fra-ar 2021]   base sample without an analysis for this instruction version
//   npm run pass2:hent -- --alle

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { INSTRUKS_VERSJON } from "../src/lib/analyse/skjema";

const { values: args } = parseArgs({
  options: {
    pilot: { type: "boolean", default: false },
    prove: { type: "boolean", default: false },
    stabilitet: { type: "boolean", default: false },
    mangler: { type: "boolean", default: false },
    alle: { type: "boolean", default: false },
    id: { type: "string" },
    navn: { type: "string" },
    fra: { type: "string" },
    "fra-ar": { type: "string" },
  },
});

const MAPPE = "data/pass2";

// Read in the data check (docs/vedtakssammenligning-datasjekk.md). The instruction's examples come
// from these, so they stay out of every measured sample.
const DATASJEKK_IDER = [
  284, 659, 1389, 1043, 1645, 1555, 3027, 3454, 981, 2480, 2679, 3301, 2655, 1675, 720, 782, 398, 2863, 851, 2373, 718, 2031, 597, 2564, 510,
  1579, 2410, 1237, 1853, 3443, 3151, 1179, 1017, 1695, 2, 2068, 925, 2796, 1438, 3417, 243, 1683, 3367, 3445, 602, 1397, 1805, 2642, 1556, 661,
  1434, 3501, 1443, 2556, 2870, 3294, 1587, 2547, 1280, 2204, 2366, 436, 232, 2881, 2146,
  360, 3336, 3077, 1778, 948, 287, 2737, 627, 1644, 2122, 1958, 1862, 859, 2092, 1996,
  2036, 2728, 327, 3074, 1807, 2871, 1756, 3276, 3402, 2667,
  1151, 3142, 791, 2071, 1058, 1324, 1221, 572, 1150, 945,
  2702, 1388, 591, 2730, 1080, 1882, 2035, 692, 3401, 609,
];

const GRUNNUTVALG = sql`kjoretoytype in ('personbil','varebil') and utfall <> 'avvist' and lov = 'forbrukerkjøpsloven'`;
const idListe = (ider: number[]) => sql.join(ider.map((i) => sql`${i}`), sql`, `);
const ider = async (q: SQL) => (await db.execute(q)).rows.map((r) => Number(r.id));

async function trekk(filter: SQL, n: number, frø: string, unntatt: number[]) {
  const ute = [...DATASJEKK_IDER, ...unntatt];
  return ider(sql`select id from vedtak where ${GRUNNUTVALG} and ${filter} and id not in (${idListe(ute)})
    order by md5(id::text || ${frø}) limit ${n}`);
}

// A new pilot never reuses decisions from an earlier list (earlier pilots, the trial set).
function tidligereIder(): number[] {
  const mappe = join(MAPPE, "lister");
  if (!existsSync(mappe)) return [];
  return readdirSync(mappe).flatMap((f) => JSON.parse(readFileSync(join(mappe, f), "utf8")) as number[]);
}

async function pilot(frø: string) {
  const brukt = tidligereIder();
  const a = await trekk(sql`utfall = 'delvis_medhold' and cardinality(feiltyper) >= 2`, 50, frø, brukt);
  const b = await trekk(sql`(utfall = 'medhold' or (utfall = 'delvis_medhold' and coalesce(cardinality(feiltyper), 0) < 2))`, 25, frø, [...brukt, ...a]);
  const c1 = await trekk(sql`utfall = 'ikke_medhold' and bevistyper && array['verkstedrapport','NAF_test']`, 15, frø, [...brukt, ...a, ...b]);
  const c2 = await trekk(sql`utfall = 'ikke_medhold'`, 10, frø, [...brukt, ...a, ...b, ...c1]);
  return [...a, ...b, ...c1, ...c2];
}

const lesListe = (navn: string) => JSON.parse(readFileSync(join(MAPPE, "lister", `${navn}.json`), "utf8")) as number[];
const md5 = (s: string) => createHash("md5").update(s).digest("hex");

async function velg(): Promise<{ navn: string; valgte: number[] }> {
  if (args.pilot) {
    const navn = args.navn ?? "pilot";
    return { navn, valgte: await pilot(navn === "pilot" ? "pass2-pilot" : `pass2-${navn}`) };
  }
  if (args.prove) return { navn: "prove", valgte: await trekk(sql`true`, 5, "pass2-prove", lesListe("pilot")) };
  if (args.stabilitet) {
    const p = lesListe(args.fra ?? "pilot");
    return { navn: args.navn ?? "stabilitet", valgte: [...p].sort((x, y) => md5(`${x}pass2-stabilitet`).localeCompare(md5(`${y}pass2-stabilitet`))).slice(0, 20) };
  }
  if (args.id) return { navn: args.navn ?? "id", valgte: args.id.split(",").map(Number) };
  if (args.mangler) {
    const fraAr = args["fra-ar"] ? sql`and extract(year from vedtaksdato) >= ${Number(args["fra-ar"])}` : sql``;
    return {
      navn: args.navn ?? "mangler",
      valgte: await ider(sql`select id from vedtak v where ${GRUNNUTVALG} ${fraAr} and not exists (
        select 1 from vedtak_analyse a where a.vedtak_id = v.id and a.instruks_versjon = ${INSTRUKS_VERSJON}) order by id`),
    };
  }
  if (args.alle) return { navn: args.navn ?? "alle", valgte: await ider(sql`select id from vedtak where ${GRUNNUTVALG} order by id`) };
  throw new Error("Velg --pilot, --prove, --stabilitet, --id, --mangler eller --alle.");
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
          prinsipaltKrav: vedtak.prinsipaltKrav,
          fulltekst: vedtak.fulltekstRenset,
        })
        .from(vedtak)
        .where(inArray(vedtak.id, valgte))
    : [];
  const mangler = rader.filter((r) => !r.fulltekst).map((r) => r.id);
  for (const r of rader) {
    if (!r.fulltekst) continue;
    const hode = [
      `VEDTAK_ID: ${r.id}`,
      `SAKSNUMMER: ${r.saksnummer ?? "ukjent"}`,
      `KJØPSDATO: ${r.kjopsdato ?? "ukjent"}`,
      `OVERTAKELSESDATO: ${r.overtakelsesdato ?? "ukjent"}`,
      `VEDTAKSDATO: ${r.vedtaksdato ?? "ukjent"}`,
      `UTFALL: ${r.utfall}`,
      `KRAV: ${(r.kravtyper ?? []).join(", ") || "ukjent"}`,
      `PRINSIPALT_KRAV: ${r.prinsipaltKrav ?? "ukjent"}`,
    ].join("\n");
    writeFileSync(join(MAPPE, "inn", `${r.id}.txt`), `${hode}\n\n<vedtak>\n${r.fulltekst}\n</vedtak>\n`);
  }
  // Keep the chosen order (strata for the pilot); it is also the order the agents get.
  const skrevet = valgte.filter((i) => rader.some((r) => r.id === i && r.fulltekst));
  writeFileSync(join(MAPPE, "lister", `${navn}.json`), JSON.stringify(skrevet));
  console.log(`${skrevet.length} inn-filer skrevet, liste: ${join(MAPPE, "lister", `${navn}.json`)}`);
  if (mangler.length) console.log(`Uten fulltekst (hoppet over): ${mangler.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
