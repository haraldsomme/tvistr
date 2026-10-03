import { brevForSak, purringForSak } from "@/lib/brev/dokument";
import { tilDocx, tilPdf } from "@/lib/brev/eksport";
import { hentSak } from "@/lib/brev/sak";
import { erSakId } from "@/lib/brev/utfylling";
import { ipFra, lagGrense } from "@/lib/rategrense";

const forMange = lagGrense({ antall: 30, vinduMs: 60_000 });

const FILER = {
  "brev.pdf": { type: "application/pdf", navn: "reklamasjonsbrev.pdf" },
  "brev.docx": { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", navn: "reklamasjonsbrev.docx" },
  "purring.pdf": { type: "application/pdf", navn: "purring.pdf" },
  "purring.docx": { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", navn: "purring.docx" },
} as const;

const FINNES_IKKE = { feil: "Vi finner ikke denne saken. Den kan være slettet." };

// The letter as a file. Only the id of the case is needed; nothing from the case is logged.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; fil: string }> }) {
  const { id, fil } = await params;
  if (!erSakId(id) || !Object.hasOwn(FILER, fil)) return Response.json(FINNES_IKKE, { status: 404 });
  if (forMange(ipFra(request))) return Response.json({ feil: "Vent et minutt og prøv igjen." }, { status: 429 });
  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json(FINNES_IKKE, { status: 404 });
    const brev = await (fil.startsWith("purring") ? purringForSak(sak) : brevForSak(sak));
    if (!brev) return Response.json({ feil: "Svarene i saken gir ikke et brev. Rett svarene først." }, { status: 409 });
    const f = FILER[fil as keyof typeof FILER];
    const bytes = fil.endsWith(".pdf") ? await tilPdf(brev) : await tilDocx(brev);
    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": f.type, "Content-Disposition": `attachment; filename="${f.navn}"`, "Cache-Control": "no-store" },
    });
  } catch {
    console.error("eksport av brev feilet");
    return Response.json({ feil: "Vi fikk ikke laget filen. Prøv igjen om litt." }, { status: 500 });
  }
}
