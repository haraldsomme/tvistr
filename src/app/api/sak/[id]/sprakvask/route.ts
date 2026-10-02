import { hentSak, tellSprakvask } from "@/lib/brev/sak";
import { sprakvask } from "@/lib/brev/sprakvask";
import { MAKS_SPRAKVASK, lesBeskrivelse } from "@/lib/brev/utfylling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";

// Every call is a call to the language model on our key.
const forMange = lagGrense({ antall: 5, vinduMs: 60_000 });

const EGEN_TEKST = "Du kan bruke din egen tekst i brevet.";

// Suggests how the buyer's description of the defect can be worded in the letter. Nothing is saved
// but the count of suggestions; the buyer chooses what goes in the letter.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har bedt om mange forslag på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });

  const body = await lesJson(request, 10_000);
  const beskrivelse = lesBeskrivelse((body as { beskrivelse?: unknown } | null)?.beskrivelse);
  if (!beskrivelse) return Response.json({ feil: "Beskrivelsen er for kort eller for lang til at vi kan lage et forslag." }, { status: 400 });

  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json({ feil: "Vi finner ikke denne saken. Den kan være slettet." }, { status: 404 });
    if ((sak.utfylling.sprakvask ?? 0) >= MAKS_SPRAKVASK) {
      return Response.json({ feil: `Du har fått alle forslagene vi kan lage for denne saken. ${EGEN_TEKST}` }, { status: 429 });
    }
    await tellSprakvask(sak);
    const forslag = await sprakvask(beskrivelse, sak.svar.feiltyper);
    if (forslag.ok) return Response.json({ forslag: forslag.tekst });
    return Response.json({ feil: `Vi klarte ikke å lage et forslag for denne teksten. ${EGEN_TEKST}` }, { status: forslag.grunn === "avvist" ? 422 : 502 });
  } catch {
    // Nothing from the case or the description goes in the log.
    console.error("språkvask feilet");
    return Response.json({ feil: `Vi klarte ikke å lage et forslag akkurat nå. ${EGEN_TEKST}` }, { status: 500 });
  }
}
