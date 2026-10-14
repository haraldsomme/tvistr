// The free assessment (step 4) for the twelve simulated cases, on the letters' date, from the database:
// writes src/lib/vurdering/__fixtures__/gylne.json (read by gylne.test.ts against forventet.json) and
// the screens as text to the jurist's review (docs/jurist-gjennomgang.md, «Vurderingen før betaling»).
//
//   npm run vurdering:gylne
import { readFileSync, writeFileSync } from "node:fs";
import { hentAlle, hentBilnavn } from "../src/app/sak/vedtak-db";
import { lesStatistikk } from "../src/lib/vurdering/statistikk-db";
import { vurderingSomTekst } from "../src/lib/vurdering/tekst";
import { byggVurdering } from "../src/lib/vurdering/vurdering";
import { BREVDATO, SAKER } from "./simulerte-saker";

const DOK = "docs/jurist-gjennomgang.md";
const OVERSKRIFT = "# Vurderingen før betaling (de tolv simulerte sakene)";

async function main() {
  const [alle, bilnavn, statistikk] = await Promise.all([hentAlle(), hentBilnavn(), lesStatistikk()]);
  const ut: Record<string, unknown> = {};
  const seksjoner: string[] = [];
  for (const x of SAKER) {
    const sak = { kjopsdato: x.kjopsdato, idag: BREVDATO, km: x.km, ar: x.ar, somDenEr: x.somDenEr, feil: x.feil.map((f) => ({ hoved: f.hoved, under: f.under, oppdaget: f.oppdaget })) };
    const v = byggVurdering({ sak, alle, statistikk, bilnavn });
    ut[x.navn] = v;
    seksjoner.push(
      [
        `## ${x.navn}`,
        `**Kjøperens svar:** kjøpt ${x.kjopsdato}, ${x.km} km, første gang registrert ${x.ar}, «som den er»: ${x.somDenEr}; ${x.feil.map((f) => `${f.hoved}${f.under.length ? `.${f.under.join("+")}` : ""} oppdaget ${f.oppdaget}`).join("; ")}`,
        vurderingSomTekst(v, x.kjopsdato)
          .split("\n")
          .map((l) => `> ${l}`.trimEnd())
          .join("\n"),
      ].join("\n\n"),
    );
  }
  writeFileSync("src/lib/vurdering/__fixtures__/gylne.json", `${JSON.stringify(ut, null, 2)}\n`);

  const innledning = `${OVERSKRIFT}

Skjermen kjøperen ser i steg 4, før betaling, for hver av de tolv simulerte sakene (\`scripts/simulerte-saker.ts\`) per ${BREVDATO}. Alt er regnet av kode fra svarene og databasen (se \`docs/vurdering.md\`); ingen modell har skrevet noe. Tallene er fra \`statistikk_kategori\`, kortene er de tre øverste vedtakene på nivå A fra rangeringen. Statusen er satt av reglene, ikke av en vurdering av saken.

**Les hver skjerm mot kjøperens svar og loven, og noter under «Merknad»:**
- Stemmer statusen og grunnene med svarene?
- Er lovlinjene riktige for lovversjonen, og er paragrafene riktige?
- Lover noe på skjermen mer enn loven og vedtakene gir grunnlag for?

`;
  const dok = readFileSync(DOK, "utf8");
  const for_ = dok.includes(OVERSKRIFT) ? dok.slice(0, dok.indexOf(OVERSKRIFT)).trimEnd() : dok.trimEnd();
  writeFileSync(DOK, `${for_}\n\n---\n\n${innledning}${seksjoner.join("\n\n**Merknad:**\n\n---\n\n")}\n\n**Merknad:**\n`);
  console.log(Object.entries(ut).map(([n, v]) => `${n}: ${(v as { status: string }).status}`).join("\n"));
  process.exit(0);
}
main();
