// Redaction of personal data in decision texts. Every natural person's name is replaced;
// only company names survive. The identifier lists passed in come from the model and must
// never be persisted.

export type Identifikatorer = {
  klager: string[];
  personer: string[];
  adresser: string[];
  andre: string[];
};

const L = "\\p{L}\\p{N}";

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches the literal with flexible whitespace/line breaks and an optional genitive ending.
function literalRegex(literal: string, caseSensitive: boolean): RegExp {
  const body = literal.trim().split(/\s+/).map(escape).join("[\\s\\u00AD-]+");
  return new RegExp(`(?<![${L}])${body}(?:s|'s?|’s?)?(?![${L}])`, caseSensitive ? "gu" : "giu");
}

const FIRMAORD = /\b(AS|ASA|ANS|DA|ENK|SA|NUF|AB|GmbH|Ltd|Inc|BA)\b\.?$/i;

// Single name parts (e.g. the surname alone) are also matched, but only capitalised, so that
// a first name like "Per" does not wipe out ordinary words.
function navneledd(navn: string): string[] {
  if (FIRMAORD.test(navn.trim())) return [];
  return navn
    .split(/[\s,]+/)
    .map((d) => d.replace(/[.()]/g, ""))
    .filter((d) => d.length >= 3 && /^\p{Lu}/u.test(d));
}

type Erstatning = { regex: RegExp; med: string; lengde: number };

function erstatninger(id: Identifikatorer): Erstatning[] {
  const liste: Erstatning[] = [];
  const legg = (verdier: string[], med: string, medLedd: boolean) => {
    for (const v of verdier) {
      const t = v?.trim();
      if (!t || t.length < 2) continue;
      liste.push({ regex: literalRegex(t, false), med, lengde: t.length });
      if (medLedd) for (const d of navneledd(t)) liste.push({ regex: literalRegex(d, true), med, lengde: d.length });
    }
  };
  legg(id.klager, "[KLAGER]", true);
  legg(id.personer, "[PERSON]", true);
  legg(id.adresser, "[ADRESSE]", false);
  legg(id.andre, "[PERSONOPPLYSNING]", false);
  // Longest first, so "Ola Nordmann" is replaced before "Ola".
  return liste.sort((a, b) => b.lengde - a.lengde);
}

// Structured identifiers that never belong in the stored text, regardless of the model.
const MONSTRE: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[E-POST]"],
  // 11-digit national id numbers
  [/(?<!\d)\d{6}\s?\d{5}(?!\d)/g, "[FØDSELSNUMMER]"],
  // VIN: 17 chars without I, O, Q and with both letters and digits
  [/\b(?=[A-HJ-NPR-Z0-9]*\d)(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])[A-HJ-NPR-Z0-9]{17}\b/g, "[VIN]"],
  // Norwegian registration numbers: two letters + 4–5 digits (AB 12345, EL12345)
  [/(?<![\p{L}\d])[A-ZÆØÅ]{2}[ -]?\d{4,5}(?!\d)/gu, "[REGNR]"],
  // Phone numbers: 8 digits as 2-2-2-2, 3-2-3 or a block, optional +47; not part of a decimal
  [/(?<![\d,.])(?:\+47[ -]?)?(?:\d{3}[ -]\d{2}[ -]\d{3}|(?:\d{2}[ -]?){3}\d{2})(?!\d|[,.]\d)/g, "[TELEFON]"],
];

const PARTSLINJE =
  /^[ \t]*(Klager(?:e|ens)?|Medklager|Klagers fullmektig|Innklagedes fullmektig|Fullmektig(?:\s+for\s+\w+)?|Innklaget(?:e)?(?:\s*\d+)?)[ \t]*:[ \t]*(.*)$/gimu;

// Header lines listing the parties: the complainant and representatives are dropped entirely;
// for the respondent, only the first comma-separated part (the name) is kept if it is a company.
function rensPartslinjer(tekst: string, selgerErFirma: boolean): string {
  return tekst.replace(PARTSLINJE, (_, rolle: string, verdi: string) => {
    const r = rolle.toLowerCase();
    if (r.startsWith("innklaget")) {
      const navn = verdi.split(",")[0].trim();
      const behold = selgerErFirma && FIRMAORD.test(navn);
      return `${rolle}: ${behold ? navn : "[PERSON]"}${verdi.includes(",") ? ", [ADRESSE]" : ""}`;
    }
    return `${rolle}: ${r.startsWith("klager") || r === "medklager" ? "[KLAGER]" : "[PERSON]"}`;
  });
}

export function rens(tekst: string, id: Identifikatorer, opts: { selgerErFirma?: boolean } = {}): string {
  let t = rensPartslinjer(tekst, opts.selgerErFirma ?? false);
  for (const e of erstatninger(id)) t = t.replace(e.regex, e.med);
  for (const [re, med] of MONSTRE) t = t.replace(re, med);
  return t;
}

export function rensValgfri(tekst: string | null | undefined, id: Identifikatorer, opts?: { selgerErFirma?: boolean }): string | null {
  return tekst == null ? null : rens(tekst, id, opts);
}

// Identifiers from the list that still occur after redaction (should be empty).
export function gjenstaende(tekst: string, id: Identifikatorer): string[] {
  const alle = [...id.klager, ...id.personer, ...id.adresser, ...id.andre].filter((v) => v?.trim().length >= 2);
  return alle.filter((v) => literalRegex(v, false).test(tekst));
}

export const TOM_ID: Identifikatorer = { klager: [], personer: [], adresser: [], andre: [] };
