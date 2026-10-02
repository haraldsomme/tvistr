import type { FeilKnapp, Feiltype, KlageInput, Kontakt, Oppdaget } from "./typer";

// Pure step: turns the form input into the facts the rules and the statistics use.

// Forbrukerkjøpsloven § 18 (2): a defect that shows within this period after delivery is presumed
// to have existed at delivery. Six months until the EU sale-of-goods rules took effect on
// 1 January 2024, two years for purchases from then (the law applies to contracts made after it).
export const PRESUMSJON_TO_AR_FRA = "2024-01-01";
// § 27: absolute deadline for complaining, five years for goods meant to last much longer, like a car.
export const ABSOLUTT_FRIST_AR = 5;
// § 27 (1): the buyer must complain within reasonable time after discovering the defect, never less
// than two months. Six months leaves a wide margin before we call an unmade complaint too late.
export const RIMELIG_TID_MANEDER = 6;

// What the buyer can expect follows the car's price and mileage (§ 15). Dealer decisions with a
// complaint within 180 days: 59 % won under 50 000 kr against 77 % at 150 000–300 000 kr, and 60 %
// over 200 000 km against 72 % under 100 000 km (computed 2026-10-02).
export const LAV_KJOPESUM_NOK = 50_000;
export const HOY_KM = 200_000;

export type Reklamasjonsbotte = "rask" | "middels" | "sen";

export type Faktorer = {
  utenforTjenesten: "ikke_privat_bruk" | "privat_selger" | null;
  // One group per button the buyer picked; a group stands for any of its defect types. «Annet» gives no group.
  feilgrupper: Feiltype[][];
  verkstedrapport: boolean;
  bilder: boolean;
  // null when there is no report.
  rapportSierForKjop: boolean | null;
  kontakt: Kontakt;
  oppdaget: Oppdaget;
  // Purchase to discovery as the buyer answered; picks the example decision.
  reklamasjonsbotte: Reklamasjonsbotte;
  // Which decisions the statistics compare the case with, by dager_til_reklamasjon. It follows the
  // legal position, not the calendar: nearly all decisions are from the six-month rule, so a defect
  // inside today's two-year presumption is compared with those that were inside the presumption then.
  // The same for everyone, so not having complained yet is never held against the buyer.
  statistikkbotte: Reklamasjonsbotte;
  presumsjonManeder: 6 | 24;
  // The defect showed within the presumption period, so the burden of proof is on the dealer.
  presumsjon: boolean;
  // More than five years from purchase to the first complaint, or to today when there has been none.
  fristUte: boolean;
  // The dealer has not been told, and at least RIMELIG_TID_MANEDER have passed since the defect showed.
  reklamertForSent: boolean;
  // The defect is one that wear can explain: not wrong mileage or history, nor earlier collision damage.
  slitasjeAktuelt: boolean;
  // Cheap car or high mileage, so the buyer could expect less of it. null = neither.
  lavForventning: "pris" | "km" | "begge" | null;
  opplystForKjop: KlageInput["feilen"]["opplystForKjop"];
  // Defect was disclosed before a purchase made before 2024 and the buyer does not say the seller
  // misled them: the buyer cannot complain about what they knew of (§ 16 (3) as it read then).
  opplystTakSvak: boolean;
  // The same for a purchase from 2024: being told is not enough, the buyer must have been told
  // specifically and have accepted the deviation expressly and separately (§ 15 (2)).
  opplystEtter2024: boolean;
  // Defect was disclosed, and the buyer says the information was misleading but cannot show it.
  opplystTakMiddels: boolean;
  // The buyer says what the ad or the dealer said was wrong.
  feilOpplysninger: boolean;
  // ... and has the ad, contract or messages to show what was said.
  feilOpplysningerDokumentert: boolean;
};

const KNAPP_TIL_FEILTYPE: Record<FeilKnapp, Feiltype[]> = {
  motor: ["motor"],
  girkasse: ["girkasse", "clutch"],
  elektrisk: ["elektrisk"],
  batteri: ["batteri_elbil"],
  understell: ["understell_hjuloppheng"],
  bremser: ["bremser"],
  rust: ["rust"],
  fukt: ["fukt_lekkasje"],
  klimaanlegg: ["klimaanlegg"],
  km_service: ["km_avvik", "servicehistorikk", "bruktimport_opplysning"],
  skade: ["kollisjonsskade"],
  annet: [],
};

// The latest the defect can have shown, in months after the purchase. Unknown for «mer enn 2 år».
const SENEST_OPPDAGET: Record<Oppdaget, number | null> = { innen_6_mnd: 6, "6_mnd_til_2_ar": 24, over_2_ar: null };

const BOTTE: Record<Oppdaget, Reklamasjonsbotte> = { innen_6_mnd: "rask", "6_mnd_til_2_ar": "middels", over_2_ar: "sen" };

// The 31st plus a number of months lands on the last day of a shorter month, not in the next one.
export function leggTilManeder(dato: string, maneder: number): string {
  const d = new Date(`${dato}T00:00:00Z`);
  const dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + maneder);
  d.setUTCDate(Math.min(dag, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d.toISOString().slice(0, 10);
}

export const iDag = () => new Date().toISOString().slice(0, 10);

export const presumsjonManederFor = (kjopsdato: string): 6 | 24 => (kjopsdato >= PRESUMSJON_TO_AR_FRA ? 24 : 6);

// The purchase date stands in for the delivery date, which the form does not ask for.
export function beregnFaktorer(input: KlageInput, idag = iDag()): Faktorer {
  const { kvalifisering: k, bilOgKjop: b, feilen: f, bevis } = input;

  const presumsjonManeder = presumsjonManederFor(b.kjopsdato);
  // «Innen 6 måneder» is inside the presumption either way; «6 måneder til 2 år» only for purchases
  // from 2024; «mer enn 2 år» never.
  const presumsjon = f.oppdaget === "innen_6_mnd" || (f.oppdaget === "6_mnd_til_2_ar" && presumsjonManeder === 24);
  // The complaint date is only asked for when the purchase is over five years old, so a missing
  // date means there was no need to ask.
  const fristSlutt = leggTilManeder(b.kjopsdato, ABSOLUTT_FRIST_AR * 12);
  const fristUte = f.kontakt === "nei" ? idag > fristSlutt : f.forsteReklamasjon !== undefined && f.forsteReklamasjon > fristSlutt;
  const senest = SENEST_OPPDAGET[f.oppdaget];
  const reklamertForSent = f.kontakt === "nei" && senest !== null && idag > leggTilManeder(b.kjopsdato, senest + RIMELIG_TID_MANEDER);
  const opplystUtenInnvending = f.opplystForKjop === "ja" && f.feilOpplysning === "nei";
  const feilgrupper = [...new Set(f.typer)].map((t) => KNAPP_TIL_FEILTYPE[t]).filter((g) => g.length > 0);
  const billig = b.kjopesumNok != null && b.kjopesumNok < LAV_KJOPESUM_NOK;
  const langtKjort = b.kmVedKjop != null && b.kmVedKjop > HOY_KM;

  const utenforTjenesten = k.selgerType === "privat" ? "privat_selger" : !k.privatBruk ? "ikke_privat_bruk" : null;

  return {
    utenforTjenesten,
    feilgrupper,
    verkstedrapport: bevis.verkstedrapport,
    bilder: bevis.bilder,
    rapportSierForKjop: bevis.verkstedrapport ? bevis.rapportSierForKjop : null,
    kontakt: f.kontakt,
    oppdaget: f.oppdaget,
    reklamasjonsbotte: BOTTE[f.oppdaget],
    statistikkbotte: presumsjon ? "rask" : BOTTE[f.oppdaget],
    presumsjonManeder,
    presumsjon,
    fristUte,
    reklamertForSent,
    slitasjeAktuelt: feilgrupper.length === 0 || feilgrupper.some((g) => g[0] !== "km_avvik" && g[0] !== "kollisjonsskade"),
    lavForventning: billig && langtKjort ? "begge" : billig ? "pris" : langtKjort ? "km" : null,
    opplystForKjop: f.opplystForKjop,
    opplystTakSvak: opplystUtenInnvending && presumsjonManeder === 6,
    opplystEtter2024: opplystUtenInnvending && presumsjonManeder === 24,
    opplystTakMiddels: f.opplystForKjop === "ja" && f.feilOpplysning === "ja_udokumentert",
    feilOpplysninger: f.feilOpplysning !== "nei",
    feilOpplysningerDokumentert: f.feilOpplysning === "ja_dokumentert",
  };
}
