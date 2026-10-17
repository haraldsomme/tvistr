// A per-address limit that lives in each server instance's memory, so it only stops simple abuse
// from one address; a rate-limit rule in the Vercel Firewall is the real protection once the site
// is public.
const GRENSER_PA = true;

export function lagGrense(grense: { antall: number; vinduMs: number }) {
  const treff = new Map<string, number[]>();
  return function forMange(ip: string): boolean {
    if (!GRENSER_PA) return false;
    const na = Date.now();
    if (treff.size > 10_000) treff.clear();
    const nylig = (treff.get(ip) ?? []).filter((t) => na - t < grense.vinduMs);
    nylig.push(na);
    treff.set(ip, nylig);
    return nylig.length > grense.antall;
  };
}

export const ipFra = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";

// Reads a small JSON body from an untrusted request. null when it is too large or not JSON.
export async function lesJson(request: Request, maksBytes = 100_000): Promise<unknown | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maksBytes) return null;
  const tekst = await request.text();
  if (tekst.length > maksBytes) return null;
  try {
    return JSON.parse(tekst) as unknown;
  } catch {
    return null;
  }
}
