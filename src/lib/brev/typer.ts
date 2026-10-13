import type { Adresse } from "@/lib/brreg";
import type { Krav } from "@/lib/matching/typer";
import type { Vippsprofil } from "@/lib/vipps/profil";
import type { Kilde } from "@/lib/vedtaksvalg/kjoper";
import type { Rapport, SelgerSvar } from "./rapport";

export type { Kilde };
export type SomDenEr = "ja" | "nei" | "vet_ikke";

// One sentence of the letter and where it comes from: a form answer («skjema:feil[0].tid»), the
// register («brreg:selger»), the buyer's profile («vipps:navn»), a statute («lov:etter_2024:avvik»),
// a decision («vedtak:22/2868») or the template itself («fast»). A sentence with no source is a bug.
export type Setning = { tekst: string; kilde: string; lenke?: string };

export type Brevfeil = {
  hoved: string;
  under: string[];
  // The day the buyer first noticed the defect, and whether that day is only approximate. Everything
  // the law turns on is worked out from it (tidslinje.ts).
  oppdaget: string;
  omtrentlig: boolean;
  // The buyer's own words, up to 200 characters.
  beskrivelse: string | null;
  // Did the seller write or say anything about this before the sale?
  opplysning: Kilde;
  verksted: Kilde;
  // What a workshop has put in writing about this defect: with verksted = skriftlig, otherwise null.
  rapport: Rapport | null;
};

// The buyer has complained to the seller before this letter. Without this the letter is the complaint.
export type Kontakt = {
  dato: string;
  form: "skriftlig" | "muntlig";
  // How many times the seller has tried to repair the defect: 0 to 3 (3 is «three or more»).
  forsok: number;
  svar: SelgerSvar;
};

export type Selger = { navn: string; orgnr: string; adresse: Adresse | null };

// Everything the letter is built from. The buyer is null before payment.
export type Brevsak = {
  // The date of the letter, ISO.
  dato: string;
  kjoper: Vippsprofil | null;
  selger: Selger;
  bil: { regnr: string; merke: string; modell: string; forsteRegistrert: number | null };
  // The day the buyer took over the car. The form has no separate handover date, so the purchase date
  // stands for it wherever the letter says «overtakelsen».
  kjopsdato: string;
  km: number;
  kjopesum: number;
  somDenEr: SomDenEr;
  feil: Brevfeil[];
  krav: Krav;
  utlegg: { beskrivelse: string; belop: number }[];
  kontakt: Kontakt | null;
  // The paragraph citing the decision (finnVedtak). null when there was no candidate and the letter
  // rests on the law.
  praksis: { avsnitt: string; kildeUrl: string; saksnummer: string | null } | null;
};

// A block of the letter: sentences that run together. `forhandsvis` keeps it in the preview.
export type Blokk = { setninger: Setning[]; forhandsvis?: boolean } | { skjult: number };
export type Avsnitt = { nr: number; overskrift: Setning; blokker: Blokk[] };

export type Brev = {
  avsender: Setning[];
  stedDato: Setning;
  mottaker: Setning[];
  tittel: Setning;
  avsnitt: Avsnitt[];
  hilsen: Setning[];
  vedlegg: { overskrift: Setning; punkter: Setning[] } | null;
};
