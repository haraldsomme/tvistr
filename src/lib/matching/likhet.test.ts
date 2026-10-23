import { describe, expect, it } from "vitest";
import { likhet } from "./likhet";
import { type Rangert, sakForFeil } from "./ranger";
import type { Brukersak } from "./typer";

const sak = (under: string[], svar: Partial<Brukersak> = {}): Brukersak => ({
  kategorier: [{ hoved: "motor", under, niva: 1, opplysning: null, verksted: null }],
  km: 120000,
  alder: 8,
  somDenEr: false,
  krav: "retting",
  forsok: null,
  ...svar,
});
const rangert = (niva: "A" | "B", poengsum: number): Rangert => ({ id: 1, niva, feil: null, hoved: niva === "A" ? "motor" : null, rett: [], poengsum, treff: {} as Rangert["treff"] });

describe("likhet", () => {
  // Alle besvart: underkategori 4, tidsnivå 4, km 3, alder 2, «som den er» 2, krav 2, egen vurdering 4, grunnlag 4.
  it("er 100 når vedtaket får alle poengene saken kan gi", () => expect(likhet(rangert("A", 25), sak(["turbo"]))).toBe(100));

  it("har samme nevner for alle vedtak i saken, så den følger poengsummen", () => {
    expect(likhet(rangert("A", 20), sak(["turbo"]))).toBe(80);
    expect(likhet(rangert("A", 21), sak(["turbo"]))).toBeGreaterThan(likhet(rangert("A", 20), sak(["turbo"])));
  });

  it("holder kriterier kjøperen ikke har svart på utenfor", () => {
    expect(likhet(rangert("A", 21), sak([]))).toBe(100);
    expect(likhet(rangert("A", 9), sak([], { km: null, alder: null, somDenEr: null, krav: null }))).toBe(75);
  });

  it("teller feilen som 0 på nivå B", () => expect(likhet(rangert("B", 9), sak(["turbo"]))).toBe(36));
});

describe("likhet per feil", () => {
  it("to feil i samme område: nevneren følger feilen vedtaket sammenlignes med", () => {
    const s = sak(["turbo"], { kategorier: [{ hoved: "motor", under: [], niva: 1, opplysning: null, verksted: null }, { hoved: "motor", under: ["turbo"], niva: 1, opplysning: null, verksted: null }] });
    // The first fault has no subcategory (21 points), the second has one (25).
    expect(likhet(rangert("A", 21), sakForFeil(s, 0))).toBe(100);
    expect(likhet(rangert("A", 21), sakForFeil(s, 1))).toBe(84);
  });
});
