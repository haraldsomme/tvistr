// Runs every test case in src/lib/sammenligning/testdata/testsaker.json against the index and
// writes the results keyed by case id.
//
//   npm run sammenlign:testsaker -- --ut resultat.json

import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../src/db";
import { sammenlign, type Skjema } from "../src/lib/sammenligning";
import { lagHentKandidater } from "../src/lib/sammenligning/kandidater";

const i = process.argv.indexOf("--ut");
const saker = JSON.parse(readFileSync("src/lib/sammenligning/testdata/testsaker.json", "utf8")).saker as { id: string; input: Skjema }[];

(async () => {
  const hent = lagHentKandidater(db);
  const ut: Record<string, unknown> = {};
  for (const s of saker) ut[s.id] = await sammenlign(s.input, hent, "2026-10-09");
  const json = JSON.stringify(ut, null, 2);
  if (i >= 0) writeFileSync(process.argv[i + 1], json + "\n");
  else console.log(json);
  process.exit(0);
})();
