// Reads the agents' answers (data/feilvurdering/ut/<id>.<version>.json), checks them against the
// decision's full text, derives the search columns and writes them to `vedtak`. Answers with hard
// errors go to data/feilvurdering/avvist/ with the reason, and nothing is stored for them. Running
// it again replaces what is stored, so a changed derivation only needs a re-import.
//
//   npm run feilvurdering:importer                    every answer for the current version
//   npm run feilvurdering:importer -- --liste pilot   only the ids in lister/pilot.json

import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { avled, prisavslagProsent } from "../src/lib/feilvurdering/avled";
import { FEILVURDERING_VERSJON } from "../src/lib/feilvurdering/skjema";
import { lesSvar } from "../src/lib/feilvurdering/verifiser";
import { anvendPaFeilvurdering } from "../src/lib/vedtaksvalg/funn";
import { gjeldendeFunn } from "../src/lib/vedtaksvalg/funn-db";
import { importerSvar } from "./agentfiler";

const { values: args } = parseArgs({ options: { liste: { type: "string" } } });

async function main() {
  await importerSvar({
    mappe: "data/feilvurdering",
    versjon: FEILVURDERING_VERSJON,
    liste: args.liste,
    hent: async (id) =>
      (
        await db
          .select({ fulltekst: vedtak.fulltekstRenset, kjopsdato: vedtak.kjopsdato, overtakelsesdato: vedtak.overtakelsesdato, vedtaksdato: vedtak.vedtaksdato, dagerTilReklamasjon: vedtak.dagerTilReklamasjon, prisavslag: vedtak.tilkjentPrisavslagNok, kjopesum: vedtak.kjopesumNok })
          .from(vedtak)
          .where(eq(vedtak.id, id))
      )[0],
    lagre: async (id, raa, v) => {
      const lest = lesSvar(raa, id, v.fulltekst);
      if (!lest.ok) return lest;
      const a = avled(lest.svar, v);
      await db
        .update(vedtak)
        .set({
          // Defects the safety net found not named or not judged on their own stay `samlet` (src/lib/vedtaksvalg/funn.ts).
          feilvurdering: anvendPaFeilvurdering(a.lagret, await gjeldendeFunn(id)),
          feilvurderingVersjon: FEILVURDERING_VERSJON,
          feilvurderingTidspunkt: new Date(),
          feilvurderingKontroll: lest.kontroll,
          godtatteKategorier: a.godtatteKategorier,
          godtatteUnderkategorier: a.godtatteUnderkategorier,
          godtatteNiva: a.godtatteNiva,
          prisavslagProsent: prisavslagProsent(lest.svar.sanksjoner, v.prisavslag, v.kjopesum),
          sanksjoner: lest.svar.sanksjoner,
          rettingsforsok: lest.svar.rettingsforsok,
          somDenEr: lest.svar.som_den_er,
          dagerTilFeil: a.dagerTilFeil,
          lovversjonAvledet: a.lovversjon,
        })
        .where(eq(vedtak.id, id));
      return { ok: true, kontroll: lest.kontroll };
    },
    // Without the defect id.
    art: (k) => k.replace(/^f\d+: /, "").replace(/ .*(hører ikke til|passer ikke).*/, " $1"),
  });
  process.exit(0);
}
main();
