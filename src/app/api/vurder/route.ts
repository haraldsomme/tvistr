import { ipFra, lagGrense } from "@/lib/rategrense";
import { synligGrunnlag } from "@/lib/vurdering/grunnlag";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { hentStatistikk } from "@/lib/vurdering/statistikk";
import { vurder } from "@/lib/vurdering/vurder";

// The form sends a few hundred bytes.
const MAKS_BYTES = 100_000;

// Every assessment costs a database query.
const forMange = lagGrense({ antall: 10, vinduMs: 60_000 });

// Returns the level, the title, the justification, the points shown under it (what strengthens the case,
// and what weakens it; for a claim the law stops, the one reason), how many decisions the case
// was compared with and how many of those got medhold, and one similar decision when there is one. The
// suggested actions go out as titles only (the explanation is part of the paid step), except for a weak
// case, where the advice matters more than the sale. The score and the factors stay on the server.
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
      ...(v.niva === "utenfor" ? { styrker: [], svakheter: v.grunnlag } : synligGrunnlag(v.niva, v.grunnlag, v.faktorer)),
      eksempel: v.eksempel && {
        setning: v.eksempel.setning,
        saksnummer: v.eksempel.saksnummer,
        kildeUrl: v.eksempel.kildeUrl,
        utfall: v.eksempel.utfall,
        treff: v.eksempel.treff,
      },
      tiltak: v.tiltak.map((t) => (v.niva === "svak" ? t : { tittel: t.tittel })),
      utvalg: v.statistikk && { n: v.statistikk.n, vunnet: v.statistikk.vunnet, spesifikk: v.statistikk.spesifikk },
    });
  } catch (e) {
    console.error("vurdering feilet", e);
    return Response.json({ feil: "Vi klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." }, { status: 500 });
  }
}
