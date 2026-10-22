// Writes one text file per decision for the feilvurdering agents (src/lib/feilvurdering/instruks.md),
// plus an id list for the Workflow run (scripts/workflows/uttrekk.js, oppgave feilvurdering).
//
//   npm run feilvurdering:hent -- --id 12,34 [--navn x]
//   npm run feilvurdering:hent -- --mangler   every decision without an assessment for the current version
//   npm run feilvurdering:hent -- --alle

import { parseArgs } from "node:util";
import { inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { FEILVURDERING_VERSJON } from "../src/lib/feilvurdering/skjema";
import { skrivInnfiler, tall, velg } from "./agentfiler";

const { values: args } = parseArgs({
  options: {
    mangler: { type: "boolean", default: false },
    alle: { type: "boolean", default: false },
    id: { type: "string" },
    navn: { type: "string" },
  },
});

const ider = async (q: SQL) => (await db.execute(q)).rows.map((r) => Number(r.id));

async function main() {
  const { navn, valgte } = await velg(args.navn, {
    id: args.id ? async () => tall(args.id!) : undefined,
    mangler: args.mangler
      ? () => ider(sql`select id from vedtak where fulltekst_renset is not null and feilvurdering_versjon is distinct from ${FEILVURDERING_VERSJON} order by id`)
      : undefined,
    alle: args.alle ? () => ider(sql`select id from vedtak where fulltekst_renset is not null order by id`) : undefined,
  });
  const rader = valgte.length
    ? await db
        .select({
          id: vedtak.id,
          saksnummer: vedtak.saksnummer,
          kjopsdato: vedtak.kjopsdato,
          overtakelsesdato: vedtak.overtakelsesdato,
          vedtaksdato: vedtak.vedtaksdato,
          utfall: vedtak.utfall,
          kravtyper: vedtak.kravtyper,
          fulltekst: vedtak.fulltekstRenset,
        })
        .from(vedtak)
        .where(inArray(vedtak.id, valgte))
    : [];
  skrivInnfiler("data/feilvurdering", navn, valgte, rader, (r) => {
    if (!r.fulltekst) return null;
    const hode = [
      `VEDTAK_ID: ${r.id}`,
      `SAKSNUMMER: ${r.saksnummer ?? "ukjent"}`,
      `KJØPSDATO: ${r.kjopsdato ?? "ukjent"}`,
      `OVERTAKELSESDATO: ${r.overtakelsesdato ?? "ukjent"}`,
      `VEDTAKSDATO: ${r.vedtaksdato ?? "ukjent"}`,
      `UTFALL: ${r.utfall ?? "ukjent"}`,
      `KRAV: ${(r.kravtyper ?? []).join(", ") || "ukjent"}`,
    ].join("\n");
    return `${hode}\n\n<vedtak>\n${r.fulltekst}\n</vedtak>\n`;
  }, "fulltekst");
  process.exit(0);
}
main();
