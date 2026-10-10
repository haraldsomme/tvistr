// Sums up a test run against docs/testkriterier-sak.md: the machine checks (resultat/), the control
// agents' notes (kontroll/) and the second controller's agreement on the calibration cases (kontroll2/).
//
//   npx tsx scripts/testkjoring/rapport.ts > docs/testrapport-sak.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { wilson } from "../../src/lib/wilson";

const MAPPE = "data/testkjoring";

export type Grad = "ok" | "mindre" | "moderat" | "alvorlig" | "blokkerende" | "ikke_relevant";
export type Merknad = { kriterium: string; feil_id?: string | null; grad: Grad; merknad: string; kilde: string };
type Kontroll = { id: string; merknader: Merknad[] };

const RANG: Record<Grad, number> = { ikke_relevant: -1, ok: 0, mindre: 1, moderat: 2, alvorlig: 3, blokkerende: 4 };
const KRAV: Record<string, number> = {
  A1: 1, A2: 1, A3: 1, A4: 1, A5: 1, B1: 1, B2: 1, B3: 1, B4: 1, B5: 1, B6: 1,
  C1: 0.9, C2: 1, C3: 0.95, C4: 0.85, C5: 0.95, D1: 1, D2: 1, D3: 1, D4: 0.95, D5: 1, D6: 0.95, D7: 0.9, E1: 0.85, E2: 0.9,
};
const KRITERIER = Object.keys(KRAV);

const les = <T>(mappe: string): T[] =>
  existsSync(join(MAPPE, mappe)) ? readdirSync(join(MAPPE, mappe)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(MAPPE, mappe, f), "utf8")) as T) : [];

// A criterion is met in a case when its worst note is at most «mindre» (cosmetic).
function verdikt(k: Kontroll, kriterium: string): boolean | null {
  const m = k.merknader.filter((x) => x.kriterium === kriterium && x.grad !== "ikke_relevant");
  return m.length ? m.every((x) => RANG[x.grad] <= RANG.mindre) : null;
}

const pst = (x: number) => `${Math.round(x * 100)} %`;
const celle = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");

function main() {
  const resultater = les<{ id: string; maskinelt: Record<string, { ok: boolean; merknad?: string }> }>("resultat");
  const kontroller = les<Kontroll>("kontroll");
  const andre = les<Kontroll>("kontroll2");
  const ut: string[] = [];

  ut.push("# Testrapport for `/sak`", "");
  ut.push(`*Generert av \`scripts/testkjoring/rapport.ts\`. ${resultater.length} saker kjørt, ${kontroller.length} kontrollert, ${andre.length} kontrollert på nytt for kalibrering. Kriteriene står i \`docs/testkriterier-sak.md\`; en sak oppfyller et kriterium når den verste merknaden er høyst «mindre».*`, "");

  ut.push("## Andel oppfylt per kriterium", "", "| Kriterium | Krav | Oppfylt | 95 % intervall | Saker | Status | Enighet ved kalibrering |", "|---|---|---|---|---|---|---|");
  for (const k of KRITERIER) {
    const verdier = k < "C"
      ? resultater.map((r) => r.maskinelt[k]).filter(Boolean).map((v) => v.ok)
      : kontroller.map((x) => verdikt(x, k)).filter((v): v is boolean => v != null);
    const n = verdier.length;
    const oppfylt = verdier.filter(Boolean).length;
    const [lav, hoy] = wilson(oppfylt, n);
    const par = andre.map((b) => [verdikt(kontroller.find((a) => a.id === b.id) ?? { id: b.id, merknader: [] }, k), verdikt(b, k)]).filter(([a, b]) => a != null && b != null);
    const enighet = par.length ? `${pst(par.filter(([a, b]) => a === b).length / par.length)} (${par.length})` : "–";
    ut.push(`| ${k} | ${pst(KRAV[k])} | ${n ? pst(oppfylt / n) : "–"} | ${n ? `${pst(lav)}–${pst(hoy)}` : "–"} | ${n} | ${!n ? "–" : oppfylt / n >= KRAV[k] ? "oppfylt" : "**ikke oppfylt**"} | ${enighet} |`);
  }

  const alle = kontroller.flatMap((x) => x.merknader.map((m) => ({ ...m, id: x.id })));
  const tellinger = (["blokkerende", "alvorlig", "moderat", "mindre"] as Grad[]).map((g) => `${alle.filter((m) => m.grad === g).length} ${g}`);
  const vurdert = alle.filter((m) => m.grad !== "ikke_relevant").length;
  const alvorlige = alle.filter((m) => RANG[m.grad] >= RANG.alvorlig).length;
  ut.push("", "## Merknader", "", `${tellinger.join(", ")}. Alvorlige og blokkerende er ${vurdert ? pst(alvorlige / vurdert) : "–"} av ${vurdert} vurderte kriterier i C, D og E (krav: under 5 %).`, "");

  const maskinbrudd = resultater.flatMap((r) => Object.entries(r.maskinelt).filter(([, v]) => !v.ok).map(([k, v]) => `| ${r.id} | ${k} | ${celle(v.merknad ?? "")} |`));
  if (maskinbrudd.length) ut.push("### Maskinelle brudd", "", "| Sak | Kriterium | Merknad |", "|---|---|---|", ...maskinbrudd, "");

  for (const grad of ["blokkerende", "alvorlig", "moderat"] as Grad[]) {
    const liste = alle.filter((m) => m.grad === grad).sort((a, b) => a.kriterium.localeCompare(b.kriterium) || a.id.localeCompare(b.id));
    if (!liste.length) continue;
    ut.push(`### ${grad[0].toUpperCase()}${grad.slice(1)}`, "", "| Sak | Feil | Kriterium | Merknad | Kilde |", "|---|---|---|---|---|");
    for (const m of liste) ut.push(`| ${m.id} | ${m.feil_id ?? ""} | ${m.kriterium} | ${celle(m.merknad)} | ${celle(m.kilde)} |`);
    ut.push("");
  }

  const uenige = andre.flatMap((b) => {
    const a = kontroller.find((x) => x.id === b.id);
    return KRITERIER.filter((k) => a && verdikt(a, k) != null && verdikt(b, k) != null && verdikt(a, k) !== verdikt(b, k)).map((k) => `| ${b.id} | ${k} | ${verdikt(a!, k) ? "oppfylt" : "ikke oppfylt"} | ${verdikt(b, k) ? "oppfylt" : "ikke oppfylt"} |`);
  });
  if (uenige.length) ut.push("### Uenighet ved kalibrering", "", "| Sak | Kriterium | Kontrollør 1 | Kontrollør 2 |", "|---|---|---|---|", ...uenige, "");
  console.log(ut.join("\n"));
}

main();
