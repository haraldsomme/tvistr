import { kallVerktoy, type Forbruk } from "@/lib/ai/klient";
import { BREV_GJENNOMSYN_SYSTEM, gjennomsynBruker, RUBRIKK } from "@/lib/ai/prompter";
import { norskDato } from "../brev";
import type { Brevplan } from "./brevplan";
import { brevTekst, fyllInn } from "./render";
import { sakForModell, type Saksmodell } from "./saksmodell";
import type { Funn, Utkast } from "./typer";

// The review: another model, with a prompt of its own and none of the author's instructions, reads the
// letter against the rubric. The account and the e-mail stay marks, so no personal data is sent.

const VURDER_BREV = {
  name: "vurder_brev",
  description: "Leverer vurderingen av brevet, ett svar per punkt i rubrikken.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["punkter"],
    properties: {
      punkter: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["punkt", "oppfylt", "hvorfor", "setning"],
          properties: {
            punkt: { type: "string", enum: RUBRIKK.map((p) => p.id) },
            oppfylt: { type: "boolean" },
            hvorfor: { type: "string" },
            setning: { type: "string" },
          },
        },
      },
    },
  },
};

// The presumption period as the plan has it, so the reviewer does not work it out from when the defect showed.
function formodningFor(plan: Brevplan): string {
  const periode = plan.argumenter.find((a) => a.id === "formodning")?.data.periode;
  return typeof periode === "string" ? `${periode} etter levering (gjelder i denne saken)` : "gjelder ikke i denne saken (feilen viste seg etter perioden)";
}

export async function gjennomse(m: Saksmodell, plan: Brevplan, utkast: Utkast): Promise<{ funn: Funn[]; forbruk: Forbruk }> {
  const utenAvsender: Saksmodell = { ...m, utfylling: { ...m.utfylling, avsender: undefined } };
  const brev = brevTekst(fyllInn(utkast, plan, utenAvsender, m.idag));
  const svar = await kallVerktoy<{ punkter: { punkt: string; oppfylt: boolean; hvorfor: string; setning: string }[] }>({
    system: BREV_GJENNOMSYN_SYSTEM,
    verktoy: VURDER_BREV,
    bruker: gjennomsynBruker(brev, { brevdato: norskDato(m.idag), formodning: formodningFor(plan) }, sakForModell(m), m.kilder, plan.argumenter.map((a) => ({ id: a.id, foring: a.foring }))),
    effort: "medium",
    maksTokens: 8000,
  });
  const funn = svar.input.punkter.filter((p) => !p.oppfylt).map(({ punkt, hvorfor, setning }) => ({ punkt, hvorfor, setning }));
  return { funn, forbruk: svar.forbruk };
}
