// Calendar dates and the time level of a defect, as the ranking, the choice of decision and the app
// count them. Everything the law turns on (the presumption, the two- and five-year limits) is worked
// out from the dates, in calendar months.
import type { VisteSegValg } from "@/lib/feil/kategorier";
import { lovversjon } from "./paragrafer";

export type Tidsniva = 1 | 2 | 3;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// A real calendar day: «2025-02-30» and «2025-13-40» are not (and must not throw).
export const erDato = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && new Date(`${s}T00:00:00Z`).toJSON()?.slice(0, 10) === s;

const to = (n: number) => String(n).padStart(2, "0");
// Calendar months, the way the law counts: 31 August + 6 months is 28 (or 29) February.
export function plussManeder(iso: string, m: number): string {
  const [a, mnd, d] = iso.split("-").map(Number);
  const total = a * 12 + (mnd - 1) + m;
  const ar = Math.floor(total / 12);
  const mo = total - ar * 12;
  const siste = new Date(Date.UTC(ar, mo + 1, 0)).getUTCDate();
  return `${ar}-${to(mo + 1)}-${to(Math.min(d, siste))}`;
}

// Six months before 2024, two years from 2024 (fkjl. § 18 annet ledd); two years for the complaint
// (§ 27 annet ledd).
export const FORMODNING_MND = { før_2024: 6, etter_2024: 24 } as const;
const TO_AAR = 24;

// The time level of a defect discovered on `oppdaget`, as the ranking and the templates use it:
// 1 within the presumption, 3 past two years, 2 between (only before 2024). `intervall`: the interval
// the buyer used to choose, for the choice of decision, which reads it in words.
export function tidsnivaFor(kjop: string, oppdaget: string): { tidsnivaa: Tidsniva; intervall: VisteSegValg } {
  const tidsnivaa: Tidsniva = oppdaget <= plussManeder(kjop, FORMODNING_MND[lovversjon(kjop)]) ? 1 : oppdaget > plussManeder(kjop, TO_AAR) ? 3 : 2;
  const intervall: VisteSegValg = oppdaget <= plussManeder(kjop, 6) ? "innen_6_mnd" : oppdaget > plussManeder(kjop, TO_AAR) ? "over_24_mnd" : "6_til_24_mnd";
  return { tidsnivaa, intervall };
}
