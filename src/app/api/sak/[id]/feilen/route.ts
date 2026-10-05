import { FEILTYPE_TEKST } from "@/app/vurdering/tekster";
import { skrivBeskrivelse, stillSporsmal } from "@/lib/brev/feilbeskrivelse";
import { hentSak, tellSprakvask } from "@/lib/brev/sak";
import { MAKS_SPRAKVASK, lesBeskrivelse, lesFakta } from "@/lib/brev/utfylling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";

// Every call is a call to the language model on our key.
const forMange = lagGrense({ antall: 5, vinduMs: 60_000 });

const EGEN_TEKST = "Du kan bruke din egen tekst i brevet.";

// The interview about the defect: the follow-up questions (`sporsmal`) or a draft (`utkast`). Nothing
// is saved but the count of calls; the buyer approves the draft on the page, which saves it with PATCH.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har bedt om mange forslag på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });

  const body = (await lesJson(request, 20_000)) as { trinn?: unknown; beskrivelse?: unknown; fakta?: unknown } | null;
  const beskrivelse = lesBeskrivelse(body?.beskrivelse);
  if (!beskrivelse) return Response.json({ feil: "Beskrivelsen er for kort eller for lang til at vi kan lage et forslag." }, { status: 400 });
  const trinn = body?.trinn;
  const fakta = trinn === "utkast" ? lesFakta(body?.fakta ?? []) : [];
  if ((trinn !== "sporsmal" && trinn !== "utkast") || !fakta) return Response.json({ feil: "Ugyldig forespørsel." }, { status: 400 });

  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json({ feil: "Vi finner ikke denne saken. Den kan være slettet." }, { status: 404 });
    if ((sak.utfylling.sprakvask ?? 0) >= MAKS_SPRAKVASK) {
      return Response.json({ feil: `Du har fått alle forslagene vi kan lage for denne saken. ${EGEN_TEKST}` }, { status: 429 });
    }
    await tellSprakvask(sak);
    const feiltyper = [...new Set(sak.svar.feiltyper)].map((t) => FEILTYPE_TEKST[t]);

    if (trinn === "sporsmal") {
      const svar = await stillSporsmal(beskrivelse, feiltyper);
      if (svar.ok) return Response.json({ grupper: svar.grupper });
      return Response.json({ feil: `Vi klarte ikke å lage spørsmål for denne teksten. ${EGEN_TEKST}` }, { status: svar.grunn === "avvist" ? 422 : 502 });
    }
    const svar = await skrivBeskrivelse(beskrivelse, fakta, feiltyper);
    if (svar.ok) return Response.json({ titler: svar.titler, avsnitt: svar.avsnitt, utelatt: svar.utelatt });
    return Response.json({ feil: `Vi klarte ikke å lage et forslag for denne teksten. ${EGEN_TEKST}` }, { status: svar.grunn === "avvist" ? 422 : 502 });
  } catch {
    // Nothing from the case or the description goes in the log.
    console.error("feilbeskrivelse feilet");
    return Response.json({ feil: `Vi klarte ikke å lage et forslag akkurat nå. ${EGEN_TEKST}` }, { status: 500 });
  }
}
