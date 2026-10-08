import { describe, expect, it, vi } from "vitest";
import klager from "./testdata/klager.json";
import type { Statistikk } from "./statistikk";
import type { KlageInput, TestKlage } from "./typer";
import { vurder, type Avhengigheter } from "./vurder";

const IDAG = "2026-10-01";
const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);

const stat = (andel: number): Statistikk => ({
  n: 200,
  vunnet: Math.round(andel * 200),
  andel,
  lav: andel - 0.05,
  hoy: andel + 0.05,
  basis: 0.6,
  trinn: 1,
  beskrivelse: "test",
  spesifikk: false,
});

const dep = (andel = 0.6): Avhengigheter => ({
  hentStatistikk: vi.fn(async () => stat(andel)),
  idag: IDAG,
});

// Only what the assessment asks before purchase: the purchase, who it was from, when the defect showed and
// whether the buyer knew about it. Defect type, contact and evidence are asked after purchase.
const tynn = (kjopsdato: string, endre: Partial<KlageInput["feilen"]> = {}): KlageInput => ({
  bilOgKjop: { kjopsform: "forhandler", kjopsdato },
  feilen: { oppdaget: "innen_6_mnd", opplystForKjop: "nei", ...endre },
  bevis: {},
});

const INNENFOR_TO_AR = "Feilen viste seg innen 2 år etter kjøpet. Da er det forhandleren som må vise at den ikke var der da du kjøpte bilen.";
const INNENFOR_SEKS_MND = "Feilen viste seg innen 6 måneder etter kjøpet. Da er det forhandleren som må vise at den ikke var der da du kjøpte bilen.";
const UTENFOR_SEKS_MND =
  "Feilen viste seg mer enn 6 måneder etter kjøpet. Da må du vise at den var der da du kjøpte bilen, og du trenger en vurdering fra verksted. Etter kjøpet sier vi nøyaktig hva den må inneholde.";
const UTENFOR_TO_AR =
  "Feilen viste seg mer enn 2 år etter kjøpet. Da må du vise at den var der da du kjøpte bilen, og du trenger en vurdering fra verksted. Etter kjøpet sier vi nøyaktig hva den må inneholde.";
const VERRE = "Du visste om feilen, men den er verre eller annerledes enn du fikk vite. Brevet bygger på forskjellen.";

describe("stopp", () => {
  it("kjøp fra firma eller privatperson stopper saken uten statistikk", async () => {
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
      expect(v.grunnlag).toHaveLength(1);
      expect(v.varsler).toEqual([]);
      expect(d.hentStatistikk).not.toHaveBeenCalled();
    }
  });

  it("over fem år uten reklamasjon innen fem år stopper saken, med forklaring og uten å miste unntakene", async () => {
    for (const i of [
      tynn("2021-03-31", { reklamertInnenFemAr: false }),
      // An older case where the dealer was never told: the five years are past without a complaint.
      { ...hent(4), bilOgKjop: { ...hent(4).bilOgKjop, kjopsdato: "2021-03-31" } },
    ]) {
      const d = dep(0.9);
      const v = await vurder(i, d);
      expect(v.niva).toBe("utenfor");
      expect(v.begrunnelse).toMatch(/mer enn fem år/);
      expect(v.grunnlag[0]).toMatchObject({ vekt: "mot", paragraf: "forbrukerkjøpsloven § 27" });
      expect(v.grunnlag[0].tekst).toMatch(/garanti som varer lenger, eller har opptrådt uredelig eller grovt uaktsomt/);
      expect(d.hentStatistikk).not.toHaveBeenCalled();
    }
    expect((await vurder(tynn("2021-03-31", { reklamertInnenFemAr: true }), dep())).niva).toBe("sak");
  });

  it("en feil kjøperen kjente til slik den er, stopper saken for kjøp før 2024", async () => {
    const d = dep(0.9);
    const v = await vurder(tynn("2023-12-31", { opplystForKjop: "ja_som_opplyst" }), d);
    expect(v.niva).toBe("utenfor");
    expect(v.tittel).toBe("Du kan ikke klage på en feil du kjente til da du kjøpte bilen.");
    expect(v.begrunnelse).toBe(
      "Du kjøpte bilen før 1. januar 2024 og visste om feilen, slik den er. Etter forbrukerkjøpsloven § 16 tredje ledd, slik den gjaldt da, kan du ikke gjøre gjeldende som mangel noe du kjente til ved kjøpet. Er feilen verre eller annerledes enn du fikk vite, kan du gå tilbake og endre svaret.",
    );
    expect(v.grunnlag).toHaveLength(1);
    expect(v.grunnlag[0].vekt).toBe("mot");
    expect(d.hentStatistikk).not.toHaveBeenCalled();
  });

  it("en kjent feil stopper ikke for kjøp fra 2024", async () => {
    const v = await vurder(tynn("2024-01-01", { opplystForKjop: "ja_som_opplyst" }), dep());
    expect(v.niva).toBe("sak");
    expect(v.varsler).toEqual([INNENFOR_TO_AR]);
  });

  it("uten nøyaktig dato stopper en kjent feil bare når kjøpet sikkert var før 2024", async () => {
    const kjent = (kjopAlder: "under_2" | "2_5" | "over_5"): KlageInput => ({
      bilOgKjop: { kjopsform: "forhandler", kjopAlder },
      feilen: { oppdaget: "innen_6_mnd", opplystForKjop: "ja_som_opplyst", reklamertInnenFemAr: true },
      bevis: {},
    });
    expect((await vurder(kjent("over_5"), dep())).faktorer.stopp).toBe("kjent");
    // «2–5 år siden» can be a purchase from 2024: the exact date decides it after purchase.
    expect((await vurder(kjent("2_5"), dep())).niva).toBe("sak");
    expect((await vurder(kjent("under_2"), dep())).niva).toBe("sak");
  });

  it("«ja, men den er verre» stopper aldri, og gir et varsel om at brevet bygger på forskjellen", async () => {
    for (const kjopsdato of ["2019-05-31", "2023-12-31", "2024-01-01", "2026-06-30"]) {
      const v = await vurder(tynn(kjopsdato, { opplystForKjop: "ja_verre", reklamertInnenFemAr: true }), dep());
      expect(v.niva, kjopsdato).toBe("sak");
      expect(v.varsler.at(-1), kjopsdato).toBe(VERRE);
    }
  });
});

describe("varselet om bevisbyrden", () => {
  it("innenfor formodningsperioden er det forhandleren som må bevise", async () => {
    expect((await vurder(tynn("2026-02-14"), dep())).varsler).toEqual([INNENFOR_TO_AR]);
    expect((await vurder(tynn("2023-06-15"), dep())).varsler).toEqual([INNENFOR_SEKS_MND]);
    expect((await vurder(tynn("2025-07-01", { oppdaget: "6_mnd_til_2_ar" }), dep())).varsler).toEqual([INNENFOR_TO_AR]);
  });

  it("utenfor formodningsperioden må kjøperen bevise, med en vurdering fra verksted", async () => {
    expect((await vurder(tynn("2023-06-15", { oppdaget: "6_mnd_til_2_ar" }), dep())).varsler).toEqual([UTENFOR_SEKS_MND]);
    expect((await vurder(tynn("2023-06-15", { oppdaget: "over_2_ar" }), dep())).varsler).toEqual([UTENFOR_SEKS_MND]);
    expect((await vurder(tynn("2024-03-31", { oppdaget: "over_2_ar" }), dep())).varsler).toEqual([UTENFOR_TO_AR]);
  });

  it("varselet om forskjellen kommer etter varselet om bevisbyrden", async () => {
    expect((await vurder(tynn("2023-06-15", { oppdaget: "over_2_ar", opplystForKjop: "ja_verre" }), dep())).varsler).toEqual([UTENFOR_SEKS_MND, VERRE]);
  });
});

describe("sak", () => {
  it("alt som ikke stopper saken, er en sak, uansett rapport, kontakt, opplysninger og statistikk", async () => {
    for (const id of [1, 3, 4, 5, 6, 7, 8, 10]) {
      for (const andel of [0.3, 0.6, 0.9]) {
        const v = await vurder(hent(id), dep(andel));
        expect(v.niva, `${id} ${andel}`).toBe("sak");
        expect(v.tittel).toBe("Du kan ha en sak mot forhandleren.");
      }
    }
  });

  it("uten svar på feiltype, kontakt og bevis sammenlignes saken med alle forhandlervedtak i samme tidsrom", async () => {
    const d = dep();
    const v = await vurder(tynn("2026-02-14"), d);
    expect(v.niva).toBe("sak");
    expect(v.statistikk?.vunnet).toBe(120);
    expect(d.hentStatistikk).toHaveBeenCalledWith(expect.objectContaining({ feilgrupper: [], statistikkbotte: "rask", kontakt: null, verkstedrapport: null }));
  });

  it("begrunnelsen er varselet, og ingen tekst har tekniske rester", async () => {
    for (const id of [1, 3, 4, 5, 6, 7, 8, 10]) {
      const v = await vurder(hent(id), dep());
      expect(v.begrunnelse).toBe(v.varsler.join(" "));
      expect(`${v.tittel} ${v.begrunnelse}`).not.toMatch(/undefined|NaN|null|XX\d|Testbil/);
    }
  });
});
