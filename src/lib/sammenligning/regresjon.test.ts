// The Enyaq case against the real index, frozen as the regression baseline (2026-10-09, after the
// sanction column and the paragraph corrections). Needs the database: npm run test:db.
// A change here is not necessarily wrong; check the diff and refreeze with
//   npm run sammenlign -- src/lib/sammenligning/testdata/enyaq-skjema.json --idag 2026-10-09 --ut src/lib/sammenligning/testdata/enyaq-fasit.json
import { describe, expect, it } from "vitest";
import fasit from "./testdata/enyaq-fasit.json";
import skjema from "./testdata/enyaq-skjema.json";
import type { Skjema } from "./typer";

describe.skipIf(!process.env.DATABASE_URL)("regresjon mot indeksen", () => {
  it("Enyaq-saken gir samme vedtak og samme tekst", async () => {
    const { db } = await import("@/db");
    const { sammenlign } = await import("./index");
    const { lagHentKandidater } = await import("./kandidater");
    const r = await sammenlign(skjema as unknown as Skjema, lagHentKandidater(db), "2026-10-09");
    expect(JSON.parse(JSON.stringify(r))).toEqual(fasit);
  }, 60_000);
});
