import { afterEach, describe, expect, it, vi } from "vitest";
import { skriv, tolk } from "./lagring";

const minne = (verdi: string | null) => {
  const lager = new Map<string, string>(verdi === null ? [] : [["x", verdi]]);
  return { getItem: (k: string) => lager.get(k) ?? null, setItem: (k: string, v: string) => void lager.set(k, v), removeItem: (k: string) => void lager.delete(k) };
};

describe("lagring", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gir standard når verdien er ødelagt", () => expect(tolk("{bad", () => ({ a: 1 }))).toEqual({ a: 1 }));
  it("fletter lagret verdi over standard", () => expect(tolk('{"b":2}', () => ({ a: 1 }))).toEqual({ a: 1, b: 2 }));
  it("gir standard uten lagret verdi", () => expect(tolk("", () => ({ a: 1 }))).toEqual({ a: 1 }));
  it("gir standard for en verdi av feil type", () => expect(tolk("[1,2]", () => ({ a: 1 }))).toEqual({ a: 1 }));
  it("skriver og leser en streng", () => {
    const lager = minne(null);
    vi.stubGlobal("localStorage", lager);
    skriv("x", "abc");
    expect(tolk(lager.getItem("x") ?? "", () => "")).toBe("abc");
  });
  it("skriv kaster ikke når lagring er blokkert", () => {
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("full"); } });
    expect(() => skriv("x", 1)).not.toThrow();
  });
});

describe("#5 lagret verdi av feil type", () => {
  it("beholder bare felt med samme type som standard", () => {
    expect(tolk('{"f_cats":"motor","c_make":null,"b_name":"Kari","f_area":[1]}', () => ({ f_cats: [] as string[], c_make: "", b_name: "", f_area: {} as Record<string, unknown> }))).toEqual({ f_cats: [], c_make: "", b_name: "Kari", f_area: {} });
  });
  it("sjekker typen på nøkler som finnes i standard, og beholder de andre", () => {
    expect(tolk<{ _i: number; cats: string[]; make?: string }>('{"_i":"x","cats":"motor","make":"Volvo"}', () => ({ _i: 0, cats: [] }))).toEqual({ _i: 0, cats: [], make: "Volvo" });
  });
});
