import { describe, expect, it } from "vitest";
import type { Blokk } from "@/lib/app/brevtyper";
import { endredeFelt, seksjoner } from "./brevrute";

const B: Blokk[] = [
  { t: "addr", linjer: [[{ felt: "b_name", tekst: "Kari Nordmann" }], [{ ph: "Adresse" }]] },
  { t: "subj", tekst: ["Reklamasjon på mangel ved ", { felt: "c_make", tekst: "Volkswagen" }, ", reg.nr. ", { felt: "c_reg", tekst: "EL 48213" }] },
  { t: "p", tekst: ["Kilometerstand ", { felt: "c_km", tekst: "84 000" }, " km. ", { skjult: 40 }] },
  { t: "h", tekst: ["Mangelen"] },
  { t: "p", tekst: [{ felt: "f_catdesc.motor", tekst: "Motoren banker." }, " ", { ph: "Beskrivelse" }] },
  { t: "h", tekst: ["Krav"] },
  { t: "p", tekst: ["Jeg krever retting. ", { felt: "c_reg", tekst: "EL 48213" }] },
];
const B2: Blokk[] = B.map((b) => (b.t === "p" && b.tekst.some((d) => typeof d === "object" && "felt" in d && d.felt === "c_km") ? { ...b, tekst: ["Kilometerstand ", { felt: "c_km", tekst: "91 500" }, " km. ", { skjult: 40 }] } : b));

describe("endredeFelt", () => {
  it("marks nothing for the first letter", () => {
    expect(endredeFelt(null, B)).toEqual([]);
  });

  it("gives the fields whose text changed", () => {
    expect(endredeFelt(B, B2)).toEqual(["c_km"]);
  });

  it("is empty when nothing changed, and counts a newly filled field", () => {
    expect(endredeFelt(B, B)).toEqual([]);
    const fylt: Blokk[] = [...B, { t: "p", tekst: [{ felt: "b_addr", tekst: "Storgata 1" }] }];
    expect(endredeFelt(B, fylt)).toEqual(["b_addr"]);
  });
});

describe("seksjoner", () => {
  it("starts a section at each heading and fills it when it has no placeholder", () => {
    expect(seksjoner(B).map((s) => [s.fra, s.til, s.fylt])).toEqual([
      [0, 3, "delvis"],
      [3, 5, "delvis"],
      [5, 7, "ja"],
    ]);
    expect(seksjoner([{ t: "h", tekst: ["Mangelen"] }, { t: "p", tekst: [{ ph: "Feilen" }] }]).map((s) => s.fylt)).toEqual(["nei"]);
  });
});

describe("seksjoner med underoverskrift", () => {
  it("h2 starter ingen seksjon", () => {
    const b: Blokk[] = [{ t: "h", tekst: ["Mangelen"] }, { t: "p", tekst: ["a"] }, { t: "h2", tekst: ["1. Feil ved turboen"] }, { t: "p", tekst: ["b"] }];
    expect(seksjoner(b)).toHaveLength(1);
  });
});
