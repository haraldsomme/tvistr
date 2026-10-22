// Reads the agents' answers (data/avgjorende/ut/<id>.<version>.json), checks them against the
// decision's full text and the feilvurdering's accepted defects, and writes them to `vedtak`.
// Answers with hard errors go to data/avgjorende/avvist/ with the reason.
//
//   npm run avgjorende:importer                    every answer for the current version
//   npm run avgjorende:importer -- --liste pilot   only the ids in lister/pilot.json

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { AVGJORENDE_VERSJON } from "../src/lib/avgjorende/skjema";
import { lesSvar, signaturdato, utenRettsligPoeng, utenStandpunkt } from "../src/lib/avgjorende/verifiser";
import { anvendPaAvgjorende } from "../src/lib/vedtaksvalg/funn";
import { gjeldendeFunn } from "../src/lib/vedtaksvalg/funn-db";
import { importerSvar } from "./agentfiler";

const { values: args } = parseArgs({ options: { liste: { type: "string" } } });

const MAPPE = "data/avgjorende";
const lesJson = (fil: string) => JSON.parse(readFileSync(fil, "utf8"));

async function main() {
  await importerSvar({
    mappe: MAPPE,
    versjon: AVGJORENDE_VERSJON,
    liste: args.liste,
    hent: async (id) => (await db.select({ fulltekst: vedtak.fulltekstRenset, feilvurdering: vedtak.feilvurdering }).from(vedtak).where(eq(vedtak.id, id)))[0],
    lagre: async (id, raa, v) => {
      const medhold = v.feilvurdering?.feil.filter((f) => f.utfall === "medhold").map((f) => f.id) ?? [];
      const lest = lesSvar(raa, id, v.fulltekst, medhold);
      if (!lest.ok) return lest;
      // The field pass for quotes, when it has run for this decision (scripts/standpunkt-hent.ts).
      const inn = join(MAPPE, "standpunkt", "inn", `${id}.json`);
      const ut = join(MAPPE, "standpunkt", "ut", `${id}.json`);
      const s = existsSync(inn) && existsSync(ut) ? utenStandpunkt(lest.svar, lesJson(inn), lesJson(ut)) : { svar: lest.svar, kontroll: [] };
      lest.kontroll.push(...s.kontroll);
      // The data wash for the legal points' quotes, when it has run for this decision (scripts/rettslig-hent.ts).
      const rInn = join(MAPPE, "rettslig", "inn", `${id}.json`);
      const rUt = join(MAPPE, "rettslig", "ut", `${id}.json`);
      if (existsSync(rInn) && existsSync(rUt)) {
        const r = utenRettsligPoeng(s.svar, lesJson(rInn), lesJson(rUt));
        s.svar = r.svar;
        lest.kontroll.push(...r.kontroll);
      }
      const { vedtak_id: _, ...svar } = s.svar;
      // Quotes the safety net removed stay removed (src/lib/vedtaksvalg/funn.ts).
      const lagres = anvendPaAvgjorende({ ...svar, signaturdato: signaturdato(v.fulltekst) }, await gjeldendeFunn(id));
      await db
        .update(vedtak)
        .set({ avgjorende: lagres, avgjorendeVersjon: AVGJORENDE_VERSJON, avgjorendeTidspunkt: new Date(), avgjorendeKontroll: lest.kontroll })
        .where(eq(vedtak.id, id));
      return { ok: true, kontroll: lest.kontroll };
    },
    art: (k) => k.replace(/^[^:]*: /, "").replace(/grunnlag .* ukjent/, "grunnlag ukjent"),
  });
  process.exit(0);
}
main();
