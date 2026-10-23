import { describe, expect, it } from "vitest";
import { eksempel, standard } from "@/lib/app/skjema";
import { ALLE } from "@/app/sak/skjema/steg";
import type { Presedens } from "@/lib/app/brevtyper";
import { oppsummering, vedtakEndret, vedtakTekst } from "./svarene";
import type { Feilvalg, Vedtaksvalg } from "./vedtaksvindu";

const idag = "2026-10-21";

describe("oppsummering", () => {
  it("konsekvensene per feil, nummerert som i brevet", () => {
    const s = { ...eksempel(idag), f_cats: ["karosseri", "klima"], f_parts: { karosseri: ["lakk"], klima: ["ac"] }, f_area: { karosseri: { found: "2025-02-23" }, klima: { found: "2026-10-01" } }, f_virkning: { karosseri: ["kosmetisk", "verdi"], klima: ["plagsom"] } };
    expect(oppsummering("virkning", s)).toBe("1. Bare kosmetisk, Bilen er mindre verdt · 2. Plagsom");
  });
  it("bilen", () => expect(oppsummering("bilen", eksempel(idag))).toBe("Volkswagen ID.4 2022 · EL 48213"));
  it("kjøpet: kjøpsdato og kjøpesum", () => expect(oppsummering("kjopet", { ...eksempel(idag), c_purchase: "2025-03-12", c_price: "129 900" })).toBe("12. mars 2025 · 129 900 kr"));
  it("kravet", () => expect(oppsummering("kravet", eksempel(idag))).toContain("Retting"));
  it("deg uten svar", () => expect(oppsummering("deg", standard(idag))).toBe("Ikke fylt ut"));
  it.each(ALLE.filter((s) => s.id !== "brevet" && s.id !== "sagt_fra").map((s) => s.id))("%s uten svar", (id) => expect(oppsummering(id, standard(idag))).toBe("Ikke fylt ut"));
  it.each(ALLE.map((s) => s.id))("%s med eksempelet", (id) => expect(oppsummering(id, eksempel(idag))).not.toBe("Ikke fylt ut"));
});

describe("raden «Vedtaket»", () => {
  const v = (id: number, saksnummer: string | null, anbefalt = true) => ({ id, saksnummer, vedtaksdato: "2023-05-01", bil: "Golf", anbefalt }) as Presedens;
  type Endring = NonNullable<Feilvalg["endring"]>;
  const endring = (e: Partial<Endring>) => ({ nye: [], forrigeAnbefalt: null, utfall: "fulgt", byttetFra: null, egetValg: null, ...e }) as Endring;
  const feil = (nr: number, valgt: Presedens | null, e: Endring | null = null): Feilvalg => ({ nokkel: `k${nr}`, nr, navn: `Feil ${nr}`, valg: valgt ? [valgt] : [], valgt, endring: e });
  const vedtak = (...f: Feilvalg[]) => ({ mangler: false, endres: false, funn: { ok: true, valg: [], endring: [] }, venter: false, provIgjen: () => {}, feil: f }) as Vedtaksvalg;
  const s = eksempel(idag);
  it("én feil: saken, bilen og «Anbefalt»", () => expect(vedtakTekst(s, vedtak(feil(1, v(2, "23/100"))))).toBe("Sak 23/100 · 2023 · Golf · Anbefalt"));
  it("to feil: nummerert per feil", () => expect(vedtakTekst(s, vedtak(feil(1, v(2, "23/100")), feil(2, v(3, "21/4", false))))).toBe("1. Sak 23/100 · 2023 · 2. Sak 21/4 · 2023"));
  it("en feil uten vedtak: lovens vilkår", () => expect(vedtakTekst(s, vedtak(feil(1, v(2, "23/100")), feil(2, null)))).toBe("1. Sak 23/100 · 2023 · 2. Lovens vilkår"));
  it("endret: bare feilene der brevet nå viser til et annet vedtak", () => {
    expect(vedtakEndret(s, vedtak(feil(1, v(2, "23/100"), endring({ byttetFra: v(1, "22/1") })), feil(2, v(3, "21/4"), endring({}))))).toBe("Endret: brevet viser nå til sak 23/100");
    expect(vedtakEndret(s, vedtak(feil(1, v(2, "23/100"), endring({ utfall: "borte" })), feil(2, v(3, "21/4"), endring({ byttetFra: v(1, "22/1") }))))).toBe("Endret: brevet viser nå til sak 23/100 og sak 21/4");
    expect(vedtakEndret(s, vedtak(feil(1, v(2, "23/100"), endring({ utfall: "beholdt" }))))).toBeNull();
    expect(vedtakEndret(s, vedtak(feil(1, v(2, "23/100"))))).toBeNull();
  });
});
