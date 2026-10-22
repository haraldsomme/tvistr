import { describe, expect, it } from "vitest";
import { ANDRE_LOVER, LOVORD, lovRef, lovversjon, PARAGRAFER, paragraf, POENG, RENTER_FRA_REKLAMASJON } from "./paragrafer";

const VERSJONER = ["før_2024", "etter_2024"] as const;

describe("paragraftabellene", () => {
  it("har alle poengene i begge versjonene", () => {
    for (const v of VERSJONER) expect(Object.keys(PARAGRAFER[v]).sort()).toEqual([...POENG].sort());
  });

  it("har et nummer eller et erklært gap for hvert poeng, aldri en tom streng", () => {
    for (const v of VERSJONER)
      for (const p of POENG) {
        const par = paragraf(v, p);
        expect(par === null || /^§§? \d+( [a-z])?( og \d+)?( (første|annet|tredje|fjerde) ledd)?( bokstav [a-d])?( (første|annet|tredje) punktum)?$/.test(par), `${v} ${p}: ${par}`).toBe(true);
      }
  });

  it("peker på den gamle § 17 før 2024 og § 15 annet ledd etterpå", () => {
    expect(paragraf("før_2024", "forbehold")).toBe("§ 17 første ledd bokstav a");
    expect(paragraf("etter_2024", "forbehold")).toBe("§ 15 annet ledd");
  });

  it("renter ved tilbakebetaling og tilbakeholdsrett står i tabellen", () => {
    for (const v of VERSJONER) {
      expect(paragraf(v, "renter_heving")).toBe("§ 50 annet ledd");
      expect(paragraf(v, "tilbakehold")).toBe("§ 28");
    }
    expect(RENTER_FRA_REKLAMASJON.etter_2024).toBe(true);
    expect(RENTER_FRA_REKLAMASJON.før_2024).toBe(false);
    expect(ANDRE_LOVER.forsinkelsesrente).toBe("forsinkelsesrenteloven § 2");
  });

  it("nevner bare forbrukerkjøpsloven når nummeret er et gap", () => {
    const original = PARAGRAFER.etter_2024.garanti_lov;
    PARAGRAFER.etter_2024.garanti_lov = null;
    try {
      expect(lovRef("etter_2024", "garanti_lov")).toBe("forbrukerkjøpsloven");
    } finally {
      PARAGRAFER.etter_2024.garanti_lov = original;
    }
    expect(lovRef("etter_2024", "avvik")).toBe("forbrukerkjøpsloven § 16 første ledd bokstav a");
  });
});

describe("avhjelp etter lovversjon (Lovdata og Prop. 49 LS, 2026-10-18)", () => {
  it("to forsøk etter gamle § 30 annet ledd, ett etter § 30 fjerde ledd", () => {
    expect(paragraf("før_2024", "avhjelp_avvise")).toBe("§ 30 annet ledd");
    expect(paragraf("etter_2024", "avhjelp_avvise")).toBe("§ 30 fjerde ledd");
  });
  it("umiddelbar heving og plikten til å stille bilen til rådighet finnes bare fra 2024", () => {
    expect(paragraf("før_2024", "avhjelp_umiddelbart")).toBeNull();
    expect(paragraf("etter_2024", "avhjelp_umiddelbart")).toBe("§ 29 tredje ledd tredje punktum");
    expect(paragraf("før_2024", "rad")).toBeNull();
    expect(paragraf("etter_2024", "rad")).toBe("§ 30 annet ledd");
  });
  it("erstatningsbil: en rett etter gamle § 30 tredje ledd, et moment etter § 30 første ledd", () => {
    expect(paragraf("før_2024", "erstatningsbil")).toBe("§ 30 tredje ledd");
    expect(paragraf("etter_2024", "erstatningsbil")).toBe("§ 30 første ledd annet punktum");
  });
  it("unntaket fra formodningen flyttet fra annet til tredje punktum", () => {
    expect(paragraf("før_2024", "formodning_unntak")).toBe("§ 18 annet ledd annet punktum");
    expect(paragraf("etter_2024", "formodning_unntak")).toBe("§ 18 annet ledd tredje punktum");
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
  it("bruker lovens egne ord for unntaket fra formodningen", () => {
    expect(LOVORD.uforenlig).toBe("uforenlig med varens eller mangelens art");
  });
});
