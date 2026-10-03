import { lignendeFor } from "@/lib/brev/dokument";
import { hentSak, settSvar } from "@/lib/brev/sak";
import { lesSvar } from "@/lib/brev/svar";
import { erSakId } from "@/lib/brev/utfylling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";

// A correction is one save of the whole set of answers.
const forMange = lagGrense({ antall: 30, vinduMs: 60_000 });

const FINNES_IKKE = { feil: "Vi finner ikke denne saken. Den kan være slettet." };

// Replaces the answers from the assessment for a case the buyer has opened, and returns them with the
// fill-in that results (dates the new answers make impossible are dropped). A deadline that has passed
// does not reject the change: the letter is bought, so it stays, and `stopp` says so.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!erSakId(id)) return Response.json(FINNES_IKKE, { status: 404 });
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har lagret mange ganger på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });

  const body = await lesJson(request);
  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json(FINNES_IKKE, { status: 404 });
    const lest = lesSvar(body);
    if (!lest.ok) return Response.json({ feil: lest.feil }, { status: 400 });
    const utfylling = await settSvar(sak, lest.svar);
    return Response.json({ svar: lest.svar, utfylling, lignende: await lignendeFor({ utfylling }), stopp: lest.stopp });
  } catch {
    console.error("lagring av svar feilet");
    return Response.json({ feil: "Vi fikk ikke lagret. Prøv igjen om litt." }, { status: 500 });
  }
}
