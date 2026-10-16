import { afterEach, describe, expect, it, vi } from "vitest";
import { les, skriv } from "./lagring";

const minne = (verdi: string | null) => {
  const lager = new Map<string, string>(verdi === null ? [] : [["x", verdi]]);
  return { getItem: (k: string) => lager.get(k) ?? null, setItem: (k: string, v: string) => void lager.set(k, v), removeItem: (k: string) => void lager.delete(k) };
};

describe("lagring", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gir standard når verdien er ødelagt", () => {
    vi.stubGlobal("localStorage", minne("{bad"));
    expect(les("x", () => ({ a: 1 }))).toEqual({ a: 1 });
  });
  it("fletter lagret verdi over standard", () => {
    vi.stubGlobal("localStorage", minne('{"b":2}'));
    expect(les("x", () => ({ a: 1 }))).toEqual({ a: 1, b: 2 });
  });
  it("gir standard når localStorage kaster", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blokkert"); } });
    expect(les("x", () => ({ a: 1 }))).toEqual({ a: 1 });
  });
  it("gir standard for en verdi av feil type", () => {
    vi.stubGlobal("localStorage", minne("[1,2]"));
    expect(les("x", () => ({ a: 1 }))).toEqual({ a: 1 });
  });
  it("skriver og leser en streng", () => {
    vi.stubGlobal("localStorage", minne(null));
    skriv("x", "abc");
    expect(les("x", () => "")).toBe("abc");
  });
  it("skriv kaster ikke når lagring er blokkert", () => {
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("full"); } });
    expect(() => skriv("x", 1)).not.toThrow();
  });
});

describe("#5 lagret verdi av feil type", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("beholder bare felt med samme type som standard", () => {
    vi.stubGlobal("localStorage", minne('{"f_cats":"motor","c_make":null,"b_name":"Kari","f_area":[1]}'));
    expect(les("x", () => ({ f_cats: [] as string[], c_make: "", b_name: "", f_area: {} as Record<string, unknown> }))).toEqual({ f_cats: [], c_make: "", b_name: "Kari", f_area: {} });
  });
  it("sjekker typen på nøkler som finnes i standard, og beholder de andre", () => {
    vi.stubGlobal("localStorage", minne('{"_i":"x","cats":"motor","make":"Volvo"}'));
    expect(les<{ _i: number; cats: string[]; make?: string }>("x", () => ({ _i: 0, cats: [] }))).toEqual({ _i: 0, cats: [], make: "Volvo" });
  });
});
