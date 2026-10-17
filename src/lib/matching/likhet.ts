import type { Rangert } from "./ranger";
import type { Brukersak } from "./typer";
import { VEKTER, type Vekter } from "./vekter";

// The most a decision can get against the buyer's answers: every criterion the buyer gave a value for.
// The same for every decision in the case, so the likeness falls with the ranking on level A. The
// ranking's own `maks` varies with the decision (a ground the buyer was not asked about drops out), and
// on level B it leaves out the defect, which would put a decision about another defect near 100.
function maksFor(r: Rangert, sak: Brukersak, v: Vekter): number {
  const kat = sak.kategorier.find((k) => k.hoved === r.hoved) ?? sak.kategorier[0];
  const med: [boolean, number][] = [
    [!!kat?.under.length, v.underkategori.likt],
    [!!kat, v.tidsniva.likt],
    [sak.km !== null, v.km.likt],
    [sak.alder !== null, v.alder.likt],
    [sak.somDenEr !== null, v.som_den_er.likt],
    [sak.krav !== null, v.krav.likt],
    [!!kat, v.egen_vurdering.likt],
    [!!kat, v.grunnlag.likt],
  ];
  return med.reduce((s, [ja, p]) => s + (ja ? p : 0), 0);
}

// How much a decision resembles the buyer's case, 0–100, on the points the ranking sorts by. A value
// the decision lacks, or a defect it does not share (level B), counts as 0. Not a chance of winning.
export function likhet(r: Rangert, sak: Brukersak, v: Vekter = VEKTER): number {
  const maks = maksFor(r, sak, v);
  return maks ? Math.min(100, Math.round((100 * r.poengsum) / maks)) : 0;
}
