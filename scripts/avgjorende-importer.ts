// Reads the agents' answers (data/avgjorende/ut/<id>.<version>.json), checks them against the
// decision's full text and the feilvurdering's accepted defects, and writes them to `vedtak`.
// Answers with hard errors go to data/avgjorende/avvist/ with the reason.
//
//   npm run avgjorende:importer                    every answer for the current version
//   npm run avgjorende:importer -- --liste pilot   only the ids in lister/pilot.json

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { AVGJORENDE_VERSJON } from "../src/lib/avgjorende/skjema";
import { lesSvar, signaturdato, utenRettsligPoeng, utenStandpunkt } from "../src/lib/avgjorende/verifiser";
import { kjorParallelt } from "../src/lib/parallell";
import { anvendPaAvgjorende } from "../src/lib/vedtaksvalg/funn";
import { gjeldendeFunn } from "../src/lib/vedtaksvalg/funn-db";

const { values: args } = parseArgs({ options: { liste: { type: "string" } } });

const MAPPE = "data/avgjorende";
const UT = join(MAPPE, "ut");
const AVVIST = join(MAPPE, "avvist");
const STANDPUNKT = join(MAPPE, "standpunkt");

function ider(): number[] {
  if (args.liste) return JSON.parse(readFileSync(join(MAPPE, "lister", `${args.liste}.json`), "utf8")) as number[];
  const slutt = `.${AVGJORENDE_VERSJON}.json`;
  return readdirSync(UT)
    .filter((f) => f.endsWith(slutt))
    .map((f) => Number(f.slice(0, -slutt.length)))
    .filter(Number.isInteger);
}

async function main() {
  mkdirSync(AVVIST, { recursive: true });
  const alle = ider();
  let lagret = 0;
  let manglerSvar = 0;
  const avvist: string[] = [];
  const kontrollAntall = new Map<string, number>();

  await kjorParallelt(alle, 6, async (id) => {
    const fil = join(UT, `${id}.${AVGJORENDE_VERSJON}.json`);
    if (!existsSync(fil)) {
      manglerSvar++;
      return;
    }
    const [v] = await db.select({ fulltekst: vedtak.fulltekstRenset, feilvurdering: vedtak.feilvurdering }).from(vedtak).where(eq(vedtak.id, id));
    let raa: unknown;
    try {
      raa = JSON.parse(readFileSync(fil, "utf8"));
    } catch {
      raa = undefined;
    }
    const medhold = v?.feilvurdering?.feil.filter((f) => f.utfall === "medhold").map((f) => f.id) ?? [];
    const lest = !v?.fulltekst ? ({ ok: false, feil: "vedtaket eller fulltekst finnes ikke" } as const) : raa === undefined ? ({ ok: false, feil: "ugyldig JSON" } as const) : lesSvar(raa, id, v.fulltekst, medhold);
    if (!lest.ok) {
      avvist.push(`${id}: ${lest.feil}`);
      writeFileSync(join(AVVIST, `${id}.${AVGJORENDE_VERSJON}.json`), JSON.stringify({ grunn: lest.feil, svar: raa ?? null }, null, 2));
      return;
    }
    // The field pass for quotes, when it has run for this decision (scripts/standpunkt-hent.ts).
    const inn = join(STANDPUNKT, "inn", `${id}.json`);
    const ut = join(STANDPUNKT, "ut", `${id}.json`);
    const s = existsSync(inn) && existsSync(ut) ? utenStandpunkt(lest.svar, JSON.parse(readFileSync(inn, "utf8")), JSON.parse(readFileSync(ut, "utf8"))) : { svar: lest.svar, kontroll: [] };
    lest.kontroll.push(...s.kontroll);
    // The data wash for the legal points' quotes, when it has run for this decision (scripts/rettslig-hent.ts).
    const rInn = join(MAPPE, "rettslig", "inn", `${id}.json`);
    const rUt = join(MAPPE, "rettslig", "ut", `${id}.json`);
    if (existsSync(rInn) && existsSync(rUt)) {
      const r = utenRettsligPoeng(s.svar, JSON.parse(readFileSync(rInn, "utf8")), JSON.parse(readFileSync(rUt, "utf8")));
      s.svar = r.svar;
      lest.kontroll.push(...r.kontroll);
    }
    const { vedtak_id: _, ...svar } = s.svar;
    // Quotes the safety net removed stay removed (src/lib/vedtaksvalg/funn.ts).
    const lagres = anvendPaAvgjorende({ ...svar, signaturdato: signaturdato(v.fulltekst!) }, await gjeldendeFunn(id));
    await db
      .update(vedtak)
      .set({ avgjorende: lagres, avgjorendeVersjon: AVGJORENDE_VERSJON, avgjorendeTidspunkt: new Date(), avgjorendeKontroll: lest.kontroll })
      .where(eq(vedtak.id, id));
    lagret++;
    for (const k of lest.kontroll) {
      const art = k.replace(/^[^:]*: /, "").replace(/grunnlag .* ukjent/, "grunnlag ukjent");
      kontrollAntall.set(art, (kontrollAntall.get(art) ?? 0) + 1);
    }
  });

  console.log(`${lagret} lagret, ${avvist.length} avvist, ${manglerSvar} uten svar (av ${alle.length}).`);
  for (const a of avvist) console.log(`  avvist ${a}`);
  if (kontrollAntall.size) {
    console.log("Rettet eller nullet:");
    for (const [k, n] of [...kontrollAntall].sort((x, y) => y[1] - x[1])) console.log(`  ${n} × ${k}`);
  }
  process.exit(0);
}
main();
