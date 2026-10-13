import type { Brevsak, Setning } from "./typer";

// The enclosures follow from the answers: no input of their own. null when there are none.
export function vedlegg(s: Brevsak): Setning[] {
  const ut: Setning[] = [];
  if (s.feil.some((f) => f.verksted === "skriftlig")) ut.push({ tekst: "Verkstedets skriftlige vurdering", kilde: "skjema:feil[].verksted" });
  if (s.feil.some((f) => f.opplysning === "skriftlig")) ut.push({ tekst: "Annonse/kjøpekontrakt", kilde: "skjema:feil[].opplysning" });
  if (s.utlegg.length) ut.push({ tekst: "Kvitteringer for utlegg", kilde: "skjema:utlegg" });
  if (s.tidligere?.form === "skriftlig") ut.push({ tekst: "Tidligere reklamasjon", kilde: "skjema:tidligere" });
  return ut;
}
