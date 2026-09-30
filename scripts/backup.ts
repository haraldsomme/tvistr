// Exports kildesak, kildedokument and vedtak to backup/tvistr-<timestamp>.json.gz and verifies
// the file against the database. The data is redacted, but keep the file private anyway.
//
//   npm run db:backup

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { asc, gt, sql } from "drizzle-orm";
import { db } from "../src/db";
import { TABELLER, type Sikkerhetskopi } from "./backup-format";

const BIT = 500;

async function hentAlle(navn: keyof typeof TABELLER) {
  const tabell = TABELLER[navn];
  const rader: Record<string, unknown>[] = [];
  let sisteId = 0;
  for (;;) {
    const bit = await db.select().from(tabell).where(gt(tabell.id, sisteId)).orderBy(asc(tabell.id)).limit(BIT);
    if (!bit.length) break;
    rader.push(...bit);
    sisteId = bit[bit.length - 1].id;
  }
  return rader;
}

const sjekksum = (rader: unknown[]) => createHash("sha256").update(JSON.stringify(rader)).digest("hex");

async function main() {
  const migreringer = (await db.execute(sql`select hash from drizzle.__drizzle_migrations order by id`)).rows.map((r) => String(r.hash));
  const kopi: Sikkerhetskopi = { format: 1, tidspunkt: new Date().toISOString(), migreringer, tabeller: {} };
  for (const navn of Object.keys(TABELLER) as (keyof typeof TABELLER)[]) {
    const rader = await hentAlle(navn);
    kopi.tabeller[navn] = { antall: rader.length, sjekksum: sjekksum(rader), rader };
    console.log(`  ${navn}: ${rader.length} rader`);
  }

  mkdirSync("backup", { recursive: true });
  const fil = `backup/tvistr-${kopi.tidspunkt.slice(0, 16).replace(/[-:]/g, "").replace("T", "-")}.json.gz`;
  writeFileSync(fil, gzipSync(JSON.stringify(kopi), { level: 9 }));

  // Verify: read the file back and compare row counts and checksums with what was exported.
  const lest = JSON.parse(gunzipSync(readFileSync(fil)).toString("utf8")) as Sikkerhetskopi;
  for (const navn of Object.keys(TABELLER) as (keyof typeof TABELLER)[]) {
    const t = lest.tabeller[navn]!;
    const [{ n }] = (await db.execute(sql`select count(*)::int n from ${TABELLER[navn]}`)).rows as { n: number }[];
    const ok = t.rader.length === t.antall && sjekksum(t.rader) === kopi.tabeller[navn]!.sjekksum && n === t.antall;
    if (!ok) throw new Error(`Kontroll feilet for ${navn}: fil ${t.rader.length}, database ${n}`);
  }
  const mb = (readFileSync(fil).length / 1e6).toFixed(1);
  console.log(`Skrev og kontrollerte ${fil} (${mb} MB).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
