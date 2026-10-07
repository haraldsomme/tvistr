import { kallVerktoy, MODELL_FORFATTER, type Forbruk } from "@/lib/ai/klient";
import { BREV_FORFATTER_SYSTEM, forfatterBruker } from "@/lib/ai/prompter";
import { ARGUMENT_IDER, type Brevplan } from "./brevplan";
import { KILDER, sakForModell, type Saksmodell } from "./saksmodell";
import type { Utkast } from "./typer";

// The author: one call that writes the whole letter from the case and the plan. Only the case as
// `sakForModell` gives it, the cleaned pasted texts and the plan are sent.

const SKRIV_BREV = {
  name: "skriv_brev",
  description: "Leverer hele brevteksten som avsnitt av setninger, og sitatene teksten viser til.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["sitater", "avsnitt"],
    properties: {
      sitater: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "kilde", "tekst"],
          properties: {
            id: { type: "string", description: "Kort id, for eksempel r1." },
            kilde: { type: "string", enum: [...KILDER] },
            tekst: { type: "string", description: "Ordrett utdrag av kildeteksten, tegn for tegn." },
          },
        },
      },
      avsnitt: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["setninger"],
          properties: {
            setninger: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["tekst", "argumenter"],
                properties: {
                  tekst: { type: "string" },
                  argumenter: { type: "array", items: { type: "string", enum: [...ARGUMENT_IDER] } },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function forfatt(m: Saksmodell, plan: Brevplan, revisjon?: { forrige: Utkast; merknader: string[] }): Promise<{ utkast: Utkast; forbruk: Forbruk }> {
  const svar = await kallVerktoy<Utkast>({
    modell: MODELL_FORFATTER,
    system: BREV_FORFATTER_SYSTEM,
    verktoy: SKRIV_BREV,
    bruker: forfatterBruker(sakForModell(m), m.kilder, plan, revisjon),
    effort: "high",
    maksTokens: 16000,
  });
  return { utkast: svar.input, forbruk: svar.forbruk };
}
