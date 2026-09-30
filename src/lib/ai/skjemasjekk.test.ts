import { describe, expect, it } from "vitest";
import { sjekkSkjema } from "./skjemasjekk";
import { fraModell, KLASSIFISERING_SKJEMA, TOLKNING_SKJEMA } from "./skjema";

describe("sjekkSkjema", () => {
  it("accepts a valid classification and rejects wrong enums, types and extra fields", () => {
    expect(sjekkSkjema(KLASSIFISERING_SKJEMA, { kategori: "brukt_kjoretoy", kjoretoytype: "bobil", begrunnelse: "x" })).toEqual([]);
    expect(sjekkSkjema(KLASSIFISERING_SKJEMA, { kategori: "fly", kjoretoytype: "bobil", begrunnelse: 1, ekstra: true })).toEqual([
      '$.kategori: "fly" er ikke en gyldig verdi',
      "$.begrunnelse: forventet tekst",
      "$.ekstra: ukjent felt",
    ]);
  });

  it("treats null as not stated for strings and nullable numbers, but rejects wrong types", () => {
    const feil = sjekkSkjema(TOLKNING_SKJEMA, { arsmodell: null, merke: null, km_ved_kjop: "mange" });
    expect(feil).not.toContain("$.arsmodell: passer ikke noen av variantene");
    expect(feil).not.toContain("$.merke: forventet tekst");
    expect(feil).toContain("$.km_ved_kjop: passer ikke noen av variantene");
  });

  it("reads missing, empty and single-value lists as lists", () => {
    for (const forbehold of [null, "", [""], "som_den_er", ["som_den_er"]]) {
      expect(sjekkSkjema(TOLKNING_SKJEMA, { forbehold }).filter((f) => /^\$\.forbehold[:[]/.test(f))).toEqual([]);
    }
    // Unknown vocabulary values are tolerated here and dropped by fraModell.
    expect(sjekkSkjema(TOLKNING_SKJEMA, { kravtyper: ["heving", "annet"] }).filter((f) => /^\$\.kravtyper[:[]/.test(f))).toEqual([]);
    expect(sjekkSkjema(TOLKNING_SKJEMA, { kravtyper: [1] }).filter((f) => /^\$\.kravtyper[:[]/.test(f))).toEqual(["$.kravtyper[0]: forventet tekst"]);
  });
});

describe("fraModell", () => {
  it("turns empty strings and 'ukjent' in optional enums into null, but keeps lovversjon", () => {
    expect(fraModell({ merke: "", drivstoff: "ukjent", lovversjon: "ukjent", forbehold: null, kravtyper: ["heving", "annet"], sitater: { utfall: "", selger_type: "x", forbehold: "som den er" } })).toEqual({
      merke: null,
      forbehold: [],
      kravtyper: ["heving"],
      drivstoff: null,
      lovversjon: "ukjent",
      sitater: { utfall: null, selger_type: "x", forbehold: "som den er" },
    });
  });
});
