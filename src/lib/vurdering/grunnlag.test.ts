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
      ["avvist", "forbrukerkjøpsloven §§ 31 og 32"],
      ["forsokt", "forbrukerkjøpsloven §§ 31 og 32"],
    ] as const) {
      i.feilen.kontakt = kontakt;
      expect(paragrafer(i).at(-1)).toBe(paragraf);
    }
    i.feilen.kontakt = "venter";
    expect(paragrafer(i)).not.toContain("forbrukerkjøpsloven § 29");
  });

  it("opplyst feil viser til § 15 for kjøp fra 2024, og til det kjøperen kjente til før det", () => {
    const ny = grunnlag(hent(3)).find((g) => /fortalt om feilen før kjøpet/.test(g.tekst))!;
    expect(ny.paragraf).toBe("forbrukerkjøpsloven § 15");
    expect(ny.tekst).toMatch(/uttrykkelig godtok/);
    const i = hent(3);
    i.bilOgKjop.kjopsdato = "2023-12-31";
    expect(grunnlag(i).some((g) => /kan du normalt ikke klage på/.test(g.tekst))).toBe(true);
  });

  it("slitasje nevnes innenfor presumsjonen, men ikke for kilometer, historikk og kollisjonsskade", () => {
    const slitasje = (i: KlageInput) => grunnlag(i).find((g) => /vanlig slitasje/.test(g.tekst));
    expect(slitasje(hent(1))).toMatchObject({ vekt: "noytral", paragraf: "forbrukerkjøpsloven § 15" });
    expect(slitasje(hent(6))).toBeUndefined(); // utenfor presumsjonen
    expect(slitasje(hent(7))).toBeUndefined(); // km_service
    const i = hent(1);
    i.feilen.typer = ["skade", "annet"];
    expect(slitasje(i)).toBeUndefined();
    i.feilen.typer = ["annet"];
    expect(slitasje(i)).toBeDefined();
  });

  it("uten klage lenge etter at feilen viste seg, sier § 27-punktet at kravet kan være tapt", () => {
    const i = hent(1);
    i.feilen.kontakt = "nei";
    i.bilOgKjop.kjopsdato = "2022-01-31";
    const siste = grunnlag(i).at(-1)!;
    expect(siste.paragraf).toBe("forbrukerkjøpsloven § 27");
    expect(siste.tekst).toMatch(/kan kravet være tapt/);
  });

  it("dokumenterte feilopplysninger får sitt eget punkt", () => {
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
