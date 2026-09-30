// Decides for each downloaded decision whether it concerns buying a used vehicle.
// Reads only the opening of the decision. Resumable: only documents with status 'hentet' are
// processed (or also 'klassifisert' with --på-nytt).
//
//   npm run klassifiser -- [--grense N] [--spredt] [--på-nytt] [--samtidig 6]

import { parseArgs } from "node:util";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { kildedokument } from "../src/db/schema";
import { erKontofeil, kallVerktoy } from "../src/lib/ai/klient";
import { KLASSIFISERING_SYSTEM, KLASSIFISERING_VERSJON } from "../src/lib/ai/prompter";
import { fraModell, KLASSIFISERING_SKJEMA, type Klassifisering } from "../src/lib/ai/skjema";
import { kjorParallelt } from "../src/lib/parallell";
import { rens, TOM_ID } from "../src/lib/personvern/rens";
import { innledning, lesPdfTekst } from "../src/lib/tekst/pdf";

const { values: args } = parseArgs({
  options: {
    grense: { type: "string" },
    spredt: { type: "boolean", default: false },
    "på-nytt": { type: "boolean", default: false },
    samtidig: { type: "string", default: "6" },
  },
});

async function main() {
  const statuser = args["på-nytt"] ? (["hentet", "klassifisert"] as const) : (["hentet"] as const);
  const grense = args.grense ? Number(args.grense) : 1_000_000;
  const dokumenter = await db
    .select({ id: kildedokument.id, lokalSti: kildedokument.lokalSti, kostnadUsd: kildedokument.kostnadUsd, tokensInn: kildedokument.tokensInn, tokensUt: kildedokument.tokensUt })
    .from(kildedokument)
    .where(and(inArray(kildedokument.status, [...statuser]), sql`${kildedokument.lokalSti} is not null`))
    // --spredt takes documents round-robin across years, in a stable pseudo-random order.
    .orderBy(
      ...(args.spredt
        ? [sql`row_number() over (partition by ${kildedokument.ar} order by md5(${kildedokument.id}::text))`, kildedokument.ar]
        : [kildedokument.id]),
    )
    .limit(grense);

  console.log(`Klassifiserer ${dokumenter.length} dokumenter (${KLASSIFISERING_VERSJON}).`);
  const telling: Record<string, number> = {};
  let kostnad = 0;
  let ferdig = 0;

  await kjorParallelt(dokumenter, Number(args.samtidig), async (dok) => {
    let utfall: string;
    try {
      const { tekst } = await lesPdfTekst(dok.lokalSti!);
      const svar = await kallVerktoy<Klassifisering>({
        system: KLASSIFISERING_SYSTEM,
        verktoy: { name: "klassifiser_vedtak", description: "Registrer hva vedtaket gjelder.", input_schema: KLASSIFISERING_SKJEMA },
        bruker: `<vedtak_start>\n${innledning(tekst)}\n</vedtak_start>`,
        effort: "low",
        maksTokens: 4000,
      });
      const k = fraModell(svar.input);
      const erBrukt = k.kategori === "brukt_kjoretoy";
      await db
        .update(kildedokument)
        .set({
          erBruktbil: erBrukt,
          kjoretoytype: erBrukt ? k.kjoretoytype : null,
          klassifiseringBegrunnelse: `${k.kategori}: ${rens(k.begrunnelse, TOM_ID)}`,
          klassifiseringModell: `${svar.modell} / ${KLASSIFISERING_VERSJON}`,
          status: "klassifisert",
          feilmelding: null,
          tokensInn: dok.tokensInn + svar.forbruk.tokensInn,
          tokensUt: dok.tokensUt + svar.forbruk.tokensUt,
          kostnadUsd: dok.kostnadUsd + svar.forbruk.kostnadUsd,
        })
        .where(eq(kildedokument.id, dok.id));
      kostnad += svar.forbruk.kostnadUsd;
      utfall = erBrukt ? `brukt:${k.kjoretoytype ?? "?"}` : k.kategori;
    } catch (e) {
      if (erKontofeil(e)) throw e;
      utfall = "feil";
      await db.update(kildedokument).set({ feilmelding: `klassifisering: ${(e as Error).message}`.slice(0, 500) }).where(eq(kildedokument.id, dok.id));
    }
    telling[utfall] = (telling[utfall] ?? 0) + 1;
    ferdig++;
    if (ferdig % 25 === 0 || ferdig === dokumenter.length) {
      console.log(`  ${ferdig}/${dokumenter.length} $${kostnad.toFixed(2)} ${JSON.stringify(telling)}`);
    }
  });
}

main().catch((e) => {
  if (erKontofeil(e)) {
    console.error(`STOPP: ${(e as Error).message.slice(0, 200)}\nKjør skriptet på nytt når kontoen er i orden; det fortsetter der det slapp.`);
    process.exit(3);
  }
  console.error(e);
  process.exit(1);
});
