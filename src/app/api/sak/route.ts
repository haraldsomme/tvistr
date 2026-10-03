import { opprettSak } from "@/lib/brev/sak";
import { lesKjoretoy } from "@/lib/brev/utfylling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { lesInnsending, tilKlageInput } from "@/lib/vurdering/innsending";

// Every call writes a row.
const forMange = lagGrense({ antall: 10, vinduMs: 60_000 });

// Opens the letter for a set of answers from the assessment form and returns the id of the case.
// The vehicle chosen in the assessment goes with it and is locked to the case from then on; the
// answers can be changed later with PUT /api/sak/[id]/svar.
export async function POST(request: Request) {
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har gjort dette mange ganger på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });

  const body = await lesJson(request);
  const parsed = tilKlageInput(body);
  if (!parsed.ok) return Response.json({ feil: parsed.feil }, { status: 400 });
  // A claim the law stops has no letter to open: the assessment says why.
  if (beregnFaktorer(parsed.input).stopp) return Response.json({ feil: "Brevet kan ikke åpnes for dette kjøpet." }, { status: 400 });
  const kjoretoy = lesKjoretoy((body as { kjoretoy?: unknown }).kjoretoy);
  if (!kjoretoy) return Response.json({ feil: "Hent bilen med registreringsnummeret først." }, { status: 400 });

  try {
    return Response.json({ id: await opprettSak(lesInnsending(body as Record<string, unknown>), kjoretoy) });
  } catch {
    // Nothing from the case goes in the log.
    console.error("opprettelse av sak feilet");
    return Response.json({ feil: "Vi klarte ikke å åpne brevet akkurat nå. Prøv igjen om litt." }, { status: 500 });
  }
}
