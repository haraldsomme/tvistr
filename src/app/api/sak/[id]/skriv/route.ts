import { hentSak, lagreBrev, tellSprakvask } from "@/lib/brev/sak";
import { skrivBrevFor } from "@/lib/brev/skriving/kjede";
import { lagSaksmodell } from "@/lib/brev/skriving/saksmodell";
import { MAKS_SPRAKVASK } from "@/lib/brev/utfylling";
import { iDag } from "@/lib/vurdering/faktorer";
import { ipFra, lagGrense } from "@/lib/rategrense";

// Writing the letter takes one to two minutes: plan, author, check, review (src/lib/brev/skriving/).
export const maxDuration = 300;

// Every call writes a letter on our key.
const forMange = lagGrense({ antall: 3, vinduMs: 60_000 });
// The most calls one writing makes (`skrivBrevFor`).
const KALL_PER_BREV = 5;

// Writes the letter for a case and stores it with the case. The answer is a stream of lines of JSON:
// `{ fremdrift }` while it works, then `{ ferdig: true, utfylling }` or `{ feil }`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (forMange(ipFra(request))) return Response.json({ feil: "Du har bedt om mange brev på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });
  const sak = await hentSak(id);
  if (!sak) return Response.json({ feil: "Vi finner ikke denne saken. Den kan være slettet." }, { status: 404 });
  if ((sak.utfylling.sprakvask ?? 0) + KALL_PER_BREV > MAKS_SPRAKVASK) return Response.json({ feil: "Vi har skrevet brevet så mange ganger vi kan for denne saken." }, { status: 429 });
  const lest = lagSaksmodell({ svar: sak.svar, utfylling: sak.utfylling }, iDag());
  if (!lest.ok) return Response.json({ feil: lest.feil }, { status: 400 });

  const koder = new TextEncoder();
  const strom = new ReadableStream({
    async start(kontroll) {
      const send = (linje: unknown) => kontroll.enqueue(koder.encode(`${JSON.stringify(linje)}\n`));
      try {
        const s = await skrivBrevFor(lest.modell, (fremdrift) => send({ fremdrift }));
        await tellSprakvask(sak, s.kall);
        const utfylling = await lagreBrev(sak, { utkast: s.utkast, avvik: s.avvik, funn: s.funn, grunnlag: s.grunnlag, versjon: s.versjon, skrevet: s.skrevet });
        send({ ferdig: true, utfylling });
      } catch {
        // Nothing from the case goes in the log.
        console.error("skriving feilet");
        send({ feil: "Vi fikk ikke skrevet brevet akkurat nå. Prøv igjen om litt." });
      }
      kontroll.close();
    },
  });
  return new Response(strom, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
