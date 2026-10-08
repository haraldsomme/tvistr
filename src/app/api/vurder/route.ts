import { ipFra, lagGrense } from "@/lib/rategrense";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { hentStatistikk } from "@/lib/vurdering/statistikk";
import { vurder } from "@/lib/vurdering/vurder";

// The form sends a few hundred bytes.
const MAKS_BYTES = 100_000;

// Every assessment costs a database query.
const forMange = lagGrense({ antall: 10, vinduMs: 60_000 });

// Returns the level (`sak` or `utenfor`), the title and the justification; for a claim the law stops, the
// one point with the rule it rests on; otherwise the warnings (who has the burden of proof, and that the
// letter builds on the difference when the buyer knew of the defect), and how many dealer decisions the
// case was compared with and how many of those got medhold. The factors stay on the server.
export async function POST(request: Request) {
  if (forMange(ipFra(request))) {
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
      grunnlag: v.niva === "utenfor" ? v.grunnlag : [],
      varsler: v.varsler,
      utvalg: v.statistikk && { n: v.statistikk.n, vunnet: v.statistikk.vunnet },
    });
  } catch (e) {
    console.error("vurdering feilet", e);
    return Response.json({ feil: "Vi klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." }, { status: 500 });
  }
}
