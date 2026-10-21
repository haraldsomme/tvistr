import { describe, expect, it } from "vitest";
import { eksempel, standard } from "@/lib/app/skjema";
import { ALLE } from "@/app/sak/skjema/steg";
import { oppsummering } from "./svarene";

const idag = "2026-10-21";

describe("oppsummering", () => {
  it("bilen", () => expect(oppsummering("bilen", eksempel(idag))).toBe("Volkswagen ID.4 2022 · EL 48213"));
  it("kjøpet: kjøpsdato og kjøpesum", () => expect(oppsummering("kjopet", { ...eksempel(idag), c_purchase: "2025-03-12", c_price: "129 900" })).toBe("12. mars 2025 · 129 900 kr"));
  it("kravet", () => expect(oppsummering("kravet", eksempel(idag))).toContain("Retting"));
  it("deg uten svar", () => expect(oppsummering("deg", standard(idag))).toBe("Ikke fylt ut"));
  it.each(ALLE.filter((s) => s.id !== "brevet" && s.id !== "sagt_fra").map((s) => s.id))("%s uten svar", (id) => expect(oppsummering(id, standard(idag))).toBe("Ikke fylt ut"));
  it.each(ALLE.map((s) => s.id))("%s med eksempelet", (id) => expect(oppsummering(id, eksempel(idag))).not.toBe("Ikke fylt ut"));
});
