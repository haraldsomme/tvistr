import { erDato, iDag, kjopsalderFor, kjopsdatoFor, leggTilManeder, presumsjonManederFor } from "./faktorer";
import { FEILOPPLYSNING_VALG, KJOPSALDER_VALG, KONTAKT_VALG, OPPDAGET_VALG, type FeilKnapp, type KlageInput, type Kjopsalder, type Kontakt, type Oppdaget } from "./typer";

// What the form collects (steps 1–4) and the checks shared by the client (enables «Neste») and the
// API route (never trusts the client). The assessment only asks for what decides the level: purchase
// date, defect, when it showed, contact with the dealer, and (when it matters) what the buyer was
// told and what the report says. The purchase price, mileage, whether the information was in writing
// and pictures are left empty here and answered on the letter page (the card «Svarene fra
// vurderingen»), which uses the same type.

export const FEILTYPER_KNAPPER: readonly FeilKnapp[] = [
  "motor",
  "girkasse",
  "elektrisk",
  "batteri",
  "understell",
  "bremser",
  "rust",
  "fukt",
  "klimaanlegg",
  "km_service",
  "skade",
  "annet",
];
export const OPPLYST_VALG = ["ja", "nei"] as const;
export const JA_NEI = ["ja", "nei"] as const;
export const FRA_AR = 1990;
const MAKS_KJOPESUM = 50_000_000;
const MAKS_KM = 2_000_000;

type JaNei = (typeof JA_NEI)[number] | "";

export type Steg = 1 | 2 | 3 | 4;

export type Innsending = {
  kjopAlder: Kjopsalder | ""; // how long ago the car was bought; the assessment asks for this
  kjopsdato: string; // the exact day, ÅÅÅÅ-MM-DD; empty until the registry or the letter page gives it
  kjopesum: string; // whole kroner, digits only; not asked in the assessment
  kmVedKjop: string; // odometer at purchase, digits only; not asked in the assessment
  feiltyper: FeilKnapp[];
  oppdaget: Oppdaget | "";
  opplystForKjop: (typeof OPPLYST_VALG)[number] | ""; // asked for purchases before 2024
  feilOpplysning: (typeof FEILOPPLYSNING_VALG)[number] | ""; // asked when the buyer was told about the defect; «ja» then means ja_udokumentert
  kontakt: Kontakt | "";
  reklamertInnenFemAr: JaNei; // asked when the purchase is over five years old and the dealer is contacted
  verkstedrapport: JaNei; // asked when the defect showed outside the presumption period
  rapportSierForKjop: JaNei; // asked when there is a report
  bilder: JaNei; // not asked in the assessment
};

export const TOM_INNSENDING: Innsending = {
  kjopAlder: "",
  kjopsdato: "",
  kjopesum: "",
  kmVedKjop: "",
  feiltyper: [],
  oppdaget: "",
  opplystForKjop: "",
  feilOpplysning: "",
  kontakt: "",
  reklamertInnenFemAr: "",
  verkstedrapport: "",
  rapportSierForKjop: "",
  bilder: "",
};

const heltall = (s: string, min: number, max: number) => /^\d{1,9}$/.test(s) && Number(s) >= min && Number(s) <= max;
const jaNei = (v: string): v is "ja" | "nei" => v === "ja" || v === "nei";

const pad = (n: number) => String(n).padStart(2, "0");

// The purchase date is a real day from FRA_AR on, not in the future.
export const gyldigKjopsdato = (dato: string, idag = iDag()): boolean => erDato(dato) && Number(dato.slice(0, 4)) >= FRA_AR && dato <= idag;

// The answer to «Når kjøpte du bilen?». An exact day, when there is a valid one, decides it.
export function kjopsalderAv(i: Pick<Innsending, "kjopsdato" | "kjopAlder">, idag = iDag()): Kjopsalder | "" {
  if (gyldigKjopsdato(i.kjopsdato, idag)) return kjopsalderFor(i.kjopsdato, idag);
  return KJOPSALDER_VALG.includes(i.kjopAlder as Kjopsalder) ? (i.kjopAlder as Kjopsalder) : "";
}

// The purchase date the rules work with, or "" when nothing is answered yet.
export function kjopsdatoAv(i: Pick<Innsending, "kjopsdato" | "kjopAlder">, idag = iDag()): string {
  const alder = kjopsalderAv(i, idag);
  if (!alder) return "";
  return kjopsdatoFor({ kjopsdato: gyldigKjopsdato(i.kjopsdato, idag) ? i.kjopsdato : undefined, kjopAlder: alder }, idag);
}

// Has the purchase passed the five-year deadline, so that it matters whether the buyer first
// complained within it? Same test as the engine, so the form asks exactly when the answer can change
// the result.
export function sporOmFemarsfrist(i: Pick<Innsending, "kjopsdato" | "kjopAlder" | "kontakt">, idag = iDag()): boolean {
  if (!i.kontakt || i.kontakt === "nei") return false;
  return kjopsalderAv(i, idag) === "over_5";
}

// Does the answer to «Ble du fortalt om feilen før kjøpet?» decide anything? Only for purchases
// before 2024, where being told without objecting closes the claim.
export function sporOmOpplysning(i: Pick<Innsending, "kjopsdato" | "kjopAlder">, idag = iDag()): boolean {
  const dato = kjopsdatoAv(i, idag);
  return dato !== "" && presumsjonManederFor(dato) === 6;
}

// Does the evidence decide anything? Only when the defect showed outside the presumption period,
// where the buyer must show that it was there at delivery and a report is the way to do it.
export function sporOmBevis(i: Pick<Innsending, "kjopsdato" | "kjopAlder" | "oppdaget">, idag = iDag()): boolean {
  const dato = kjopsdatoAv(i, idag);
  if (!dato || !i.oppdaget) return false;
  const presumsjon = i.oppdaget === "innen_6_mnd" || (i.oppdaget === "6_mnd_til_2_ar" && presumsjonManederFor(dato) === 24);
  return !presumsjon;
}

// The steps the form shows for these answers: the evidence step only when it can change the result.
export const stegFor = (i: Pick<Innsending, "kjopsdato" | "kjopAlder" | "oppdaget">, idag = iDag()): readonly Steg[] => (sporOmBevis(i, idag) ? [1, 2, 3, 4] : [1, 2, 3]);

const MIN_MANEDER: Record<Oppdaget, number> = { innen_6_mnd: 0, "6_mnd_til_2_ar": 6, over_2_ar: 24 };

// Can the defect have shown this long after the purchase? With an exact day it is the day that
// decides; with only «under 2 år» the defect cannot have shown more than two years after.
export function oppdagetMulig(i: Pick<Innsending, "kjopsdato" | "kjopAlder">, oppdaget: Oppdaget, idag = iDag()): boolean {
  if (gyldigKjopsdato(i.kjopsdato, idag)) return leggTilManeder(i.kjopsdato, MIN_MANEDER[oppdaget]) <= idag;
  const alder = kjopsalderAv(i, idag);
  if (!alder) return false;
  return !(alder === "under_2" && oppdaget === "over_2_ar");
}

// A «how long after» that no longer fits the purchase is cleared, and when only one answer fits
// there is nothing to choose: it is picked.
function rettOppdaget(ny: Innsending, idag: string): Innsending {
  if (ny.oppdaget && !oppdagetMulig(ny, ny.oppdaget, idag)) ny.oppdaget = "";
  const mulige = OPPDAGET_VALG.filter((v) => oppdagetMulig(ny, v, idag));
  if (!ny.oppdaget && mulige.length === 1) ny.oppdaget = mulige[0];
  if (kjopsalderAv(ny, idag) !== "over_5") ny.reklamertInnenFemAr = "";
  return ny;
}

// The answers with an exact purchase day. A valid day also gives the answer to «hvor lenge siden»;
// an empty one clears the day and keeps that answer.
export function medKjopsdato(i: Innsending, kjopsdato: string, idag = iDag()): Innsending {
  const ny = { ...i, kjopsdato };
  if (gyldigKjopsdato(kjopsdato, idag)) ny.kjopAlder = kjopsalderFor(kjopsdato, idag);
  return rettOppdaget(ny, idag);
}

// The answers with a new «hvor lenge siden». An exact day that does not fit it is cleared.
export function medKjopsalder(i: Innsending, kjopAlder: Kjopsalder | "", idag = iDag()): Innsending {
  const ny = { ...i, kjopAlder };
  if (ny.kjopsdato && (!kjopAlder || kjopsalderAv({ kjopsdato: ny.kjopsdato, kjopAlder: "" }, idag) !== kjopAlder)) ny.kjopsdato = "";
  return rettOppdaget(ny, idag);
}

function feil(i: Innsending, steg: Steg, idag: string): string | null {
  if (steg === 1) {
    if (i.kjopsdato && !gyldigKjopsdato(i.kjopsdato, idag)) return erDato(i.kjopsdato) && i.kjopsdato > idag ? "Kjøpet kan ikke være i fremtiden." : "Skriv kjøpsdatoen som en gyldig dato.";
    if (!kjopsalderAv(i, idag)) return "Velg når du kjøpte bilen.";
    if (i.kjopesum && !heltall(i.kjopesum, 1, MAKS_KJOPESUM)) return "Oppgi hva bilen kostet i hele kroner.";
    if (i.kmVedKjop && !heltall(i.kmVedKjop, 0, MAKS_KM)) return "Oppgi kilometerstanden som et tall.";
  }
  if (steg === 2) {
    if (i.feiltyper.length === 0) return "Velg hva som er galt.";
    if (!i.oppdaget || !OPPDAGET_VALG.includes(i.oppdaget)) return "Velg hvor lenge etter kjøpet feilen viste seg.";
    if (!oppdagetMulig(i, i.oppdaget, idag)) return "Feilen kan ikke ha vist seg så lenge etter kjøpet når kjøpet er så nylig.";
  }
  if (steg === 3) {
    if (i.opplystForKjop && !OPPLYST_VALG.includes(i.opplystForKjop)) return "Svar på om du ble fortalt om feilen.";
    if (i.feilOpplysning && !FEILOPPLYSNING_VALG.includes(i.feilOpplysning)) return "Svar på om annonsen eller selgeren sa noe som ikke stemte.";
    if (sporOmOpplysning(i, idag)) {
      if (!i.opplystForKjop) return "Svar på om du ble fortalt om feilen.";
      if (i.opplystForKjop === "ja" && !i.feilOpplysning) return "Svar på om annonsen eller selgeren sa noe som ikke stemte.";
    }
    if (!i.kontakt || !KONTAKT_VALG.includes(i.kontakt)) return "Svar på om du har kontaktet forhandleren.";
    if (sporOmFemarsfrist(i, idag) && !jaNei(i.reklamertInnenFemAr)) return "Svar på om du tok det opp med forhandleren innen fem år etter kjøpet.";
  }
  if (steg === 4 && sporOmBevis(i, idag)) {
    if (!jaNei(i.verkstedrapport)) return "Svar på om du har en verksted- eller tilstandsrapport.";
    if (i.verkstedrapport === "ja" && !jaNei(i.rapportSierForKjop)) return "Svar på hva rapporten sier om feilen.";
  }
  return null;
}

export const stegGyldig = (i: Innsending, steg: Steg, idag = iDag()): boolean => feil(i, steg, idag) === null;

const tekst = (v: unknown) => (typeof v === "string" ? v : "");

function sisteIMaaned(ar: string, maned: string): string {
  const siste = new Date(Date.UTC(Number(ar), Number(maned), 0)).getUTCDate();
  return `${ar}-${pad(Number(maned))}-${pad(siste)}`;
}

// The purchase date. Older links and saved cases carry month and year only (`kjopManed`, `kjopAr`);
// those become the last day of that month, as the form used to assume.
function kjopsdatoFra(r: Record<string, unknown>): string {
  if (tekst(r.kjopsdato)) return tekst(r.kjopsdato);
  const [ar, maned] = [tekst(r.kjopAr), tekst(r.kjopManed)];
  return heltall(ar, FRA_AR, 9999) && heltall(maned, 1, 12) ? sisteIMaaned(ar, maned) : "";
}

// Reads untrusted key/value input (request body or URL parameters) into the form state; anything
// unrecognised is dropped or left empty, so the result still has to pass `feil`.
export function lesInnsending(r: Record<string, unknown>, idag = iDag()): Innsending {
  const kjopsdato = kjopsdatoFra(r);
  return {
    // A valid exact day decides the answer to «hvor lenge siden».
    kjopAlder: kjopsalderAv({ kjopsdato, kjopAlder: tekst(r.kjopAlder) as Innsending["kjopAlder"] }, idag),
    kjopsdato,
    kjopesum: tekst(r.kjopesum),
    kmVedKjop: tekst(r.kmVedKjop),
    feiltyper: Array.isArray(r.feiltyper) ? (r.feiltyper.filter((t): t is FeilKnapp => FEILTYPER_KNAPPER.includes(t)) as FeilKnapp[]) : [],
    oppdaget: tekst(r.oppdaget) as Innsending["oppdaget"],
    opplystForKjop: tekst(r.opplystForKjop) as Innsending["opplystForKjop"],
    feilOpplysning: tekst(r.feilOpplysning) as Innsending["feilOpplysning"],
    kontakt: tekst(r.kontakt) as Innsending["kontakt"],
    reklamertInnenFemAr: tekst(r.reklamertInnenFemAr) as JaNei,
    verkstedrapport: tekst(r.verkstedrapport) as JaNei,
    rapportSierForKjop: tekst(r.rapportSierForKjop) as JaNei,
    bilder: tekst(r.bilder) as JaNei,
  };
}

// The answers as URL parameters, so an assessment can be linked to. Empty answers are left out and
// the defect types are comma-separated.
export function tilParametre(i: Innsending): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(i)) {
    const verdi = Array.isArray(v) ? v.join(",") : v;
    if (verdi) p.set(k, verdi);
  }
  return p;
}

// The reverse of `tilParametre`, for Next's `searchParams` (a value can be repeated) or a
// `URLSearchParams`.
export function fraParametre(p: Record<string, string | string[] | undefined> | URLSearchParams): Innsending {
  const hent = (k: string) => (p instanceof URLSearchParams ? p.get(k) : Array.isArray(p[k]) ? p[k][0] : p[k]) ?? "";
  // `kjopAr` and `kjopManed` are what older links carry instead of `kjopsdato`.
  const kjente = [...Object.keys(TOM_INNSENDING), "kjopAr", "kjopManed"];
  return lesInnsending({ ...Object.fromEntries(kjente.map((k) => [k, hent(k)])), feiltyper: hent("feiltyper").split(",") });
}

// The first step whose answers are missing or wrong, or null when the whole form is valid.
export function forsteUgyldigeSteg(i: Innsending, idag = iDag()): Steg | null {
  return stegFor(i, idag).find((s) => !stegGyldig(i, s, idag)) ?? null;
}

// Parses an untrusted request body into the engine's input.
export function tilKlageInput(raw: unknown, idag = iDag()): { ok: true; input: KlageInput } | { ok: false; feil: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, feil: "Ugyldig forespørsel." };
  const i = lesInnsending(raw as Record<string, unknown>, idag);
  const f = feil(i, 1, idag) ?? feil(i, 2, idag) ?? feil(i, 3, idag) ?? feil(i, 4, idag);
  if (f) return { ok: false, feil: f };

  const rapport = i.verkstedrapport === "ja";
  const ja = (v: JaNei) => (v === "ja" ? true : v === "nei" ? false : null);
  return {
    ok: true,
    input: {
      bilOgKjop: { ...(i.kjopsdato && { kjopsdato: i.kjopsdato }), kjopAlder: i.kjopAlder as Kjopsalder, kjopesumNok: i.kjopesum ? Number(i.kjopesum) : null, ...(i.kmVedKjop && { kmVedKjop: Number(i.kmVedKjop) }) },
      feilen: {
        typer: [...new Set(i.feiltyper)],
        oppdaget: i.oppdaget as Oppdaget,
        opplystForKjop: i.opplystForKjop || null,
        // Not answered means the buyer has not said that anything was wrong.
        feilOpplysning: i.feilOpplysning || "nei",
        kontakt: i.kontakt as Kontakt,
        ...(sporOmFemarsfrist(i, idag) && { reklamertInnenFemAr: i.reklamertInnenFemAr === "ja" }),
      },
      bevis: {
        verkstedrapport: ja(i.verkstedrapport),
        rapportSierForKjop: rapport ? ja(i.rapportSierForKjop) : null,
        bilder: ja(i.bilder),
      },
    },
  };
}
