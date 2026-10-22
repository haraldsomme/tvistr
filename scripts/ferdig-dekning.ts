// Criterion 2 in docs/ferdigkriterier.md: the share of the test bench's combinations that get a
// decision on level A or B from `ranger` over the whole base set. The rest get the law sentence.
//
//   npm run ferdig:dekning

import { hentAlle } from "../src/app/sak/vedtak-db";
import { plussManeder, tidsnivaFor } from "../src/lib/brev/tidslinje";
import { HOVEDKATEGORIER, type VisteSegValg } from "../src/lib/feil/kategorier";
import { ranger } from "../src/lib/matching/ranger";
import type { Brukersak, Krav } from "../src/lib/matching/typer";

const KRAV_DEKNING = 0.9;
// Months from purchase to discovery for each «viste seg» choice.
const TID_MND: Record<VisteSegValg, number> = { innen_6_mnd: 2, "6_til_24_mnd": 12, over_24_mnd: 30 };

const TIDER: [VisteSegValg, string][] = [
  ["innen_6_mnd", "2024-06-01"],
  ["6_til_24_mnd", "2024-06-01"],
  ["6_til_24_mnd", "2023-03-01"],
  ["over_24_mnd", "2022-01-01"],
];
const PROFILER = [
  { alder: 3, km: 40_000, somDenEr: false },
  { alder: 8, km: 150_000, somDenEr: false },
  { alder: 15, km: 260_000, somDenEr: true },
];
const KRAV: Krav[] = ["retting", "prisavslag", "heving"];

async function main() {
  const alle = await hentAlle();
  const telling = { A: 0, B: 0, lovsetning: 0 };
  const uten: string[] = [];
  for (const h of HOVEDKATEGORIER)
    for (const under of [null, ...h.under.map((u) => u.id)])
      for (const [tid, dato] of TIDER)
        for (const p of PROFILER)
          for (const krav of KRAV) {
            const sak: Brukersak = { kategorier: [{ hoved: h.id, under: under ? [under] : [], niva: tidsnivaFor(dato, plussManeder(dato, TID_MND[tid])).tidsnivaa, opplysning: null, verksted: true }], km: p.km, alder: p.alder, somDenEr: p.somDenEr, krav, forsok: 0 };
            const r = ranger(alle, sak).kandidater[0];
            if (r) telling[r.niva]++;
            else {
              telling.lovsetning++;
              uten.push(`${h.id}.${under ?? "-"} ${tid} ${dato.slice(0, 4)} ${krav}${p.somDenEr ? " «som den er»" : ""}`);
            }
          }
  const total = telling.A + telling.B + telling.lovsetning;
  const andel = (telling.A + telling.B) / total;
  console.log(`${total} kombinasjoner: nivå A ${telling.A}, nivå B ${telling.B}, lovsetning ${telling.lovsetning}.`);
  console.log(`Dekning ${(andel * 100).toFixed(1)} % (krav ${KRAV_DEKNING * 100} %).`);
  for (const u of uten.slice(0, 20)) console.log(`  lovsetning: ${u}`);
  console.log(andel >= KRAV_DEKNING ? "GRØNN" : "RØD");
  process.exit(0);
}
main();
