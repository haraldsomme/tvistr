import { describe, expect, it } from "vitest";
import { signer, sjekkSignatur } from "./signatur";

describe("signaturen på vedtaksavsnittet", () => {
  const funn = { avsnitt: "Det vises til …", niva: "A", vedtak: { saksnummer: "22/2868", kildeUrl: "https://example.org/v", lovversjon: "før_2024" } };
  it("godtar det serveren signerte", () => expect(sjekkSignatur(funn, signer(funn))).toBe(true));
  it("avviser en endret tekst, et endret vedtak og en manglende signatur", () => {
    const s = signer(funn);
    expect(sjekkSignatur({ ...funn, avsnitt: "Det vises til noe annet." }, s)).toBe(false);
    expect(sjekkSignatur({ ...funn, vedtak: { ...funn.vedtak, kildeUrl: "https://example.org/annet" } }, s)).toBe(false);
    expect(sjekkSignatur(funn, undefined)).toBe(false);
    expect(sjekkSignatur(funn, "x")).toBe(false);
  });
});
