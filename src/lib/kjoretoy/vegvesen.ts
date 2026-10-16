// Lookup of one vehicle by registration number in Statens vegvesen's «enkeltoppslag» API
// (https://autosys-kjoretoy-api.atlas.vegvesen.no). The key (VEGVESEN_API_KEY) stays on the server.
// The registration number is the user's own and is only passed on, never stored.

function erDato(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const URL_OPPSLAG = "https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata";

export type Kjoretoy = {
  // As the registry writes it, with the space: «AB 12345».
  regnr: string;
  merke: string;
  modell: string;
  // The year the vehicle was first registered, anywhere. The registry has no model-year field; this
  // is the closest, and can be a year off the model year.
  ar: number | null;
  // Registered abroad before it was registered in Norway. Left out when the registry does not tell.
  bruktimportert?: boolean;
};

// `eierFra` is the day the vehicle was registered on its current owner, which is usually the buyer
// and close to the day of the purchase. It is not stored: it only suggests a purchase date.
export type Oppslag = { ok: true; kjoretoy: Kjoretoy; eierFra: string | null } | { ok: false; feil: "ugyldig" | "ikke_funnet" | "utilgjengelig" };

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
    registrering?: { registrertForstegangPaEierskap?: unknown };
    forstegangsregistrering?: { registrertForstegangNorgeDato?: string };
    godkjenning?: {
      forstegangsGodkjenning?: { forstegangRegistrertDato?: string };
      tekniskGodkjenning?: { tekniskeData?: { generelt?: { merke?: { merke?: string }[]; handelsbetegnelse?: string[] } } };
    };
  }[];
};

// Reads the registry's answer. null when it holds no vehicle with a make. The model is "" when the
// registry has none (some vehicles have no trade name); the letter then names the make alone.
export function lesKjoretoy(json: unknown): Kjoretoy | null {
  const k = (json as Svar | null)?.kjoretoydataListe?.[0];
  const generelt = k?.godkjenning?.tekniskGodkjenning?.tekniskeData?.generelt;
  const merke = generelt?.merke?.[0]?.merke?.trim();
  const modell = generelt?.handelsbetegnelse?.[0]?.trim() ?? "";
  const regnr = k?.kjoretoyId?.kjennemerke?.trim();
  if (!merke || !regnr) return null;
  const dato = k?.godkjenning?.forstegangsGodkjenning?.forstegangRegistrertDato ?? k?.forstegangsregistrering?.registrertForstegangNorgeDato;
  const ar = Number(dato?.slice(0, 4));
  // ponytail: three months between the two dates counts as imported used; a new car is registered here
  // within days. Check against the registry's import field if it ever turns up in the API.
  const forst = k?.godkjenning?.forstegangsGodkjenning?.forstegangRegistrertDato;
  const norge = k?.forstegangsregistrering?.registrertForstegangNorgeDato;
  const dager = forst && norge ? (Date.parse(norge) - Date.parse(forst)) / 86_400_000 : NaN;
  return { regnr, merke: penMerke(merke), modell, ar: ar > 1900 ? ar : null, ...(!Number.isNaN(dager) && { bruktimportert: dager > 90 }) };
}

// The registry writes the day with a time and an offset («2024-06-04T10:23:02.673+02:00»). The day
// is kept as written, which is Norwegian time. null when there is none.
export function lesEierFra(json: unknown): string | null {
  const tid = (json as Svar | null)?.kjoretoydataListe?.[0]?.registrering?.registrertForstegangPaEierskap;
  const dag = typeof tid === "string" ? tid.slice(0, 10) : "";
  return erDato(dag) ? dag : null;
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
    const json: unknown = await res.json();
    const kjoretoy = lesKjoretoy(json);
    return kjoretoy ? { ok: true, kjoretoy, eierFra: lesEierFra(json) } : { ok: false, feil: "ikke_funnet" };
  } catch (e) {
    console.error("kjøretøyoppslag feilet", e);
    return { ok: false, feil: "utilgjengelig" };
  }
}
