import { describe, expect, it } from "vitest";
import { husk, trygt } from "./kall";

describe("#7 kall som feiler", () => {
  it("trygt gjør et kastet kall om til en melding", async () => expect(await trygt(Promise.reject(new Error("nett")), "Prøv igjen.")).toEqual({ ok: false, melding: "Prøv igjen." }));
  it("husk tar vare på et vellykket svar", async () => {
    let n = 0;
    const kall = async () => ({ ok: true as const, n: ++n });
    await husk("a", kall, "x");
    expect(await husk("a", kall, "x")).toEqual({ ok: true, n: 1 });
  });
  it("husk prøver igjen etter et feilet kall", async () => {
    let n = 0;
    const kall = async () => {
      if (++n === 1) throw new Error("nett");
      return { ok: true as const, n };
    };
    expect(await husk("b", kall, "Prøv igjen.")).toEqual({ ok: false, melding: "Prøv igjen." });
    expect(await husk("b", kall, "Prøv igjen.")).toEqual({ ok: true, n: 2 });
  });
});
