// Runs the test cases through the same validation and engine as /sak, checks criteria A and B
// (docs/testkriterier-sak.md) by machine, and exports the full text and analysis of every decision
// the control agents need to read (data/testkjoring/vedtak). The full text is the redacted one.
//
//   npx tsx --env-file=.env.local scripts/testkjoring/kjor.ts [T001 T002 …]

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../../src/db";
import { sammenlign, type Resultat } from "../../src/lib/sammenligning";
import { erSpesifikk, kategoriavstand } from "../../src/lib/sammenligning/avled";
import { lagHentKandidater } from "../../src/lib/sammenligning/kandidater";
import type { Spor } from "../../src/lib/sammenligning/typer";
import { type Skjema, validerSkjema } from "../../src/lib/skjema/skjema";
import { UGYLDIG_FELT } from "./valider";

const MAPPE = "data/testkjoring";
const IDAG = "2026-10-10";
const LOVENDRING_START = /gjelder (et )?kjøp før forbrukerkjøpsloven ble endret/;

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

// The letter's practice section as /sak shows it (src/app/sak/skjema.tsx Brevet).
function brevet(r: Resultat): string[] {
  const valgt = r.valgt_til_brev.map((id) => r.feil.find((f) => f.feil_id === id)?.avsnitt).filter((a): a is string => !!a);
  const generelle = r.feil.filter((f) => f.praksis === "generell" && f.avsnitt).map((f) => f.avsnitt!);
  return [...valgt, ...generelle, ...(r.lovendring ? [r.lovendring] : [])];
}

function maskinelt(s: Skjema, r: Resultat, r2: Resultat, ms: number): Record<string, Sjekk> {
  const aktive = r.feil.filter((f) => !f.forlik);
  const kandidater = aktive.map((f) => f.kandidat?.vedtak_id).filter((x): x is number => x != null);
  const spor = s.del3_feil.map((f, i) => ({ id: f.id, ventet: forventetSpor(s, f), fikk: r.feil[i]?.spor_alle ?? [] }));
  const styrkeFeil = aktive.filter((f) => {
    const ventet = !f.spor_alle.length ? "svak" : f.kandidat ? (f.motstridende || f.kategori_tilbakefall ? "middels" : "sterk") : f.motstridende ? "svak" : "middels";
    return f.styrke !== ventet;
  });
  const tilbakefall = aktive.filter((f) => f.kandidat && f.kandidat.kategori !== f.kategori_pass2 && (f.kandidat_spor === "C" || kategoriavstand(f.kategori_pass2, f.kandidat.kategori, f.kandidat_spor!) === 99));
  const forlik = s.del6_kontakt_med_selger.avtale_gjelder_feil;
  return {
    A1: { ok: true },
    A3: ok(JSON.stringify(r) === JSON.stringify(r2), "to kjøringer ga forskjellig svar"),
    A4: ok(ms < 10_000, `${ms} ms`),
    A5: ok(
      (s.del1_kjopet.selgertype === "privat") === (r.stopp === "privat_selger") &&
        r.feil.every((f) => !forlik.includes(f.feil_id) || (f.forlik && f.avsnitt == null && f.styrke == null)),
      "privatkjøp eller forlik er ikke håndtert",
    ),
    B1: ok(spor.every((x) => JSON.stringify(x.ventet) === JSON.stringify(x.fikk)), spor.filter((x) => JSON.stringify(x.ventet) !== JSON.stringify(x.fikk)).map((x) => `${x.id}: ventet ${x.ventet.join("") || "–"}, fikk ${x.fikk.join("") || "–"}`).join("; ")),
    B2: ok(!styrkeFeil.length, styrkeFeil.map((f) => `${f.feil_id}: ${f.styrke}`).join("; ")),
    B3: ok(
      aktive.every((f) => (f.praksis === "vedtak") === (f.kandidat != null) && (f.praksis === "generell") === (!f.kandidat && f.avsnitt != null)),
      "praksis og innhold stemmer ikke",
    ),
    B4: ok(!tilbakefall.length, tilbakefall.map((f) => `${f.feil_id}: ${f.kategori_pass2} → ${f.kandidat!.kategori} på ${f.kandidat_spor}`).join("; ")),
    B5: ok(
      new Set(kandidater).size === kandidater.length && r.valgt_til_brev.length <= 2 && !r.feil.some((f) => f.avsnitt && LOVENDRING_START.test(f.avsnitt)),
      "samme vedtak på to feil, mer enn to avsnitt, eller lovendringen inne i et avsnitt",
    ),
    B6: ok(
      s.del3_feil.every((f, i) => !(f.kostnad_kr != null && f.kostnad_kr > s.del1_kjopet.pris_kr && !f.kostnad_over_pris_bekreftet) || !/\d{3,} % av kjøpesummen/.test(r.feil[i]?.avsnitt ?? "")),
      "kostnad over kjøpesummen gjengitt uten bekreftelse",
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

async function main() {
  const valgte = process.argv.slice(2);
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

    // Every decision the control agents read: the chosen one, the contradicting loss, the nearest
    // won one, the general paragraph's examples, and three other won ones per defect (criterion C4).
    const referanser = await Promise.all(
      r.feil.map(async (f) => {
        const spor = f.kandidat_spor ?? f.spor_primar;
        const alternativer = f.kandidat && spor
          ? (await hent({ spor, a_variant: spor === "A" ? (f.a_variant ?? null) : null, kategori: f.kategori_pass2, kategorier: [f.kandidat.kategori], heving_tillatt: r.sak.heving_tillatt_i_praksis }))
              .filter((v) => v.vedtak_id !== f.kandidat!.vedtak_id)
              .slice(0, 3)
              .map((v) => v.saksnummer)
          : [];
        const eksempler = f.praksis === "generell" ? [...(f.avsnitt ?? "").matchAll(/vedtak (\S+) av/g)].map((m) => m[1]) : [];
        return { feil_id: f.feil_id, kandidat: f.kandidat?.saksnummer ?? null, motstridende: f.motstridende?.saksnummer ?? null, naermeste: f.naermeste?.saksnummer ?? null, eksempler, alternativer };
      }),
    );
    const alle = [...new Set(referanser.flatMap((x) => [x.kandidat, x.motstridende, x.naermeste, ...x.eksempler, ...x.alternativer]).filter((x): x is string => !!x))];
    await eksporter(alle);

    writeFileSync(
      join(MAPPE, "resultat", `${id}.json`),
      JSON.stringify({ id, spes, skjema: s, resultat: r, brevet: brevet(r), maskinelt: sjekker, vedtak: referanser.map((x) => ({ ...x, filer: [x.kandidat, x.motstridende, x.naermeste, ...x.eksempler, ...x.alternativer].filter(Boolean).map((n) => `vedtak/${trygt(n!)}.json`) })) }, null, 2) + "\n",
    );
    const brudd = Object.entries(sjekker).filter(([, v]) => !v.ok);
    oversikt.push(`${id}: ${r.feil.map((f) => `${f.feil_id} ${f.styrke ?? "forlik"}/${f.praksis ?? "–"}${f.kandidat ? ` ${f.kandidat.saksnummer}` : ""}`).join(", ")}${brudd.length ? ` | BRUDD ${brudd.map(([k, v]) => `${k}: ${v.merknad}`).join("; ")}` : ""} (${ms} ms)`);
  }
  console.log(oversikt.join("\n"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
