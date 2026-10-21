import { describe, expect, it } from "vitest";
import { skalHente } from "./vedtak-hent";

const grunn = { aktiv: true, harSvar: true, precOn: true, sistHentet: null, nokkel: "a" };

describe("skalHente", () => {
  it("henter når ingen liste er hentet for svarene", () => expect(skalHente(grunn)).toBe(true));
  it("henter på nytt når svarene er endret", () => expect(skalHente({ ...grunn, sistHentet: "b" })).toBe(true));
  it("ikke når listen for svarene alt er hentet", () => expect(skalHente({ ...grunn, sistHentet: "a" })).toBe(false));
  it("ikke mens en rad som endrer svarene er åpen", () => expect(skalHente({ ...grunn, aktiv: false, sistHentet: "b" })).toBe(false));
  it("ikke uten datoene", () => expect(skalHente({ ...grunn, harSvar: false })).toBe(false));
  it("ikke når brevet ikke viser til et vedtak", () => expect(skalHente({ ...grunn, precOn: false })).toBe(false));
});
