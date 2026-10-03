import { lignendeFor } from "@/lib/brev/dokument";
import { endreSak, hentSak, slettSak } from "@/lib/brev/sak";
import { erSakId, lesEndring } from "@/lib/brev/utfylling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";
import { iDag } from "@/lib/vurdering/faktorer";

// A save per step the user completes, plus corrections.
const forMange = lagGrense({ antall: 60, vinduMs: 60_000 });

const FINNES_IKKE = { feil: "Vi finner ikke denne saken. Den kan være slettet." };

// Saves what the user filled in for one or more fields and returns the whole fill-in.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!erSakId(id)) return Response.json(FINNES_IKKE, { status: 404 });
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har lagret mange ganger på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });

  const body = await lesJson(request);
  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json(FINNES_IKKE, { status: 404 });
    // A save is checked against the answers of the case: dates must fit the purchase.
    const lest = lesEndring(body, { svar: sak.svar, idag: iDag() });
    if (!lest.ok) return Response.json({ feil: lest.feil }, { status: 400 });
    const utfylling = await endreSak(id, lest.endring, sak);
    return Response.json({ utfylling, lignende: await lignendeFor({ utfylling }) });
  } catch {
    console.error("lagring av sak feilet");
    return Response.json({ feil: "Vi fikk ikke lagret. Prøv igjen om litt." }, { status: 500 });
  }
}

// Deletes the case and everything in it. Deleting a case that is already gone is not an error.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (forMange(ipFra(request))) return Response.json({ feil: "Vent et minutt og prøv igjen." }, { status: 429 });
  try {
    await slettSak(id);
    return new Response(null, { status: 204 });
  } catch {
    console.error("sletting av sak feilet");
    return Response.json({ feil: "Vi fikk ikke slettet saken. Prøv igjen om litt." }, { status: 500 });
  }
}
