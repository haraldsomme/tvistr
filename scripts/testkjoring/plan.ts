// Fictitious test cases for /sak (docs/testkriterier-sak.md): a seeded coverage plan that fixes every
// deciding answer, written as form drafts whose free-text fields are placeholders («<<SKRIV …>>») for
// the generator agents to fill. Deterministic: the same seed and range give the same drafts.
//
//   npx tsx scripts/testkjoring/plan.ts --fra 1 --antall 40 [--frø 2026]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KATEGORIER, RAPPORT_TOM, type RapportSier, SKJEMA_VERSJON, type Skjema, type SkjemaFeil } from "../../src/lib/skjema/skjema";

export const MAPPE = "data/testkjoring";
export const IDAG = "2026-10-10";

const arg = (navn: string, standard: number) => {
  const i = process.argv.indexOf(navn);
  return i >= 0 ? Number(process.argv[i + 1]) : standard;
};

// mulberry32: small, seeded, the same on every machine.
function rng(fro: number) {
  let a = fro >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dag = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
const SKRIV = (hva: string) => `<<SKRIV ${hva}>>`;

// Deciding answers drawn per defect, with the share of cases. The «vanskelig» ones sit on a rule's edge.
const OPPLYSNING = ["nei", "konkret", "konkret", "generell", "muntlig"] as const;
const HVOR = [["annonse"], ["kontrakt"], ["sms_epost_chat"], ["annonse", "sms_epost_chat"]] as const;
const RAPPORT: Record<string, Partial<RapportSier> | null> = {
  ingen: null,
  muntlig: null,
  hva: { hva: "ja" },
  hva_hvorfor: { hva: "ja", hvorfor: "ja" },
  hva_lev: { hva: "ja", var_der_ved_overtakelse: "ja" },
  full: { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "ja" },
};
const RAPPORTER = ["ingen", "muntlig", "hva", "hva_hvorfor", "hva_lev", "full", "full"] as const;
const DAGER = [12, 45, 120, 170, 260, 420, 650, 820] as const;
// Pilot feedback (2026-10-10): a lien has no workshop report, and a paperwork or comfort defect rarely
// stops the car; an electric car has no engine, gearbox or clutch to fail.
const UTEN_VERKSTED = ["heftelse_pant"];
const KJORBAR = ["heftelse_pant", "servicehistorikk", "km_avvik", "bruktimport_opplysning", "utstyr_mangler", "interior_lukt", "annet"];
const FOSSIL = ["motor", "girkasse", "clutch", "eksos_utslipp"];
// Known wordings from won decisions, so some cases test the identical-statement rule.
const KJENT_ORDLYD: Record<string, string> = {
  motor: "Kjøretøyets oljeforbruk er litt høyere enn vanlig.",
  utstyr_mangler: "Ryggekamera",
  servicehistorikk: "Alle servicer fulgt",
};

export type Spesifikasjon = {
  id: string;
  vanskelig: string | null;
  ugyldig: string | null; // the validation rule the case breaks on purpose (criterion A2)
  feil: Array<{ kategori: string; opplysning: string; rapport: string; dager: number }>;
};

function lagSak(nr: number, r: () => number): { utkast: Skjema; spes: Spesifikasjon } {
  const velg = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const id = `T${String(nr).padStart(3, "0")}`;
  const privat = r() < 0.04;
  const forTjuefire = r() < 0.25;
  const kjopsdato = forTjuefire ? dag("2021-02-01", Math.floor(r() * 1000)) : dag("2024-01-20", Math.floor(r() * 820));
  const ung = r() < 0.5;
  const alder = ung ? 1 + Math.floor(r() * 4) : 7 + Math.floor(r() * 9);
  const km = ung ? 10_000 + Math.floor(r() * 70_000) : 110_000 + Math.floor(r() * 150_000);
  const pris = Math.round((ung ? 250_000 + r() * 400_000 : 40_000 + r() * 160_000) / 1000) * 1000;
  const antallFeil = r() < 0.6 ? 1 : r() < 0.62 ? 2 : 3;
  // Every fifth case sits on a rule's edge, the four kinds in turn, so a small run covers them all.
  const VANSKELIGE = ["frist", "generell_som_konkret", "kjent_ordlyd", "kostnad_over_pris"];
  r(); // keeps the draw sequence of the rest of the case unchanged
  let vanskelig: string | null = nr % 5 === 0 ? VANSKELIGE[(nr / 5 - 1) % VANSKELIGE.length] : null;
  // Every thirteenth case breaks a validation rule on purpose, the three in turn (criterion A2).
  const UGYLDIGE = ["dato_oppdaget_for_kjop", "km_na_under_kjop", "skriftlig_uten_avskrift"];
  r();
  const ugyldig = !privat && nr % 13 === 0 ? UGYLDIGE[(nr / 13 - 1) % UGYLDIGE.length] : null;
  const motbevis = r() < 0.15;
  const fristDager = forTjuefire ? 183 : 730;

  const spesFeil: Spesifikasjon["feil"] = [];
  const feil: SkjemaFeil[] = [];
  for (let i = 0; i < antallFeil; i++) {
    let kategori: string = i === 0 ? KATEGORIER[(nr * 7) % KATEGORIER.length].nokkel : velg(KATEGORIER).nokkel;
    const tidligere = spesFeil.map((f) => f.kategori);
    if ((tidligere.includes("batteri_elbil") && FOSSIL.includes(kategori)) || (kategori === "batteri_elbil" && tidligere.some((k) => FOSSIL.includes(k)))) kategori = "elektrisk";
    let opplysning: string = velg(OPPLYSNING);
    let rapport: string = velg(RAPPORTER);
    // The edge cases need a written report to sit on the edge at all.
    if (i === 0 && (vanskelig === "frist" || vanskelig === "kostnad_over_pris") && !RAPPORT[rapport]) rapport = "hva";
    if (UTEN_VERKSTED.includes(kategori)) rapport = "ingen";
    let dager: number = velg(DAGER);
    if (vanskelig === "frist" && i === 0) dager = fristDager + (r() < 0.5 ? -2 : 2);
    if (vanskelig === "generell_som_konkret" && i === 0) opplysning = "generell_som_konkret";
    if (vanskelig === "kjent_ordlyd" && i === 0) {
      const k = velg(Object.keys(KJENT_ORDLYD));
      opplysning = `kjent:${k}`;
    }
    // A defect cannot be found after today.
    const sisteMulige = Math.floor((Date.parse(`${IDAG}T00:00:00Z`) - Date.parse(`${kjopsdato}T00:00:00Z`)) / 86_400_000) - 3;
    dager = Math.max(1, Math.min(dager, sisteMulige));
    const kat = opplysning.startsWith("kjent:") ? opplysning.slice(6) : kategori;
    const skriftlig = opplysning !== "nei" && opplysning !== "muntlig";
    const hvor = skriftlig ? [...(opplysning.startsWith("kjent:") && kat === "motor" ? ["kontrakt"] : velg(HVOR))] : [];
    const rs = RAPPORT[rapport];
    const skriftligRapport = rs != null;
    const overPris = vanskelig === "kostnad_over_pris" && i === 0 && skriftligRapport;
    const kostnad = skriftligRapport && (r() < 0.8 || overPris);
    const avskrift =
      opplysning === "konkret"
        ? SKRIV(`avskrift_selger: en konkret, skriftlig opplysning fra selger om ${kat} (navn en komponent, et tall eller en tilstand), ordrett i «»`)
        : opplysning === "generell"
          ? SKRIV("avskrift_selger: bare et generelt helhetsutsagn om bilen, uten komponent eller tall, f.eks. «Meget pen og velholdt bil»")
          : opplysning === "generell_som_konkret"
            ? SKRIV(`avskrift_selger: et utsagn som ligner konkret, men er generelt om bilen, f.eks. «Teknisk i topp stand, ingen kjente feil»`)
            : opplysning.startsWith("kjent:")
              ? `«${KJENT_ORDLYD[kat]}»`
              : null;
    spesFeil.push({ kategori: kat, opplysning, rapport, dager });
    feil.push({
      id: `F${i + 1}`,
      kategori: kat as SkjemaFeil["kategori"],
      en_setning: SKRIV(`en_setning: én setning (10–200 tegn) som fullfører «Feilen er at …», om en ${kat}-feil, uten punktum inne i setningen`),
      dato_oppdaget: dag(kjopsdato, dager),
      kan_bilen_brukes: KJORBAR.includes(kat) ? velg(["ja", "ja", "ja_begrenset"] as const) : velg(["ja", "ja_begrenset", "nei"] as const),
      selger_sa_noe: opplysning === "nei" ? "nei" : opplysning === "muntlig" ? "ja_muntlig" : "ja_skriftlig",
      hvor_sto_det: hvor as SkjemaFeil["hvor_sto_det"],
      avskrift_selger: avskrift,
      svar_pa_direkte_sporsmal: hvor.includes("sms_epost_chat") && r() < 0.5,
      verksted_sett_pa: rapport === "ingen" ? "nei" : rapport === "muntlig" ? "ja_muntlig" : "ja_skriftlig",
      verksted_navn_dato: skriftligRapport ? SKRIV(`verksted_navn_dato: fiktivt verksted AS og en dato fra ${dag(kjopsdato, dager)} til ${IDAG}`) : null,
      rapport_sier: skriftligRapport ? { ...RAPPORT_TOM, hva: "nei", hvorfor: "star_ikke", ...rs, kostnad: kostnad ? "ja" : "star_ikke" } : RAPPORT_TOM,
      kostnad_kr: kostnad ? (overPris ? Math.round(pris * 1.4) : Math.round((pris * (0.02 + r() * 0.25)) / 100) * 100) : null,
      kostnad_over_pris_bekreftet: overPris,
      avskrift_verksted: skriftligRapport
        ? SKRIV(
            `avskrift_verksted: 10–600 tegn, verkstedets konklusjon om ${kat}-feilen. Den skal si NØYAKTIG dette og ikke mer: ` +
              `hva som er feil=${rs.hva === "ja" ? "ja" : "nei"}, årsak=${rs.hvorfor === "ja" ? "ja" : "nei"}, ` +
              `var der ved overtakelse=${rs.var_der_ved_overtakelse === "ja" ? "ja" : "sier ikke"}, mer enn normal slitasje=${rs.mer_enn_normal_slitasje === "ja" ? "ja" : "sier ikke"}, ` +
              `kostnad=${kostnad ? "ja, beløpet i kostnad_kr" : "sier ikke"}`,
          )
        : null,
    });
  }
  if (vanskelig && !spesFeil.length) vanskelig = null;

  const sisteOppdaget = feil.map((f) => f.dato_oppdaget).sort().at(-1)!;
  const tattOpp = r() < 0.75;
  const forlik = antallFeil > 1 && r() < 0.15;
  const svar = !tattOpp ? null : forlik ? "enige_om_noe" : motbevis ? "avvist" : velg(["ikke_svart", "avvist", "tilbudt_reparasjon"] as const);
  const kmNa = km + Math.floor(r() * 30_000);

  const utkast: Skjema = {
    _meta: { skjema_versjon: SKJEMA_VERSJON, registrert: `${IDAG}T12:00:00+02:00` },
    del1_kjopet: {
      selgertype: privat ? "privat" : "forhandler",
      kjopsdato,
      pris_kr: pris,
      km_ved_kjop: km,
      aarsmodell: Number(kjopsdato.slice(0, 4)) - alder,
      merke_modell_valgfritt: SKRIV(`merke_modell: et reelt merke og modell som passer ${alder} år gammel bil til ${pris} kr${feil.some((f) => f.kategori === "batteri_elbil") ? " (elbil)" : feil.some((f) => FOSSIL.includes(f.kategori)) ? " (med forbrenningsmotor)" : ""}, høyst 60 tegn`),
    },
    del2_selger: {
      firmanavn_oppgitt: privat ? null : SKRIV("firmanavn: fiktivt bilforhandlerfirma, for eksempel «Nordvik Bil AS»"),
      bronnoysund_treff: null,
      treff_bekreftet: false,
      som_den_er_i_kontrakt: velg(["ja", "nei", "vet_ikke"] as const),
    },
    del3_feil: feil,
    km_na: kmNa,
    del6_kontakt_med_selger: {
      tatt_opp_med_selger: tattOpp ? velg(["ja_muntlig", "ja_skriftlig"] as const) : "nei",
      dato_forste_gang: tattOpp ? dag(sisteOppdaget, Math.min(5, Math.max(0, Math.floor((Date.parse(IDAG) - Date.parse(sisteOppdaget)) / 86_400_000)))) : null,
      selgers_svar: svar,
      avtale_inngatt: forlik ? "ja" : "nei",
      avtale_beskrivelse: forlik ? SKRIV("avtale_beskrivelse: hva dere ble enige om for F2, som fullføring av «Avtalen går ut på at …»") : null,
      avtale_gjelder_feil: forlik ? ["F2"] : [],
      selger_la_frem_dokumentasjon: svar === "avvist" && motbevis ? "ja" : "nei",
      selger_dokumentasjon_kort: svar === "avvist" && motbevis ? SKRIV("selger_dokumentasjon_kort: selgers motdokumentasjon, høyst 200 tegn") : null,
    },
    del7_onske_og_kontakt: {
      onsket_losning: velg(["reparasjon", "reparasjon", "prisavslag", "angre_kjopet"] as const),
      kjoper: { navn: SKRIV("navn: fiktivt fullt navn"), adresse: SKRIV("adresse: fiktiv norsk gateadresse, postnummer og sted"), epost: SKRIV("epost: fiktiv adresse på @example.no") },
    },
    bekreftelser: { opplysningene_er_riktige: true, lest_at_brevet_ikke_er_juridisk_radgivning: true },
  };

  // The case that breaks a validation rule on purpose (A2); the generator leaves it broken.
  if (ugyldig === "dato_oppdaget_for_kjop") utkast.del3_feil[0].dato_oppdaget = dag(kjopsdato, -10);
  if (ugyldig === "km_na_under_kjop") utkast.km_na = km - 1000;
  if (ugyldig === "skriftlig_uten_avskrift") Object.assign(utkast.del3_feil[0], { selger_sa_noe: "ja_skriftlig", hvor_sto_det: ["annonse"], avskrift_selger: null, svar_pa_direkte_sporsmal: false });

  return { utkast, spes: { id, vanskelig, ugyldig, feil: spesFeil } };
}

if (process.argv[1]?.endsWith("plan.ts")) {
  const fra = arg("--fra", 1);
  const antall = arg("--antall", 40);
  const r = rng(arg("--frø", 2026));
  mkdirSync(join(MAPPE, "utkast"), { recursive: true });
  const plan: Spesifikasjon[] = [];
  // Draw every case from 1 so a range is the same whatever --fra says.
  for (let nr = 1; nr < fra + antall; nr++) {
    const { utkast, spes } = lagSak(nr, r);
    if (nr < fra) continue;
    writeFileSync(join(MAPPE, "utkast", `${spes.id}.json`), JSON.stringify(utkast, null, 2) + "\n");
    plan.push(spes);
  }
  writeFileSync(join(MAPPE, `plan-${fra}-${fra + antall - 1}.json`), JSON.stringify(plan, null, 2) + "\n");
  const tell = (f: (s: Spesifikasjon) => string | null) => Object.entries(plan.reduce<Record<string, number>>((o, s) => ((o[f(s) ?? "–"] = (o[f(s) ?? "–"] ?? 0) + 1), o), {}));
  console.log(`${plan.length} utkast i ${MAPPE}/utkast`);
  console.log("vanskelig:", tell((s) => s.vanskelig));
  console.log("ugyldig:", tell((s) => s.ugyldig));
  console.log("feil per sak:", tell((s) => String(s.feil.length)));
}
