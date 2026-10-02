import { describe, expect, it } from "vitest";
import { forsteUgyldigeSteg, fraParametre, gyldigKjopsdato, lesInnsending, tilParametre, sporOmReklamasjonsdato, oppdagetMulig, stegGyldig, TOM_INNSENDING, tilKlageInput, type Innsending, type Steg } from "./innsending";

const IDAG = "2026-10-01";

const gyldig: Innsending = {
  ...TOM_INNSENDING,
  kjopsdato: "2026-05-12",
  kjopesum: "189000",
  kmVedKjop: "112000",
  feiltyper: ["motor"],
  oppdaget: "innen_6_mnd",
  opplystForKjop: "nei",
  feilOpplysning: "nei",
  kontakt: "venter",
  verkstedrapport: "ja",
  rapportSierForKjop: "ja",
};

const gyldigSteg = (i: Innsending, steg: Steg) => stegGyldig(i, steg, IDAG);

describe("stegGyldig", () => {
  it("steg 1: kjøpsdato, kjøpesum og kilometerstand", () => {
    expect(gyldigSteg(TOM_INNSENDING, 1)).toBe(false);
    expect(gyldigSteg(gyldig, 1)).toBe(true);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2026-13-01" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2026-02-30" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "12.05.2026" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "1985-05-12" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopesum: "" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopesum: "0" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopesum: "189 000" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kmVedKjop: "" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kmVedKjop: "0" }, 1)).toBe(true);
    expect(gyldigSteg({ ...gyldig, kmVedKjop: "3000000" }, 1)).toBe(false);
  });

  it("steg 1 avviser kjøp i fremtiden, men godtar i dag", () => {
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2026-10-02" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2026-11-01" }, 1)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2026-10-01" }, 1)).toBe(true);
  });

  it("steg 2: feiltype og hvor lenge etter kjøpet feilen viste seg", () => {
    expect(gyldigSteg(TOM_INNSENDING, 2)).toBe(false);
    expect(gyldigSteg(gyldig, 2)).toBe(true);
    expect(gyldigSteg({ ...gyldig, feiltyper: [] }, 2)).toBe(false);
    expect(gyldigSteg({ ...gyldig, oppdaget: "" }, 2)).toBe(false);
  });

  it("steg 2 avviser et oppdaget-svar som er umulig for kjøpstidspunktet", () => {
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2026-08-12", oppdaget: "6_mnd_til_2_ar" }, 2)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2026-03-12", oppdaget: "6_mnd_til_2_ar" }, 2)).toBe(true);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2025-05-12", oppdaget: "over_2_ar" }, 2)).toBe(false);
    expect(gyldigSteg({ ...gyldig, kjopsdato: "2024-09-12", oppdaget: "over_2_ar" }, 2)).toBe(true);
  });

  it("steg 3 krever alle svar", () => {
    expect(gyldigSteg(gyldig, 3)).toBe(true);
    expect(gyldigSteg({ ...gyldig, kontakt: "" }, 3)).toBe(false);
    expect(gyldigSteg({ ...gyldig, opplystForKjop: "" }, 3)).toBe(false);
    expect(gyldigSteg({ ...gyldig, feilOpplysning: "" }, 3)).toBe(false);
    expect(gyldigSteg({ ...gyldig, feilOpplysning: "ja_dokumentert" }, 3)).toBe(true);
    expect(gyldigSteg({ ...gyldig, feilOpplysning: "ja_udokumentert" }, 3)).toBe(true);
  });

  it("steg 4: rapport krever svar om hva den sier, ingen rapport krever svar om bilder", () => {
    expect(gyldigSteg(TOM_INNSENDING, 4)).toBe(false);
    expect(gyldigSteg(gyldig, 4)).toBe(true);
    expect(gyldigSteg({ ...gyldig, rapportSierForKjop: "" }, 4)).toBe(false);
    expect(gyldigSteg({ ...gyldig, verkstedrapport: "nei" }, 4)).toBe(false);
    expect(gyldigSteg({ ...gyldig, verkstedrapport: "nei", bilder: "nei" }, 4)).toBe(true);
  });
});

describe("oppdagetMulig", () => {
  it("er aldri mulig før kjøpsdatoen er valgt, eller når den er ugyldig", () => {
    expect(oppdagetMulig({ kjopsdato: "" }, "innen_6_mnd", IDAG)).toBe(false);
    expect(oppdagetMulig({ kjopsdato: "2026-02-30" }, "innen_6_mnd", IDAG)).toBe(false);
    expect(oppdagetMulig({ kjopsdato: "2026-11-01" }, "innen_6_mnd", IDAG)).toBe(false);
  });

  it("følger tiden som har gått siden kjøpet", () => {
    const nylig = { kjopsdato: "2026-09-15" };
    expect(oppdagetMulig(nylig, "innen_6_mnd", IDAG)).toBe(true);
    expect(oppdagetMulig(nylig, "6_mnd_til_2_ar", IDAG)).toBe(false);
    const ettAr = { kjopsdato: "2025-06-15" };
    expect(oppdagetMulig(ettAr, "6_mnd_til_2_ar", IDAG)).toBe(true);
    expect(oppdagetMulig(ettAr, "over_2_ar", IDAG)).toBe(false);
    expect(oppdagetMulig({ kjopsdato: "2024-09-15" }, "over_2_ar", IDAG)).toBe(true);
    // To the day: two years after 2 October 2024 has not passed on 1 October 2026.
    expect(oppdagetMulig({ kjopsdato: "2024-10-02" }, "over_2_ar", IDAG)).toBe(false);
    expect(oppdagetMulig({ kjopsdato: "2024-10-01" }, "over_2_ar", IDAG)).toBe(true);
  });
});

describe("gyldigKjopsdato", () => {
  it("godtar en virkelig dag fra 1990 til i dag", () => {
    expect(gyldigKjopsdato("2024-02-29", IDAG)).toBe(true);
    expect(gyldigKjopsdato("1990-01-01", IDAG)).toBe(true);
    for (const d of ["", "2023-02-29", "2026-10-02", "1989-12-31", "2026-5-12", "i går"]) expect(gyldigKjopsdato(d, IDAG)).toBe(false);
  });
});

describe("eldre lenker med måned og år", () => {
  it("blir siste dag i kjøpsmåneden", () => {
    expect(lesInnsending({ kjopManed: "2", kjopAr: "2024" }).kjopsdato).toBe("2024-02-29");
    expect(lesInnsending({ kjopManed: "12", kjopAr: "2023" }).kjopsdato).toBe("2023-12-31");
  });

  it("virker også for adressen til en gammel lenke", () => {
    expect(fraParametre({ kjopAr: "2024", kjopManed: "2", kjopesum: "189000" })).toEqual({ ...TOM_INNSENDING, kjopsdato: "2024-02-29", kjopesum: "189000" });
    expect(fraParametre(new URLSearchParams("kjopAr=2023&kjopManed=12")).kjopsdato).toBe("2023-12-31");
  });

  it("gir tom dato for ugyldig måned eller år, og full dato går foran", () => {
    expect(lesInnsending({ kjopManed: "13", kjopAr: "2024" }).kjopsdato).toBe("");
    expect(lesInnsending({ kjopManed: "5" }).kjopsdato).toBe("");
    expect(lesInnsending({ kjopsdato: "2024-03-12", kjopManed: "5", kjopAr: "2020" }).kjopsdato).toBe("2024-03-12");
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
    expect(input.bilOgKjop).toEqual({ kjopsdato: "2026-05-12", kjopesumNok: 189000, kmVedKjop: 112000 });
    expect(input.feilen).toEqual({ typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "venter" });
    expect(input.bevis).toEqual({ verkstedrapport: true, rapportSierForKjop: true, bilder: false });
  });

  it("ignorerer felt skjemaet ikke lenger sender", () => {
    const input = ok({ ...gyldig, regnr: "EK 48213", beskrivelse: "Motoren har havarert", kjopesumNok: "1" });
    expect(input.bilOgKjop).toEqual({ kjopsdato: "2026-05-12", kjopesumNok: 189000, kmVedKjop: 112000 });
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
    expect(tilKlageInput({ ...gyldig, kjopesum: 189000 }, IDAG).ok).toBe(false);
    expect(tilKlageInput({ ...gyldig, kmVedKjop: "-5" }, IDAG).ok).toBe(false);
  });
});

describe("dato for første reklamasjon", () => {
  const gammel: Innsending = { ...gyldig, kjopsdato: "2017-05-12", oppdaget: "over_2_ar", kontakt: "forsokt" };

  it("spørres bare når kjøpet er over fem år gammelt og forhandleren er kontaktet", () => {
    expect(sporOmReklamasjonsdato(gammel, IDAG)).toBe(true);
    expect(sporOmReklamasjonsdato({ ...gammel, kontakt: "nei" }, IDAG)).toBe(false);
    expect(sporOmReklamasjonsdato({ ...gammel, kjopsdato: "2022-05-12" }, IDAG)).toBe(false);
  });

  it("må oppgis, ikke ligge før kjøpet eller i fremtiden", () => {
    expect(gyldigSteg(gammel, 3)).toBe(false);
    expect(gyldigSteg({ ...gammel, reklamasjonAr: "2022", reklamasjonManed: "3" }, 3)).toBe(true);
    expect(gyldigSteg({ ...gammel, reklamasjonAr: "2017", reklamasjonManed: "4" }, 3)).toBe(false);
    expect(gyldigSteg({ ...gammel, reklamasjonAr: "2026", reklamasjonManed: "11" }, 3)).toBe(false);
  });

  it("sendes til motoren som siste dag i måneden, og ikke når det ikke er spurt om", () => {
    const r = tilKlageInput({ ...gammel, reklamasjonAr: "2022", reklamasjonManed: "6" }, IDAG);
    expect(r.ok && r.input.feilen.forsteReklamasjon).toBe("2022-06-30");
    const ny = tilKlageInput({ ...gyldig }, IDAG);
    expect(ny.ok && "forsteReklamasjon" in ny.input.feilen).toBe(false);
  });
});

describe("URL-parametre", () => {
  it("rundturer svarene, inkludert flere feiltyper", () => {
    const i: Innsending = { ...gyldig, feiltyper: ["motor", "rust"] };
    const p = tilParametre(i);
    expect(p.get("feiltyper")).toBe("motor,rust");
    expect(p.has("bilder")).toBe(false);
    expect(fraParametre(p)).toEqual(i);
    expect(fraParametre(Object.fromEntries(p))).toEqual(i);
  });

  it("ignorerer ukjente feiltyper og manglende parametre", () => {
    expect(fraParametre({ feiltyper: "motor,xx", kjopsdato: ["2024-03-12", "2025-03-12"] })).toEqual({ ...TOM_INNSENDING, feiltyper: ["motor"], kjopsdato: "2024-03-12" });
  });

  it("finner første ugyldige steg", () => {
    expect(forsteUgyldigeSteg(gyldig, IDAG)).toBeNull();
    expect(forsteUgyldigeSteg({ ...gyldig, verkstedrapport: "" }, IDAG)).toBe(4);
    expect(forsteUgyldigeSteg(TOM_INNSENDING, IDAG)).toBe(1);
  });
});
