// Automatic audit: a model re-reads the (redacted) decision text and judges the stored key fields
// of a random sample. This is NOT human QA (qa_status is untouched); it is a cheaper second
// opinion from the same model family, so its verdicts share blind spots with the extraction.
//
//   npm run revisjon -- [--utvalg 100] [--samtidig 8]

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { erKontofeil, kallVerktoy } from "../src/lib/ai/klient";
import { kjorParallelt } from "../src/lib/parallell";
import { rens, TOM_ID } from "../src/lib/personvern/rens";

const { values: args } = parseArgs({ options: { utvalg: { type: "string", default: "100" }, samtidig: { type: "string", default: "8" } } });

const FELT = ["utfall", "selger_type", "kjopesum", "krevd_totalt", "tilkjent_totalt", "kjoretoy_merke_modell_ar", "feiltyper", "hovedkrav", "forbehold", "lov_og_paragrafer"] as const;

const SYSTEM = `Du reviderer et automatisk uttrekk fra et vedtak fra Forbrukerklageutvalget/Forbrukertvistutvalget om kjøp av et brukt kjøretøy. Du får vedtaksteksten og de uttrukne verdiene.

Vurder hvert felt mot vedtaksteksten, og bare mot den:
- riktig: verdien stemmer med vedtaket.
- feil: verdien motsier vedtaket, eller et beløp/en dato/en kategori er åpenbart feil.
- usikker: vedtaket er uklart eller du kan ikke avgjøre det.
Når en liste (feiltyper, forbehold, paragrafer) stemmer i hovedsak, men mangler et ubetydelig punkt, er den «riktig». Mangler den noe vesentlig, eller inneholder den noe vedtaket ikke støtter, er den «feil».
«utfall» gjelder klagerens resultat. «krevd_totalt» er det høyeste alternativet klageren krevde; «tilkjent_totalt» det selger må betale. Null er riktig hvis vedtaket ikke oppgir beløpet.
Begrunn kort (maks 20 ord), uten personnavn. Svar ved å kalle verktøyet rapporter_revisjon.`;

const SKJEMA = {
  type: "object",
  properties: {
    vurderinger: {
      type: "array",
      items: {
        type: "object",
        properties: {
          felt: { type: "string", enum: [...FELT] },
          vurdering: { type: "string", enum: ["riktig", "feil", "usikker"] },
          begrunnelse: { type: "string" },
        },
        required: ["felt", "vurdering", "begrunnelse"],
        additionalProperties: false,
      },
    },
  },
  required: ["vurderinger"],
  additionalProperties: false,
};

type Svar = { vurderinger: { felt: (typeof FELT)[number]; vurdering: "riktig" | "feil" | "usikker"; begrunnelse: string }[] };

async function main() {
  const ider = (
    await db
      .select({ id: vedtak.id })
      .from(vedtak)
      .orderBy(sql`md5(${vedtak.id}::text || 'revisjon-2026')`)
      .limit(Number(args.utvalg))
  ).map((r) => r.id);

  const tell: Record<string, { riktig: number; feil: number; usikker: number }> = Object.fromEntries(FELT.map((f) => [f, { riktig: 0, feil: 0, usikker: 0 }]));
  const avvik: { id: number; saksnummer: string | null; felt: string; begrunnelse: string }[] = [];
  let kostnad = 0;
  let ferdig = 0;
  let manglet = 0;

  await kjorParallelt(ider, Number(args.samtidig), async (id) => {
    const [v] = await db.select().from(vedtak).where(eq(vedtak.id, id));
    const uttrekk = {
      utfall: v.utfall,
      selger_type: v.selgerType,
      kjopesum: v.kjopesumNok,
      krevd_totalt: v.krevdTotaltNok,
      tilkjent_totalt: v.tilkjentTotaltNok,
      kjoretoy_merke_modell_ar: { type: v.kjoretoytype, merke: v.merke, modell: v.modell, arsmodell: v.arsmodell },
      feiltyper: v.feiltyper,
      hovedkrav: { prinsipalt: v.prinsipaltKrav, alle: v.kravtyper },
      forbehold: v.forbehold,
      lov_og_paragrafer: { lov: v.lov, paragrafer: v.paragrafer },
    };
    try {
      const svar = await kallVerktoy<Svar>({
        system: SYSTEM,
        verktoy: { name: "rapporter_revisjon", description: "Rapporter vurderingen av hvert felt.", input_schema: SKJEMA },
        bruker: `<vedtak>\n${v.fulltekstRenset}\n</vedtak>\n\n<uttrekk>\n${JSON.stringify(uttrekk, null, 1)}\n</uttrekk>`,
        effort: "medium",
        maksTokens: 6000,
      });
      kostnad += svar.forbruk.kostnadUsd;
      const sett = new Set<string>();
      for (const x of svar.input.vurderinger) {
        if (!tell[x.felt] || sett.has(x.felt)) continue;
        sett.add(x.felt);
        tell[x.felt][x.vurdering]++;
        if (x.vurdering === "feil") avvik.push({ id, saksnummer: v.saksnummer, felt: x.felt, begrunnelse: rens(x.begrunnelse, TOM_ID) });
      }
      manglet += FELT.filter((f) => !sett.has(f)).length;
    } catch (e) {
      if (erKontofeil(e)) throw e;
      manglet += FELT.length;
    }
    ferdig++;
    if (ferdig % 25 === 0) console.log(`  ${ferdig}/${ider.length} $${kostnad.toFixed(2)}`);
  });

  console.table(
    Object.entries(tell).map(([felt, t]) => {
      const vurdert = t.riktig + t.feil + t.usikker;
      return { felt, riktig: t.riktig, feil: t.feil, usikker: t.usikker, "riktig av vurderte": vurdert ? `${Math.round((t.riktig / vurdert) * 100)} %` : "–" };
    }),
  );
  console.log(`Kostnad $${kostnad.toFixed(2)}; felt uten vurdering: ${manglet}.`);
  writeFileSync("docs/revisjon.json", JSON.stringify({ tidspunkt: new Date().toISOString(), utvalg: ider.length, tell, avvik, kostnadUsd: Number(kostnad.toFixed(2)) }, null, 2));
}

main().catch((e) => {
  if (erKontofeil(e)) {
    console.error(`STOPP: ${(e as Error).message.slice(0, 160)}`);
    process.exit(3);
  }
  console.error(e);
  process.exit(1);
});
