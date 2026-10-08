import type { FeilKnapp, Feiltype, KlageInput, Kjopsalder, Kontakt, Oppdaget } from "./typer";

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
// Without having told the dealer, this long after the defect showed is too long to be within reasonable time.
export const VENTET_FOR_LENGE_MANEDER = 12;

// What the buyer can expect follows the car's price and mileage (§ 15). Dealer decisions with a
// complaint within 180 days: 59 % won under 50 000 kr against 77 % at 150 000–300 000 kr, and 60 %
// over 200 000 km against 72 % under 100 000 km (computed 2026-10-02).
export const LAV_KJOPESUM_NOK = 50_000;
export const HOY_KM = 200_000;

export type Reklamasjonsbotte = "rask" | "middels" | "sen";

export type Faktorer = {
  // One group per button the buyer picked; a group stands for any of its defect types. «Annet» gives no group.
  feilgrupper: Feiltype[][];
  // The car's age in whole years at purchase, from its first registration. null when not known.
  bilAlder: number | null;
  // The mileage at purchase. null when not given.
  kmVedKjop: number | null;
  // The purchase price. null when not given.
  kjopesumNok: number | null;
  // null = not asked.
  verkstedrapport: boolean | null;
  bilder: boolean | null;
  // null when there is no report, or it is not known whether there is one.
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
  // More than five years have passed since the purchase. With a first complaint inside the five years
  // the claim stands anyway.
  femAarGatt: boolean;
  // More than five years from purchase to the first complaint, or to today when there has been none.
  fristUte: boolean;
  // The law itself stops the claim: not a purchase from a dealer by a consumer (§ 1), or past the
  // five-year deadline (§ 27). Then there is no letter to offer.
  stopp: "firma" | "privat" | "frist" | null;
  // The dealer has not been told, and too long has passed since the defect showed (§ 27, reasonable time).
  reklamertForSent: boolean;
  // The dealer has not been told, and the defect has certainly been known for over a year. Weakens the case.
  venterOverEttAr: boolean;
  // The defect is one that wear can explain: not wrong mileage or history, nor earlier collision damage.
  slitasjeAktuelt: boolean;
  // Cheap car or high mileage, so the buyer could expect less of it. null = neither.
  lavForventning: "pris" | "km" | "begge" | null;
  opplystForKjop: KlageInput["feilen"]["opplystForKjop"];
  // The buyer knew about the defect when buying, for a purchase before 2024: the buyer cannot complain
  // about what they knew of (§ 16 (3) as it read then).
  opplystTakSvak: boolean;
  // The same for a purchase from 2024: knowing is not enough to lose the claim, the buyer must have been
  // told specifically and have accepted the deviation expressly and separately (§ 15 (2)); it is still a
  // point against the case.
  opplystEtter2024: boolean;
  // The buyer says what the ad or the dealer said was wrong.
  feilOpplysninger: boolean;
  // ... and has the ad, contract or messages to show what was said.
  feilOpplysningerDokumentert: boolean;
};

export const KNAPP_TIL_FEILTYPE: Record<FeilKnapp, Feiltype[]> = {
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

// The purchase date the rules work with: the exact day when it is known, otherwise a day in the
// middle of the answer given. The middle of «2–5 år» is before 2024 for now, so the six-month
// presumption applies to it, which is the careful assumption; it follows the calendar from 2029.
const MIDT_I_KJOPSALDER: Record<Kjopsalder, number> = { under_2: -12, "2_5": -42, over_5: -72 };
export function kjopsdatoFor(b: { kjopsdato?: string; kjopAlder?: Kjopsalder }, idag: string): string {
  if (b.kjopsdato) return b.kjopsdato;
  return leggTilManeder(idag, MIDT_I_KJOPSALDER[b.kjopAlder ?? "under_2"]);
}

// Which of the three answers an exact purchase day falls under.
export function kjopsalderFor(kjopsdato: string, idag: string): Kjopsalder {
  if (idag > leggTilManeder(kjopsdato, ABSOLUTT_FRIST_AR * 12)) return "over_5";
  return idag > leggTilManeder(kjopsdato, 24) ? "2_5" : "under_2";
}

export const iDag = () => new Date().toISOString().slice(0, 10);

// A real calendar day written ÅÅÅÅ-MM-DD (so not 31 February).
export function erDato(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export const presumsjonManederFor = (kjopsdato: string): 6 | 24 => (kjopsdato >= PRESUMSJON_TO_AR_FRA ? 24 : 6);

// The purchase date stands in for the delivery date, which the form does not ask for.
export function beregnFaktorer(input: KlageInput, idag = iDag()): Faktorer {
  const { bilOgKjop: b, feilen: f, bevis } = input;

  const kjopsdato = kjopsdatoFor(b, idag);
  const presumsjonManeder = presumsjonManederFor(kjopsdato);
  // «Innen 6 måneder» is inside the presumption either way; «6 måneder til 2 år» only for purchases
  // from 2024; «mer enn 2 år» never.
  const presumsjon = f.oppdaget === "innen_6_mnd" || (f.oppdaget === "6_mnd_til_2_ar" && presumsjonManeder === 24);
  // Whether the first complaint came within five years is only asked when the purchase is over
  // five years old and the dealer has been contacted; a missing answer means there was no need to ask.
  const femAarGatt = idag > leggTilManeder(kjopsdato, ABSOLUTT_FRIST_AR * 12);
  const fristUte = femAarGatt && (f.kontakt === "nei" || f.reklamertInnenFemAr === false);
  const senest = SENEST_OPPDAGET[f.oppdaget];
  const reklamertForSent = f.kontakt === "nei" && senest != null && idag > leggTilManeder(kjopsdato, senest + RIMELIG_TID_MANEDER);
  // The same from the two answers we have, the purchase date and how long after it the defect showed: the
  // latest it can have shown plus a year is already past. Not guessed for «mer enn 2 år», which has no latest.
  const venterOverEttAr = f.kontakt === "nei" && senest != null && idag > leggTilManeder(kjopsdato, senest + VENTET_FOR_LENGE_MANEDER);
  const opplystUtenInnvending =
    f.opplystForKjop === "ja" && f.feilOpplysning === "nei";
  const feilgrupper = [...new Set(f.typer)]
    .map((t) => KNAPP_TIL_FEILTYPE[t])
    .filter((g) => g.length > 0);
  const billig = b.kjopesumNok != null && b.kjopesumNok < LAV_KJOPESUM_NOK;
  const langtKjort = b.kmVedKjop != null && b.kmVedKjop > HOY_KM;


  return {
    feilgrupper,
    bilAlder: b.bilAr ? Math.max(0, Number(kjopsdato.slice(0, 4)) - b.bilAr) : null,
    kmVedKjop: b.kmVedKjop ?? null,
    kjopesumNok: b.kjopesumNok ?? null,
    verkstedrapport: bevis.verkstedrapport,
    bilder: bevis.bilder,
    rapportSierForKjop: bevis.verkstedrapport ? bevis.rapportSierForKjop : null,
    kontakt: f.kontakt,
    oppdaget: f.oppdaget,
    reklamasjonsbotte: BOTTE[f.oppdaget],
    statistikkbotte: presumsjon ? "rask" : BOTTE[f.oppdaget],
    presumsjonManeder,
    presumsjon,
    femAarGatt,
    fristUte,
    stopp:
      b.kjopsform === "firma"
        ? "firma"
        : b.kjopsform === "privatperson"
          ? "privat"
          : fristUte
            ? "frist"
            : null,
    reklamertForSent,
    venterOverEttAr,
    slitasjeAktuelt: feilgrupper.length === 0 || feilgrupper.some((g) => g[0] !== "km_avvik" && g[0] !== "kollisjonsskade"),
    lavForventning: billig && langtKjort ? "begge" : billig ? "pris" : langtKjort ? "km" : null,
    opplystForKjop: f.opplystForKjop,
    opplystTakSvak: opplystUtenInnvending && presumsjonManeder === 6,
    opplystEtter2024: opplystUtenInnvending && presumsjonManeder === 24,
    feilOpplysninger: f.feilOpplysning !== "nei",
    feilOpplysningerDokumentert: f.feilOpplysning === "ja_dokumentert",
  };
}
