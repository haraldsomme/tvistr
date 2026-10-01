// Typical amounts awarded in won dealer cases, by purchase price. The purchase price is what
// decides the amount; the defect type adds almost nothing but costs sample size. Rescission is
// left out of the bands since it normally returns the purchase price (median 91 % of it).
//
// Static on purpose: the numbers are stable and this avoids a query per assessment. Refresh with
// `npm run belopstabell` and paste the output here.

export type Prisklasse = { maksKjopesum: number; n: number; p25: number; median: number; p75: number };

// Computed 2026-10-01 from vedtak: selger_type = forhandler, utfall in (medhold, delvis_medhold),
// prinsipalt_krav in (prisavslag, erstatning), tilkjent_totalt_nok > 0.
export const PRISKLASSER: Prisklasse[] = [
  { maksKjopesum: 50_000, n: 85, p25: 4673, median: 9714, p75: 17500 },
  { maksKjopesum: 150_000, n: 252, p25: 7163, median: 13000, p75: 22279 },
  { maksKjopesum: 300_000, n: 208, p25: 9664, median: 20000, p75: 30970 },
  { maksKjopesum: Infinity, n: 180, p25: 12300, median: 23456, p75: 40122 },
];

export type TypiskBelop = { lav: number; hoy: number; median: number; n: number };

const tusen = (v: number) => Math.round(v / 1000) * 1000;

export function typiskBelop(kjopesumNok: number): TypiskBelop {
  const k = PRISKLASSER.find((p) => kjopesumNok < p.maksKjopesum) ?? PRISKLASSER[PRISKLASSER.length - 1];
  return { lav: tusen(k.p25), hoy: tusen(k.p75), median: tusen(k.median), n: k.n };
}
