import { describe, expect, it } from "vitest";
import { BESTEMT_FORM, bestemtForm, HOVEDKATEGORIER, KOMPONENTTYPER, komponenttype, rensFeilvalg } from "./kategorier";

describe("HOVEDKATEGORIER", () => {
  it("har unike id-er og koder, og unike underkategorier per hovedkategori", () => {
    expect(new Set(HOVEDKATEGORIER.map((h) => h.id)).size).toBe(HOVEDKATEGORIER.length);
    expect(new Set(HOVEDKATEGORIER.map((h) => h.kode)).size).toBe(HOVEDKATEGORIER.length);
    for (const h of HOVEDKATEGORIER) expect(new Set(h.under.map((u) => u.id)).size).toBe(h.under.length);
  });

});

describe("rensFeilvalg", () => {
  it("beholder kjente valg og dropper resten", () => {
    expect(
      rensFeilvalg({
        motor: ["turbo", "finnes_ikke"],
        garanti: [],
        ukjent: ["x"],
      }),
    ).toEqual({ motor: ["turbo"], garanti: [] });
  });

  it("tåler søppel", () => {
    expect(rensFeilvalg(null)).toEqual({});
    expect(rensFeilvalg("motor")).toEqual({});
    expect(rensFeilvalg({ motor: "turbo" })).toEqual({});
  });
});

describe("komponenttype", () => {
  it("gir hver underkategori én type, unntatt symptomene under «vet ikke ennå»", () => {
    const ider = Object.values(KOMPONENTTYPER).flat();
    expect(new Set(ider).size).toBe(ider.length);
    for (const h of HOVEDKATEGORIER)
      for (const u of h.under) expect([h.id, u.id, komponenttype(h.id, u.id) !== null]).toEqual([h.id, u.id, h.id !== "vet_ikke"]);
  });

  it("gir en hovedkategori en type bare når alle underkategoriene har samme", () => {
    expect(komponenttype("fukt", null)).toBe("karosseri");
    expect(komponenttype("historikk", null)).toBe("opplysning");
    expect(komponenttype("garanti", null)).toBe("opplysning");
    expect(komponenttype("motor", null)).toBeNull();
    expect(komponenttype("vet_ikke", null)).toBeNull();
  });
});

describe("BESTEMT_FORM", () => {
  it("har en form for hver opplysningsunderkategori", () => {
    for (const id of KOMPONENTTYPER.opplysning) expect(BESTEMT_FORM[id], id).toBeTruthy();
  });

  it("har en form for hver hovedkategori med opplysninger når ingen underkategori er valgt", () => {
    for (const h of ["historikk", "service", "utstyr", "garanti"]) expect(bestemtForm(h, null), h).toBeTruthy();
  });

  it("har ingen form for tekniske feil", () => {
    expect(bestemtForm("motor", "turbo")).toBeNull();
    expect(bestemtForm("motor", null)).toBeNull();
  });

  it("har bare nøkler som finnes i kategoriene", () => {
    for (const k of Object.keys(BESTEMT_FORM)) {
      const [hoved, under] = k.split(".");
      const h = HOVEDKATEGORIER.find((x) => x.id === hoved);
      expect(h, k).toBeTruthy();
      if (under) expect(h!.under.some((u) => u.id === under), k).toBe(true);
    }
  });
});
