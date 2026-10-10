// Checks the generator agents' cases against their drafts: no placeholder left, no deciding answer
// changed (only the «<<SKRIV …>>» fields may be filled), and the form valid, or broken on exactly the
// rule the plan asked for (criterion A2).
//
//   npx tsx scripts/testkjoring/valider.ts T001 T002 …     (no ids: every case written so far)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validerSkjema } from "../../src/lib/skjema/skjema";

const MAPPE = "data/testkjoring";
const IDAG = "2026-10-10";

// The rule each deliberately invalid case breaks, as the field validerSkjema names.
export const UGYLDIG_FELT: Record<string, RegExp> = {
  dato_oppdaget_for_kjop: /^del3_feil\[0\]\.dato_oppdaget$/,
  km_na_under_kjop: /^km_na$/,
  skriftlig_uten_avskrift: /^del3_feil\[0\]\.avskrift_selger$/,
};

function endret(utkast: unknown, sak: unknown, sti: string, ut: string[]) {
  if (typeof utkast === "string" && utkast.startsWith("<<SKRIV")) {
    if (typeof sak === "string" && sak.includes("<<")) ut.push(`${sti}: plassholderen er ikke fylt ut`);
    return;
  }
  if (utkast && typeof utkast === "object") {
    if (!sak || typeof sak !== "object") return void ut.push(`${sti}: mangler`);
    const nokler = new Set([...Object.keys(utkast), ...Object.keys(sak)]);
    for (const k of nokler) endret((utkast as Record<string, unknown>)[k], (sak as Record<string, unknown>)[k], `${sti}.${k}`, ut);
    return;
  }
  if (JSON.stringify(utkast) !== JSON.stringify(sak)) ut.push(`${sti}: endret fra ${JSON.stringify(utkast)} til ${JSON.stringify(sak)}`);
}

export function sjekkSak(id: string): string[] {
  const fil = join(MAPPE, "saker", `${id}.json`);
  if (!existsSync(fil)) return ["saken mangler"];
  const sak = JSON.parse(readFileSync(fil, "utf8"));
  const utkast = JSON.parse(readFileSync(join(MAPPE, "utkast", `${id}.json`), "utf8"));
  const plan = readdirSync(MAPPE)
    .filter((f) => f.startsWith("plan-"))
    .flatMap((f) => JSON.parse(readFileSync(join(MAPPE, f), "utf8")) as { id: string; ugyldig: string | null }[]);
  const spes = plan.find((p) => p.id === id);
  const ut: string[] = [];
  endret(utkast, sak, "skjema", ut);
  const feil = validerSkjema(sak, IDAG);
  if (spes?.ugyldig) {
    const regel = UGYLDIG_FELT[spes.ugyldig];
    if (!feil.some((f) => regel.test(f.felt))) ut.push(`skulle bryte ${spes.ugyldig}, men valideringen fant ${JSON.stringify(feil)}`);
  } else for (const f of feil) ut.push(`ugyldig: ${f.felt}: ${f.melding}`);
  return ut;
}

if (process.argv[1]?.endsWith("valider.ts")) {
  const ider = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(MAPPE, "saker")).map((f) => f.replace(/\.json$/, ""));
  let feil = 0;
  for (const id of ider) {
    const ut = sjekkSak(id);
    feil += ut.length ? 1 : 0;
    console.log(ut.length ? `${id}: FEIL\n  ${ut.join("\n  ")}` : `${id}: ok`);
  }
  process.exit(feil ? 1 : 0);
}
