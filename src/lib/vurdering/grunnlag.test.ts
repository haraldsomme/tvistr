import { describe, expect, it } from "vitest";
import klager from "./testdata/klager.json";
import { beregnFaktorer } from "./faktorer";
import { byggGrunnlag } from "./grunnlag";
import type { KlageInput, TestKlage } from "./typer";

const IDAG = "2026-10-01";
const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);
const grunnlag = (i: KlageInput) => byggGrunnlag(beregnFaktorer(i, IDAG));
const paragrafer = (i: KlageInput) => grunnlag(i).map((g) => g.paragraf);

describe("grunnlag", () => {
  it("innenfor presumsjonen vises § 18, utenfor at kjøperen har bevisbyrden", () => {
    const innenfor = grunnlag(hent(1))[0];
    expect(innenfor.paragraf).toBe("forbrukerkjøpsloven § 18");
    expect(innenfor.tekst).toMatch(/forhandleren må bevise noe annet/);
    const utenfor = grunnlag(hent(6));
    expect(utenfor[0].paragraf).toBe("forbrukerkjøpsloven § 18");
    expect(utenfor[0].tekst).toMatch(/du som må vise/);
    expect(utenfor[1].tekst).toMatch(/ikke en rapport/);
  });

  it("kontakten med forhandleren avgjør hvilken regel som vises til slutt", () => {
    const i = hent(1);
    for (const [kontakt, paragraf] of [
      ["nei", "forbrukerkjøpsloven § 27"],
      ["venter", "forbrukerkjøpsloven § 29"],
      ["avvist", "forbrukerkjøpsloven §§ 31 og 32"],
      ["forsokt", "forbrukerkjøpsloven §§ 31 og 32"],
    ] as const) {
      i.feilen.kontakt = kontakt;
      expect(paragrafer(i).at(-1)).toBe(paragraf);
    }
  });

  it("opplyst feil og dokumenterte feilopplysninger får hvert sitt punkt", () => {
    expect(grunnlag(hent(3)).some((g) => /fortalt om feilen før kjøpet/.test(g.tekst))).toBe(true);
    expect(paragrafer(hent(4))).toContain("forbrukerkjøpsloven § 16");
  });

  it("alle lenker peker til paragrafen i forbrukerkjøpsloven", () => {
    for (const id of [1, 3, 4, 5, 6, 8, 10]) {
      for (const g of grunnlag(hent(id))) {
        expect(Boolean(g.lenke)).toBe(Boolean(g.paragraf));
        if (g.lenke) expect(g.lenke).toMatch(/^https:\/\/lovdata\.no\/lov\/2002-06-21-34\/§\d+$/);
      }
    }
  });
});
