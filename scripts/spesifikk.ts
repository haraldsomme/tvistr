// Measures erSpesifikk against pass 2's labelled written statements (rekkevidde spesifikk | generell)
// and compares with the frozen baseline. Precision on «specific» is what matters: a general statement
// called specific gives a false track A. Fails when more than 10 % of the general ones are called
// specific, on the whole set or on the held-out half (odd vedtak_id; the rule was tuned on the even).
//
//   npm run spesifikk              # compare with src/lib/sammenligning/testdata/spesifikk-fasit.json
//   npm run spesifikk -- --frys    # write a new baseline
//   npm run spesifikk -- --vis 20  # show the misses

import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { erSpesifikk } from "../src/lib/sammenligning/spesifikk";

const FASIT = "src/lib/sammenligning/testdata/spesifikk-fasit.json";
const GRENSE = 10;

type Rad = { vedtak_id: number; ordlyd: string; spesifikk: boolean };

function maal(rader: Rad[]) {
  const generelle = rader.filter((r) => !r.spesifikk);
  const spesifikke = rader.filter((r) => r.spesifikk);
  const fp = generelle.filter((r) => erSpesifikk(r.ordlyd));
  const fn = spesifikke.filter((r) => !erSpesifikk(r.ordlyd));
  const pst = (a: number, b: number) => Math.round((1000 * a) / b) / 10;
  return {
    resultat: { utsagn: rader.length, generell_kalt_spesifikk_prosent: pst(fp.length, generelle.length), spesifikk_kalt_generell_prosent: pst(fn.length, spesifikke.length) },
    fp,
    fn,
  };
}

async function main() {
  const { rows } = await db.execute(sql`
    select a.vedtak_id, o->>'ordlyd' as ordlyd, o->>'rekkevidde' = 'spesifikk' as spesifikk
    from vedtak_analyse a, jsonb_array_elements(a.opplysninger) o
    where o->>'type' = 'uttalelse' and o->>'ordlyd' is not null and o->>'rekkevidde' in ('spesifikk', 'generell')
      and o->>'form' in ('annonse', 'kontrakt', 'melding', 'salgsoppgave', 'tilstandsrapport_fra_selger')`);
  const rader = rows as unknown as Rad[];
  const alle = maal(rader);
  const utvikling = maal(rader.filter((r) => r.vedtak_id % 2 === 0));
  const test = maal(rader.filter((r) => r.vedtak_id % 2 === 1));
  const resultat = { alle: alle.resultat, utvikling: utvikling.resultat, test: test.resultat };
  console.log(JSON.stringify(resultat, null, 2));

  const i = process.argv.indexOf("--vis");
  if (i >= 0) {
    const n = Number(process.argv[i + 1] ?? 20);
    console.log("\nGenerelle kalt spesifikke:\n" + alle.fp.slice(0, n).map((r) => `  ${r.ordlyd.slice(0, 120)}`).join("\n"));
    console.log("\nSpesifikke kalt generelle:\n" + alle.fn.slice(0, n).map((r) => `  ${r.ordlyd.slice(0, 120)}`).join("\n"));
  }

  if (process.argv.includes("--frys")) {
    writeFileSync(FASIT, JSON.stringify(resultat, null, 2) + "\n");
    console.log(`Skrev ${FASIT}`);
  } else {
    try {
      const fasit = JSON.parse(readFileSync(FASIT, "utf8"));
      console.log(JSON.stringify(fasit) === JSON.stringify(resultat) ? "\nSom fasiten." : `\nFasiten var:\n${JSON.stringify(fasit, null, 2)}`);
    } catch {
      console.log(`\nIngen fasit ennå (${FASIT}); kjør med --frys.`);
    }
  }
  const over = [alle, test].some((m) => m.resultat.generell_kalt_spesifikk_prosent > GRENSE);
  if (over) console.error(`\nFor mange generelle utsagn kalles spesifikke (grense ${GRENSE} %).`);
  process.exit(over ? 1 : 0);
}
main();
