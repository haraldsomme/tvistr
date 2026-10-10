// Checks that an agent's answer to a practice prompt has the tool's shape (not whether it passes the
// verifier: the answer gets one attempt, as the model does in production).
//
//   TESTKJORING_MAPPE=data/testkjoring-opus npx tsx scripts/testkjoring/sjekk-svar.ts <hash> …

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sjekkSkjema } from "../../src/lib/ai/skjemasjekk";
import { PRAKSIS_VERKTOY } from "../../src/lib/praksis/prompt";

const MAPPE = process.env.TESTKJORING_MAPPE ?? "data/testkjoring";
let feil = 0;
for (const h of process.argv.slice(2)) {
  try {
    const svar = JSON.parse(readFileSync(join(MAPPE, "svar", `${h}.json`), "utf8"));
    const f = sjekkSkjema(PRAKSIS_VERKTOY.input_schema, svar);
    console.log(f.length ? `${h}: FEIL ${f.slice(0, 5).join("; ")}` : `${h}: ok`);
    feil += f.length ? 1 : 0;
  } catch (e) {
    console.log(`${h}: FEIL ${e instanceof Error ? e.message : e}`);
    feil++;
  }
}
process.exit(feil ? 1 : 0);
