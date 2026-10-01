import type { FeilKnapp, Feiltype, KlageInput, Kontakt, Mangelsgrunnlag } from "./typer";

// Pure step: turns the form input (plus the model's reading of the free text) into the facts the
// rules and the statistics use.

export type BeskrivelseKvalitet = "ubrukelig" | "tynn" | "god";
export type Tolkning = { feiltyper: Feiltype[]; mangelsgrunnlag: Mangelsgrunnlag[]; kvalitet?: BeskrivelseKvalitet };

// Below TULL nothing can be said about the defect; below KORT the text is at best thin.
export const TULL_BESKRIVELSE_TEGN = 15;
export const KORT_BESKRIVELSE_TEGN = 60;

function beskrivelseKvalitet(beskrivelse: string, tolkning: Tolkning | null): BeskrivelseKvalitet {
  const lengde = beskrivelse.trim().length;
  if (lengde < TULL_BESKRIVELSE_TEGN) return "ubrukelig";
  // «Ubrukelig» means we cannot tell what is wrong. If the model named a concrete defect in the
  // same answer, it could, so we take the milder grade (the model was not consistent here in testing).
  if (tolkning?.kvalitet === "ubrukelig" && tolkning.feiltyper.some((t) => t !== "annet")) return "tynn";
  // A short text can name the defect but rarely says enough for the letter; the model wavered
  // between «tynn» and «god» on texts like «Bremsene hviner.», so length settles it.
  if (lengde < KORT_BESKRIVELSE_TEGN) return tolkning?.kvalitet === "ubrukelig" ? "ubrukelig" : "tynn";
  return tolkning?.kvalitet ?? "god";
}

// Forbrukerkjøpsloven § 18 (2): a defect that shows within this period after delivery is presumed
// to have existed at delivery. Six months until the EU sale-of-goods rules took effect on
// 1 January 2024, two years for purchases from then (the law applies to contracts made after it).
export const PRESUMSJON_TO_AR_FRA = "2024-01-01";
// § 27: absolute deadline for complaining, five years for goods meant to last much longer, like a car.
export const ABSOLUTT_FRIST_AR = 5;

export type Reklamasjonsbotte = "rask" | "middels" | "sen";

export type Faktorer = {
  utenforTjenesten: "ikke_privat_bruk" | "privat_selger" | null;
  feiltyper: Feiltype[];
  mangelsgrunnlag: Mangelsgrunnlag[];
  // Which evidence the user ticked, used to suggest what is missing.
  bevisValgt: Omit<KlageInput["bevis"], "rapportSierForKjop">;
  // null when there is no report.
  rapportSierForKjop: boolean | null;
  kontakt: Kontakt;
  // The dealer's repair so far, as the claim ladder needs it.
  forhandlerRetting: "forsokt" | "avvist" | "ikke_spurt";
  kjopesumNok: number;
  utbedringskostnadNok: number | null;
  beskrivelseKvalitet: BeskrivelseKvalitet;
  dagerKjopTilOppdaget: number;
  // Purchase to discovery, matched against dager_til_reklamasjon in the decisions. The same for
  // everyone, so not having complained yet is never held against the buyer.
  reklamasjonsbotte: Reklamasjonsbotte;
  presumsjonManeder: 6 | 24;
  // The defect showed within the presumption period, so the burden of proof is on the dealer.
  presumsjon: boolean;
  // Not contacted the dealer, and more than five years have passed since purchase: too late.
  fristUte: boolean;
  // Defect was disclosed before purchase and nothing suggests the seller misled the buyer.
  opplystTakSvak: boolean;
  // The text points to wrong information from the dealer, and the buyer has the ad, contract or
  // messages to show what was said.
  feilOpplysningerDokumentert: boolean;
};

const KNAPP_TIL_FEILTYPE: Record<FeilKnapp, Feiltype[]> = {
  motor: ["motor"],
  girkasse: ["girkasse"],
  elektrisk: ["elektrisk"],
  rust: ["rust"],
  bremser: ["bremser"],
  annet: [],
};

const DAG_MS = 86_400_000;
export function dagerMellom(fra: string, til: string): number {
  return Math.round((Date.parse(til) - Date.parse(fra)) / DAG_MS);
}

export function leggTilManeder(dato: string, maneder: number): string {
  const d = new Date(`${dato}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + maneder);
  return d.toISOString().slice(0, 10);
}

export const iDag = () => new Date().toISOString().slice(0, 10);

// The purchase date stands in for the delivery date, which the form does not ask for.
export function beregnFaktorer(input: KlageInput, tolkning: Tolkning | null, idag = iDag()): Faktorer {
  const { kvalifisering: k, bilOgKjop: b, feilen: f, bevis } = input;

  const feiltyper = [...new Set([...f.typer.flatMap((t) => KNAPP_TIL_FEILTYPE[t]), ...(tolkning?.feiltyper ?? [])])];
  const mangelsgrunnlag = [...new Set(tolkning?.mangelsgrunnlag ?? [])];

  const dagerKjopTilOppdaget = dagerMellom(b.kjopsdato, f.oppdagetDato);
  const reklamasjonsbotte: Reklamasjonsbotte = dagerKjopTilOppdaget <= 180 ? "rask" : dagerKjopTilOppdaget <= 730 ? "middels" : "sen";

  const presumsjonManeder = b.kjopsdato >= PRESUMSJON_TO_AR_FRA ? 24 : 6;
  const presumsjon = f.oppdagetDato <= leggTilManeder(b.kjopsdato, presumsjonManeder);
  // Someone who has already complained did so on a date we do not ask for, so we cannot tell.
  const fristUte = f.kontakt === "nei" && idag > leggTilManeder(b.kjopsdato, ABSOLUTT_FRIST_AR * 12);

  const utenforTjenesten = k.selgerType === "privat" ? "privat_selger" : !k.privatBruk ? "ikke_privat_bruk" : null;
  const villedet = mangelsgrunnlag.includes("feil_opplysninger") || mangelsgrunnlag.includes("tilbakeholdt_opplysning");

  return {
    utenforTjenesten,
    feiltyper,
    mangelsgrunnlag,
    bevisValgt: {
      kjopekontrakt: bevis.kjopekontrakt,
      verkstedrapport: bevis.verkstedrapport,
      bilder: bevis.bilder,
      korrespondanse: bevis.korrespondanse,
      annonse: bevis.annonse,
    },
    rapportSierForKjop: bevis.verkstedrapport ? bevis.rapportSierForKjop : null,
    kontakt: f.kontakt,
    forhandlerRetting: f.kontakt === "forsokt" ? "forsokt" : f.kontakt === "avvist" ? "avvist" : "ikke_spurt",
    kjopesumNok: b.kjopesumNok,
    utbedringskostnadNok: f.utbedringskostnadNok,
    beskrivelseKvalitet: beskrivelseKvalitet(f.beskrivelse, tolkning),
    dagerKjopTilOppdaget,
    reklamasjonsbotte,
    presumsjonManeder,
    presumsjon,
    fristUte,
    opplystTakSvak: f.opplystForKjop === "ja" && !villedet,
    feilOpplysningerDokumentert:
      mangelsgrunnlag.includes("feil_opplysninger") && (bevis.annonse || bevis.kjopekontrakt || bevis.korrespondanse),
  };
}
