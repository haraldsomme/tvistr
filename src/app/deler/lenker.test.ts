import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// /logg-inn is a GET route handler with side effects (a login row, Vipps discovery, the START cookie).
// next/link prefetches what it shows in production, so a <Link> to it would start a login on every
// page view. Links to it must be plain <a> (as /logg-inn/feil does).
const filer = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filer(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));

describe("lenker til /logg-inn", () => {
  it("er aldri en <Link> som forhåndshenter", () => {
    const rot = join(__dirname, "..", "..");
    const treff = filer(rot).filter((f) => /<Link\b[^>]*logg-inn/.test(readFileSync(f, "utf8")));
    expect(treff).toEqual([]);
  });
});
