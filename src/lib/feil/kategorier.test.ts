import { describe, expect, it } from "vitest";
import { erOpplysning, HOVEDKATEGORIER } from "./kategorier";

describe("HOVEDKATEGORIER", () => {
  it("har unike id-er, og unike underkategorier per hovedkategori", () => {
    expect(new Set(HOVEDKATEGORIER.map((h) => h.id)).size).toBe(HOVEDKATEGORIER.length);
    for (const h of HOVEDKATEGORIER) expect(new Set(h.under.map((u) => u.id)).size).toBe(h.under.length);
  });
});

describe("erOpplysning", () => {
  it("gjelder det selgeren sa eller lovet, ikke deler som svikter", () => {
    expect(erOpplysning("historikk", "km")).toBe(true);
    expect(erOpplysning("utstyr", "utstyr")).toBe(true);
    expect(erOpplysning("utstyr", "dekk")).toBe(false);
    expect(erOpplysning("motor", "turbo")).toBe(false);
    expect(erOpplysning("vet_ikke", "lyd")).toBe(false);
  });

  it("gjelder en hovedkategori bare når alle underkategoriene gjør det", () => {
    expect(erOpplysning("historikk", null)).toBe(true);
    expect(erOpplysning("service", null)).toBe(true);
    expect(erOpplysning("garanti", null)).toBe(true);
    expect(erOpplysning("utstyr", null)).toBe(false);
    expect(erOpplysning("motor", null)).toBe(false);
    expect(erOpplysning("vet_ikke", null)).toBe(false);
    expect(erOpplysning("finnes_ikke", null)).toBe(false);
  });
});
