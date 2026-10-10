// Runs every combination of the form's deciding answers through the comparison engine against the
// index, checks the rules that must always hold, and compares the shares with the frozen baseline.
// Run it whenever the tracks, criteria or candidate filters change (docs/sammenligningsmotor.md).
//
//   npm run sveip                 # compare with src/lib/sammenligning/testdata/sveip-fasit.json
//   npm run sveip -- --frys       # write a new baseline after checking the diff
//
// Exits with 1 when an invariant is broken. The queries are cached per (track, variant, categories,
// heving, lost), so the ~60 000 runs need under 200 queries.

import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../src/db";
import { sammenlign } from "../src/lib/sammenligning";
import { kategoriavstand } from "../src/lib/sammenligning/avled";
import { lagHentKandidater } from "../src/lib/sammenligning/kandidater";
import type { HentKandidater } from "../src/lib/sammenligning/typer";
import { KATEGORIER, RAPPORT_TOM, type RapportSier, SKJEMA_VERSJON, type Skjema, validerSkjema } from "../src/lib/skjema/skjema";

const FASIT = "src/lib/sammenligning/testdata/sveip-fasit.json";
const IDAG = "2026-10-09";

const SELGER = {
  nei: { selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null },
  muntlig: { selger_sa_noe: "ja_muntlig", hvor_sto_det: [], avskrift_selger: null },
  skriftlig_spesifikk: { selger_sa_noe: "ja_skriftlig", hvor_sto_det: ["annonse"], avskrift_selger: "«Nye bremser foran og bak, service tatt ved 60 000 km»" },
  skriftlig_generell: { selger_sa_noe: "ja_skriftlig", hvor_sto_det: ["annonse"], avskrift_selger: "«Meget pen og velholdt bil»" },
} as const;
const R = (o: Partial<RapportSier>): RapportSier => ({ ...RAPPORT_TOM, kostnad: "ja", ...o });
const VERKSTED = {
  nei: { verksted_sett_pa: "nei", rapport_sier: RAPPORT_TOM },
  muntlig: { verksted_sett_pa: "ja_muntlig", rapport_sier: RAPPORT_TOM },
  rapport_tom: { verksted_sett_pa: "ja_skriftlig", rapport_sier: R({}) },
  rapport_hva: { verksted_sett_pa: "ja_skriftlig", rapport_sier: R({ hva: "ja" }) },
  rapport_hva_hvorfor: { verksted_sett_pa: "ja_skriftlig", rapport_sier: R({ hva: "ja", hvorfor: "ja" }) },
  rapport_hva_lev: { verksted_sett_pa: "ja_skriftlig", rapport_sier: R({ hva: "ja", var_der_ved_overtakelse: "ja" }) },
  rapport_full: { verksted_sett_pa: "ja_skriftlig", rapport_sier: R({ hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "ja" }) },
} as const;
// [purchase date, days until the defect showed itself]
const TID = { ny_10d: ["2024-06-01", 10], ny_150d: ["2024-06-01", 150], ny_400d: ["2024-06-01", 400], ny_800d: ["2024-06-01", 800], gml_100d: ["2023-06-01", 100], gml_300d: ["2023-06-01", 300] } as const;
const BIL = { ung: { alder: 4, km: 60_000, pris: 250_000 }, gammel: { alder: 12, km: 200_000, pris: 70_000 } } as const;

type Kombinasjon = { kat: string; sel: keyof typeof SELGER; ver: keyof typeof VERKSTED; tid: keyof typeof TID; bil: keyof typeof BIL; heving: boolean; motbevis: boolean; somDenEr: boolean };

const pluss = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

function skjema(k: Kombinasjon): Skjema {
  const [kjop, dager] = TID[k.tid];
  const oppdaget = pluss(kjop, dager);
  const b = BIL[k.bil];
  const v = VERKSTED[k.ver];
  const rapport = v.verksted_sett_pa === "ja_skriftlig";
  return {
    _meta: { skjema_versjon: SKJEMA_VERSJON, registrert: `${IDAG}T12:00:00Z` },
    del1_kjopet: { selgertype: "forhandler", kjopsdato: kjop, pris_kr: b.pris, km_ved_kjop: b.km, aarsmodell: Number(kjop.slice(0, 4)) - b.alder, merke_modell_valgfritt: null },
    del2_selger: { firmanavn_oppgitt: "Testbil AS", bronnoysund_treff: null, treff_bekreftet: false, som_den_er_i_kontrakt: k.somDenEr ? "ja" : "nei" },
    del3_feil: [
      {
        id: "F1",
        kategori: k.kat,
        en_setning: "feilen oppsto",
        dato_oppdaget: oppdaget,
        kan_bilen_brukes: "ja_begrenset",
        ...SELGER[k.sel],
        svar_pa_direkte_sporsmal: false,
        ...v,
        verksted_navn_dato: rapport ? "Verksted AS" : null,
        kostnad_kr: v.rapport_sier.kostnad === "ja" ? 20_000 : null,
        kostnad_over_pris_bekreftet: false,
        avskrift_verksted: rapport ? "Se rapporten" : null,
      },
    ],
    km_na: b.km + 5_000,
    del6_kontakt_med_selger: {
      tatt_opp_med_selger: "ja_skriftlig",
      dato_forste_gang: pluss(oppdaget, 5),
      selgers_svar: "avvist",
      avtale_inngatt: "nei",
      avtale_beskrivelse: null,
      avtale_gjelder_feil: [],
      selger_la_frem_dokumentasjon: k.motbevis ? "ja" : "nei",
      selger_dokumentasjon_kort: k.motbevis ? "EU-kontroll" : null,
    },
    del7_onske_og_kontakt: { onsket_losning: k.heving ? "angre_kjopet" : "reparasjon", kjoper: { navn: "Test Testesen", adresse: "Prøvegata 1, 0150 Oslo", epost: "test@example.no" } },
    bekreftelser: { opplysningene_er_riktige: true, lest_at_brevet_ikke_er_juridisk_radgivning: true },
  } as unknown as Skjema;
}

function* kombinasjoner(): Generator<Kombinasjon> {
  for (const { nokkel: kat } of KATEGORIER)
    for (const sel of Object.keys(SELGER) as Kombinasjon["sel"][])
      for (const ver of Object.keys(VERKSTED) as Kombinasjon["ver"][])
        for (const tid of Object.keys(TID) as Kombinasjon["tid"][])
          for (const bil of Object.keys(BIL) as Kombinasjon["bil"][])
            for (const heving of [false, true]) for (const motbevis of [false, true]) for (const somDenEr of [false, true]) yield { kat, sel, ver, tid, bil, heving, motbevis, somDenEr };
}

const andel = (n: number, av: number) => Math.round((1000 * n) / Math.max(av, 1)) / 10;

async function main() {
  const ekte = lagHentKandidater(db);
  const cache = new Map<string, ReturnType<HentKandidater>>();
  const hent: HentKandidater = (q) => {
    const n = JSON.stringify(q);
    if (!cache.has(n)) cache.set(n, ekte(q));
    return cache.get(n)!;
  };

  const brudd: string[] = [];
  const telle = <K extends string>() => ({} as Record<K, number>);
  const styrke = telle<string>();
  const arsak = telle<string>();
  const praksis = telle<string>();
  const svakEtter: Record<string, Record<string, [number, number]>> = { sel: {}, ver: {}, tid: {}, motbevis: {} };
  // Where the cited decision comes from (avled.ts kategoritrinn); utenfor_regelen must stay 0.
  const blanding = { samme_kategori: 0, tilbakefall_A_gruppe: 0, tilbakefall_B_naermeste: 0, utenfor_regelen: 0 };
  let totalt = 0;
  let medNaermeste = 0;
  const t = Date.now();

  for (const k of kombinasjoner()) {
    const s = skjema(k);
    const v = validerSkjema(s, IDAG);
    if (v.length) throw new Error(`Ugyldig kombinasjon ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    const r = await sammenlign(s, hent, IDAG);
    const f = r.feil[0];
    const navn = JSON.stringify(k);
    totalt++;
    if (f.styrke == null) brudd.push(`styrke mangler uten forlik: ${navn}`);
    const st = f.styrke ?? "ingen";
    styrke[st] = (styrke[st] ?? 0) + 1;
    for (const d of ["sel", "ver", "tid", "motbevis"] as const) {
      const x = (svakEtter[d][String(k[d])] ??= [0, 0]);
      x[1]++;
      if (f.styrke === "svak") x[0]++;
    }
    const pr = f.praksis ?? "ingen";
    praksis[pr] = (praksis[pr] ?? 0) + 1;
    if (f.styrke === "svak") {
      const a = r.ingen_treff[0]?.siste_stopp.startsWith("ingen_spor") ? r.ingen_treff[0].siste_stopp : f.kandidat ? "vedtak med motstridende tap" : "spor uten vedtak, lignende sak tapt";
      arsak[a] = (arsak[a] ?? 0) + 1;
      if (f.naermeste) medNaermeste++;
    }

    // The rules that must hold for every combination.
    if (r.stopp) brudd.push(`stopp uten privat selger: ${navn}`);
    // Strength describes the case, praksis what can be cited (2026-10-10, index.ts styrke).
    const harSpor = f.spor_alle.length > 0;
    const forventet = !harSpor ? "svak" : f.kandidat ? (f.motstridende || f.kategori_tilbakefall ? "middels" : "sterk") : f.motstridende ? "svak" : "middels";
    if (f.styrke !== forventet) brudd.push(`styrke ${f.styrke}, forventet ${forventet}: ${navn}`);
    if ((f.praksis === "vedtak") !== (f.kandidat != null)) brudd.push(`praksis og vedtak stemmer ikke: ${navn}`);
    // Without a decision a paragraph is only the general one, on C or B, never comparing (generelt.ts).
    if (!f.kandidat && f.avsnitt && f.praksis !== "generell") brudd.push(`avsnitt uten vedtak og uten generell praksis: ${navn}`);
    if ((f.praksis === "generell") !== (!f.kandidat && f.avsnitt != null)) brudd.push(`generell praksis og avsnitt stemmer ikke: ${navn}`);
    if (f.praksis === "generell" && (f.avsnitt!.includes("like sterkt") || !/se for eksempel vedtak .+ og vedtak /.test(f.avsnitt!)))
      brudd.push(`generelt avsnitt sammenligner eller mangler to eksempler: ${navn}`);
    if (f.praksis === "generell" && !f.spor_alle.some((x) => x === "C" || x === "B")) brudd.push(`generelt avsnitt uten spor C eller B: ${navn}`);
    if (f.kandidat) {
      const kk = f.kandidat.kategori;
      if (kk === k.kat) blanding.samme_kategori++;
      else if (kategoriavstand(k.kat, kk, f.kandidat_spor!) === 99) blanding.utenfor_regelen++;
      else if (f.kandidat_spor === "A") blanding.tilbakefall_A_gruppe++;
      else blanding.tilbakefall_B_naermeste++;
      // The category fallback per track (2026-10-10): A within the information group, B to the nearest
      // categories, C never. A fallback says so in the letter and is at most «middels».
      if (f.kategori_tilbakefall !== (kk !== k.kat)) brudd.push(`kategori_tilbakefall stemmer ikke (${kk}): ${navn}`);
      if (kk !== k.kat) {
        if (f.kandidat_spor === "C") brudd.push(`spor C med annen kategori (${kk}): ${navn}`);
        if (kategoriavstand(k.kat, kk, f.kandidat_spor!) === 99) brudd.push(`spor ${f.kandidat_spor} utenfor tilbakefallet (${kk}): ${navn}`);
        if (f.styrke === "sterk") brudd.push(`tilbakefall med styrke sterk (${kk}): ${navn}`);
        if (!/i min sak gjelder opplysningen|Det samme gjelder i min sak|også innen fristen/.test(f.avsnitt ?? "")) brudd.push(`tilbakefall uten setning om kategorien (${kk}): ${navn}`);
      }
    }
  }

  const resultat = {
    kombinasjoner: totalt,
    styrke: Object.fromEntries(Object.entries(styrke).map(([k, n]) => [k, { antall: n, prosent: andel(n, totalt) }])),
    svak_arsak: arsak,
    praksis: Object.fromEntries(Object.entries(praksis).map(([k, n]) => [k, { antall: n, prosent: andel(n, totalt) }])),
    svak_med_naermeste_prosent: andel(medNaermeste, styrke.svak ?? 0),
    kategoriblanding: blanding,
    svak_prosent_etter: Object.fromEntries(Object.entries(svakEtter).map(([d, x]) => [d, Object.fromEntries(Object.entries(x).map(([k, [n, av]]) => [k, andel(n, av)]))])),
  };

  console.log(JSON.stringify(resultat, null, 2));
  console.log(`${totalt} kombinasjoner, ${cache.size} spørringer, ${((Date.now() - t) / 1000).toFixed(0)} s`);

  if (process.argv.includes("--frys")) {
    writeFileSync(FASIT, JSON.stringify(resultat, null, 2) + "\n");
    console.log(`Skrev ${FASIT}`);
  } else {
    let fasit: typeof resultat | null = null;
    try {
      fasit = JSON.parse(readFileSync(FASIT, "utf8"));
    } catch {
      console.log(`Ingen fasit ennå (${FASIT}); kjør med --frys.`);
    }
    if (fasit) {
      const flat = (o: unknown, sti = ""): [string, unknown][] =>
        o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => flat(v, sti ? `${sti}.${k}` : k)) : [[sti, o]];
      const gml = new Map(flat(fasit));
      const endringer = flat(resultat).filter(([k, v]) => gml.get(k) !== v);
      console.log(endringer.length ? `\nEndret mot fasiten:\n${endringer.map(([k, v]) => `  ${k}: ${gml.get(k) ?? "–"} → ${v}`).join("\n")}` : "\nSom fasiten.");
    }
  }

  if (brudd.length) {
    console.error(`\n${brudd.length} brudd på invariantene, de første:\n${brudd.slice(0, 10).join("\n")}`);
    process.exit(1);
  }
  process.exit(0);
}
main();
