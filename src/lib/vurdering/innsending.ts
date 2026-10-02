import { ABSOLUTT_FRIST_AR, iDag, leggTilManeder } from "./faktorer";
import { FEILOPPLYSNING_VALG, KONTAKT_VALG, OPPDAGET_VALG, type FeilKnapp, type KlageInput, type Kontakt, type Oppdaget } from "./typer";

// What the form collects (steps 1–4) and the checks shared by the client (enables «Neste») and the
// API route (never trusts the client). Nothing here is stored.

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
export const OPPLYST_VALG = ["ja", "nei", "usikker"] as const;
export const JA_NEI = ["ja", "nei"] as const;
export const FRA_AR = 1990;
const MAKS_KJOPESUM = 50_000_000;
const MAKS_KM = 2_000_000;

type JaNei = (typeof JA_NEI)[number] | "";

export type Steg = 1 | 2 | 3 | 4;

export type Innsending = {
  kjopManed: string; // "1"–"12"
  kjopAr: string; // four digits
  kjopesum: string; // whole kroner, digits only
  kmVedKjop: string; // odometer at purchase, digits only
  feiltyper: FeilKnapp[];
  oppdaget: Oppdaget | "";
  opplystForKjop: (typeof OPPLYST_VALG)[number] | "";
  feilOpplysning: (typeof FEILOPPLYSNING_VALG)[number] | "";
  kontakt: Kontakt | "";
  reklamasjonManed: string; // "1"–"12"; asked when the purchase is over five years old and the dealer is contacted
  reklamasjonAr: string;
  verkstedrapport: JaNei;
  rapportSierForKjop: JaNei; // asked when there is a report
  bilder: JaNei; // asked when there is no report
};

export const TOM_INNSENDING: Innsending = {
  kjopManed: "",
  kjopAr: "",
  kjopesum: "",
  kmVedKjop: "",
  feiltyper: [],
  oppdaget: "",
  opplystForKjop: "",
  feilOpplysning: "",
  kontakt: "",
  reklamasjonManed: "",
  reklamasjonAr: "",
  verkstedrapport: "",
  rapportSierForKjop: "",
  bilder: "",
};

const heltall = (s: string, min: number, max: number) => /^\d{1,9}$/.test(s) && Number(s) >= min && Number(s) <= max;
const jaNei = (v: string): v is "ja" | "nei" => v === "ja" || v === "nei";

const pad = (n: number) => String(n).padStart(2, "0");

// The first day of the purchase month, for «has at least this long passed» checks.
const forsteIMaaned = (i: Innsending) => `${i.kjopAr}-${pad(Number(i.kjopManed))}-01`;

// The last day of the purchase month. The form asks for month and year only, and the later date
// gives the buyer the benefit of the doubt on the five-year deadline.
export function kjopsdatoFra(i: Pick<Innsending, "kjopManed" | "kjopAr">): string {
  return sisteIMaaned(i.kjopAr, i.kjopManed);
}

function sisteIMaaned(ar: string, maned: string): string {
  const siste = new Date(Date.UTC(Number(ar), Number(maned), 0)).getUTCDate();
  return `${ar}-${pad(Number(maned))}-${pad(siste)}`;
}

// Has the purchase passed the five-year deadline, so that it matters when the buyer first complained?
// Same date as the engine uses, so the form asks exactly when the answer can change the result.
export function sporOmReklamasjonsdato(i: Pick<Innsending, "kjopManed" | "kjopAr" | "kontakt">, idag = iDag()): boolean {
  if (!i.kontakt || i.kontakt === "nei" || !heltall(i.kjopManed, 1, 12) || !heltall(i.kjopAr, FRA_AR, 9999)) return false;
  return idag > leggTilManeder(kjopsdatoFra(i), ABSOLUTT_FRIST_AR * 12);
}

function reklamasjonsdatoFeil(i: Innsending, idag: string): string | null {
  if (!heltall(i.reklamasjonManed, 1, 12) || !heltall(i.reklamasjonAr, FRA_AR, 9999)) return "Velg når du første gang tok opp feilen med forhandleren.";
  if (`${i.reklamasjonAr}-${pad(Number(i.reklamasjonManed))}-01` > idag) return "Reklamasjonen kan ikke være i fremtiden.";
  if (sisteIMaaned(i.reklamasjonAr, i.reklamasjonManed) < forsteIMaaned(i)) return "Du kan ikke ha reklamert før du kjøpte bilen.";
  return null;
}

const MIN_MANEDER: Record<Oppdaget, number> = { innen_6_mnd: 0, "6_mnd_til_2_ar": 6, over_2_ar: 24 };

// Can the defect have shown this long after the purchase? Needs year and month to be chosen.
export function oppdagetMulig(i: Pick<Innsending, "kjopManed" | "kjopAr">, oppdaget: Oppdaget, idag = iDag()): boolean {
  if (!heltall(i.kjopManed, 1, 12) || !heltall(i.kjopAr, FRA_AR, 9999)) return false;
  return leggTilManeder(`${i.kjopAr}-${pad(Number(i.kjopManed))}-01`, MIN_MANEDER[oppdaget]) <= idag;
}

function feil(i: Innsending, steg: Steg, idag: string): string | null {
  if (steg === 1) {
    if (!heltall(i.kjopManed, 1, 12) || !heltall(i.kjopAr, FRA_AR, 9999)) return "Velg når du kjøpte bilen.";
    if (forsteIMaaned(i) > idag) return "Kjøpet kan ikke være i fremtiden.";
    if (!heltall(i.kjopesum, 1, MAKS_KJOPESUM)) return "Oppgi hva bilen kostet.";
    if (!heltall(i.kmVedKjop, 0, MAKS_KM)) return "Oppgi kilometerstanden da du kjøpte bilen.";
  }
  if (steg === 2) {
    if (i.feiltyper.length === 0) return "Velg hva som er galt.";
    if (!i.oppdaget || !OPPDAGET_VALG.includes(i.oppdaget)) return "Velg hvor lenge etter kjøpet feilen viste seg.";
    if (!oppdagetMulig(i, i.oppdaget, idag)) return "Feilen kan ikke ha vist seg så lenge etter kjøpet når kjøpet er så nylig.";
  }
  if (steg === 3) {
    if (!i.opplystForKjop || !OPPLYST_VALG.includes(i.opplystForKjop)) return "Svar på om du ble fortalt om feilen.";
    if (!i.feilOpplysning || !FEILOPPLYSNING_VALG.includes(i.feilOpplysning)) return "Svar på om annonsen eller selgeren sa noe som ikke stemte.";
    if (!i.kontakt || !KONTAKT_VALG.includes(i.kontakt)) return "Svar på om du har kontaktet forhandleren.";
    if (sporOmReklamasjonsdato(i, idag)) return reklamasjonsdatoFeil(i, idag);
  }
  if (steg === 4) {
    if (!jaNei(i.verkstedrapport)) return "Svar på om du har en verksted- eller tilstandsrapport.";
    if (i.verkstedrapport === "ja" && !jaNei(i.rapportSierForKjop)) return "Svar på hva rapporten sier om feilen.";
    if (i.verkstedrapport === "nei" && !jaNei(i.bilder)) return "Svar på om du har bilder eller video av feilen.";
  }
  return null;
}

export const stegGyldig = (i: Innsending, steg: Steg, idag = iDag()): boolean => feil(i, steg, idag) === null;

const tekst = (v: unknown) => (typeof v === "string" ? v : "");

// Reads untrusted key/value input (request body or URL parameters) into the form state; anything
// unrecognised is dropped or left empty, so the result still has to pass `feil`.
export function lesInnsending(r: Record<string, unknown>): Innsending {
  return {
    kjopManed: tekst(r.kjopManed),
    kjopAr: tekst(r.kjopAr),
    kjopesum: tekst(r.kjopesum),
    kmVedKjop: tekst(r.kmVedKjop),
    feiltyper: Array.isArray(r.feiltyper) ? (r.feiltyper.filter((t): t is FeilKnapp => FEILTYPER_KNAPPER.includes(t)) as FeilKnapp[]) : [],
    oppdaget: tekst(r.oppdaget) as Innsending["oppdaget"],
    opplystForKjop: tekst(r.opplystForKjop) as Innsending["opplystForKjop"],
    feilOpplysning: tekst(r.feilOpplysning) as Innsending["feilOpplysning"],
    kontakt: tekst(r.kontakt) as Innsending["kontakt"],
    reklamasjonManed: tekst(r.reklamasjonManed),
    reklamasjonAr: tekst(r.reklamasjonAr),
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
  return lesInnsending({ ...Object.fromEntries(Object.keys(TOM_INNSENDING).map((k) => [k, hent(k)])), feiltyper: hent("feiltyper").split(",") });
}

// The first step whose answers are missing or wrong, or null when the whole form is valid.
export function forsteUgyldigeSteg(i: Innsending, idag = iDag()): Steg | null {
  return ([1, 2, 3, 4] as const).find((s) => !stegGyldig(i, s, idag)) ?? null;
}

// Parses an untrusted request body into the engine's input. The seller-type and private-use
// questions are not part of the form yet, so dealer purchase for private use is assumed.
export function tilKlageInput(raw: unknown, idag = iDag()): { ok: true; input: KlageInput } | { ok: false; feil: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, feil: "Ugyldig forespørsel." };
  const i = lesInnsending(raw as Record<string, unknown>);
  const f = feil(i, 1, idag) ?? feil(i, 2, idag) ?? feil(i, 3, idag) ?? feil(i, 4, idag);
  if (f) return { ok: false, feil: f };

  const rapport = i.verkstedrapport === "ja";
  return {
    ok: true,
    input: {
      kvalifisering: { selgerType: "forhandler", privatBruk: true },
      bilOgKjop: { kjopsdato: kjopsdatoFra(i), kjopesumNok: Number(i.kjopesum), kmVedKjop: Number(i.kmVedKjop) },
      feilen: {
        typer: [...new Set(i.feiltyper)],
        oppdaget: i.oppdaget as Oppdaget,
        opplystForKjop: i.opplystForKjop as Exclude<Innsending["opplystForKjop"], "">,
        feilOpplysning: i.feilOpplysning as Exclude<Innsending["feilOpplysning"], "">,
        kontakt: i.kontakt as Kontakt,
        ...(sporOmReklamasjonsdato(i, idag) && { forsteReklamasjon: sisteIMaaned(i.reklamasjonAr, i.reklamasjonManed) }),
      },
      bevis: {
        verkstedrapport: rapport,
        rapportSierForKjop: rapport ? i.rapportSierForKjop === "ja" : null,
        bilder: !rapport && i.bilder === "ja",
      },
    },
  };
}
