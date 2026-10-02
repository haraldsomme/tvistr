import { describe, expect, it } from "vitest";
import { erSakId, lesEndring, medEndring, tilpassTilSvar, utloperEtter } from "./utfylling";

const BIL = { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2019 };
const ADRESSE = { linjer: ["Industriveien 3"], postnummer: "0184", poststed: "Oslo" };
const FORHANDLER = { type: "brreg", orgnr: "999888777", navn: "Testbil AS", adresse: ADRESSE };

// Bought 12 March 2026; today is 2 October 2026.
const K = { svar: { kjopsdato: "2026-03-12" }, idag: "2026-10-02" };
const ok = (raw: unknown) => lesEndring(raw, K).ok;

const lest = (raw: unknown) => {
  const r = lesEndring(raw, K);
  return r.ok ? r.endring : null;
};

describe("lesEndring", () => {
  it("godtar kjøretøy og forhandler slik oppslagene gir dem", () => {
    expect(lest({ kjoretoy: BIL })).toEqual({ kjoretoy: BIL });
    expect(lest({ forhandler: FORHANDLER })).toEqual({ forhandler: FORHANDLER });
    expect(lest({ kjoretoy: { ...BIL, ar: null } })).toEqual({ kjoretoy: { ...BIL, ar: null } });
  });

  it("godtar forhandler uten adresse og forhandler skrevet for hånd", () => {
    expect(lest({ forhandler: { type: "brreg", orgnr: "999 888 777", navn: "Testbil AS" } })).toEqual({ forhandler: { type: "brreg", orgnr: "999888777", navn: "Testbil AS" } });
    expect(lest({ forhandler: { type: "fritekst", navn: "  Bilsalget  " } })).toEqual({ forhandler: { type: "fritekst", navn: "Bilsalget" } });
  });

  it("lar null tømme et felt", () => {
    expect(lest({ kjoretoy: null, forhandler: null })).toEqual({ kjoretoy: null, forhandler: null });
  });

  it("dropper felt som ikke hører til verdien", () => {
    expect(lest({ kjoretoy: { ...BIL, ekstra: "x" } })).toEqual({ kjoretoy: BIL });
  });

  it("gjør hakeparenteser og linjeskift ufarlige, siden brevet bruker hakeparentes for det som mangler", () => {
    expect(lest({ forhandler: { type: "fritekst", navn: "Bil [Oslo]\nAS" } })).toEqual({ forhandler: { type: "fritekst", navn: "Bil (Oslo) AS" } });
  });

  it("avviser ukjente felt og alt som ikke er et objekt", () => {
    for (const raw of [null, "x", [], { navn: "x" }, { __proto__: null, constructor: 1 }]) expect(ok(raw)).toBe(false);
  });

  it("avviser ugyldige kjøretøy", () => {
    for (const k of [{}, "x", { ...BIL, regnr: "<script>" }, { ...BIL, merke: "" }, { ...BIL, modell: "x".repeat(61) }, { ...BIL, ar: 1800 }, { ...BIL, ar: "2019" }, { regnr: BIL.regnr, merke: "A", modell: "B" }]) {
      expect(ok({ kjoretoy: k })).toBe(false);
    }
  });

  it("avviser ugyldige forhandlere", () => {
    for (const f of [
      {},
      { type: "privat", navn: "x" },
      { type: "fritekst", navn: "a" },
      { type: "fritekst", navn: "x".repeat(101) },
      { type: "brreg", orgnr: "12345", navn: "Testbil AS" },
      { ...FORHANDLER, adresse: { ...ADRESSE, postnummer: "184" } },
      { ...FORHANDLER, adresse: { ...ADRESSE, linjer: ["a", "b", "c", "d"] } },
      { ...FORHANDLER, adresse: { ...ADRESSE, poststed: "" } },
      { ...FORHANDLER, adresse: "Industriveien 3" },
    ]) {
      expect(ok({ forhandler: f })).toBe(false);
    }
  });

  it("avviser hele lagringen når ett felt er ugyldig", () => {
    expect(ok({ kjoretoy: BIL, forhandler: {} })).toBe(false);
  });
});

describe("feilen", () => {
  const f = { dato: "2026-09-02", egen: "Motorlampen lyser og bilen mister kraft i motbakker.", tekst: "Motorlampen lyser, og bilen mister trekkraft i motbakker." };

  it("godtar dato, egen beskrivelse og teksten til brevet", () => {
    expect(lest({ feilen: f })).toEqual({ feilen: f });
  });

  it("avviser dato før kjøpet eller i fremtiden, og for korte eller lange tekster", () => {
    for (const x of [{ ...f, dato: "2026-03-11" }, { ...f, dato: "2026-10-03" }, { ...f, egen: "For kort" }, { ...f, tekst: "x".repeat(1501) }, { dato: f.dato, egen: f.egen }]) {
      expect(ok({ feilen: x })).toBe(false);
    }
  });
});

describe("opplysning før kjøpet", () => {
  it("godtar kilde og tekst, og avviser ukjent kilde eller tom tekst", () => {
    expect(lest({ opplysning: { kilde: "annonse", tekst: "Bilen hadde ny clutch." } })).toEqual({ opplysning: { kilde: "annonse", tekst: "Bilen hadde ny clutch." } });
    expect(ok({ opplysning: { kilde: "radio", tekst: "Bilen hadde ny clutch." } })).toBe(false);
    expect(ok({ opplysning: { kilde: "annonse", tekst: "x" } })).toBe(false);
  });
});

describe("reklamasjon", () => {
  it("godtar dato og måte, med og uten antall rettingsforsøk", () => {
    expect(lest({ reklamasjon: { dato: "2026-09-03", mate: "epost" } })).toEqual({ reklamasjon: { dato: "2026-09-03", mate: "epost" } });
    expect(lest({ reklamasjon: { dato: "2026-09-03", mate: "oppmote", forsok: 2 } })).toEqual({ reklamasjon: { dato: "2026-09-03", mate: "oppmote", forsok: 2 } });
  });

  it("avviser dato før kjøpet eller i fremtiden, ukjent måte og urimelig antall forsøk", () => {
    for (const r of [{ dato: "2026-03-11", mate: "epost" }, { dato: "2026-11-01", mate: "epost" }, { dato: "2026-09-03", mate: "fax" }, { dato: "2026-09-03", mate: "epost", forsok: 0 }, { dato: "2026-09-03", mate: "epost", forsok: 2.5 }]) {
      expect(ok({ reklamasjon: r })).toBe(false);
    }
  });
});

describe("krav", () => {
  it("godtar valg, utbedringskostnad og utgifter", () => {
    const k = { type: "prisavslag", utbedringNok: 38000, utgifter: [{ type: "verksted", belopNok: 4500 }, { type: "tauing", belopNok: 2000 }] };
    expect(lest({ krav: k })).toEqual({ krav: k });
    expect(lest({ krav: { utgifter: [] } })).toEqual({ krav: { utgifter: [] } });
    expect(lest({ krav: { type: "heving", utgifter: [] } })).toEqual({ krav: { type: "heving", utgifter: [] } });
  });

  it("avviser ukjent krav, ugyldige beløp og for mange utgifter", () => {
    for (const k of [
      {},
      { type: "omlevering", utgifter: [] },
      { utbedringNok: 0, utgifter: [] },
      { utbedringNok: 1.5, utgifter: [] },
      { utgifter: [{ type: "verksted", belopNok: -1 }] },
      { utgifter: [{ type: "gave", belopNok: 100 }] },
      { utgifter: [{ type: "verksted", belopNok: "100" }] },
      { utgifter: Array.from({ length: 9 }, () => ({ type: "annet", belopNok: 1 })) },
    ]) {
      expect(ok({ krav: k })).toBe(false);
    }
  });
});

describe("vedlegg", () => {
  it("godtar kjente vedlegg, én gang hver, i fast rekkefølge, også ingen", () => {
    expect(lest({ vedlegg: ["bilder", "kjopekontrakt", "bilder"] })).toEqual({ vedlegg: ["kjopekontrakt", "bilder"] });
    expect(lest({ vedlegg: [] })).toEqual({ vedlegg: [] });
  });

  it("avviser ukjente vedlegg", () => {
    expect(ok({ vedlegg: ["pass"] })).toBe(false);
    expect(ok({ vedlegg: "bilder" })).toBe(false);
  });
});

describe("avsender", () => {
  const a = { navn: "Test Testesen", adresse: "Testveien 1", postnummer: "0184", poststed: "Oslo" };

  it("godtar navn og adresse, med og uten telefon", () => {
    expect(lest({ avsender: a })).toEqual({ avsender: a });
    expect(lest({ avsender: { ...a, telefon: "" } })).toEqual({ avsender: a });
    expect(lest({ avsender: { ...a, telefon: " 400  00 000 " } })).toEqual({ avsender: { ...a, telefon: "400 00 000" } });
  });

  it("avviser manglende felt, ugyldig postnummer og ugyldig telefon", () => {
    for (const x of [{ ...a, navn: "" }, { ...a, adresse: "x" }, { ...a, postnummer: "184" }, { ...a, postnummer: 184 }, { ...a, poststed: "" }, { ...a, telefon: "ring meg" }, { ...a, telefon: "123" }]) {
      expect(ok({ avsender: x })).toBe(false);
    }
  });
});

describe("medEndring", () => {
  it("erstatter endrede felt, fjerner tømte og lar resten stå", () => {
    const u = { kjoretoy: BIL, forhandler: { type: "fritekst" as const, navn: "Bilsalget" } };
    expect(medEndring(u, { forhandler: null })).toEqual({ kjoretoy: BIL });
    expect(medEndring(u, { kjoretoy: { ...BIL, ar: 2020 } })).toEqual({ ...u, kjoretoy: { ...BIL, ar: 2020 } });
    expect(medEndring({}, {})).toEqual({});
  });
});

describe("tilpassTilSvar", () => {
  const feilen = { dato: "2026-09-02", egen: "Motorlampen lyser hele tiden.", tekst: "Motorlampen lyser hele tiden." };
  const u = { kjoretoy: BIL, feilen, reklamasjon: { dato: "2026-09-03", mate: "epost" as const } };

  it("beholder datoer som fortsatt passer", () => {
    expect(tilpassTilSvar(u, { kjopsdato: "2026-09-02" }, "2026-10-02")).toEqual(u);
  });

  it("fjerner datoer før den nye kjøpsdatoen, og lar resten stå", () => {
    expect(tilpassTilSvar(u, { kjopsdato: "2026-09-03" }, "2026-10-02")).toEqual({ kjoretoy: BIL, reklamasjon: u.reklamasjon });
    expect(tilpassTilSvar(u, { kjopsdato: "2026-10-01" }, "2026-10-02")).toEqual({ kjoretoy: BIL });
  });

  it("fjerner datoer som er etter i dag", () => {
    expect(tilpassTilSvar(u, { kjopsdato: "2026-03-12" }, "2026-09-02")).toEqual({ kjoretoy: BIL, feilen });
  });

  it("endrer ikke det som ble gitt inn", () => {
    const original = structuredClone(u);
    tilpassTilSvar(u, { kjopsdato: "2026-10-01" }, "2026-10-02");
    expect(u).toEqual(original);
  });
});

describe("sak-id og utløp", () => {
  it("godtar bare 22 tegn base64url", () => {
    expect(erSakId("AbCdEfGhIjKlMnOpQrStU_")).toBe(true);
    for (const s of ["", "kort", "AbCdEfGhIjKlMnOpQrStU_x", "AbCdEfGhIjKlMnOpQrSt/+", "../../../etc/passwd....."]) expect(erSakId(s)).toBe(false);
  });

  it("utløper 30 dager etter siste endring", () => {
    expect(utloperEtter(new Date("2026-10-02T12:00:00Z")).toISOString()).toBe("2026-11-01T12:00:00.000Z");
  });
});
