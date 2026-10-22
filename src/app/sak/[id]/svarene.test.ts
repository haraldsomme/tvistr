import { describe, expect, it } from "vitest";
import { eksempel, standard } from "@/lib/app/skjema";
import { ALLE } from "@/app/sak/skjema/steg";
import type { Presedens } from "@/lib/app/brevtyper";
import { oppsummering, vedtakEndret } from "./svarene";
import type { Vedtaksvalg } from "./vedtaksvindu";

const idag = "2026-10-21";

describe("oppsummering", () => {
  it("bilen", () => expect(oppsummering("bilen", eksempel(idag))).toBe("Volkswagen ID.4 2022 · EL 48213"));
  it("kjøpet: kjøpsdato og kjøpesum", () => expect(oppsummering("kjopet", { ...eksempel(idag), c_purchase: "2025-03-12", c_price: "129 900" })).toBe("12. mars 2025 · 129 900 kr"));
  it("kravet", () => expect(oppsummering("kravet", eksempel(idag))).toContain("Retting"));
  it("deg uten svar", () => expect(oppsummering("deg", standard(idag))).toBe("Ikke fylt ut"));
  it.each(ALLE.filter((s) => s.id !== "brevet" && s.id !== "sagt_fra").map((s) => s.id))("%s uten svar", (id) => expect(oppsummering(id, standard(idag))).toBe("Ikke fylt ut"));
  it.each(ALLE.map((s) => s.id))("%s med eksempelet", (id) => expect(oppsummering(id, eksempel(idag))).not.toBe("Ikke fylt ut"));
});

describe("vedtakEndret", () => {
  const v = (id: number, saksnummer: string | null) => ({ id, saksnummer }) as Presedens;
  const endring = (e: Partial<NonNullable<Vedtaksvalg["endring"]>>) => ({ nye: [], forrigeAnbefalt: null, utfall: "fulgt", byttetFra: null, egetValg: null, ...e }) as NonNullable<Vedtaksvalg["endring"]>;
  const valg = (e: Vedtaksvalg["endring"]) => ({ endring: e, valgt: v(2, "23/100") }) as Vedtaksvalg;
  const s = eksempel(idag);
  it("når brevet viser til et annet vedtak enn før", () => expect(vedtakEndret(s, valg(endring({ byttetFra: v(1, "22/1") })))).toBe("Endret: brevet viser nå til sak 23/100"));
  it("når kjøperens eget valg er borte", () => expect(vedtakEndret(s, valg(endring({ utfall: "borte" })))).toBe("Endret: brevet viser nå til sak 23/100"));
  it("ikke når brevet viser til det samme", () => {
    expect(vedtakEndret(s, valg(endring({})))).toBeNull();
    expect(vedtakEndret(s, valg(endring({ utfall: "beholdt" })))).toBeNull();
    expect(vedtakEndret(s, valg(null))).toBeNull();
    expect(vedtakEndret({ ...s, prec_on: false }, valg(endring({ byttetFra: v(1, "22/1") })))).toBeNull();
  });
});
