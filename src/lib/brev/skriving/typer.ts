import type { ArgumentId } from "./brevplan";
import type { Kilde } from "./saksmodell";

// What the author returns and what the check and the review find.

// One sentence of the letter and the arguments of the plan it covers (none for a plain transition).
export type Setning = { tekst: string; argumenter: ArgumentId[] };
export type Avsnitt = { setninger: Setning[] };
// A word-for-word extract of a pasted text; the letter refers to it as {{sitat:id}}.
export type SitatUtdrag = { id: string; kilde: Kilde; tekst: string };
export type Utkast = { sitater: SitatUtdrag[]; avsnitt: Avsnitt[] };

export type AvvikRegel =
  | "dekning"
  | "forbudt"
  | "ukjent_argument"
  | "merke"
  | "sitat"
  | "anforselstegn"
  | "tall"
  | "dato"
  | "gjentakelse"
  | "hakeparentes"
  | "relativ_tid"
  | "lengde"
  | "personopplysning"
  | "paragraf"
  | "rekkefolge";
export type Avvik = { regel: AvvikRegel; tekst: string; setning?: string };
// A point of the review's rubric the letter does not meet.
export type Funn = { punkt: string; hvorfor: string; setning: string };
