import Anthropic from "@anthropic-ai/sdk";
import { sjekkSkjema } from "./skjemasjekk";

export const MODELL = "claude-sonnet-5-5";

// USD per million tokens for claude-sonnet-5-5.
const PRIS = { inn: 2, ut: 10, cacheSkriv: 2.5, cacheLes: 0.2 };

let klient: Anthropic | null = null;
function hentKlient() {
  klient ??= new Anthropic({ maxRetries: 6, timeout: 5 * 60_000 });
  return klient;
}

export type Forbruk = { tokensInn: number; tokensUt: number; kostnadUsd: number };

export class AvvistAvModellError extends Error {}

// Errors that will hit every request (no credit, bad key, no access): stop the run instead of
// marking thousands of documents as failed.
export function erKontofeil(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false;
  return e.status === 401 || e.status === 403 || (e.status === 400 && /credit balance/i.test(e.message));
}

export type VerktoySvar<T> = { input: T; modell: string; forbruk: Forbruk };

/**
 * One request that must end in a call to the single tool. Forced tool_choice is not available
 * on this model, so we ask for the call in the prompt and retry if it is missing. Schemas too
 * large for strict mode (`strict: false`) are validated here instead, and retried if invalid.
 */
export async function kallVerktoy<T>(opts: {
  system: string;
  verktoy: { name: string; description: string; input_schema: Record<string, unknown> };
  bruker: string;
  effort: "low" | "medium" | "high";
  maksTokens: number;
  strict?: boolean;
}): Promise<VerktoySvar<T>> {
  const strict = opts.strict ?? true;
  const forbruk: Forbruk = { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 };
  let sisteFeil = "";

  for (let forsok = 1; forsok <= 3; forsok++) {
    const svar = await hentKlient().beta.messages.create({
      model: MODELL,
      max_tokens: opts.maksTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort },
      // Tools + system are identical across all calls, so they are cached.
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      tools: [{ ...opts.verktoy, input_schema: opts.verktoy.input_schema as Anthropic.Beta.BetaTool.InputSchema, strict }],
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: opts.bruker }],
    });

    const u = svar.usage;
    const skriv = u.cache_creation_input_tokens ?? 0;
    const les = u.cache_read_input_tokens ?? 0;
    forbruk.tokensInn += u.input_tokens + skriv + les;
    forbruk.tokensUt += u.output_tokens;
    forbruk.kostnadUsd +=
      (u.input_tokens * PRIS.inn + skriv * PRIS.cacheSkriv + les * PRIS.cacheLes + u.output_tokens * PRIS.ut) / 1e6;

    if (svar.stop_reason === "refusal") {
      throw new AvvistAvModellError(`modellen avviste (${svar.stop_details?.category ?? "ukjent kategori"})`);
    }
    if (svar.stop_reason === "max_tokens") {
      sisteFeil = "svaret ble kuttet (max_tokens)";
      continue;
    }
    const kall = svar.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === opts.verktoy.name);
    if (!kall) {
      sisteFeil = "modellen kalte ikke verktøyet";
      continue;
    }
    const skjemafeil = strict ? [] : sjekkSkjema(opts.verktoy.input_schema, kall.input);
    if (skjemafeil.length === 0) return { input: kall.input as T, modell: svar.model, forbruk };
    sisteFeil = `ugyldig svar: ${skjemafeil.slice(0, 5).join("; ")}`;
  }
  throw new Error(`${sisteFeil} etter 3 forsøk`);
}
