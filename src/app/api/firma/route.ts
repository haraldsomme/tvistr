// Thin proxy to Brreg's open Enhetsregister for the seller autocomplete. ENK is left out on purpose:
// their names are usually personal names, which we do not want to show or store.
const BRREG = "https://data.brreg.no/enhetsregisteret/api/enheter";

type BrregEnhet = {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode: string };
  naeringskode1?: { beskrivelse: string };
  forretningsadresse?: { kommune?: string };
  konkurs?: boolean;
  underAvvikling?: boolean;
};

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 3) return Response.json({ forslag: [] });

  const url = `${BRREG}?${new URLSearchParams({
    navn: q,
    navnMetodeForSoek: "FORTLOEPENDE",
    organisasjonsform: "AS,ASA,ANS,DA,NUF",
    size: "8",
  })}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return Response.json({ forslag: [], feil: true });
    const json = (await res.json()) as { _embedded?: { enheter?: BrregEnhet[] } };
    const forslag = (json._embedded?.enheter ?? []).map((e) => ({
      orgnr: e.organisasjonsnummer,
      navn: e.navn,
      kommune: e.forretningsadresse?.kommune ?? null,
      bransje: e.naeringskode1?.beskrivelse ?? null,
      status: e.konkurs ? "konkurs" : e.underAvvikling ? "avvikling" : null,
    }));
    return Response.json({ forslag });
  } catch {
    return Response.json({ forslag: [], feil: true });
  }
}
