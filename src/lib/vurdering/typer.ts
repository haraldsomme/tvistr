import type { DRIVSTOFF, FEILTYPER, MANGELSGRUNNLAG } from "@/lib/ai/skjema";

// The engine's input. The assessment only asks for what can stop the claim and when the defect showed;
// the defect type, contact with the dealer, what was said and the evidence are asked after purchase and are
// missing until then. Registration number, dealer, mileage, amounts, the description of the defect and
// exact dates are optional or left out here and are collected for the letter. All dates are ÅÅÅÅ-MM-DD.

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
// A dealer typed freely (missing from Brreg, or a sole proprietorship) can have its address typed too.
export type Forhandler = { type: "brreg"; orgnr: string; navn: string; adresse?: Adresse } | { type: "fritekst"; navn: string; adresse?: Adresse };

// Has the buyer taken the defect up with the dealer? The assessment only needs yes or no (the deadlines
// in § 27); what has happened since is asked on the letter page (`RETTING_VALG`).
export const KONTAKT_VALG = ["nei", "ja"] as const;
export type Kontakt = (typeof KONTAKT_VALG)[number];

// What has happened about repairing the defect (fkjl §§ 29 and 30), asked on the letter page: ingen = nothing
// yet; venter = the dealer will try or has not answered; avvist = refused; forsokt = tried without
// success; ikke_rettet = the dealer has not repaired it within reasonable time; reparert_selv = the buyer had
// it repaired elsewhere.
export const RETTING_VALG = [
  "ingen",
  "venter",
  "avvist",
  "forsokt",
  "ikke_rettet",
  "reparert_selv",
] as const;
export type Retting = (typeof RETTING_VALG)[number];

// The answers that make sense: a buyer who has not told the dealer can only say that nothing has happened
// or that the car was repaired elsewhere. An answer that no longer fits the contact answer is dropped.
export const rettingValgFor = (kontakt: Kontakt): readonly Retting[] =>
  kontakt === "nei"
    ? ["ingen", "reparert_selv"]
    : ["venter", "avvist", "forsokt", "ikke_rettet", "reparert_selv"];
// Without an answer about contact (a case opened before the step is filled in) there is no answer about repair either.
export const gyldigRetting = (
  kontakt: Kontakt | undefined,
  retting: Retting | undefined,
): Retting | undefined =>
  kontakt && retting && rettingValgFor(kontakt).includes(retting) ? retting : undefined;

// Who the car was bought from. Only a purchase from a dealer by a consumer is covered by the consumer
// purchase act (§ 1); a purchase from a private person or through a company follows the purchase act.
export const KJOPSFORM_VALG = ["forhandler", "privatperson", "firma"] as const;
export type Kjopsform = (typeof KJOPSFORM_VALG)[number];

// How long after the purchase the defect showed. The buckets are the engine's own cut-offs:
// the presumption periods (6 and 24 months) and the 180/730-day buckets in the decision statistics.
export const OPPDAGET_VALG = ["innen_6_mnd", "6_mnd_til_2_ar", "over_2_ar"] as const;
export type Oppdaget = (typeof OPPDAGET_VALG)[number];

// Did the ad or the dealer say something about the car that turned out to be wrong, and can the
// buyer show what was said (the ad, the contract or messages)?
// Did the buyer know about the defect when buying? «ja_verre»: yes, but it is worse or other than the buyer was
// told, so the letter builds on the difference. «ja_som_opplyst»: yes, as it is; for a purchase before 2024
// that stops the claim (§ 16 third paragraph as it read then). Saved cases from before can hold «ja», which is
// read as «ja_verre», so no letter already bought is stopped by the change.
export const OPPLYST_VALG = ["nei", "ja_verre", "ja_som_opplyst"] as const;
export type Opplyst = (typeof OPPLYST_VALG)[number];

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
    // Undefined (old data, test data) is read as a dealer.
    kjopsform?: Kjopsform;
    kjopesumNok?: number | null;
    regnr?: string;
    kjoretoy?: { merke: string; modell: string; arsmodell: number; drivstoff: Drivstoff } | null;
    forhandler?: Forhandler;
    kmVedKjop?: number;
    // The year the vehicle was first registered (from the registry lookup); gives its age at purchase.
    bilAr?: number;
  };
  feilen: {
    // Asked in «Feilen» after purchase; missing until then.
    typer?: FeilKnapp[];
    oppdaget: Oppdaget;
    opplystForKjop: Opplyst;
    // Asked in «Før kjøpet» after purchase; missing until then.
    feilOpplysning?: FeilOpplysning;
    // Asked in «Kontakt med forhandleren» after purchase; missing until then.
    kontakt?: Kontakt;
    // Did the buyer first complain to the dealer within five years of the purchase? Asked when the
    // purchase is more than five years old (unless the buyer has said the dealer was never told); decides
    // the § 27 deadline.
    reklamertInnenFemAr?: boolean;
    utbedringskostnadNok?: number | null;
  };
  // Asked in «Tilstandsrapport» after purchase (pictures follow from the attachments). Missing or null =
  // not answered.
  bevis: {
    verkstedrapport?: boolean | null;
    // Only when a report exists: does it say the defect was probably there before purchase?
    rapportSierForKjop?: boolean | null;
    bilder?: boolean | null;
  };
};

// utenfor = the claim is stopped by the law itself (not a consumer purchase from a dealer, past the five-year
// deadline, or a defect the buyer knew of as it is, for a purchase before 2024); the letter is not offered.
// sak = everything else: the buyer may have a case, and decides from the warning whether to buy the letter.
export type Niva = "sak" | "utenfor";

export type TestKlage = {
  id: number;
  tittel: string;
  forventetNiva: Niva | Niva[];
  merknad: string;
  input: KlageInput;
};
