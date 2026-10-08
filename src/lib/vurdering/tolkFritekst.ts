import { kallVerktoy } from "@/lib/ai/klient";
import { VURDERING_SYSTEM, vurderingBruker } from "@/lib/ai/prompter";
import { FEILTYPER, MANGELSGRUNNLAG } from "@/lib/ai/skjema";
import type { Feiltype, KlageInput, Mangelsgrunnlag } from "./typer";

// Not used by the assessment any more: the free text is read when the letter is written.
export type BeskrivelseKvalitet = "ubrukelig" | "tynn" | "god";
export type Tolkning = { feiltyper: Feiltype[]; mangelsgrunnlag: Mangelsgrunnlag[]; kvalitet?: BeskrivelseKvalitet };

const VERKTOY = {
  name: "registrer_feilbeskrivelse",
  description: "Registrerer hvilke feiltyper og hvilket mangelsgrunnlag forbrukerens beskrivelse gjelder.",
  input_schema: {
    type: "object",
    properties: {
      feiltyper: { type: "array", items: { type: "string", enum: [...FEILTYPER] } },
      mangelsgrunnlag: { type: "array", items: { type: "string", enum: [...MANGELSGRUNNLAG] } },
      beskrivelse_kvalitet: {
        type: "string",
        enum: ["god", "tynn", "ubrukelig"],
        description: "god = hva som er galt pluss når, hvordan, hvor eller verkstedfunn; tynn = bare hva som er galt; ubrukelig = sier ikke hva som er galt.",
      },
    },
    required: ["feiltyper", "mangelsgrunnlag", "beskrivelse_kvalitet"],
    additionalProperties: false,
  },
};

// Only the user's own description and button choice are sent: no seller name, plate or other form fields.
export async function tolkFritekst(input: Pick<KlageInput["feilen"], "typer"> & { beskrivelse: string }): Promise<Tolkning> {
  const { input: svar } = await kallVerktoy<{ feiltyper: Tolkning["feiltyper"]; mangelsgrunnlag: Tolkning["mangelsgrunnlag"]; beskrivelse_kvalitet: BeskrivelseKvalitet }>({
    system: VURDERING_SYSTEM,
    verktoy: VERKTOY,
    bruker: vurderingBruker(input.beskrivelse, input.typer ?? []),
    effort: "low",
    maksTokens: 1024,
  });
  return { feiltyper: svar.feiltyper, mangelsgrunnlag: svar.mangelsgrunnlag, kvalitet: svar.beskrivelse_kvalitet };
}
