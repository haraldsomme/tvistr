// The field pass for quotes (docs/ferdigkriterier.md: a red field is run again on its own): writes,
// for each decision with an extraction, its quotes with the text around them, for agents that judge
// whether each is the committee's own standpoint (src/lib/avgjorende/standpunkt.md). The import
// (scripts/avgjorende-importer.ts) drops the quotes judged not to be.
//
//   npm run standpunkt:hent   (once: the import matches the answers to these files, so do not rewrite them after the pass)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { delOpp } from "../src/lib/avgjorende/verifiser";
import { normaliser } from "../src/lib/feilvurdering/verifiser";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";

export const MAPPE = "data/avgjorende/standpunkt";
const KONTEKST = 600;

// The text around a quote in the assessment, matched on normalised text.
function rundt(vurdering: string, sitat: string): string {
  const tekst = normaliser(vurdering);
  const i = tekst.indexOf(normaliser(sitat).slice(0, 60));
  if (i < 0) return "";
  return tekst.slice(Math.max(0, i - KONTEKST), i + sitat.length + KONTEKST);
}

async function main() {
  const rader = await db.select({ id: vedtak.id, t: vedtak.fulltekstRenset, a: vedtak.avgjorende }).from(vedtak).where(and(GRUNNFILTER, isNotNull(vedtak.avgjorende)));
  mkdirSync(join(MAPPE, "inn"), { recursive: true });
  mkdirSync(join(MAPPE, "ut"), { recursive: true });
  const ider: number[] = [];
  let antall = 0;
  for (const r of rader) {
    const vurdering = delOpp(r.t ?? "").vurdering ?? r.t ?? "";
    const sitater = [
      ...(r.a?.feil ?? []).flatMap((f) => f.sitater.map((tekst, i) => ({ id: `${f.id}.s${i + 1}`, tekst }))),
      ...(r.a?.rettslige_sitater ?? []).map((s) => ({ id: `rettslig.${s.poeng}`, tekst: s.sitat })),
    ];
    if (!sitater.length) continue;
    writeFileSync(join(MAPPE, "inn", `${r.id}.json`), JSON.stringify(sitater));
    const tekst = sitater.map((s) => `## ${s.id}\nSITAT: ${s.tekst}\nTEKSTEN RUNDT: …${rundt(vurdering, s.tekst)}…`).join("\n\n");
    writeFileSync(join(MAPPE, "inn", `${r.id}.txt`), `VEDTAK_ID: ${r.id}\n\n${tekst}\n`);
    ider.push(r.id);
    antall += sitater.length;
  }
  writeFileSync(join(MAPPE, "liste.json"), JSON.stringify(ider));
  console.log(`${ider.length} vedtak, ${antall} sitater skrevet til ${MAPPE}/inn.`);
  process.exit(0);
}
main();
