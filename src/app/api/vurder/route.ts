import { tilKlageInput } from "@/lib/vurdering/innsending";
import { hentStatistikk } from "@/lib/vurdering/statistikk";
import { tolkFritekst } from "@/lib/vurdering/tolkFritekst";
import { vurder } from "@/lib/vurdering/vurder";

// The form sends a few hundred bytes; the description is capped at 2 000 characters.
const MAKS_BYTES = 100_000;

// Every assessment costs a Claude call and a database query. This limit lives in each server
// instance's memory, so it only stops simple abuse from one address; a rate-limit rule in the
// Vercel Firewall is the real protection once the site is public.
const GRENSE = { antall: 10, vinduMs: 60_000 };
const treff = new Map<string, number[]>();

function forMange(ip: string): boolean {
  const na = Date.now();
  if (treff.size > 10_000) treff.clear();
  const nylig = (treff.get(ip) ?? []).filter((t) => na - t < GRENSE.vinduMs);
  nylig.push(na);
  treff.set(ip, nylig);
  return nylig.length > GRENSE.antall;
}

// Returns only the level, the justification, suggested actions and the claims to choose between; the factors and statistics stay on the server.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip)) {
    return Response.json({ feil: "Du har sendt mange vurderinger på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAKS_BYTES) {
    return Response.json({ feil: "Forespørselen er for stor." }, { status: 413 });
  }
  const tekst = await request.text();
  if (tekst.length > MAKS_BYTES) return Response.json({ feil: "Forespørselen er for stor." }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(tekst);
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel." }, { status: 400 });
  }
  const parsed = tilKlageInput(body);
  if (!parsed.ok) return Response.json({ feil: parsed.feil }, { status: 400 });

  try {
    const v = await vurder(parsed.input, {
      // If the reading of the free text fails we still assess on the button choices.
      tolk: async (input) => {
        try {
          return await tolkFritekst(input);
        } catch (e) {
          console.error("tolkFritekst feilet", e);
          return null;
        }
      },
      hentStatistikk,
    });
    return Response.json({ niva: v.niva, begrunnelse: v.begrunnelse, tiltak: v.tiltak, krav: v.krav });
  } catch (e) {
    console.error("vurdering feilet", e);
    return Response.json({ feil: "Vi klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." }, { status: 500 });
  }
}
