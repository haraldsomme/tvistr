// Steps 1–2: the case and each defect, derived from the form (docs/sammenligningsmotor.md § 5).
import { dagerMellom } from "@/lib/analyse/verifiser";
import { HVOR_STO_DET, FORM_RANG } from "./fraser";
import { erSpesifikk } from "./spesifikk";
import type { FeilProfil, IngenSporArsak, Sak, SakProfil, Skjema, SkjemaFeil, Spor } from "./typer";

function band(x: number, grenser: number[], navn: string[]): string {
  const i = grenser.findIndex((g) => x < g);
  return navn[i === -1 ? navn.length - 1 : i];
}

const LOSNING: Record<string, string> = { reparasjon: "retting", angre_kjopet: "heving" };

export function avledSak(s: Skjema, idag: string): Sak {
  const k = s.del1_kjopet;
  const lov = k.kjopsdato < "2024-01-01" ? "før_2024" : "etter_2024";
  const kmSiden = s.km_na - k.km_ved_kjop;
  const mnd = Math.max(1, Math.round(dagerMellom(k.kjopsdato, idag) / 30.4375));
  const kmPerMnd = Math.round(kmSiden / mnd);
  const alder = Number(k.kjopsdato.slice(0, 4)) - k.aarsmodell;
  const onsket = LOSNING[s.del7_onske_og_kontakt.onsket_losning] ?? s.del7_onske_og_kontakt.onsket_losning;
  const profil: SakProfil = {
    lov,
    formodningsfrist_dager: lov === "før_2024" ? 183 : 730,
    alder_ved_kjop: alder,
    prisband: band(k.pris_kr, [100_000, 250_000, 450_000], ["<100k", "100-250k", "250-450k", "450k+"]),
    aldersband: band(alder, [4, 8, 12], ["<4", "4-8", "8-12", ">12"]),
    kmband: band(k.km_ved_kjop, [60_000, 120_000, 180_000], ["<60k", "60-120k", "120-180k", ">180k"]),
    km_siden_kjop: kmSiden,
    mnd_siden_kjop: mnd,
    km_per_mnd: kmPerMnd,
    svakhet_sak: kmSiden > 20_000 || kmSiden / mnd > 1_500 ? "km" : null,
    selger_motbevis: s.del6_kontakt_med_selger.selger_la_frem_dokumentasjon === "ja",
    forlik: s.del6_kontakt_med_selger.avtale_inngatt === "ja",
    onsket_losning: onsket,
    heving_tillatt_i_praksis: onsket === "heving",
  };
  const forbehold = s.del2_selger.som_den_er_i_kontrakt;
  return {
    ...profil,
    kjopsdato: k.kjopsdato,
    pris_kr: k.pris_kr,
    km_ved_kjop: k.km_ved_kjop,
    uten_forbehold: forbehold === "nei" ? true : forbehold === "ja" ? false : null,
    dato_forste_gang: s.del6_kontakt_med_selger.dato_forste_gang,
    forlik_feil: s.del6_kontakt_med_selger.avtale_inngatt === "ja" ? s.del6_kontakt_med_selger.avtale_gjelder_feil : [],
  };
}

// The form uses pass 2's categories (docs/skjema.md), so § 5.2's mapping is gone.
const SLITEDELER = ["bremser", "dekk_felger", "drivlinje"];

// Track A may fall back to these groups when its own category has no decision, never across them.
// B falls back to NAERMESTE, C never leaves the category (kategoritrinn).
const OPPLYSNINGSGRUPPER = [
  ["utstyr_mangler", "elektrisk", "klimaanlegg", "dekk_felger", "karosseri_lakk_glass", "interior_lukt"],
  ["motor", "girkasse", "clutch", "drivlinje", "bremser", "understell_hjuloppheng", "rust", "fukt_lekkasje", "eksos_utslipp", "batteri_elbil"],
  ["servicehistorikk", "km_avvik", "kollisjonsskade", "bruktimport_opplysning", "arsmodell_identitet"],
  ["heftelse_pant", "eu_kontroll_registrering"],
];
export const sammeGruppe = (a: string, b: string) => a === b || OPPLYSNINGSGRUPPER.some((g) => g.includes(a) && g.includes(b));
// The rest of the category's group, for track A's second query.
export const gruppenUtenom = (kategori: string): string[] => (OPPLYSNINGSGRUPPER.find((g) => g.includes(kategori)) ?? []).filter((k) => k !== kategori);

// The nearest kinds of defect on track B, nearest first. On B the presumption carries the case and it
// is not specific to the kind of defect, so a neighbouring category is defensible as long as «sterkere
// enn» and the wear-part rule hold. Not on C: there the point is that the defect is documented beyond
// what is to be expected for this kind of defect, and that has no neighbour (decided 2026-10-10).
const NAERMESTE: Record<string, string[]> = {
  motor: ["girkasse", "clutch", "drivlinje", "eksos_utslipp", "batteri_elbil"],
  girkasse: ["clutch", "drivlinje", "motor"],
  clutch: ["girkasse", "drivlinje", "motor"],
  drivlinje: ["girkasse", "clutch", "understell_hjuloppheng", "motor"],
  bremser: ["understell_hjuloppheng", "dekk_felger"],
  understell_hjuloppheng: ["bremser", "ramme_chassis", "drivlinje", "dekk_felger"],
  dekk_felger: ["understell_hjuloppheng", "bremser"],
  rust: ["ramme_chassis", "karosseri_lakk_glass", "fukt_lekkasje"],
  ramme_chassis: ["rust", "understell_hjuloppheng", "kollisjonsskade"],
  karosseri_lakk_glass: ["rust", "kollisjonsskade", "fukt_lekkasje"],
  fukt_lekkasje: ["karosseri_lakk_glass", "rust", "interior_lukt"],
  interior_lukt: ["fukt_lekkasje", "karosseri_lakk_glass"],
  elektrisk: ["batteri_elbil", "klimaanlegg", "utstyr_mangler"],
  batteri_elbil: ["elektrisk", "motor", "klimaanlegg"],
  klimaanlegg: ["elektrisk", "motor"],
  eksos_utslipp: ["motor"],
  utstyr_mangler: ["elektrisk", "interior_lukt"],
  kollisjonsskade: ["karosseri_lakk_glass", "ramme_chassis"],
};

// The categories to fetch, step by step, per track (decided 2026-10-10):
//   A: the category, then its information group (the comparison is about the statement);
//   B: the category, then NAERMESTE;
//   C: the category only.
// There is no step beyond: a case without a decision there stands on the law and the report.
export function kategoritrinn(kategori: string, spor: Spor): string[][] {
  if (spor === "A") return [[kategori], gruppenUtenom(kategori)];
  if (spor === "B") return [[kategori], NAERMESTE[kategori] ?? []];
  return [[kategori]];
}

// 0 for the same category, 1 … for the next step's categories in order, 99 for anything else (never fetched).
export function kategoriavstand(fra: string, til: string, spor: Spor): number {
  if (fra === til) return 0;
  const naer = kategoritrinn(fra, spor)[1] ?? [];
  const i = naer.indexOf(til);
  return i === -1 ? 99 : 1 + (spor === "A" ? 0 : i);
}

// The same rule for the user and for a decided defect, so a wear part is only compared with a wear part.
export function erSlitedel(kategori: string, alder: number | null, km: number | null): boolean {
  return SLITEDELER.includes(kategori) || (["motor", "girkasse", "clutch"].includes(kategori) && (alder ?? 0) >= 8 && (km ?? 0) >= 120_000);
}
const TAUSHET_KATEGORIER = ["kollisjonsskade", "servicehistorikk", "km_avvik", "bruktimport_opplysning", "arsmodell_identitet"];
export { erSpesifikk };

export function avledFeil(sak: Sak, f: SkjemaFeil): FeilProfil {
  const kategori = f.kategori;
  const dager = dagerMellom(sak.kjopsdato, f.dato_oppdaget);
  const innenFrist = dager <= sak.formodningsfrist_dager;
  const slitedel = erSlitedel(kategori, sak.alder_ved_kjop, sak.km_ved_kjop);

  const avskrift = f.avskrift_selger?.trim() ?? "";
  const skriftlig = f.selger_sa_noe === "ja_skriftlig" && avskrift !== "";
  const former = [...new Set(f.hvor_sto_det.map((h) => HVOR_STO_DET[h]).filter(Boolean))].sort((a, b) => FORM_RANG[b] - FORM_RANG[a]);
  const r = f.verksted_sett_pa === "ja_skriftlig" ? f.rapport_sier : null;
  const rapportOk = r?.hva === "ja";
  const rapportLevering = r?.var_der_ved_overtakelse === "ja";
  const rapportParegnelig = r?.mer_enn_normal_slitasje === "ja";

  // § 5.4: A → C → B; the first that holds is primary, the next secondary. A general phrase about the
  // whole car gives no A (docs/spor.md).
  const aUttalelse = skriftlig && erSpesifikk(avskrift);
  const aTaushet = !skriftlig && f.selger_sa_noe === "nei" && TAUSHET_KATEGORIER.includes(kategori);
  const c = rapportParegnelig && rapportLevering;
  // A wear part may still go on B; the criterion ikke_slitedel then only lets a B decision on the same
  // wear part through (57255 dekk, 77134 bremser). Outside the period only C.
  const b = innenFrist && rapportOk;
  const spor: Spor[] = [];
  if (aUttalelse || aTaushet) spor.push("A");
  if (c) spor.push("C");
  if (b) spor.push("B");

  // Without a track the report is missing, or the defect showed itself after the period and the report
  // does not carry C; inside the period a report always gives B.
  const arsak: IngenSporArsak | null = spor.length ? null : f.selger_sa_noe === "ja_muntlig" ? "muntlig_opplysning" : !rapportOk ? "rapport_mangler" : "utenfor_frist";

  const reklamasjon = sak.dato_forste_gang ? dagerMellom(f.dato_oppdaget, sak.dato_forste_gang) : null;
  return {
    feil_id: f.id,
    kategori_skjema: f.kategori,
    kategori_pass2: kategori,
    dager_til_feil: dager,
    innen_frist: innenFrist,
    slitedel,
    spor_primar: spor[0] ?? null,
    a_variant: aUttalelse ? "uttalelse" : aTaushet ? "taushet" : null,
    spor_sekundar: spor[1] ?? null,
    spor_alle: spor,
    ingen_spor_arsak: arsak,
    har_skriftlig_opplysning: skriftlig,
    a_former: former,
    a_form: former[0] ?? null,
    a_spesifikk: erSpesifikk(avskrift),
    avskrift_selger: skriftlig ? avskrift : null,
    avskrift_verksted: r ? (f.avskrift_verksted?.trim() || null) : null,
    // Asked, not inferred: a message is not necessarily an answer to the buyer's question.
    a_direkte: f.hvor_sto_det.includes("sms_epost_chat") && f.svar_pa_direkte_sporsmal,
    rapport_ok: rapportOk,
    rapport_arsak: r?.hvorfor === "ja",
    rapport_levering: rapportLevering,
    rapport_paregnelig: rapportParegnelig,
    alvor: f.kan_bilen_brukes === "nei" || f.kan_bilen_brukes === "ja_begrenset",
    kan_bilen_brukes: f.kan_bilen_brukes,
    kostnad_kr: f.kostnad_kr,
    kostnad_over_pris_bekreftet: f.kostnad_over_pris_bekreftet,
    // The first contact may predate this defect (it concerned another one): then we do not know.
    dager_til_reklamasjon: reklamasjon != null && reklamasjon >= 0 ? reklamasjon : null,
    forlik: sak.forlik_feil.includes(f.id),
  };
}
