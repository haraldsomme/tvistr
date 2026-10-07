import { kallVerktoy, type Forbruk } from "@/lib/ai/klient";
import { AVKLARING_SYSTEM, avklaringBruker } from "@/lib/ai/prompter";
import type { Innsending } from "@/lib/vurdering/innsending";
import { momenterFor } from "../momenter";
import { MAKS_RUNDER, type Utfylling } from "../utfylling";
import { planlegg } from "./brevplan";
import { RETTBARE_FELT, rettelseTilLagring, type Avklaringsrunde, type Rettelse, type Sporsmal } from "./rettelse";
import { sakForModell, TEMAER, type Saksmodell } from "./saksmodell";

export { RETTBARE_FELT, rettelseTilLagring, type Avklaringsrunde, type Rettelse, type Sporsmal };

// The clarifying round before the letter is written (spec: Avklaringsrunde): questions about what is
// missing or does not fit, the moments the committee weighed in similar cases, and corrections the
// buyer can accept. A correction is saved only when the buyer accepts it, through the same chain as
// any other save (`PATCH /api/sak/[id]`).

const MAKS_SPORSMAL = 8;

const AVKLAR = {
  name: "avklar",
  description: "Leverer spørsmålene og rettelsene i denne runden.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["status", "sporsmal", "rettelser"],
    properties: {
      status: { type: "string", enum: ["sporsmal", "klar"] },
      sporsmal: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["moment", "tema", "tekst", "alternativer", "flervalg"],
          properties: {
            moment: { type: "string" },
            tema: { type: "string", enum: [...TEMAER] },
            tekst: { type: "string" },
            alternativer: { type: "array", items: { type: "string" } },
            flervalg: { type: "boolean" },
          },
        },
      },
      rettelser: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["felt", "verdi", "begrunnelse"],
          properties: { felt: { type: "string", enum: [...RETTBARE_FELT] }, verdi: { type: "string" }, begrunnelse: { type: "string" } },
        },
      },
    },
  },
};

const normalisert = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// One round. Past the last round, or when the model has nothing new, the case is clear.
export async function avklar(m: Saksmodell, sak: { svar: Innsending; utfylling: Utfylling }): Promise<Avklaringsrunde & { forbruk: Forbruk | null }> {
  const runde = 1 + m.avklaringer.reduce((n, a) => Math.max(n, a.runde ?? 0), 0);
  if (runde > MAKS_RUNDER) return { status: "klar", runde, sporsmal: [], rettelser: [], forbruk: null };
  const plan = planlegg(m);
  const momenter = momenterFor(m.faktorer);
  const svar = await kallVerktoy<{ status: "sporsmal" | "klar"; sporsmal: (Omit<Sporsmal, "id" | "moment"> & { moment: string })[]; rettelser: Rettelse[] }>({
    system: AVKLARING_SYSTEM,
    verktoy: AVKLAR,
    bruker: avklaringBruker(sakForModell(m), m.kilder, plan, momenter, m.avklaringer),
    effort: "low",
    maksTokens: 4000,
  });
  const stilt = new Set(m.avklaringer.map((a) => normalisert(a.sporsmal)));
  const kjente = new Set(momenter.map((x) => x.id));
  const sporsmal = svar.input.sporsmal
    .filter((s) => s.tekst.trim() && !stilt.has(normalisert(s.tekst)))
    .slice(0, MAKS_SPORSMAL)
    .map(({ moment, ...s }, i): Sporsmal => ({ ...s, id: `r${runde}s${i + 1}`, ...(moment && kjente.has(moment) && { moment }) }));
  const rettelser = svar.input.rettelser.filter((r) => rettelseTilLagring(r, sak) !== null);
  const status = sporsmal.length || rettelser.length ? "sporsmal" : "klar";
  return { status, runde, sporsmal, rettelser, forbruk: svar.forbruk };
}
