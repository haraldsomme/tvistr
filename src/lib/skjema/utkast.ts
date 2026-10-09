// The form's working state while the buyer fills it in, and the step from it to the finished JSON.
// Everything the buyer types is a string here; byggSkjema turns it into the closed lists and whole
// numbers of docs/skjema.md and clears what a hidden question would have held, so the JSON always
// has every field (null when not asked) and validerSkjema can check it as a whole.
import { type BrregTreff, type Kategori, MAKS_FEIL, RAPPORT_TOM, type RapportSier, type Skjema, SKJEMA_VERSJON, type SkjemaFeil, stubb } from "./skjema";

export const STUBB_FEIL = "Feilen er at";
export const STUBB_VERKSTED = "Verkstedet skriver at";
export const STUBB_AVTALE = "Avtalen går ut på at";

export type FeilUtkast = {
  kategori: string;
  en_setning: string;
  dato_oppdaget: string;
  kan_bilen_brukes: string;
  selger_sa_noe: string;
  hvor_sto_det: string[];
  avskrift_selger: string;
  svar_pa_direkte_sporsmal: string; // "ja" | "nei" | ""
  verksted_sett_pa: string;
  verksted_navn_dato: string;
  rapport_sier: Record<keyof RapportSier, string>;
  kostnad_kr: string;
  avskrift_verksted: string;
};

export type Utkast = {
  selgertype: string;
  kjopsdato: string;
  pris_kr: string;
  km_ved_kjop: string;
  aarsmodell: string;
  merke_modell: string;
  firmanavn: string;
  treff: BrregTreff | null;
  treff_bekreftet: boolean;
  som_den_er: string;
  feil: FeilUtkast[];
  km_na: string;
  tatt_opp: string;
  dato_forste_gang: string;
  selgers_svar: string;
  avtale_inngatt: string;
  avtale_beskrivelse: string;
  avtale_gjelder_feil: string[]; // "F1", "F2" …
  selger_la_frem: string;
  selger_dokumentasjon: string;
  onsket_losning: string;
  navn: string;
  adresse: string;
  epost: string;
  bekreft_riktig: boolean;
  bekreft_ikke_radgivning: boolean;
};

export const tomFeil = (): FeilUtkast => ({
  kategori: "",
  en_setning: "",
  dato_oppdaget: "",
  kan_bilen_brukes: "",
  selger_sa_noe: "",
  hvor_sto_det: [],
  avskrift_selger: "",
  svar_pa_direkte_sporsmal: "",
  verksted_sett_pa: "",
  verksted_navn_dato: "",
  rapport_sier: { hva: "", hvorfor: "", var_der_ved_overtakelse: "", mer_enn_normal_slitasje: "", kostnad: "" },
  kostnad_kr: "",
  avskrift_verksted: "",
});

export const tomtUtkast = (): Utkast => ({
  selgertype: "",
  kjopsdato: "",
  pris_kr: "",
  km_ved_kjop: "",
  aarsmodell: "",
  merke_modell: "",
  firmanavn: "",
  treff: null,
  treff_bekreftet: false,
  som_den_er: "",
  feil: [tomFeil()],
  km_na: "",
  tatt_opp: "",
  dato_forste_gang: "",
  selgers_svar: "",
  avtale_inngatt: "",
  avtale_beskrivelse: "",
  avtale_gjelder_feil: [],
  selger_la_frem: "",
  selger_dokumentasjon: "",
  onsket_losning: "",
  navn: "",
  adresse: "",
  epost: "",
  bekreft_riktig: false,
  bekreft_ikke_radgivning: false,
});

// Removing a defect renumbers the ones after it, and the agreement's choice follows the defects.
export function fjernFeil(u: Utkast, i: number): Partial<Utkast> {
  const nr = (id: string) => Number(id.slice(1)) - 1;
  return {
    feil: u.feil.filter((_, j) => j !== i),
    avtale_gjelder_feil: u.avtale_gjelder_feil.filter((id) => nr(id) !== i).map((id) => (nr(id) > i ? `F${nr(id)}` : id)),
  };
}

// "478 000" or "478.000 kr" → 478000. NaN when there are no digits, so validation catches it.
export const tall = (s: string): number => {
  const siffer = s.replace(/[^\d]/g, "");
  return siffer ? Number(siffer) : NaN;
};
const tekstEllerNull = (s: string) => (s.trim() ? s.trim().replace(/\s+/g, " ") : null);

// Which questions are shown, from the answers given so far (docs/skjema.md § 3).
export const vises = {
  hvorStoDet: (f: FeilUtkast) => f.selger_sa_noe === "ja_skriftlig",
  direkteSporsmal: (f: FeilUtkast) => f.selger_sa_noe === "ja_skriftlig" && f.hvor_sto_det.includes("sms_epost_chat"),
  rapport: (f: FeilUtkast) => f.verksted_sett_pa === "ja_skriftlig",
  kostnad: (f: FeilUtkast) => f.verksted_sett_pa === "ja_skriftlig" && f.rapport_sier.kostnad === "ja",
  kontakt: (u: Utkast) => u.tatt_opp === "ja_muntlig" || u.tatt_opp === "ja_skriftlig",
  avtale: (u: Utkast) => vises.kontakt(u) && (u.selgers_svar === "tilbudt_delvis" || u.selgers_svar === "enige_om_noe"),
  dokumentasjon: (u: Utkast) => vises.kontakt(u) && u.selgers_svar === "avvist",
};

function byggFeil(f: FeilUtkast, i: number): SkjemaFeil {
  const skriftlig = vises.hvorStoDet(f);
  const rapport = vises.rapport(f);
  return {
    id: `F${i + 1}`,
    kategori: f.kategori as Kategori,
    en_setning: stubb(f.en_setning, STUBB_FEIL),
    dato_oppdaget: f.dato_oppdaget,
    kan_bilen_brukes: f.kan_bilen_brukes as SkjemaFeil["kan_bilen_brukes"],
    selger_sa_noe: f.selger_sa_noe as SkjemaFeil["selger_sa_noe"],
    hvor_sto_det: skriftlig ? (f.hvor_sto_det as SkjemaFeil["hvor_sto_det"]) : [],
    avskrift_selger: skriftlig ? (tekstEllerNull(f.avskrift_selger) ?? "") : null,
    svar_pa_direkte_sporsmal: vises.direkteSporsmal(f) && f.svar_pa_direkte_sporsmal === "ja",
    verksted_sett_pa: f.verksted_sett_pa as SkjemaFeil["verksted_sett_pa"],
    verksted_navn_dato: rapport ? (tekstEllerNull(f.verksted_navn_dato) ?? "") : null,
    rapport_sier: rapport ? (f.rapport_sier as RapportSier) : RAPPORT_TOM,
    kostnad_kr: vises.kostnad(f) ? tall(f.kostnad_kr) : null,
    avskrift_verksted: rapport ? stubb(f.avskrift_verksted, STUBB_VERKSTED) : null,
  };
}

export function byggSkjema(u: Utkast, registrert: string): Skjema {
  const kontakt = vises.kontakt(u);
  const avtale = vises.avtale(u) && u.avtale_inngatt === "ja";
  const dokumentasjon = vises.dokumentasjon(u) && u.selger_la_frem === "ja";
  return {
    _meta: { skjema_versjon: SKJEMA_VERSJON, registrert },
    del1_kjopet: {
      selgertype: u.selgertype as Skjema["del1_kjopet"]["selgertype"],
      kjopsdato: u.kjopsdato,
      pris_kr: tall(u.pris_kr),
      km_ved_kjop: tall(u.km_ved_kjop),
      aarsmodell: tall(u.aarsmodell),
      merke_modell_valgfritt: tekstEllerNull(u.merke_modell),
    },
    del2_selger: {
      firmanavn_oppgitt: tekstEllerNull(u.firmanavn),
      bronnoysund_treff: u.treff_bekreftet ? u.treff : null,
      treff_bekreftet: u.treff_bekreftet && u.treff != null,
      som_den_er_i_kontrakt: u.som_den_er as Skjema["del2_selger"]["som_den_er_i_kontrakt"],
    },
    del3_feil: u.feil.slice(0, MAKS_FEIL).map(byggFeil),
    km_na: tall(u.km_na),
    del6_kontakt_med_selger: {
      tatt_opp_med_selger: u.tatt_opp as Skjema["del6_kontakt_med_selger"]["tatt_opp_med_selger"],
      dato_forste_gang: kontakt ? u.dato_forste_gang : null,
      selgers_svar: kontakt ? (u.selgers_svar as Skjema["del6_kontakt_med_selger"]["selgers_svar"]) : null,
      avtale_inngatt: vises.avtale(u) ? (u.avtale_inngatt as "ja" | "nei") : "nei",
      avtale_beskrivelse: avtale ? stubb(u.avtale_beskrivelse, STUBB_AVTALE) : null,
      avtale_gjelder_feil: avtale ? [...u.avtale_gjelder_feil].sort() : [],
      selger_la_frem_dokumentasjon: vises.dokumentasjon(u) ? (u.selger_la_frem as "ja" | "nei") : "nei",
      selger_dokumentasjon_kort: dokumentasjon ? (tekstEllerNull(u.selger_dokumentasjon) ?? "") : null,
    },
    del7_onske_og_kontakt: {
      onsket_losning: u.onsket_losning as Skjema["del7_onske_og_kontakt"]["onsket_losning"],
      kjoper: { navn: u.navn.trim(), adresse: u.adresse.trim().replace(/\s+/g, " "), epost: u.epost.trim() },
    },
    bekreftelser: { opplysningene_er_riktige: u.bekreft_riktig, lest_at_brevet_ikke_er_juridisk_radgivning: u.bekreft_ikke_radgivning },
  };
}

// The date answers are checked against: today in Norway, whatever the server's time zone.
export const idagINorge = (na = new Date()) => na.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
