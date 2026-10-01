import { describe, expect, it } from "vitest";
import { kjopsdatoFra, sporOmReklamasjonsdato, oppdagetMulig, stegGyldig, TOM_INNSENDING, tilKlageInput, type Innsending } from "./innsending";

const IDAG = "2026-10-01";

const gyldig: Innsending = {
  ...TOM_INNSENDING,
  feiltyper: ["motor"],
  kjopManed: "5",
  kjopAr: "2026",
  oppdaget: "innen_6_mnd",
  opplystForKjop: "nei",
  feilOpplysning: "nei",
  kontakt: "venter",
  verkstedrapport: "ja",
  rapportSierForKjop: "ja",
};

const gyldigSteg = (i: Innsending, steg: 1 | 2 | 3) => stegGyldig(i, steg, IDAG);

describe("stegGyldig", () => {
  it("steg 1: feiltype, kjøpt måned/år og hvor lenge etter kjøpet feilen viste seg", () => {
    expect(gyldigSteg(TOM_INNSENDING, 1)).toBe(false);
    expect(gyldigSteg(gyldig, 1)).toBe(true);
    expect(gyldigSteg({ ...gyldig, feiltyper: [] }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopManed: "" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopManed: "13" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, oppdaget: "" }, 1)).toBe(false);
  });

  it("steg 1 avviser kjøp i fremtiden, men godtar inneværende måned", () => {
    expect(gyldigSteg({ ...gyldig, kjopManed: "11" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopManed: "10" }, 1)).toBe(true);
  });

  it("steg 1 avviser et oppdaget-svar som er umulig for kjøpstidspunktet", () => {
    expect(gyldigSteg({ ...gyldig, kjopManed: "8", oppdaget: "6_mnd_til_2_ar" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopManed: "3", oppdaget: "6_mnd_til_2_ar" }, 1)).toBe(true);
    expect(gyldigSteg({ ...gyldig, kjopAr: "2025", oppdaget: "over_2_ar" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopAr: "2024", kjopManed: "9", oppdaget: "over_2_ar" }, 1)).toBe(true);
  });

  it("steg 2 krever alle svar", () => {
    expect(gyldigSteg(gyldig, 2)).toBe(true);
    expect(gyldigSteg({ ...gyldig, kontakt: "" }, 2)).toBe(false);
    expect(gyldigSteg({ ...gyldig, opplystForKjop: "" }, 2)).toBe(false);
    expect(gyldigSteg({ ...gyldig, feilOpplysning: "" }, 2)).toBe(false);
    expect(gyldigSteg({ ...gyldig, feilOpplysning: "ja_dokumentert" }, 2)).toBe(true);
    expect(gyldigSteg({ ...gyldig, feilOpplysning: "ja_udokumentert" }, 2)).toBe(true);
  });

  it("steg 3: rapport krever svar om hva den sier, ingen rapport krever svar om bilder", () => {
    expect(gyldigSteg(TOM_INNSENDING, 3)).toBe(false);
    expect(gyldigSteg(gyldig, 3)).toBe(true);
    expect(gyldigSteg({ ...gyldig, rapportSierForKjop: "" }, 3)).toBe(false);
    expect(gyldigSteg({ ...gyldig, verkstedrapport: "nei" }, 3)).toBe(false);
    expect(gyldigSteg({ ...gyldig, verkstedrapport: "nei", bilder: "nei" }, 3)).toBe(true);
  });
});

describe("oppdagetMulig", () => {
  it("er aldri mulig før år og måned er valgt", () => {
    expect(oppdagetMulig({ kjopManed: "", kjopAr: "" }, "innen_6_mnd", IDAG)).toBe(false);
    expect(oppdagetMulig({ kjopManed: "", kjopAr: "2026" }, "innen_6_mnd", IDAG)).toBe(false);
  });

  it("følger tiden som har gått siden kjøpet", () => {
    const nylig = { kjopManed: "9", kjopAr: "2026" };
    expect(oppdagetMulig(nylig, "innen_6_mnd", IDAG)).toBe(true);
    expect(oppdagetMulig(nylig, "6_mnd_til_2_ar", IDAG)).toBe(false);
    const ettAr = { kjopManed: "6", kjopAr: "2025" };
    expect(oppdagetMulig(ettAr, "6_mnd_til_2_ar", IDAG)).toBe(true);
    expect(oppdagetMulig(ettAr, "over_2_ar", IDAG)).toBe(false);
    expect(oppdagetMulig({ kjopManed: "9", kjopAr: "2024" }, "over_2_ar", IDAG)).toBe(true);
  });
});

describe("kjopsdatoFra", () => {
  it("gir siste dag i måneden", () => {
    expect(kjopsdatoFra({ kjopManed: "2", kjopAr: "2024" })).toBe("2024-02-29");
    expect(kjopsdatoFra({ kjopManed: "12", kjopAr: "2023" })).toBe("2023-12-31");
    expect(kjopsdatoFra({ kjopManed: "5", kjopAr: "2026" })).toBe("2026-05-31");
  });
});

describe("tilKlageInput", () => {
  const ok = (raw: unknown) => {
    const r = tilKlageInput(raw, IDAG);
    if (!r.ok) throw new Error(r.feil);
    return r.input;
  };

  it("bygger motorens input med standard kvalifisering", () => {
    const input = ok(gyldig);
    expect(input.kvalifisering).toEqual({ selgerType: "forhandler", privatBruk: true });
    expect(input.bilOgKjop).toEqual({ kjopsdato: "2026-05-31" });
    expect(input.feilen).toEqual({ typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "venter" });
    expect(input.bevis).toEqual({ verkstedrapport: true, rapportSierForKjop: true, bilder: false });
  });

  it("ignorerer felt skjemaet ikke lenger sender", () => {
    const input = ok({ ...gyldig, regnr: "EK 48213", beskrivelse: "Motoren har havarert", kjopsdato: "2020-01-01", kjopesumNok: "189000" });
    expect(input.bilOgKjop).toEqual({ kjopsdato: "2026-05-31" });
  });

  it("svar som ikke ble stilt, påvirker ikke input", () => {
    // Report: pictures were not asked, so a stale «ja» is dropped. No report: the report answer is dropped.
    expect(ok({ ...gyldig, bilder: "ja" }).bevis.bilder).toBe(false);
    const utenRapport = ok({ ...gyldig, verkstedrapport: "nei", rapportSierForKjop: "ja", bilder: "ja" });
    expect(utenRapport.bevis).toEqual({ verkstedrapport: false, rapportSierForKjop: null, bilder: true });
  });

  it("tar imot flere feiltyper uten duplikater", () => {
    expect(ok({ ...gyldig, feiltyper: ["motor", "elektrisk", "motor", "hacket"] }).feilen.typer).toEqual(["motor", "elektrisk"]);
  });

  it("avviser ugyldig innhold", () => {
    expect(tilKlageInput(null).ok).toBe(false);
    expect(tilKlageInput([1, 2]).ok).toBe(false);
    expect(tilKlageInput({}).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, feiltyper: ["hacket"] }, IDAG).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, kontakt: "kanskje" }, IDAG).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, oppdaget: "ofte" }, IDAG).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, feilOpplysning: "kanskje" }, IDAG).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, rapportSierForKjop: "kanskje" }, IDAG).ok).toBe(false);
  });
});

describe("dato for første reklamasjon", () => {
  const gammel: Innsending = { ...gyldig, kjopAr: "2017", kjopManed: "5", oppdaget: "over_2_ar", kontakt: "forsokt" };

  it("spørres bare når kjøpet er over fem år gammelt og forhandleren er kontaktet", () => {
    expect(sporOmReklamasjonsdato(gammel, IDAG)).toBe(true);
    expect(sporOmReklamasjonsdato({ ...gammel, kontakt: "nei" }, IDAG)).toBe(false);
    expect(sporOmReklamasjonsdato({ ...gammel, kjopAr: "2022" }, IDAG)).toBe(false);
  });

  it("må oppgis, ikke ligge før kjøpet eller i fremtiden", () => {
    expect(gyldigSteg(gammel, 2)).toBe(false);
    expect(gyldigSteg({ ...gammel, reklamasjonAr: "2022", reklamasjonManed: "3" }, 2)).toBe(true);
    expect(gyldigSteg({ ...gammel, reklamasjonAr: "2017", reklamasjonManed: "4" }, 2)).toBe(false);
    expect(gyldigSteg({ ...gammel, reklamasjonAr: "2026", reklamasjonManed: "11" }, 2)).toBe(false);
  });

  it("sendes til motoren som siste dag i måneden, og ikke når det ikke er spurt om", () => {
    const r = tilKlageInput({ ...gammel, reklamasjonAr: "2022", reklamasjonManed: "6" }, IDAG);
    expect(r.ok && r.input.feilen.forsteReklamasjon).toBe("2022-06-30");
    const ny = tilKlageInput({ ...gyldig }, IDAG);
    expect(ny.ok && "forsteReklamasjon" in ny.input.feilen).toBe(false);
  });
});
