// Candidate decisions for the library the letter cites (docs/henvisninger.md): the newest won dealer
// decisions per defect group, timing and car age, and per rule the letter can rest on. Read-only.
//
//   npm run henvisning-kandidater -- [--ut data/explore/henvisning-kandidater.json]
//   npm run henvisning-kandidater -- --tekst 1691      prints one decision's redacted text

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";
import { KNAPP_TIL_FEILTYPE } from "../src/lib/vurdering/faktorer";
import { GRUPPER } from "../src/lib/vurdering/henvisninger";

const { values: args } = parseArgs({ options: { ut: { type: "string", default: "data/explore/henvisning-kandidater.json" }, tekst: { type: "string" } } });
const rader = async (q: SQL) => (await db.execute(q)).rows as Record<string, unknown>[];
const PER_LISTE = 10;

const GRUNN = sql`v.selger_type = 'forhandler' and v.utfall in ('medhold','delvis_medhold') and not v.trenger_kontroll and v.kjoretoytype in ('personbil','varebil')`;
const BOTTER: Record<string, SQL> = {
  rask: sql`v.dager_til_reklamasjon <= 180`,
  middels: sql`v.dager_til_reklamasjon between 181 and 730`,
  sen: sql`v.dager_til_reklamasjon > 730`,
};
const ALDER: Record<string, SQL> = { yngre: sql`v.alder_ved_kjop <= 7`, eldre: sql`v.alder_ved_kjop >= 8` };
// Won without the presumption under the old law, so the decision fits a buyer who does not have it.
const UTEN_FORMODNING = sql`v.dager_til_reklamasjon > 180 and v.kjopsdato < '2024-01-01'`;
const FORMODNING_I_TEKST = sql`v.fulltekst_renset ~* '(formodningsregel|18 annet ledd|18 andre ledd)'`;
const REGLER: Record<string, SQL> = {
  "formodning/før_2024": sql`v.dager_til_reklamasjon <= 180 and v.kjopsdato < '2024-01-01' and v.alder_ved_kjop >= 10 and ${FORMODNING_I_TEKST}`,
  "formodning/etter_2024": sql`v.kjopsdato >= '2024-01-01' and v.dager_til_reklamasjon <= 730 and ${FORMODNING_I_TEKST}`,
  rapport: sql`${UTEN_FORMODNING} and v.alder_ved_kjop >= 8 and v.bevistyper && array['verkstedrapport','takst','NAF_test']::text[]`,
  opplysning: sql`${UTEN_FORMODNING} and v.alder_ved_kjop >= 8 and 'feil_opplysninger' = any(v.mangelsgrunnlag)`,
  forventning: sql`${UTEN_FORMODNING} and v.alder_ved_kjop >= 12 and 'om_det_er_mangel' = any(v.tvistetema)`,
};
const KOLONNER = sql`v.id, v.saksnummer, v.vedtaksdato::text vedtaksdato, v.kjopsdato::text kjopsdato, v.alder_ved_kjop alder, v.km_ved_kjop km,
  v.merke, v.modell, v.dager_til_reklamasjon dager, v.utfall, v.feiltyper, v.sammendrag, v.utvalgets_nokkelmomenter momenter`;

async function main() {
  if (args.tekst) {
    const [r] = await rader(sql`select saksnummer, vedtaksdato::text vedtaksdato, kilde_url, fulltekst_renset from vedtak where id = ${Number(args.tekst)}`);
    if (!r) throw new Error(`fant ikke vedtak ${args.tekst}`);
    console.log(`${r.saksnummer} · ${r.vedtaksdato} · ${r.kilde_url}\n\n${r.fulltekst_renset}`);
    return;
  }
  const lister: Record<string, Record<string, unknown>[]> = {};
  for (const gruppe of GRUPPER) {
    const typer = sql`array[${sql.join(KNAPP_TIL_FEILTYPE[gruppe].map((t) => sql`${t}`), sql`, `)}]::text[]`;
    for (const [botte, b] of Object.entries(BOTTER))
      for (const [alder, a] of Object.entries(ALDER))
        lister[`lignende/${gruppe}/${botte}/${alder}`] = await rader(
          sql`select ${KOLONNER} from vedtak v where ${GRUNN} and v.feiltyper && ${typer} and ${b} and ${a} order by v.vedtaksdato desc limit ${PER_LISTE}`,
        );
  }
  for (const [navn, r] of Object.entries(REGLER))
    lister[`regel/${navn}`] = await rader(sql`select ${KOLONNER} from vedtak v where ${GRUNN} and ${r} order by v.vedtaksdato desc limit ${PER_LISTE + 2}`);

  mkdirSync(dirname(args.ut!), { recursive: true });
  writeFileSync(args.ut!, JSON.stringify(lister, null, 2));
  for (const [navn, l] of Object.entries(lister)) console.log(`${navn.padEnd(36)} ${l.length}`);
  console.log(`Skrevet til ${args.ut}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
