import { describe, expect, it } from "vitest";
import { addDays, fmtD, parseD } from "./dato";
import { forhandsvisning } from "./forhandsvisning";
import { eksempel } from "./skjema";

const idag = "2026-10-16";
const kort = { id: 1, saksnummer: "22/3390", ar: "2022", bil: "Toyota RAV4 2019", km: 54000, somDenEr: false, fikk: ["retting"], feil: "Automatgir" };

describe("forhåndsvisningen", () => {
  it("viser bil og utfall, aldri saksnummeret", () => {
    const j = JSON.stringify(forhandsvisning(eksempel(idag), kort, idag));
    expect(j).toContain("Toyota RAV4 2019");
    expect(j).toContain("Kjøperen fikk medhold i ");
    expect(j).toContain("Praksis fra");
    expect(j).not.toContain("22/3390");
    expect(j).not.toContain("lignende sak hentes");
  });

  it("uten utfall: ingen medholdssetning", () => {
    const j = JSON.stringify(forhandsvisning(eksempel(idag), { ...kort, fikk: [] }, idag));
    expect(j).toContain("Toyota RAV4 2019");
    expect(j).not.toContain("Kjøperen fikk medhold");
  });

  it("uten vedtak: lovsetningen, ingen praksis-overskrift", () => expect(JSON.stringify(forhandsvisning(eksempel(idag), null, idag))).not.toContain("Praksis fra"));

  it("dagens dato og 14 dagers frist, uansett svar", () => {
    const j = JSON.stringify(forhandsvisning({ ...eksempel(idag), l_date: "2020-01-01" }, kort, idag));
    expect(j).not.toContain("2020");
    expect(j).toContain(fmtD(addDays(parseD(idag)!, 14)));
  });

});
