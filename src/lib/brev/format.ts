// Numbers, dates and lists as the letter writes them. Every template goes through here, so the
// same figure always looks the same.

const NB = new Intl.NumberFormat("nb-NO");
const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

// 142000 → «142 000» (with a non-breaking space, so a figure never splits over two lines).
export const tall = (n: number) => NB.format(n);
export const kr = (n: number) => `kr ${tall(n)}`;
export const km = (n: number) => `${tall(n)} km`;

// «2026-05-12» → «mai 2026», for a day that is only approximate.
export function maaned(iso: string): string {
  return dato(iso).replace(/^\d+\. /, "");
}

// «den 12. mai 2026», or «i mai 2026» when the day is only approximate.
export const naar = (iso: string, omtrentlig: boolean) => (omtrentlig ? `i ${maaned(iso)}` : `den ${dato(iso)}`);

// «2026-05-12» → «12. mai 2026»
export function dato(iso: string): string {
  const [, a, m, d] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) ?? [];
  if (!a) throw new Error(`Ugyldig dato: ${iso}`);
  return `${Number(d)}. ${MANEDER[Number(m) - 1]} ${a}`;
}

// «a», «a og b», «a, b og c»
export const liste = (deler: string[]) => (deler.length < 2 ? (deler[0] ?? "") : `${deler.slice(0, -1).join(", ")} og ${deler.at(-1)}`);

// «999999999» → «999 999 999»
export const orgnr = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

// A name in the middle of a sentence starts in lower case, except an acronym («EGR, partikkelfilter»).
export const smaa = (s: string) => (/^[A-ZÆØÅ]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

// Brreg and the registry write place names in capitals: «OSLO» → «Oslo». Mixed case is left alone.
export const sted = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-.(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s);

export const FORSOK: Record<number, string> = { 1: "én gang", 2: "to ganger", 3: "tre eller flere ganger" };
export const FORSOK_ANTALL: Record<number, string> = { 1: "ett forsøk", 2: "to forsøk", 3: "tre eller flere forsøk" };

// «Volkswagen Golf», or the make alone when the registry has no model.
export const bilnavn = (b: { merke: string; modell: string }) => [b.merke, b.modell].filter(Boolean).join(" ");
