export type Adresse = { linjer: string[]; postnummer: string; poststed: string };
export type Forhandler =
  | { type: "brreg"; orgnr: string; navn: string; adresse?: Adresse }
  | { type: "fritekst"; navn: string; adresse?: Adresse };

// Lookup of dealers in Brreg's open Enhetsregister, by name or organisation number. ENK (sole
// proprietorships) is left out on purpose: their names are usually personal names, which we do not
// want to show or store.
const BRREG = "https://data.brreg.no/enhetsregisteret/api/enheter";
const FORMER = "AS,ASA,ANS,DA,NUF";

export type Forslag = {
  orgnr: string;
  navn: string;
  kommune: string | null;
  bransje: string | null;
  status: "konkurs" | "avvikling" | null;
  adresse: Adresse | null; // where mail goes
  forretningsadresse: string | null; // one line, as the form stores it (docs/skjema.md)
};

type BrregAdresse = { adresse?: string[]; postnummer?: string; poststed?: string; kommune?: string };

type BrregEnhet = {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode: string };
  naeringskode1?: { beskrivelse: string };
  forretningsadresse?: BrregAdresse;
  postadresse?: BrregAdresse;
  konkurs?: boolean;
  underAvvikling?: boolean;
};

// Nine digits, written with or without spaces. null for anything else.
export function orgnrFra(s: string): string | null {
  const r = s.replace(/\s/g, "");
  return /^\d{9}$/.test(r) ? r : null;
}

// Mail goes to the postal address when the company has registered one, otherwise to the business address.
function adresseFra(e: BrregEnhet): Adresse | null {
  for (const a of [e.postadresse, e.forretningsadresse]) {
    const linjer = (a?.adresse ?? []).map((l) => l.trim()).filter(Boolean);
    if (a?.postnummer && a.poststed) return { linjer, postnummer: a.postnummer, poststed: tittel(a.poststed) };
  }
  return null;
}

function enLinje(a: BrregAdresse | undefined): string | null {
  const linjer = (a?.adresse ?? []).map((l) => l.trim()).filter(Boolean);
  return a?.postnummer && a.poststed ? [...linjer, `${a.postnummer} ${tittel(a.poststed)}`].join(", ") : null;
}

const tilForslag = (e: BrregEnhet): Forslag => ({
  orgnr: e.organisasjonsnummer,
  navn: e.navn,
  kommune: e.forretningsadresse?.kommune ?? null,
  bransje: e.naeringskode1?.beskrivelse ?? null,
  status: e.konkurs ? "konkurs" : e.underAvvikling ? "avvikling" : null,
  adresse: adresseFra(e),
  forretningsadresse: enLinje(e.forretningsadresse),
});

// A suggestion as the dealer of the letter.
export const tilForhandler = (f: Forslag): Forhandler => ({ type: "brreg", orgnr: f.orgnr, navn: tittel(f.navn), ...(f.adresse && { adresse: f.adresse }) });

const TIDSGRENSE = 4000;

// null: no such unit, or one we leave out. Throws when Brreg does not answer.
async function enhet(orgnr: string): Promise<Forslag | null> {
  const res = await fetch(`${BRREG}/${orgnr}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(TIDSGRENSE) });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Brreg ${res.status}`);
  const e = (await res.json()) as BrregEnhet;
  return FORMER.split(",").includes(e.organisasjonsform?.kode ?? "") ? tilForslag(e) : null;
}

export async function sokForhandler(q: string): Promise<{ forslag: Forslag[]; feil?: true }> {
  const s = q.trim().slice(0, 80);
  try {
    const orgnr = orgnrFra(s);
    if (orgnr) {
      const f = await enhet(orgnr);
      return { forslag: f ? [f] : [] };
    }
    if (s.length < 3) return { forslag: [] };
    const url = `${BRREG}?${new URLSearchParams({ navn: s, navnMetodeForSoek: "FORTLOEPENDE", organisasjonsform: FORMER, size: "8" })}`;
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(TIDSGRENSE) });
    if (!res.ok) return { forslag: [], feil: true };
    const json = (await res.json()) as { _embedded?: { enheter?: BrregEnhet[] } };
    return { forslag: (json._embedded?.enheter ?? []).map(tilForslag) };
  } catch {
    return { forslag: [], feil: true };
  }
}

// One dealer by organisation number, for opening a link that carries it. null when it cannot be had.
export async function hentForhandler(orgnr: string): Promise<Forslag | null> {
  const o = orgnrFra(orgnr);
  if (!o) return null;
  try {
    return await enhet(o);
  } catch {
    return null;
  }
}

// Brreg writes names in capitals; this gives «Testbil AS» for «TESTBIL AS».
export const tittel = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-.(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(As|Asa)\b/g, (m) => m.toUpperCase());
