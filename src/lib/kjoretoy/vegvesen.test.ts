import { describe, expect, it } from "vitest";
import { lesKjoretoy, normaliserRegnr } from "./vegvesen";

// Made-up vehicle in the shape Statens vegvesen answers with; only the fields we read.
const svar = (endring: Record<string, unknown> = {}) => ({
  kjoretoydataListe: [
    {
      kjoretoyId: { kjennemerke: "ZZ 99999" },
      forstegangsregistrering: { registrertForstegangNorgeDato: "2021-03-15" },
      godkjenning: {
        forstegangsGodkjenning: { forstegangRegistrertDato: "2019-06-01" },
        tekniskGodkjenning: { tekniskeData: { generelt: { merke: [{ merke: "TESTMERKE" }], handelsbetegnelse: ["Modell X"] } } },
      },
      ...endring,
    },
  ],
});

describe("normaliserRegnr", () => {
  it("fjerner mellomrom og bindestrek og gjør om til store bokstaver", () => {
    expect(normaliserRegnr(" zz 99999 ")).toBe("ZZ99999");
    expect(normaliserRegnr("zz-99999")).toBe("ZZ99999");
  });

  it("godtar korte og personlige skilt", () => {
    expect(normaliserRegnr("ab1234")).toBe("AB1234");
    expect(normaliserRegnr("bilen")).toBe("BILEN");
  });

  it("avviser tomt, for kort, for langt og andre tegn", () => {
    for (const s of ["", "A", "ABCDEFGH", "AB_123", "AB123?", "<b>"]) expect(normaliserRegnr(s)).toBeNull();
  });
});

describe("lesKjoretoy", () => {
  it("leser skilt, merke, modell og året bilen først ble registrert", () => {
    expect(lesKjoretoy(svar())).toEqual({ regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2019 });
  });

  it("skriver korte merkenavn og merker med flere ord pent", () => {
    const med = (merke: string) => {
      const s = svar();
      s.kjoretoydataListe[0].godkjenning.tekniskGodkjenning.tekniskeData.generelt.merke = [{ merke }];
      return lesKjoretoy(s)?.merke;
    };
    expect(med("BMW")).toBe("BMW");
    expect(med("VOLKSWAGEN")).toBe("Volkswagen");
    expect(med("LAND ROVER")).toBe("Land Rover");
    expect(med("MERCEDES-BENZ")).toBe("Mercedes-Benz");
    expect(med("Tesla")).toBe("Tesla");
  });

  it("bruker registreringen i Norge når første registrering mangler", () => {
    const s = svar();
    s.kjoretoydataListe[0].godkjenning.forstegangsGodkjenning = {} as never;
    expect(lesKjoretoy(s)?.ar).toBe(2021);
  });

  it("gir null år når ingen dato finnes", () => {
    const s = svar({ forstegangsregistrering: {} });
    s.kjoretoydataListe[0].godkjenning.forstegangsGodkjenning = {} as never;
    expect(lesKjoretoy(s)?.ar).toBeNull();
  });

  it("gir null når svaret mangler kjøretøy eller merke", () => {
    expect(lesKjoretoy(null)).toBeNull();
    expect(lesKjoretoy({})).toBeNull();
    expect(lesKjoretoy({ kjoretoydataListe: [] })).toBeNull();
    const s = svar();
    s.kjoretoydataListe[0].godkjenning.tekniskGodkjenning.tekniskeData.generelt.merke = [];
    expect(lesKjoretoy(s)).toBeNull();
  });
});
