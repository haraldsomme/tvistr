// Types for the comparison engine (docs/sammenligningsmotor.md): the user's form in, per defect the
// strength and up to five won decisions in the same category the case is at least as strong as. A filter:
// no text, no LLM. The practice paragraph is written from these candidates in src/lib/praksis.
import type { Sanksjon as AnalyseSanksjon } from "@/lib/analyse/avled";
import type { Spor } from "@/lib/analyse/skjema";
import type { VerifisertBevis, VerifisertOpplysning } from "@/lib/analyse/verifiser";

export type { Spor };
export type AVariant = "uttalelse" | "taushet";
export type Lov = "før_2024" | "etter_2024";
// The form's JSON (docs/skjema.md) is defined next to its validation.
export type { Skjema, SkjemaFeil } from "@/lib/skjema/skjema";
import type { SkjemaFeil } from "@/lib/skjema/skjema";

// Shown in the output as `sak` (fields named as in forventet_output_enyaq.json).
export type SakProfil = {
  lov: Lov;
  formodningsfrist_dager: number;
  alder_ved_kjop: number;
  prisband: string;
  aldersband: string;
  kmband: string;
  km_siden_kjop: number;
  mnd_siden_kjop: number;
  km_per_mnd: number;
  svakhet_sak: "km" | null;
  selger_motbevis: boolean;
  forlik: boolean;
  onsket_losning: string;
  heving_tillatt_i_praksis: boolean;
};

// SakProfil plus the raw answers the criteria compare against.
export type Sak = SakProfil & {
  kjopsdato: string;
  pris_kr: number;
  km_ved_kjop: number;
  // null when the buyer does not know whether the contract said "som den er".
  uten_forbehold: boolean | null;
  dato_forste_gang: string | null;
  // When the defect is complained of: the first contact, or today when the letter is the complaint.
  reklamasjonsdato: string;
  // The defects a settlement covers (avtale_gjelder_feil); the rest are claimed as before.
  forlik_feil: string[];
};

export type IngenSporArsak = "muntlig_opplysning" | "rapport_mangler" | "utenfor_frist";

export type FeilProfil = {
  feil_id: string;
  kategori_skjema: string;
  kategori_pass2: string;
  dager_til_feil: number;
  innen_frist: boolean;
  slitedel: boolean;
  spor_primar: Spor | null;
  a_variant: AVariant | null;
  spor_sekundar: Spor | null;
  spor_alle: Spor[];
  ingen_spor_arsak: IngenSporArsak | null;
  // Not shown; used by the criteria.
  a_form: string | null;
  a_spesifikk: boolean;
  // What the seller and the workshop wrote, as the buyer copied it (for the practice paragraph).
  avskrift_selger: string | null;
  avskrift_verksted: string | null;
  a_direkte: boolean;
  rapport_ok: boolean; // 16a: the report names the faulty part
  rapport_arsak: boolean; // 16a2: and says why it failed
  rapport_levering: boolean;
  rapport_paregnelig: boolean;
  alvor: boolean;
  kan_bilen_brukes: SkjemaFeil["kan_bilen_brukes"];
  kostnad_kr: number | null;
  kostnad_over_pris_bekreftet: boolean;
  dager_til_reklamasjon: number | null;
  forlik: boolean;
};

export type Sanksjon = AnalyseSanksjon | null;

// One won defect in one decision, with what the comparison needs from vedtak and vedtak_analyse.
export type VedtakFeil = {
  vedtak_id: number;
  feil_id: string;
  spor: Spor; // the track this row was fetched for
  saksnummer: string;
  vedtaksdato: string;
  kilde_url: string;
  utfall: string;
  grunn: string | null; // why a lost defect was lost (pass 2), null when won
  selger_type: string; // forhandler or formidling
  kategori: string;
  komponenter: string[];
  grunnlag: string | null;
  spor_vunnet: Spor[];
  a_variant: string | null;
  alvor: string[];
  dager_etter_levering: number | null;
  // "bevisdato" when the day count is the date of a document that records the defect: an upper bound
  // («påvist senest»), not when the defect showed itself. "vedtak" when the decision gives the time.
  viste_seg_kilde: "vedtak" | "bevisdato" | null;
  lovversjon: string;
  alder_ved_kjop: number | null;
  km_ved_kjop: number | null;
  kjopesum_nok: number | null;
  utbedringskostnad_nok: number | null;
  tilkjent_totalt_nok: number | null;
  belop_tilkjent_nok: number | null; // tied to this defect by the decision
  sanksjon: Sanksjon;
  selger_bevis_finnes: boolean;
  forbehold: string[];
  forste_henvendelse_dato: string | null;
  start_dato: string | null; // overtakelsesdato, else kjopsdato
  antall_feil: number;
  opplysninger: VerifisertOpplysning[];
  bevis: VerifisertBevis[];
};

export type Utfall = "sterkere" | "lik" | "svakere" | "utelat";
export type Kriterium = { navn: string; bruker: unknown; vedtak: unknown; utfall: Utfall; krav: boolean; adresserbar: boolean };

export type Vurdert = {
  vedtak: VedtakFeil;
  kriterier: Kriterium[];
  antall_sterkere: number;
  svakhet: Kriterium | null; // the one addressable weakness, if any
};

export type Forkastet = { saksnummer: string; grunn: string };

// An approved candidate as the result shows it.
export type KandidatRef = {
  vedtak_id: number;
  feil_id: string; // the decision's defect
  saksnummer: string;
  vedtaksdato: string;
  kilde_url: string;
  spor: Spor; // the track it was fetched and approved on
  lovversjon: string;
  sanksjon: Sanksjon;
  kriterier: Array<{ navn: string; bruker: unknown; vedtak: unknown; utfall: Utfall }>;
  antall_sterkere: number;
  svakhet: string | null;
};

// Lost decisions in the same category on the primary track: information for the report order, never
// the strength and never the letter.
export type Tapte = {
  fordeling: Record<string, number>; // grunn → count
  nyeste: Array<{ saksnummer: string; vedtaksdato: string; kilde_url: string; grunn: string | null }>;
};

export type StyrkeGrunn = "ingen_spor" | "ingen_vedtak" | "reklamert_sent";

export type FeilResultat = {
  feil_id: string;
  kategori_skjema: string;
  kategori_pass2: string;
  dager_til_feil: number;
  innen_frist: boolean;
  slitedel: boolean;
  spor_primar: Spor | null;
  a_variant: AVariant | null;
  spor_sekundar: Spor | null;
  spor_alle: Spor[];
  ingen_spor_arsak: IngenSporArsak | null;
  kan_bilen_brukes: SkjemaFeil["kan_bilen_brukes"];
  alvor: boolean;
  // 0–5, best first: primary track before secondary, same category only.
  kandidater: KandidatRef[];
  forkastede: Forkastet[];
  // svak without a track; middels with a track but no decision, or a late complaint (fkjl § 27);
  // sterk with a decision. null: settled (forlik), so not claimed and not matched.
  styrke: "sterk" | "middels" | "svak" | null;
  // Why it is not sterk; null when it is (or settled).
  styrke_grunn: StyrkeGrunn | null;
  tapte: Tapte | null;
  // Covered by the settlement: not claimed in the letter.
  forlik: boolean;
  // More than two months from discovery to the first complaint (fkjl § 27): at most middels.
  reklamasjon_over_to_mnd: boolean | null;
};

export type Resultat = {
  stopp: "privat_selger" | null;
  sak: SakProfil;
  feil: FeilResultat[];
  // At most two defects with a decision, for the practice paragraph.
  valgt_til_brev: string[];
  ingen_treff: Array<{ feil_id: string; siste_stopp: string }>;
};

// Fetches won defects in one category on one track (or lost ones with `tapte`). Injected so the tests
// can run without a database.
export type HentKandidater = (q: { spor: Spor; a_variant: AVariant | null; kategori: string; heving_tillatt: boolean; tapte?: boolean }) => Promise<VedtakFeil[]>;
