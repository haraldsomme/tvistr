// Cases for the tests and the scripts: a base case, the defect sets the templates branch on, and a
// product over axes. Every name and number here is fictitious.
import { STUB_PROFIL } from "@/lib/vipps/profil";
import type { VisteSegValg } from "@/lib/feil/kategorier";
import { vurderRiktighet } from "./riktighet";
import { plussManeder, vurderTidslinje } from "./tidslinje";
import type { Rapport } from "./rapport";
import type { Brevfeil, Brevsak, Kilde, Kontakt } from "./typer";

// The purchase dates leave room for a defect discovered more than two years later, before the letter.
export const KJOPSDATO = { før_2024: "2023-05-02", etter_2024: "2024-03-10" } as const;
// The date of an earlier complaint: after a defect «6–24 måneder» (discovered 12 months after the
// purchase, TID_MND) and before one «over 24 måneder», which the letter then complains about itself.
export const KONTAKT_DATO = { før_2024: "2024-06-01", etter_2024: "2025-04-01" } as const;

export const kontakt = (lov: Lov, o: Partial<Kontakt> = {}): Kontakt => ({ dato: KONTAKT_DATO[lov], form: "skriftlig", forsok: 0, svar: "annet", ...o });

// A report that covers whatever the test is about. The date is after both purchase dates.
// Its date «+1» is a month after the defect was discovered (see lagSak).
export const RAPPORT: Rapport = { hvem: "uavhengig", navn: "Nordre Bil og Verksted AS", dato: "+1", punkter: ["bekrefter", "arsak"], konklusjon: null, overslag: null };

export const PRAKSIS = {
  avsnitt: "Det vises til Forbrukerklageutvalgets vedtak i sak 22/2868 av 22.3.2023. Saken gjaldt turbo på en Ford S-Max som hadde gått 106 500 km ved kjøpet. Utvalget uttalte: «Det foreligger en mangel.»",
  kildeUrl: "https://example.org/vedtak/22-2868",
  saksnummer: "22/2868",
};

export const BASE: Brevsak = {
  dato: "2026-10-13",
  kjoper: STUB_PROFIL,
  selger: { navn: "Testbil AS", orgnr: "999999999", adresse: { linjer: ["Verkstedveien 2"], postnummer: "0585", poststed: "Oslo" } },
  bil: { regnr: "AB12345", merke: "Volkswagen", modell: "Golf", forsteRegistrert: 2016 },
  kjopsdato: KJOPSDATO.etter_2024,
  km: 142_000,
  kjopesum: 185_000,
  somDenEr: "nei",
  feil: [],
  krav: "prisavslag",
  utlegg: [],
  kontakt: null,
  praksis: PRAKSIS,
};

// A written workshop assessment comes with a report; give `rapport` to change it.
// The tests name the time by the interval the form used to ask for, and the defect is discovered
// that many months after the purchase («+2» is resolved by lagSak): within six months, a year, or two
// and a half years.
export const TID_MND: Record<VisteSegValg, number> = { innen_6_mnd: 2, "6_til_24_mnd": 12, over_24_mnd: 30 };

export const feil = (hoved: string, under: string[], tid: VisteSegValg, opplysning: Kilde, verksted: Kilde, beskrivelse: string | null = null, rapport?: Rapport | null): Brevfeil => ({
  hoved,
  under,
  oppdaget: `+${TID_MND[tid]}`,
  omtrentlig: false,
  beskrivelse,
  opplysning,
  verksted,
  rapport: rapport === undefined ? (verksted === "skriftlig" ? RAPPORT : null) : rapport,
});

// The defect sets the templates branch on: one of each kind, two of different time, mixed kinds, and
// a main category whose subcategories are of different kinds.
export const FEILSETT: Record<string, (t: VisteSegValg, o: Kilde, v: Kilde, b?: string | null) => Brevfeil[]> = {
  teknisk: (t, o, v, b) => [feil("motor", ["turbo"], t, o, v, b)],
  opplysning: (t, o, v, b) => [feil("service", ["servicehefte"], t, o, v, b)],
  garanti: (t, o, v, b) => [feil("garanti", [], t, o, v, b)],
  vet_ikke: (t, o, v, b) => [feil("vet_ikke", ["varsellampe"], t, o, v, b)],
  to_tekniske_ulik_tid: (t, o, v, b) => [feil("motor", ["turbo"], t, o, v, b), feil("elektrisk", ["lys"], t === "innen_6_mnd" ? "over_24_mnd" : "innen_6_mnd", o, v)],
  teknisk_og_opplysning: (t, o, v, b) => [feil("motor", ["turbo"], t, o, v, b), feil("historikk", ["km"], t, o, v)],
  utstyr_blandet: (t, o, v, b) => [feil("utstyr", ["dekk", "nokler"], t, o, v, b)],
  uten_underkategori: (t, o, v, b) => [feil("historikk", [], t, o, v, b)],
};
export const FEILSETT_ENKLE = ["teknisk", "opplysning", "garanti", "vet_ikke"] as const;

export type Lov = keyof typeof KJOPSDATO;

// «+n» is n months after a date: a defect's discovery after the purchase, a report after the discovery.
const relativ = (iso: string, fra: string) => (iso.startsWith("+") ? plussManeder(fra, Number(iso.slice(1))) : iso);

// A case the form and the server would stop. lagSak refuses it, so no test can build a letter the
// form never allows (a complaint dated before the defect once slipped through this way); samle leaves
// such combinations out and counts them.
export class UgyldigSak extends Error {}

// The rules that stop the case, as the form and the server judge it (tidslinje.ts and riktighet.ts).
export function stoppFor(s: Brevsak): string[] {
  const t = vurderTidslinje({
    kjop: s.kjopsdato,
    feil: s.feil.map((f, i) => ({ id: `${i}`, oppdaget: f.oppdaget, omtrentlig: f.omtrentlig, ...(f.rapport && { rapport: f.rapport.dato }) })),
    ...(s.kontakt && { reklamert: s.kontakt.dato }),
    idag: s.dato,
  });
  const r = vurderRiktighet({
    kjopsdato: s.kjopsdato,
    kjopesum: s.kjopesum,
    forsteRegistrert: s.bil.forsteRegistrert,
    somDenEr: s.somDenEr,
    krav: s.krav,
    forsok: s.kontakt?.forsok ?? 0,
    svar: s.kontakt?.svar ?? null,
    feil: s.feil.map((f) => ({ ...f, konklusjon: f.rapport?.konklusjon ?? null })),
    utlegg: s.utlegg,
    selger: null,
  });
  return [...t.stopp, ...r.stopp].map((m) => m.regel);
}

// The case a builder makes, or nothing when the form would stop it: for lists over many combinations.
export function gyldig<T>(bygg: () => T): T[] {
  try {
    return [bygg()];
  } catch (e) {
    if (e instanceof UgyldigSak) return [];
    throw e;
  }
}

export function lagSak(lov: Lov, endring: Partial<Brevsak> = {}): Brevsak {
  // A symptom alone can only be examined and repaired, so such a case asks for repair unless the test says otherwise.
  const kunSymptom = !!endring.feil?.length && endring.feil.every((f) => f.hoved === "vet_ikke");
  const s = { ...BASE, kjopsdato: KJOPSDATO[lov], ...(kunSymptom && { krav: "retting" as const }), ...endring };
  const sak = {
    ...s,
    feil: s.feil.map((f) => {
      const oppdaget = relativ(f.oppdaget, s.kjopsdato);
      return { ...f, oppdaget, rapport: f.rapport && { ...f.rapport, dato: relativ(f.rapport.dato, oppdaget) } };
    }),
  };
  const stopp = stoppFor(sak);
  if (stopp.length) throw new UgyldigSak(`Saken stoppes av skjemaet: ${stopp.join(", ")}`);
  return sak;
}

// The product of the axes: [{a: 1, b: "x"}, {a: 1, b: "y"}, ...].
export function produkt<T extends Record<string, readonly unknown[]>>(akser: T): { [K in keyof T]: T[K][number] }[] {
  return Object.entries(akser).reduce<Record<string, unknown>[]>((acc, [navn, verdier]) => acc.flatMap((a) => verdier.map((v) => ({ ...a, [navn]: v }))), [{}]) as never;
}

// The distinct texts a builder gives over the axes, each with the first input that gave it and how
// many inputs gave the same. Written to a snapshot file, so any change in a template shows as a diff.
export function samle<T extends Record<string, readonly unknown[]>>(akser: T, bygg: (valg: { [K in keyof T]: T[K][number] }) => string): string {
  const tekster = new Map<string, { valg: unknown; antall: number }>();
  let ugyldige = 0;
  for (const valg of produkt(akser)) {
    let tekst: string;
    try {
      tekst = bygg(valg);
    } catch (e) {
      if (!(e instanceof UgyldigSak)) throw e;
      ugyldige++;
      continue;
    }
    const funnet = tekster.get(tekst);
    if (funnet) funnet.antall++;
    else tekster.set(tekst, { valg, antall: 1 });
  }
  const hode = `${tekster.size} ulike tekster over ${Object.entries(akser).map(([k, v]) => `${k}(${v.length})`).join(" × ")}${ugyldige ? ` (${ugyldige} kombinasjoner skjemaet stopper er utelatt)` : ""}`;
  return [hode, ...[...tekster].map(([tekst, { valg, antall }]) => `\n## ${JSON.stringify(valg)}${antall > 1 ? ` (+${antall - 1} like)` : ""}\n${tekst}`)].join("\n") + "\n";
}
