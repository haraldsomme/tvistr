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

export type HentFulltekst = (ider: number[]) => Promise<Map<number, string>>;
