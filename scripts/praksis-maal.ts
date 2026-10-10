// Measures the practice prompt for a form without calling the model: characters per part.
//   npx tsx --env-file=.env.local scripts/praksis-maal.ts <skjema.json> <feil_id> [--idag ÅÅÅÅ-MM-DD]
import { readFileSync } from "node:fs";
import { db } from "../src/db";
import { lagHentAnalyse, lagHentFulltekst } from "../src/lib/praksis/fulltekst";
import { PRAKSIS_SPESIFIKK } from "../src/lib/praksis/prompt";
import { skrivPraksis } from "../src/lib/praksis/skriv";
import { kandidaterForFeil } from "../src/lib/sammenligning";
import { lagHentKandidater } from "../src/lib/sammenligning/kandidater";

async function main() {
  const [fil, feilId] = process.argv.slice(2);
  const i = process.argv.indexOf("--idag");
  const idag = i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
  const skjema = JSON.parse(readFileSync(fil, "utf8"));
  const kandidater = await kandidaterForFeil(skjema, feilId, lagHentKandidater(db), idag);
  let bruker = "";
  await skrivPraksis({ skjema, feil_id: feilId, modus: "spesifikk", kandidater, idag }, {
    hentFulltekst: lagHentFulltekst(db),
    hentAnalyse: lagHentAnalyse(db),
    kall: async (o) => {
      bruker = o.bruker;
      throw new Error("bare måling");
    },
  });
  const deler = bruker.split(/(?=<kandidat )/);
  console.log(`system ${PRAKSIS_SPESIFIKK.length} tegn, bruker ${bruker.length} tegn (${kandidater.length} kandidater: ${deler.slice(1).map((d) => d.length).join(", ")})`);
}
main().then(() => process.exit(0));
