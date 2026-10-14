// Reads the agents' answers (data/feilvurdering/ut/<id>.<version>.json), checks them against the
// decision's full text, derives the search columns and writes them to `vedtak`. Answers with hard
// errors go to data/feilvurdering/avvist/ with the reason, and nothing is stored for them. Running
// it again replaces what is stored, so a changed derivation only needs a re-import.
//
//   npm run feilvurdering:importer                    every answer for the current version
//   npm run feilvurdering:importer -- --liste pilot   only the ids in lister/pilot.json

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { avled, prisavslagProsent } from "../src/lib/feilvurdering/avled";
import { FEILVURDERING_VERSJON } from "../src/lib/feilvurdering/skjema";
import { lesSvar } from "../src/lib/feilvurdering/verifiser";
import { kjorParallelt } from "../src/lib/parallell";
import { anvendPaFeilvurdering } from "../src/lib/vedtaksvalg/funn";
import { gjeldendeFunn } from "../src/lib/vedtaksvalg/funn-db";
import { lagreStatistikk } from "../src/lib/vurdering/statistikk-db";

const { values: args } = parseArgs({ options: { liste: { type: "string" } } });

const MAPPE = "data/feilvurdering";
const UT = join(MAPPE, "ut");
const AVVIST = join(MAPPE, "avvist");

function ider(): number[] {
  if (args.liste) return JSON.parse(readFileSync(join(MAPPE, "lister", `${args.liste}.json`), "utf8")) as number[];
  const slutt = `.${FEILVURDERING_VERSJON}.json`;
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
    const fil = join(UT, `${id}.${FEILVURDERING_VERSJON}.json`);
    if (!existsSync(fil)) {
      manglerSvar++;
      return;
    }
    const [v] = await db
      .select({ fulltekst: vedtak.fulltekstRenset, kjopsdato: vedtak.kjopsdato, overtakelsesdato: vedtak.overtakelsesdato, vedtaksdato: vedtak.vedtaksdato, dagerTilReklamasjon: vedtak.dagerTilReklamasjon, prisavslag: vedtak.tilkjentPrisavslagNok, kjopesum: vedtak.kjopesumNok })
      .from(vedtak)
      .where(eq(vedtak.id, id));
    let raa: unknown;
    try {
      raa = JSON.parse(readFileSync(fil, "utf8"));
    } catch {
      raa = undefined;
    }
    const lest = !v?.fulltekst ? ({ ok: false, feil: "vedtaket eller fulltekst finnes ikke" } as const) : raa === undefined ? ({ ok: false, feil: "ugyldig JSON" } as const) : lesSvar(raa, id, v.fulltekst);
    if (!lest.ok) {
      avvist.push(`${id}: ${lest.feil}`);
      writeFileSync(join(AVVIST, `${id}.${FEILVURDERING_VERSJON}.json`), JSON.stringify({ grunn: lest.feil, svar: raa ?? null }, null, 2));
      return;
    }
    const a = avled(lest.svar, v);
    await db
      .update(vedtak)
      .set({
        // Defects the safety net found not named or not judged on their own stay `samlet` (src/lib/vedtaksvalg/funn.ts).
        feilvurdering: anvendPaFeilvurdering(a.lagret, await gjeldendeFunn(id)),
        feilvurderingVersjon: FEILVURDERING_VERSJON,
        feilvurderingTidspunkt: new Date(),
        feilvurderingKontroll: lest.kontroll,
        godtatteKategorier: a.godtatteKategorier,
        godtatteUnderkategorier: a.godtatteUnderkategorier,
        godtatteNiva: a.godtatteNiva,
        prisavslagProsent: prisavslagProsent(lest.svar.sanksjoner, v.prisavslag, v.kjopesum),
        sanksjoner: lest.svar.sanksjoner,
        rettingsforsok: lest.svar.rettingsforsok,
        somDenEr: lest.svar.som_den_er,
        dagerTilFeil: a.dagerTilFeil,
        lovversjonAvledet: a.lovversjon,
      })
      .where(eq(vedtak.id, id));
    lagret++;
    // Counted per kind of check, without the defect id, so the summary shows patterns.
    for (const k of lest.kontroll) {
      const art = k.replace(/^f\d+: /, "").replace(/ .*(hører ikke til|passer ikke).*/, " $1");
      kontrollAntall.set(art, (kontrollAntall.get(art) ?? 0) + 1);
    }
  });

  console.log(`${lagret} lagret, ${avvist.length} avvist, ${manglerSvar} uten svar (av ${alle.length}).`);
  for (const a of avvist) console.log(`  avvist ${a}`);
  if (kontrollAntall.size) {
    console.log("Rettet eller nullet:");
    for (const [k, n] of [...kontrollAntall].sort((x, y) => y[1] - x[1])) console.log(`  ${n} × ${k}`);
  }
  // The assessment's figures are counted from what was just imported (src/lib/vurdering/statistikk.ts).
  const statistikk = await lagreStatistikk();
  console.log(`statistikk_kategori: ${statistikk.length} rader`);
  process.exit(0);
}
main();
