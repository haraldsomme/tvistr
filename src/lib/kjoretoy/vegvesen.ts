// Lookup of one vehicle by registration number in Statens vegvesen's «enkeltoppslag» API
// (https://autosys-kjoretoy-api.atlas.vegvesen.no). The key (VEGVESEN_API_KEY) stays on the server.
// The registration number is the user's own and is only passed on, never stored.

const URL_OPPSLAG = "https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata";

export type Kjoretoy = {
  // As the registry writes it, with the space: «AB 12345».
  regnr: string;
  merke: string;
  modell: string;
  // The year the vehicle was first registered, anywhere. The registry has no model-year field; this
  // is the closest, and can be a year off the model year.
  ar: number | null;
};

export type Oppslag = { ok: true; kjoretoy: Kjoretoy } | { ok: false; feil: "ugyldig" | "ikke_funnet" | "utilgjengelig" };

// Ordinary plates are two letters and four or five digits; personal plates are two to seven
// letters and digits. Spaces and hyphens are how people write them, not part of the number.
export function normaliserRegnr(s: string): string | null {
  const r = s.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-ZÆØÅ0-9]{2,7}$/.test(r) ? r : null;
}

// The registry writes makes in capitals («VOLKSWAGEN»). Short ones are abbreviations and stay.
function penMerke(merke: string): string {
  if (merke !== merke.toUpperCase() || merke.length <= 3) return merke;
  return merke.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, skille: string, bokstav: string) => skille + bokstav.toUpperCase());
}

type Svar = {
  kjoretoydataListe?: {
    kjoretoyId?: { kjennemerke?: string };
    forstegangsregistrering?: { registrertForstegangNorgeDato?: string };
    godkjenning?: {
      forstegangsGodkjenning?: { forstegangRegistrertDato?: string };
      tekniskGodkjenning?: { tekniskeData?: { generelt?: { merke?: { merke?: string }[]; handelsbetegnelse?: string[] } } };
    };
  }[];
};

// Reads the registry's answer. null when it holds no vehicle with a make and a model.
export function lesKjoretoy(json: unknown): Kjoretoy | null {
  const k = (json as Svar | null)?.kjoretoydataListe?.[0];
  const generelt = k?.godkjenning?.tekniskGodkjenning?.tekniskeData?.generelt;
  const merke = generelt?.merke?.[0]?.merke?.trim();
  const modell = generelt?.handelsbetegnelse?.[0]?.trim();
  const regnr = k?.kjoretoyId?.kjennemerke?.trim();
  if (!merke || !modell || !regnr) return null;
  const dato = k?.godkjenning?.forstegangsGodkjenning?.forstegangRegistrertDato ?? k?.forstegangsregistrering?.registrertForstegangNorgeDato;
  const ar = Number(dato?.slice(0, 4));
  return { regnr, merke: penMerke(merke), modell, ar: ar > 1900 ? ar : null };
}

export async function hentKjoretoy(regnr: string): Promise<Oppslag> {
  const r = normaliserRegnr(regnr);
  if (!r) return { ok: false, feil: "ugyldig" };
  const nokkel = process.env.VEGVESEN_API_KEY;
  if (!nokkel) {
    console.error("VEGVESEN_API_KEY mangler");
    return { ok: false, feil: "utilgjengelig" };
  }
  try {
    const res = await fetch(`${URL_OPPSLAG}?${new URLSearchParams({ kjennemerke: r })}`, {
      headers: { "SVV-Authorization": `Apikey ${nokkel}`, Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });
    // 204: no vehicle with this number. 400: the registry does not accept the format.
    if (res.status === 204 || res.status === 400) return { ok: false, feil: "ikke_funnet" };
    if (!res.ok) {
      console.error("kjøretøyoppslag feilet", res.status);
      return { ok: false, feil: "utilgjengelig" };
    }
    const kjoretoy = lesKjoretoy(await res.json());
    return kjoretoy ? { ok: true, kjoretoy } : { ok: false, feil: "ikke_funnet" };
  } catch (e) {
    console.error("kjøretøyoppslag feilet", e);
    return { ok: false, feil: "utilgjengelig" };
  }
}
