// Types for the comparison engine (docs/sammenligningsmotor.md): the user's form in, the chosen
// decision and the finished practice paragraph out. No LLM anywhere in the engine.
import type { Sanksjon as AnalyseSanksjon } from "@/lib/analyse/avled";
import type { Spor } from "@/lib/analyse/skjema";
import type { VerifisertBegrunnelse, VerifisertBevis, VerifisertOpplysning } from "@/lib/analyse/verifiser";

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
  har_skriftlig_opplysning: boolean;
  a_former: string[];
  a_form: string | null;
  a_spesifikk: boolean;
  avskrift_selger: string | null; // what the seller wrote, as the buyer copied it (identical-statement ranking)
  avskrift_verksted: string | null; // what the workshop wrote, as the buyer copied it (the general paragraph)
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
  antall_mangler: number; // defects in the decision found to be defects
  sanksjon: Sanksjon;
  selger_bevis_finnes: boolean;
  forbehold: string[];
  forbehold_frase: "som den er" | "som den står" | null;
  forste_henvendelse_dato: string | null;
  start_dato: string | null; // overtakelsesdato, else kjopsdato
  antall_feil: number;
  opplysninger: VerifisertOpplysning[];
  bevis: VerifisertBevis[];
  // neste_tegn: the three characters after the quote in the full text (null when not found verbatim).
  begrunnelse_sitater: Array<VerifisertBegrunnelse & { neste_tegn?: string | null }>;
};

export type Utfall = "sterkere" | "lik" | "svakere" | "utelat";
export type Kriterium = { navn: string; bruker: unknown; vedtak: unknown; utfall: Utfall; krav: boolean; adresserbar: boolean };

export type Sitat = { tema: string; tekst: string };

export type Vurdert = {
  vedtak: VedtakFeil;
  opplysning: VerifisertOpplysning | null; // the statement or silence the paragraph cites (track A)
  kriterier: Kriterium[];
  antall_sterkere: number;
  svakhet: Kriterium | null;
};

export type Forkastet = { saksnummer: string; grunn: string };

export type KandidatRef = {
  vedtak_id: number;
  saksnummer: string;
  vedtaksdato: string;
  kilde_url: string;
  feil_id: string;
  kategori: string;
  spor_vunnet: Spor[];
  a_variant: string | null;
  lovversjon: string;
  sanksjon: Sanksjon;
  tilkjent_totalt_nok: number | null;
  opplysning: { form: string | null; rekkevidde: string | null; ordlyd: string | null; svar_pa_direkte_sporsmal: boolean } | null;
  forbehold: boolean;
  dager_etter_levering: number | null;
  selger_bevis_finnes: boolean;
};

// The nearest won decision for a defect that got none: what it had that the user lacks (criterion
// names, plus rapport_ok when B needs written documentation). For the strength assessment and the
// report order, never for the letter.
export type Naermeste = {
  saksnummer: string;
  vedtaksdato: string;
  kilde_url: string;
  kategori: string;
  spor: Spor;
  sanksjon: Sanksjon;
  tilkjent_totalt_nok: number | null;
  mangler: string[];
};

// A lost decision in the same category and track whose profile is at least as good as the user's
// (the qualitative criteria; days, age, km and price are the «similar facts»). It lowers the strength
// to «middels»; the paragraph stays.
export type Motstridende = { saksnummer: string; vedtaksdato: string; kilde_url: string; grunn: string | null; skilte: string[] };

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
  // For the letter engine's assessment of how serious the defect is.
  kan_bilen_brukes: SkjemaFeil["kan_bilen_brukes"];
  alvor: boolean;
  // false when sak.svakhet_sak = "km" but the paragraph could not answer it: the letter engine
  // takes it up only if the seller has raised the mileage.
  km_svakhet_i_avsnitt: boolean;
  kandidat: KandidatRef | null;
  kandidat_spor: Spor | null;
  // The decision concerns another kind of defect: the category had none (avled.ts kategoritrinn).
  kategori_tilbakefall: boolean;
  kriterier: Array<{ navn: string; bruker: unknown; vedtak: unknown; utfall: Utfall }>;
  antall_sterkere: number;
  svakhet_adressert: string | null;
  godkjent: boolean;
  sitat: Sitat | null;
  argumenter: string[];
  avsnitt: string | null;
  forkastede: Forkastet[];
  // The case, not the corpus (index.ts styrke): svak without a track; sterk with a won decision in the
  // category and no contradicting loss; middels otherwise, or svak when a track has no decision and a
  // similar case was lost. null: settled (forlik), so not claimed and not matched.
  styrke: "sterk" | "middels" | "svak" | null;
  // What the letter can cite: a won decision, a general paragraph on the rule (no single case), or
  // nothing. Shown under the strength as an explanation («uten praksis»), never as the strength.
  praksis: "vedtak" | "generell" | "ingen" | null;
  motstridende: Motstridende | null;
  naermeste: Naermeste | null;
  // Covered by the settlement: not claimed in the letter.
  forlik: boolean;
  // A flag for the letter engine, not a stop: whether the time was reasonable is not ours to decide (fkjl § 27).
  reklamasjon_over_to_mnd: boolean | null;
};

export type Resultat = {
  stopp: "privat_selger" | null;
  sak: SakProfil;
  feil: FeilResultat[];
  valgt_til_brev: string[];
  // Said once, after the last practice paragraph, when a cited decision predates the 2024 amendment.
  lovendring: string | null;
  ingen_treff: Array<{ feil_id: string; siste_stopp: string }>;
};

// Fetches won defects for one track. Injected so the tests can run without a database.
// `kategorier` is what may be fetched, nearest first (one step of avled.ts kategoritrinn). `tapte`
// fetches lost defects on the track instead of won ones.
// `nyeste` orders by decision date alone (the general paragraph's examples), not by category first.
export type HentKandidater = (q: {
  spor: Spor;
  a_variant: AVariant | null;
  kategori: string;
  kategorier: string[];
  heving_tillatt: boolean;
  tapte?: boolean;
  nyeste?: boolean;
}) => Promise<VedtakFeil[]>;
