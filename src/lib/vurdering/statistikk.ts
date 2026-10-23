// The figures behind «Lignende saker i Forbrukerklageutvalget» in the free assessment (step 4). They are
// counted once, at import (scripts/statistikk.ts), and read from `statistikk_kategori`.
//
// The set is the letter's (src/lib/matching/grunnfilter.ts) without the medhold filter: every decision
// on a dealer sale of a car or van under the consumer purchase act, so «i M av N fikk kjøperen medhold»
// is true of the cases the committee decided. Cases settled before the committee are not in it, and a
// decision dismissed without assessment (utfall «avvist») is left out.
//
// A decision counts for a group (all, a category, a category in a time level) when the committee
// assessed a defect in it (medhold or rejected); a defect it did not assess is not counted, so N is the
// cases where the committee took a view on it. It counts as medhold when the decision went the
// buyer's way and such a defect got medhold (docs/ferdigkriterier.md, «Vurderingen»): one definition
// everywhere on the site.
import type { Lagret as Avgjorende } from "@/lib/avgjorende/skjema";
import type { AvledetFeil, Sanksjon } from "@/lib/feilvurdering/skjema";

export const UTFALL_I_TELLINGEN = ["medhold", "delvis_medhold", "ikke_medhold"] as const;
export const MEDHOLD = new Set(["medhold", "delvis_medhold"]);

// Figures for fewer decisions than this are not shown (docs/app.md).
export const MIN_SAKER = 5;
// A rate for a time level is shown only from this many decisions (about ±17 points); below, the
// category's figure stands alone.
export const MIN_RATE = 30;
// The key of a category in one time level (1–3, tidsnivå), «motor:2».
export const celle = (hoved: string, niva: number) => `${hoved}:${niva}`;
// The key of the row for the whole set.
export const ALLE = "alle";

export type Statistikkrad = {
  nokkel: string;
  antallSaker: number;
  antallMedhold: number;
  // Of the decisions with medhold, those with full medhold.
  fullt: number;
  // The most common reason the committee gave in the decisions the buyer lost, and in how many.
  avslag: string | null;
  avslagAntall: number;
  heving: number;
  prisavslag: number;
  retting: number;
  erstatning: number;
};

// One decision as the count reads it.
export type Tellevedtak = {
  id: number;
  utfall: string | null;
  sanksjoner: string[] | null;
  feil: AvledetFeil[];
  avgjorende: Avgjorende | null;
};

// What the buyer got for this defect alone: the extraction's answer when there is one, otherwise the
// decision's own when this was the only defect with medhold. Empty when it cannot be told.
export function sanksjonerFor(v: Tellevedtak, f: AvledetFeil): string[] {
  const a = v.avgjorende?.feil.find((x) => x.id === f.id);
  if (a) return a.sanksjoner;
  const medhold = v.feil.filter((x) => x.utfall === "medhold");
  return medhold.length === 1 && medhold[0].id === f.id ? (v.sanksjoner ?? []) : [];
}

type Samler = {
  saker: Set<number>;
  medhold: Set<number>;
  fullt: Set<number>;
  // Per decision, the reasons its rejected defects in the group were given.
  avslag: Map<number, Set<string>>;
  sanksjon: Record<Extract<Sanksjon, "heving" | "prisavslag" | "retting" | "erstatning">, Set<number>>;
};
const ny = (): Samler => ({ saker: new Set(), medhold: new Set(), fullt: new Set(), avslag: new Map(), sanksjon: { heving: new Set(), prisavslag: new Set(), retting: new Set(), erstatning: new Set() } });

// The reason given in most of the decisions the buyer lost.
function vanligstAvslag(s: Samler): { avslag: string | null; avslagAntall: number } {
  const per = new Map<string, number>();
  for (const [id, grunner] of s.avslag) if (!s.medhold.has(id)) for (const g of grunner) per.set(g, (per.get(g) ?? 0) + 1);
  const [avslag, avslagAntall] = [...per].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0] ?? [null, 0];
  return { avslag, avslagAntall };
}

export function byggStatistikk(vedtak: Tellevedtak[]): Statistikkrad[] {
  const per = new Map<string, Samler>();
  const hent = (k: string) => per.get(k) ?? per.set(k, ny()).get(k)!;
  const alle = ny();
  for (const v of vedtak) {
    if (!UTFALL_I_TELLINGEN.includes(v.utfall as (typeof UTFALL_I_TELLINGEN)[number])) continue;
    const vant = MEDHOLD.has(v.utfall!);
    for (const f of v.feil) {
      if (f.hovedkategori === "utenfor" || (f.utfall !== "medhold" && f.utfall !== "avvist")) continue;
      const nokler = [f.hovedkategori, ...(f.underkategori ? [`${f.hovedkategori}.${f.underkategori}`] : []), ...(f.tidsniva ? [celle(f.hovedkategori, f.tidsniva)] : [])];
      for (const s of [alle, ...nokler.map(hent)]) {
        s.saker.add(v.id);
        if (f.utfall === "avvist" && f.avslagsgrunn) {
          const g = s.avslag.get(v.id) ?? s.avslag.set(v.id, new Set()).get(v.id)!;
          g.add(f.avslagsgrunn);
        }
        if (!vant || f.utfall !== "medhold") continue;
        s.medhold.add(v.id);
        if (v.utfall === "medhold") s.fullt.add(v.id);
        const sanksjoner = sanksjonerFor(v, f);
        for (const x of ["heving", "prisavslag", "retting", "erstatning"] as const) if (sanksjoner.includes(x)) s.sanksjon[x].add(v.id);
      }
    }
  }
  const rad = (nokkel: string, s: Samler): Statistikkrad => ({
    nokkel,
    antallSaker: s.saker.size,
    antallMedhold: s.medhold.size,
    fullt: s.fullt.size,
    ...vanligstAvslag(s),
    heving: s.sanksjon.heving.size,
    prisavslag: s.sanksjon.prisavslag.size,
    retting: s.sanksjon.retting.size,
    erstatning: s.sanksjon.erstatning.size,
  });
  return [rad(ALLE, alle), ...[...per].sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => rad(k, s))];
}
