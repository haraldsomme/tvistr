import { describe, expect, it } from "vitest";
import { standard } from "@/lib/app/skjema";
import { ETTER, FOR, mangler, seksjonFor, stegFor } from "./steg";

const idag = "2026-10-21";

describe("seksjonene", () => {
  it("før betaling, i brevets rekkefølge", () => expect(FOR.map((s) => s.id)).toEqual(["bilen", "kjopet", "feilen", "omrader", "virkning", "verksted", "selger_sa", "sagt_fra", "kravet"]));
  it("etter betaling", () => expect(ETTER.map((s) => s.id)).toEqual(["deg", "forhandleren", "brevet"]));

  it.each([
    ["c_km", "bilen"],
    ["c_lastreg", "bilen"],
    ["c_asis", "kjopet"],
    ["f_parts.motor", "feilen"],
    ["f_catdesc.motor", "omrader"],
    ["f_area.motor.found", "omrader"],
    ["f_impact", "virkning"],
    ["ws_quote", "verksted"],
    ["seller_txt", "selger_sa"],
    ["f_prior_date", "sagt_fra"],
    ["b_name", "deg"],
    ["d_zip", "forhandleren"],
    ["k_forsok", "kravet"],
    ["exp.0", "kravet"],
    ["f_docs", "brevet"],
  ])("seksjonFor(%s) → %s", (felt, id) => expect(seksjonFor(felt)).toBe(id));

  it("mangler gjelder begge, med seksjonens id", () => {
    const ids = mangler(standard(idag)).map((m) => m.id);
    expect(ids).toContain("deg");
    expect(ids).toContain("kravet");
  });
});

describe("stegFor", () => {
  it.each([
    ["Forbrukerkjøpsloven gjelder", "forhandleren"],
    ["Solgt «som den er»", "kjopet"],
    ["Fristen er ute", "kjopet"],
    ["Datoene mangler", "kjopet"],
    ["Sjekk datoene", "kjopet"],
    ["Mer enn to år etter overtakelsen", "kjopet"],
    ["Feilen ble oppdaget før overtakelsen", "kjopet"],
    ["Feilen viste seg innen to år", "omrader"],
    ["Én av feilene viste seg senere", "omrader"],
    ["Feilen var ukjent ved kjøpet", "omrader"],
    ["Skade eller feil bruk", "omrader"],
    ["Alvorlig feil", "virkning"],
    ["Verkstedrapport støtter saken", "verksted"],
    ["Ingen verkstedrapport ennå", "verksted"],
    ["Be om en skriftlig rapport", "verksted"],
    ["Du sa fra i tide", "sagt_fra"],
    ["Du er i tide", "sagt_fra"],
    ["Det har gått mer enn to måneder", "sagt_fra"],
    ["Selger sa at bilen var fri for slike feil", "selger_sa"],
    ["Bilen var ikke som selgeren opplyste", "selger_sa"],
  ])("«%s» → %s", (t, id) => expect(stegFor(t)).toBe(id));
});
