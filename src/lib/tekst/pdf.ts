import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

export async function lesPdfTekst(sti: string): Promise<{ tekst: string; sider: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(sti)));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  // Rejoin words hyphenated across line breaks ("reklama-\nsjon") and trim trailing spaces.
  const tekst = text.replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2").replace(/[ \t]+\n/g, "\n");
  return { tekst, sider: totalPages };
}

