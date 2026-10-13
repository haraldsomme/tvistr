// Finds the decision paragraph for each of the twelve simulated cases (scripts/simulerte-saker.ts) with
// the same chain as finnVedtak (ranking → one model call → template) and stores it, so the golden
// letters (src/lib/brev/gylne.test.ts) can be built without the database or the model. Run once, and
// again only when the ranking, the choice or the paragraph template changes.
//
//   npm run brev:praksis

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import type { Brevsak } from "../src/lib/brev/typer";
import type { AvledetFeil } from "../src/lib/feilvurdering/skjema";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";
import { ranger } from "../src/lib/matching/ranger";
import type { Kandidat } from "../src/lib/matching/typer";
import { byggSaken } from "../src/lib/vedtaksvalg/kjoper";
import { UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "../src/lib/vedtaksvalg/valg";
import { SAKER } from "./simulerte-saker";

const UT = "src/lib/brev/__fixtures__/praksis.json";

async function main() {
  const alle: Kandidat[] = await db
    .select({
      id: vedtak.id,
      saksnummer: vedtak.saksnummer,
      vedtaksdato: vedtak.vedtaksdato,
      km: vedtak.kmVedKjop,
      alder: vedtak.alderVedKjop,
      somDenEr: vedtak.somDenEr,
      sanksjoner: vedtak.sanksjoner,
      mangelsgrunnlag: vedtak.mangelsgrunnlag,
      paragrafer: vedtak.paragrafer,
      tvistetema: vedtak.tvistetema,
      feil: sql<AvledetFeil[]>`coalesce(${vedtak.feilvurdering}->'feil', '[]'::jsonb)`,
      avgjorende: vedtak.avgjorende,
    })
    .from(vedtak)
    .where(GRUNNFILTER);
  const etterId = new Map(alle.map((k) => [k.id, k]));

  const praksis: Record<string, Brevsak["praksis"]> = {};
  let sum = 0;
  for (const x of SAKER) {
    const { sak, kjoper } = byggSaken({ kjopsdato: x.kjopsdato, km: x.km, ar: x.ar, somDenEr: x.somDenEr === "vet_ikke" ? null : x.somDenEr, krav: x.krav, forsok: x.forsok, feil: x.feil });
    const { kandidater } = ranger(alle, sak);
    if (!kandidater.length) {
      praksis[x.navn] = null;
      console.log(`${x.navn.padEnd(36)} ingen kandidat (lovsetning)`);
      continue;
    }
    const rader = await db
      .select({ id: vedtak.id, kildeUrl: vedtak.kildeUrl, utvalg: UTVALG_I_TEKSTEN, merke: vedtak.merke, modell: vedtak.modell, arsmodell: vedtak.arsmodell })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const detaljer = new Map<number, Vedtaksdetaljer>(rader.map(({ id, ...d }) => [id, d]));
    const svar = await velgVedtak({ kjoper, sak, kandidater, alle: etterId, detaljer });
    const valgt = etterId.get(svar.r.id)!;
    praksis[x.navn] = { avsnitt: svar.avsnitt, kildeUrl: detaljer.get(valgt.id)!.kildeUrl, saksnummer: valgt.saksnummer };
    sum += svar.forbruk.kostnadUsd;
    console.log(`${x.navn.padEnd(36)} nivå ${svar.niva}  ${String(valgt.saksnummer).padEnd(16)} $${svar.forbruk.kostnadUsd.toFixed(4)}`);
  }
  mkdirSync(dirname(UT), { recursive: true });
  writeFileSync(UT, JSON.stringify(praksis, null, 1) + "\n");
  console.log(`\n${Object.keys(praksis).length} saker skrevet til ${UT}. Sum $${sum.toFixed(3)}.`);
  process.exit(0);
}
main();
