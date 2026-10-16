import { describe, expect, it } from "vitest";
import { type BrregEnhet, tilForslag } from "./brreg";

// As Brreg lists Bilia Norge and Birger N Haug in 2026: repair first, the sale of cars second.
const enhet = (koder: string[]): BrregEnhet => ({
  organisasjonsnummer: "999999999",
  navn: "BILHUSET AS",
  organisasjonsform: { kode: "AS" },
  ...Object.fromEntries(koder.map((kode, i) => [`naeringskode${i + 1}`, { kode, beskrivelse: kode }])),
});

describe("næringskoden i forslaget", () => {
  it("er salget når det står som annen eller tredje kode", () => {
    expect(tilForslag(enhet(["95.310", "47.810"])).naeringskode).toBe("47.810");
    expect(tilForslag(enhet(["95.310", "47.820", "46.710"])).naeringskode).toBe("46.710");
  });
  it("er hovedkoden når ingen kode er salg av kjøretøy", () => {
    expect(tilForslag(enhet(["95.310", "47.820"])).naeringskode).toBe("95.310");
    expect(tilForslag(enhet([])).naeringskode).toBeNull();
  });
});
