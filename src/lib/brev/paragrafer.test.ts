import { describe, expect, it } from "vitest";
import { jf, LOVORD, lovRef, lovversjon, PARAGRAFER, paragraf, POENG } from "./paragrafer";

const VERSJONER = ["før_2024", "etter_2024"] as const;

describe("paragraftabellene", () => {
  it("har alle poengene i begge versjonene", () => {
    for (const v of VERSJONER) expect(Object.keys(PARAGRAFER[v]).sort()).toEqual([...POENG].sort());
  });

  it("har et nummer eller et erklært gap for hvert poeng, aldri en tom streng", () => {
    for (const v of VERSJONER)
      for (const p of POENG) {
        const par = paragraf(v, p);
        expect(par === null || /^§§? \d+( [a-z])?( og \d+)?( (første|annet|tredje) ledd)?( bokstav [a-d])?( (første|annet) punktum)?$/.test(par), `${v} ${p}: ${par}`).toBe(true);
      }
  });

  it("peker på den gamle § 17 før 2024 og § 15 annet ledd etterpå", () => {
    expect(paragraf("før_2024", "forbehold")).toBe("§ 17 første ledd bokstav a");
    expect(paragraf("etter_2024", "forbehold")).toBe("§ 15 annet ledd");
  });

  it("nevner bare forbrukerkjøpsloven når nummeret er et gap", () => {
    const original = PARAGRAFER.etter_2024.garanti;
    PARAGRAFER.etter_2024.garanti = null;
    try {
      expect(lovRef("etter_2024", "garanti")).toBe("forbrukerkjøpsloven");
      expect(jf("etter_2024", "garanti")).toBe("");
      expect(jf("etter_2024", "krav", "garanti")).toBe(", jf. § 15");
    } finally {
      PARAGRAFER.etter_2024.garanti = original;
    }
    expect(lovRef("etter_2024", "avvik")).toBe("forbrukerkjøpsloven § 16 første ledd bokstav a");
    expect(jf("etter_2024", "krav", "garanti")).toBe(", jf. § 15 og § 18 a");
  });
});

describe("lovversjon", () => {
  it("skiller på 1. januar 2024", () => {
    expect(lovversjon("2023-12-31")).toBe("før_2024");
    expect(lovversjon("2024-01-01")).toBe("etter_2024");
  });
  it("antar gjeldende lov uten kjøpsdato", () => {
    expect(lovversjon(null)).toBe("etter_2024");
  });
});

describe("lovord", () => {
  it("bruker lovens egne ord for vilkåret i § 15 annet ledd", () => {
    expect(LOVORD.avtaltUnntak).toContain("spesielt opplyst");
    expect(LOVORD.avtaltUnntak).toContain("uttrykkelig og særskilt aksepterte");
  });
});
