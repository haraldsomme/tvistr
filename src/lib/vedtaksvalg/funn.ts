// Findings from data washes against a decision's full text, logged in `kontrollfunn` where they can be
// reviewed and undone (`angret`): a defect the committee's assessment does not name, or did not find
// a defect on its own, gets `samlet = true` in the feilvurdering; a quote that is not the committee's
// standpoint is removed from the extraction. The imports apply the findings not undone.
import type { Lagret as Avgjorende } from "@/lib/avgjorende/skjema";
import type { Lagret as Feilvurdering } from "@/lib/feilvurdering/skjema";

export type Sporsmal = "nevnt" | "for_seg" | "sitat";
export type Kontrollfunn = { vedtakId: number; feilId: string | null; sporsmal: Sporsmal; sitat: string | null; begrunnelse: string };

// Defects found not named or not judged on their own.
const samletIder = (funn: Pick<Kontrollfunn, "feilId" | "sporsmal">[]) => new Set(funn.filter((f) => f.sporsmal !== "sitat" && f.feilId).map((f) => f.feilId!));
const fjernedeSitater = (funn: Pick<Kontrollfunn, "sporsmal" | "sitat">[]) => new Set(funn.filter((f) => f.sporsmal === "sitat" && f.sitat).map((f) => f.sitat!));

export function anvendPaFeilvurdering<T extends Pick<Feilvurdering, "feil">>(lagret: T, funn: Pick<Kontrollfunn, "feilId" | "sporsmal">[]): T {
  const samlet = samletIder(funn);
  return samlet.size ? { ...lagret, feil: lagret.feil.map((f) => (samlet.has(f.id) ? { ...f, samlet: true } : f)) } : lagret;
}

export function anvendPaAvgjorende(lagret: Avgjorende, funn: Pick<Kontrollfunn, "sporsmal" | "sitat">[]): Avgjorende {
  const bort = fjernedeSitater(funn);
  if (!bort.size) return lagret;
  return {
    ...lagret,
    feil: lagret.feil.map((f) => ({ ...f, sitater: f.sitater.filter((s) => !bort.has(s)) })),
    ...(lagret.rettslige_sitater && { rettslige_sitater: lagret.rettslige_sitater.filter((r) => !bort.has(r.sitat)) }),
  };
}
