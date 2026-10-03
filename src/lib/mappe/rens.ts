// The decision texts are redacted with placeholders in square brackets ([KLAGER], [PERSON], [REGNR] …).
// For the buyer they become plain words; no bracket is left, because the letter reserves square
// brackets for what the buyer still has to fill in.
export function rens(tekst: string): string {
  const ut = tekst
    .replace(/\[KLAGER\]s\b/g, "klagerens")
    .replace(/\[KLAGER\]/g, "klageren")
    .replace(/\[PERSON\]/g, "en person")
    .replace(/\[[^\]]*\]/g, "(utelatt)");
  // A sentence that starts with the replaced word keeps its capital letter.
  return ut.replace(/(^|[.!?]\s+)klageren\b/g, (_, f: string) => `${f}Klageren`).replace(/^klagerens\b/, "Klagerens");
}
