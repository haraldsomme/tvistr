import {
  erDato,
  iDag,
  kjopsalderFor,
  kjopsdatoFor,
  kjoptFor2024,
  leggTilManeder,
} from "./faktorer";
import {
  FEILOPPLYSNING_VALG,
  KJOPSALDER_VALG,
  KJOPSFORM_VALG,
  OPPDAGET_VALG,
  OPPLYST_VALG,
  type FeilKnapp,
  type KlageInput,
  type Kjopsalder,
  type Kjopsform,
  type Kontakt,
  type Oppdaget,
  type Opplyst,
} from "./typer";

// What the form collects (steps 1–2) and the checks shared by the client (enables «Neste») and the
// API route (never trusts the client). The assessment only asks for what can stop the claim and when the
// defect showed: when the car was bought, who it was bought from, whether the dealer was told within five
// years (only for a purchase over five years old), how long after the purchase the defect showed, and
// whether the buyer knew about it. A purchase that is not covered by the consumer purchase act, or past
// the five-year deadline, stops the form at step 1 (see `stoppGrunn`). The defect type, contact with the
// dealer, what was said, the report, pictures, the purchase price and the mileage are left empty here: the
// letter page asks for them in the step they belong to, and some are derived there instead of asked again
// (`avledSvar` in `src/lib/brev/svar.ts`). When they are given they are checked here too.

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
export const JA_NEI = ["ja", "nei"] as const;
export const FRA_AR = 1990;
const MAKS_KJOPESUM = 50_000_000;
const MAKS_KM = 2_000_000;

type JaNei = (typeof JA_NEI)[number] | "";

export type Steg = 1 | 2;

export type Innsending = {
  kjopAlder: Kjopsalder | ""; // how long ago the car was bought; the assessment asks for this
  kjopsform: Kjopsform | ""; // who the car was bought from
  kjopsdato: string; // the exact day, ÅÅÅÅ-MM-DD; empty until the registry or the letter page gives it
  kjopesum: string; // whole kroner, digits only; not asked in the assessment
  kmVedKjop: string; // odometer at purchase, digits only; not asked in the assessment
  feiltyper: FeilKnapp[]; // asked in «Feilen» after purchase
  oppdaget: Oppdaget | "";
  opplystForKjop: Opplyst | ""; // did the buyer know about the defect when buying
  feilOpplysning: (typeof FEILOPPLYSNING_VALG)[number] | ""; // derived after purchase from «Før kjøpet»
  kontakt: Kontakt | ""; // asked in «Kontakt med forhandleren» after purchase
  reklamertInnenFemAr: JaNei; // asked when the purchase is over five years old
  verkstedrapport: JaNei; // asked in «Tilstandsrapport» after purchase
  rapportSierForKjop: JaNei; // asked there when there is a report
  bilder: JaNei; // derived after purchase from the attachments
};

export const TOM_INNSENDING: Innsending = {
  kjopsform: "",
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
// the result. The assessment asks it without asking about contact first; after purchase a buyer who says
// the dealer was never told has answered it already.
export function sporOmFemarsfrist(i: Pick<Innsending, "kjopsdato" | "kjopAlder" | "kontakt">, idag = iDag()): boolean {
  return i.kontakt !== "nei" && kjopsalderAv(i, idag) === "over_5";
}

// The law itself stops the claim: a purchase from a private person or through a company (the consumer
// purchase act does not apply, § 1), past the five-year deadline (§ 27), or a defect the buyer knew of as
// it is, for a purchase certainly made before 2024 (§ 16 third paragraph as it read then). null when it
// does not. Same rule as the engine's `stopp`, so the form stops asking exactly when the answer is settled.
export type Stopp = "firma" | "privat" | "frist" | "kjent";
type StoppSvar = Pick<Innsending, "kjopsform" | "kjopsdato" | "kjopAlder" | "kontakt" | "reklamertInnenFemAr" | "opplystForKjop">;
export function stoppGrunn(i: StoppSvar, idag = iDag()): Stopp | null {
  if (i.kjopsform === "firma") return "firma";
  if (i.kjopsform === "privatperson") return "privat";
  const alder = kjopsalderAv(i, idag);
  if (alder === "over_5" && (i.kontakt === "nei" || i.reklamertInnenFemAr === "nei")) return "frist";
  const kjopsdato = gyldigKjopsdato(i.kjopsdato, idag) ? i.kjopsdato : undefined;
  if (alder && i.opplystForKjop === "ja_som_opplyst" && kjoptFor2024({ kjopsdato, kjopAlder: alder }, idag)) return "kjent";
  return null;
}

// The steps the form shows for these answers: «Bilen», then «Feilen». A claim the law stops at the first
// step (who the car was bought from, the five-year deadline) gets no second.
export function stegFor(i: StoppSvar, idag = iDag()): readonly Steg[] {
  const stopp = stoppGrunn(i, idag);
  return stopp && stopp !== "kjent" ? [1] : [1, 2];
}

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
    if (!KJOPSFORM_VALG.includes(i.kjopsform as Kjopsform))
      return "Svar på hvem du kjøpte bilen av.";
    if (sporOmFemarsfrist(i, idag) && !jaNei(i.reklamertInnenFemAr))
      return "Svar på om du tok opp feilen med forhandleren innen fem år etter kjøpet.";
  }
  if (steg === 2) {
    if (!i.oppdaget || !OPPDAGET_VALG.includes(i.oppdaget)) return "Velg hvor lenge etter kjøpet feilen viste seg.";
    if (!oppdagetMulig(i, i.oppdaget, idag)) return "Feilen kan ikke ha vist seg så lenge etter kjøpet når kjøpet er så nylig.";
    if (!OPPLYST_VALG.includes(i.opplystForKjop as Opplyst)) return "Svar på om du visste om feilen da du kjøpte bilen.";
  }
  return null;
}

// The answers the assessment does not ask, checked when they are given (after purchase, or in an older case).
function valgfrieFeil(i: Innsending): string | null {
  if (i.kjopesum && !heltall(i.kjopesum, 1, MAKS_KJOPESUM)) return "Oppgi hva bilen kostet i hele kroner.";
  if (i.kmVedKjop && !heltall(i.kmVedKjop, 0, MAKS_KM)) return "Oppgi kilometerstanden som et tall.";
  if (i.feilOpplysning && !FEILOPPLYSNING_VALG.includes(i.feilOpplysning)) return "Svar på om annonsen eller selgeren sa noe som ikke stemte.";
  if (i.verkstedrapport && !jaNei(i.verkstedrapport)) return "Svar på om du har en verksted- eller tilstandsrapport.";
  if (i.verkstedrapport === "ja" && i.rapportSierForKjop && !jaNei(i.rapportSierForKjop)) return "Svar på hva rapporten sier om feilen.";
  if (i.bilder && !jaNei(i.bilder)) return "Svar på om du har bilder av feilen.";
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
    kjopsform: tekst(r.kjopsform) as Innsending["kjopsform"],
    kjopAlder: kjopsalderAv(
      { kjopsdato, kjopAlder: tekst(r.kjopAlder) as Innsending["kjopAlder"] },
      idag,
    ),
    kjopsdato,
    kjopesum: tekst(r.kjopesum),
    kmVedKjop: tekst(r.kmVedKjop),
    feiltyper: Array.isArray(r.feiltyper) ? (r.feiltyper.filter((t): t is FeilKnapp => FEILTYPER_KNAPPER.includes(t)) as FeilKnapp[]) : [],
    oppdaget: tekst(r.oppdaget) as Innsending["oppdaget"],
    // Older saved cases hold «ja» from when the question had two answers: it is read as «worse than I was
    // told», so no letter already bought is stopped by the third answer.
    opplystForKjop: (tekst(r.opplystForKjop) === "ja" ? "ja_verre" : tekst(r.opplystForKjop)) as Innsending["opplystForKjop"],
    feilOpplysning: tekst(r.feilOpplysning) as Innsending["feilOpplysning"],
    // Older saved cases hold what the dealer did (venter, avvist, ...): any of those means «ja».
    kontakt: (tekst(r.kontakt) === "" || tekst(r.kontakt) === "nei"
      ? tekst(r.kontakt)
      : "ja") as Innsending["kontakt"],
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
  // Only the steps the form shows for these answers: a stopped claim has no later answers.
  const f = stegFor(i, idag).reduce<string | null>((funnet, s) => funnet ?? feil(i, s, idag), null) ?? valgfrieFeil(i);
  if (f) return { ok: false, feil: f };

  const ja = (v: JaNei) => (v === "ja" ? true : v === "nei" ? false : null);
  // The vehicle's first registration year, sent alongside the answers from the registry lookup.
  const bilAr = (raw as Record<string, unknown>).bilAr;
  const gyldigBilAr = Number.isInteger(bilAr) && (bilAr as number) >= 1900 && (bilAr as number) <= Number(idag.slice(0, 4));
  return {
    ok: true,
    input: {
      bilOgKjop: {
        kjopsform: i.kjopsform as Kjopsform,
        ...(i.kjopsdato && { kjopsdato: i.kjopsdato }),
        kjopAlder: i.kjopAlder as Kjopsalder,
        kjopesumNok: i.kjopesum ? Number(i.kjopesum) : null,
        ...(i.kmVedKjop && { kmVedKjop: Number(i.kmVedKjop) }),
        ...(gyldigBilAr && { bilAr: bilAr as number }),
      },
      feilen: {
        // A claim stopped at the first step has no second; the engine stops it before it looks at these.
        oppdaget: (i.oppdaget || "innen_6_mnd") as Oppdaget,
        opplystForKjop: (i.opplystForKjop || "nei") as Opplyst,
        // What is asked after purchase is left out until it is answered, so nothing is claimed about it.
        ...(i.feiltyper.length > 0 && { typer: [...new Set(i.feiltyper)] }),
        ...(i.feilOpplysning && { feilOpplysning: i.feilOpplysning }),
        ...(i.kontakt && { kontakt: i.kontakt }),
        ...(sporOmFemarsfrist(i, idag) && { reklamertInnenFemAr: i.reklamertInnenFemAr === "ja" }),
      },
      bevis: {
        verkstedrapport: ja(i.verkstedrapport),
        rapportSierForKjop: i.verkstedrapport === "ja" ? ja(i.rapportSierForKjop) : null,
        bilder: ja(i.bilder),
      },
    },
  };
}
