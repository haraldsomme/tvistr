// Writes the practice paragraph for one defect of a form against the index and the model, and prints
// what the verifier kept and struck (docs/praksis.md). Costs one model call (about 0,10–0,15 USD).
//
//   npm run praksis -- <skjema.json> <feil_id> [--idag ÅÅÅÅ-MM-DD] [--opptak testdata.json] [--generell]
//   npm run praksis -- --oppdater-opptak testdata.json     (no API: replays the recording)
//
// --generell writes the general paragraph from the jurist's block and examples for the defect's primary
// track, as when the filter finds no decision (src/lib/praksis/fast.ts; drafts are used before approval).
// --opptak saves the input, the model's answer and the verified paragraph, so skriv.test.ts can replay
// it without the API. Only the full texts the answer draws on are saved (redacted text, never the PDF).

import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../src/db";
import { kandidaterForFeil } from "../src/lib/sammenligning";
import { avledFeil, avledSak } from "../src/lib/sammenligning/avled";
import { lagHentEksempler, lagHentKandidater } from "../src/lib/sammenligning/kandidater";
import { PRAKSIS_FAST } from "../src/lib/praksis/fast";
import { lagHentAnalyse, lagHentFulltekst } from "../src/lib/praksis/fulltekst";
import { skrivPraksis } from "../src/lib/praksis/skriv";
import type { Skjema } from "../src/lib/skjema/skjema";

const arg = (navn: string) => {
  const i = process.argv.indexOf(navn);
  return i >= 0 ? process.argv[i + 1] : null;
};

// Replays a recording through the current verifier, without the API, and writes the new fasit: for when
// the verifier's rules change on purpose.
async function oppdaterOpptak(fil: string) {
  const o = JSON.parse(readFileSync(fil, "utf8"));
  const fulltekst = new Map(Object.entries(o.fulltekst as Record<string, string>).map(([k, v]) => [Number(k), v]));
  const p = await skrivPraksis(
    { skjema: o.skjema, feil_id: o.feil_id, modus: o.modus ?? "spesifikk", kandidater: o.kandidater, idag: o.idag, fast: o.fast ?? null },
    { hentFulltekst: async () => fulltekst, hentAnalyse: async () => new Map(), kall: async () => ({ input: o.raa, modell: "opptak", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 } }) },
  );
  o.fasit = { avsnitt: p.avsnitt, vedtak_id: p.vedtak_id, strykninger: p.strykninger };
  writeFileSync(fil, JSON.stringify(o, null, 2) + "\n");
  console.log(`Oppdaterte fasiten i ${fil}:\n${p.avsnitt ?? `(ingen: ${p.grunn})`}`);
}

async function main() {
  const oppdater = arg("--oppdater-opptak");
  if (oppdater) return oppdaterOpptak(oppdater);
  const [fil, feilId] = process.argv.slice(2);
  if (!fil || !feilId) throw new Error("Bruk: npm run praksis -- <skjema.json> <feil_id> [--idag ÅÅÅÅ-MM-DD] [--opptak fil.json]");
  const idag = arg("--idag") ?? new Date().toISOString().slice(0, 10);
  const skjema = JSON.parse(readFileSync(fil, "utf8")) as Skjema;
  const generell = process.argv.includes("--generell");
  const spor = avledFeil(avledSak(skjema, idag), skjema.del3_feil.find((f) => f.id === feilId)!).spor_primar;
  const blokk = generell && spor ? PRAKSIS_FAST[spor] : null;
  if (generell && !blokk) throw new Error("Feilen har ikke spor, så den har ingen fast blokk.");
  const kandidater = blokk
    ? (await lagHentEksempler(db)(blokk.eksempler, blokk.spor)).map((vedtak) => ({ vedtak, kriterier: [], antall_sterkere: 0, svakhet: null }))
    : await kandidaterForFeil(skjema, feilId, lagHentKandidater(db), idag);
  console.log(`${kandidater.length} ${blokk ? "eksempler" : "kandidater"}: ${kandidater.map((k) => `${k.vedtak.saksnummer} (${k.vedtak.spor}, ${k.antall_sterkere} sterkere)`).join(", ") || "–"}`);
  const hent = lagHentFulltekst(db);
  const modus = blokk ? "generell" : "spesifikk";
  const fast = blokk ? { tekst: blokk.tekst, spor: blokk.spor } : null;
  const p = await skrivPraksis({ skjema, feil_id: feilId, modus, kandidater, idag, fast }, { hentFulltekst: hent, hentAnalyse: lagHentAnalyse(db) });

  console.log(`\nValgt: ${p.vedtak_id ?? (p.eksempel_vedtak_ids.join(", ") || "–")}  Grunn: ${p.grunn ?? "–"}  Kostnad: ${p.forbruk ? `${p.forbruk.kostnadUsd.toFixed(3)} USD, ${p.forbruk.tokensInn} inn / ${p.forbruk.tokensUt} ut` : "–"}`);
  console.log(`\nAvsnitt:\n${p.avsnitt ?? "(ingen)"}`);
  if (p.strykninger.length) console.log(`\nStrøket:\n${p.strykninger.map((s) => `- [${s.regel}] ${s.detalj}: ${s.tekst}`).join("\n")}`);
  if (p.raa) console.log(`\nModellens begrunnelse: ${p.raa.begrunnelse}`);

  const ut = arg("--opptak");
  if (ut && p.raa) {
    const brukt = new Set([p.raa.valgt_vedtak_id, p.raa.sitat?.vedtak_id, ...p.raa.eksempel_vedtak_ids, ...p.raa.setninger.map((s) => s.belegg?.vedtak_id)].filter((x): x is number => x != null));
    const fulltekst = Object.fromEntries(await hent([...brukt]));
    writeFileSync(ut, JSON.stringify({ skjema, feil_id: feilId, idag, modus, fast, kandidater, fulltekst, raa: p.raa, fasit: { avsnitt: p.avsnitt, vedtak_id: p.vedtak_id, strykninger: p.strykninger } }, null, 2) + "\n");
    console.log(`\nSkrev ${ut}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
