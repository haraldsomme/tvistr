import { hentSak } from "@/lib/brev/sak";
import { erSakId } from "@/lib/brev/utfylling";
import { byggMappe } from "@/lib/mappe/bygg";
import { lagMappeData } from "@/lib/mappe/hent";
import { ipFra, lagGrense } from "@/lib/rategrense";
import { beregnFaktorer, iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";

const forMange = lagGrense({ antall: 60, vinduMs: 60_000 });
const FINNES_IKKE = { feil: "Vi finner ikke denne saken. Den kan være slettet." };

// The saksmappe of a case: numbers from earlier decisions, computed now. Nothing is stored or logged.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!erSakId(id)) return Response.json(FINNES_IKKE, { status: 404 });
  if (forMange(ipFra(request))) return Response.json({ feil: "Vent et minutt og prøv igjen." }, { status: 429 });
  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json(FINNES_IKKE, { status: 404 });
    const idag = iDag();
    const lest = tilKlageInput(sak.svar, idag);
    if (!lest.ok) return Response.json({ feil: "Svarene i saken gir ikke en sak. Rett svarene først." }, { status: 409 });
    const mappe = await byggMappe(sak, lagMappeData(beregnFaktorer(lest.input, idag)), idag);
    return Response.json(mappe, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("bygging av saksmappe feilet");
    return Response.json({ feil: "Vi fikk ikke laget saksmappen. Prøv igjen om litt." }, { status: 500 });
  }
}
