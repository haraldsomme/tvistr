// The practice paragraph (docs/praksis.md): a model chooses one decision among the filter's candidates
// and writes the paragraph with a verbatim belegg for every sentence about the decision; the verifier
// keeps only what the full text supports.
import type { Forbruk } from "@/lib/ai/klient";

// spesifikk: the filter's candidates, one is cited and compared. generell: the jurist's example decisions
// for the track, the rule is described without comparison (src/lib/praksis/fast.ts).
export type Modus = "spesifikk" | "generell";

export type Belegg = { vedtak_id: number; sitat: string };

// Ledd: 1 what the committee found, 2 the decision's facts (generell: the buyer's facts), 4 the outcome,
// 5 the comparison. The quote (ledd 3) is its own field.
export type Setning = { ledd: number; om: "vedtak" | "min_sak" | "begge"; tekst: string; belegg: Belegg | null };

// The verified quotes the model may use as belegg, as it saw them in the analysis; those from the
// committee's own reasoning (ledd 1 and the quote) separately.
export type Kilder = { alle: string[]; vurdering: string[] };

// What the model returns (the tool's input).
export type PraksisSvar = {
  valgt_vedtak_id: number | null;
  eksempel_vedtak_ids: number[];
  grunn_ingen: string | null;
  begrunnelse: string;
  sitat: { vedtak_id: number; tekst: string } | null;
  setninger: Setning[];
};

export type StrykRegel = "ledd" | "belegg" | "vurderingsdel" | "plassholder" | "dato" | "tall" | "paragraf" | "ord" | "like_sterkt" | "sammenligning" | "personopplysning";
export type Strykning = { tekst: string; regel: StrykRegel; detalj: string };

export type Verifisert = {
  modus: Modus;
  avsnitt: string | null;
  vedtak_id: number | null; // spesifikk: the cited decision
  eksempel_vedtak_ids: number[]; // generell: the examples the paragraph names
  grunn: string | null; // why there is no paragraph
  strykninger: Strykning[];
};

// feil: the model call itself failed (not a verifier verdict).
export type Praksis = Verifisert & { raa: PraksisSvar | null; versjon: string; modell: string | null; forbruk: Forbruk | null; feil?: boolean };

// What pass 1 and pass 2 extracted from a decision: what the model reads instead of the full text. The
// quotes in it were checked against the full text at import; the rest is the analysis's own summary.
export type Analyse = {
  sammendrag: string | null;
  utvalgets_nokkelmomenter: string[];
  forbehold_tekst: string | null;
  tilkjent_prisavslag_nok: number | null;
  tilkjent_erstatning_nok: number | null;
  sitater: Record<string, string> | null; // pass 1: field → quote
  kontroll_arsaker: string[]; // pass 1 flags a quote it could not find verbatim here, without removing it
  feil: Array<Record<string, unknown> & { id: string }>; // pass 2: every defect the decision assessed
  begrunnelse_sitater: Array<{ tema: string; tekst: string; gjelder_feil: string[] }>;
};
export type HentAnalyse = (ider: number[]) => Promise<Map<number, Analyse>>;
