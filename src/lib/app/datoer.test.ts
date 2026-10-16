import { describe, expect, it } from "vitest";
import { datoavvik } from "./datoer";
import { eksempel } from "./skjema";

const idag = "2026-10-16";

describe("datoavvik", () => {
  it("ingen avvik i eksempelet", () => expect(datoavvik(eksempel(idag), idag)).toEqual([]));
  it("kjøp etter overtakelse", () => expect(datoavvik({ ...eksempel(idag), c_purchase: "2026-07-01", c_delivery: "2026-06-01" }, idag).join(" ")).toContain("Kjøpsdatoen er etter overtakelsesdatoen"));
  it("dato frem i tid", () => expect(datoavvik({ ...eksempel(idag), c_delivery: "2026-12-01" }, idag).join(" ")).toContain("frem i tid"));
  it("feil oppdaget før overtakelsen", () => {
    const s = eksempel(idag);
    expect(datoavvik({ ...s, f_area: { hoyvolt: { ...s.f_area.hoyvolt, found: "2026-01-01" } } }, idag).join(" ")).toContain("før du overtok bilen");
  });
  it("sa fra før feilen ble oppdaget", () => {
    const s = eksempel(idag);
    expect(datoavvik({ ...s, f_prior_date: "2026-07-01" }, idag).join(" ")).toContain("før du oppdaget feilen");
  });
  it("brevdato før du sa fra", () => expect(datoavvik({ ...eksempel(idag), l_date: "2026-09-01" }, idag).join(" ")).toContain("Brevet er datert før"));
  it("mer enn fem år siden overtakelsen", () => {
    const s = eksempel(idag);
    expect(datoavvik({ ...s, c_purchase: "2021-01-01", c_delivery: "2021-01-01" }, idag).join(" ")).toContain("fem år");
  });
});
