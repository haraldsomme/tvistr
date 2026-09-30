// Second, independent privacy pass over stored (already redacted) text. Runs the control prompt on
// the flagged decisions plus a random sample of the rest, removes whatever it finds, and reports
// how often a name slipped through (an estimate of the residual leak rate for unflagged decisions).
//
//   npm run personvern -- [--utvalg 300] [--samtidig 8]

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { eq, notInArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { erKontofeil, kallVerktoy } from "../src/lib/ai/klient";
import { KONTROLL_SYSTEM } from "../src/lib/ai/prompter";
import { KONTROLL_SKJEMA } from "../src/lib/ai/skjema";
import { kjorParallelt } from "../src/lib/parallell";
import { rens, rensValgfri, TOM_ID, type Identifikatorer } from "../src/lib/personvern/rens";
import { MERKNAD } from "../src/lib/validering";

const { values: args } = parseArgs({ options: { utvalg: { type: "string", default: "300" }, samtidig: { type: "string", default: "8" } } });

type Funn = { funn: { tekst: string; type: string }[] };
type Gruppe = "flagget" | "tilfeldig";

async function main() {
  const flagget = (await db.execute(sql`select id from vedtak where exists (
    select 1 from unnest(kontroll_arsaker) a where a like 'kontrollkallet fant%(personnavn)%' or a like 'mulig gjenværende%')`)).rows.map((r) => Number(r.id));
  const tilfeldig = (
    await db
      .select({ id: vedtak.id })
      .from(vedtak)
      .where(flagget.length ? notInArray(vedtak.id, flagget) : undefined)
      .orderBy(sql`md5(${vedtak.id}::text || 'personvern-2026')`)
      .limit(Number(args.utvalg))
  ).map((r) => r.id);
  const jobber: { id: number; gruppe: Gruppe }[] = [...flagget.map((id) => ({ id, gruppe: "flagget" as const })), ...tilfeldig.map((id) => ({ id, gruppe: "tilfeldig" as const }))];
  console.log(`Kontrollerer ${flagget.length} flaggede og ${tilfeldig.length} tilfeldige vedtak.`);

  const telling: Record<Gruppe, { n: number; medNavn: number; medAnnet: number; funnNavn: number }> = {
    flagget: { n: 0, medNavn: 0, medAnnet: 0, funnNavn: 0 },
    tilfeldig: { n: 0, medNavn: 0, medAnnet: 0, funnNavn: 0 },
  };
  let kostnad = 0;
  const feil: number[] = [];

  await kjorParallelt(jobber, Number(args.samtidig), async ({ id, gruppe }) => {
    try {
      const [v] = await db.select().from(vedtak).where(eq(vedtak.id, id));
      const tekst = [v.fulltekstRenset, v.sammendrag, v.feilBeskrivelse, v.bevisVektlagt, v.forbeholdTekst, ...(v.utvalgetsNokkelmomenter ?? [])].filter(Boolean).join("\n\n");
      const svar = await kallVerktoy<Funn>({
        system: KONTROLL_SYSTEM,
        verktoy: { name: "rapporter_personopplysninger", description: "Rapporter gjenværende personopplysninger.", input_schema: KONTROLL_SKJEMA },
        bruker: `<tekst>\n${tekst}\n</tekst>`,
        effort: "low",
        maksTokens: 4000,
      });
      kostnad += svar.forbruk.kostnadUsd;
      const funn = svar.input.funn.filter((f) => f.tekst.trim().length >= 2 && !/^\[[A-ZÆØÅ-]+\]$/.test(f.tekst.trim()));
      const navn = funn.filter((f) => f.type === "personnavn");
      const t = telling[gruppe];
      t.n++;
      if (navn.length) {
        t.medNavn++;
        t.funnNavn += navn.length;
      } else if (funn.length) t.medAnnet++;
      if (funn.length) {
        const ider: Identifikatorer = { ...TOM_ID, andre: funn.map((f) => f.tekst) };
        const r = (s: string | null) => rensValgfri(s, ider);
        await db
          .update(vedtak)
          .set({
            fulltekstRenset: rens(v.fulltekstRenset ?? "", ider),
            sammendrag: r(v.sammendrag),
            feilBeskrivelse: r(v.feilBeskrivelse),
            bevisVektlagt: r(v.bevisVektlagt),
            forbeholdTekst: r(v.forbeholdTekst),
            utvalgetsNokkelmomenter: v.utvalgetsNokkelmomenter?.map((m) => rens(m, ider)) ?? null,
            ...(navn.length
              ? { trengerKontroll: true, kontrollArsaker: [...(v.kontrollArsaker ?? []), "personvernkontroll 2: gjenværende personnavn funnet og fjernet"] }
              : { kontrollArsaker: [...(v.kontrollArsaker ?? []), `${MERKNAD}personvernkontroll 2: ${funn.length} andre opplysning(er) fjernet (${[...new Set(funn.map((f) => f.type))].join(", ")})`] }),
          })
          .where(eq(vedtak.id, id));
      }
    } catch (e) {
      if (erKontofeil(e)) throw e;
      feil.push(id);
    }
  });

  const pst = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : "–");
  console.table(
    (Object.keys(telling) as Gruppe[]).map((g) => ({ gruppe: g, kontrollert: telling[g].n, "med personnavn": telling[g].medNavn, andel: pst(telling[g].medNavn, telling[g].n), "kun andre opplysninger": telling[g].medAnnet })),
  );
  console.log(`Kostnad $${kostnad.toFixed(2)}; feilet: ${feil.length}.`);
  writeFileSync("docs/personvernkontroll.json", JSON.stringify({ tidspunkt: new Date().toISOString(), telling, feil: feil.length, kostnadUsd: Number(kostnad.toFixed(2)) }, null, 2));
}

main().catch((e) => {
  if (erKontofeil(e)) {
    console.error(`STOPP: ${(e as Error).message.slice(0, 160)}`);
    process.exit(3);
  }
  console.error(e);
  process.exit(1);
});
