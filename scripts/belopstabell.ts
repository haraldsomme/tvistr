// Recomputes the PRISKLASSER table in src/lib/vurdering/belop.ts from the database and prints it
// ready to paste. Same filter as the comment there.
//
//   npm run belopstabell

import { sql } from "drizzle-orm";
import { db } from "../src/db";

const GRENSER = [50_000, 150_000, 300_000, Infinity];

async function main() {
  const rader = (
    await db.execute(sql`
      select
        case when v.kjopesum_nok < 50000 then 0 when v.kjopesum_nok < 150000 then 1 when v.kjopesum_nok < 300000 then 2 else 3 end klasse,
        count(*)::int n,
        percentile_cont(0.25) within group (order by v.tilkjent_totalt_nok)::int p25,
        percentile_cont(0.5) within group (order by v.tilkjent_totalt_nok)::int median,
        percentile_cont(0.75) within group (order by v.tilkjent_totalt_nok)::int p75
      from vedtak v
      where v.selger_type = 'forhandler' and v.utfall in ('medhold','delvis_medhold')
        and v.prinsipalt_krav in ('prisavslag','erstatning') and v.tilkjent_totalt_nok > 0 and v.kjopesum_nok > 0
      group by 1 order by 1`)
  ).rows as { klasse: number; n: number; p25: number; median: number; p75: number }[];

  console.log(`// Computed ${new Date().toISOString().slice(0, 10)} from vedtak: selger_type = forhandler, utfall in (medhold, delvis_medhold),`);
  console.log("// prinsipalt_krav in (prisavslag, erstatning), tilkjent_totalt_nok > 0.");
  console.log("export const PRISKLASSER: Prisklasse[] = [");
  for (const r of rader) {
    const maks = GRENSER[r.klasse] === Infinity ? "Infinity" : GRENSER[r.klasse].toLocaleString("en-US").replace(/,/g, "_");
    console.log(`  { maksKjopesum: ${maks}, n: ${r.n}, p25: ${r.p25}, median: ${r.median}, p75: ${r.p75} },`);
  }
  console.log("];");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
