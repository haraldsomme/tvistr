// Checks the moment catalogue (src/lib/brev/momenter.ts) against its evidence and the database: every
// moment has evidence with the same counts, every decision in it exists with that outcome and case
// number, and every quote is word for word in the decision's text. Must give 0 errors.
//
//   npm run sjekk-momenter

import { readFileSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { MOMENTER } from "../src/lib/brev/momenter";
import { normaliserSitat } from "../src/lib/brev/skriving/kontroll";

type Belegg = Record<string, { vunnet: number; tapt: number; skiller: boolean; vedtak: { id: number; saksnummer: string | null; utfall: string; retning: string; sitat: string }[] }>;

async function main() {
  const belegg = JSON.parse(readFileSync("scripts/momenter-belegg.json", "utf8")) as Belegg;
  const feil: string[] = [];
  const ider = [...new Set(Object.values(belegg).flatMap((b) => b.vedtak.map((v) => v.id)))];
  const rader = await db.select({ id: vedtak.id, utfall: vedtak.utfall, saksnummer: vedtak.saksnummer, tekst: vedtak.fulltekstRenset }).from(vedtak).where(inArray(vedtak.id, ider));
  const finn = new Map(rader.map((r) => [r.id, r]));

  for (const m of MOMENTER) {
    const b = belegg[m.id];
    if (!b) {
      feil.push(`${m.id}: mangler belegg`);
      continue;
    }
    if (b.vunnet !== m.forekomst.vunnet || b.tapt !== m.forekomst.tapt || b.skiller !== m.forekomst.skiller) feil.push(`${m.id}: forekomst ${JSON.stringify(m.forekomst)} ≠ belegg ${b.vunnet}/${b.tapt}/${b.skiller}`);
    if (b.vunnet + b.tapt > 0 && b.vedtak.length === 0) feil.push(`${m.id}: tellinger uten vedtak`);
    for (const v of b.vedtak) {
      const r = finn.get(v.id);
      if (!r) {
        feil.push(`${m.id}: vedtak ${v.id} finnes ikke`);
        continue;
      }
      if (String(r.utfall) !== v.utfall) feil.push(`${m.id}: vedtak ${v.id} har utfall ${r.utfall}, ikke ${v.utfall}`);
      if (r.saksnummer !== v.saksnummer) feil.push(`${m.id}: vedtak ${v.id} har saksnummer ${r.saksnummer}, ikke ${v.saksnummer}`);
      if (!v.sitat.trim() || !normaliserSitat(r.tekst ?? "").includes(normaliserSitat(v.sitat))) feil.push(`${m.id}: sitatet fra vedtak ${v.id} står ikke ordrett i teksten`);
    }
  }
  for (const id of Object.keys(belegg)) if (!MOMENTER.some((m) => m.id === id)) feil.push(`${id}: belegg uten moment i katalogen`);

  for (const f of feil) console.log(f);
  console.log(`${MOMENTER.length} momenter, ${ider.length} vedtak i belegget, ${feil.length} feil`);
  process.exit(feil.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
