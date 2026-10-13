// Cleans what the form sends. Everything that reaches a server action comes from outside, so every
// field is checked here before it is used: ids against the known lists, numbers against a range,
// text trimmed and cut. Shared by the decision search (finnVedtak) and the letter (byggBrevet).
import { orgnrFra } from "@/lib/brreg";
import { MAKS_BESKRIVELSE, MAKS_VERKSTEDNAVN, RAPPORT_PUNKTER, type Rapport, rensFritekst, rensKonklusjon, SELGER_SVAR, VERKSTED_HVEM } from "@/lib/brev/rapport";
import type { Brevfeil, Kilde, Kontakt, SomDenEr } from "@/lib/brev/typer";
import { type Riktighetssak, vurderRiktighet } from "@/lib/brev/riktighet";
import { erDato, type Vurdering, vurderTidslinje } from "@/lib/brev/tidslinje";
import { type Feilvalg, HOVEDKATEGORIER, type Hovedkategori, rensFeilvalg } from "@/lib/feil/kategorier";
import { normaliserRegnr } from "@/lib/kjoretoy/vegvesen";
import type { Krav } from "@/lib/matching/typer";

// A real day written as YYYY-MM-DD («2025-02-30» is not one).
export const gyldigDato = (v: unknown): string | null => (erDato(v) ? v : null);
export const heltall = (v: unknown, min: number, maks: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks ? v : null);
export const tekst = (v: unknown, maks: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, maks) : null);

const KRAV: readonly Krav[] = ["retting", "prisavslag", "heving"];
const KILDER: readonly Kilde[] = ["skriftlig", "muntlig", "nei"];
const SOM_DEN_ER: readonly SomDenEr[] = ["ja", "nei", "vet_ikke"];
const kildeAv = (v: unknown) => KILDER.find((k) => k === v) ?? null;

// Today in Norway, so a letter written late in the evening is dated that day.
export const idagOslo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());

// A written report: who, the name, the date (after the purchase, not in the future), at least one tick,
// the conclusion cleaned (rensKonklusjon) and the estimate, which has a place only with the tick for it.
// null for anything else, so a half-filled report is not a report.
function rensRapport(r: unknown, kjopsdato: string | null): Rapport | null {
  const x = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
  const hvem = VERKSTED_HVEM.find((h) => h.id === x.hvem)?.id;
  const navn = tekst(x.navn, MAKS_VERKSTEDNAVN);
  const dato = gyldigDato(x.dato);
  const punkter = Array.isArray(x.punkter) ? RAPPORT_PUNKTER.filter((p) => (x.punkter as unknown[]).includes(p.id)).map((p) => p.id) : [];
  if (!hvem || !navn || !dato || !punkter.length || !kjopsdato || dato <= kjopsdato || dato > idagOslo()) return null;
  return { hvem, navn, dato, punkter, konklusjon: rensKonklusjon(x.konklusjon), overslag: punkter.includes("overslag") ? heltall(x.overslag, 1, 9_999_999) : null };
}

// Contact with the seller. `reklamert: false` is the letter being the complaint (no repairs, no answer).
// Complained before: a date after the purchase and not in the future, how, and what the seller has done.
// The number of repairs (1 to 3) belongs to «forsokt» only; every other answer is 0 repairs, whatever
// the browser sends.
// «invalid» when the buyer says yes and something is missing; null when the field is not there at all.
function rensKontakt(k: unknown, kjopsdato: string | null): { kontakt: Kontakt | null } | { ugyldig: true } | null {
  if (!k || typeof k !== "object") return null;
  const x = k as Record<string, unknown>;
  if (x.reklamert === false) return { kontakt: null };
  const dato = gyldigDato(x.dato);
  const form = x.form === "skriftlig" || x.form === "muntlig" ? x.form : null;
  const svar = SELGER_SVAR.find((o) => o.id === x.svar)?.id;
  const forsok = svar === "forsokt" ? heltall(x.forsok, 1, 3) : 0;
  if (x.reklamert !== true || !dato || !form || forsok === null || !svar || !kjopsdato || dato <= kjopsdato || dato > idagOslo()) return { ugyldig: true };
  return { kontakt: { dato, form, forsok, svar } };
}

export type Vedtakssvar = {
  // In the order of the categories, which is how the ranking has always read them.
  valgte: Hovedkategori[];
  // In the order the buyer chose them, for the letter.
  rekkefolge: string[];
  rent: Feilvalg;
  kjopsdato: string;
  km: number | null;
  ar: number | null;
  somDenEr: SomDenEr | null;
  krav: Krav | null;
  // 0 when the buyer has not complained before, the number of repairs when they have, null when not given.
  forsok: number | null;
  kontakt: Kontakt | null;
  detaljer: Record<string, { oppdaget: string; omtrentlig: boolean; beskrivelse: string | null; opplysning: Kilde | null; verksted: Kilde | null; rapport: Rapport | null }>;
  // The timeline judged (tidslinje.ts): no stops, possibly warnings, and the time level per defect.
  tidslinje: Vurdering;
};

type Resultat<T> = { ok: true; svar: T } | { ok: false; melding: string };

// What the decision search needs.
export function rensVedtakssvar(s: Record<string, unknown>): Resultat<Vedtakssvar> {
  const rent = rensFeilvalg(s.valg);
  const valgte = HOVEDKATEGORIER.filter((h) => h.id in rent);
  if (!valgte.length) return { ok: false, melding: "Velg minst én feil." };
  const dato = gyldigDato(s.kjopsdato);
  if (!dato) return { ok: false, melding: "Velg kjøpsdatoen." };

  const d = (s.detaljer && typeof s.detaljer === "object" ? s.detaljer : {}) as Record<string, Record<string, unknown> | undefined>;
  const detaljer: Vedtakssvar["detaljer"] = {};
  for (const h of valgte) {
    const verksted = kildeAv(d[h.id]?.verksted);
    const oppdaget = gyldigDato(d[h.id]?.oppdaget);
    if (!oppdaget) return { ok: false, melding: "Velg når du oppdaget hver feil." };
    detaljer[h.id] = {
      oppdaget,
      omtrentlig: d[h.id]?.omtrentlig === true,
      beskrivelse: rensFritekst(d[h.id]?.beskrivelse, MAKS_BESKRIVELSE),
      opplysning: kildeAv(d[h.id]?.opplysning),
      verksted,
      // A report belongs to an answer «ja, skriftlig» and to nothing else.
      rapport: verksted === "skriftlig" ? rensRapport(d[h.id]?.rapport, dato) : null,
    };
  }
  const kontakt = rensKontakt(s.kontakt, dato);
  if (kontakt && "ugyldig" in kontakt) return { ok: false, melding: "Fyll ut kontakten med selger: dato etter kjøpet, hvordan, og hva selger har gjort (med antall forsøk hvis selger har forsøkt å rette)." };

  // The order of the dates, judged by the same function as the form. What is impossible stops here,
  // whatever the browser allowed.
  const tidslinje = vurderTidslinje({
    kjop: dato,
    feil: valgte.map((h) => ({ id: h.id, oppdaget: detaljer[h.id].oppdaget, omtrentlig: detaljer[h.id].omtrentlig, ...(detaljer[h.id].rapport && { rapport: detaljer[h.id].rapport!.dato }) })),
    ...(kontakt?.kontakt && { reklamert: kontakt.kontakt.dato }),
    idag: idagOslo(),
  });
  if (tidslinje.stopp.length) return { ok: false, melding: tidslinje.stopp[0].melding };

  const valgtRekkefolge = s.valg && typeof s.valg === "object" ? Object.keys(s.valg) : [];
  return {
    ok: true,
    svar: {
      valgte,
      rekkefolge: [...valgtRekkefolge.filter((k) => k in rent), ...valgte.map((h) => h.id).filter((k) => !valgtRekkefolge.includes(k))],
      rent,
      kjopsdato: dato,
      km: heltall(s.km, 1, 1_500_000),
      ar: heltall(s.ar, 1950, 2100),
      somDenEr: SOM_DEN_ER.find((x) => x === s.somDenEr) ?? null,
      krav: KRAV.find((k) => k === s.krav) ?? null,
      // Repairs need a complaint: without one the number is 0 whatever the browser says.
      forsok: kontakt ? (kontakt.kontakt?.forsok ?? 0) : null,
      kontakt: kontakt?.kontakt ?? null,
      detaljer,
      tidslinje,
    },
  };
}

export type Brevsvar = {
  vedtak: Vedtakssvar;
  feil: Brevfeil[];
  kjopsdato: string;
  km: number;
  kjopesum: number;
  somDenEr: SomDenEr;
  krav: Krav;
  kontakt: Kontakt | null;
  bil: { regnr: string; merke: string; modell: string; forsteRegistrert: number | null };
  selgerOrgnr: string;
  utlegg: { beskrivelse: string; belop: number }[];
};

// What the letter needs: everything the decision search reads, and the rest.
export function rensBrevsvar(s: Record<string, unknown>): Resultat<Brevsvar> {
  const v = rensVedtakssvar(s);
  if (!v.ok) return v;
  const { kjopsdato, km, somDenEr, krav, forsok, kontakt } = v.svar;
  const kjopesum = heltall(s.kjopesum, 1, 99_999_999);
  if (!kjopsdato || !km || !kjopesum || !somDenEr || !krav || forsok === null) return { ok: false, melding: "Fyll ut kjøpet og kravet før du lager brevet." };

  const feil: Brevfeil[] = [];
  for (const id of v.svar.rekkefolge) {
    const d = v.svar.detaljer[id];
    if (!d.opplysning || !d.verksted) return { ok: false, melding: "Svar på alle spørsmålene om hver feil." };
    if (d.verksted === "skriftlig" && !d.rapport) return { ok: false, melding: "Fyll ut rapporten fra verkstedet for hver feil som er undersøkt skriftlig." };
    feil.push({ hoved: id, under: v.svar.rent[id], oppdaget: d.oppdaget, omtrentlig: d.omtrentlig, beskrivelse: d.beskrivelse, opplysning: d.opplysning, verksted: d.verksted, rapport: d.rapport });
  }

  const b = (s.bil && typeof s.bil === "object" ? s.bil : {}) as Record<string, unknown>;
  const regnr = tekst(b.regnr, 20);
  const merke = tekst(b.merke, 60);
  const modell = tekst(b.modell, 60);
  if (!regnr || !normaliserRegnr(regnr) || !merke || !modell) return { ok: false, melding: "Bilen mangler. Gå tilbake til første steg." };

  const orgnr = typeof s.selgerOrgnr === "string" ? orgnrFra(s.selgerOrgnr) : null;
  if (!orgnr) return { ok: false, melding: "Velg selgeren i steg 1." };

  const utlegg: Brevsvar["utlegg"] = [];
  if (Array.isArray(s.utlegg)) {
    for (const u of s.utlegg.slice(0, 20) as Record<string, unknown>[]) {
      const beskrivelse = tekst(u?.beskrivelse, 100);
      const belop = heltall(u?.belop, 1, 9_999_999);
      if (!beskrivelse || !belop) return { ok: false, melding: "Fyll ut beskrivelse og beløp for hvert utlegg." };
      utlegg.push({ beskrivelse, belop });
    }
  }

  const bil = { regnr, merke, modell, forsteRegistrert: heltall(b.ar, 1900, 2100) };
  // The rules besides the dates (riktighet.ts). What stops in the form stops here too; the seller's
  // status and industry are only known once the register has answered, so those warnings are judged
  // in byggBrevet.
  const riktighet = vurderRiktighet(riktighetssak({ kjopsdato, kjopesum, somDenEr, krav, kontakt, bil, feil, utlegg }, { orgnr, status: null, naeringskode: null }));
  if (riktighet.stopp.length) return { ok: false, melding: riktighet.stopp[0].melding };

  return {
    ok: true,
    svar: { vedtak: v.svar, feil, kjopsdato, km, kjopesum, somDenEr, krav, kontakt, bil, selgerOrgnr: orgnr, utlegg },
  };
}

// The case as the correctness rules read it.
export function riktighetssak(
  r: Pick<Brevsvar, "kjopsdato" | "kjopesum" | "somDenEr" | "krav" | "kontakt" | "bil" | "feil" | "utlegg">,
  selger: Riktighetssak["selger"],
): Riktighetssak {
  return {
    kjopsdato: r.kjopsdato,
    kjopesum: r.kjopesum,
    forsteRegistrert: r.bil.forsteRegistrert,
    somDenEr: r.somDenEr,
    krav: r.krav,
    forsok: r.kontakt?.forsok ?? 0,
    svar: r.kontakt?.svar ?? null,
    feil: r.feil.map((f) => ({ hoved: f.hoved, under: f.under, opplysning: f.opplysning, verksted: f.verksted, rapport: f.rapport, beskrivelse: f.beskrivelse, konklusjon: f.rapport?.konklusjon ?? null })),
    utlegg: r.utlegg,
    selger,
  };
}
