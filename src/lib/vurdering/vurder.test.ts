import { describe, expect, it, vi } from "vitest";
import klager from "./testdata/klager.json";
import type { Tolkning } from "./faktorer";
import type { Statistikk } from "./statistikk";
import type { KlageInput, TestKlage } from "./typer";
import { vurder, type Avhengigheter } from "./vurder";

const IDAG = "2026-10-01";
const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);

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

const dep = (andel = 0.6, tolkning: Tolkning | null = null, spesifikk = true): Avhengigheter => ({
  tolk: async () => tolkning,
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

  it("over fem år uten kontakt er ikke aktuelt, med forklaring og uten krav eller råd", async () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2021-03-01";
    i.feilen.oppdagetDato = "2021-05-01";
    const d = dep(0.9);
    const v = await vurder(i, d);
    expect(v.niva).toBe("ikke_aktuell");
    expect(v.begrunnelse).toMatch(/innen fem år/);
    expect(v.krav).toBeNull();
    expect(v.tiltak).toEqual([]);
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
    const v = await vurder(hent(4), dep());
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
    expect((await vurder(hent(4), dep(0.8))).poeng).toBe(3);
    expect((await vurder(hent(4), dep(0.6))).poeng).toBe(2);
    expect((await vurder(hent(4), dep(0.3))).poeng).toBe(1);
    expect((await vurder(hent(4), dep(0.8, null, false))).poeng).toBe(2);
  });

  it("dokumenterte feilopplysninger gir et poeng", async () => {
    const v = await vurder(hent(4), dep(0.6, { feiltyper: ["rust"], mangelsgrunnlag: ["feil_opplysninger"], kvalitet: "god" }));
    expect(v.poeng).toBe(3);
    expect(v.begrunnelse).toMatch(/uriktige opplysninger/);
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
    expect(v.begrunnelse).toMatch(/vurderer den derfor som middels sterk/);
  });

  it("ubrukelig beskrivelse gir svak og råd om å beskrive feilen", async () => {
    const i = hent(1);
    i.feilen.beskrivelse = "blabla";
    const v = await vurder(i, dep(0.8));
    expect(v.niva).toBe("svak");
    expect(v.tiltak[0]).toMatchObject({ tittel: "Beskriv feilen", steg: 2 });
    expect((await vurder(hent(1), dep(0.8, { feiltyper: [], mangelsgrunnlag: [], kvalitet: "ubrukelig" }))).niva).toBe("svak");
  });

  it("tynn beskrivelse gir tak på middels, og kort tekst uten modellsvar regnes som tynn", async () => {
    expect((await vurder(hent(1), dep(0.8, { feiltyper: [], mangelsgrunnlag: [], kvalitet: "tynn" }))).niva).toBe("middels");
    const kort = hent(1);
    kort.feilen.beskrivelse = "Girkassen hakker.";
    const v = await vurder(kort, dep(0.8));
    expect(v.niva).toBe("middels");
    expect(v.tiltak[0].tittel).toBe("Beskriv feilen mer detaljert");
  });
});

describe("udokumentert feil", () => {
  it("uten rapport og bilder blir saken høyst middels, selv innenfor presumsjonen", async () => {
    const v = await vurder(hent(10), dep(0.8));
    expect(v.poeng).toBeGreaterThanOrEqual(3);
    expect(v.niva).toBe("middels");
    expect(v.begrunnelse).toMatch(/ingen dokumentasjon av selve feilen/);
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
      expect(v.tiltak.map((t) => t.tittel).join(" ")).not.toMatch(/rette feilen|reklam/i);
    }
  });

  it("forsøkt og avvist forklares i begrunnelsen", async () => {
    expect((await vurder(hent(1), dep())).begrunnelse).toMatch(/forsøkt å rette feilen uten å lykkes/);
    expect((await vurder(hent(5), dep())).begrunnelse).toMatch(/avvist å rette/);
  });
});

describe("begrunnelse", () => {
  it("forklarer presumsjonen med riktig periode", async () => {
    expect((await vurder(hent(1), dep())).begrunnelse).toMatch(/innen to år etter at du overtok bilen/);
    const gammel = hent(1);
    gammel.bilOgKjop.kjopsdato = "2023-10-01";
    gammel.feilen.oppdagetDato = "2023-11-01";
    expect((await vurder(gammel, dep())).begrunnelse).toMatch(/innen seks måneder/);
    expect((await vurder(hent(6), dep())).begrunnelse).toMatch(/etter fristen på seks måneder.*Uten en verksted- eller tilstandsrapport/);
  });

  it("avslutter med samlet vurdering og inneholder ingen tekniske rester", async () => {
    for (const id of [1, 3, 4, 5, 6, 7, 8, 10]) {
      const v = await vurder(hent(id), dep());
      expect(v.begrunnelse).toMatch(/Samlet vurdering: (sterk|middels sterk|svak) sak\.$/);
      expect(v.begrunnelse).not.toMatch(/undefined|NaN|null|XX\d|Testbil/);
    }
  });
});

describe("krav og tiltak", () => {
  it("krav for alle ønsker bare for middels og sterk", async () => {
    const v = await vurder(hent(1), dep(0.8));
    expect(Object.keys(v.krav!).sort()).toEqual(["levere_tilbake", "pengene_tilbake_beholde", "reparasjon", "standard"]);
    expect((await vurder(hent(4), dep())).krav).not.toBeNull();
    expect((await vurder(hent(6), dep())).krav).toBeNull();
    expect((await vurder(hent(3), dep(0.9))).krav).toBeNull();
  });

  it("foreslår tiltak for manglende bevis, ikke for det som finnes", async () => {
    expect((await vurder(hent(10), dep())).tiltak.map((t) => t.tittel)).toEqual([
      "Finn kjøpekontrakten",
      "Få en verksted- eller tilstandsrapport",
      "Dokumenter feilen med bilder eller film",
    ]);
    expect((await vurder(hent(1), dep())).tiltak.map((t) => t.tittel)).toEqual(["Dokumenter feilen med bilder eller film"]);
    expect((await vurder(hent(5), dep())).tiltak).toEqual([]);
    expect((await vurder(hent(8), dep())).tiltak.map((t) => t.tittel)).toContain("Be et uavhengig verksted vurdere når feilen oppsto");
  });

  it("foreslår å ta vare på annonsen når saken gjelder opplysninger", async () => {
    const i = hent(1);
    i.bevis.annonse = false;
    expect((await vurder(i, dep(0.6, { feiltyper: ["km_avvik"], mangelsgrunnlag: [] }))).tiltak.map((t) => t.tittel)).toContain("Ta vare på annonsen");
    expect((await vurder(i, dep())).tiltak.map((t) => t.tittel)).not.toContain("Ta vare på annonsen");
  });
});
