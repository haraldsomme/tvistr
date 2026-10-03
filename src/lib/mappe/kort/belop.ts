import { MIN_N, type BelopTall, type Kvartiler } from "../typer";

const rund100 = (x: number) => Math.round(x / 100) * 100;
const pct = (x: number) => `${Math.round(x * 100)} %`;

export type BelopKort = {
  tilkjent: Kvartiler | null;
  prisavslag: { utbedringNok: number; n: number; fra: number; median: number; til: number } | null;
  heving: { n: number; fullt: number; delvis: number; ikke: number } | null;
  erstatning: { n: number; andelTilkjent: number; median: number | null } | null;
  anbefaling: string[];
};

// What the buyer can expect to be awarded, from the decisions in the sample. `krav` carries the
// repair cost the buyer gave on the letter page; the assessment may have one too.
export function belopKort(t: BelopTall, krav: { utbedringNok?: number }, utbedringFraVurdering?: number | null): BelopKort {
  const utb = krav.utbedringNok ?? utbedringFraVurdering ?? null;
  const pa = t.prisavslagAvUtbedring;
  const heving = t.heving && t.heving.n >= MIN_N ? t.heving : null;
  const anbefaling: string[] = [];
  if (heving) {
    anbefaling.push(
      `Av ${heving.n} lignende saker der heving var hovedkravet fikk ${pct(heving.fullt / heving.n)} full heving og ${pct(heving.delvis / heving.n)} delvis medhold, ofte som prisavslag. Brevet krever derfor prisavslag subsidiært hvis du velger heving.`,
    );
  }
  if (pa && pa.n >= MIN_N) {
    anbefaling.push(`Tilkjent prisavslag var typisk ${pct(pa.median)} av utbedringskostnaden (midtre halvdel ${pct(pa.p25)}–${pct(pa.p75)}). Dokumenter kostnaden med et prisoverslag eller en faktura.`);
  }
  return {
    tilkjent: t.tilkjent && t.tilkjent.n >= MIN_N ? t.tilkjent : null,
    prisavslag: utb && pa && pa.n >= MIN_N ? { utbedringNok: utb, n: pa.n, fra: rund100(utb * pa.p25), median: rund100(utb * pa.median), til: rund100(utb * pa.p75) } : null,
    heving,
    erstatning: t.erstatning.nKrevd >= MIN_N ? { n: t.erstatning.nKrevd, andelTilkjent: t.erstatning.nTilkjent / t.erstatning.nKrevd, median: t.erstatning.median } : null,
    anbefaling,
  };
}
