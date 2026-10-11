// Compares the feilvurdering with pass 2 (vedtak_analyse / vedtak_feil) for decisions both have
// assessed. Pass 2 is an independent reading, not the truth: a disagreement means one of them is
// wrong, and the list at the end is for reading which.
//
//   npm run feilvurdering:mal -- [--liste pilot] [--vis 30]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { FEILVURDERING_VERSJON } from "../src/lib/feilvurdering/skjema";

const { values: args } = parseArgs({ options: { liste: { type: "string" }, vis: { type: "string", default: "30" } } });

// Pass 2's 27 categories → our main categories. `annet` has no counterpart.
const P2_TIL_HOVED: Record<string, string> = {
  motor: "motor",
  eksos_utslipp: "motor",
  girkasse: "drivlinje",
  clutch: "drivlinje",
  drivlinje: "drivlinje",
  bremser: "understell",
  understell_hjuloppheng: "understell",
  rust: "karosseri",
  ramme_chassis: "karosseri",
  karosseri_lakk_glass: "karosseri",
  fukt_lekkasje: "fukt",
  interior_lukt: "fukt",
  elektrisk: "elektrisk",
  klimaanlegg: "klima",
  batteri_elbil: "hoyvolt",
  utstyr_mangler: "utstyr",
  dekk_felger: "utstyr",
  servicehistorikk: "service",
  kollisjonsskade: "historikk",
  km_avvik: "historikk",
  bruktimport_opplysning: "historikk",
  arsmodell_identitet: "historikk",
  ombygging_tuning: "historikk",
  eu_kontroll_registrering: "historikk",
  heftelse_pant: "historikk",
  garanti_vilkar: "garanti",
};
const SANKSJON_P2: Record<string, string[]> = { heving: ["heving"], prisavslag: ["prisavslag"], erstatning: ["erstatning"], prisavslag_og_erstatning: ["prisavslag", "erstatning"] };

async function main() {
  const liste = args.liste ? (JSON.parse(readFileSync(join("data/feilvurdering/lister", `${args.liste}.json`), "utf8")) as number[]) : null;
  const { rows } = await db.execute(sql`
    select v.id, v.saksnummer, v.utfall, v.godtatte_kategorier, v.sanksjoner, v.dager_til_feil, v.feilvurdering,
      a.sanksjon p2_sanksjon, a.dager_til_feil p2_dager,
      coalesce((select array_agg(distinct f.kategori) from vedtak_feil f where f.vedtak_id = v.id
        and (f.vurdering = 'mangel' or (f.vurdering = 'samlet_vurdering' and f.samlet_utfall = 'mangel'))), '{}') p2_godtatt
    from vedtak v join vedtak_analyse a on a.vedtak_id = v.id
    where v.feilvurdering_versjon = ${FEILVURDERING_VERSJON} and not a.ikke_mangelssak
    ${liste ? sql`and v.id in (${sql.join(liste.map((i) => sql`${i}`), sql`, `)})` : sql``}`);
  if (!rows.length) {
    console.log("Ingen vedtak med begge vurderingene.");
    process.exit(0);
  }

  const per = new Map<string, { begge: number; bareVi: number; bareP2: number }>();
  const tell = (k: string, f: "begge" | "bareVi" | "bareP2") => {
    const t = per.get(k) ?? { begge: 0, bareVi: 0, bareP2: 0 };
    t[f]++;
    per.set(k, t);
  };
  let likeKategorier = 0;
  let sanksjonSammenlignet = 0;
  let sanksjonLik = 0;
  let dagerBegge = 0;
  let dagerNaer = 0;
  let feilTotalt = 0;
  let feilMedSitat = 0;
  let medholdUtenSitat = 0;
  const uenige: string[] = [];

  for (const r of rows) {
    const vi = new Set((r.godtatte_kategorier as string[] | null) ?? []);
    const p2 = new Set(((r.p2_godtatt as string[]) ?? []).map((k) => P2_TIL_HOVED[k]).filter(Boolean));
    for (const k of new Set([...vi, ...p2])) tell(k, vi.has(k) && p2.has(k) ? "begge" : vi.has(k) ? "bareVi" : "bareP2");
    const lik = vi.size === p2.size && [...vi].every((k) => p2.has(k));
    if (lik) likeKategorier++;
    else uenige.push(`${r.saksnummer ?? r.id} (id ${r.id}, ${r.utfall}): vi [${[...vi].join(",")}] · pass 2 [${[...p2].join(",")}]`);

    if (r.p2_sanksjon) {
      sanksjonSammenlignet++;
      const vår = new Set((r.sanksjoner as string[] | null) ?? []);
      if (SANKSJON_P2[r.p2_sanksjon as string].every((s) => vår.has(s))) sanksjonLik++;
    }
    if (r.dager_til_feil !== null && r.p2_dager !== null) {
      dagerBegge++;
      if (Math.abs(Number(r.dager_til_feil) - Number(r.p2_dager)) <= 7) dagerNaer++;
    }
    for (const f of (r.feilvurdering as { feil: { utfall: string; sitat: string | null }[] }).feil) {
      feilTotalt++;
      if (f.sitat) feilMedSitat++;
      else if (f.utfall === "medhold") medholdUtenSitat++;
    }
  }

  const pst = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : "–");
  console.log(`${rows.length} vedtak med begge vurderingene.\n`);
  console.log(`Samme sett av godtatte hovedkategorier: ${likeKategorier} (${pst(likeKategorier, rows.length)})`);
  console.log(`Sanksjon fra pass 2 finnes i vår liste: ${sanksjonLik} av ${sanksjonSammenlignet} (${pst(sanksjonLik, sanksjonSammenlignet)})`);
  console.log(`Dager til feil innen 7 dager av pass 2: ${dagerNaer} av ${dagerBegge} (${pst(dagerNaer, dagerBegge)})`);
  console.log(`Feil med ordrett sitat: ${feilMedSitat} av ${feilTotalt} (${pst(feilMedSitat, feilTotalt)}); feil med medhold uten sitat: ${medholdUtenSitat}\n`);
  console.log("Per hovedkategori (godtatt hos begge / bare oss / bare pass 2):");
  console.table(Object.fromEntries([...per].sort((a, b) => b[1].begge + b[1].bareVi + b[1].bareP2 - (a[1].begge + a[1].bareVi + a[1].bareP2))));
  const vis = Number(args.vis);
  if (uenige.length) {
    console.log(`\nUenige (${uenige.length}${uenige.length > vis ? `, viser ${vis}` : ""}):`);
    for (const u of uenige.slice(0, vis)) console.log(`  ${u}`);
  }
  process.exit(0);
}
main();
