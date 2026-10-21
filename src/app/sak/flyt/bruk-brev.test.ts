import { describe, expect, it } from "vitest";
import { etterSvar, provIgjenOm } from "./bruk-brev";

const blokker = [{ t: "p" as const, tekst: ["Brevet."] }];

describe("etterSvar", () => {
  it("takes a good answer, and keeps the last letter with the message on a failure", () => {
    const tom = { blokker: null, svar: null, feil: null, nokkel: null };
    const god = etterSvar(tom, { ok: true, blokker, tekst: "Brevet." }, "a");
    expect(god).toEqual({ blokker, svar: { ok: true, blokker, tekst: "Brevet." }, feil: null, nokkel: "a" });
    const feilet = etterSvar(god, { ok: false, melding: "Nei." }, "b");
    expect(feilet).toEqual({ ...god, feil: "Nei.", nokkel: "b" });
  });
});

describe("provIgjenOm", () => {
  it("retries after 5 s while the latest call for these answers failed", () => {
    expect(provIgjenOm({ feil: "Nei.", nokkel: "a" }, "a")).toBe(5000);
  });

  it("does not retry after a good call or once the answers changed", () => {
    expect(provIgjenOm({ feil: null, nokkel: "a" }, "a")).toBeNull();
    expect(provIgjenOm({ feil: "Nei.", nokkel: "a" }, "b")).toBeNull();
  });
});
