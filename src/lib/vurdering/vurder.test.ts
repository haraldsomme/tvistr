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

// lav/hoy set ±0.05 around the share: 0.6 is neutral, 0.8 counts +1, 0.3 counts −1.
const stat = (andel: number, spesifikk = true): Statistikk => ({
  n: 200,
  vunnet: Math.round(andel * 200),
  andel,
  lav: andel - 0.05,
  hoy: andel + 0.05,
  trinn: 1,
  beskrivelse: "test",
  spesifikk,
});

const dep = (andel = 0.6, spesifikk = true): Avhengigheter => ({
  hentStatistikk: vi.fn(async () => stat(andel, spesifikk)),
  idag: IDAG,
});

describe("utenfor tjenesten og frister", () => {
  it("privat selger og næringsbruk er ikke aktuelt, uten å spørre databasen", async () => {
    const d = dep(0.9);
    expect((await vurder(hent(2), d)).niva).toBe("ikke_aktuell");
    expect((await vurder(hent(9), d)).niva).toBe("ikke_aktuell");
    expect(d.hentStatistikk).not.toHaveBeenCalled();
  });

  it("over fem år uten kontakt er ikke aktuelt, med forklaring", async () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2021-03-31";
    const d = dep(0.9);
    const v = await vurder(i, d);
    expect(v.niva).toBe("ikke_aktuell");
    expect(v.begrunnelse).toMatch(/innen fem år/);
    expect(v.tittel).toMatch(/Fristen/);
    expect(v.tiltak).toEqual([]);
    expect(v.grunnlag.map((g) => g.paragraf)).toEqual(["forbrukerkjøpsloven § 27"]);
    expect(d.hentStatistikk).not.toHaveBeenCalled();
  });
});

describe("poengkort", () => {
  it("presumsjon, rapport, rettingsforsøk og god statistikk gir sterk", async () => {
    const v = await vurder(hent(1), dep(0.8));
    expect(v.poeng).toBe(5); // stat 1 + presumsjon 2 + rapport 1 + forsøkt 1
    expect(v.niva).toBe("sterk");
  });

  it("presumsjon alene gir middels", async () => {
    const v = await vurder(hentNeutral(4), dep());
    expect(v.poeng).toBe(2);
    expect(v.niva).toBe("middels");
  });

  it("utenfor presumsjon uten rapport gir svak, selv med god statistikk", async () => {
    expect((await vurder(hent(6), dep())).niva).toBe("svak");
    expect((await vurder(hent(6), dep(0.8))).niva).toBe("svak");
  });

  it("utenfor presumsjon løfter en rapport som sier «til stede ved kjøp» saken", async () => {
    const i = hent(6);
    i.bevis.verkstedrapport = true;
    i.bevis.rapportSierForKjop = true;
    expect((await vurder(i, dep())).niva).toBe("middels");
    i.feilen.kontakt = "forsokt";
    expect((await vurder(i, dep())).niva).toBe("sterk");
  });

  it("statistikk teller bare når intervallet er tydelig, og bare når den er spesifikk", async () => {
    expect((await vurder(hentNeutral(4), dep(0.8))).poeng).toBe(3);
    expect((await vurder(hentNeutral(4), dep(0.6))).poeng).toBe(2);
    expect((await vurder(hentNeutral(4), dep(0.3))).poeng).toBe(1);
    expect((await vurder(hentNeutral(4), dep(0.8, false))).poeng).toBe(2);
  });

  it("dokumenterte feilopplysninger gir et poeng", async () => {
    const v = await vurder(hent(4), dep(0.6));
    expect(v.poeng).toBe(3);
    expect(v.begrunnelse).toMatch(/uriktige opplysninger/);
    const udokumentert = hent(4);
    udokumentert.feilen.feilOpplysning = "ja_udokumentert";
    expect((await vurder(udokumentert, dep(0.6))).begrunnelse).not.toMatch(/uriktige opplysninger/);
  });
});

describe("tak", () => {
  it("opplyst feil gir svak selv med høye poeng", async () => {
    expect((await vurder(hent(3), dep(0.9))).niva).toBe("svak");
  });

  it("rapport som ikke sier noe om tidspunkt gir tak på middels innenfor presumsjon", async () => {
    const v = await vurder(hent(8), dep(0.8));
    expect(v.poeng).toBeGreaterThanOrEqual(3);
    expect(v.niva).toBe("middels");
    expect(v.begrunnelse).toMatch(/verkstedrapporten sier ikke om feilen var til stede ved levering/);
  });

  it("opplyst feil med dokumentert villedende opplysning gir ikke tak", async () => {
    const i = hent(3);
    i.bevis.bilder = true;
    i.feilen.feilOpplysning = "ja_dokumentert";
    const v = await vurder(i, dep(0.9));
    expect(v.niva).toBe("sterk");
    expect(v.begrunnelse).toMatch(/du ble fortalt om feilen, men du kan dokumentere at opplysningene var misvisende/);
  });

  it("opplyst feil med udokumentert påstand om villedende opplysning gir tak på middels", async () => {
    const i = hent(3);
    i.bevis.bilder = true;
    i.feilen.feilOpplysning = "ja_udokumentert";
    const v = await vurder(i, dep(0.9));
    expect(v.niva).toBe("middels");
    expect(v.begrunnelse).toMatch(/du ble fortalt om feilen, men mener opplysningene var misvisende/);
  });
});

describe("udokumentert feil", () => {
  it("uten rapport og bilder blir saken høyst middels, selv innenfor presumsjonen", async () => {
    const v = await vurder(hent(10), dep(0.8));
    expect(v.poeng).toBeGreaterThanOrEqual(3);
    expect(v.niva).toBe("middels");
    expect(v.begrunnelse).toMatch(/ingen dokumentasjon av feilen/);
    const medBilder = hent(10);
    medBilder.bevis.bilder = true;
    expect((await vurder(medBilder, dep(0.8))).niva).toBe("sterk");
  });
});

describe("kontakt med forhandleren", () => {
  it("å ikke ha kontaktet forhandleren trekker ikke ned og nevnes ikke", async () => {
    for (const kontakt of ["nei", "venter"] as const) {
      const i = hent(1);
      i.feilen.kontakt = kontakt;
      const v = await vurder(i, dep(0.8));
      expect(v.niva).toBe("sterk");
      expect(v.begrunnelse).not.toMatch(/reklamert|reklamer|bør du/i);
      expect(v.tittel).toBe("Du har etter alt å dømme krav på at forhandleren retter feilen.");
      expect(v.tiltak).toEqual([]);
    }
  });

  it("forsøkt og avvist forklares i begrunnelsen", async () => {
    expect((await vurder(hent(1), dep())).begrunnelse).toMatch(/forsøkt å rette den uten å lykkes/);
    expect((await vurder(hent(5), dep())).begrunnelse).toMatch(/avvist å rette/);
  });
});

describe("tittel og begrunnelse", () => {
  it("tittelen følger nivået og om forhandleren har fått forsøke å rette", async () => {
    expect((await vurder(hent(1), dep(0.8))).tittel).toBe("Du har etter alt å dømme krav på prisavslag eller heving.");
    expect((await vurder(hentNeutral(4), dep())).tittel).toBe("Du kan ha krav på at forhandleren retter feilen.");
    expect((await vurder(hent(6), dep())).tittel).toBe("Det blir vanskelig å nå fram med et krav slik saken står nå.");
  });

  it("begrunnelsen er én setning med tidspunkt, opplysning og dokumentasjon", async () => {
    const i = hent(1);
    i.feilen.kontakt = "nei";
    expect((await vurder(i, dep())).begrunnelse).toBe(
      "Feilen ble oppdaget innen seks måneder etter kjøpet, du ble ikke informert om den, og verkstedrapporten peker på en feil som sannsynligvis var til stede ved levering.",
    );
    expect((await vurder(hent(3), dep())).begrunnelse).toMatch(/du ble informert om den før kjøpet/);
    expect((await vurder(hent(6), dep())).begrunnelse).toMatch(/^Feilen ble oppdaget mer enn to år etter kjøpet/);
  });

  it("inneholder ingen tekniske rester", async () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const v = await vurder(hent(id), dep());
      expect(`${v.tittel} ${v.begrunnelse}`).not.toMatch(/undefined|NaN|null|XX\d|Testbil/);
    }
  });
});

describe("tiltak", () => {
  const titler = async (i: KlageInput) => (await vurder(i, dep())).tiltak.map((t) => t.tittel);

  it("foreslår det som mangler, og ingenting når saken er dokumentert", async () => {
    expect(await titler(hent(10))).toEqual([
      "Få en verksted- eller tilstandsrapport",
      "Dokumenter feilen med bilder eller film",
      "Sjekk annonsen og kontrakten", // case 10 is unsure whether the defect was disclosed
    ]);
    expect(await titler(hent(8))).toEqual(["Be et uavhengig verksted vurdere når feilen oppsto"]);
    expect(await titler(hent(1))).toEqual([]);
  });

  it("foreslår å sjekke annonsen og kontrakten når kjøperen er usikker på om feilen ble opplyst", async () => {
    const i = hent(1);
    i.feilen.opplystForKjop = "usikker";
    expect(await titler(i)).toEqual(["Sjekk annonsen og kontrakten"]);
  });

  it("foreslår å ta vare på annonsen når opplysningene var uriktige og ikke dokumentert", async () => {
    const i = hent(5);
    i.feilen.feilOpplysning = "ja_udokumentert";
    expect(await titler(i)).toContain("Ta vare på annonsen og meldingene");
    expect(await titler(hent(5))).not.toContain("Ta vare på annonsen og meldingene");
  });
});
