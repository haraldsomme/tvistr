// What the agents answer per decision (instruks.md), and the fixed vocabularies. The agents state
// facts from the decision; avled.ts draws the conclusions, so a changed definition needs a
// re-import, not a new agent run. Bump the version when the instruction or the answer changes.
export const FEILVURDERING_VERSJON = "feilvurdering-v6";

export const UTFALL = ["medhold", "avvist", "ikke_vurdert"] as const;
export const AVSLAGSGRUNNER = [
  "paregnelig_slitasje",
  "ikke_sannsynliggjort_ved_levering",
  "ikke_dokumentert",
  "kjent_eller_opplyst",
  "synlig_ved_besiktigelse",
  "forbehold",
  "reklamert_for_sent",
  "oppstatt_etter_levering",
  "utbedret_av_selger",
  "avgjort_etter_avtale",
  "dekket_av_garanti",
  "annet",
] as const;
export const BEVISGRUNNLAG = ["formodning_ikke_motbevist", "sakkyndig_dokumentasjon", "selgers_opplysning", "erkjent_av_selger", "uomtvistet", "utvalgets_skjonn"] as const;
export const SANKSJONER = ["heving", "prisavslag", "erstatning", "retting", "omlevering"] as const;
// When the defect showed itself after delivery. The boundaries are the presumption periods
// (6 months before 2024, 2 years after) and «near the deadline» (22 months).
export const VISTE_SEG = ["innen_6_mnd", "6_til_22_mnd", "22_til_24_mnd", "over_24_mnd", "ukjent"] as const;
export const FORMODNING = ["anvendt", "avkreftet", "etter_fristen", "ikke_nevnt"] as const;
// A claim that is not a defect in the car (a dirty car, a fall in value, late delivery, a trade-in).
export const UTENFOR = "utenfor";

export type Utfall = (typeof UTFALL)[number];
export type Avslagsgrunn = (typeof AVSLAGSGRUNNER)[number];
export type Bevisgrunnlag = (typeof BEVISGRUNNLAG)[number];
export type Sanksjon = (typeof SANKSJONER)[number];
export type VisteSeg = (typeof VISTE_SEG)[number];
export type Formodning = (typeof FORMODNING)[number];

export type Feil = {
  id: string;
  hovedkategori: string;
  underkategori: string | null;
  komponent: string | null;
  utfall: Utfall;
  samlet: boolean;
  avslagsgrunn: Avslagsgrunn | null;
  bevisgrunnlag: Bevisgrunnlag | null;
  dager_etter_levering: number | null;
  viste_seg: VisteSeg;
  formodning: Formodning;
  sitat: string | null;
};

// 1 within the presumption period, 2 after it but within the complaint deadline, 3 near or past
// the deadline (22 months or more). null when it cannot be told. Derived at import (avled.ts).
export type Tidsniva = 1 | 2 | 3;
export type AvledetFeil = Feil & { tidsniva: Tidsniva | null };
export type Lagret = Omit<Svar, "feil"> & { feil: AvledetFeil[] };

export type Svar = {
  vedtak_id: number;
  feil: Feil[];
  sanksjoner: Sanksjon[];
  rettingsforsok: number | null;
  // The contract or advert had «som den er» or a similar general disclaimer, unless the committee found it was not agreed.
  som_den_er: boolean;
  usikkerhet: string | null;
};
