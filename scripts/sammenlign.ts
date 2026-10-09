// Runs the comparison engine on a form against the database and prints the result as JSON.
//
//   npm run sammenlign -- src/lib/sammenligning/testdata/enyaq-skjema.json [--idag 2026-10-09] [--ut fil.json]

import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../src/db";
import { sammenlign, type Skjema } from "../src/lib/sammenligning";
import { lagHentKandidater } from "../src/lib/sammenligning/kandidater";

const args = process.argv.slice(2);
const flagg = (navn: string) => {
  const i = args.indexOf(navn);
  return i >= 0 ? args[i + 1] : undefined;
};
const fil = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!fil) throw new Error("Oppgi skjemafil");

const skjema = JSON.parse(readFileSync(fil, "utf8")) as Skjema;
sammenlign(skjema, lagHentKandidater(db), flagg("--idag")).then((r) => {
  const json = JSON.stringify(r, null, 2);
  const ut = flagg("--ut");
  if (ut) writeFileSync(ut, json + "\n");
  else console.log(json);
});
