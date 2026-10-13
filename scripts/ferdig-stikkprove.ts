// Criterion 1 in docs/ferdigkriterier.md: draws 50 decisions at random from the base set, among
// those with an extraction and not used in any pilot or simulation, and writes for each the fields
// the paragraph template uses, for the judges (scripts/workflows/stikkprove.js).
//
//   npm run ferdig:stikkprove -- --trekk     draw and write data/ferdig/stikkprove/
//   npm run ferdig:stikkprove -- --tell <resultat.json>   count the judges' answers against the criterion

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import type { AvledetFeil } from "../src/lib/feilvurdering/skjema";
import { delOpp } from "../src/lib/avgjorende/verifiser";
import { finnesIFulltekst, fulltekstVarianter } from "../src/lib/feilvurdering/verifiser";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";
import { komponentnavn, UTVALG_I_TEKSTEN } from "../src/lib/vedtaksvalg/valg";

const { values: args } = parseArgs({ options: { trekk: { type: "boolean", default: false }, tell: { type: "string" } } });

const MAPPE = "data/ferdig/stikkprove";
const ANTALL = 50;
const KRAV_RIKTIGE = 0.98;

// Ids used in pilots (data/avgjorende/lister) or picked by a simulation (sim*.json given in BRUKT_SIM).
function brukt(): Set<number> {
  const ider = new Set<number>();
  const lister = "data/avgjorende/lister";
  for (const f of readdirSync(lister).filter((x) => /^(pilot|blind)/.test(x))) for (const i of JSON.parse(readFileSync(join(lister, f), "utf8"))) ider.add(i);
  for (const f of (process.env.BRUKT_SIM ?? "").split(",").filter(Boolean))
    for (const r of JSON.parse(readFileSync(f, "utf8"))) if (r.felter?.vedtak_id) ider.add(r.felter.vedtak_id);
  return ider;
}

async function trekk() {
  const unntatt = brukt();
  const rader = await db
    .select({ id: vedtak.id })
    .from(vedtak)
    .where(and(GRUNNFILTER, isNotNull(vedtak.avgjorende)))
    .orderBy(sql`md5(${vedtak.id}::text || 'ferdig-stikkprove')`);
  const valgte = rader.map((r) => r.id).filter((i) => !unntatt.has(i)).slice(0, ANTALL);
  const data = await db
    .select({
      id: vedtak.id,
      saksnummer: vedtak.saksnummer,
      utvalg: UTVALG_I_TEKSTEN,
      merke: vedtak.merke,
      modell: vedtak.modell,
      arsmodell: vedtak.arsmodell,
      somDenEr: vedtak.somDenEr,
      feil: sql<AvledetFeil[]>`coalesce(${vedtak.feilvurdering}->'feil', '[]'::jsonb)`,
      avgjorende: vedtak.avgjorende,
    })
    .from(vedtak)
    .where(inArray(vedtak.id, valgte));
  mkdirSync(MAPPE, { recursive: true });
  for (const v of data) {
    // One line per field the template can print, with the value it would print.
    const sjekk: { nokkel: string; felt: string; verdi: unknown }[] = [
      { nokkel: "utvalg", felt: "utvalg", verdi: v.utvalg },
      { nokkel: "bil", felt: "bil", verdi: v.avgjorende?.bil ?? [v.merke, v.modell, v.arsmodell ? `årsmodell ${v.arsmodell}` : null].filter(Boolean).join(" ") },
      // The template writes «solgt «som den er»» only when this is true.
      { nokkel: "som_den_er", felt: "forbehold", verdi: v.somDenEr === true ? "solgt «som den er»" : "ikke oppgitt «som den er»" },
    ];
    for (const f of v.feil.filter((x) => x.utfall === "medhold")) {
      const a = v.avgjorende?.feil.find((x) => x.id === f.id);
      sjekk.push(
        { nokkel: `${f.id}.komponent`, felt: "komponent", verdi: komponentnavn(f) },
        { nokkel: `${f.id}.vurdert_for_seg`, felt: "vurdert_for_seg", verdi: !f.samlet && a?.vurdert_for_seg !== false && a?.nevnt_i_vurderingen !== false && !a?.samlet_med.length },
        { nokkel: `${f.id}.sanksjon`, felt: "sanksjon", verdi: a?.sanksjoner ?? [] },
        ...(a?.sitater ?? []).map((t, i) => ({ nokkel: `${f.id}.sitat${i + 1}`, felt: "sitat", verdi: t })),
      );
    }
    for (const r of v.avgjorende?.rettslige_sitater ?? []) sjekk.push({ nokkel: `rettslig.${r.poeng}`, felt: "sitat", verdi: r.sitat });
    writeFileSync(join(MAPPE, `${v.id}.json`), JSON.stringify({ vedtak_id: v.id, fulltekst: `data/avgjorende/inn/${v.id}.txt`, sjekk }, null, 1));
  }
  writeFileSync(join(MAPPE, "liste.json"), JSON.stringify(valgte));
  console.log(`${valgte.length} vedtak trukket (${unntatt.size} brukt før og utelatt), skrevet til ${MAPPE}.`);
}

type Felt = { nokkel: string; felt: string; stemmer: boolean };

// The workflow's answer: per decision, each field with the verdict after the judges (and, when they
// disagreed, the third agent).
function tell(fil: string) {
  const r = JSON.parse(readFileSync(fil, "utf8")) as { vedtak_id: number; felt: Felt[] }[];
  const felt = r.flatMap((x) => x.felt);
  const feil = felt.filter((f) => !f.stemmer);
  const andel = 1 - feil.length / felt.length;
  // Whether a quote stands in the committee's assessment is checked against the text itself; the
  // judges' «stemmer ikke» on a quote also covers quotes that are in it but recount a party.
  const sitatFeil = feil.filter((f) => f.felt === "sitat").length;
  let utenfor = 0;
  for (const v of r) {
    const fil = JSON.parse(readFileSync(join(MAPPE, `${v.vedtak_id}.json`), "utf8")) as { fulltekst: string; sjekk: { felt: string; verdi: unknown }[] };
    const { vurdering } = delOpp(readFileSync(fil.fulltekst, "utf8").replace(/^[\s\S]*?<utvalgets_vurdering>\n?/, "Utvalget ser slik på saken: "));
    const varianter = fulltekstVarianter(vurdering ?? "");
    utenfor += fil.sjekk.filter((x) => x.felt === "sitat" && !finnesIFulltekst(String(x.verdi), varianter)).length;
  }
  console.log(`${r.length} vedtak, ${felt.length} felt, ${feil.length} feil: ${(andel * 100).toFixed(1)} % riktige (krav ${KRAV_RIKTIGE * 100} %).`);
  console.log(`Sitater som ikke står ordrett i utvalgets vurdering: ${utenfor} (krav 0). Sitater dommerne ellers underkjente: ${sitatFeil}.`);
  const perFelt = new Map<string, { n: number; feil: number }>();
  for (const f of felt) {
    const x = perFelt.get(f.felt) ?? { n: 0, feil: 0 };
    x.n++;
    if (!f.stemmer) x.feil++;
    perFelt.set(f.felt, x);
  }
  for (const [k, x] of perFelt) console.log(`  ${k}: ${x.feil} av ${x.n} feil`);
  for (const v of r) for (const f of v.felt) if (!f.stemmer) console.log(`  feil: ${v.vedtak_id} ${f.nokkel}`);
  console.log(andel >= KRAV_RIKTIGE && utenfor === 0 ? "GRØNN" : "RØD");
}

async function main() {
  if (args.trekk) await trekk();
  else if (args.tell && existsSync(args.tell)) tell(args.tell);
  else throw new Error("Velg --trekk eller --tell <fil>.");
  process.exit(0);
}
main();
