import type { Adresse } from "@/lib/brreg";
import type { VisteSegValg } from "@/lib/feil/kategorier";
import type { Krav } from "@/lib/matching/typer";
import type { Vippsprofil } from "@/lib/vipps/profil";
import type { Kilde } from "@/lib/vedtaksvalg/kjoper";

export type { Kilde };
export type SomDenEr = "ja" | "nei" | "vet_ikke";

// One sentence of the letter and where it comes from: a form answer («skjema:feil[0].tid»), the
// register («brreg:selger»), the buyer's profile («vipps:navn»), a statute («lov:etter_2024:avvik»),
// a decision («vedtak:22/2868») or the template itself («fast»). A sentence with no source is a bug.
export type Setning = { tekst: string; kilde: string; lenke?: string };

export type Brevfeil = {
  hoved: string;
  under: string[];
  tid: VisteSegValg;
  // The buyer's own words, up to 200 characters.
  beskrivelse: string | null;
  // Did the seller write or say anything about this before the sale?
  opplysning: Kilde;
  verksted: Kilde;
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
  forsok: number;
  utlegg: { beskrivelse: string; belop: number }[];
  overslag: number | null;
  tidligere: { dato: string; form: "skriftlig" | "muntlig" } | null;
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
