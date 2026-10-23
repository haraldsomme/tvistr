import "server-only";
// The letter before payment, built on the server so that the template text it hides never reaches
// the browser: today's date, redacted by `sladd`, and in place of the decision only the car and the outcome
// from its card, never its number, quote or link.
import { liste } from "@/lib/brev/format";
import type { Vedtakskort } from "@/lib/vurdering/vurdering";
import { byggBrev } from "./brev";
import { feilposter } from "./feil";
import { sladd } from "./sladd";
import type { Blokk, Del } from "./brevtyper";
import type { Skjema } from "./skjema";
import { syncAreas } from "./skjema";

const venter = (b: Blokk) => b.t === "p" && b.tekst.some((d) => typeof d === "object" && "ph" in d && d.ph === "lignende sak hentes");

// The card stands under the first fault only; the others keep the placeholder until payment.
export function forhandsvisning(s: Skjema, kort: Vedtakskort | null, idag: string): Blokk[] {
  const skjema = { ...syncAreas(s), l_date: idag };
  const B = sladd(byggBrev(skjema, kort ? Object.fromEntries(feilposter(skjema).map((p) => [p.nokkel, "venter" as const])) : {}, idag));
  if (!kort) return B;
  const i = B.findIndex(venter);
  if (i < 0) return B;
  const b = B[i] as { t: "p"; tekst: Del[] };
  const tekst: Del[] = [
    ...b.tekst.filter((d) => typeof d === "object" && "kursiv" in d),
    " ",
    { skjult: 40 },
    " ",
    { felt: "vedtak.bil", tekst: kort.bil },
    ". ",
    ...(kort.fikk.length ? ["Kjøperen fikk medhold i ", { felt: "vedtak.utfall", tekst: liste(kort.fikk) }, ". "] : []),
    { skjult: 240 },
  ];
  return B.map((x, j) => (j === i ? { t: "p", tekst } : x));
}
