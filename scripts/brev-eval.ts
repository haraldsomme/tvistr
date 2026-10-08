// Writes the letter for each golden case with the whole chain (plan, author, check, review), lets a
// judge (scripts/brev-eval/dommer.ts) answer whether it reads as written by a lawyer, and reports what
// went wrong, compared with the last run. Costs money: about 0.2–0.3 USD per letter.
//
//   npm run brev-eval                       every case once
//   npm run brev-eval -- heving-utgifter    only that case
//   npm run brev-eval -- --ganger 3         every case three times

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { ArgumentId } from "../src/lib/brev/skriving/brevplan";
import { planlegg } from "../src/lib/brev/skriving/brevplan";
import { skrivBrevFor } from "../src/lib/brev/skriving/kjede";
import { brevTekst, fyllInn } from "../src/lib/brev/skriving/render";
import { lagSaksmodell, type Avklaring, type Kildetekster } from "../src/lib/brev/skriving/saksmodell";
import type { Utfylling } from "../src/lib/brev/utfylling";
import type { Innsending } from "../src/lib/vurdering/innsending";
import { MODELL_FORFATTER } from "../src/lib/ai/klient";
import { bedom, type Dom } from "./brev-eval/dommer";

type Gullsak = {
  id: string;
  tittel: string;
  feller: string[];
  idag: string;
  svar: Innsending;
  utfylling: Utfylling;
  kilder?: Kildetekster;
  avklaringer?: Avklaring[];
  // `tekst` and `ikkeTekst` are regular expressions tried on the letter's paragraphs.
  forventet: { argumenter?: ArgumentId[]; ikke?: ArgumentId[]; tekst?: string[]; ikkeTekst?: string[] };
};
type Resultat = { id: string; kjoring: number; planfeil: string[]; avvik: string[]; funn: string[]; tekstfeil: string[]; dom?: Dom; feil?: string; kostnadUsd: number; brev?: string };
type Sammendrag = Record<string, { kjoringer: number; feil: number; planfeil: number; avvik: number; funn: number; tekstfeil: number; jurist: number }>;

const SAKER = "scripts/brev-eval/saker";
const UT = "docs/brev-eval";

const args = process.argv.slice(2);
const gangerVed = args.indexOf("--ganger");
const ganger = gangerVed >= 0 ? Math.max(1, Number(args[gangerVed + 1]) || 1) : 1;
const ider = args.filter((a, i) => !a.startsWith("--") && (gangerVed < 0 || i !== gangerVed + 1));

async function main() {
  const alle = readdirSync(SAKER).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(`${SAKER}/${f}`, "utf8")) as Gullsak);
  const saker = ider.length ? alle.filter((s) => ider.includes(s.id)) : alle;
  const resultater: Resultat[] = [];

  for (const sak of saker) {
    const lest = lagSaksmodell(sak, sak.idag);
    if (!lest.ok) {
      resultater.push({ id: sak.id, kjoring: 0, planfeil: [`ugyldig sak: ${lest.feil}`], avvik: [], funn: [], tekstfeil: [], kostnadUsd: 0 });
      console.log(`${sak.id}: ugyldig sak (${lest.feil})`);
      continue;
    }
    const m = lest.modell;
    const ids = new Set(planlegg(m).argumenter.map((a) => a.id));
    const planfeil = [
      ...(sak.forventet.argumenter ?? []).filter((id) => !ids.has(id)).map((id) => `planen mangler ${id}`),
      ...(sak.forventet.ikke ?? []).filter((id) => ids.has(id)).map((id) => `planen har ${id}`),
    ];
    for (let k = 1; k <= ganger; k++) {
      process.stdout.write(`${sak.id} #${k}: `);
      try {
        const s = await skrivBrevFor(m, (f) => process.stdout.write(`${f} … `));
        const brev = brevTekst(fyllInn(s.utkast, s.plan, m, sak.idag));
        const tekstfeil = [
          ...(sak.forventet.tekst ?? []).filter((r) => !new RegExp(r).test(brev)).map((r) => `mangler /${r}/`),
          ...(sak.forventet.ikkeTekst ?? []).filter((r) => new RegExp(r).test(brev)).map((r) => `har /${r}/`),
        ];
        const { dom, forbruk } = await bedom(brev);
        const kostnadUsd = s.kostnadUsd + forbruk.kostnadUsd;
        resultater.push({ id: sak.id, kjoring: k, planfeil, avvik: s.avvik.map((a) => `${a.regel}: ${a.tekst}${a.setning ? ` («${a.setning}»)` : ""}`), funn: s.funn.map((f) => `${f.punkt}: ${f.hvorfor}`), tekstfeil, dom, kostnadUsd, brev });
        console.log(`${s.avvik.length} avvik, ${s.funn.length} funn, ${tekstfeil.length} tekstfeil, jurist ${dom.poeng}/5${dom.jurist ? "" : " (nei)"}, ${s.kall + 1} kall, ${kostnadUsd.toFixed(2)} USD`);
      } catch (e) {
        // One case failing (API error, refusal) does not stop the run.
        const feil = e instanceof Error ? e.message : String(e);
        resultater.push({ id: sak.id, kjoring: k, planfeil, avvik: [], funn: [], tekstfeil: [], feil, kostnadUsd: 0 });
        console.log(`FEIL: ${feil}`);
      }
    }
  }
  skrivRapport(saker, resultater);
  process.exit(0);
}

function skrivRapport(saker: Gullsak[], res: Resultat[]) {
  mkdirSync(UT, { recursive: true });
  const forrigeFil = readdirSync(UT).filter((f) => f.endsWith(".json")).sort().at(-1);
  const forrige: Sammendrag | null = forrigeFil ? JSON.parse(readFileSync(`${UT}/${forrigeFil}`, "utf8")) : null;
  const sum = (r: Resultat[], f: (x: Resultat) => number) => r.reduce((n, x) => n + f(x), 0);
  const sammendrag: Sammendrag = Object.fromEntries(
    saker.map((s) => {
      const r = res.filter((x) => x.id === s.id);
      return [s.id, { kjoringer: r.length, feil: r.filter((x) => x.feil).length, planfeil: r[0]?.planfeil.length ?? 0, avvik: sum(r, (x) => x.avvik.length), funn: sum(r, (x) => x.funn.length), tekstfeil: sum(r, (x) => x.tekstfeil.length), jurist: sum(r, (x) => x.dom?.poeng ?? 0) }];
    }),
  );
  const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  writeFileSync(`${UT}/${stempel}.json`, `${JSON.stringify(sammendrag, null, 2)}\n`);

  const endring = (id: string) => {
    const [na, da] = [sammendrag[id], forrige?.[id]];
    if (!da || !da.kjoringer || !na.kjoringer) return "–";
    // Deviations, findings and text errors count against; each judge point below 5 counts against too.
    const per = (x: Sammendrag[string]) => (x.avvik + x.funn + x.tekstfeil + (x.jurist ? 5 * x.kjoringer - x.jurist : 0)) / x.kjoringer;
    const d = per(na) - per(da);
    return d === 0 ? "0" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
  };
  const linjer = [
    `# Brev-eval ${stempel}`,
    "",
    `Saker: ${saker.length}. Forfatter: ${MODELL_FORFATTER}. Kostnad: ${sum(res, (x) => x.kostnadUsd).toFixed(2)} USD.${forrigeFil ? ` Sammenlignet med ${forrigeFil}.` : ""}`,
    "",
    "| Sak | Kjøringer | Feil | Planfeil | Avvik | Funn | Tekstfeil | Jurist | Endring per kjøring |",
    "|---|---|---|---|---|---|---|---|---|",
    ...saker.map((s) => {
      const x = sammendrag[s.id];
      const r = res.filter((y) => y.id === s.id && y.dom);
      const jurist = r.length ? `${(x.jurist / r.length).toFixed(1)} ${r.every((y) => y.dom!.jurist) ? "ja" : r.some((y) => y.dom!.jurist) ? "delvis" : "nei"}` : "–";
      return `| ${s.id} | ${x.kjoringer} | ${x.feil} | ${x.planfeil} | ${x.avvik} | ${x.funn} | ${x.tekstfeil} | ${jurist} | ${endring(s.id)} |`;
    }),
    "",
  ];
  for (const s of saker) {
    const r = res.filter((x) => x.id === s.id);
    linjer.push(`## ${s.id}: ${s.tittel}`, "", ...s.feller.map((f) => `- Felle: ${f}`), "");
    if (r[0]?.planfeil.length) linjer.push(...r[0].planfeil.map((p) => `- **Plan:** ${p}`), "");
    for (const x of r) {
      linjer.push(`### Kjøring ${x.kjoring}`, "");
      if (x.feil) linjer.push(`- **Feil:** ${x.feil}`);
      linjer.push(...x.avvik.map((a) => `- Avvik: ${a}`), ...x.funn.map((f) => `- Funn: ${f}`), ...x.tekstfeil.map((t) => `- Tekst: ${t}`));
      if (x.dom) linjer.push(`- Dommer: ${x.dom.poeng}/5, ${x.dom.jurist ? "ser ut som jurist" : "ser ikke ut som jurist"}`, ...x.dom.funn.map((f) => `  - «${f.setning}»: ${f.hvorfor}`));
      linjer.push("");
      if (x.kjoring === 1 && x.brev) linjer.push("```text", x.brev, "```", "");
    }
  }
  writeFileSync(`${UT}/${stempel}.md`, linjer.join("\n"));
  console.log(`\nRapport: ${UT}/${stempel}.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
