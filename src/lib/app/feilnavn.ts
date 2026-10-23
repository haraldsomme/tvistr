// The faults by name, as the letter writes them: after «oppdaget jeg» (funn) and as the numbered
// subheading per fault (feiloverskrift). Not server-only: «Lignende vedtak» names the faults the same way.
import { feilord } from "@/lib/brev/feilord";
import type { Del } from "./brevtyper";
import type { Feilpost } from "./feil";
import { cap } from "./format";

// One of the buyer's answers as written in the letter, tagged with its field; nothing when empty.
export const fe = (felt: string, tekst: string): Del => (tekst ? { felt, tekst } : "");
// liste and join(" ") over parts, so a tagged answer stays its own part.
export const listJoinD = (a: Del[][]): Del[] => a.flatMap((x, i) => [...(i === 0 ? [] : i === a.length - 1 ? [" og "] : [", "]), ...x]);
export const joinD = (a: Del[][]): Del[] => a.flatMap((x, i) => [...(i ? [" "] : []), ...x]);

// The faults after «oppdaget jeg», each tagged with its area: «feil ved turboen og clutchen» first,
// then the phrases of their own («rust»). «ved» is repeated when a name has its own «og», «eller» or
// comma, so the list stays readable.
export function funn(poster: Feilpost[]): Del[] {
  const ord = poster.flatMap((p) => feilord(p.hoved, p.under).map((o) => ({ c: p.hoved, o })));
  const ved = ord.flatMap(({ c, o }) => ("ved" in o ? [{ c, t: o.ved }] : []));
  const sammensatt = ved.some((x) => /,| og | eller /.test(x.t));
  const deler: Del[][] = [];
  if (ved.length) deler.push(["feil ved ", ...listJoinD(ved.map((x, i) => [...(i && sammensatt ? ["ved "] : []), fe(`f_parts.${x.c}`, x.t)]))]);
  for (const { c, o } of ord) if ("tekst" in o) deler.push([fe(`f_parts.${c}`, o.tekst)]);
  return listJoinD(deler);
}

// The parts as plain text.
export const delTekst = (d: Del[]) => d.map((x) => (typeof x === "string" ? x : "ph" in x ? `[${x.ph}]` : "felt" in x ? x.tekst : "kursiv" in x ? x.kursiv : "")).join("");

// A fault's subheading, without its number: «Feil ved klimaanlegget (AC)» under «Mangelen», «Feilen ved
// klimaanlegget (AC)» (or «Feilene ved …» for several) under «Rettslig grunnlag». A phrase of its own
// («Lakkskader eller bulker») is the same in both.
export function feiloverskrift(p: Feilpost, form: "ubestemt" | "bestemt"): Del[] {
  const [forste, ...resten] = funn([p]);
  const flere = feilord(p.hoved, p.under).filter((o) => "ved" in o).length > 1;
  const start: Del =
    forste === "feil ved " ? (form === "bestemt" ? (flere ? "Feilene ved " : "Feilen ved ") : "Feil ved ") : typeof forste === "object" && "felt" in forste ? { ...forste, tekst: cap(forste.tekst) } : typeof forste === "string" ? cap(forste) : forste;
  return [start, ...resten];
}
