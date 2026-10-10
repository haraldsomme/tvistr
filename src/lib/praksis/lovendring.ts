// Said once, after the last practice paragraph, when a cited decision predates the 2024 amendment and the
// buyer's purchase does not.
import type { Lov } from "@/lib/sammenligning/typer";

export function lovendring(lov: Lov, sitert: Array<{ lovversjon: string }>): string | null {
  const eldre = sitert.filter((v) => v.lovversjon === "før_2024");
  if (lov !== "etter_2024" || !eldre.length) return null;
  const flere = eldre.length > 1;
  return (
    `${flere ? (eldre.length === sitert.length ? "Begge vedtakene" : "Vedtakene") + " gjelder kjøp" : "Vedtaket gjelder et kjøp"} før forbrukerkjøpsloven ble endret 1. januar 2024. ` +
    "Endringen forlenget blant annet fristen der en feil som viser seg, formodes å ha vært til stede ved leveringen, fra seks måneder til to år. " +
    `Ingen av reglene ${flere ? "vedtakene" : "vedtaket"} bygger på, er endret til kjøperens ugunst.`
  );
}
