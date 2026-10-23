// The verdict against the decisions (docs/ferdigkriterier.md, «Vurderingen»): the levels with their
// medhold, the rate per factor row, and the criteria green or red. Reads only.
//
//   npm run vurdering:kalibrer
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import type { AvledetFeil } from "../src/lib/feilvurdering/skjema";
import { andel, kriterier, medhold, tell, vurder, vurderte } from "../src/lib/vurdering/kalibrering";
import { TELLEFILTER } from "../src/lib/vurdering/statistikk-db";

// Strongest first; the levels before and after the change.
const REKKEFOLGE = ["sterk", "god", "mulig", "kreverMer", "svak", "ukjent", "frist", "utenfor"];
const UTENFOR_NIVAENE = ["ukjent", "frist", "utenfor"];

async function main() {
  const rader = await db
    .select({
      id: vedtak.id,
      utfall: vedtak.utfall,
      kjopsdato: vedtak.kjopsdato,
      overtakelsesdato: vedtak.overtakelsesdato,
      vedtaksdato: vedtak.vedtaksdato,
      forsteReklamasjon: vedtak.forsteReklamasjonDato,
      somDenEr: vedtak.somDenEr,
      bevistyper: vedtak.bevistyper,
      rettingsforsok: vedtak.rettingsforsok,
      arsmodell: vedtak.arsmodell,
      km: vedtak.kmVedKjop,
      feil: sql<AvledetFeil[]>`coalesce(${vedtak.feilvurdering}->'feil', '[]'::jsonb)`,
    })
    .from(vedtak)
    .where(TELLEFILTER);
  const vedtakene = rader.filter((v) => vurderte(v).length > 0);

  const tekst = new Map<string, string>();
  const faktorer = new Map<string, { n: number; vant: number }>();
  const resultater = vedtakene.map((v) => {
    const r = vurder(v);
    const vant = medhold(v);
    tekst.set(r.tier, `${r.title} ${r.summary}`);
    for (const f of new Set(r.factors.map((x) => `${x.s.padEnd(4)} ${x.t}`))) {
      const t = faktorer.get(f) ?? faktorer.set(f, { n: 0, vant: 0 }).get(f)!;
      t.n++;
      if (vant) t.vant++;
    }
    return { tier: r.tier, vant, fullt: v.utfall === "medhold" };
  });

  const telling = tell(resultater).sort((a, b) => REKKEFOLGE.indexOf(a.tier) - REKKEFOLGE.indexOf(b.tier));
  console.log(`${vedtakene.length} vedtak med vurdert feil (av ${rader.length} i tellesettet).\n`);
  console.table(telling.map((t) => ({ nivå: t.tier, n: t.n, medhold: t.medhold, fullt: t.fullt, prosent: andel(t).toFixed(1) })));

  console.log("\nPer rad i vurderingen (vedtak der raden står):");
  console.table(
    [...faktorer]
      .sort(([, a], [, b]) => b.n - a.n)
      .map(([rad, t]) => ({ rad, n: t.n, prosent: ((100 * t.vant) / t.n).toFixed(1) })),
  );

  const nivaer = telling.filter((t) => !UTENFOR_NIVAENE.includes(t.tier));
  const krav = kriterier(nivaer, (tier) => /trolig/i.test(tekst.get(tier) ?? ""));
  console.log("\nKriteriene:");
  for (const k of krav) console.log(`${k.gronn ? "GRØNN" : "RØD  "}  ${k.navn}: ${k.tall}`);
  console.log(krav.every((k) => k.gronn) ? "\nAlle grønne." : "\nRødt: rapporter tallene og stopp.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
