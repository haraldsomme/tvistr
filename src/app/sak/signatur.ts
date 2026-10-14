// The paragraph citing a decision goes to the browser and back (finnVedtak → byggBrevet), since nothing
// is stored on the server. It is sealed on the way out (AES-256-GCM) and opened on the way in, so the
// letter is built from the server's own text, never from what the browser sends, and the quotes and
// the link to the decision cannot be read in the browser before payment (docs/vurdering.md, «Før og
// etter betaling»).
//
// TVISTR_SIGNATURNOKKEL must be set where more than one server instance runs (production); without it
// each instance makes its own key, which only works on one machine (development).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const g = globalThis as { __tvistrSignaturnokkel?: string };
function nokkel(): Buffer {
  let fast = process.env.TVISTR_SIGNATURNOKKEL;
  if (!fast) {
    if (!g.__tvistrSignaturnokkel) {
      console.warn("TVISTR_SIGNATURNOKKEL mangler; bruker en nøkkel for denne prosessen");
      g.__tvistrSignaturnokkel = randomBytes(32).toString("hex");
    }
    fast = g.__tvistrSignaturnokkel;
  }
  return createHash("sha256").update(`tvistr:forsegling:${fast}`).digest();
}

// iv (12) + tag (16) + the encrypted JSON, as base64url.
export function forsegle(data: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", nokkel(), iv);
  const ut = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ut]).toString("base64url");
}

// What forsegle sealed, or undefined for anything this server did not seal (or that was changed).
export function apne(forseglet: unknown): unknown {
  if (typeof forseglet !== "string" || forseglet.length > 20_000) return undefined;
  try {
    const b = Buffer.from(forseglet, "base64url");
    if (b.length < 29) return undefined;
    const d = createDecipheriv("aes-256-gcm", nokkel(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
}
