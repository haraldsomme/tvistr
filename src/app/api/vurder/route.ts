import { tilKlageInput } from "@/lib/vurdering/innsending";
import { hentStatistikk } from "@/lib/vurdering/statistikk";
import { vurder } from "@/lib/vurdering/vurder";

// The form sends a few hundred bytes.
const MAKS_BYTES = 100_000;

// Every assessment costs a database query. This limit lives in each server
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

// Returns the level, the title, the justification with its legal basis, how many decisions the case
// was compared with, and one similar decision when there is one. The suggested actions go out as titles only (the explanation is part of
// the paid step), except for a weak case, where the advice matters more than the sale. The score,
// the factors and the share of won cases stay on the server.
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
    const v = await vurder(parsed.input, { hentStatistikk });
    return Response.json({
      niva: v.niva,
      tittel: v.tittel,
      begrunnelse: v.begrunnelse,
      grunnlag: v.grunnlag,
      eksempel: v.eksempel && { setning: v.eksempel.setning, saksnummer: v.eksempel.saksnummer, kildeUrl: v.eksempel.kildeUrl },
      tiltak: v.tiltak.map((t) => (v.niva === "svak" ? t : { tittel: t.tittel })),
      utvalg: v.statistikk && { n: v.statistikk.n, spesifikk: v.statistikk.spesifikk },
    });
  } catch (e) {
    console.error("vurdering feilet", e);
    return Response.json({ feil: "Vi klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." }, { status: 500 });
  }
}
