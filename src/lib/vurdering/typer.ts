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

export type KlageInput = {
  kvalifisering: {
    selgerType: "forhandler" | "privat" | "vet_ikke";
    privatBruk: boolean;
  };
  bilOgKjop: {
    // The form asks for month and year only, and sends the last day of that month.
    kjopsdato: string;
    kjopesumNok?: number | null;
    regnr?: string;
    kjoretoy?: { merke: string; modell: string; arsmodell: number; drivstoff: Drivstoff } | null;
    forhandler?: Forhandler;
    kmVedKjop?: number;
  };
  feilen: {
    typer: FeilKnapp[];
    oppdaget: Oppdaget;
    opplystForKjop: "ja" | "nei" | "usikker";
    feilOpplysning: FeilOpplysning;
    kontakt: Kontakt;
    // When the buyer first complained to the dealer (last day of the month). Only asked when the
    // purchase is more than five years old and the dealer has been contacted; decides the § 27 deadline.
    forsteReklamasjon?: string;
    utbedringskostnadNok?: number | null;
  };
  bevis: {
    verkstedrapport: boolean;
    // Only asked when a report exists: does it say the defect was probably there before purchase?
    rapportSierForKjop: boolean | null;
    // Only asked when there is no report.
    bilder: boolean;
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
