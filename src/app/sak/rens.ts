// The buyer's answers as the server actions take them from the browser: checked field by field, or
// rejected whole. Shared by vurderSaken and finnVedtak.
import { RAPPORT_PUNKTER, type RapportPunkt } from "@/lib/brev/rapport";
import { erDato } from "@/lib/brev/tidslinje";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import type { Kilde, Svar } from "@/lib/vedtaksvalg/kjoper";

const KILDER = ["skriftlig", "muntlig", "nei"];
const KRAV = ["retting", "prisavslag", "heving"];
const PUNKTER = new Set<string>(RAPPORT_PUNKTER.map((p) => p.id));

const heltall = (v: unknown, min: number, maks: number): number | null | undefined => (v === null ? null : typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks ? v : undefined);
const valg = <T extends string>(v: unknown, lov: string[]): T | null | undefined => (v === null ? null : typeof v === "string" && lov.includes(v) ? (v as T) : undefined);

export function rensSvar(inn: unknown): Svar | null {
  const s = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  if (!erDato(s.kjopsdato) || !Array.isArray(s.feil) || !s.feil.length || s.feil.length > HOVEDKATEGORIER.length) return null;
  const km = heltall(s.km, 0, 1_500_000),
    ar = heltall(s.ar, 1950, 2100),
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
