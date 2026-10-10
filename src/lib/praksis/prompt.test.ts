import { describe, expect, it } from "vitest";
import { tilBudsjett } from "./prompt";
import { rensTekst } from "./rens";

const vedtak = (id: number, lengde: number) => ({ vedtak_id: id, tekst: `Saken gjelder ${"x".repeat(3000)}\nUtvalget ser slik på saken\n${"y".repeat(Math.max(0, lengde - 3050))}` });

describe("tilBudsjett", () => {
  it("tar de beste hele, trimmer de lavest rangerte til hode og vurdering, og dropper det som ikke får plass", () => {
    const ut = tilBudsjett([vedtak(1, 20_000), vedtak(2, 20_000), vedtak(3, 20_000)], 50_000);
    expect(ut.map((x) => [x.vedtak_id, x.trimmet])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    expect(ut[2].tekst).toContain("[… saksfremstillingen er utelatt …]\nUtvalget ser slik på saken");
    expect(ut.reduce((n, x) => n + x.tekst.length, 0)).toBeLessThanOrEqual(50_000);
    expect(tilBudsjett([vedtak(1, 20_000), vedtak(2, 20_000)], 21_000).map((x) => x.vedtak_id)).toEqual([1]);
  });
});

describe("rensTekst", () => {
  it("fjerner kjøperens navn, e-post, telefon og regnummer", () => {
    const kjente = [
      { tekst: "Kari Nordmann", somSkrevet: false },
      { tekst: "Kari", somSkrevet: true },
    ];
    expect(rensTekst("Hei Kari, ring meg på 412 34 567 eller kari@example.no om EL 12345.", kjente)).toBe("Hei …, ring meg på … eller … om ….");
    // A part of the name only as written: «kari» in an ordinary word is kept.
    expect(rensTekst("Kari Nordmann skrev til Karikatur AS", kjente)).toBe("… skrev til Karikatur AS");
  });
});
