// Restores a backup made with `npm run db:backup` into a database with the same migrations.
// Refuses to write into non-empty tables unless --overskriv is given (which empties them first).
//
//   npm run db:restore -- backup/tvistr-20260930-1900.json.gz [--overskriv]

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";
import { getTableColumns, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { db } from "../src/db";
import { TABELLER, type Sikkerhetskopi } from "./backup-format";

const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { overskriv: { type: "boolean", default: false } } });

// JSON turns timestamps into strings; the timestamp columns expect Date objects again.
function tilRad(tabell: (typeof TABELLER)[keyof typeof TABELLER], rad: Record<string, unknown>) {
  const ut: Record<string, unknown> = { ...rad };
  for (const [nokkel, kolonne] of Object.entries(getTableColumns(tabell))) {
    if (kolonne.columnType === "PgTimestamp" && typeof ut[nokkel] === "string") ut[nokkel] = new Date(ut[nokkel] as string);
  }
  return ut;
}

async function main() {
  const fil = positionals[0];
  if (!fil) throw new Error("Oppgi sikkerhetskopien: npm run db:restore -- backup/<fil>.json.gz");
  const kopi = JSON.parse(gunzipSync(readFileSync(fil)).toString("utf8")) as Sikkerhetskopi;

  const migreringer = (await db.execute(sql`select hash from drizzle.__drizzle_migrations order by id`)).rows.map((r) => String(r.hash));
  if (migreringer.join() !== kopi.migreringer.join()) {
    throw new Error("Databasen har andre migreringer enn sikkerhetskopien. Kjør `npm run db:migrate` på riktig versjon av koden først.");
  }

  const navn = Object.keys(TABELLER) as (keyof typeof TABELLER)[];
  for (const n of navn) {
    const [{ antall }] = (await db.execute(sql`select count(*)::int antall from ${TABELLER[n]}`)).rows as { antall: number }[];
    if (antall > 0 && !args.overskriv) throw new Error(`${n} har ${antall} rader. Bruk --overskriv for å tømme tabellene først.`);
  }
  if (args.overskriv) {
    // Children first, because of the foreign keys.
    for (const n of [...navn].reverse()) await db.execute(sql`delete from ${TABELLER[n]}`);
  }

  for (const n of navn) {
    const t = kopi.tabeller[n];
    if (!t) continue;
    const tabell = TABELLER[n];
    for (let i = 0; i < t.rader.length; i += 200) {
      await db.insert(tabell).values(t.rader.slice(i, i + 200).map((r) => tilRad(tabell, r)) as never);
    }
    const tabellnavn = getTableConfig(tabell).name;
    await db.execute(sql`select setval(pg_get_serial_sequence(${tabellnavn}, 'id'), coalesce(max(id), 0) + 1, false) from ${tabell}`);
    console.log(`  ${n}: ${t.rader.length} rader lagt tilbake`);
  }
  console.log(`Gjenopprettet fra ${fil} (laget ${kopi.tidspunkt}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
