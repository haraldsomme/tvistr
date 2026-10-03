import type { DRIVSTOFF, FEILTYPER, MANGELSGRUNNLAG } from "@/lib/ai/skjema";

// The engine's input. The form only asks for what the level depends on; registration number,
// dealer, mileage, amounts, the description of the defect and exact dates are optional or left out here and
// will be collected for the letter. All dates are ÅÅÅÅ-MM-DD.

export type Drivstoff = (typeof DRIVSTOFF)[number];
export type Feiltype = (typeof FEILTYPER)[number];
export type Mangelsgrunnlag = (typeof MANGELSGRUNNLAG)[number];
export type FeilKnapp =
  | "motor"
  | "girkasse"
  | "elektrisk"
  | "batteri"
  | "understell"
  | "bremser"
  | "rust"
  | "fukt"
  | "klimaanlegg"
  | "km_service"
  | "skade"
  | "annet";

// The postal address of a dealer found in Brreg: street lines, then postcode and place.
export type Adresse = { linjer: string[]; postnummer: string; poststed: string };
export type Forhandler = { type: "brreg"; orgnr: string; navn: string; adresse?: Adresse } | { type: "fritekst"; navn: string };

// Contact with the dealer so far. nei = not contacted; venter = complained, no answer yet or a repair is under way;
// avvist = the dealer refused; forsokt = the dealer tried to repair without success.
export const KONTAKT_VALG = ["nei", "venter", "avvist", "forsokt"] as const;
export type Kontakt = (typeof KONTAKT_VALG)[number];

// How long after the purchase the defect showed. The buckets are the engine's own cut-offs:
// the presumption periods (6 and 24 months) and the 180/730-day buckets in the decision statistics.
export const OPPDAGET_VALG = ["innen_6_mnd", "6_mnd_til_2_ar", "over_2_ar"] as const;
export type Oppdaget = (typeof OPPDAGET_VALG)[number];

// Did the ad or the dealer say something about the car that turned out to be wrong, and can the
// buyer show what was said (the ad, the contract or messages)?
export const FEILOPPLYSNING_VALG = ["nei", "ja_dokumentert", "ja_udokumentert"] as const;
export type FeilOpplysning = (typeof FEILOPPLYSNING_VALG)[number];

// How long ago the car was bought. The assessment asks for this instead of the exact day: it is
// what the rules turn on (the five-year deadline, and the presumption period, which is two years for
// purchases from 2024). The exact day is asked for on the letter page.
export const KJOPSALDER_VALG = ["under_2", "2_5", "over_5"] as const;
export type Kjopsalder = (typeof KJOPSALDER_VALG)[number];

export type KlageInput = {
  bilOgKjop: {
    // The exact day, when it is known (from the registry or the letter page). ÅÅÅÅ-MM-DD.
    kjopsdato?: string;
    // How long ago it was. Required without `kjopsdato`; with it, the day decides.
    kjopAlder?: Kjopsalder;
    kjopesumNok?: number | null;
    regnr?: string;
    kjoretoy?: { merke: string; modell: string; arsmodell: number; drivstoff: Drivstoff } | null;
    forhandler?: Forhandler;
    kmVedKjop?: number;
  };
  feilen: {
    typer: FeilKnapp[];
    oppdaget: Oppdaget;
    // Only asked for purchases before 2024 (the only place it decides the level); null = not asked.
    opplystForKjop: "ja" | "nei" | null;
    feilOpplysning: FeilOpplysning;
    kontakt: Kontakt;
    // Did the buyer first complain to the dealer within five years of the purchase? Only asked when
    // the purchase is more than five years old and the dealer has been contacted; decides the § 27 deadline.
    reklamertInnenFemAr?: boolean;
    utbedringskostnadNok?: number | null;
  };
  // Only asked when the defect showed outside the presumption period, where the report decides the
  // level. null = not asked; the buyer can answer on the letter page.
  bevis: {
    verkstedrapport: boolean | null;
    // Only asked when a report exists: does it say the defect was probably there before purchase?
    rapportSierForKjop: boolean | null;
    // Not asked in the assessment; answered on the letter page.
    bilder: boolean | null;
  };
};

export type Niva = "god" | "svak";

export type TestKlage = {
  id: number;
  tittel: string;
  forventetNiva: Niva | Niva[];
  merknad: string;
  input: KlageInput;
};
