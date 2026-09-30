import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

export async function lesPdfTekst(sti: string): Promise<{ tekst: string; sider: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(sti)));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  // Rejoin words hyphenated across line breaks ("reklama-\nsjon") and trim trailing spaces.
  const tekst = text.replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2").replace(/[ \t]+\n/g, "\n");
  return { tekst, sider: totalPages };
}

// The opening part used for classification: the summary ("Saken gjelder" / "Kort oppsummering")
// and roughly the first page.
export function innledning(tekst: string, tegn = 5000): string {
  return tekst.slice(0, tegn);
}
