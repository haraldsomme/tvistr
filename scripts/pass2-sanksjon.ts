// Fills vedtak_analyse.sanksjon from the decisions without re-importing the agents' answers. The
// importer sets it for new rows; run this after a change to avledSanksjon (src/lib/analyse/avled.ts).
//
//   npm run pass2:sanksjon [-- --tørrkjøring]

import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak, vedtakAnalyse } from "../src/db/schema";
import { avledSanksjon } from "../src/lib/analyse/avled";

async function main() {
  const torr = process.argv.includes("--tørrkjøring");
  const rader = await db
    .select({
      id: vedtak.id,
      fulltekstRenset: vedtak.fulltekstRenset,
      utfall: vedtak.utfall,
      kravtyper: vedtak.kravtyper,
      kjopesumNok: vedtak.kjopesumNok,
      tilkjentPrisavslagNok: vedtak.tilkjentPrisavslagNok,
      tilkjentErstatningNok: vedtak.tilkjentErstatningNok,
      tilkjentTotaltNok: vedtak.tilkjentTotaltNok,
      naa: vedtakAnalyse.sanksjon,
    })
    .from(vedtakAnalyse)
    .innerJoin(vedtak, eq(vedtak.id, vedtakAnalyse.vedtakId));
  const telling = new Map<string, number>();
  const endringer = rader.map((r) => ({ id: r.id, sanksjon: avledSanksjon(r), naa: r.naa })).filter((r) => r.sanksjon !== r.naa);
  for (const r of rader) {
    const s = String(avledSanksjon(r));
    telling.set(s, (telling.get(s) ?? 0) + 1);
  }
  console.table(Object.fromEntries(telling));
  console.log(`${endringer.length} av ${rader.length} rader endres.`);
  if (torr) return;
  for (let i = 0; i < endringer.length; i += 100) {
    const bolk = endringer.slice(i, i + 100);
    await db.batch(bolk.map((r) => db.update(vedtakAnalyse).set({ sanksjon: r.sanksjon }).where(eq(vedtakAnalyse.vedtakId, r.id))) as [never, ...never[]]);
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(vedtakAnalyse).where(sql`${vedtakAnalyse.sanksjon} = 'heving'`);
  console.log(`Lagret. Heving: ${n}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
