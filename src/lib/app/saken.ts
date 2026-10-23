// The buyer's answers as the ranking reads them (vedtaksvalg/kjoper.ts, Svar): from the form, before
// and after payment. Only faults with a discovery date count, and nothing without the
// purchase (or handover) date.
import type { RapportPunkt } from "@/lib/brev/rapport";
import type { Kilde, Svar } from "@/lib/vedtaksvalg/kjoper";
import { feilposter } from "./feil";
import { erObjekt, flett } from "./flett";
import { validReg } from "./format";
import { IMPACT_SOLO, type Skjema, standard } from "./skjema";

// What the writer's workshop ticks mean in the ranking's words.
const WS_TIL_PUNKT: Record<string, RapportPunkt> = { bekrefter: "bekrefter", aarsak: "arsak", levering: "til_stede", ikke_slitasje: "ikke_slitasje", frarader: "frarader", kostnad: "overslag" };

// «2+» counts as two and an older «3+» as three: the legal point «tapt retting» asks for two or more
// (matching/rett.ts).
export const forsokTall = (s: string): number | null => {
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
};

// The digits of a typed number («38 500» → 38500), null when there are none.
export const heltall = (s: string | undefined) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d ? Number(d) : null;
};

// The faults the ranking is asked about, in the order of Svar.feil (and so of finnVedtak's lists):
// those with a date. Their keys tie each list to its fault in the letter.
export const svarPoster = (s: Skjema) => feilposter(s).filter((p) => p.found);

export function tilSvar(s: Skjema): Svar | null {
  const kjopsdato = s.c_purchase || s.c_delivery;
  const feil = svarPoster(s);
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
    krav: s.k_main === "retting" || s.k_main === "prisavslag" || s.k_main === "heving" ? s.k_main : null,
    forsok: forsokTall(s.k_forsok),
    feil: feil.map((p) => ({ hoved: p.hoved, under: p.under, oppdaget: p.found, beskrivelse: p.desc || null, opplysning, verksted, rapport })),
  };
}

// «Sak 21/3494 · 2022», or «Vedtak 2022» when the decision has no case number.
export const sakTekst = (saksnummer: string | null, ar: string | null) => (saksnummer ? `Sak ${saksnummer}${ar ? ` · ${ar}` : ""}` : `Vedtak${ar ? ` ${ar}` : ""}`);
// «sak 21/3494» in a sentence, or «et annet vedtak» without a case number.
export const sakNavn = (v: { saksnummer: string | null } | null) => (v?.saksnummer ? `sak ${v.saksnummer}` : "et annet vedtak");

// A purchase is for one car and the faults chosen before payment; the writer cannot change them.
// What the draft still lacks before it can be bought: the registration number, the car (from the
// register, or typed), or a fault.
export function manglerISkjema(s: Skjema): "reg" | "bil" | "feil" | null {
  if (!validReg(s.c_reg)) return "reg";
  if (!s.c_make.trim()) return "bil";
  if (!s.f_cats.length) return "feil";
  return null;
}

const feilsett = (cats: string[], parts: Record<string, string[] | undefined>) => JSON.stringify([...cats].sort().map((c) => [c, [...(parts[c] ?? [])].sort()]));

// The last purchase as the browser keeps it (localStorage tvistr-sak): the case's id and the car and
// faults it is locked to. The case itself is in the database.
export type Kjopt = { id: string; reg: string; cats: string[]; parts: Record<string, string[]> };
export const kjopt = (id: string, s: Skjema): Kjopt => ({ id, reg: s.c_reg, cats: s.f_cats, parts: s.f_parts });

// The draft is about the car and the faults the case was bought for.
export const sammeSakSkjema = (s: Skjema, k: Kjopt) => !!k.id && s.c_reg === k.reg && feilsett(s.f_cats, s.f_parts) === feilsett(k.cats, k.parts);

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
  const ut = fraEldre(inn, flett(s, kjente) as Skjema);
  // Only well-formed choices of a decision per fault; a case from before had one (prec_id), now gone.
  ut.prec = Object.fromEntries(Object.entries(ut.prec).filter(([, v]) => erObjekt(v) && Number.isSafeInteger(v.id) && typeof v.selv === "boolean"));
  // Omlevering is no longer a claim (no decision gave a buyer another used car); a case saved with it
  // claims retting, which the ranking already treated it as.
  return ut.k_main === "omlevering" ? { ...ut, k_main: "retting" } : ut;
}

// A case saved before the form was slimmed asked the impact per fault and had a general description
// beside each fault's: the impacts become one list, and the description follows the first fault's.
function fraEldre(inn: Record<string, unknown>, s: Skjema): Skjema {
  const ut = { ...s };
  if (!ut.f_impact.length) {
    const imp = Object.values(ut.f_area as Record<string, unknown>).flatMap((a) => (erObjekt(a) && Array.isArray(a.impact) ? a.impact.filter((x): x is string => typeof x === "string") : []));
    ut.f_impact = [...new Set(imp.length > 1 ? imp.filter((x) => x !== IMPACT_SOLO) : imp)];
  }
  const desc = typeof inn.f_desc === "string" ? inn.f_desc.trim() : "";
  const c = ut.f_cats[0];
  if (desc && c) {
    const her = (ut.f_catdesc[c] ?? "").trim();
    ut.f_catdesc = { ...ut.f_catdesc, [c]: her ? `${her.replace(/[.]$/, "")}. ${desc}` : desc };
  }
  return ut;
}

// The draft as bought: the buyer's name and address from the owner's newest case where the draft has none.
export function tilKjop(ny: Skjema, gammel: Skjema | null): Skjema {
  const ut: Record<string, unknown> = { ...ny };
  for (const [k, v] of Object.entries(gammel ?? {})) if (k.startsWith("b_") && !ut[k]) ut[k] = v;
  return ut as Skjema;
}

// Which decision the letter cites under each fault when the lists arrive. The recommended one (first)
// unless the buyer picked another themselves and it is still on that fault's list. A fault without a
// list keeps no choice. `utfall` tells the buyer what happened, per fault.
export type Precutfall = "fulgt" | "beholdt" | "borte";
export function nyttPrecValg(prec: Skjema["prec"], lister: readonly { nokkel: string; valg: readonly { id: number }[] }[]): { endre: Partial<Skjema> | null; utfall: Record<string, Precutfall> } {
  const ny: Skjema["prec"] = {};
  const utfall: Record<string, Precutfall> = {};
  for (const { nokkel, valg } of lister) {
    const anbefalt = valg[0]?.id;
    if (anbefalt === undefined) continue;
    const har = prec[nokkel];
    if (har?.selv && valg.some((v) => v.id === har.id)) {
      ny[nokkel] = har;
      utfall[nokkel] = "beholdt";
    } else {
      ny[nokkel] = { id: anbefalt, selv: false };
      utfall[nokkel] = har?.selv ? "borte" : "fulgt";
    }
  }
  const lik = (a: Skjema["prec"], b: Skjema["prec"]) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k]?.id === v.id && b[k]?.selv === v.selv);
  return { endre: lik(ny, prec) ? null : { prec: ny }, utfall };
}
