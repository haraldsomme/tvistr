import { describe, expect, it } from "vitest";
import { gjenstaende, rens, TOM_ID } from "./rens";

const id = {
  klager: ["Ola Nordmann"],
  personer: ["Kari Hansen", "Per Olsen"],
  adresser: ["Storgata 1, 0150 Oslo"],
  andre: [],
};

describe("rens", () => {
  it("replaces party header lines, keeping only a company respondent's name", () => {
    const tekst = [
      "Klager: Ola Nordmann, Storgata 1, 0150 Oslo",
      "Fullmektig: Advokat Kari Hansen, Advokatfirmaet Lov AS",
      "Innklaget: Bilsalg Øst AS, Industriveien 5, 1400 Ski",
    ].join("\n");
    expect(rens(tekst, TOM_ID, { selgerErFirma: true })).toBe(
      ["Klager: [KLAGER]", "Fullmektig: [PERSON]", "Innklaget: Bilsalg Øst AS, [ADRESSE]"].join("\n"),
    );
  });

  it("hides a private seller in the header", () => {
    expect(rens("Innklaget: Per Olsen, Vei 2, 1234 Sted", TOM_ID, { selgerErFirma: false })).toBe(
      "Innklaget: [PERSON], [ADRESSE]",
    );
  });

  it("replaces full names, surnames alone, genitive forms and names split across lines", () => {
    const tekst = "Nordmann kjøpte bilen. Ola\nNordmann klaget. Nordmanns krav ble avvist av Hansen.";
    expect(rens(tekst, id)).toBe("[KLAGER] kjøpte bilen. [KLAGER] klaget. [KLAGER] krav ble avvist av [PERSON].");
  });

  it("does not replace lowercase words that equal a first name", () => {
    expect(rens("Per 1. januar kjøpte Per Olsen bilen, per telefon.", id)).toBe(
      "[PERSON] 1. januar kjøpte [PERSON] bilen, per telefon.",
    );
  });

  it("keeps company names that are not in the list", () => {
    expect(rens("Verkstedet Mekk AS fant feil på girkassen.", id)).toBe("Verkstedet Mekk AS fant feil på girkassen.");
  });

  it("removes registration numbers, VINs, phone numbers, e-mails and national ids", () => {
    const tekst =
      "Bilen med registreringsnummer AB 12345 (EL12345), VIN WVWZZZ1KZAW123456, tlf 912 34 567 / 91234567, e-post ola@example.no, fnr 01018012345.";
    expect(rens(tekst, TOM_ID)).toBe(
      "Bilen med registreringsnummer [REGNR] ([REGNR]), VIN [VIN], tlf [TELEFON] / [TELEFON], e-post [E-POST], fnr [FØDSELSNUMMER].",
    );
  });

  it("leaves amounts, dates and model years alone", () => {
    const tekst = "Kjøpesummen var kr 189 900 den 12.03.2022 for en 2015-modell med 145 000 km.";
    expect(rens(tekst, TOM_ID)).toBe(tekst);
  });

  it("reports identifiers that survive redaction", () => {
    expect(gjenstaende(rens("Ola Nordmann og Kari Hansen", id), id)).toEqual([]);
    expect(gjenstaende("Kari Hansen", id)).toEqual(["Kari Hansen"]);
  });
});
