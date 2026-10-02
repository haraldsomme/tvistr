import { ipFra, lagGrense } from "@/lib/rategrense";
import { sokForhandler } from "@/lib/brreg";

// Thin proxy to Brreg's open Enhetsregister for the dealer search, by name or organisation number.
// It is called on every pause in typing, so the limit is generous.
const forMange = lagGrense({ antall: 60, vinduMs: 60_000 });

export async function GET(request: Request) {
  if (forMange(ipFra(request))) return Response.json({ forslag: [], feil: true }, { status: 429 });
  return Response.json(await sokForhandler(new URL(request.url).searchParams.get("q") ?? ""));
}
