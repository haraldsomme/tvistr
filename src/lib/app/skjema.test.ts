import { describe, expect, it } from "vitest";
import { impactToggle, standard, syncAreas } from "./skjema";

describe("impactToggle", () => {
  it("«Bare kosmetisk» kan stå sammen med at bilen er mindre verdt", () => {
    expect(impactToggle(["kosmetisk"], "verdi", true)).toEqual(["kosmetisk", "verdi"]);
    expect(impactToggle(["verdi", "plagsom"], "kosmetisk", true)).toEqual(["verdi", "kosmetisk"]);
  });
  it("men ikke med de andre", () => {
    expect(impactToggle(["kosmetisk", "verdi"], "plagsom", true)).toEqual(["verdi", "plagsom"]);
    expect(impactToggle(["plagsom", "bruk"], "kosmetisk", true)).toEqual(["kosmetisk"]);
  });
});

describe("syncAreas og konsekvensene", () => {
  it("f_impact er summen av konsekvensene per feil, og alvoret følger den verste", () => {
    const s = { ...standard("2026-10-23"), f_cats: ["karosseri", "klima"], f_parts: { karosseri: ["lakk"], klima: ["ac"] }, f_virkning: { karosseri: ["kosmetisk"], klima: ["sikkerhet"] } };
    const u = syncAreas(s);
    expect(u.f_impact.toSorted()).toEqual(["kosmetisk", "sikkerhet"]);
    expect(u.f_sev).toBe(4);
  });
});
