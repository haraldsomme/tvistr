// The buyer's answers as the ranking reads them (vedtaksvalg/kjoper.ts, Svar): from the check before
// payment and from the writer after. Only faults with a discovery date count, and nothing without the
// purchase (or handover) date.
import type { RapportPunkt } from "@/lib/brev/rapport";
import type { Kilde, Svar } from "@/lib/vedtaksvalg/kjoper";
import { validReg } from "./format";
import { type Skjema, standard } from "./skjema";
import type { Sjekksvar } from "./vurdering";

// The check's state: the verdict's answers plus the car and the faults.
export type Sjekk = Sjekksvar & { reg?: string; make?: string; year?: string; lastReg?: string; cats?: string[]; issues?: Record<string, string[]>; fdates?: Record<string, string> };

// What the writer's workshop ticks mean in the ranking's words.
const WS_TIL_PUNKT: Record<string, RapportPunkt> = { bekrefter: "bekrefter", aarsak: "arsak", levering: "til_stede", ikke_slitasje: "ikke_slitasje", frarader: "frarader", kostnad: "overslag" };

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
    forsok: null,
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
    ut.c_registrert = true;
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
// What the check still lacks before it can be bought: the registration number, or a fault.
export function manglerForKjop(a: Sjekk): "reg" | "feil" | null {
  if (!validReg(a.reg)) return "reg";
  if (!a.cats?.length) return "feil";
  return null;
}

const feilsett = (cats: string[], parts: Record<string, string[] | undefined>) => JSON.stringify([...cats].sort().map((c) => [c, [...(parts[c] ?? [])].sort()]));

// The check is about the car and the faults the writer was bought for.
export const sammeSak = (a: Sjekk, s: Skjema) => a.reg === s.c_reg && feilsett(a.cats ?? [], a.issues ?? {}) === feilsett(s.f_cats, s.f_parts);

// A new purchase for another car or fault: a new letter from the check, keeping only the buyer.
export function nyttKjop(a: Sjekk, gammel: Skjema, idag: string): Skjema {
  const ny = standard(idag);
  const kjoper = Object.fromEntries(Object.entries(gammel).filter(([k]) => k.startsWith("b_")));
  return fraSjekk(a, { ...ny, ...kjoper });
}
