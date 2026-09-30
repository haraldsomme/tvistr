import { describe, expect, it } from "vitest";
import { normaliserFirmanavn, normaliserMerke, normaliserOrgnr, normaliserParagrafer } from "./normalisering";

describe("normalisering", () => {
  it("maps brand aliases to one name", () => {
    expect(normaliserMerke("VW")).toBe("Volkswagen");
    expect(normaliserMerke("volkswagen")).toBe("Volkswagen");
    expect(normaliserMerke("Mercedes Benz")).toBe("Mercedes-Benz");
    expect(normaliserMerke("Citroen")).toBe("Citroën");
    expect(normaliserMerke("lynk & co")).toBe("Lynk & co");
    expect(normaliserMerke("  ")).toBeNull();
  });

  it("strips legal form and punctuation from company names", () => {
    expect(normaliserFirmanavn("Bilsalg Øst AS")).toBe("bilsalg øst");
    expect(normaliserFirmanavn("BILSALG ØST A/S")).toBe("bilsalg øst");
    expect(normaliserFirmanavn("Bilsalg Øst, avd. Ski")).toBe("bilsalg øst");
    expect(normaliserFirmanavn("Møller Bil Asker")).toBe("møller bil asker");
  });

  it("accepts only nine-digit organisation numbers", () => {
    expect(normaliserOrgnr("912 345 678")).toBe("912345678");
    expect(normaliserOrgnr("org.nr. 912345678 MVA")).toBe("912345678");
    expect(normaliserOrgnr("12345")).toBeNull();
  });

  it("reduces section references to law + section", () => {
    expect(
      normaliserParagrafer(
        ["forbrukerkjøpsloven § 16 første ledd bokstav b", "fkjl. § 27", "§ 16", "kjøpsloven § 17", "§§ 32 og 33"],
        "forbrukerkjøpsloven",
      ),
    ).toEqual(["fkjl § 16", "fkjl § 27", "fkjl § 32", "kjl § 17"]);
    expect(normaliserParagrafer(["§ 19 a"], "kjøpsloven")).toEqual(["kjl § 19a"]);
    expect(normaliserParagrafer([], null)).toBeNull();
  });
});
