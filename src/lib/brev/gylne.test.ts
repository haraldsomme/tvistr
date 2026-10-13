import { describe, expect, it } from "vitest";
import { BREVDATO, SAKER, tilBrevsak } from "../../../scripts/simulerte-saker";
import praksis from "./__fixtures__/praksis.json";
import { alleSetninger, byggBrev, somTekst } from "./brev";
import type { Brevsak } from "./typer";

// The twelve simulated cases (scripts/simulerte-saker.ts) as complete letters, one golden file each.
// The decision paragraph of each comes from the fixture (npm run brev:praksis), so nothing here needs
// the database or the model. A change in a template shows as a diff in these files, which are read
// as letters, not only compared.
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const FORBUDT = /\b(klart|åpenbart|utvilsomt)\b|jeg er klar over|jeg mener/i;

describe("de tolv simulerte sakene", () => {
  it("har svar som ikke er i strid med hverandre", () => {
    for (const x of SAKER) {
      // Repairs need a complaint, a complaint comes after the purchase, a report follows a written answer.
      expect(x.forsok === 0 || !!x.kontakt, `${x.navn}: rettingsforsøk uten reklamasjon`).toBe(true);
      if (x.kontakt) expect(x.kontakt.dato > x.kjopsdato && x.kontakt.dato <= BREVDATO, `${x.navn}: kontaktdato`).toBe(true);
      for (const f of x.feil) {
        expect(!!f.rapport, `${x.navn}: rapport`).toBe(f.verksted === "skriftlig");
        if (f.rapport) expect(f.rapport.dato > x.kjopsdato && f.rapport.dato <= BREVDATO, `${x.navn}: rapportdato`).toBe(true);
      }
    }
  });

  it("dekker rapportene og kontakten bredt nok", () => {
    const rapporter = SAKER.flatMap((x) => x.feil.flatMap((f) => (f.rapport ? [f.rapport] : [])));
    expect(rapporter.length).toBeGreaterThanOrEqual(4);
    expect(new Set(rapporter.map((r) => r.punkter.join())).size).toBeGreaterThanOrEqual(4);
    expect(new Set(rapporter.map((r) => r.hvem)).size).toBe(3);
    expect(SAKER.filter((x) => x.kontakt && ["avviste", "ikke_svart"].includes(x.kontakt.svar)).length).toBeGreaterThanOrEqual(2);
  });

  it("har et vedtaksavsnitt hver i fixturen", () => {
    expect(Object.keys(praksis).sort()).toEqual(SAKER.map((x) => x.navn).sort());
  });

  for (const [i, x] of SAKER.entries()) {
    describe(x.navn, () => {
      const brev = byggBrev(tilBrevsak(x, (praksis as Record<string, Brevsak["praksis"]>)[x.navn]));
      const tekst = somTekst(brev);

      it("gir et komplett brev uten tomme felt", () => {
        expect(tekst).not.toMatch(/undefined|\bnull\b|NaN|\[object|[{}]/);
        expect(brev.avsnitt.map((a) => a.overskrift.tekst)).toEqual(["1. Sakens bakgrunn", "2. Mangelen", "3. Rettslig vurdering", "4. Krav", "5. Frist for tilbakemelding"]);
        for (const a of brev.avsnitt) expect(a.blokker.length, a.overskrift.tekst).toBeGreaterThan(0);
        expect(tekst).toContain("Med vennlig hilsen\nKari Testesen");
      });

      it("har en kilde på hver setning og ingen forsterkere", () => {
        for (const s of alleSetninger(brev)) {
          expect(s.kilde.trim(), s.tekst).not.toBe("");
          if (!s.kilde.startsWith("vedtak:") && !s.kilde.endsWith(".beskrivelse")) expect(s.tekst).not.toMatch(FORBUDT);
        }
      });

      it("er likt det gylne brevet", async () => {
        await expect(tekst + "\n").toMatchFileSnapshot(`./__snapshots__/gylne/${String(i + 1).padStart(2, "0")}-${slug(x.navn)}.txt`);
      });
    });
  }
});
