import { AvvistAvModellError, kallVerktoy } from "@/lib/ai/klient";
import { SPRAKVASK_SYSTEM, sprakvaskBruker } from "@/lib/ai/prompter";
import { lesBeskrivelse } from "./utfylling";

// Rewrites the buyer's own description of the defect into plain letter language. The model only
// suggests: the buyer sees the suggestion next to their own text and chooses what goes in the letter.
// Only the description and the chosen defect categories are sent, never name, address or plate.

export type Forslag = { ok: true; tekst: string } | { ok: false; grunn: "avvist" | "feilet" };

const VERKTOY = {
  name: "foresla_beskrivelse",
  description: "Leverer forslaget til hvordan forbrukerens beskrivelse av feilen kan stå i reklamasjonsbrevet.",
  input_schema: {
    type: "object",
    properties: { tekst: { type: "string", description: "Beskrivelsen omskrevet til saklig bokmål i jeg-form, én til fem setninger i ett avsnitt." } },
    required: ["tekst"],
    additionalProperties: false,
  },
};

export async function sprakvask(beskrivelse: string, feiltyper: string[]): Promise<Forslag> {
  try {
    const { input } = await kallVerktoy<{ tekst: string }>({
      system: SPRAKVASK_SYSTEM,
      verktoy: VERKTOY,
      bruker: sprakvaskBruker(beskrivelse, feiltyper),
      effort: "low",
      maksTokens: 1024,
    });
    // The suggestion goes through the same check as the buyer's own text: one paragraph, no
    // brackets, within the length the letter allows.
    const tekst = lesBeskrivelse(input.tekst);
    return tekst ? { ok: true, tekst } : { ok: false, grunn: "feilet" };
  } catch (e) {
    return { ok: false, grunn: e instanceof AvvistAvModellError ? "avvist" : "feilet" };
  }
}
