// Cleans what the form sends. Everything that reaches a server action comes from outside, so every
// field is checked here before it is used: ids against the known lists, numbers against a range,
// text trimmed and cut. Shared by the decision search (finnVedtak) and the letter (byggBrevet).
import { orgnrFra } from "@/lib/brreg";
import type { Brevfeil, Kilde, SomDenEr } from "@/lib/brev/typer";
import { type Feilvalg, HOVEDKATEGORIER, type Hovedkategori, rensFeilvalg, rensTidsvalg, type Tidsvalg } from "@/lib/feil/kategorier";
import { normaliserRegnr } from "@/lib/kjoretoy/vegvesen";
import type { Krav } from "@/lib/matching/typer";

export const gyldigDato = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
export const heltall = (v: unknown, min: number, maks: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks ? v : null);
export const tekst = (v: unknown, maks: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, maks) : null);

const KRAV: readonly Krav[] = ["retting", "prisavslag", "heving"];
const KILDER: readonly Kilde[] = ["skriftlig", "muntlig", "nei"];
const SOM_DEN_ER: readonly SomDenEr[] = ["ja", "nei", "vet_ikke"];
const kildeAv = (v: unknown) => KILDER.find((k) => k === v) ?? null;

// Today in Norway, so a letter written late in the evening is dated that day.
export const idagOslo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
const femArSiden = () => `${Number(idagOslo().slice(0, 4)) - 5}${idagOslo().slice(4)}`;

export type Vedtakssvar = {
  // In the order of the categories, which is how the ranking has always read them.
  valgte: Hovedkategori[];
  // In the order the buyer chose them, for the letter.
  rekkefolge: string[];
  rent: Feilvalg;
  tider: Partial<Tidsvalg>;
  kjopsdato: string | null;
  km: number | null;
  ar: number | null;
  somDenEr: SomDenEr | null;
  krav: Krav | null;
  forsok: number | null;
  detaljer: Record<string, { beskrivelse: string | null; opplysning: Kilde | null; verksted: Kilde | null }>;
};

type Resultat<T> = { ok: true; svar: T } | { ok: false; melding: string };

// What the decision search needs.
export function rensVedtakssvar(s: Record<string, unknown>): Resultat<Vedtakssvar> {
  const rent = rensFeilvalg(s.valg);
  const valgte = HOVEDKATEGORIER.filter((h) => h.id in rent);
  if (!valgte.length) return { ok: false, melding: "Velg minst én feil." };
  const tider = rensTidsvalg(s.tid);
  if (valgte.some((h) => !tider[h.id])) return { ok: false, melding: "Velg når hver feil viste seg." };
  const dato = gyldigDato(s.kjopsdato);
  if (dato && dato < femArSiden()) return { ok: false, melding: "Det er mer enn fem år siden kjøpet. Da er fristen for å reklamere ute (forbrukerkjøpsloven § 27)." };

  const d = (s.detaljer && typeof s.detaljer === "object" ? s.detaljer : {}) as Record<string, Record<string, unknown> | undefined>;
  const detaljer: Vedtakssvar["detaljer"] = {};
  for (const h of valgte) detaljer[h.id] = { beskrivelse: tekst(d[h.id]?.beskrivelse, 200), opplysning: kildeAv(d[h.id]?.opplysning), verksted: kildeAv(d[h.id]?.verksted) };

  const valgtRekkefolge = s.valg && typeof s.valg === "object" ? Object.keys(s.valg) : [];
  return {
    ok: true,
    svar: {
      valgte,
      rekkefolge: [...valgtRekkefolge.filter((k) => k in rent), ...valgte.map((h) => h.id).filter((k) => !valgtRekkefolge.includes(k))],
      rent,
      tider,
      kjopsdato: dato,
      km: heltall(s.km, 1, 1_500_000),
      ar: heltall(s.ar, 1950, 2100),
      somDenEr: SOM_DEN_ER.find((x) => x === s.somDenEr) ?? null,
      krav: KRAV.find((k) => k === s.krav) ?? null,
      forsok: heltall(s.forsok, 0, 3),
      detaljer,
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
  forsok: number;
  bil: { regnr: string; merke: string; modell: string; forsteRegistrert: number | null };
  selgerOrgnr: string;
  tidligere: { dato: string; form: "skriftlig" | "muntlig" } | null;
  overslag: number | null;
  utlegg: { beskrivelse: string; belop: number }[];
};

// What the letter needs: everything the decision search reads, and the rest.
export function rensBrevsvar(s: Record<string, unknown>): Resultat<Brevsvar> {
  const v = rensVedtakssvar(s);
  if (!v.ok) return v;
  const { kjopsdato, km, somDenEr, krav, forsok } = v.svar;
  const kjopesum = heltall(s.kjopesum, 1, 99_999_999);
  if (!kjopsdato || !km || !kjopesum || !somDenEr || !krav || forsok === null) return { ok: false, melding: "Fyll ut kjøpet og kravet før du lager brevet." };
  if (kjopsdato > idagOslo()) return { ok: false, melding: "Kjøpsdatoen kan ikke være i fremtiden." };

  const feil: Brevfeil[] = [];
  for (const id of v.svar.rekkefolge) {
    const d = v.svar.detaljer[id];
    const tid = v.svar.tider[id];
    if (!d.opplysning || !d.verksted || !tid) return { ok: false, melding: "Svar på alle spørsmålene om hver feil." };
    feil.push({ hoved: id, under: v.svar.rent[id], tid, beskrivelse: d.beskrivelse, opplysning: d.opplysning, verksted: d.verksted });
  }

  const b = (s.bil && typeof s.bil === "object" ? s.bil : {}) as Record<string, unknown>;
  const regnr = tekst(b.regnr, 20);
  const merke = tekst(b.merke, 60);
  const modell = tekst(b.modell, 60);
  if (!regnr || !normaliserRegnr(regnr) || !merke || !modell) return { ok: false, melding: "Bilen mangler. Gå tilbake til første steg." };

  const orgnr = typeof s.selgerOrgnr === "string" ? orgnrFra(s.selgerOrgnr) : null;
  if (!orgnr) return { ok: false, melding: "Velg selgeren i steg 4." };

  let tidligere: Brevsvar["tidligere"] = null;
  if (s.tidligere) {
    const t = s.tidligere as Record<string, unknown>;
    const dato = gyldigDato(t.dato);
    const form = t.form === "skriftlig" || t.form === "muntlig" ? t.form : null;
    if (!form || !dato || dato < kjopsdato || dato > idagOslo()) return { ok: false, melding: "Datoen for den tidligere reklamasjonen må være mellom kjøpsdatoen og i dag." };
    tidligere = { dato, form };
  }

  const utlegg: Brevsvar["utlegg"] = [];
  if (Array.isArray(s.utlegg)) {
    for (const u of s.utlegg.slice(0, 20) as Record<string, unknown>[]) {
      const beskrivelse = tekst(u?.beskrivelse, 100);
      const belop = heltall(u?.belop, 1, 9_999_999);
      if (!beskrivelse || !belop) return { ok: false, melding: "Fyll ut beskrivelse og beløp for hvert utlegg." };
      utlegg.push({ beskrivelse, belop });
    }
  }

  // The estimate only has a place when a workshop has put something in writing.
  const overslag = feil.some((f) => f.verksted === "skriftlig") ? heltall(s.overslag, 1, 9_999_999) : null;

  return {
    ok: true,
    svar: { vedtak: v.svar, feil, kjopsdato, km, kjopesum, somDenEr, krav, forsok, bil: { regnr, merke, modell, forsteRegistrert: heltall(b.ar, 1900, 2100) }, selgerOrgnr: orgnr, tidligere, overslag, utlegg },
  };
}
