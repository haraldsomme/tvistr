import { AvvistAvModellError } from "@/lib/ai/klient";
import { hentSak, tellSprakvask } from "@/lib/brev/sak";
import { avklar } from "@/lib/brev/skriving/avklaring";
import { lagSaksmodell } from "@/lib/brev/skriving/saksmodell";
import { MAKS_SPRAKVASK } from "@/lib/brev/utfylling";
import { iDag } from "@/lib/vurdering/faktorer";
import { ipFra, lagGrense } from "@/lib/rategrense";

// Every call is a call to the language model on our key.
const forMange = lagGrense({ antall: 5, vinduMs: 60_000 });

const VIDERE = "Du kan gå videre til brevet og komme tilbake senere.";

// One round of the clarifying round (spec: Avklaringsrunde). The case is read from the database; the
// page saves the answers and the corrections the buyer accepts with PATCH, then asks for the next round.
// Nothing is saved here but the count of calls.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har bedt om mange runder på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });
  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json({ feil: "Vi finner ikke denne saken. Den kan være slettet." }, { status: 404 });
    if ((sak.utfylling.sprakvask ?? 0) >= MAKS_SPRAKVASK) return Response.json({ feil: `Vi har gått gjennom saken så mange ganger vi kan. ${VIDERE}` }, { status: 429 });
    const lest = lagSaksmodell({ svar: sak.svar, utfylling: sak.utfylling }, iDag());
    if (!lest.ok) return Response.json({ feil: lest.feil }, { status: 400 });
    await tellSprakvask(sak);
    const { status, runde, sporsmal, rettelser } = await avklar(lest.modell, sak);
    return Response.json({ status, runde, sporsmal, rettelser });
  } catch (e) {
    // Nothing from the case goes in the log.
    console.error("avklaring feilet");
    return Response.json({ feil: `Vi får ikke gått gjennom saken akkurat nå. ${VIDERE}` }, { status: e instanceof AvvistAvModellError ? 422 : 502 });
  }
}
