import { describe, expect, it } from "vitest";
import { HOVEDKATEGORIER, KOMPONENTTYPER, komponenttype, rensFeilvalg } from "./kategorier";

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

