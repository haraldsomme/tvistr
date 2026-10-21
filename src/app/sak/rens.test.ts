import { describe, expect, it } from "vitest";
import { standard } from "@/lib/app/skjema";
import { rensSvar, rensUtkast } from "./rens";

const svar = { kjopsdato: "2025-03-10", km: 120000, ar: 2017, somDenEr: "nei", krav: null, forsok: null, feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01", beskrivelse: null, opplysning: null, verksted: null, rapport: null }] };

describe("rensSvar", () => {
  it("godtar et gyldig svar", () => expect(rensSvar(svar)).not.toBeNull());
  it("#6 km og årsmodell utenfor området blir null i stedet for å avvise saken", () => {
    expect(rensSvar({ ...svar, km: 2_000_000, ar: 202 })).toMatchObject({ km: null, ar: null });
  });
  it("avviser ukjent kategori", () => expect(rensSvar({ ...svar, feil: [{ ...svar.feil[0], hoved: "x" }] })).toBeNull());
});

describe("rensUtkast", () => {
  const idag = "2026-10-21";
  const skjema = { ...standard(idag), c_reg: "AB 12345", f_cats: ["motor"], f_parts: { motor: ["turbo"] } };
  it("renser skjemaet og tar bare de tre svarene fra sine lister", () => {
    const u = rensUtkast({ skjema: { ...skjema, ukjent: 1 }, seller: "forhandler", buyer: "x", asis: "vetikke", _screen: "result" }, idag)!;
    expect(u.skjema.c_reg).toBe("AB 12345");
    expect(u.skjema).not.toHaveProperty("ukjent");
    expect(u).toEqual({ skjema: u.skjema, seller: "forhandler", asis: "vetikke" });
  });
  it("avviser noe som ikke er et utkast", () => {
    expect(rensUtkast(null, idag)).toBeNull();
    expect(rensUtkast({ seller: "forhandler" }, idag)).toBeNull();
    expect(rensUtkast({ skjema: [1] }, idag)).toBeNull();
  });
  it("avviser ukjente feil", () => {
    expect(rensUtkast({ skjema: { ...skjema, f_cats: ["x"] } }, idag)).toBeNull();
    expect(rensUtkast({ skjema: { ...skjema, f_parts: { motor: ["x"] } } }, idag)).toBeNull();
    expect(rensUtkast({ skjema: { ...skjema, f_parts: { motor: "turbo" } } }, idag)).toBeNull();
  });
});
