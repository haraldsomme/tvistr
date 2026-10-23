// The verdict measured against the decisions (docs/ferdigkriterier.md, «Vurderingen»): each decision
// in the counted set becomes the buyer's answers it would have given, runs through the real verdict,
// and is tallied by level against what the committee decided. The answers come from the extraction
// (dates, «som den er», categories, workshop report, repair attempts); what a decision does not tell
// is left unanswered, as a buyer who skipped it.
import { addDays, iso, parseD } from "@/lib/app/dato";
import { type Skjema, standard, syncAreas } from "@/lib/app/skjema";
import { type Resultat, skriverResultat, writerQ } from "@/lib/app/vurdering";
import type { AvledetFeil, VisteSeg } from "@/lib/feilvurdering/skjema";
import { MEDHOLD } from "./statistikk";

export type Kalibreringsvedtak = {
  id: number;
  utfall: string | null;
  kjopsdato: string | null;
  overtakelsesdato: string | null;
  vedtaksdato: string | null;
  forsteReklamasjon: string | null;
  somDenEr: boolean | null;
  bevistyper: string[] | null;
  rettingsforsok: number | null;
  arsmodell: number | null;
  km: number | null;
  feil: AvledetFeil[];
};

// The defects the committee took a view on; only these count (statistikk.ts).
export const vurderte = (v: Pick<Kalibreringsvedtak, "feil">) => v.feil.filter((f) => f.hovedkategori !== "utenfor" && (f.utfall === "medhold" || f.utfall === "avvist"));

// Medhold by the one definition: the decision went the buyer's way, and on a defect it assessed.
export const medhold = (v: Pick<Kalibreringsvedtak, "utfall" | "feil">) => MEDHOLD.has(v.utfall ?? "") && vurderte(v).some((f) => f.utfall === "medhold");

// A day inside the period when the decision gives only the period, or only the time level.
const DAGER: Record<Exclude<VisteSeg, "ukjent">, number> = { innen_6_mnd: 90, "6_til_22_mnd": 400, "22_til_24_mnd": 690, over_24_mnd: 900 };
const NIVA_DAGER = { 1: 90, 2: 400, 3: 690 } as const;
const dagerEtter = (f: AvledetFeil): number | null =>
  f.dager_etter_levering ?? (f.viste_seg !== "ukjent" ? DAGER[f.viste_seg] : f.tidsniva ? NIVA_DAGER[f.tidsniva] : null);

const pluss = (dato: string, dager: number) => iso(addDays(parseD(dato)!, dager));
const forsok = (n: number | null) => (n === null ? "" : n >= 2 ? "2+" : String(n));

// The form a buyer in this decision would have filled in, and the day they would have checked.
export function tilSkjema(v: Kalibreringsvedtak): { skjema: Skjema; idag: string } {
  const levert = v.overtakelsesdato ?? v.kjopsdato;
  const idag = v.forsteReklamasjon ?? v.vedtaksdato ?? levert ?? "2026-01-01";
  const s = standard(idag);
  const f_parts: Record<string, string[]> = {};
  const f_area: Record<string, { found: string }> = {};
  for (const f of vurderte(v)) {
    const under = (f_parts[f.hovedkategori] ??= []);
    if (f.underkategori && !under.includes(f.underkategori)) under.push(f.underkategori);
    const d = dagerEtter(f);
    // The complaint bounds the discovery: a buyer cannot complain of a defect not yet seen.
    const funnet = levert && d !== null ? [pluss(levert, d), idag].sort()[0] : "";
    const forrige = f_area[f.hovedkategori]?.found;
    f_area[f.hovedkategori] = { found: forrige && (!funnet || forrige < funnet) ? forrige : funnet };
  }
  const rapport = (v.bevistyper ?? []).some((b) => b === "verkstedrapport" || b === "takst");
  const skjema: Skjema = {
    ...s,
    c_purchase: v.kjopsdato ?? "",
    c_delivery: levert ?? "",
    c_asis: v.somDenEr === true,
    c_year: v.arsmodell ? String(v.arsmodell) : "",
    c_km: v.km !== null ? String(v.km) : "",
    f_cats: Object.keys(f_parts),
    f_parts,
    f_area,
    ws: rapport ? "rapport" : "",
    f_prior: true,
    f_prior_date: v.forsteReklamasjon ?? "",
    k_forsok: forsok(v.rettingsforsok),
  };
  return { skjema: syncAreas(skjema), idag };
}

export const vurder = (v: Kalibreringsvedtak): Resultat => {
  const { skjema, idag } = tilSkjema(v);
  return skriverResultat(skjema, idag, writerQ(skjema));
};

export type Telling = { tier: string; n: number; medhold: number; fullt: number };

export function tell(rader: { tier: string; vant: boolean; fullt: boolean }[]): Telling[] {
  const per = new Map<string, Telling>();
  for (const r of rader) {
    const t = per.get(r.tier) ?? per.set(r.tier, { tier: r.tier, n: 0, medhold: 0, fullt: 0 }).get(r.tier)!;
    t.n++;
    if (r.vant) t.medhold++;
    if (r.vant && r.fullt) t.fullt++;
  }
  return [...per.values()];
}

export const andel = (t: Pick<Telling, "n" | "medhold">) => (t.n ? (100 * t.medhold) / t.n : 0);

// The criteria in docs/ferdigkriterier.md, on the levels in order from strongest. The five-year
// limit (`frist`) and decisions without dates are counted beside them, not in them.
export function kriterier(nivaer: Telling[], ordet: (tier: string) => boolean): { navn: string; gronn: boolean; tall: string }[] {
  const total = nivaer.reduce((s, t) => s + t.n, 0);
  const par = nivaer.slice(1).map((t, i) => ({ a: nivaer[i], b: t }));
  return [
    ...par.map(({ a, b }) => ({ navn: `${a.tier} > ${b.tier} med minst 10 poeng`, gronn: andel(a) - andel(b) >= 10, tall: `${andel(a).toFixed(1)} mot ${andel(b).toFixed(1)}` })),
    ...nivaer.map((t) => ({ navn: `${t.tier} har minst 15 % av vedtakene`, gronn: t.n / total >= 0.15, tall: `${t.n} av ${total} (${((100 * t.n) / total).toFixed(1)} %)` })),
    ...nivaer.filter((t) => ordet(t.tier)).map((t) => ({ navn: `«trolig» bare over 50 % (${t.tier})`, gronn: andel(t) > 50, tall: `${andel(t).toFixed(1)} %` })),
  ];
}
