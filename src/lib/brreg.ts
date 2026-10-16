export type Adresse = { linjer: string[]; postnummer: string; poststed: string };

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
  // The industry code, e.g. «47.810» (SN2025) or «45.111» (SN2007) for the sale of cars: the first of
  // the company's up to three codes that is the sale of vehicles, otherwise its main code.
  naeringskode: string | null;
  status: "konkurs" | "avvikling" | null;
  adresse: Adresse | null; // where mail goes
  forretningsadresse: string | null; // one line
};

type BrregAdresse = { adresse?: string[]; postnummer?: string; poststed?: string; kommune?: string };

export type BrregEnhet = {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode: string };
  naeringskode1?: { kode?: string; beskrivelse: string };
  naeringskode2?: { kode?: string; beskrivelse: string };
  naeringskode3?: { kode?: string; beskrivelse: string };
  forretningsadresse?: BrregAdresse;
  postadresse?: BrregAdresse;
  konkurs?: boolean;
  underAvvikling?: boolean;
};

// The sale of vehicles: SN2007 (45.1 cars, 45.4 motorcycles) and SN2025, which Brreg uses from 2025
// (47.81 retail and 46.71 wholesale of motor vehicles, 47.83 motorcycles). Large dealers often have
// repair (95.31) as their main code and the sale as their second.
const BILHANDEL = ["45.1", "45.4", "47.81", "46.71", "47.83"];
export const erBilhandel = (kode: string) => BILHANDEL.some((k) => kode.startsWith(k));

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

export const tilForslag = (e: BrregEnhet): Forslag => {
  const kode = [e.naeringskode1, e.naeringskode2, e.naeringskode3].find((k) => k?.kode && erBilhandel(k.kode)) ?? e.naeringskode1;
  return {
    orgnr: e.organisasjonsnummer,
    navn: e.navn,
    kommune: e.forretningsadresse?.kommune ?? null,
    bransje: kode?.beskrivelse ?? null,
    naeringskode: kode?.kode ?? null,
    status: e.konkurs ? "konkurs" : e.underAvvikling ? "avvikling" : null,
    adresse: adresseFra(e),
    forretningsadresse: enLinje(e.forretningsadresse),
  };
};

// A suggestion as the dealer of the letter.

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
    // Two searches: «fortløpende» finds a name while its last word is half typed («Sulland Au»), but lists
    // alphabetically, so «Bil i Nord» drowns in every «… Bil AS»; the default is ranked by relevance and
    // finds it first, but not half a word. Names that start with the query come first, then names
    // with every word, then the rest.
    const sok = async (metode?: string) => {
      const url = `${BRREG}?${new URLSearchParams({ navn: s, ...(metode && { navnMetodeForSoek: metode }), organisasjonsform: FORMER, size: "8" })}`;
      const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(TIDSGRENSE) });
      if (!res.ok) throw new Error(`Brreg ${res.status}`);
      return ((await res.json()) as { _embedded?: { enheter?: BrregEnhet[] } })._embedded?.enheter ?? [];
    };
    const svar = await Promise.allSettled([sok("FORTLOEPENDE"), sok()]);
    if (svar.every((r) => r.status === "rejected")) return { forslag: [], feil: true };
    const q = s.toLowerCase();
    const ord = q.split(/\s+/);
    const rang = (navn: string) => {
      const n = navn.toLowerCase();
      if (n.startsWith(q)) return 0;
      const ordINavn = n.split(/[\s\-.&]+/);
      return ord.every((o) => ordINavn.some((x) => x.startsWith(o))) ? 1 : 2;
    };
    const enheter = svar.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const unike = enheter.filter((e, i) => enheter.findIndex((x) => x.organisasjonsnummer === e.organisasjonsnummer) === i);
    return { forslag: unike.map((e, i) => ({ e, i, r: rang(e.navn) })).sort((a, b) => a.r - b.r || a.i - b.i).slice(0, 8).map(({ e }) => tilForslag(e)) };
  } catch {
    return { forslag: [], feil: true };
  }
}


// Brreg writes names in capitals; this gives «Testbil AS» for «TESTBIL AS».
export const tittel = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-.(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(As|Asa)\b/g, (m) => m.toUpperCase());
