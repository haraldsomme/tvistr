import { describe, expect, it } from "vitest";
import { forsokTall, gjelderSaken, kjopt, laas, manglerISkjema, nyttPrecValg, rensSkjema, sakTekst, sammeSakSkjema, svarPoster, tilKjop, tilSvar } from "./saken";
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
  it("rettingsforsøk når rangeringen; «3+» er tre, tomt er null", () => {
    expect(tilSvar(eksempel(idag))!.forsok).toBeNull();
    expect(tilSvar({ ...eksempel(idag), k_forsok: "0" })!.forsok).toBe(0);
    expect(tilSvar({ ...eksempel(idag), k_forsok: "2" })!.forsok).toBe(2);
    expect(tilSvar({ ...eksempel(idag), k_forsok: "3+" })!.forsok).toBe(3);
  });
  it("omlevering er ikke et krav for rangeringen", () => expect(tilSvar({ ...eksempel(idag), k_main: "omlevering" })!.krav).toBeNull());
  it("en lagret sak med omlevering åpnes med retting", () => expect(rensSkjema({ ...eksempel(idag), k_main: "omlevering" }, idag)!.k_main).toBe("retting"));
  it("uten datoer gir null", () => expect(tilSvar(standard(idag))).toBeNull());
  it("feil uten dato tas ut", () => {
    const s = eksempel(idag);
    const svar = tilSvar({ ...s, f_cats: ["hoyvolt", "motor"], f_area: { ...s.f_area, motor: { found: "" } } })!;
    expect(svar.feil.map((f) => f.hoved)).toEqual(["hoyvolt"]);
  });
  it("selger sa ingenting", () => expect(tilSvar({ ...eksempel(idag), seller_said: "nei" })!.feil[0].opplysning).toBe("nei"));
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
  it("bil og feil blir som kjøpt; resten kan endres", () => {
    const lagret = { ...standard(idag), c_reg: "AB 12345", c_make: "Volvo", c_model: "V60", c_year: "2017", f_cats: ["motor"], f_parts: { motor: ["turbo"] } };
    const ny = laas(lagret, { ...lagret, c_reg: "CD 67890", c_make: "Audi", c_model: "A4", c_year: "2020", f_cats: ["klima"], f_parts: { klima: ["ac"] }, c_km: "90 000", b_name: "Kari" });
    expect([ny.c_reg, ny.c_make, ny.c_model, ny.c_year, ny.f_cats, ny.f_parts]).toEqual(["AB 12345", "Volvo", "V60", "2017", ["motor"], { motor: ["turbo"] }]);
    expect([ny.c_km, ny.b_name]).toEqual(["90 000", "Kari"]);
  });
  it("svarene gjelder saken: samme årsmodell, bare kjøpte feil", () => {
    const s = { ...eksempel(idag) };
    const svar = tilSvar(s)!;
    expect(gjelderSaken(svar, s)).toBe(true);
    expect(gjelderSaken({ ...svar, ar: 2010 }, s)).toBe(false);
    expect(gjelderSaken({ ...svar, feil: [{ ...svar.feil[0], hoved: "motor" }] }, s)).toBe(false);
    expect(gjelderSaken({ ...svar, feil: [{ ...svar.feil[0], under: ["annet"] }] }, s)).toBe(false);
  });
  it("rettingsforsøk som tall", () => expect(["", "0", "1", "2", "2+", "3+"].map(forsokTall)).toEqual([null, 0, 1, 2, 2, 3]));
  it("rensSkjema: bare kjente felt av riktig type", () => {
    const s = rensSkjema({ b_name: "Kari", c_asis: "ja", ukjent: 1 }, idag)!;
    expect(s.b_name).toBe("Kari");
    expect(s.c_asis).toBe(false);
    expect(s).not.toHaveProperty("ukjent");
    expect(rensSkjema(null, idag)).toBeNull();
    expect(rensSkjema([], idag)).toBeNull();
    expect(rensSkjema({ b_name: "x".repeat(70_000) }, idag)).toBeNull();
  });
  it("rensSkjema: en eldre sak får virkningen samlet og beskrivelsen etter den første feilen", () => {
    const f_area = { motor: { found: "2026-09-01", impact: ["kosmetisk", "bruk"], known: "nei" }, klima: { found: "2026-09-02", impact: ["sikkerhet"], known: "" } };
    const s = rensSkjema({ f_cats: ["motor", "klima"], f_area, f_catdesc: { motor: "Bank i motoren." }, f_desc: "Lampen lyser" }, idag)!;
    expect(s.f_impact).toEqual(["bruk", "sikkerhet"]);
    expect(s.f_catdesc.motor).toBe("Bank i motoren. Lampen lyser");
    expect(rensSkjema({ f_cats: ["motor"], f_area, f_impact: ["plagsom"] }, idag)!.f_impact).toEqual(["plagsom"]);
  });
});

describe("kjøpet fra skjemaet", () => {
  it("krever reg.nr., bilen og en feil før betaling", () => {
    expect(manglerISkjema(standard(idag))).toBe("reg");
    expect(manglerISkjema({ ...standard(idag), c_reg: "AB 12345" })).toBe("bil");
    expect(manglerISkjema({ ...standard(idag), c_reg: "AB 12345", c_make: "Skoda" })).toBe("feil");
    expect(manglerISkjema({ ...standard(idag), c_reg: "AB 12345", c_make: "Skoda", f_cats: ["motor"] })).toBeNull();
    expect(manglerISkjema({ ...standard(idag), c_reg: "AB 12345", c_make: "  ", f_cats: ["motor"] })).toBe("bil");
  });
  it("samme sak: samme bil og samme feil", () => {
    const s = { ...standard(idag), c_reg: "AB 12345", f_cats: ["motor"], f_parts: { motor: ["turbo", "olje"] } };
    const k = kjopt("abcdefghijkm", { ...s, f_parts: { motor: ["olje", "turbo"] } });
    expect(sammeSakSkjema(s, k)).toBe(true);
    expect(sammeSakSkjema(s, { ...k, id: "" })).toBe(false);
    expect(sammeSakSkjema({ ...s, c_reg: "CD 67890" }, k)).toBe(false);
    expect(sammeSakSkjema({ ...s, f_cats: ["motor", "klima"] }, k)).toBe(false);
    expect(sammeSakSkjema({ ...s, f_parts: { motor: ["registerreim"] } }, k)).toBe(false);
  });
  it("utkastet kjøpes, med kjøperen fra forrige sak der utkastet ikke har den", () => {
    const ny = tilKjop({ ...standard(idag), d_name: "X", b_email: "ny@eksempel.no" }, { ...standard(idag), b_name: "Kari", b_email: "kari@eksempel.no", d_name: "Bil AS" });
    expect([ny.b_name, ny.b_email, ny.d_name]).toEqual(["Kari", "ny@eksempel.no", "X"]);
    expect(tilKjop({ ...standard(idag), d_name: "X" }, null).d_name).toBe("X");
  });
});

describe("nyttPrecValg", () => {
  const valg = [{ id: 1 }, { id: 2 }, { id: 3 }];
  it("følger det anbefalte når brukeren ikke har valgt selv", () => {
    expect(nyttPrecValg({ prec_id: 2, prec_selv: false }, valg)).toEqual({ endre: { prec_id: 1 }, utfall: "fulgt" });
    expect(nyttPrecValg({ prec_id: 1, prec_selv: false }, valg)).toEqual({ endre: null, utfall: "fulgt" });
  });
  it("beholder brukerens eget valg når det fortsatt er i listen", () => {
    expect(nyttPrecValg({ prec_id: 3, prec_selv: true }, valg)).toEqual({ endre: null, utfall: "beholdt" });
  });
  it("går til det anbefalte når brukerens valg er borte", () => {
    expect(nyttPrecValg({ prec_id: 9, prec_selv: true }, valg)).toEqual({ endre: { prec_id: 1, prec_selv: false }, utfall: "borte" });
  });
  it("gjør ingenting uten en liste", () => {
    expect(nyttPrecValg({ prec_id: 9, prec_selv: true }, [])).toEqual({ endre: null, utfall: "fulgt" });
  });
});

describe("tilSvar med en feil datert for seg", () => {
  it("én rad per feil, med sin dato", () => {
    const s = { ...standard("2026-10-23"), c_delivery: "2024-01-15", f_cats: ["motor"], f_parts: { motor: ["utslipp", "turbo"] }, f_area: { motor: { found: "2024-04-02" } }, f_under: { "motor.turbo": { found: "2025-02-18", desc: "" } } };
    expect(tilSvar(s)!.feil.map((f) => [f.hoved, f.under, f.oppdaget])).toEqual([["motor", ["turbo"], "2025-02-18"], ["motor", ["utslipp"], "2024-04-02"]]);
  });
});

describe("svarPoster", () => {
  it("bare feilene med dato, i den rekkefølgen tilSvar sender dem", () => {
    const e = eksempel("2026-10-16");
    const s = { ...e, f_cats: ["klima", "hoyvolt"], f_parts: { ...e.f_parts, klima: ["ac"] }, f_area: { hoyvolt: e.f_area.hoyvolt, klima: { found: "" } } };
    expect(svarPoster(s).map((p) => p.nokkel)).toEqual(["hoyvolt"]);
    expect(tilSvar(s)!.feil.map((f) => f.hoved)).toEqual(svarPoster(s).map((p) => p.hoved));
  });
});
