import "server-only";
// The letter before payment, built on the server so that the template text it hides never reaches
// the browser: today's date, redacted by `sladd`, and in place of the decision only the car and the outcome
// from its card, never its number, quote or link.
import { liste } from "@/lib/brev/format";
import type { Vedtakskort } from "@/lib/vurdering/vurdering";
import { byggBrev } from "./brev";
import { sladd } from "./sladd";
import type { Blokk, Del } from "./brevtyper";
import type { Skjema } from "./skjema";
import { syncAreas } from "./skjema";

const venter = (b: Blokk) => b.t === "p" && b.tekst.length === 1 && typeof b.tekst[0] === "object" && "ph" in b.tekst[0] && b.tekst[0].ph === "lignende sak hentes";

export function forhandsvisning(s: Skjema, kort: Vedtakskort | null, idag: string): Blokk[] {
  const B = sladd(byggBrev({ ...syncAreas(s), l_date: idag }, kort ? "venter" : null, idag));
  if (!kort) return B;
  const tekst: Del[] = [
    { skjult: 40 },
    " ",
    { felt: "vedtak.bil", tekst: kort.bil },
    ". ",
    ...(kort.fikk.length ? ["Kjøperen fikk medhold i ", { felt: "vedtak.utfall", tekst: liste(kort.fikk) }, ". "] : []),
    { skjult: 240 },
  ];
  return B.map((b) => (venter(b) ? { t: "p", tekst } : b));
}
