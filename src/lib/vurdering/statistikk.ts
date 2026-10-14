// The figures behind «Lignende saker i Forbrukerklageutvalget» in the free assessment (step 4). They are
// counted once, at import (scripts/statistikk.ts), and read from `statistikk_kategori`.
//
// The set is the letter's (src/lib/matching/grunnfilter.ts) without the medhold filter: every decision
// on a dealer sale of a car or van under the consumer purchase act, so «i M av N fikk kjøperen medhold»
// is true of the cases the committee decided. Cases settled before the committee are not in it, and a
// decision dismissed without assessment (utfall «avvist») is left out.
//
// A decision counts for a category when the committee assessed a defect in it (medhold or rejected); a
// defect it did not assess is not counted, so N is the cases where the committee took a view on it.
import type { Lagret as Avgjorende } from "@/lib/avgjorende/skjema";
import type { AvledetFeil, Sanksjon } from "@/lib/feilvurdering/skjema";

export const UTFALL_I_TELLINGEN = ["medhold", "delvis_medhold", "ikke_medhold"] as const;
const MEDHOLD = new Set(["medhold", "delvis_medhold"]);

// Figures for fewer decisions than this are not shown (docs/vurdering.md).
export const MIN_SAKER = 5;
// The median price reduction needs at least this many decisions with a known share.
export const MIN_PRISAVSLAG = 10;
// The key of the row for the whole set.
export const ALLE = "alle";

export type Statistikkrad = {
  nokkel: string;
  antallSaker: number;
  antallMedhold: number;
  heving: number;
  prisavslag: number;
  retting: number;
  erstatning: number;
  prisavslagMedianProsent: number | null;
  alderMedian: number | null;
  kmMedian: number | null;
};

// One decision as the count reads it.
export type Tellevedtak = {
  id: number;
  utfall: string | null;
  alder: number | null;
  km: number | null;
  prisavslagProsent: number | null;
  sanksjoner: string[] | null;
  feil: AvledetFeil[];
  avgjorende: Avgjorende | null;
};

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// What the buyer got for this defect alone: the extraction's answer when there is one, otherwise the
// decision's own when this was the only defect with medhold. Empty when it cannot be told.
export function sanksjonerFor(v: Tellevedtak, f: AvledetFeil): string[] {
  const a = v.avgjorende?.feil.find((x) => x.id === f.id);
  if (a) return a.sanksjoner;
  const medhold = v.feil.filter((x) => x.utfall === "medhold");
  return medhold.length === 1 && medhold[0].id === f.id ? (v.sanksjoner ?? []) : [];
}

type Samler = { saker: Set<number>; medhold: Set<number>; sanksjon: Record<Extract<Sanksjon, "heving" | "prisavslag" | "retting" | "erstatning">, Set<number>>; prosent: Map<number, number>; alder: Map<number, number>; km: Map<number, number> };
const ny = (): Samler => ({ saker: new Set(), medhold: new Set(), sanksjon: { heving: new Set(), prisavslag: new Set(), retting: new Set(), erstatning: new Set() }, prosent: new Map(), alder: new Map(), km: new Map() });

export function byggStatistikk(vedtak: Tellevedtak[]): Statistikkrad[] {
  const per = new Map<string, Samler>();
  const hent = (k: string) => per.get(k) ?? per.set(k, ny()).get(k)!;
  const alle = ny();
  for (const v of vedtak) {
    if (!UTFALL_I_TELLINGEN.includes(v.utfall as (typeof UTFALL_I_TELLINGEN)[number])) continue;
    alle.saker.add(v.id);
    const vant = MEDHOLD.has(v.utfall!);
    if (vant) alle.medhold.add(v.id);
    for (const f of v.feil) {
      if (f.hovedkategori === "utenfor" || (f.utfall !== "medhold" && f.utfall !== "avvist")) continue;
      for (const nokkel of [f.hovedkategori, ...(f.underkategori ? [`${f.hovedkategori}.${f.underkategori}`] : [])]) {
        const s = hent(nokkel);
        s.saker.add(v.id);
        if (!vant || f.utfall !== "medhold") continue;
        s.medhold.add(v.id);
        const sanksjoner = sanksjonerFor(v, f);
        for (const x of ["heving", "prisavslag", "retting", "erstatning"] as const) if (sanksjoner.includes(x)) s.sanksjon[x].add(v.id);
        if (sanksjoner.includes("prisavslag") && v.prisavslagProsent !== null) s.prosent.set(v.id, v.prisavslagProsent);
        if (v.alder !== null) s.alder.set(v.id, v.alder);
        if (v.km !== null) s.km.set(v.id, v.km);
      }
    }
  }
  const rad = (nokkel: string, s: Samler): Statistikkrad => ({
    nokkel,
    antallSaker: s.saker.size,
    antallMedhold: s.medhold.size,
    heving: s.sanksjon.heving.size,
    prisavslag: s.sanksjon.prisavslag.size,
    retting: s.sanksjon.retting.size,
    erstatning: s.sanksjon.erstatning.size,
    prisavslagMedianProsent: s.prosent.size >= MIN_PRISAVSLAG ? median([...s.prosent.values()]) : null,
    alderMedian: median([...s.alder.values()]),
    kmMedian: median([...s.km.values()]),
  });
  return [rad(ALLE, alle), ...[...per].sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => rad(k, s))];
}
