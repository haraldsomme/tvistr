import { TEMA_TEKST } from "../tekster";
import type { EksempelVedtak, TemaTall } from "../typer";

export type Tema = { tekst: string; andelMedhold: number; andelAvslag: number; retning: "medhold" | "avslag"; n: number };
export type AvgjordeKort = { temaer: Tema[]; eksempler: EksempelVedtak[]; nMedhold: number; nAvslag: number };

const MIN_FOREKOMST = 10;
// A theme only says something when the shares differ by at least this much.
const MIN_FORSKJELL = 0.1;

// The themes that most separate won from lost decisions in the sample, by the difference in the share
// of decisions where the theme was an issue.
export function avgjordeKort(t: TemaTall, eksempler: EksempelVedtak[]): AvgjordeKort {
  const temaer: Tema[] = [];
  if (t.medhold > 0 && t.avslag > 0) {
    for (const r of t.rader) {
      const tekst = TEMA_TEKST[`${r.kilde}:${r.verdi}`];
      if (!tekst || r.nMedhold + r.nAvslag < MIN_FOREKOMST) continue;
      const andelMedhold = r.nMedhold / t.medhold;
      const andelAvslag = r.nAvslag / t.avslag;
      if (Math.abs(andelMedhold - andelAvslag) < MIN_FORSKJELL) continue;
      temaer.push({ tekst, andelMedhold, andelAvslag, retning: andelMedhold >= andelAvslag ? "medhold" : "avslag", n: r.nMedhold + r.nAvslag });
    }
    temaer.sort((a, b) => Math.abs(b.andelMedhold - b.andelAvslag) - Math.abs(a.andelMedhold - a.andelAvslag));
  }
  const vunne = eksempler.filter((e) => e.utfall !== "ikke_medhold").slice(0, 3);
  const tapte = eksempler.filter((e) => e.utfall === "ikke_medhold").slice(0, 2);
  return { temaer: temaer.slice(0, 5), eksempler: [...vunne, ...tapte], nMedhold: t.medhold, nAvslag: t.avslag };
}
