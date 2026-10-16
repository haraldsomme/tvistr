import { describe, expect, it } from "vitest";
import { sjekkTilSvar, tilSvar } from "./saken";
import { eksempel, standard } from "./skjema";

const idag = "2026-10-16";

describe("tilSvar", () => {
  it("eksempelet", () => {
    const s = tilSvar(eksempel(idag))!;
    expect(s.kjopsdato).toBe(eksempel(idag).c_purchase);
    expect(s.km).toBe(38500);
    expect(s.ar).toBe(2022);
    expect(s.krav).toBe("retting");
    expect(s.somDenEr).toBe("nei");
    expect(s.feil).toHaveLength(1);
    expect(s.feil[0]).toMatchObject({ hoved: "hoyvolt", under: ["kapasitet", "lading"], opplysning: "skriftlig", verksted: "skriftlig" });
    expect(s.feil[0].rapport?.punkter).toEqual(["bekrefter", "arsak", "ikke_slitasje"]);
  });
  it("omlevering blir retting", () => expect(tilSvar({ ...eksempel(idag), k_main: "omlevering" })!.krav).toBe("retting"));
  it("uten datoer gir null", () => expect(tilSvar(standard(idag))).toBeNull());
  it("feil uten dato tas ut", () => {
    const s = eksempel(idag);
    const svar = tilSvar({ ...s, f_cats: ["hoyvolt", "motor"], f_area: { ...s.f_area, motor: { found: "", impact: [], known: "" } } })!;
    expect(svar.feil.map((f) => f.hoved)).toEqual(["hoyvolt"]);
  });
  it("selger sa ingenting", () => expect(tilSvar({ ...eksempel(idag), seller_said: "nei" })!.feil[0].opplysning).toBe("nei"));
});

describe("sjekkTilSvar", () => {
  it("sjekkens svar", () => {
    const s = sjekkTilSvar({ delivery: "2026-06-01", km: "120 000", year: "2014", asis: "vetikke", cats: ["motor"], issues: { motor: ["turbo"] }, fdates: { motor: "2026-09-01" } })!;
    expect(s).toMatchObject({ kjopsdato: "2026-06-01", km: 120000, ar: 2014, somDenEr: null, krav: null });
    expect(s.feil).toEqual([{ hoved: "motor", under: ["turbo"], oppdaget: "2026-09-01", beskrivelse: null, opplysning: null, verksted: null, rapport: null }]);
  });
  it("uten overtakelse gir null", () => expect(sjekkTilSvar({ cats: ["motor"], fdates: { motor: "2026-09-01" } })).toBeNull());
});
