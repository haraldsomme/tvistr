// The buyer's answers as the ranking reads them (vedtaksvalg/kjoper.ts, Svar): from the check before
// payment and from the writer after. Only faults with a discovery date count, and nothing without the
// purchase (or handover) date.
import type { RapportPunkt } from "@/lib/brev/rapport";
import type { Kilde, Svar } from "@/lib/vedtaksvalg/kjoper";
import { erObjekt, flett } from "./flett";
import { validReg } from "./format";
import { type Skjema, standard } from "./skjema";
import type { Sjekksvar } from "./vurdering";

// The check's state: the verdict's answers plus the car and the faults.
export type Sjekk = Sjekksvar & { reg?: string; make?: string; year?: string; lastReg?: string; cats?: string[]; issues?: Record<string, string[]>; fdates?: Record<string, string> };

// What the writer's workshop ticks mean in the ranking's words.
const WS_TIL_PUNKT: Record<string, RapportPunkt> = { bekrefter: "bekrefter", aarsak: "arsak", levering: "til_stede", ikke_slitasje: "ikke_slitasje", frarader: "frarader", kostnad: "overslag" };

// «3+» counts as three: the legal point «tapt retting» asks for two or more (matching/rett.ts).
export const forsokTall = (s: string): number | null => (s === "" ? null : s === "3+" ? 3 : Number(s));

const heltall = (s: string | undefined) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d ? Number(d) : null;
};

export function tilSvar(s: Skjema): Svar | null {
  const kjopsdato = s.c_purchase || s.c_delivery;
  const feil = s.f_cats.filter((c) => s.f_area[c]?.found);
  if (!kjopsdato || !feil.length) return null;
  // «lovet»: the seller said the car was free of such faults (the form does not ask whether in writing).
  // «opplyste»: the seller disclosed the fault, which is no misrepresentation, so it is left out.
  const opplysning: Kilde | null = s.seller_said === "nei" ? "nei" : s.seller_said === "lovet" ? "muntlig" : null;
  const verksted: Kilde | null = s.ws === "rapport" ? "skriftlig" : s.ws === "uten" ? "muntlig" : s.ws === "nei" ? "nei" : null;
  const rapport = s.ws === "rapport" ? { punkter: s.ws_says.map((k) => WS_TIL_PUNKT[k]).filter(Boolean) } : null;
  return {
    kjopsdato,
    km: heltall(s.c_km),
    ar: heltall(s.c_year),
    somDenEr: s.c_asis ? "ja" : "nei",
    krav: s.k_main === "omlevering" ? "retting" : s.k_main === "retting" || s.k_main === "prisavslag" || s.k_main === "heving" ? s.k_main : null,
    forsok: forsokTall(s.k_forsok),
    feil: feil.map((c) => ({ hoved: c, under: s.f_parts[c] ?? [], oppdaget: s.f_area[c].found, beskrivelse: s.f_catdesc[c]?.trim() || null, opplysning, verksted, rapport })),
  };
}

export function sjekkTilSvar(a: Sjekk): Svar | null {
  const feil = (a.cats ?? []).filter((c) => a.fdates?.[c]);
  if (!a.delivery || !feil.length) return null;
  return {
    kjopsdato: a.delivery,
    km: heltall(a.km),
    ar: heltall(a.year),
    somDenEr: a.asis === "ja" || a.asis === "nei" ? a.asis : null,
    krav: null,
    forsok: null,
    feil: feil.map((c) => ({ hoved: c, under: a.issues?.[c] ?? [], oppdaget: a.fdates![c], beskrivelse: null, opplysning: null, verksted: null, rapport: null })),
  };
}

// For change detection: finnVedtak and vurderSaken are called again only when this changes.
export const nokkel = (v: Svar | null) => JSON.stringify(v);

// The writer prefilled from the check when the buyer unlocks it (artifact prefill). What the writer
// already has is kept.
export function fraSjekk(a: Sjekk, s: Skjema): Skjema {
  const ut = { ...s, f_parts: { ...s.f_parts }, f_area: { ...s.f_area } };
  const sett = <K extends keyof Skjema>(k: K, v: Skjema[K] | undefined) => {
    if (v !== undefined && v !== "" && !(typeof ut[k] === "string" && ut[k])) ut[k] = v;
  };
  if (a.make) {
    const [merke, ...modell] = a.make.trim().split(/\s+/);
    sett("c_make", merke);
    sett("c_model", modell.join(" "));
  }
  sett("c_year", a.year);
  sett("c_km", a.km);
  sett("c_reg", a.reg);
  sett("c_lastreg", a.lastReg);
  sett("c_delivery", a.delivery);
  if (a.asis) ut.c_asis = a.asis === "ja";
  if (a.cats?.length) {
    ut.f_cats = [...a.cats];
    for (const c of a.cats) {
      ut.f_parts[c] ??= [...(a.issues?.[c] ?? [])];
      ut.f_area[c] ??= { found: a.fdates?.[c] ?? "", impact: [], known: a.known ?? "" };
    }
  }
  sett("f_cause_check", a.cause);
  if (a.notified === "ja") {
    ut.f_prior = true;
    sett("f_prior_date", a.notifiedDate);
  }
  if (!ut.k_main) {
    ut.k_main = "retting";
    ut.k_alt = "prisavslag";
  }
  return ut;
}

// «Sak 21/3494 · 2022», or «Vedtak 2022» when the decision has no case number.
export const sakTekst = (saksnummer: string | null, ar: string | null) => (saksnummer ? `Sak ${saksnummer}${ar ? ` · ${ar}` : ""}` : `Vedtak${ar ? ` ${ar}` : ""}`);

// A purchase is for one car and the faults chosen in the check; the writer cannot change them.
// What the check still lacks before it can be bought: the registration number, the car, or a fault.
export function manglerForKjop(a: Sjekk): "reg" | "bil" | "feil" | null {
  if (!validReg(a.reg)) return "reg";
  // The car is fixed at payment, so it must be known: from the register, or typed in the check.
  if (!a.make?.trim()) return "bil";
  if (!a.cats?.length) return "feil";
  return null;
}

const feilsett = (cats: string[], parts: Record<string, string[] | undefined>) => JSON.stringify([...cats].sort().map((c) => [c, [...(parts[c] ?? [])].sort()]));

// The last purchase as the browser keeps it (localStorage tvistr-sak): the case's id and the car and
// faults it is locked to. The case itself is in the database.
export type Kjopt = { id: string; reg: string; cats: string[]; parts: Record<string, string[]> };
export const kjopt = (id: string, s: Skjema): Kjopt => ({ id, reg: s.c_reg, cats: s.f_cats, parts: s.f_parts });

// The check is about the car and the faults the case was bought for.
export const sammeSak = (a: Sjekk, k: Kjopt) => !!k.id && a.reg === k.reg && feilsett(a.cats ?? [], a.issues ?? {}) === feilsett(k.cats, k.parts);

// What the writer shows locked (bilen.tsx, mangelen.tsx); the server keeps them as bought.
export const LAASTE_FELT = ["c_reg", "c_make", "c_model", "c_year", "f_cats", "f_parts"] as const satisfies readonly (keyof Skjema)[];

export function laas(lagret: Skjema, inn: Skjema): Skjema {
  const ut: Record<string, unknown> = { ...inn };
  for (const k of LAASTE_FELT) ut[k] = lagret[k];
  return ut as Skjema;
}

// The writer's answers are about the car and the faults of the case (finnVedtak).
export function gjelderSaken(svar: Svar, s: Skjema): boolean {
  return svar.ar === heltall(s.c_year) && svar.feil.every((f) => s.f_cats.includes(f.hoved) && f.under.every((u) => (s.f_parts[f.hoved] ?? []).includes(u)));
}

// A form from the browser, as the server saves it: only the known fields, each of the default's type.
// Null when it is not a form or is far larger than any filled-in one.
export function rensSkjema(inn: unknown, idag: string): Skjema | null {
  if (!erObjekt(inn) || JSON.stringify(inn).length > 64_000) return null;
  const s = standard(idag);
  const kjente = Object.fromEntries(Object.entries(inn).filter(([k]) => k in s));
  return flett(s, kjente) as Skjema;
}

// A new purchase for another car or fault: a new letter from the check, keeping only the buyer.
export function nyttKjop(a: Sjekk, gammel: Skjema, idag: string): Skjema {
  const ny = standard(idag);
  const kjoper = Object.fromEntries(Object.entries(gammel).filter(([k]) => k.startsWith("b_")));
  return fraSjekk(a, { ...ny, ...kjoper });
}
