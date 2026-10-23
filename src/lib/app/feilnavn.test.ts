import { describe, expect, it } from "vitest";
import { delTekst, feiloverskrift } from "./feilnavn";
import type { Feilpost } from "./feil";

const post = (hoved: string, under: string[]): Feilpost => ({ hoved, under, found: "", desc: "", felt: `f_area.${hoved}.found`, descFelt: `f_catdesc.${hoved}`, nokkel: hoved });
const begge = (p: Feilpost) => [delTekst(feiloverskrift(p, "ubestemt")), delTekst(feiloverskrift(p, "bestemt"))];

describe("feiloverskrift", () => {
  it("en ved-form: «Feil ved» og «Feilen ved»", () => expect(begge(post("klima", ["ac"]))).toEqual(["Feil ved klimaanlegget (AC)", "Feilen ved klimaanlegget (AC)"]));
  it("en tekst-form: lik i begge", () => expect(begge(post("karosseri", ["lakk"]))).toEqual(["Lakkskader eller bulker", "Lakkskader eller bulker"]));
  it("flere ved-former: «Feilene ved»", () => expect(delTekst(feiloverskrift(post("motor", ["turbo", "registerreim"]), "bestemt"))).toBe("Feilene ved turboen og ved registerreimen eller registerkjedet"));
  it("området uten underkategori", () => expect(begge(post("motor", []))).toEqual(["Feil ved motoren eller eksosanlegget", "Feilen ved motoren eller eksosanlegget"]));
  it("feltmerket står med stor forbokstav", () => expect(feiloverskrift(post("karosseri", ["lakk"]), "ubestemt")).toContainEqual({ felt: "f_parts.karosseri", tekst: "Lakkskader eller bulker" }));
});
