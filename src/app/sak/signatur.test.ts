import { describe, expect, it } from "vitest";
import { apne, forsegle } from "./signatur";

describe("forseglingen av vedtaksavsnittet", () => {
  const funn = { avsnitt: "Det vises til … Utvalget uttalte: «Feilen var der.»", niva: "A", vedtak: { saksnummer: "22/2868", kildeUrl: "https://example.org/v", lovversjon: "før_2024" } };
  it("åpner det serveren forseglet", () => expect(apne(forsegle(funn))).toEqual(funn));
  it("viser verken sitatet eller lenken i det nettleseren får", () => {
    const s = forsegle(funn);
    expect(s).not.toMatch(/«|example\.org|Utvalget/);
    expect(Buffer.from(s, "base64url").toString("latin1")).not.toMatch(/example\.org|Utvalget/);
  });
  it("avviser en endret, avkortet eller manglende forsegling", () => {
    const s = forsegle(funn);
    const endret = Buffer.from(s, "base64url");
    endret[endret.length - 1] ^= 1;
    expect(apne(endret.toString("base64url"))).toBeUndefined();
    expect(apne(s.slice(0, 20))).toBeUndefined();
    expect(apne(undefined)).toBeUndefined();
    expect(apne("x")).toBeUndefined();
  });
});
