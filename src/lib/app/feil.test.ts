import { describe, expect, it } from "vitest";
import { feilposter, feilposterSortert, virkningFor } from "./feil";
import { standard } from "./skjema";

const s = {
  ...standard("2026-10-23"),
  f_cats: ["motor", "understell"],
  f_parts: { motor: ["utslipp", "turbo"], understell: ["bremser"] },
  f_area: { motor: { found: "2024-04-02" }, understell: { found: "2026-10-10" } },
  f_catdesc: { motor: "Partikkelfilteret tettet seg." },
  f_under: { "motor.turbo": { found: "2025-02-18", desc: "Turboen hviner." } },
};

describe("feilposter", () => {
  it("deler turboen ut av motor, og området beholder resten", () =>
    expect(feilposter(s).map((p) => [p.hoved, p.under, p.found])).toEqual([["motor", ["turbo"], "2025-02-18"], ["motor", ["utslipp"], "2024-04-02"], ["understell", ["bremser"], "2026-10-10"]]));
  it("uten deling: én post per område", () => expect(feilposter({ ...s, f_under: {} }).map((p) => p.felt)).toEqual(["f_area.motor.found", "f_area.understell.found"]));
  it("alt delt: området gir ingen post", () => expect(feilposter({ ...s, f_parts: { ...s.f_parts, motor: ["turbo"] } }).map((p) => p.felt)).toEqual(["f_under.motor.turbo.found", "f_area.understell.found"]));
  it("en delt underkategori som ikke er valgt, teller ikke", () => expect(feilposter({ ...s, f_parts: { ...s.f_parts, motor: ["utslipp"] } })).toHaveLength(2));
  it("eldre skjema uten f_under", () => expect(feilposter({ ...s, f_under: undefined as never })).toHaveLength(2));
});

describe("nøkkel og sortering", () => {
  it("hver post har en nøkkel: området, eller hoved.under for en feil datert for seg", () => expect(feilposter(s).map((p) => p.nokkel)).toEqual(["motor.turbo", "motor", "understell"]));
  it("en enkelt underkategori uten egen dato har områdets nøkkel", () => expect(feilposter({ ...s, f_under: {}, f_parts: { ...s.f_parts, motor: ["turbo"] } })[0].nokkel).toBe("motor"));
  it("feilposterSortert: etter dato, udaterte sist, stabilt", () => {
    const u = { ...s, f_cats: ["motor", "understell", "klima"], f_parts: { ...s.f_parts, klima: ["ac"] }, f_area: { ...s.f_area, klima: { found: "" } } };
    expect(feilposterSortert(u).map((p) => p.nokkel)).toEqual(["motor", "motor.turbo", "understell", "klima"]);
  });
});

describe("virkningFor", () => {
  const [turbo, motor, understell] = feilposter(s);
  it("konsekvensene til feilen, etter nøkkelen", () => expect(virkningFor({ ...s, f_virkning: { "motor.turbo": ["plagsom"], motor: ["bruk"] } }, turbo)).toEqual(["plagsom"]));
  it("en feil datert for seg arver områdets", () => expect(virkningFor({ ...s, f_virkning: { motor: ["bruk"] } }, turbo)).toEqual(["bruk"]));
  it("ingen valg for feilen: ingen konsekvens", () => expect(virkningFor({ ...s, f_virkning: { motor: ["bruk"] } }, understell)).toEqual([]));
  it("et eldre skjema med ett felles valg gir det til hver feil", () => {
    const eldre = { ...s, f_virkning: {}, f_impact: ["sikkerhet"] };
    expect([turbo, motor, understell].map((p) => virkningFor(eldre, p))).toEqual([["sikkerhet"], ["sikkerhet"], ["sikkerhet"]]);
  });
});
