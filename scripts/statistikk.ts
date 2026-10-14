// Builds `statistikk_kategori`, the figures the free assessment shows (src/lib/vurdering/statistikk.ts).
// The imports run the same at the end; run this alone after a change to the counting.
//
//   npm run statistikk:bygg
import { ALLE } from "../src/lib/vurdering/statistikk";
import { lagreStatistikk } from "../src/lib/vurdering/statistikk-db";

lagreStatistikk()
  .then((rader) => {
    const alle = rader.find((r) => r.nokkel === ALLE)!;
    console.log(`statistikk_kategori: ${rader.length} rader, ${alle.antallSaker} vedtak (${alle.antallMedhold} med medhold).`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
