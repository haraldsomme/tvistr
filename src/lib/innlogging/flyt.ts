// Helpers for the login routes: where to send the user afterwards, and the site's own origin.

// Holds the login's state from /logg-inn until Vipps sends the user back (httpOnly, 10 minutes).
export const START = "tvistr_start";
export const START_MINUTTER = 10;

const MIN_SIDE = "/min-side";

// A path in this app, or Min side. Rejects other hosts ("//", "/\"), schemes and control characters
// (browsers drop tabs and newlines, so "/\t/evil.no" would become "//evil.no").
export function trygtMal(til: unknown): string {
  if (typeof til !== "string" || !til.startsWith("/") || til.length > 512 || /[\\\x00-\x1f\x7f]/.test(til)) return MIN_SIDE;
  return new URL(til, "http://tvistr.invalid").host === "tvistr.invalid" ? til : MIN_SIDE;
}

// The same rule as opprinnelse() in src/app/sak/[id]/actions.ts, for a route handler's request.
export function opprinnelse(request: Request): string {
  const h = request.headers;
  const vert = h.get("x-forwarded-host") ?? h.get("host");
  if (!vert) throw new Error("mangler host");
  return `${h.get("x-forwarded-proto") ?? (vert.startsWith("localhost") ? "http" : "https")}://${vert}`;
}
