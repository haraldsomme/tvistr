import { describe, expect, it } from "vitest";
import { standard } from "./skjema";
import { standardUtkast, type Utkast, utkastResultat, utkastSvar, utkastTilSvar } from "./utkast";

const idag = "2026-10-21";
const s0 = standard(idag);
const gammel: Utkast = {
  skjema: { ...s0, c_reg: "AB 12345", c_make: "Peugeot", c_model: "308", c_year: "2014", c_delivery: "2025-03-15", f_cats: ["motor"], f_parts: { motor: ["turbo"] }, f_area: { motor: { found: "2025-08-20", impact: [], known: "" } } },
  asis: "vetikke",
  seller: "forhandler",
};

describe("utkastet", () => {
  it("«vet ikke» om «som den er» er ukjent for rangeringen", () => {
    const u = gammel;
    expect(utkastTilSvar(u)?.somDenEr).toBeNull();
    expect(utkastTilSvar({ ...u, asis: "nei" })?.somDenEr).toBe("nei");
    expect(utkastTilSvar(standardUtkast(idag))).toBeNull();
  });

  it("vurderingen bruker utkastets svar om selger og kjøper", () => {
    expect(utkastResultat({ ...standardUtkast(idag), seller: "privat" }, idag).tier).toBe("utenfor");
    expect(utkastResultat({ ...standardUtkast(idag), buyer: "naering" }, idag).tier).toBe("utenfor");
    expect(utkastSvar(standardUtkast(idag))).toMatchObject({ seller: "forhandler", buyer: "privat", asis: "nei" });
    expect(utkastSvar({ skjema: { ...standard(idag), c_asis: true }, asis: "vetikke" }).asis).toBe("vetikke");
  });

  it("feildatoene rulles opp før vurderingen", () => {
    expect(utkastSvar(gammel)).toMatchObject({ found: "2025-08-20", delivery: "2025-03-15" });
  });

  it("verkstedet teller i vurderingen, som i skriveren", () => {
    const u = gammel;
    expect(utkastResultat({ ...u, skjema: { ...u.skjema, ws: "nei" } }, idag).factors.map((f) => f.t)).toContain("Ingen verkstedrapport ennå");
  });
});
