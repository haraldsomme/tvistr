// The buyer's answers as the server actions take them from the browser: checked field by field, or
// rejected whole. Shared by vurderSaken and finnVedtak; rensUtkast is the draft as kjop saves it.
import { RAPPORT_PUNKTER, type RapportPunkt } from "@/lib/brev/rapport";
import { erDato } from "@/lib/brev/tidslinje";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { erObjekt } from "@/lib/app/flett";
import { rensSkjema } from "@/lib/app/saken";
import type { Utkast } from "@/lib/app/utkast";
import type { Kilde, Svar } from "@/lib/vedtaksvalg/kjoper";

const KILDER = ["skriftlig", "muntlig", "nei"];
const KRAV = ["retting", "prisavslag", "heving"];
const PUNKTER = new Set<string>(RAPPORT_PUNKTER.map((p) => p.id));

const heltall = (v: unknown, min: number, maks: number): number | null | undefined => (v === null ? null : typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks ? v : undefined);
const valg = <T extends string>(v: unknown, lov: string[]): T | null | undefined => (v === null ? null : typeof v === "string" && lov.includes(v) ? (v as T) : undefined);

export function rensSvar(inn: unknown): Svar | null {
  const s = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  if (!erDato(s.kjopsdato) || !Array.isArray(s.feil) || !s.feil.length || s.feil.length > HOVEDKATEGORIER.reduce((n, h) => n + Math.max(1, h.under.length), 0)) return null;
  // Km and model year only sharpen the ranking: a figure out of range is dropped, not the case.
  const km = heltall(s.km, 0, 1_500_000) ?? null,
    ar = heltall(s.ar, 1950, 2100) ?? null,
    forsok = heltall(s.forsok, 0, 3);
  const somDenEr = valg<"ja" | "nei">(s.somDenEr, ["ja", "nei"]),
    krav = valg<Svar["krav"] & string>(s.krav, KRAV);
  if (km === undefined || ar === undefined || forsok === undefined || somDenEr === undefined || krav === undefined) return null;
  const feil: Svar["feil"] = [];
  for (const x of s.feil as Record<string, unknown>[]) {
    const h = HOVEDKATEGORIER.find((k) => k.id === x?.hoved);
    if (!h || !erDato(x.oppdaget) || !Array.isArray(x.under) || !x.under.every((u) => h.under.some((k) => k.id === u))) return null;
    const opplysning = valg<Kilde>(x.opplysning, KILDER),
      verksted = valg<Kilde>(x.verksted, KILDER);
    if (opplysning === undefined || verksted === undefined) return null;
    const r = x.rapport as { punkter?: unknown } | null | undefined;
    const punkter = Array.isArray(r?.punkter) ? (r.punkter.filter((p) => typeof p === "string" && PUNKTER.has(p)) as RapportPunkt[]) : null;
    feil.push({
      hoved: h.id,
      under: [...new Set(x.under as string[])],
      oppdaget: x.oppdaget,
      beskrivelse: typeof x.beskrivelse === "string" && x.beskrivelse.trim() ? x.beskrivelse.trim().slice(0, 200) : null,
      opplysning,
      verksted,
      rapport: punkter ? { punkter } : null,
    });
  }
  return { kjopsdato: s.kjopsdato, km, ar, somDenEr, krav, forsok, feil };
}

const SELGERE = ["forhandler", "privat", "leasing"];
const KJOPERE = ["privat", "naering"];
const SOM_DEN_ER = ["ja", "nei", "vetikke"];

// The draft as kjop saves it: the form through rensSkjema, its faults known categories and
// subcategories, and the three check answers only from their lists (anything else is left out).
export function rensUtkast(inn: unknown, idag: string): Utkast | null {
  if (!erObjekt(inn)) return null;
  const skjema = rensSkjema(inn.skjema, idag);
  if (!skjema) return null;
  // Each fault once, so the same case is recognised (sammeSakSkjema).
  const f_cats = [...new Set(skjema.f_cats)];
  const f_parts = { ...skjema.f_parts };
  for (const c of f_cats) {
    const h = HOVEDKATEGORIER.find((k) => k.id === c);
    const under: unknown = f_parts[c] ?? [];
    if (!h || !Array.isArray(under) || !under.every((u) => h.under.some((k) => k.id === u))) return null;
    f_parts[c] = [...new Set(under as string[])];
  }
  const u: Utkast = { skjema: { ...skjema, f_cats, f_parts } };
  const seller = valg<NonNullable<Utkast["seller"]>>(inn.seller, SELGERE),
    buyer = valg<NonNullable<Utkast["buyer"]>>(inn.buyer, KJOPERE),
    asis = valg<NonNullable<Utkast["asis"]>>(inn.asis, SOM_DEN_ER);
  if (seller) u.seller = seller;
  if (buyer) u.buyer = buyer;
  if (asis) u.asis = asis;
  return u;
}
