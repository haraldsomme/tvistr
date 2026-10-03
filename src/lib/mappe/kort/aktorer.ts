import { FEILTYPE_TEKST } from "../tekster";
import { andel, MIN_N_FORHANDLER, MIN_N_MODELL, type Andel, type ForFa, type ForhandlerTall, type ModellTall } from "../typer";

export type AktorKort = {
  forhandler: { n: number; medhold: Andel | ForFa; sisteAr: number | null; feiltyper: string[]; gammel: boolean } | null;
  modell: { n: number; medhold: Andel | ForFa } | null;
};

// A decision from before this year counts as old: dealers change owners and practice.
const GAMMEL_FOR = 2024;

export function aktorKort(f: ForhandlerTall | null, m: ModellTall): AktorKort {
  return {
    forhandler:
      f && f.n > 0
        ? {
            n: f.n,
            medhold: andel(f.vunnet, f.n, MIN_N_FORHANDLER),
            sisteAr: f.sisteAr,
            feiltyper: f.feiltyper.slice(0, 3).map((x) => FEILTYPE_TEKST[x.verdi] ?? x.verdi),
            gammel: f.sisteAr !== null && f.sisteAr < GAMMEL_FOR,
          }
        : null,
    modell: m.n > 0 ? { n: m.n, medhold: andel(m.vunnet, m.n, MIN_N_MODELL) } : null,
  };
}
