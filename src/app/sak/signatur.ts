// The paragraph citing a decision goes to the browser and back (finnVedtak → byggBrevet), since nothing
// is stored on the server. It is signed on the way out and checked on the way in, so the letter is
// built from the server's own text, never from what the browser sends.
//
// TVISTR_SIGNATURNOKKEL must be set where more than one server instance runs (production); without it
// each instance makes its own key, which only works on one machine (development).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const g = globalThis as { __tvistrSignaturnokkel?: string };
function nokkel(): string {
  const fast = process.env.TVISTR_SIGNATURNOKKEL;
  if (fast) return fast;
  if (!g.__tvistrSignaturnokkel) {
    console.warn("TVISTR_SIGNATURNOKKEL mangler; bruker en nøkkel for denne prosessen");
    g.__tvistrSignaturnokkel = randomBytes(32).toString("hex");
  }
  return g.__tvistrSignaturnokkel;
}

export const signer = (data: unknown): string => createHmac("sha256", nokkel()).update(JSON.stringify(data)).digest("base64url");

export function sjekkSignatur(data: unknown, signatur: unknown): boolean {
  if (typeof signatur !== "string") return false;
  const a = Buffer.from(signer(data));
  const b = Buffer.from(signatur);
  return a.length === b.length && timingSafeEqual(a, b);
}
