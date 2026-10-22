import { describe, expect, it } from "vitest";
import { standardUtkast, type Utkast } from "@/lib/app/utkast";
import { ENKELTVALG, SKJERMER, synlige } from "./sporsmal";

const idag = "2026-10-21";
const utkast = (u: Partial<Utkast> = {}, skjema: Partial<Utkast["skjema"]> = {}): Utkast => ({ ...standardUtkast(idag), ...u, skjema: { ...standardUtkast(idag).skjema, ...skjema } });
const skjerm = (id: string) => SKJERMER.find((s) => s.id === id)!;
const ALLE = ["selger", "bilen", "kjopet", "forbehold", "feil", "omrader", "virkning", "verksted", "selger_sa", "sagt_fra", "kravet"];

describe("SKJERMER", () => {
  it("alle elleve, i rekkefølge", () => {
    expect(synlige(utkast({ seller: "forhandler", buyer: "privat" })).map((s) => s.id)).toEqual(ALLE);
    expect(SKJERMER.map((s) => s.id)).toEqual(ALLE);
  });
  it("to valg: bare kjøp fra forhandler går videre", () => {
    expect(ENKELTVALG.selger.valg.map(([v]) => v)).toEqual(["forhandler", "privat"]);
    const etter = (v: string) => SKJERMER[0].ferdig(ENKELTVALG.selger.sett(utkast(), v));
    expect(["forhandler", "privat"].map(etter)).toEqual([true, false]);
    expect(SKJERMER[0].mangler!(ENKELTVALG.selger.sett(utkast(), "privat"))).toBe("Brevet gjelder bare kjøp fra en forhandler.");
  });
  it("forhandler gir privat kjøper", () => {
    expect(ENKELTVALG.selger.sett(utkast(), "forhandler")).toMatchObject({ seller: "forhandler", buyer: "privat" });
    expect(ENKELTVALG.selger.sett(utkast({ seller: "forhandler", buyer: "privat" }), "privat")).toMatchObject({ seller: "privat", buyer: undefined });
    expect(ENKELTVALG.selger.verdi(utkast({ seller: "leasing" }))).toBeUndefined();
  });
  it("bilen stopper ikke: kjøpet krever den i stedet", () => {
    expect(skjerm("bilen").ferdig(utkast())).toBe(true);
    expect(skjerm("bilen").ferdig(utkast({}, { c_reg: "AB 12345" }))).toBe(true);
  });
  it("hver skjerm som kan stoppe, sier hva som mangler", () => {
    for (const sk of SKJERMER) if (sk.id !== "bilen") expect(sk.mangler?.(utkast())).toMatch(/\.$/);
    expect(skjerm("feil").mangler!(utkast())).toBe("Velg minst én feil.");
    expect(skjerm("omrader").mangler!(utkast({}, { f_cats: ["motor"] }))).toBe("Legg inn når du oppdaget feilen for hver feil.");
    expect(skjerm("selger").mangler!(utkast())).toBe("Velg hvem du kjøpte bilen av.");
    expect(skjerm("kravet").mangler!(utkast())).toBe("Velg et krav.");
  });
  it("feilen trenger minst én kategori", () => {
    expect(skjerm("feil").ferdig(utkast())).toBe(false);
    expect(skjerm("feil").ferdig(utkast({}, { f_cats: ["motor"] }))).toBe(true);
  });
  it("om feilen: hvert område trenger datoen det ble oppdaget", () => {
    const f_cats = ["motor", "klima"];
    expect(skjerm("omrader").ferdig(utkast({}, { f_cats, f_area: { motor: { found: "2026-09-01" } } }))).toBe(false);
    expect(skjerm("omrader").ferdig(utkast({}, { f_cats, f_area: { motor: { found: "2026-09-01" }, klima: { found: "" } } }))).toBe(false);
    expect(skjerm("omrader").ferdig(utkast({}, { f_cats, f_area: { motor: { found: "2026-09-01" }, klima: { found: "2026-09-02" } } }))).toBe(true);
  });
  it("«som den er»: ja er et forbehold i skjemaet, vet ikke er det ikke", () => {
    const ja = ENKELTVALG.forbehold.sett(utkast(), "ja");
    expect([ja.asis, ja.skjema.c_asis]).toEqual(["ja", true]);
    const vetikke = ENKELTVALG.forbehold.sett(utkast({}, { c_asis: true }), "vetikke");
    expect([vetikke.asis, vetikke.skjema.c_asis]).toEqual(["vetikke", false]);
  });
  it("virkningen trenger minst ett svar", () => {
    expect(skjerm("virkning").ferdig(utkast())).toBe(false);
    expect(skjerm("virkning").ferdig(utkast({}, { f_impact: ["plagsom"] }))).toBe(true);
  });
  it("kravet trenger hovedkravet", () => {
    expect(skjerm("kravet").ferdig(utkast())).toBe(false);
    expect(skjerm("kravet").ferdig(utkast({}, { k_main: "retting" }))).toBe(true);
  });
});
