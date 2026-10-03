import { describe, expect, it, vi } from "vitest";
import klager from "./testdata/klager.json";
import type { Statistikk } from "./statistikk";
import type { KlageInput, TestKlage } from "./typer";
import { vurder, type Avhengigheter } from "./vurder";

const IDAG = "2026-10-01";
const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);

// Case 4 has documented wrong information (+1); these tests want the plain presumption case.
const hentNeutral = (id: number): KlageInput => {
  const i = hent(id);
  i.feilen.feilOpplysning = "nei";
  return i;
};

// lav/hoy set ±0.05 around the share, compared with a baseline of 0.6: 0.6 is neutral, 0.8 counts +1,
// 0.3 counts −1.
const stat = (andel: number, spesifikk = true, basis = 0.6): Statistikk => ({
  n: 200,
  vunnet: Math.round(andel * 200),
  andel,
  lav: andel - 0.05,
  hoy: andel + 0.05,
  basis,
  trinn: 1,
  beskrivelse: "test",
  spesifikk,
});

const dep = (andel = 0.6, spesifikk = true, basis = 0.6): Avhengigheter => ({
  hentStatistikk: vi.fn(async () => stat(andel, spesifikk, basis)),
  idag: IDAG,
});

describe("frister", () => {
  it("over fem år uten kontakt stopper saken, med forklaring og uten å miste unntakene", async () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2021-03-31";
    const d = dep(0.9);
    const v = await vurder(i, d);
    expect(v.niva).toBe("utenfor");
    expect(v.begrunnelse).toMatch(/mer enn fem år/);
    expect(v.eksempel).toBeNull();
    expect(v.grunnlag[0]).toMatchObject({ vekt: "mot", paragraf: "forbrukerkjøpsloven § 27" });
    expect(v.grunnlag[0].tekst).toMatch(/garanti som varer lenger, eller har opptrådt uredelig eller grovt uaktsomt/);
    expect(d.hentStatistikk).not.toHaveBeenCalled();
  });
});

describe("nivå", () => {
  it("presumsjon gir god sak, med eller uten rapport, rettingsforsøk og statistikk", async () => {
    expect((await vurder(hent(1), dep(0.8))).niva).toBe("god");
    expect((await vurder(hentNeutral(4), dep())).niva).toBe("god");
    expect((await vurder(hentNeutral(4), dep(0.3))).niva).toBe("god");
  });

  it("utenfor presumsjon uten rapport gir svak, selv med god statistikk", async () => {
    expect((await vurder(hent(6), dep())).niva).toBe("svak");
    expect((await vurder(hent(6), dep(0.8))).niva).toBe("svak");
  });

  it("utenfor presumsjon løfter en rapport som sier «til stede ved kjøp» saken", async () => {
    const i = hent(6);
    i.bevis.verkstedrapport = true;
    i.bevis.rapportSierForKjop = true;
    expect((await vurder(i, dep())).niva).toBe("god");
  });

  it("utenfor presumsjon uten rapport er saken svak, uansett om forhandleren er kontaktet", async () => {
    const i = hent(6);
    i.feilen.kontakt = "ja";
    expect((await vurder(i, dep(0.3))).niva).toBe("svak");
    i.feilen.kontakt = "nei";
    expect((await vurder(i, dep())).niva).toBe("svak");
  });

  it("statistikken avgjør ikke nivået, men følger med vurderingen", async () => {
    const v = await vurder(hentNeutral(4), dep(0.8));
    expect(v.niva).toBe("god");
    expect(v.statistikk?.andel).toBe(0.8);
  });

  it("dokumenterte feilopplysninger nevnes i begrunnelsen", async () => {
    const v = await vurder(hent(4), dep(0.6));
    expect(v.begrunnelse).toMatch(/uriktige opplysninger/);
    const udokumentert = hent(4);
    udokumentert.feilen.feilOpplysning = "ja_udokumentert";
    expect((await vurder(udokumentert, dep(0.6))).begrunnelse).not.toMatch(/uriktige opplysninger/);
  });
});

describe("tak", () => {
  it("opplyst feil gir svak når bilen er kjøpt før 2024", async () => {
    const i = hent(3);
    i.bilOgKjop.kjopsdato = "2023-12-31";
    i.bevis.bilder = true;
    expect((await vurder(i, dep(0.9))).niva).toBe("svak");
  });

  it("opplyst feil gir fortsatt god sak for kjøp fra 2024", async () => {
    const i = hent(3);
    i.bevis.bilder = true;
    const v = await vurder(i, dep(0.9));
    expect(v.niva).toBe("god");
    expect(v.eksempel?.setning).not.toMatch(/gjort kjent med feilen/);
  });

  it("ikke klaget ennå senker ikke nivået når feilen er oppdaget nylig", async () => {
    const i = hent(1);
    const for_ = await vurder(i, dep(0.8));
    i.feilen.kontakt = "nei";
    const v = await vurder(i, dep(0.8));
    expect(v.niva).toBe(for_.niva);
    expect(v.niva).not.toBe("svak");
    expect(v.begrunnelse).not.toMatch(/ikke klaget/);
  });

  it("ikke klaget og feilen har helt sikkert vært kjent i over ett år gir svak sak med et punkt mot", async () => {
    // Defect inside six months of a purchase in January 2022: known since July 2022 at the latest.
    const i = hent(1);
    i.bilOgKjop.kjopsdato = "2022-01-31";
    i.feilen.kontakt = "nei";
    const v = await vurder(i, dep(0.8));
    expect(v.niva).toBe("svak");
    expect(v.grunnlag.find((g) => /kjent til den i over ett år/.test(g.tekst))).toMatchObject({ vekt: "mot", paragraf: "forbrukerkjøpsloven § 27" });
    expect(v.begrunnelse).toMatch(/trolig ventet over ett år/);
    i.feilen.kontakt = "ja";
    expect((await vurder(i, dep(0.8))).niva).toBe("god");
  });

  it("kjøp fra firma eller privatperson stopper saken uten statistikk og eksempel", async () => {
    for (const [kjopsform, tittel] of [
      ["firma", /Forbrukerkjøpsloven gjelder ikke for dette kjøpet/],
      ["privatperson", /gjelder ikke når du kjøper av en privatperson/],
    ] as const) {
      const i = hent(1);
      i.bilOgKjop.kjopsform = kjopsform;
      const d = dep(0.9);
      const v = await vurder(i, d);
      expect(v.niva).toBe("utenfor");
      expect(v.tittel).toMatch(tittel);
      expect(v.eksempel).toBeNull();
      expect(v.tiltak).toEqual([]);
      expect(v.grunnlag).toHaveLength(1);
      expect(d.hentStatistikk).not.toHaveBeenCalled();
    }
  });

  it("rapport som ikke sier noe om tidspunkt gir fortsatt god sak innenfor presumsjon", async () => {
    const v = await vurder(hent(8), dep(0.8));
    expect(v.niva).toBe("god");
    expect(v.begrunnelse).toMatch(/verkstedrapporten sier ikke om feilen var til stede ved levering/);
  });

  it("opplyst feil med dokumentert villedende opplysning gir ikke tak", async () => {
    const i = hent(3);
    i.bilOgKjop.kjopsdato = "2023-12-31";
    i.bilOgKjop.kjopesumNok = 139000; // case 3 is a cheap car, which has a cap of its own
    i.bevis.bilder = true;
    i.feilen.feilOpplysning = "ja_dokumentert";
    const v = await vurder(i, dep(0.9));
    expect(v.niva).toBe("god");
    expect(v.begrunnelse).toMatch(/du visste om feilen, men du kan dokumentere at opplysningene var misvisende/);
  });

  it("opplyst feil med udokumentert påstand om villedende opplysning gir fortsatt god sak", async () => {
    const i = hent(3);
    i.bilOgKjop.kjopsdato = "2023-12-31";
    i.bevis.bilder = true;
    i.feilen.feilOpplysning = "ja_udokumentert";
    const v = await vurder(i, dep(0.9));
    expect(v.niva).toBe("god");
    expect(v.begrunnelse).toMatch(/du visste om feilen, men mener opplysningene var misvisende/);
  });
});

describe("pris og kjørelengde (fkjl § 15)", () => {
  it("billig bil eller høy kjørelengde endrer ikke nivået, men sier hvorfor", async () => {
    for (const [pris, km, tekst] of [
      [49999, 112000, /kostet under 50 000 kr\. Da kan du forvente mindre/],
      [219000, 200001, /hadde gått over 200 000 km da du kjøpte den\. Da kan du forvente mindre/],
      [35000, 240000, /kostet under 50 000 kr og hadde gått over 200 000 km/],
    ] as const) {
      const i = hent(1);
      i.bilOgKjop.kjopesumNok = pris;
      i.bilOgKjop.kmVedKjop = km;
      const v = await vurder(i, dep(0.8));
      expect(v.niva).toBe("god");
      expect(v.grunnlag.find((g) => tekst.test(g.tekst))).toMatchObject({ vekt: "mot", paragraf: "forbrukerkjøpsloven § 15" });
    }
  });

  it("grensene er 50 000 kr og 200 000 km, og manglende tall gir ikke tak", async () => {
    const i = hent(1);
    i.bilOgKjop.kjopesumNok = 50000;
    i.bilOgKjop.kmVedKjop = 200000;
    expect((await vurder(i, dep(0.8))).niva).toBe("god");
    i.bilOgKjop.kjopesumNok = null;
    i.bilOgKjop.kmVedKjop = undefined;
    expect((await vurder(i, dep(0.8))).niva).toBe("god");
  });

  it("gjelder ikke når feilen er uriktig kilometerstand eller historikk", async () => {
    const i = hent(1);
    i.feilen.typer = ["km_service"];
    i.bilOgKjop.kjopesumNok = 35000;
    const v = await vurder(i, dep(0.8));
    expect(v.niva).toBe("god");
    expect(v.grunnlag.some((g) => /vanlig slitasje/.test(g.tekst))).toBe(false);
  });
});

describe("udokumentert feil", () => {
  it("uten rapport og bilder er saken fortsatt god innenfor presumsjonen, uten å påstå noe om dokumentasjon", async () => {
    const v = await vurder(hent(10), dep(0.8));
    expect(v.niva).toBe("god");
    expect(v.begrunnelse).not.toMatch(/dokumentasjon/);
    expect(v.grunnlag.some((g) => /dokumentert selve feilen/.test(g.tekst))).toBe(false);
  });
});

describe("kontakt med forhandleren", () => {
  it("å ikke ha kontaktet forhandleren trekker ikke ned og nevnes ikke, men gir et tips om å la forhandleren rette først", async () => {
    const i = hent(1);
    i.feilen.kontakt = "nei";
    const v = await vurder(i, dep(0.8));
    expect(v.niva).toBe("god");
    expect(v.begrunnelse).not.toMatch(/reklamert|reklamer|bør du/i);
    expect(v.tiltak.map((t) => t.tittel)).toEqual(["La forhandleren rette feilen først"]);
  });

  it("å ha kontaktet forhandleren gir ikke noe tips", async () => {
    const i = hent(1);
    i.feilen.kontakt = "ja";
    const v = await vurder(i, dep(0.8));
    expect(v.niva).toBe("god");
    expect(v.tiltak).toEqual([]);
  });
});

describe("tittel og begrunnelse", () => {
  it("tittelen er den samme for gode og svake saker", async () => {
    const tittel = "Du kan ha en sak mot forhandleren.";
    expect((await vurder(hent(1), dep(0.8))).tittel).toBe(tittel);
    expect((await vurder(hentNeutral(4), dep())).tittel).toBe(tittel);
    const svak = await vurder(hent(6), dep());
    expect(svak.niva).toBe("svak");
    expect(svak.tittel).toBe(tittel);
  });

  it("også en svak sak får et eksempel der kjøperen fikk medhold", async () => {
    const v = await vurder(hent(6), dep());
    expect(v.niva).toBe("svak");
    expect(v.eksempel?.utfall).toBe("vunnet");
    expect(v.eksempel?.setning).not.toMatch(/ ikke medhold /);
  });

  it("begrunnelsen er én setning med tidspunkt, opplysning og dokumentasjon", async () => {
    const i = hent(1);
    i.feilen.kontakt = "nei";
    expect((await vurder(i, dep())).begrunnelse).toBe(
      "Feilen ble oppdaget innen seks måneder etter kjøpet, du visste ikke om den før kjøpet, og verkstedrapporten peker på en feil som sannsynligvis var til stede ved levering.",
    );
    expect((await vurder(hent(3), dep())).begrunnelse).toMatch(/du visste om feilen før kjøpet/);
    expect((await vurder(hent(6), dep())).begrunnelse).toMatch(/^Feilen ble oppdaget mer enn to år etter kjøpet/);
  });

  it("inneholder ingen tekniske rester", async () => {
    for (const id of [1, 3, 4, 5, 6, 7, 8, 10]) {
      const v = await vurder(hent(id), dep());
      expect(`${v.tittel} ${v.begrunnelse}`).not.toMatch(/undefined|NaN|null|XX\d|Testbil/);
    }
  });
});

describe("tiltak", () => {
  const titler = async (i: KlageInput) => (await vurder(i, dep())).tiltak.map((t) => t.tittel);

  it("foreslår det som mangler, og ingenting når saken er dokumentert", async () => {
    expect(await titler(hent(10))).toEqual(["Få en verksted- eller tilstandsrapport", "Dokumenter feilen med bilder eller film"]);
    expect(await titler(hent(8))).toEqual(["Be et uavhengig verksted vurdere når feilen oppsto"]);
    expect(await titler(hent(1))).toEqual([]);
  });

  it("foreslår å ta vare på annonsen når opplysningene var uriktige og ikke dokumentert", async () => {
    const i = hent(5);
    i.feilen.feilOpplysning = "ja_udokumentert";
    expect(await titler(i)).toContain("Ta vare på annonsen og meldingene");
    expect(await titler(hent(5))).not.toContain("Ta vare på annonsen og meldingene");
  });
});
