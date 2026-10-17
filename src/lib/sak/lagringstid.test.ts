import { describe, expect, it } from "vitest";
import { grenser } from "./lagringstid";

describe("grenser", () => {
  it("sletter betalte saker etter tre år og ubetalte etter 30 dager", () => {
    const g = grenser(new Date("2026-10-17T03:00:00Z"));
    expect(g.betalt.toISOString()).toBe("2023-10-17T03:00:00.000Z");
    expect(g.ufullfort.toISOString()).toBe("2026-09-17T03:00:00.000Z");
  });
});
