// What the agents answer per decision (instruks.md): for each defect the committee accepted, what
// the committee rested that conclusion on. It is read when the letter cites the decision
// (src/lib/vedtaksvalg), so the model need not read the full text. The defect ids are the
// feilvurdering's. Bump the version when the instruction or the answer changes.
import { SANKSJONER, type Sanksjon } from "@/lib/feilvurdering/skjema";
import { RETTSLIGE_POENG, type RettsligPoeng } from "@/lib/matching/rett";

export const AVGJORENDE_VERSJON = "avgjorende-v5";

// The legal points a decision can be cited for (src/lib/matching/rett.ts).
export const POENG = RETTSLIGE_POENG.map((p) => p.id);
export const FORBEHOLD = ["som_den_er", "garanti", "begge", "ingen", "ukjent"] as const;
export const LOVVERSJON = ["for_2024", "etter_2024", "ukjent"] as const;
export type Forbehold = (typeof FORBEHOLD)[number];
export type Lovversjon = (typeof LOVVERSJON)[number];

// What the committee relied on to find it.
export const BEVIS = [
  "sakkyndig",
  "verksted",
  "eu_kontroll",
  "annonse_kontrakt",
  "forhistorie_for_salget",
  "formodning",
  "selgers_erkjennelse",
  "klagers_forklaring",
  "utvalgets_skjonn",
] as const;
export { SANKSJONER };

export type Bevis = (typeof BEVIS)[number];

// Fields marked «v4» are missing in answers from earlier versions; read them as not known.
export type AvgjorendeFeil = {
  // The feilvurdering's id for the defect.
  id: string;
  // v4: the committee's assessment names this defect.
  nevnt_i_vurderingen?: boolean;
  // v4: the committee found it a defect on its own, not only together with others.
  vurdert_for_seg?: boolean;
  // In the agent's own words, 1–2 sentences: what the committee rested the conclusion on.
  avgjorende: string;
  // The provisions the committee concluded with for this defect, as written in its assessment.
  hjemmel: string[];
  bevis: Bevis[];
  // Other accepted defects it was judged together with.
  samlet_med: string[];
  under_tvil: boolean;
  // What the committee granted because of this defect. From v4 only what it granted for this defect
  // alone: empty when it granted something only for the defects together.
  sanksjoner: Sanksjon[];
  // 1–3 whole sentences of the committee's reasoning for this defect, word for word; checked
  // against its assessment (part III).
  sitater: string[];
};

export type Svar = {
  vedtak_id: number;
  // The seller answered the complaint. False when the decision was made on the buyer's account alone.
  selger_svarte: boolean | null;
  // v4: the car as the decision names it (make, model, model year), checked against the full text.
  bil?: string | null;
  // v4: a disclaimer or warranty the committee's assessment points to.
  forbehold?: Forbehold;
  // v4: the version of the consumer purchase act the committee applied.
  lovversjon_brukt?: Lovversjon;
  // v4: for each legal point the committee settled in the buyer's favour, the sentence that says it.
  rettslige_sitater?: { poeng: RettsligPoeng; sitat: string }[];
  feil: AvgjorendeFeil[];
};

// Stored per decision: the answer, and what the import derives from the full text.
export type Lagret = Omit<Svar, "vedtak_id"> & {
  // The date in the signature at the end of the decision; null when it cannot be read.
  signaturdato?: string | null;
};
