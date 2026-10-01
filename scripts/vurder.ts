// Runs the assessment engine on the simulated complaints and compares with the expected level.
//
//   npm run vurder                 all ten, with the Claude reading of the free text
//   npm run vurder -- --uten-ai    button choices only (no API cost)
//   npm run vurder -- 3 7          only complaints 3 and 7

import { readFileSync } from "node:fs";
import { tolkFritekst } from "../src/lib/vurdering/tolkFritekst";
import { hentStatistikk } from "../src/lib/vurdering/statistikk";
import type { TestKlage } from "../src/lib/vurdering/typer";
import { vurder } from "../src/lib/vurdering/vurder";

const args = process.argv.slice(2);
const utenAi = args.includes("--uten-ai");
const ider = args.filter((a) => /^\d+$/.test(a)).map(Number);

async function main() {
  const alle = JSON.parse(readFileSync("src/lib/vurdering/testdata/klager.json", "utf8")) as TestKlage[];
  const valgte = ider.length ? alle.filter((k) => ider.includes(k.id)) : alle;
  let treff = 0;

  for (const k of valgte) {
    const v = await vurder(k.input, { tolk: utenAi ? async () => null : tolkFritekst, hentStatistikk });
    const forventet = Array.isArray(k.forventetNiva) ? k.forventetNiva : [k.forventetNiva];
    const ok = forventet.includes(v.niva);
    if (ok) treff++;
    const s = v.statistikk;
    console.log(`\n#${k.id} ${k.tittel}`);
    console.log(`  ${ok ? "OK " : "AVVIK"} vurdert: ${v.niva}  forventet: ${forventet.join(" / ")}`);
    if (s) console.log(`  statistikk: n=${s.n}, medhold ${Math.round(s.andel * 100)} % (${Math.round(s.lav * 100)}–${Math.round(s.hoy * 100)}), trinn ${s.trinn}: ${s.beskrivelse}`);
    console.log(`  feiltyper: ${v.faktorer.feiltyper.join(", ") || "–"}  grunnlag: ${v.faktorer.mangelsgrunnlag.join(", ") || "–"}`);
    console.log(`  ${v.begrunnelse}`);
  }
  console.log(`\n${treff}/${valgte.length} i samsvar med forventet nivå${utenAi ? " (uten AI)" : ""}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
