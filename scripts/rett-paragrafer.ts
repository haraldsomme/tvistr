// One-off data fix: relabel stored sections that the decision text ties to another law
// (e.g. "fkjl § 3" that really is forsinkelsesrenteloven § 3). No API calls.
//
//   npm run rett-paragrafer -- [--skriv]

import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { korrigerParagrafer } from "../src/lib/normalisering";

const { values: args } = parseArgs({ options: { skriv: { type: "boolean", default: false } } });

async function main() {
  const rader = await db.select({ id: vedtak.id, paragrafer: vedtak.paragrafer, tekst: vedtak.fulltekstRenset }).from(vedtak);
  let endret = 0;
  const flyttet: Record<string, number> = {};
  for (const r of rader) {
    const ny = korrigerParagrafer(r.paragrafer, r.tekst ?? "");
    if (JSON.stringify(ny) === JSON.stringify(r.paragrafer)) continue;
    endret++;
    for (const p of ny ?? []) if (!(r.paragrafer ?? []).includes(p)) flyttet[p.split(" § ")[0]] = (flyttet[p.split(" § ")[0]] ?? 0) + 1;
    if (args.skriv) await db.update(vedtak).set({ paragrafer: ny }).where(eq(vedtak.id, r.id));
  }
  console.log(`${endret} av ${rader.length} paragraflister ${args.skriv ? "rettet" : "ville blitt rettet (dry run)"}. Nye lovprefiks:`, flyttet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
