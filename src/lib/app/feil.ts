// The faults one by one, as the letter, the verdict and the ranking count them: an area, or a
// subcategory the buyer dated on its own (f_under, key «hoved.under»). An area whose chosen
// subcategories are all dated on their own is no fault of its own.
import { opplysningsfeil } from "@/lib/brev/feiltype";
import type { Skjema } from "./skjema";

// `felt` and `descFelt`: the letter's tags for the date and the description, so a click in the letter
// opens the right card.
export type Feilpost = { hoved: string; under: string[]; found: string; desc: string; felt: string; descFelt: string };

type Feilsvar = Pick<Skjema, "f_cats" | "f_parts" | "f_area" | "f_catdesc" | "f_under">;

export function feilposter(s: Feilsvar): Feilpost[] {
  return s.f_cats.flatMap((c) => {
    const valgt = s.f_parts[c] ?? [];
    const egen = (u: string) => s.f_under?.[`${c}.${u}`];
    const egne = valgt.filter((u) => typeof egen(u)?.found === "string");
    const rest = valgt.filter((u) => !egne.includes(u));
    return [
      ...egne.map((u) => ({ hoved: c, under: [u], found: egen(u)!.found, desc: (egen(u)!.desc ?? "").trim(), felt: `f_under.${c}.${u}.found`, descFelt: `f_under.${c}.${u}.desc` })),
      ...(egne.length && !rest.length ? [] : [{ hoved: c, under: rest, found: s.f_area[c]?.found ?? "", desc: (s.f_catdesc[c] ?? "").trim(), felt: `f_area.${c}.found`, descFelt: `f_catdesc.${c}` }]),
    ];
  });
}

// Every fault is in what the seller said or promised: no presumption, nothing a workshop repairs.
export const bareOpplysningsfeil = (s: Feilsvar) => s.f_cats.length > 0 && s.f_cats.every((c) => opplysningsfeil(c, s.f_parts[c] ?? []));
