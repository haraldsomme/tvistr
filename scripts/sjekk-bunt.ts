// The browser's bundle must not hold the letter's template text (brev.ts is server-only): after
// `next build`, fails naming the file when any of these sentences is in a script under .next/static.
//
//   npm run build && npm run sjekk:bunt

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SETNINGER = ["Det er dermed dere som må bevise", "Jeg er kjent med at dere kan tilby å rette mangelen", "Bilen kan stilles til rådighet for", "Reklamasjonen er fremsatt innen to måneder"];

const mappe = process.argv[2] ?? ".next/static";
// A minifier may write «å» as å or \xe5.
const uttrykt = (t: string) => t.replace(/\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g, (_, u, x) => String.fromCharCode(parseInt(u ?? x, 16)));

let funnet = false;
for (const fil of readdirSync(mappe, { recursive: true, encoding: "utf8" })) {
  if (!fil.endsWith(".js")) continue;
  const tekst = uttrykt(readFileSync(join(mappe, fil), "utf8"));
  for (const s of SETNINGER) {
    if (!tekst.includes(s)) continue;
    console.error(`${join(mappe, fil)}: «${s}»`);
    funnet = true;
  }
}
if (funnet) process.exit(1);
