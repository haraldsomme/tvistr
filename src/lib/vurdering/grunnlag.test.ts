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

  it("retting og senere prisavslag eller heving står i ett punkt, med to forsøk for kjøp før 2024", () => {
    const punkt = (i: KlageInput) => grunnlag(i).find((g) => g.paragraf === "forbrukerkjøpsloven §§ 29–32")!.tekst;
    expect(punkt(hent(1))).toMatch(/retter den uten kostnad.*prisavslag eller heving\.$/);
    expect(punkt(hent(1))).not.toMatch(/to forsøk/);
    const gammel = hent(1);
    gammel.bilOgKjop.kjopsdato = "2023-12-31";
    expect(punkt(gammel)).toMatch(/For kjøp før 2024 har forhandleren normalt rett til to forsøk/);
  });

  it("opplyst feil viser til § 15 for kjøp fra 2024, og en feil som er verre enn opplyst, gir ikke noe punkt", () => {
    const ny = grunnlag(hent(3)).find((g) => /visste om feilen/.test(g.tekst))!;
    expect(ny.paragraf).toBe("forbrukerkjøpsloven § 15");
    expect(ny.vekt).toBe("mot");
    expect(ny.tekst).toMatch(/uttrykkelig godtok/);
    // «Verre eller annerledes enn jeg fikk vite»: the letter builds on the difference, no point against.
    const verre = hent(3);
    verre.feilen.opplystForKjop = "ja_verre";
    expect(grunnlag(verre).some((g) => /visste om feilen/.test(g.tekst))).toBe(false);
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

  it("ikke klaget ennå gir ikke noe punkt: å klage er det appen hjelper med", () => {
    const i = hent(1);
    i.feilen.kontakt = "nei";
    expect(grunnlag(i).some((g) => /ikke klaget/.test(g.tekst))).toBe(false);
    i.bilOgKjop.kjopsdato = "2022-01-31";
    expect(grunnlag(i).some((g) => /ikke klaget/.test(g.tekst))).toBe(false);
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
