import { describe, expect, it } from "vitest";
import { brukerNiva, HOVEDKATEGORIER, KOMPONENTTYPER, komponenttype, rensFeilvalg, rensTidsvalg } from "./kategorier";

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

describe("tidsvalg", () => {
  it("setter brukeren på samme nivå som vedtakene, etter lovversjon", () => {
    expect(brukerNiva("innen_6_mnd", "2022-05-01")).toBe(1);
    expect(brukerNiva("6_til_24_mnd", "2023-12-31")).toBe(2);
    expect(brukerNiva("6_til_24_mnd", "2024-01-01")).toBe(1);
    expect(brukerNiva("6_til_24_mnd", null)).toBe(1);
    expect(brukerNiva("over_24_mnd", "2025-01-01")).toBe(3);
  });

  it("rensTidsvalg dropper ukjente verdier", () => {
    expect(rensTidsvalg({ motor: "innen_6_mnd", rust: "0-2", x: 5 })).toEqual({ motor: "innen_6_mnd" });
    expect(rensTidsvalg(null)).toEqual({});
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
