import { describe, expect, it } from "vitest";
import { fraSjekk, manglerForKjop, nyttKjop, sakTekst, sammeSak, sjekkTilSvar, tilSvar } from "./saken";
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
    expect(s.feil[0]).toMatchObject({ hoved: "hoyvolt", under: ["kapasitet", "lading"], opplysning: "muntlig", verksted: "skriftlig" });
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

describe("fraSjekk", () => {
  const a = { seller: "forhandler", buyer: "privat", asis: "ja", reg: "AB 12345", make: "Peugeot 308", year: "2014", lastReg: "2026-06-01", km: "120 000", delivery: "2026-06-01", cats: ["motor"], issues: { motor: ["turbo"] }, fdates: { motor: "2026-09-01" }, known: "nei", cause: "slitasje", notified: "ja", notifiedDate: "2026-09-10" } as const;
  it("fyller skjemaet fra sjekken", () => {
    const s = fraSjekk({ ...a, cats: [...a.cats], issues: { motor: [...a.issues.motor] }, fdates: { ...a.fdates } }, standard(idag));
    expect(s).toMatchObject({ c_make: "Peugeot", c_model: "308", c_year: "2014", c_reg: "AB 12345", c_km: "120 000", c_delivery: "2026-06-01", c_lastreg: "2026-06-01", c_asis: true, f_cats: ["motor"], f_parts: { motor: ["turbo"] }, f_cause_check: "slitasje", f_prior: true, f_prior_date: "2026-09-10", k_main: "retting", k_alt: "prisavslag" });
    expect(s.f_area.motor).toEqual({ found: "2026-09-01", impact: [], known: "nei" });
  });
  it("overskriver ikke det som er fylt inn", () => {
    const s = fraSjekk({ make: "Peugeot 308", cats: [] }, { ...standard(idag), c_make: "Volvo", k_main: "heving" });
    expect([s.c_make, s.k_main]).toEqual(["Volvo", "heving"]);
  });
});

describe("rettinger etter gjennomgangen", () => {
  it("#4 selger opplyste om feilen er ikke en uriktig opplysning", () => {
    expect(tilSvar({ ...eksempel(idag), seller_said: "opplyste" })!.feil[0].opplysning).toBeNull();
    expect(tilSvar({ ...eksempel(idag), seller_said: "lovet" })!.feil[0].opplysning).toBe("muntlig");
  });
});

describe("sakTekst", () => {
  it("med og uten saksnummer", () => {
    expect(sakTekst("21/3494", "2022")).toBe("Sak 21/3494 · 2022");
    expect(sakTekst(null, "2022")).toBe("Vedtak 2022");
    expect(sakTekst(null, null)).toBe("Vedtak");
  });
});

describe("låst til kjøpet", () => {
  const a = { reg: "AB 12345", cats: ["motor"], issues: { motor: ["turbo"] } };
  it("krever reg.nr. og en feil før betaling", () => {
    expect(manglerForKjop({ cats: ["motor"] })).toBe("reg");
    expect(manglerForKjop({ reg: "AB 12345", make: "Skoda", cats: [] })).toBe("feil");
    expect(manglerForKjop({ ...a, make: "Skoda Octavia" })).toBeNull();
  });
  it("samme sak: samme bil og samme feil", () => {
    const s = { ...standard(idag), c_reg: "AB 12345", f_cats: ["motor"], f_parts: { motor: ["turbo"] } };
    expect(sammeSak(a, s)).toBe(true);
    expect(sammeSak({ ...a, reg: "CD 67890" }, s)).toBe(false);
    expect(sammeSak({ ...a, cats: ["motor", "klima"] }, s)).toBe(false);
    expect(sammeSak({ ...a, issues: { motor: ["registerreim"] } }, s)).toBe(false);
  });
  it("et nytt kjøp starter et nytt brev, men beholder kjøperen", () => {
    const gammel = { ...standard(idag), b_name: "Kari", c_reg: "AB 12345", c_make: "Volvo", d_name: "Bil AS", f_cats: ["motor"] };
    const ny = nyttKjop({ reg: "CD 67890", make: "Audi A4", cats: ["klima"], issues: { klima: ["ac"] }, fdates: { klima: "2026-09-01" } }, gammel, idag);
    expect([ny.b_name, ny.c_reg, ny.c_make, ny.d_name, ny.f_cats]).toEqual(["Kari", "CD 67890", "Audi", "", ["klima"]]);
  });
});

describe("bilen låst til kjøpet", () => {
  it("krever merke før betaling når oppslaget ikke fant bilen", () => expect(manglerForKjop({ reg: "AB 12345", cats: ["motor"] })).toBe("bil"));
});
