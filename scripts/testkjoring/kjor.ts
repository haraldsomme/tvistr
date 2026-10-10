// Runs the test cases through the same validation and engine as /sak, checks criteria A and B
// (docs/testkriterier-sak.md) by machine, and exports the full text and analysis of every decision
// the control agents need to read (data/testkjoring/vedtak). The full text is the redacted one.
//
//   npx tsx --env-file=.env.local scripts/testkjoring/kjor.ts [T001 T002 …]
//   … --praksis      also writes the practice section with the model (about 0,35 USD per paragraph),
//                    the jurist's draft blocks included, and checks P1–P4 (data/testkjoring/praksis)
//   … --fra-lager    replays the stored model answers through the current verifier, without the API
//   … --praksis --agent   no API: each prompt is written to <mappe>/prompter/<hash>.json for a Claude Code
//                    agent to answer in <mappe>/svar/<hash>.json; run again until nothing waits

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../../src/db";
import { PRAKSIS_FAST } from "../../src/lib/praksis/fast";
import { lagHentAnalyse } from "../../src/lib/praksis/analyse";
import { type Forsok, type Praksisdel, skrivPraksisdel } from "../../src/lib/praksis/praksisdel";
import { sjekkSkjema } from "../../src/lib/ai/skjemasjekk";
import { PRAKSIS_VERKTOY } from "../../src/lib/praksis/prompt";
import type { Kall } from "../../src/lib/praksis/skriv";
import type { PraksisSvar } from "../../src/lib/praksis/typer";
import { MAKS_KANDIDATER, sammenlign, type Resultat } from "../../src/lib/sammenligning";
import { erSpesifikk } from "../../src/lib/sammenligning/avled";
import { lagHentEksempler, lagHentKandidater } from "../../src/lib/sammenligning/kandidater";
import type { Spor } from "../../src/lib/sammenligning/typer";
import { type Skjema, validerSkjema } from "../../src/lib/skjema/skjema";
import { UGYLDIG_FELT } from "./valider";

// TESTKJORING_MAPPE runs a second set side by side (e.g. another model) without touching the first.
const MAPPE = process.env.TESTKJORING_MAPPE ?? "data/testkjoring";
const IDAG = "2026-10-10";

type Sjekk = { ok: boolean; merknad?: string };
const ok = (betingelse: boolean, merknad: string): Sjekk => (betingelse ? { ok: true } : { ok: false, merknad });

// Criterion B1 from the rules as written (docs/spor.md), not from the engine's own code path.
function forventetSpor(s: Skjema, f: Skjema["del3_feil"][number]): Spor[] {
  if (s.del1_kjopet.selgertype === "privat") return [];
  const lovFor = s.del1_kjopet.kjopsdato < "2024-01-01";
  const dager = Math.round((Date.parse(f.dato_oppdaget) - Date.parse(s.del1_kjopet.kjopsdato)) / 86_400_000);
  const innenFrist = dager <= (lovFor ? 183 : 730);
  const skriftlig = f.selger_sa_noe === "ja_skriftlig" && !!f.avskrift_selger?.trim();
  const taushet = f.selger_sa_noe === "nei" && ["kollisjonsskade", "servicehistorikk", "km_avvik", "bruktimport_opplysning", "arsmodell_identitet"].includes(f.kategori);
  const r = f.verksted_sett_pa === "ja_skriftlig" ? f.rapport_sier : null;
  const ut: Spor[] = [];
  if ((skriftlig && erSpesifikk(f.avskrift_selger!)) || taushet) ut.push("A");
  if (r?.mer_enn_normal_slitasje === "ja" && r.var_der_ved_overtakelse === "ja") ut.push("C");
  if (innenFrist && r?.hva === "ja") ut.push("B");
  return ut;
}

function maskinelt(s: Skjema, r: Resultat, r2: Resultat, ms: number): Record<string, Sjekk> {
  const aktive = r.feil.filter((f) => !f.forlik);
  const spor = s.del3_feil.map((f, i) => ({ id: f.id, ventet: forventetSpor(s, f), fikk: r.feil[i]?.spor_alle ?? [] }));
  // The strength rule (docs/sammenligningsmotor.md): no track → svak; no decision or a late complaint → middels.
  const styrkeFeil = aktive.filter((f) => f.styrke !== (!f.spor_alle.length ? "svak" : !f.kandidater.length || f.reklamasjon_over_to_mnd ? "middels" : "sterk"));
  const forlik = s.del6_kontakt_med_selger.avtale_gjelder_feil;
  return {
    A1: { ok: true },
    A3: ok(JSON.stringify(r) === JSON.stringify(r2), "to kjøringer ga forskjellig svar"),
    A4: ok(ms < 10_000, `${ms} ms`),
    A5: ok(
      (s.del1_kjopet.selgertype === "privat") === (r.stopp === "privat_selger") &&
        r.feil.every((f) => !forlik.includes(f.feil_id) || (f.forlik && !f.kandidater.length && f.styrke == null)),
      "privatkjøp eller forlik er ikke håndtert",
    ),
    B1: ok(spor.every((x) => JSON.stringify(x.ventet) === JSON.stringify(x.fikk)), spor.filter((x) => JSON.stringify(x.ventet) !== JSON.stringify(x.fikk)).map((x) => `${x.id}: ventet ${x.ventet.join("") || "–"}, fikk ${x.fikk.join("") || "–"}`).join("; ")),
    B2: ok(!styrkeFeil.length, styrkeFeil.map((f) => `${f.feil_id}: ${f.styrke}`).join("; ")),
    B5: ok(
      r.valgt_til_brev.length <= 2 && r.feil.every((f) => f.kandidater.length <= MAKS_KANDIDATER && f.kandidater.every((k) => f.spor_alle.includes(k.spor))),
      "mer enn to feil til brevet, for mange kandidater, eller kandidat på et spor feilen ikke har",
    ),
  };
}

const trygt = (saksnummer: string) => saksnummer.replace(/[^\w-]/g, "_");

async function eksporter(saksnummer: string[]) {
  mkdirSync(join(MAPPE, "vedtak"), { recursive: true });
  if (!saksnummer.length) return;
  const { rows } = await db.execute(sql`
    select v.id as vedtak_id, v.saksnummer, v.vedtaksdato::text as vedtaksdato, v.kilde_url, v.selger_type::text as selger_type, v.utfall::text as utfall,
      v.forbehold, v.forbehold_tekst, v.kjopesum_nok, v.km_ved_kjop, v.alder_ved_kjop, v.tilkjent_prisavslag_nok, v.tilkjent_erstatning_nok, v.tilkjent_totalt_nok,
      a.sanksjon, a.feil, a.opplysninger, a.bevis, a.begrunnelse_sitater, v.fulltekst_renset
    from vedtak v join vedtak_analyse a on a.vedtak_id = v.id
    where v.saksnummer in (${sql.join(saksnummer.map((x) => sql`${x}`), sql`, `)})`);
  for (const r of rows) writeFileSync(join(MAPPE, "vedtak", `${trygt(String(r.saksnummer))}.json`), JSON.stringify(r, null, 2) + "\n");
}

// The general paragraph and the fixed block describe the rule; they never compare (docs/praksis.md).
const SAMMENLIGNING = /like sterk|sterkere|samme type|tilsvarende sak/i;
const SAMTIDIG = 5;

async function iParallell<T>(xs: T[], n: number, f: (x: T) => Promise<void>) {
  const ko = [...xs];
  await Promise.all(Array.from({ length: n }, async () => {
    while (ko.length) await f(ko.shift()!);
  }));
}

// P1–P4 (docs/testkriterier-sak.md): the paragraphs follow the order and limits, and a general paragraph
// carries no amount from a decision and no comparison.
function praksisSjekker(r: Resultat, d: Praksisdel, igjen: Praksisdel | null, eksempelbelop: number[]): Record<string, Sjekk> {
  const generelle = d.avsnitt.filter((a) => a.modus !== "spesifikk");
  const vedtak = d.avsnitt.filter((a) => a.modus === "spesifikk").map((a) => a.vedtak[0].vedtak_id);
  const medSpor = new Set(r.feil.filter((f) => !f.forlik && f.spor_alle.length).map((f) => f.feil_id));
  const tall = (t: string) => [...t.matchAll(/\d{1,3}(?:[ \u00a0]\d{3})+|\d+/g)].map((m) => Number(m[0].replace(/\s/g, "")));
  return {
    P1: { ok: true, merknad: `${d.avsnitt.map((a) => `${a.feil_id} ${a.modus}`).join(", ") || "ingen avsnitt"}` },
    P2: { ok: true, merknad: `${d.forsok.reduce((n, f) => n + (f.forbruk?.kostnadUsd ?? 0), 0).toFixed(3)} USD` },
    P3: ok(
      d.avsnitt.length <= 2 && generelle.length <= 1 && new Set(vedtak).size === vedtak.length && d.avsnitt.every((a) => medSpor.has(a.feil_id)) &&
        (igjen == null || JSON.stringify(igjen.avsnitt) === JSON.stringify(d.avsnitt)),
      "for mange avsnitt, samme vedtak to ganger, avsnitt for en feil uten spor, eller ny verifisering ga et annet avsnitt",
    ),
    P4: ok(
      generelle.every((a) => !SAMMENLIGNING.test(a.avsnitt) && !tall(a.avsnitt).some((n) => eksempelbelop.includes(n))),
      "et generelt avsnitt sammenligner eller har et beløp fra et eksempelvedtak",
    ),
  };
}

// The model call answered by a Claude Code agent: the prompt goes to a file, the answer comes from one.
// A missing answer makes the case wait for the next round.
const nokkel = (system: string, bruker: string) => createHash("sha256").update(`${system}\n${bruker}`).digest("hex").slice(0, 16);
function agentKall(venter: Set<string>): Kall {
  mkdirSync(join(MAPPE, "prompter"), { recursive: true });
  mkdirSync(join(MAPPE, "svar"), { recursive: true });
  return async ({ system, bruker }) => {
    const h = nokkel(system, bruker);
    const svar = join(MAPPE, "svar", `${h}.json`);
    if (!existsSync(svar)) {
      writeFileSync(join(MAPPE, "prompter", `${h}.json`), JSON.stringify({ hash: h, system, bruker }, null, 2) + "\n");
      venter.add(h);
      throw new Error(`venter på svar ${h}`);
    }
    const input = JSON.parse(readFileSync(svar, "utf8")) as PraksisSvar;
    const feil = sjekkSkjema(PRAKSIS_VERKTOY.input_schema, input);
    if (feil.length) throw new Error(`ugyldig svar ${h}: ${feil.slice(0, 3).join("; ")}`);
    return { input, modell: "claude-code-opus", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 } };
  };
}

async function kjorPraksis(ider: string[], fraLager: boolean, agent: boolean) {
  const venter = new Set<string>();
  const ventende: string[] = [];
  const deps = { hentKandidater: lagHentKandidater(db), hentAnalyse: lagHentAnalyse(db), hentEksempler: lagHentEksempler(db), utkast: true };
  mkdirSync(join(MAPPE, "praksis"), { recursive: true });
  const linjer: string[] = [];
  // Amounts the jurist's example decisions awarded: a general paragraph must not carry them (P4).
  const eksempler = await deps.hentEksempler(Object.values(PRAKSIS_FAST).flatMap((b) => b.eksempler), "C");
  const belop = eksempler.flatMap((v) => [v.tilkjent_totalt_nok, v.belop_tilkjent_nok]).filter((x): x is number => x != null);
  await iParallell(ider, fraLager ? 1 : SAMTIDIG, async (id) => {
    const fil = join(MAPPE, "resultat", `${id}.json`);
    const res = JSON.parse(readFileSync(fil, "utf8"));
    if (!res.resultat || res.resultat.stopp) return;
    const lager = join(MAPPE, "praksis", `${id}.json`);
    let d: Praksisdel;
    let igjen: Praksisdel | null = null;
    if (fraLager) {
      d = JSON.parse(readFileSync(lager, "utf8"));
      // The same calls, answered from the store by their prompt.
      const lagret = new Map(d.forsok.filter((f) => f.bruker && f.raa).map((f) => [f.bruker!, f.raa!]));
      const kall: Kall = async ({ bruker }) => {
        const raa = lagret.get(bruker);
        if (!raa) throw new Error("ikke i lageret");
        return { input: raa, modell: "lager", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 } };
      };
      igjen = await skrivPraksisdel(res.skjema, IDAG, { ...deps, kall });
    } else {
      try {
        d = await skrivPraksisdel(res.skjema, IDAG, agent ? { ...deps, kall: agentKall(venter) } : deps);
      } catch (e) {
        if (!agent) throw e;
        ventende.push(`${id}: ${e instanceof Error ? e.message : e}`);
        return;
      }
      writeFileSync(lager, JSON.stringify(d, null, 2) + "\n");
    }
    const sjekker = praksisSjekker(res.resultat, d, igjen, belop);
    // The decisions the paragraphs cite, for the control agents.
    await eksporter([...new Set(d.avsnitt.flatMap((a) => a.vedtak.map((v) => v.saksnummer)))]);
    res.praksis = {
      avsnitt: d.avsnitt.map((a) => ({ ...a, filer: a.vedtak.map((v) => `vedtak/${trygt(v.saksnummer)}.json`) })),
      lovendring: d.lovendring,
      forsok: d.forsok.map((f: Forsok) => ({ feil_id: f.feil_id, modus: f.modus, vedtak_id: f.vedtak_id, eksempel_vedtak_ids: f.eksempel_vedtak_ids, grunn: f.grunn, strykninger: f.strykninger, begrunnelse: f.raa?.begrunnelse ?? null })),
    };
    res.maskinelt = { ...res.maskinelt, ...sjekker };
    writeFileSync(fil, JSON.stringify(res, null, 2) + "\n");
    const brudd = Object.entries(sjekker).filter(([, v]) => !v.ok);
    linjer.push(`${id}: ${sjekker.P1.merknad} (${sjekker.P2.merknad})${brudd.length ? ` | BRUDD ${brudd.map(([k, v]) => `${k}: ${v.merknad}`).join("; ")}` : ""}`);
  });
  console.log(linjer.sort().join("\n"));
  if (agent) console.log(`\n${venter.size} prompter venter på svar i ${MAPPE}/prompter (${ventende.length} saker):\n${ventende.sort().join("\n")}`);
}

async function main() {
  const praksis = process.argv.includes("--praksis");
  const fraLager = process.argv.includes("--fra-lager");
  const valgte = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const ider = (valgte.length ? valgte : readdirSync(join(MAPPE, "saker")).map((f) => f.replace(/\.json$/, ""))).sort();
  const plan = readdirSync(MAPPE)
    .filter((f) => f.startsWith("plan-"))
    .flatMap((f) => JSON.parse(readFileSync(join(MAPPE, f), "utf8")) as { id: string; ugyldig: string | null; vanskelig: string | null }[]);
  const hent = lagHentKandidater(db);
  mkdirSync(join(MAPPE, "resultat"), { recursive: true });
  const oversikt: string[] = [];

  for (const id of ider) {
    const s = JSON.parse(readFileSync(join(MAPPE, "saker", `${id}.json`), "utf8")) as Skjema;
    const spes = plan.find((p) => p.id === id);
    const valideringsfeil = validerSkjema(s, IDAG);
    const A2 = spes?.ugyldig
      ? ok(valideringsfeil.some((f) => UGYLDIG_FELT[spes.ugyldig!].test(f.felt)), `skulle stoppes på ${spes.ugyldig}`)
      : ok(!valideringsfeil.length, valideringsfeil.map((f) => `${f.felt}: ${f.melding}`).join("; "));
    // An invalid form never reaches the engine on /sak.
    if (valideringsfeil.length) {
      writeFileSync(join(MAPPE, "resultat", `${id}.json`), JSON.stringify({ id, spes, skjema: s, valideringsfeil, maskinelt: { A2 } }, null, 2) + "\n");
      oversikt.push(`${id}: stoppet i valideringen (A2 ${A2.ok ? "ok" : "FEIL"})`);
      continue;
    }

    let r: Resultat;
    let r2: Resultat;
    let ms: number;
    try {
      const t = performance.now();
      r = await sammenlign(s, hent, IDAG);
      ms = Math.round(performance.now() - t);
      r2 = await sammenlign(s, hent, IDAG);
    } catch (e) {
      writeFileSync(join(MAPPE, "resultat", `${id}.json`), JSON.stringify({ id, spes, skjema: s, maskinelt: { A1: { ok: false, merknad: String(e) }, A2 } }, null, 2) + "\n");
      oversikt.push(`${id}: UNNTAK ${e}`);
      continue;
    }
    const sjekker = { A2, ...maskinelt(s, r, r2, ms) };

    // The candidates' decisions, for the control agents and the practice paragraph.
    const referanser = r.feil.map((f) => ({ feil_id: f.feil_id, kandidater: f.kandidater.map((k) => k.saksnummer) }));
    await eksporter([...new Set(referanser.flatMap((x) => x.kandidater))]);

    writeFileSync(
      join(MAPPE, "resultat", `${id}.json`),
      JSON.stringify({ id, spes, skjema: s, resultat: r, maskinelt: sjekker, vedtak: referanser.map((x) => ({ ...x, filer: x.kandidater.map((n) => `vedtak/${trygt(n)}.json`) })) }, null, 2) + "\n",
    );
    const brudd = Object.entries(sjekker).filter(([, v]) => !v.ok);
    oversikt.push(`${id}: ${r.feil.map((f) => `${f.feil_id} ${f.styrke ?? "forlik"}${f.kandidater.length ? ` ${f.kandidater.map((k) => k.saksnummer).join(" ")}` : ""}`).join(", ")}${brudd.length ? ` | BRUDD ${brudd.map(([k, v]) => `${k}: ${v.merknad}`).join("; ")}` : ""} (${ms} ms)`);
  }
  console.log(oversikt.join("\n"));
  if (praksis || fraLager) await kjorPraksis(ider, fraLager, process.argv.includes("--agent"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
