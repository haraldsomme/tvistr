// Small text helpers for the practice paragraph: Norwegian dates and numbers, and finding the dates and
// numbers a sentence contains (as master's letter control did).

export const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

// "2026-02-18" → "18. februar 2026"
export function datoLang(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d}. ${MANEDER[m - 1]} ${a}`;
}

// 16066 → "16 066"
export function tall(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Quotes inside a quote: «… «gode dekk» …» → «… 'gode dekk' …».
export const indreAnforsel = (t: string) => t.replace(/[«“]/g, "'").replace(/[»”]/g, "'");

// Where the committee's own assessment starts (929 of 940 decisions from 2021, bokmål and nynorsk).
// A quote or a finding from before it may be a party's claim.
export const VURDERING_START = /utval(?:get|et) ser slik på sak(?:en|a)|utvalget (?:bemerker|vil bemerke|skal bemerke)|utvalgets (?:vurdering|merknader)/i;

// Words that can be turned against the buyer: what was visible, inspected or test-driven, or what
// someone "burde" have known. Matched at the start of a word, or "sannsynliggjort" would count as "synlig".
export const MOT_KJOPER = /(^|[^a-zæøå])(synlig|besiktigelse|prøvekjør|burde)/i;

// A whole sentence: capital letter first, a sentence end last, long enough, and no placeholder such as [KLAGER].
export const helSetning = (t: string) => {
  const s = t.trim();
  return /^[A-ZÆØÅ«]/.test(s) && /[.!?»)]$/.test(s) && s.length >= 40 && !s.includes("[");
};

const pad = (n: number) => String(n).padStart(2, "0");
const ISO_DATO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const NORSK_DATO = new RegExp(`(\\d{1,2})\\.\\s(${MANEDER.join("|")})\\s(\\d{4})`, "giu");
const TALLDATO = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
// Thousands may be grouped with a space, a no-break space or a full stop.
const TALL = /\d{1,3}(?:[  .]\d{3})+(?!\d)|\d+(?:,\d+)?/g;
export const PARAGRAF = /§§?\s*(\d+)/g;

export function datoerI(t: string): string[] {
  return [
    ...[...t.matchAll(ISO_DATO)].map((x) => x[0]),
    ...[...t.matchAll(NORSK_DATO)].map((x) => `${x[3]}-${pad(MANEDER.indexOf(x[2].toLowerCase()) + 1)}-${pad(Number(x[1]))}`),
    ...[...t.matchAll(TALLDATO)].map((x) => `${x[3]}-${pad(Number(x[2]))}-${pad(Number(x[1]))}`),
  ];
}
export const utenDatoer = (t: string) => t.replace(ISO_DATO, " ").replace(NORSK_DATO, " ").replace(TALLDATO, " ");
export const tallI = (t: string) => [...utenDatoer(t).matchAll(TALL)].map((x) => Number(x[0].replace(/[  .]/g, "").replace(",", ".")));
