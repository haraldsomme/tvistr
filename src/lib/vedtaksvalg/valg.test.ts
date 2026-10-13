import { describe, expect, it } from "vitest";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import type { Rangert } from "@/lib/matching/ranger";
import { type Sitatvalg, tolkSvar } from "./valg";

const feil = { id: "f1", hovedkategori: "motor", underkategori: "turbo", komponent: "turbo" } as AvledetFeil;
const rangert = (id: number, niva: "A" | "B"): Rangert => ({ id, niva, feil: niva === "A" ? feil : null, hoved: null, rett: [], poengsum: 0, maks: 0, treff: {} as Rangert["treff"] });
const sitater = (n: number): Sitatvalg[] => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, tekst: `Sitat ${i + 1} fra utvalgets vurdering.`, feil }));

const kandidater = [rangert(1, "A"), rangert(2, "B")];
const alle = new Map([
  [1, sitater(3)],
  [2, sitater(3)],
]);

describe("tolkSvar", () => {
  it("bruker modellens valg og sitater i modellens rekkefølge", () => {
    const t = tolkSvar({ vedtak_id: 1, sitater: ["s3", "s1"] }, kandidater, alle);
    expect([t.r.id, t.valgte.map((s) => s.id), t.fulgt]).toEqual([1, ["s3", "s1"], true]);
  });

  it("tar to sitater på nivå A og ett på nivå B", () => {
    expect(tolkSvar({ vedtak_id: 1, sitater: ["s1", "s2", "s3"] }, kandidater, alle).valgte).toHaveLength(2);
    expect(tolkSvar({ vedtak_id: 2, sitater: ["s1", "s2"] }, kandidater, alle).valgte).toHaveLength(1);
  });

  it("velger høyeste poeng uten nytt forsøk når vedtaket er ukjent eller svaret mangler", () => {
    for (const svar of [{ vedtak_id: 99, sitater: ["s1"] }, null]) {
      const t = tolkSvar(svar, kandidater, alle);
      expect([t.r.id, t.valgte.map((s) => s.id), t.fulgt]).toEqual([1, ["s1", "s2"], false]);
    }
  });

  it("godtar ikke sitat-id-er vedtaket ikke har", () => {
    expect(tolkSvar({ vedtak_id: 2, sitater: ["s9"] }, kandidater, alle).fulgt).toBe(false);
  });
});
