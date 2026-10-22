import { describe, expect, it } from "vitest";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { FEILORD, feilord } from "./feilord";

describe("feilene i brevform", () => {
  it("hver kategori og underkategori har en brevform", () => {
    for (const h of HOVEDKATEGORIER) {
      expect(FEILORD[h.id], h.id).toBeDefined();
      for (const u of h.under) expect(FEILORD[h.id].under[u.id], `${h.id}.${u.id}`).toBeDefined();
    }
  });
  it("ingen brevform uten kategori", () => {
    for (const [id, o] of Object.entries(FEILORD)) {
      const h = HOVEDKATEGORIER.find((x) => x.id === id);
      expect(h, id).toBeDefined();
      for (const u of Object.keys(o.under)) expect(h!.under.some((x) => x.id === u), `${id}.${u}`).toBe(true);
    }
  });
  it("tabellens rekkefølge, og hele området uten underkategori", () => {
    expect(feilord("motor", ["olje", "turbo"])).toEqual([{ ved: "turboen" }, { tekst: "unormalt oljeforbruk eller oljelekkasje" }]);
    expect(feilord("klima", [])).toEqual([{ ved: "klimaanlegget eller varmen" }]);
  });
});
