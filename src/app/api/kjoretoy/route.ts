import { forsegle } from "@/app/sak/signatur";
import { hentKjoretoy, type Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import { ipFra, lagGrense } from "@/lib/rategrense";

// Every lookup is a call to Statens vegvesen on our key.
const forMange = lagGrense({ antall: 10, vinduMs: 60_000 });

const FEIL = {
  ugyldig: { status: 400, feil: "Skriv registreringsnummeret slik det står på skiltet, for eksempel AB 12345." },
  ikke_funnet: { status: 404, feil: "Vi fant ingen kjøretøy med dette registreringsnummeret." },
  utilgjengelig: { status: 502, feil: "Vi fikk ikke kontakt med Statens vegvesen. Prøv igjen om litt." },
} as const;

// The vehicle as the letter may use it, sealed (signatur.ts): the server builds the letter from the
// seal, so the make, model and year cannot be changed in the browser.
const svar = (kjoretoy: Kjoretoy, eierFra: string | null) =>
  Response.json({ kjoretoy, eierFra, segl: forsegle({ regnr: kjoretoy.regnr, merke: kjoretoy.merke, modell: kjoretoy.modell, ar: kjoretoy.ar }) });

// Make, model and year for one registration number, and the day it was registered on its current
// owner (a suggestion for the purchase date). Nothing is stored.
export async function GET(request: Request) {
  if (forMange(ipFra(request))) {
    return Response.json({ feil: "Du har gjort mange oppslag på kort tid. Vent et minutt og prøv igjen." }, { status: 429 });
  }
  const oppslag = await hentKjoretoy(new URL(request.url).searchParams.get("regnr")?.slice(0, 20) ?? "");
  if (!oppslag.ok) return Response.json({ feil: FEIL[oppslag.feil].feil }, { status: FEIL[oppslag.feil].status });
  return svar(oppslag.kjoretoy, oppslag.eierFra);
}

// Development only: the tests (e2e/flyt.spec.ts) have no real registration numbers, so they post the
// vehicle they want and get it sealed. Never in production.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const { kjoretoy, eierFra } = (await request.json()) as { kjoretoy: Kjoretoy; eierFra?: string | null };
  return svar(kjoretoy, eierFra ?? null);
}
