import { normaliserRegnr, type Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import { orgnrFra } from "@/lib/brreg";
import { erDato } from "@/lib/vurdering/faktorer";
import type { Innsending } from "@/lib/vurdering/innsending";
import type { Adresse, Forhandler } from "@/lib/vurdering/typer";

// What the buyer has filled in on the letter page, step by step. A missing value leaves its
// placeholder in the letter. Stored with the case (brevsak.utfylling).
export type Utfylling = {
  kjoretoy?: Kjoretoy;
  forhandler?: Forhandler;
  feilen?: Feilen;
  opplysning?: Opplysning;
  reklamasjon?: Reklamasjon;
  krav?: Krav;
  vedlegg?: Vedlegg[];
  avsender?: Avsender;
  // How many suggestions the language model has made for this case. Counted on the server; the
  // page cannot set it.
  sprakvask?: number;
};

// What the page can save: everything but the server's own counter.
type Felt = Exclude<keyof Utfylling, "sprakvask">;

// The defect: the day it showed, the buyer's own words, and the text that goes in the letter
// (the buyer's own, a suggestion from the language model, or an edited one).
export type Feilen = { dato: string; egen: string; tekst: string };

// What the ad or the dealer said that turned out to be wrong, and where it was said.
export const OPPLYSNING_KILDER = ["annonse", "kontrakt", "melding", "muntlig"] as const;
export type Opplysning = { kilde: (typeof OPPLYSNING_KILDER)[number]; tekst: string };

// The first complaint to the dealer. `forsok` is how many times the dealer has tried to repair.
export const REKLAMASJON_MATER = ["epost", "sms", "telefon", "oppmote", "brev"] as const;
export type Reklamasjon = { dato: string; mate: (typeof REKLAMASJON_MATER)[number]; forsok?: number };

// What the buyer claims. `type` is the choice once the dealer has refused or failed to repair;
// `utbedringNok` is the cost of repair, when known, for a price reduction; `utgifter` are costs
// claimed as damages.
export const KRAV_TYPER = ["prisavslag", "heving"] as const;
export const UTGIFT_TYPER = ["verksted", "tauing", "leiebil", "annet"] as const;
export type Utgift = { type: (typeof UTGIFT_TYPER)[number]; belopNok: number };
export type Krav = { type?: (typeof KRAV_TYPER)[number]; utbedringNok?: number; utgifter: Utgift[] };

export const VEDLEGG = ["kjopekontrakt", "verkstedrapport", "bilder", "annonse", "meldinger", "kvitteringer"] as const;
export type Vedlegg = (typeof VEDLEGG)[number];

export type Avsender = { navn: string; adresse: string; postnummer: string; poststed: string; telefon?: string };

// What a save is checked against: the answers from the assessment and today's date.
export type Kontekst = { svar: Pick<Innsending, "kjopsdato">; idag: string };

// One save from the page: the fields that changed. null clears a field.
export type Endring = { [K in Felt]?: Utfylling[K] | null };

// How long a case is kept after it was last changed.
export const LEVETID_DAGER = 30;
export const utloperEtter = (na: Date) => new Date(na.getTime() + LEVETID_DAGER * 24 * 60 * 60 * 1000);

// The id in the address of a case: 16 random bytes as base64url.
export const erSakId = (s: string) => /^[A-Za-z0-9_-]{22}$/.test(s);

const erObjekt = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// One line of text for the letter: trimmed, without control characters, and without square
// brackets, which the letter reserves for what is still missing. null when empty or too long.
function tekst(v: unknown, maks: number, min = 1): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\[/g, "(").replace(/\]/g, ")").replace(/\s+/g, " ").trim();
  return t.length >= min && t.length <= maks ? t : null;
}

function lesKjoretoy(v: unknown): Kjoretoy | null {
  if (!erObjekt(v)) return null;
  const regnr = tekst(v.regnr, 10);
  const merke = tekst(v.merke, 60);
  const modell = tekst(v.modell, 60);
  const ar = v.ar === null ? null : typeof v.ar === "number" && Number.isInteger(v.ar) && v.ar > 1900 && v.ar < 2100 ? v.ar : undefined;
  if (!regnr || !normaliserRegnr(regnr) || !merke || !modell || ar === undefined) return null;
  return { regnr, merke, modell, ar };
}

function lesAdresse(v: unknown): Adresse | null {
  if (!erObjekt(v) || !Array.isArray(v.linjer) || v.linjer.length > 3) return null;
  const linjer = v.linjer.map((l) => tekst(l, 100));
  const poststed = tekst(v.poststed, 50);
  if (linjer.some((l) => l === null) || typeof v.postnummer !== "string" || !/^\d{4}$/.test(v.postnummer) || !poststed) return null;
  return { linjer: linjer as string[], postnummer: v.postnummer, poststed };
}

function lesForhandler(v: unknown): Forhandler | null {
  if (!erObjekt(v)) return null;
  if (v.type === "fritekst") {
    const navn = tekst(v.navn, 100, 2);
    return navn ? { type: "fritekst", navn } : null;
  }
  if (v.type !== "brreg") return null;
  const navn = tekst(v.navn, 100, 2);
  const orgnr = typeof v.orgnr === "string" ? orgnrFra(v.orgnr) : null;
  if (!navn || !orgnr) return null;
  if (v.adresse === undefined) return { type: "brreg", orgnr, navn };
  const adresse = lesAdresse(v.adresse);
  return adresse ? { type: "brreg", orgnr, navn, adresse } : null;
}

const heltall = (v: unknown, min: number, maks: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks;
const blant = <T extends string>(valg: readonly T[], v: unknown): v is T => typeof v === "string" && (valg as readonly string[]).includes(v);

// A day from the purchase on, not in the future.
const etterKjop = (v: unknown, k: Kontekst): v is string => erDato(v) && v >= k.svar.kjopsdato && v <= k.idag;

export const BESKRIVELSE_MIN = 20;
export const BESKRIVELSE_MAKS = 1500;
// How many suggestions the language model makes for one case.
export const MAKS_SPRAKVASK = 10;

// The buyer's description of the defect, as it must be to be saved or sent to the language model.
export const lesBeskrivelse = (v: unknown): string | null => tekst(v, BESKRIVELSE_MAKS, BESKRIVELSE_MIN);

function lesFeilen(v: unknown, k: Kontekst): Feilen | null {
  if (!erObjekt(v) || !etterKjop(v.dato, k)) return null;
  const egen = tekst(v.egen, BESKRIVELSE_MAKS, BESKRIVELSE_MIN);
  const iBrevet = tekst(v.tekst, BESKRIVELSE_MAKS, BESKRIVELSE_MIN);
  return egen && iBrevet ? { dato: v.dato, egen, tekst: iBrevet } : null;
}

function lesOpplysning(v: unknown): Opplysning | null {
  if (!erObjekt(v) || !blant(OPPLYSNING_KILDER, v.kilde)) return null;
  const t = tekst(v.tekst, 500, 5);
  return t ? { kilde: v.kilde, tekst: t } : null;
}

function lesReklamasjon(v: unknown, k: Kontekst): Reklamasjon | null {
  if (!erObjekt(v) || !etterKjop(v.dato, k) || !blant(REKLAMASJON_MATER, v.mate)) return null;
  if (v.forsok === undefined) return { dato: v.dato, mate: v.mate };
  return heltall(v.forsok, 1, 9) ? { dato: v.dato, mate: v.mate, forsok: v.forsok } : null;
}

const MAKS_BELOP = 50_000_000;
export const MAKS_UTGIFTER = 8;

function lesKrav(v: unknown): Krav | null {
  if (!erObjekt(v) || !Array.isArray(v.utgifter) || v.utgifter.length > MAKS_UTGIFTER) return null;
  const utgifter: Utgift[] = [];
  for (const u of v.utgifter) {
    if (!erObjekt(u) || !blant(UTGIFT_TYPER, u.type) || !heltall(u.belopNok, 1, MAKS_BELOP)) return null;
    utgifter.push({ type: u.type, belopNok: u.belopNok });
  }
  if (v.type !== undefined && !blant(KRAV_TYPER, v.type)) return null;
  if (v.utbedringNok !== undefined && !heltall(v.utbedringNok, 1, MAKS_BELOP)) return null;
  return { ...(v.type !== undefined && { type: v.type }), ...(v.utbedringNok !== undefined && { utbedringNok: v.utbedringNok }), utgifter };
}

// Each attachment once, in the fixed order.
function lesVedlegg(v: unknown): Vedlegg[] | null {
  if (!Array.isArray(v) || v.some((x) => !blant(VEDLEGG, x))) return null;
  return VEDLEGG.filter((x) => v.includes(x));
}

function lesAvsender(v: unknown): Avsender | null {
  if (!erObjekt(v)) return null;
  const navn = tekst(v.navn, 100, 2);
  const adresse = tekst(v.adresse, 100, 2);
  const poststed = tekst(v.poststed, 50);
  if (!navn || !adresse || !poststed || typeof v.postnummer !== "string" || !/^\d{4}$/.test(v.postnummer)) return null;
  if (v.telefon === undefined || v.telefon === "") return { navn, adresse, postnummer: v.postnummer, poststed };
  const telefon = typeof v.telefon === "string" ? v.telefon.replace(/\s+/g, " ").trim() : "";
  return /^\+?[\d ]{8,16}$/.test(telefon) ? { navn, adresse, postnummer: v.postnummer, poststed, telefon } : null;
}

const LESERE: { [K in Felt]: (v: unknown, k: Kontekst) => Utfylling[K] | null } = {
  kjoretoy: lesKjoretoy,
  forhandler: lesForhandler,
  feilen: lesFeilen,
  opplysning: lesOpplysning,
  reklamasjon: lesReklamasjon,
  krav: lesKrav,
  vedlegg: lesVedlegg,
  avsender: lesAvsender,
};

// Parses an untrusted save from the page. Every field is checked; one bad field rejects the save.
export function lesEndring(raw: unknown, kontekst: Kontekst): { ok: true; endring: Endring } | { ok: false; feil: string } {
  if (!erObjekt(raw)) return { ok: false, feil: "Ugyldig forespørsel." };
  const endring: Record<string, unknown> = {};
  for (const [felt, verdi] of Object.entries(raw)) {
    if (!Object.hasOwn(LESERE, felt)) return { ok: false, feil: "Ugyldig forespørsel." };
    if (verdi === null) {
      endring[felt] = null;
      continue;
    }
    const lest = LESERE[felt as Felt](verdi, kontekst);
    if (lest === null) return { ok: false, feil: "Vi kunne ikke lagre det du fylte inn. Sjekk feltet og prøv igjen." };
    endring[felt] = lest;
  }
  return { ok: true, endring: endring as Endring };
}

// The fill-in after the answers of the assessment were changed. A date that falls before the new
// purchase date (or after today) can no longer be true, so it is dropped and the step is asked again.
export function tilpassTilSvar(u: Utfylling, svar: Pick<Innsending, "kjopsdato">, idag: string): Utfylling {
  const ny: Utfylling = { ...u };
  for (const felt of ["feilen", "reklamasjon"] as const) {
    const dato = ny[felt]?.dato;
    if (dato !== undefined && !(dato >= svar.kjopsdato && dato <= idag)) delete ny[felt];
  }
  return ny;
}

// The stored fill-in with a save applied: changed fields replaced, cleared fields removed.
export function medEndring(u: Utfylling, endring: Endring): Utfylling {
  const ny: Record<string, unknown> = { ...u };
  for (const [felt, verdi] of Object.entries(endring)) {
    if (verdi === null) delete ny[felt];
    else ny[felt] = verdi;
  }
  return ny as Utfylling;
}
