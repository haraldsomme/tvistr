import type { DRIVSTOFF, FEILTYPER, MANGELSGRUNNLAG } from "@/lib/ai/skjema";

// The engine's input. The form only asks for what the assessment uses; registration number, dealer
// and mileage are optional here and will be collected for the letter. All dates are ÅÅÅÅ-MM-DD.

export type Drivstoff = (typeof DRIVSTOFF)[number];
export type Feiltype = (typeof FEILTYPER)[number];
export type FeilKnapp = "motor" | "girkasse" | "elektrisk" | "rust" | "bremser" | "annet";
export type Mangelsgrunnlag = (typeof MANGELSGRUNNLAG)[number];

export type Forhandler = { type: "brreg"; orgnr: string; navn: string } | { type: "fritekst"; navn: string };

// Contact with the dealer so far. nei = not contacted; venter = complained, no answer yet;
// avvist = the dealer refused; forsokt = the dealer tried to repair without success.
export const KONTAKT_VALG = ["nei", "venter", "avvist", "forsokt"] as const;
export type Kontakt = (typeof KONTAKT_VALG)[number];

// What the buyer would like most. Asked on the result page; it only changes which claim is
// recommended, never the level.
export const ONSKER = ["reparasjon", "pengene_tilbake_beholde", "levere_tilbake"] as const;
export type Onske = (typeof ONSKER)[number];

export type KlageInput = {
  kvalifisering: {
    selgerType: "forhandler" | "privat" | "vet_ikke";
    privatBruk: boolean;
  };
  bilOgKjop: {
    kjopsdato: string;
    kjopesumNok: number;
    regnr?: string;
    kjoretoy?: { merke: string; modell: string; arsmodell: number; drivstoff: Drivstoff } | null;
    forhandler?: Forhandler;
    kmVedKjop?: number;
  };
  feilen: {
    typer: FeilKnapp[];
    beskrivelse: string;
    oppdagetDato: string;
    opplystForKjop: "ja" | "nei" | "usikker";
    kontakt: Kontakt;
    // From the workshop report or a quote; only asked together with the report.
    utbedringskostnadNok: number | null;
  };
  bevis: {
    kjopekontrakt: boolean;
    verkstedrapport: boolean;
    // Only asked when a report exists: does it say the defect was probably there before purchase?
    rapportSierForKjop: boolean | null;
    bilder: boolean;
    korrespondanse: boolean;
    annonse: boolean;
  };
};

export type Niva = "sterk" | "middels" | "svak" | "ikke_aktuell";

export type TestKlage = {
  id: number;
  tittel: string;
  forventetNiva: Niva | Niva[];
  merknad: string;
  input: KlageInput;
};
