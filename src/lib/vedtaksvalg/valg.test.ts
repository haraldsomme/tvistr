import { describe, expect, it } from "vitest";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import type { Rangert } from "@/lib/matching/ranger";
import { alternativer, type Sitatvalg, tolkSvar } from "./valg";

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

describe("alternativer", () => {
  const fire = [rangert(1, "A"), rangert(2, "A"), rangert(3, "B"), rangert(4, "A")];
  const s = new Map(fire.map((r) => [r.id, sitater(3)]));

  it("er de to neste i rangeringen, med sine første sitater", () => {
    const a = alternativer(fire, 2, s);
    expect(a.map((x) => x.r.id)).toEqual([1, 3]);
    expect(a.map((x) => x.valgte.map((v) => v.id))).toEqual([["s1", "s2"], ["s1"]]);
  });

  it("er tom med én kandidat", () => expect(alternativer([rangert(1, "A")], 1, s)).toEqual([]));

  it("hopper over kandidater uten sitater", () => expect(alternativer(fire, 1, new Map([[2, []], [3, sitater(1)], [4, sitater(2)]])).map((x) => x.r.id)).toEqual([3, 4]));
});
