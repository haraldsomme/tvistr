// The data wash for the legal points' quotes (src/lib/avgjorende/rettslig.md): writes, for each
// decision whose extraction has `rettslige_sitater`, the committee's assessment and the quotes with
// their points, for agents that answer whether each quote states that point. The import
// (scripts/avgjorende-importer.ts) removes the quotes answered no.
//
//   npm run rettslig:hent -- --pilot [--antall 50]   a random draw
//   npm run rettslig:hent -- --alle                  every such decision

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { and, isNotNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { delOpp } from "../src/lib/avgjorende/verifiser";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";
import { RETTSLIGE_POENG } from "../src/lib/matching/rett";

const { values: args } = parseArgs({ options: { pilot: { type: "boolean", default: false }, alle: { type: "boolean", default: false }, antall: { type: "string", default: "50" } } });

const MAPPE = "data/avgjorende/rettslig";

async function main() {
  if (!args.pilot && !args.alle) throw new Error("Velg --pilot eller --alle.");
  const rader = await db
    .select({ id: vedtak.id, t: vedtak.fulltekstRenset, a: vedtak.avgjorende })
    .from(vedtak)
    .where(and(GRUNNFILTER, isNotNull(vedtak.avgjorende), sql`jsonb_array_length(coalesce(${vedtak.avgjorende}->'rettslige_sitater', '[]'::jsonb)) > 0`))
    .orderBy(sql`md5(${vedtak.id}::text || 'rettslig-pilot')`);
  const valgte = args.pilot ? rader.slice(0, Number(args.antall)) : rader;
  mkdirSync(join(MAPPE, "inn"), { recursive: true });
  mkdirSync(join(MAPPE, "ut"), { recursive: true });
  let antall = 0;
  for (const r of valgte) {
    const sitater = r.a!.rettslige_sitater!;
    writeFileSync(join(MAPPE, "inn", `${r.id}.json`), JSON.stringify(sitater));
    const poeng = sitater.map((s) => `## ${s.poeng}: ${RETTSLIGE_POENG.find((p) => p.id === s.poeng)?.tekst ?? s.poeng}\nSITAT: ${s.sitat}`).join("\n\n");
    const vurdering = delOpp(r.t ?? "").vurdering ?? r.t ?? "";
    writeFileSync(join(MAPPE, "inn", `${r.id}.txt`), `VEDTAK_ID: ${r.id}\n\n${poeng}\n\n<utvalgets_vurdering>\n${vurdering}\n</utvalgets_vurdering>\n`);
    antall += sitater.length;
  }
  const navn = args.pilot ? "pilot" : "alle";
  writeFileSync(join(MAPPE, `${navn}.json`), JSON.stringify(valgte.map((r) => r.id)));
  console.log(`${valgte.length} vedtak, ${antall} rettslige sitater, liste: ${join(MAPPE, `${navn}.json`)}`);
  process.exit(0);
}
main();
