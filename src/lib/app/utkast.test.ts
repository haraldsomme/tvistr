import { describe, expect, it } from "vitest";
import { standard } from "./skjema";
import { fraGammelSjekk, standardUtkast, utkastResultat, utkastSvar, utkastTilSvar } from "./utkast";

const idag = "2026-10-21";
const gammel = { reg: "AB 12345", make: "Peugeot 308", year: "2014", delivery: "2025-03-15", cats: ["motor"], issues: { motor: ["turbo"] }, fdates: { motor: "2025-08-20" }, asis: "vetikke" as const, seller: "forhandler" as const };

describe("utkastet", () => {
  it("en gammel sjekk blir skjemaet og de tre svarene", () => {
    const u = fraGammelSjekk(gammel, idag);
    expect([u.skjema.c_make, u.skjema.c_model, u.skjema.c_reg]).toEqual(["Peugeot", "308", "AB 12345"]);
    expect(u.skjema.f_area.motor.found).toBe("2025-08-20");
    expect([u.asis, u.seller, u.buyer]).toEqual(["vetikke", "forhandler", undefined]);
  });

  it("«vet ikke» om «som den er» er ukjent for rangeringen", () => {
    const u = fraGammelSjekk(gammel, idag);
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
    expect(utkastSvar(fraGammelSjekk(gammel, idag))).toMatchObject({ found: "2025-08-20", delivery: "2025-03-15" });
  });

  it("verkstedet teller i vurderingen, som i skriveren", () => {
    const u = fraGammelSjekk(gammel, idag);
    expect(utkastResultat({ ...u, skjema: { ...u.skjema, ws: "nei" } }, idag).factors.map((f) => f.t)).toContain("Ingen verkstedrapport ennå");
  });
});
