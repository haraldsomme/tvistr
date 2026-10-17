import { describe, expect, it } from "vitest";
import { STEG, stegFor } from "./steg";

const nr = (navn: string) => STEG.findIndex((s) => s.navn === navn);

describe("stegene", () => {
  it("er åtte, i brevets rekkefølge", () => expect(STEG.map((s) => s.navn)).toEqual(["Deg", "Forhandleren", "Bilen", "Kjøpet", "Feilen", "Verksted og vedlegg", "Kontakt med selger", "Kravet"]));
  it.each([
    ["Forbrukerkjøpsloven gjelder", "Forhandleren"],
    ["Solgt «som den er»", "Kjøpet"],
    ["Fristen er ute", "Kjøpet"],
    ["Datoene mangler", "Kjøpet"],
    ["Sjekk datoene", "Kjøpet"],
    ["Mer enn to år etter overtakelsen", "Kjøpet"],
    ["Feilen ble oppdaget før overtakelsen", "Kjøpet"],
    ["Feilen viste seg innen to år", "Feilen"],
    ["Én av feilene viste seg senere", "Feilen"],
    ["Feilen var ukjent ved kjøpet", "Feilen"],
    ["Skade eller feil bruk", "Feilen"],
    ["Alvorlig feil", "Feilen"],
    ["Verkstedrapport støtter saken", "Verksted og vedlegg"],
    ["Ingen verkstedrapport ennå", "Verksted og vedlegg"],
    ["Be om en skriftlig rapport", "Verksted og vedlegg"],
    ["Du sa fra i tide", "Kontakt med selger"],
    ["Du er i tide", "Kontakt med selger"],
    ["Det har gått mer enn to måneder", "Kontakt med selger"],
    ["Selger sa at bilen var fri for slike feil", "Kontakt med selger"],
    ["Bilen var ikke som selgeren opplyste", "Kontakt med selger"],
  ])("«%s» → %s", (t, steg) => expect(stegFor(t)).toBe(nr(steg)));
});
