import { opprettSak, settSvar } from "@/lib/brev/sak";
import { erSakId } from "@/lib/brev/utfylling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { lesInnsending, tilKlageInput } from "@/lib/vurdering/innsending";

// Every call writes a row.
const forMange = lagGrense({ antall: 10, vinduMs: 60_000 });

// Opens the letter for a set of answers from the assessment form and returns the id of the case.
// With `sak` (the id of a case the user came back from) the answers replace that case's answers, so
// what was filled in on the letter page is kept.
export async function POST(request: Request) {
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har gjort dette mange ganger på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });

  const body = await lesJson(request);
  const parsed = tilKlageInput(body);
  if (!parsed.ok) return Response.json({ feil: parsed.feil }, { status: 400 });
  if (beregnFaktorer(parsed.input).fristUte) return Response.json({ feil: "Fristen for å klage er ute, så vi kan ikke lage et brev for denne saken." }, { status: 400 });

  const svar = lesInnsending(body as Record<string, unknown>);
  const eksisterende = (body as { sak?: unknown }).sak;
  try {
    if (typeof eksisterende === "string" && erSakId(eksisterende) && (await settSvar(eksisterende, svar))) return Response.json({ id: eksisterende });
    return Response.json({ id: await opprettSak(svar) });
  } catch {
    // Nothing from the case goes in the log.
    console.error("opprettelse av sak feilet");
    return Response.json({ feil: "Vi klarte ikke å åpne brevet akkurat nå. Prøv igjen om litt." }, { status: 500 });
  }
}
