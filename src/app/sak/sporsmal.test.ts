import { describe, expect, it } from "vitest";
import { standardUtkast, type Utkast } from "@/lib/app/utkast";
import { SKJERMER, synlige } from "./sporsmal";

const idag = "2026-10-21";
const utkast = (u: Partial<Utkast> = {}, skjema: Partial<Utkast["skjema"]> = {}): Utkast => ({ ...standardUtkast(idag), ...u, skjema: { ...standardUtkast(idag).skjema, ...skjema } });
const skjerm = (id: string) => SKJERMER.find((s) => s.id === id)!;
const ALLE = ["selger", "kjoper", "bilen", "kjopet", "forbehold", "feil", "omrader", "arsak", "verksted", "selger_sa", "sagt_fra", "kravet"];

describe("SKJERMER", () => {
  it("forhandler og privat kjøper: alle tolv, i rekkefølge", () => {
    expect(synlige(utkast({ seller: "forhandler", buyer: "privat" })).map((s) => s.id)).toEqual(ALLE);
    expect(SKJERMER.map((s) => s.id)).toEqual(ALLE);
  });
  it("kjøp fra privatperson går ikke videre", () => {
    expect(SKJERMER[0].ferdig(utkast({ seller: "privat" }))).toBe(false);
    expect(SKJERMER[0].ferdig(utkast({ seller: "leasing" }))).toBe(false);
    expect(SKJERMER[0].ferdig(utkast({ seller: "forhandler" }))).toBe(true);
  });
  it("kjøp gjennom firma går ikke videre", () => {
    expect(skjerm("kjoper").ferdig(utkast({ seller: "forhandler", buyer: "naering" }))).toBe(false);
    expect(skjerm("kjoper").ferdig(utkast({ seller: "forhandler", buyer: "privat" }))).toBe(true);
  });
  it("kjøperen spørres bare ved kjøp fra forhandler", () => {
    for (const seller of [undefined, "privat", "leasing"] as const) expect(synlige(utkast({ seller })).map((s) => s.id)).not.toContain("kjoper");
    expect(synlige(utkast({ seller: "forhandler" })).map((s) => s.id)).toContain("kjoper");
  });
  it("bilen trenger reg.nr. og merke", () => {
    expect(skjerm("bilen").ferdig(utkast({}, { c_reg: "AB 12345" }))).toBe(false);
    expect(skjerm("bilen").ferdig(utkast({}, { c_reg: "AB 12345", c_make: "Skoda" }))).toBe(true);
  });
  it("feilen trenger minst én kategori", () => {
    expect(skjerm("feil").ferdig(utkast())).toBe(false);
    expect(skjerm("feil").ferdig(utkast({}, { f_cats: ["motor"] }))).toBe(true);
  });
  it("om feilen: hvert område trenger datoen det ble oppdaget", () => {
    const f_cats = ["motor", "klima"];
    expect(skjerm("omrader").ferdig(utkast({}, { f_cats, f_area: { motor: { found: "2026-09-01", impact: [], known: "" } } }))).toBe(false);
    expect(skjerm("omrader").ferdig(utkast({}, { f_cats, f_area: { motor: { found: "2026-09-01", impact: [], known: "" }, klima: { found: "", impact: [], known: "" } } }))).toBe(false);
    expect(skjerm("omrader").ferdig(utkast({}, { f_cats, f_area: { motor: { found: "2026-09-01", impact: [], known: "" }, klima: { found: "2026-09-02", impact: [], known: "" } } }))).toBe(true);
  });
  it("kravet trenger hovedkravet", () => {
    expect(skjerm("kravet").ferdig(utkast())).toBe(false);
    expect(skjerm("kravet").ferdig(utkast({}, { k_main: "retting" }))).toBe(true);
  });
});
