// Runs every combination of the form's deciding answers through the comparison engine against the
// index and checks the rules that must always hold (docs/sammenligningsmotor.md). Invariants only: the
// shares are printed for information, not compared with a baseline.
//
//   npm run sveip
//
// Exits with 1 when an invariant is broken. The queries are cached per (track, variant, category,
// heving, lost), so the ~60 000 runs need a few hundred queries.

import { db } from "../src/db";
import { MAKS_KANDIDATER, sammenlign } from "../src/lib/sammenligning";
import { lagHentKandidater } from "../src/lib/sammenligning/kandidater";
import type { HentKandidater } from "../src/lib/sammenligning/typer";
import { KATEGORIER, RAPPORT_TOM, type RapportSier, SKJEMA_VERSJON, type Skjema, validerSkjema } from "../src/lib/skjema/skjema";

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

async function main() {
  const ekte = lagHentKandidater(db);
  const cache = new Map<string, ReturnType<HentKandidater>>();
  let kall = 0;
  const hent: HentKandidater = (q) => {
    kall++;
    const n = JSON.stringify(q);
    if (!cache.has(n)) cache.set(n, ekte(q));
    return cache.get(n)!;
  };

  const brudd: string[] = [];
  const styrke: Record<string, number> = {};
  const medKandidat = { ja: 0, nei: 0 };
  let totalt = 0;
  const t = Date.now();

  // A private sale stops before matching.
  const privat = skjema(kombinasjoner().next().value!);
  privat.del1_kjopet.selgertype = "privat";
  const forPrivat = kall;
  const rp = await sammenlign(privat, hent, IDAG);
  if (rp.stopp !== "privat_selger" || kall !== forPrivat) brudd.push("privatkjøp stoppet ikke før matching");

  for (const k of kombinasjoner()) {
    const s = skjema(k);
    const v = validerSkjema(s, IDAG);
    if (v.length) throw new Error(`Ugyldig kombinasjon ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    const r = await sammenlign(s, hent, IDAG);
    const f = r.feil[0];
    const navn = JSON.stringify(k);
    totalt++;
    styrke[f.styrke ?? "ingen"] = (styrke[f.styrke ?? "ingen"] ?? 0) + 1;
    medKandidat[f.kandidater.length ? "ja" : "nei"]++;

    // The rules that must hold for every combination.
    if (r.stopp) brudd.push(`stopp uten privat selger: ${navn}`);
    if (!k.heving && f.kandidater.some((x) => x.sanksjon === "heving")) brudd.push(`hevingsvedtak uten ønske om heving: ${navn}`);
    if (!f.spor_alle.length && f.kandidater.length) brudd.push(`vedtak uten spor: ${navn}`);
    const forventet = !f.spor_alle.length ? "svak" : !f.kandidater.length || f.reklamasjon_over_to_mnd ? "middels" : "sterk";
    if (f.styrke !== forventet) brudd.push(`styrke ${f.styrke}, forventet ${forventet}: ${navn}`);
    if (f.kandidater.length > MAKS_KANDIDATER) brudd.push(`flere enn ${MAKS_KANDIDATER} kandidater: ${navn}`);
    if (f.kandidater.some((x) => !f.spor_alle.includes(x.spor))) brudd.push(`kandidat på et spor feilen ikke har: ${navn}`);
  }

  const andel = (n: number) => Math.round((1000 * n) / Math.max(totalt, 1)) / 10;
  console.log(JSON.stringify({ kombinasjoner: totalt, styrke: Object.fromEntries(Object.entries(styrke).map(([k, n]) => [k, `${n} (${andel(n)} %)`])), med_kandidat: `${andel(medKandidat.ja)} %` }, null, 2));
  console.log(`${totalt} kombinasjoner, ${cache.size} spørringer, ${((Date.now() - t) / 1000).toFixed(0)} s`);

  if (brudd.length) {
    console.error(`\n${brudd.length} brudd på invariantene, de første:\n${brudd.slice(0, 10).join("\n")}`);
    process.exit(1);
  }
  console.log("Ingen brudd på invariantene.");
  process.exit(0);
}
main();
