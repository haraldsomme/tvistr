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

  it("to feil: bilen og utfallet under den første, plassholderen under den andre", () => {
    const e = eksempel(idag);
    const s = { ...e, f_cats: ["hoyvolt", "klima"], f_parts: { ...e.f_parts, klima: ["ac"] }, f_area: { ...e.f_area, klima: { found: e.f_area.hoyvolt.found } } };
    const j = JSON.stringify(forhandsvisning(s, kort, idag));
    expect(j.split("Toyota RAV4 2019").length).toBe(2);
    expect(j.split("lignende sak hentes").length).toBe(2);
    expect(j.split('"kursiv":"Praksis fra Forbrukerklageutvalget."').length).toBe(3);
  });

  it("dagens dato og 14 dagers frist, uansett svar", () => {
    const j = JSON.stringify(forhandsvisning({ ...eksempel(idag), l_date: "2020-01-01" }, kort, idag));
    expect(j).not.toContain("2020");
    expect(j).toContain(fmtD(addDays(parseD(idag)!, 14)));
  });

});
