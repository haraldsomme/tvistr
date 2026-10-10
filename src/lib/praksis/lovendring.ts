// Said once, after the last practice paragraph, when a cited decision predates the 2024 amendment and the
// buyer's purchase does not.
import type { Lov } from "@/lib/sammenligning/typer";

// Names the decisions it concerns, so it is never unclear which of several cited ones predate the change.
export function lovendring(lov: Lov, sitert: Array<{ lovversjon: string; saksnummer: string }>): string | null {
  const eldre = [...new Set(sitert.filter((v) => v.lovversjon === "før_2024").map((v) => v.saksnummer))];
  if (lov !== "etter_2024" || !eldre.length) return null;
  const flere = eldre.length > 1;
  const navn = flere ? `${eldre.slice(0, -1).join(", ")} og ${eldre.at(-1)}` : eldre[0];
  return (
    `${flere ? `Vedtak ${navn} gjelder kjøp` : `Vedtak ${navn} gjelder et kjøp`} før forbrukerkjøpsloven ble endret 1. januar 2024. ` +
    "Endringen forlenget blant annet fristen der en feil som viser seg, formodes å ha vært til stede ved leveringen, fra seks måneder til to år. " +
    `Ingen av reglene ${flere ? "vedtakene" : "vedtaket"} bygger på, er endret til kjøperens ugunst.`
  );
}
