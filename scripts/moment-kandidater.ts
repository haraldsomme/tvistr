// Candidate decisions for the moment catalogue (docs/momenter.md): counts over all dealer decisions of
// what the committee recorded, by defect group, timing and outcome, and a stratified sample of 200
// decisions (won and lost) for the models to read. Read-only.
//
//   npm run moment-kandidater

import { mkdirSync, writeFileSync } from "node:fs";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";
import { KNAPP_TIL_FEILTYPE } from "../src/lib/vurdering/faktorer";
import { GRUPPER } from "../src/lib/vurdering/henvisninger";

const UT = "data/explore/momenter";
const MAKS = 200;
const VUNNET_PER_CELLE = 4;
const TAPT_PER_CELLE = 3;
const rader = async (q: SQL) => (await db.execute(q)).rows as Record<string, unknown>[];

const GRUNN = sql`v.selger_type = 'forhandler' and not v.trenger_kontroll and v.kjoretoytype in ('personbil','varebil')`;
const VUNNET = sql`v.utfall in ('medhold','delvis_medhold')`;
const BOTTER: Record<string, SQL> = {
  rask: sql`v.dager_til_reklamasjon <= 180`,
  middels: sql`v.dager_til_reklamasjon between 181 and 730`,
  sen: sql`v.dager_til_reklamasjon > 730`,
};
const typerFor = (g: (typeof GRUPPER)[number]) => sql`array[${sql.join(KNAPP_TIL_FEILTYPE[g].map((t) => sql`${t}`), sql`, `)}]::text[]`;

// The 15 most common values of an array column, with their share among won and lost decisions.
async function vanligste(kolonne: string, filter: SQL): Promise<string> {
  const r = await rader(sql`
    with v as (select * from vedtak v where ${GRUNN} and ${filter}),
    tot as (select count(*) filter (where ${VUNNET}) vn, count(*) filter (where not ${VUNNET}) tp from v v)
    select x verdi, count(*) filter (where ${VUNNET}) vunnet, count(*) filter (where not ${VUNNET}) tapt, max(tot.vn) vn, max(tot.tp) tp
    from v v cross join tot, unnest(${sql.raw(`v.${kolonne}`)}) x group by x order by count(*) desc limit 15`);
  const pst = (a: unknown, b: unknown) => (Number(b) ? `${Math.round((100 * Number(a)) / Number(b))} %` : "–");
  return [`| ${kolonne} | vunne | tapte |`, "|---|---|---|", ...r.map((x) => `| ${x.verdi} | ${pst(x.vunnet, x.vn)} | ${pst(x.tapt, x.tp)} |`)].join("\n");
}

async function main() {
  mkdirSync(UT, { recursive: true });
  const md: string[] = ["# Telling over forhandlervedtak", "", "Andelen vunne og tapte saker der verdien forekommer.", ""];
  const valgt = new Set<number>();
  const kandidater: { id: number; gruppe: string; botte: string; utfall: string }[] = [];

  for (const gruppe of GRUPPER) {
    const filter = sql`v.feiltyper && ${typerFor(gruppe)}`;
    const [n] = await rader(sql`select count(*) filter (where ${VUNNET}) vunnet, count(*) filter (where not ${VUNNET}) tapt from vedtak v where ${GRUNN} and ${filter}`);
    md.push(`## ${gruppe} (vunnet ${n.vunnet}, tapt ${n.tapt})`, "");
    for (const k of ["bevistyper", "tvistetema", "mangelsgrunnlag"]) md.push(await vanligste(k, filter), "");
    for (const [botte, b] of Object.entries(BOTTER)) {
      for (const [vunnet, antall] of [[true, VUNNET_PER_CELLE], [false, TAPT_PER_CELLE]] as const) {
        const r = await rader(sql`select v.id, v.utfall from vedtak v where ${GRUNN} and ${filter} and ${b} and ${vunnet ? VUNNET : sql`not ${VUNNET}`}
          and length(v.fulltekst_renset) between 2000 and 40000 order by v.vedtaksdato desc limit ${antall + 10}`);
        let tatt = 0;
        for (const x of r) {
          const id = Number(x.id);
          if (tatt >= antall || valgt.has(id)) continue;
          valgt.add(id);
          kandidater.push({ id, gruppe, botte, utfall: String(x.utfall) });
          tatt++;
        }
      }
    }
  }
  const utvalg = kandidater.slice(0, MAKS);
  writeFileSync(`${UT}/kandidater.json`, `${JSON.stringify(utvalg, null, 2)}\n`);
  writeFileSync(`${UT}/telling.md`, md.join("\n"));
  const vunnet = utvalg.filter((k) => k.utfall === "medhold" || k.utfall === "delvis_medhold").length;
  console.log(`${utvalg.length} kandidater (${vunnet} vunnet, ${utvalg.length - vunnet} tapt). Telling: ${UT}/telling.md`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
