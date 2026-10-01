import { describe, expect, it } from "vitest";
import { stegGyldig, TOM_INNSENDING, tilKlageInput, type Innsending } from "./innsending";

const gyldig: Innsending = {
  ...TOM_INNSENDING,
  kjopsdato: "2026-05-12",
  kjopesumNok: "189000",
  feiltyper: ["motor"],
  beskrivelse: "Motorlampen lyser og bilen mister trekkraft i motbakker.",
  oppdagetDato: "2026-09-02",
  opplystForKjop: "nei",
  kontakt: "venter",
  bevis: { ...TOM_INNSENDING.bevis, verkstedrapport: true },
  rapportSierForKjop: "ja",
  utbedringskostnadNok: "25000",
};

describe("stegGyldig", () => {
  it("steg 1 er bare kjøpsdato og kjøpesum", () => {
    expect(stegGyldig(TOM_INNSENDING, 1)).toBe(false);
    expect(stegGyldig({ ...TOM_INNSENDING, kjopsdato: "2026-05-12", kjopesumNok: "189000" }, 1)).toBe(true);
    expect(stegGyldig({ ...gyldig, kjopsdato: "2026-02-30" }, 1)).toBe(false);
    expect(stegGyldig({ ...gyldig, kjopesumNok: "0" }, 1)).toBe(false);
  });

  it("steg 2 krever alle svar, også kontakt med forhandleren", () => {
    expect(stegGyldig(gyldig, 2)).toBe(true);
    expect(stegGyldig({ ...gyldig, kontakt: "" }, 2)).toBe(false);
    expect(stegGyldig({ ...gyldig, opplystForKjop: "" }, 2)).toBe(false);
    expect(stegGyldig({ ...gyldig, feiltyper: [] }, 2)).toBe(false);
    expect(stegGyldig({ ...gyldig, beskrivelse: "feil" }, 2)).toBe(false);
  });

  it("avviser feil oppdaget før kjøpsdato og datoer i fremtiden", () => {
    expect(stegGyldig({ ...gyldig, oppdagetDato: "2026-05-01" }, 2)).toBe(false);
    expect(stegGyldig({ ...gyldig, oppdagetDato: "2999-01-01" }, 2)).toBe(false);
  });

  it("steg 3 krever svar om rapporten bare når rapport er krysset av", () => {
    expect(stegGyldig(TOM_INNSENDING, 3)).toBe(true);
    expect(stegGyldig({ ...gyldig, rapportSierForKjop: "" }, 3)).toBe(false);
    expect(stegGyldig({ ...gyldig, rapportSierForKjop: "nei" }, 3)).toBe(true);
    expect(stegGyldig({ ...gyldig, bevis: TOM_INNSENDING.bevis, rapportSierForKjop: "" }, 3)).toBe(true);
  });
});

describe("tilKlageInput", () => {
  it("bygger motorens input med standard kvalifisering", () => {
    const r = tilKlageInput(gyldig);
    if (!r.ok) throw new Error(r.feil);
    expect(r.input.kvalifisering).toEqual({ selgerType: "forhandler", privatBruk: true });
    expect(r.input.bilOgKjop).toEqual({ kjopsdato: "2026-05-12", kjopesumNok: 189000 });
    expect(r.input.feilen.kontakt).toBe("venter");
    expect(r.input.bevis.rapportSierForKjop).toBe(true);
  });

  it("ignorerer felt skjemaet ikke lenger sender", () => {
    const r = tilKlageInput({ ...gyldig, regnr: "EK 48213", forhandler: { type: "fritekst", navn: "X" }, kmVedKjop: "84000", reklamertDato: "2026-01-01" });
    if (!r.ok) throw new Error(r.feil);
    expect(r.input.bilOgKjop).toEqual({ kjopsdato: "2026-05-12", kjopesumNok: 189000 });
  });

  it("utbedringskostnad hører til rapporten: ignoreres uten rapport, valideres med", () => {
    const med = tilKlageInput(gyldig);
    if (!med.ok) throw new Error(med.feil);
    expect(med.input.feilen.utbedringskostnadNok).toBe(25000);

    const uten = tilKlageInput({ ...gyldig, bevis: TOM_INNSENDING.bevis });
    if (!uten.ok) throw new Error(uten.feil);
    expect(uten.input.feilen.utbedringskostnadNok).toBeNull();

    const tom = tilKlageInput({ ...gyldig, utbedringskostnadNok: "" });
    if (!tom.ok) throw new Error(tom.feil);
    expect(tom.input.feilen.utbedringskostnadNok).toBeNull();

    expect(stegGyldig({ ...gyldig, utbedringskostnadNok: "abc" }, 3)).toBe(false);
    expect(stegGyldig({ ...gyldig, utbedringskostnadNok: "0" }, 3)).toBe(false);
    expect(stegGyldig({ ...gyldig, bevis: TOM_INNSENDING.bevis, utbedringskostnadNok: "abc" }, 3)).toBe(true);
  });

  it("rapportSierForKjop er null uten rapport, og kreves med rapport", () => {
    const uten = tilKlageInput({ ...gyldig, bevis: TOM_INNSENDING.bevis });
    if (!uten.ok) throw new Error(uten.feil);
    expect(uten.input.bevis.rapportSierForKjop).toBeNull();
    expect(tilKlageInput({ ...gyldig, rapportSierForKjop: "" }).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, rapportSierForKjop: "kanskje" }).ok).toBe(false);
  });

  it("tar imot flere feiltyper uten duplikater", () => {
    const r = tilKlageInput({ ...gyldig, feiltyper: ["motor", "elektrisk", "motor", "hacket"] });
    if (!r.ok) throw new Error(r.feil);
    expect(r.input.feilen.typer).toEqual(["motor", "elektrisk"]);
  });

  it("avviser ugyldig innhold", () => {
    expect(tilKlageInput(null).ok).toBe(false);
    expect(tilKlageInput([1, 2]).ok).toBe(false);
    expect(tilKlageInput({}).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, feiltyper: ["hacket"] }).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, kjopesumNok: "-5" }).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, kontakt: "kanskje" }).ok).toBe(false);
  });

  it("ignorerer ikke-boolske bevisverdier", () => {
    const r = tilKlageInput({ ...gyldig, bevis: { bilder: "true", annonse: true } });
    if (!r.ok) throw new Error(r.feil);
    expect(r.input.bevis).toMatchObject({ bilder: false, annonse: true, verkstedrapport: false });
  });
});
