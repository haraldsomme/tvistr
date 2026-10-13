// Criterion 3 in docs/ferdigkriterier.md: writes, for each paragraph from `npm run simuler`, the
// fields it printed, for the judges (scripts/workflows/stikkprove.js with mappe data/ferdig/simulert).
// A paragraph replaced by the law sentence has nothing to check and counts as correct.
//
//   npm run ferdig:simulert -- data/ferdig/simulert.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { visSaksnummer } from "../src/lib/vedtaksvalg/mal";

const MAPPE = "data/ferdig/simulert";

type Resultat = {
  navn: string;
  niva: "A" | "B" | null;
  avsnitt: string;
  felter: {
    vedtak_id: number;
    fulltekst: string;
    utvalg: string;
    saksnummer: string | null;
    vedtaksdato: string | null;
    km: number | null;
    som_den_er: boolean | null;
    feil: { komponent: string | null } | null;
    sanksjoner: string[] | null;
    sitater: string[];
  } | null;
};

async function main() {
  const resultater = JSON.parse(readFileSync(process.argv[2], "utf8")) as Resultat[];
  const ider = resultater.flatMap((r) => (r.felter ? [r.felter.vedtak_id] : []));
  const biler = new Map((await db.select({ id: vedtak.id, a: vedtak.avgjorende, merke: vedtak.merke, modell: vedtak.modell, ar: vedtak.arsmodell }).from(vedtak).where(inArray(vedtak.id, ider))).map((v) => [v.id, v.a?.bil ?? [v.merke, v.modell, v.ar ? `årsmodell ${v.ar}` : null].filter(Boolean).join(" ")]));
  mkdirSync(MAPPE, { recursive: true });
  const filer: number[] = [];
  resultater.forEach((r, i) => {
    if (!r.felter || !r.niva) return;
    const f = r.felter;
    const har = (s: string) => r.avsnitt.includes(s);
    const sjekk = [
      { nokkel: "utvalg", felt: "utvalg", verdi: f.utvalg },
      { nokkel: "saksnummer", felt: "saksnummer", verdi: visSaksnummer(f.saksnummer) },
      ...(r.avsnitt.match(/^Det vises til .+? av (\d{1,2}\.\d{1,2}\.\d{4})/) ? [{ nokkel: "dato", felt: "dato", verdi: r.avsnitt.match(/^Det vises til .+? av (\d{1,2}\.\d{1,2}\.\d{4})/)![1] }] : []),
      ...(r.niva === "A" ? [{ nokkel: "bil", felt: "bil", verdi: biler.get(f.vedtak_id) }] : []),
      ...(r.niva === "A" && f.km !== null && har("km ved kjøpet") ? [{ nokkel: "km", felt: "km", verdi: f.km }] : []),
      ...(har("solgt «som den er»") ? [{ nokkel: "som_den_er", felt: "forbehold", verdi: "solgt «som den er»" }] : []),
      { nokkel: "komponent", felt: "komponent", verdi: r.avsnitt.match(/(?:Saken gjaldt|som gjaldt) (.+?)(?: på en |\. Utvalget)/)?.[1] ?? f.feil?.komponent },
      ...(r.niva === "A" ? [{ nokkel: "vurdert_for_seg", felt: "vurdert_for_seg", verdi: true }] : []),
      ...(har("Kjøperen fikk medhold i krav om") ? [{ nokkel: "sanksjon", felt: "sanksjon", verdi: r.avsnitt.match(/Kjøperen fikk medhold i krav om (.+?)\./)?.[1] }] : []),
      ...f.sitater.map((t, j) => ({ nokkel: `sitat${j + 1}`, felt: "sitat", verdi: t })),
      ...(har("Bilen i foreliggende sak") ? [{ nokkel: "sammenligning", felt: "sammenligning", verdi: r.avsnitt.match(/Bilen i foreliggende sak .+$/)?.[0] }] : []),
    ];
    writeFileSync(join(MAPPE, `${i + 1}.json`), JSON.stringify({ navn: r.navn, niva: r.niva, avsnitt: r.avsnitt, fulltekst: f.fulltekst, sjekk }, null, 1));
    filer.push(i + 1);
  });
  writeFileSync(join(MAPPE, "liste.json"), JSON.stringify(filer));
  console.log(`${filer.length} avsnitt å kontrollere, ${resultater.length - filer.length} med lovsetningen. Liste: ${JSON.stringify(filer)}`);
  process.exit(0);
}
main();
