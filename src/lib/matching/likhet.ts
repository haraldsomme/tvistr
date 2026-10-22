import type { Rangert } from "./ranger";
import type { Brukersak } from "./typer";
import { VEKTER } from "./vekter";

// The most a decision can get against the buyer's answers: every criterion the buyer gave a value for.
// The same for every decision in the case, so the likeness falls with the ranking on level A, and on
// level B the defect counts in it, so a decision about another defect does not come near 100.
function maksFor(r: Rangert, sak: Brukersak): number {
  const kat = sak.kategorier.find((k) => k.hoved === r.hoved) ?? sak.kategorier[0];
  const med: [boolean, number][] = [
    [!!kat?.under.length, VEKTER.underkategori.likt],
    [!!kat, VEKTER.tidsniva.likt],
    [sak.km !== null, VEKTER.km.likt],
    [sak.alder !== null, VEKTER.alder.likt],
    [sak.somDenEr !== null, VEKTER.som_den_er.likt],
    [sak.krav !== null, VEKTER.krav.likt],
    [!!kat, VEKTER.egen_vurdering.likt],
    [!!kat, VEKTER.grunnlag.likt],
  ];
  return med.reduce((s, [ja, p]) => s + (ja ? p : 0), 0);
}

// How much a decision resembles the buyer's case, 0–100, on the points the ranking sorts by. A value
// the decision lacks, or a defect it does not share (level B), counts as 0. Not a chance of winning.
export function likhet(r: Rangert, sak: Brukersak): number {
  const maks = maksFor(r, sak);
  return maks ? Math.min(100, Math.round((100 * r.poengsum) / maks)) : 0;
}
