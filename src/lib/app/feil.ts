// The faults one by one, as the letter, the verdict and the ranking count them: an area, or a
// subcategory the buyer dated on its own (f_under, key «hoved.under»). An area whose chosen
// subcategories are all dated on their own is no fault of its own.
import { opplysningsfeil } from "@/lib/brev/feiltype";
import type { Skjema } from "./skjema";

// `felt` and `descFelt`: the letter's tags for the date and the description, so a click in the letter
// opens the right card. `nokkel` names the fault for the decision it cites: «hoved.under» for a
// subcategory dated on its own, else the area.
export type Feilpost = { hoved: string; under: string[]; found: string; desc: string; felt: string; descFelt: string; nokkel: string };

type Feilsvar = Pick<Skjema, "f_cats" | "f_parts" | "f_area" | "f_catdesc" | "f_under">;

export function feilposter(s: Feilsvar): Feilpost[] {
  return s.f_cats.flatMap((c) => {
    const valgt = s.f_parts[c] ?? [];
    const egen = (u: string) => s.f_under?.[`${c}.${u}`];
    const egne = valgt.filter((u) => typeof egen(u)?.found === "string");
    const rest = valgt.filter((u) => !egne.includes(u));
    return [
      ...egne.map((u) => ({ hoved: c, under: [u], found: egen(u)!.found, desc: (egen(u)!.desc ?? "").trim(), felt: `f_under.${c}.${u}.found`, descFelt: `f_under.${c}.${u}.desc`, nokkel: `${c}.${u}` })),
      ...(egne.length && !rest.length ? [] : [{ hoved: c, under: rest, found: s.f_area[c]?.found ?? "", desc: (s.f_catdesc[c] ?? "").trim(), felt: `f_area.${c}.found`, descFelt: `f_catdesc.${c}`, nokkel: c }]),
    ];
  });
}

// The faults in the order the letter numbers them: by the day each was discovered, the undated last,
// otherwise as chosen.
export const feilposterSortert = (s: Feilsvar): Feilpost[] =>
  feilposter(s)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.found || "9").localeCompare(b.p.found || "9") || a.i - b.i)
    .map((x) => x.p);

// How a fault affects the buyer: its own choice, else its area's (a subcategory just dated on its own),
// else, for a case saved with one list for all the faults, that list.
type Virkningssvar = Partial<Pick<Skjema, "f_virkning" | "f_impact">>;
export function virkningFor(s: Virkningssvar, p: Pick<Feilpost, "nokkel" | "hoved">): string[] {
  const v = s.f_virkning ?? {};
  return v[p.nokkel] ?? v[p.hoved] ?? (Object.keys(v).length ? [] : (s.f_impact ?? []));
}

// Every fault is in what the seller said or promised: no presumption, nothing a workshop repairs.
export const bareOpplysningsfeil = (s: Feilsvar) => s.f_cats.length > 0 && s.f_cats.every((c) => opplysningsfeil(c, s.f_parts[c] ?? []));
