// Re-evaluates the quote-related control flags on already interpreted decisions, using only
// data already in the database (no API calls):
//  - quotes are re-checked with the current, more tolerant matcher;
//  - an amount without a valid quote gets a verbatim excerpt from the text if the amount occurs
//    there (proof that the number is in the decision);
//  - "awarded > claimed" within rounding/interest (1 % or 100 kr) becomes a note;
//  - trenger_kontroll is recomputed from the remaining reasons.
//
//   npm run revurder -- [--skriv]     (without --skriv: dry run, only prints counts)

import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { beloepUtdrag, maaKontrolleres, MERKNAD, sitatFinnes, tekstUtdrag } from "../src/lib/validering";

const { values: args } = parseArgs({ options: { skriv: { type: "boolean", default: false } } });

type Rad = typeof vedtak.$inferSelect;

const BELOEP: [string, (r: Rad) => number | null][] = [
  ["kjopesum_nok", (r) => r.kjopesumNok],
  ["utbedringskostnad_nok", (r) => r.utbedringskostnadNok],
  ["krevd_prisavslag_nok", (r) => r.krevdPrisavslagNok],
  ["krevd_erstatning_nok", (r) => r.krevdErstatningNok],
  ["krevd_totalt_nok", (r) => r.krevdTotaltNok],
  ["tilkjent_prisavslag_nok", (r) => r.tilkjentPrisavslagNok],
  ["tilkjent_erstatning_nok", (r) => r.tilkjentErstatningNok],
  ["tilkjent_totalt_nok", (r) => r.tilkjentTotaltNok],
];

const erSitatArsak = (a: string) => /mangler sitat$/.test(a) || /^sitat for .* finnes ikke ordrett/.test(a);
const erOverKrevd = /^tilkjent (\S+) \((\d+)\) > krevd \((\d+)\)$/;

const finnes = (tekst: string, v: number | null) => v != null && beloepUtdrag(tekst, v) !== null;

// A total that is not written in the text is accepted when it equals the sum of its own parts
// that are in the text, equals one of them, or (rescission) equals the purchase price.
function erAvledet(r: Rad, felt: string, v: number, tekst: string): boolean {
  if (felt !== "krevd_totalt_nok" && felt !== "tilkjent_totalt_nok") return false;
  const krevd = felt === "krevd_totalt_nok";
  const deler = krevd ? [r.krevdPrisavslagNok, r.krevdErstatningNok] : [r.tilkjentPrisavslagNok, r.tilkjentErstatningNok];
  const kjente = deler.filter((d): d is number => d != null);
  if (kjente.some((d) => d === v) && kjente.every((d) => finnes(tekst, d))) return true;
  if (kjente.length > 1 && kjente.reduce((a, b) => a + b, 0) === v && kjente.every((d) => finnes(tekst, d))) return true;
  if (r.kjopesumNok != null && v === r.kjopesumNok && finnes(tekst, r.kjopesumNok)) return true;
  // Sum of two amounts that both occur in the text (e.g. price + damages on rescission), ±2 kr for rounding.
  const belop = [...new Set(alleBelop(tekst))];
  for (let i = 0; i < belop.length; i++) for (let j = i + 1; j < belop.length; j++) if (Math.abs(belop[i] + belop[j] - v) <= 2) return true;
  return false;
}

function alleBelop(tekst: string): number[] {
  return [...tekst.matchAll(/(?<![\d,.])(\d{1,3}(?:[ .\u00A0]\d{3})+|\d{4,7})(?:,\d{1,2})?(?!\d)/g)]
    .map((m) => Number(m[1].replace(/\D/g, "")))
    .filter((b) => b >= 100);
}

function revurder(r: Rad) {
  const tekst = r.fulltekstRenset ?? "";
  const sitater: Record<string, string> = { ...(r.sitater ?? {}) };
  const arsaker = (r.kontrollArsaker ?? []).filter((a) => !erSitatArsak(a));
  const nye: string[] = [];
  let autoSitat = 0;

  for (const [felt, verdi] of BELOEP) {
    const v = verdi(r);
    if (v == null) continue;
    if (sitater[felt] && sitatFinnes(sitater[felt], tekst)) continue;
    const utdrag = beloepUtdrag(tekst, v);
    if (utdrag) {
      sitater[felt] = utdrag;
      autoSitat++;
    } else if (erAvledet(r, felt, v, tekst)) {
      // Totals are often a sum of parts or equal to the price (rescission); not quoted as such.
      delete sitater[felt];
    } else {
      delete sitater[felt];
      nye.push(`${felt}: beløpet ${v} står ikke i vedtaksteksten`);
    }
  }
  // Text fields keep the model's quote only if it is verbatim; otherwise look for the wording in the text.
  const FORBEHOLD_ORD = /\bsom den er\b|\buten garanti\b|\boutlet\b|\bkjente feil\b|\bdefekt\b|\bdelebil\b|\bsolgt som\b/i;
  const SELGER_ORD: Record<string, RegExp> = {
    forhandler: /\bforhandler|\bnæringsdrivende\b|\bbilsalg\b|\bbilhandler|\bbrukthandler/i,
    privat: /\bprivat(?:person|salg|kjøp|e)?\b|\bmellom private\b/i,
    formidling: /\bformidl|\bkommisjon|\bkomisjon/i,
  };
  if (sitater.forbehold && !sitatFinnes(sitater.forbehold, tekst)) delete sitater.forbehold;
  if (r.forbehold?.length && !sitater.forbehold) {
    const u = tekstUtdrag(tekst, FORBEHOLD_ORD);
    if (u) {
      sitater.forbehold = u;
      autoSitat++;
    }
  }
  if (sitater.selger_type && !sitatFinnes(sitater.selger_type, tekst)) delete sitater.selger_type;
  if (r.selgerType && r.selgerType !== "ukjent" && !sitater.selger_type) {
    const u = SELGER_ORD[r.selgerType] ? tekstUtdrag(tekst, SELGER_ORD[r.selgerType]) : null;
    if (u) {
      sitater.selger_type = u;
      autoSitat++;
    }
  }
  for (const felt of ["utfall", "selger_type", "forbehold", "lovversjon"]) {
    const q = sitater[felt];
    if (q && !sitatFinnes(q, tekst)) {
      delete sitater[felt];
      nye.push(`sitat for ${felt} finnes ikke ordrett i vedtaket`);
    }
  }
  if (r.utfall && !sitater.utfall) nye.push("utfall mangler sitat");
  if (r.selgerType && r.selgerType !== "ukjent" && !sitater.selger_type) {
    // The dealer's company name in the text is itself evidence that the seller is a business.
    if (r.selgerType === "forhandler" && r.selgerNavn && sitatFinnes(r.selgerNavn, tekst)) sitater.selger_type = r.selgerNavn;
    else nye.push("selger_type mangler sitat");
  }
  if (r.forbehold?.length && !sitater.forbehold) nye.push("forbehold mangler sitat");

  // Awarded slightly above claimed is rounding or interest, not an extraction error.
  const justert = [...arsaker, ...nye].map((a) => {
    const m = erOverKrevd.exec(a);
    if (!m) return a;
    const [, hva, tilkjent, krevd] = m;
    const diff = Number(tilkjent) - Number(krevd);
    return diff <= Math.max(100, Number(krevd) * 0.01) ? `${MERKNAD}tilkjent ${hva} (${tilkjent}) litt over krevd (${krevd}), trolig renter/avrunding` : a;
  });
  if (autoSitat) justert.push(`${MERKNAD}${autoSitat} beløpssitat hentet automatisk fra vedtaksteksten`);
  const unike = [...new Set(justert)];
  return { sitater, arsaker: unike, flagget: maaKontrolleres(unike) };
}

async function main() {
  const rader = await db.select().from(vedtak);
  let foerFlagget = 0;
  let etterFlagget = 0;
  let endret = 0;
  const grunner: Record<string, number> = {};
  for (const r of rader) {
    const n = revurder(r);
    if (r.trengerKontroll) foerFlagget++;
    if (n.flagget) {
      etterFlagget++;
      for (const a of n.arsaker.filter((x) => !x.startsWith(MERKNAD))) {
        const nokkel = a.replace(/\(\d+\)|\d+/g, "N").replace(/^beløpet N står/, "beløp står");
        grunner[nokkel] = (grunner[nokkel] ?? 0) + 1;
      }
    }
    if (n.flagget !== r.trengerKontroll || JSON.stringify(n.arsaker) !== JSON.stringify(r.kontrollArsaker ?? [])) endret++;
    if (args.skriv) {
      await db
        .update(vedtak)
        .set({ sitater: n.sitater, kontrollArsaker: n.arsaker.length ? n.arsaker : null, trengerKontroll: n.flagget })
        .where(eq(vedtak.id, r.id));
    }
  }
  console.log(`${rader.length} vedtak: flagget før ${foerFlagget}, etter ${etterFlagget}; ${endret} endret${args.skriv ? " og lagret" : " (dry run, ingenting lagret)"}.`);
  console.table(Object.entries(grunner).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([grunn, n]) => ({ grunn, n })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
