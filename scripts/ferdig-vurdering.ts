// Ferdigkriterium 3 for the assessment (docs/ferdigkriterier.md): the counted table against a fresh
// count written directly in SQL, independent of src/lib/vurdering/statistikk.ts, for three subcategories.
//
//   npm run ferdig:vurdering
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { lesStatistikk } from "../src/lib/vurdering/statistikk-db";

const UTVALG = ["motor.turbo", "understell.bremser", "karosseri.rust"];

async function main() {
  const tabell = await lesStatistikk();
  let feil = 0;
  for (const nokkel of UTVALG) {
    const [hoved, under] = nokkel.split(".");
    const { rows } = await db.execute(sql`
      select count(distinct v.id) filter (where f->>'utfall' in ('medhold','avvist')) as saker,
             count(distinct v.id) filter (where f->>'utfall' = 'medhold' and v.utfall in ('medhold','delvis_medhold')) as medhold
      from vedtak v, jsonb_array_elements(v.feilvurdering->'feil') f
      where v.kjoretoytype in ('personbil','varebil') and v.lov = 'forbrukerkjøpsloven' and v.selger_type = 'forhandler'
        and v.utfall in ('medhold','delvis_medhold','ikke_medhold')
        and f->>'hovedkategori' = ${hoved} and f->>'underkategori' = ${under}`);
    const fersk = { saker: Number(rows[0].saker), medhold: Number(rows[0].medhold) };
    const t = tabell.get(nokkel);
    const lik = t?.antallSaker === fersk.saker && t?.antallMedhold === fersk.medhold;
    if (!lik) feil++;
    console.log(`${lik ? "LIK " : "ULIK"} ${nokkel}: tabell ${t?.antallMedhold} av ${t?.antallSaker}, fersk ${fersk.medhold} av ${fersk.saker}`);
  }
  console.log(feil ? `Rødt: ${feil} av ${UTVALG.length} ulike.` : `Grønt: ${UTVALG.length} av ${UTVALG.length} like.`);
  process.exit(feil ? 1 : 0);
}
main();
