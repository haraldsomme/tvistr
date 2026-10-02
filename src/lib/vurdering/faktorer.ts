import type { FeilKnapp, Feiltype, KlageInput, Kontakt, Oppdaget } from "./typer";

// Pure step: turns the form input into the facts the rules and the statistics use.

// Forbrukerkjøpsloven § 18 (2): a defect that shows within this period after delivery is presumed
// to have existed at delivery. Six months until the EU sale-of-goods rules took effect on
// 1 January 2024, two years for purchases from then (the law applies to contracts made after it).
export const PRESUMSJON_TO_AR_FRA = "2024-01-01";
// § 27: absolute deadline for complaining, five years for goods meant to last much longer, like a car.
export const ABSOLUTT_FRIST_AR = 5;

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
  opplystForKjop: KlageInput["feilen"]["opplystForKjop"];
  // Defect was disclosed before purchase and the buyer does not say the seller misled them.
  opplystTakSvak: boolean;
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

const BOTTE: Record<Oppdaget, Reklamasjonsbotte> = { innen_6_mnd: "rask", "6_mnd_til_2_ar": "middels", over_2_ar: "sen" };

export function leggTilManeder(dato: string, maneder: number): string {
  const d = new Date(`${dato}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + maneder);
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

  const utenforTjenesten = k.selgerType === "privat" ? "privat_selger" : !k.privatBruk ? "ikke_privat_bruk" : null;

  return {
    utenforTjenesten,
    feilgrupper: [...new Set(f.typer)].map((t) => KNAPP_TIL_FEILTYPE[t]).filter((g) => g.length > 0),
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
    opplystForKjop: f.opplystForKjop,
    opplystTakSvak: f.opplystForKjop === "ja" && f.feilOpplysning === "nei",
    opplystTakMiddels: f.opplystForKjop === "ja" && f.feilOpplysning === "ja_udokumentert",
    feilOpplysninger: f.feilOpplysning !== "nei",
    feilOpplysningerDokumentert: f.feilOpplysning === "ja_dokumentert",
  };
}
