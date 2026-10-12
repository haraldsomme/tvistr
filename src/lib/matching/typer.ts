import type { AvledetFeil, Tidsniva } from "@/lib/feilvurdering/skjema";

export type Krav = "retting" | "prisavslag" | "heving";

// One defect category the buyer chose, with the answers given for it. `opplysning`: the seller said
// or wrote something about the defect before the sale. `verksted`: a workshop has examined it.
export type Kategorisvar = { hoved: string; under: string[]; niva: Tidsniva; opplysning: boolean | null; verksted: boolean | null };

export type Brukersak = {
  kategorier: Kategorisvar[];
  km: number | null;
  alder: number | null;
  somDenEr: boolean | null;
  krav: Krav | null;
  forsok: number | null;
};

// A decision with medhold as the ranking needs it; `feil` holds every assessed defect, also the
// rejected ones.
export type Kandidat = {
  id: number;
  saksnummer: string | null;
  vedtaksdato: string | null;
  km: number | null;
  alder: number | null;
  somDenEr: boolean | null;
  sanksjoner: string[] | null;
  mangelsgrunnlag: string[] | null;
  paragrafer: string[] | null;
  tvistetema: string[] | null;
  feil: AvledetFeil[];
};
