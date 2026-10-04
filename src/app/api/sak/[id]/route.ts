import { endreSak, hentSak, slettSak } from "@/lib/brev/sak";
import { avledSvar, kontrollerRettelse, rettSvar } from "@/lib/brev/svar";
import { erSakId, lesEndring, medEndring, tilpassTilSvar } from "@/lib/brev/utfylling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";
import { iDag } from "@/lib/vurdering/faktorer";

// A save per step the user completes, plus corrections.
const forMange = lagGrense({ antall: 60, vinduMs: 60_000 });

const FINNES_IKKE = { feil: "Vi finner ikke denne saken. Den kan være slettet." };
const UGYLDIG = { feil: "Ugyldig forespørsel." };

// Saves what the user filled in for one step and returns the whole fill-in. A step that corrects an
// answer from the assessment sends the whole set of answers as `svar`, of which only the answers a step
// corrects are taken (`rettSvar`); a date the new answer makes impossible is then dropped from the
// fill-in (`tilpassTilSvar`), and the derived answers (how long after the purchase the defect showed,
// and so on) are brought back in step with it (`avledSvar`). The result is checked like the assessment
// checks it (`kontrollerRettelse`): a save that leaves answers the assessment would not have given a
// letter for is not written.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!erSakId(id)) return Response.json(FINNES_IKKE, { status: 404 });
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har lagret mange ganger på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });

  const body = await lesJson(request);
  if (typeof body !== "object" || body === null || Array.isArray(body)) return Response.json(UGYLDIG, { status: 400 });

  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json(FINNES_IKKE, { status: 404 });

    const { svar: svarRaw, ...endringRaw } = body as Record<string, unknown>;
    const idag = iDag();
    let svar = sak.svar;
    let utfylling = sak.utfylling;
    if (svarRaw !== undefined) {
      const rettet = rettSvar(sak.svar, svarRaw, idag);
      if (!rettet) return Response.json(UGYLDIG, { status: 400 });
      svar = rettet;
      utfylling = tilpassTilSvar(utfylling, svar, idag);
    }

    const lestEndring = lesEndring(endringRaw, { svar, idag });
    if (!lestEndring.ok) return Response.json({ feil: lestEndring.feil }, { status: 400 });

    // Dates the new purchase date dropped are cleared together with the step's own save, so one
    // write leaves the fill-in and the derived answers in step with each other.
    const fjernet: Record<string, null> = {};
    for (const felt of ["feilen", "reklamasjon", "sendt"] as const) {
      if (sak.utfylling[felt] !== undefined && utfylling[felt] === undefined) fjernet[felt] = null;
    }
    const samletEndring = { ...fjernet, ...lestEndring.endring };
    const forhandsvisning = medEndring(utfylling, lestEndring.endring);
    const avledet = avledSvar(svar, forhandsvisning, idag);
    const avvist = kontrollerRettelse(sak.svar, avledet, idag);
    if (avvist) return Response.json({ feil: avvist }, { status: 400 });

    const endeligUtfylling = await endreSak(id, avledet, samletEndring, sak);
    return Response.json({ svar: avledet, utfylling: endeligUtfylling });
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
