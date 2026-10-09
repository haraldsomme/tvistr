// Writes the component words erSpesifikk uses (src/lib/sammenligning/komponentord.json) from pass 2's
// komponenter[]: words that occur at least five times, minus words about the car as a whole. Run it
// after a new pass 2 import, then `npm run spesifikk` to check the specificity rule still holds.
//
//   npm run komponentord

import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { IKKE_KOMPONENT } from "../src/lib/sammenligning/spesifikk";

const TERSKEL = 5; // chosen 2026-10-10 on the development half; see docs/spor.md

async function main() {
  const { rows } = await db.execute(sql`select lower(unnest(komponenter)) as k, count(*)::int as n from vedtak_feil group by 1`);
  const antall = new Map<string, number>();
  for (const r of rows) for (const w of String(r.k).match(/[a-zæøå]+/g) ?? []) antall.set(w, (antall.get(w) ?? 0) + Number(r.n));
  const ord = [...antall].filter(([w, n]) => n >= TERSKEL && w.length > 2 && !IKKE_KOMPONENT.has(w)).map(([w]) => w).sort();
  writeFileSync("src/lib/sammenligning/komponentord.json", JSON.stringify(ord, null, 0).replace(/","/g, '",\n"').replace("[", "[\n").replace("]", "\n]") + "\n");
  console.log(`${ord.length} komponentord`);
  process.exit(0);
}
main();
