import { beregnFaktorer, iDag, type Faktorer } from "@/lib/vurdering/faktorer";
import {
  lesInnsending,
  tilKlageInput,
  type Innsending,
} from "@/lib/vurdering/innsending";

// A change to the answers from the assessment, made on the letter page after the case was opened.
// Checked like the form checks it, so the letter can always be built from what is stored. A deadline
// that has passed does not reject the change: the buyer has bought the letter, so it stays, with a
// notice. `stopp` says whether that is so, and why.
export function lesSvar(
  raw: unknown,
  idag = iDag(),
):
  | { ok: true; svar: Innsending; stopp: Faktorer["stopp"] }
  | { ok: false; feil: string } {
  const parsed = tilKlageInput(raw, idag);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    svar: lesInnsending(raw as Record<string, unknown>),
    stopp: beregnFaktorer(parsed.input, idag).stopp,
  };
}
