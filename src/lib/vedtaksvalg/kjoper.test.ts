import { describe, expect, it } from "vitest";
import { byggSaken, type Svar } from "./kjoper";

const svar = (s: Partial<Svar> = {}): Svar => ({
  kjopsdato: "2024-06-01",
  km: 150_000,
  ar: 2015,
  somDenEr: "nei",
  krav: "prisavslag",
  forsok: 0,
  feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-01-01", beskrivelse: null, opplysning: "nei", verksted: "skriftlig" }],
  ...s,
});

describe("byggSaken", () => {
  it("lar formodningsregelen gjelde i to år for kjøp fra 2024, og seks måneder før", () => {
    const etter = byggSaken(svar()).kjoper;
    expect([etter.formodningsfrist, etter.feil[0].formodningsregelen_gjelder]).toEqual(["2 år", true]);
    const for2024 = byggSaken(svar({ kjopsdato: "2023-05-01" })).kjoper;
    expect([for2024.formodningsfrist, for2024.feil[0].formodningsregelen_gjelder]).toEqual(["6 måneder", false]);
    const sent = byggSaken(svar({ feil: [{ ...svar().feil[0], oppdaget: "2026-07-01" }] })).kjoper;
    expect(sent.feil[0].formodningsregelen_gjelder).toBe(false);
    expect(sent.feil[0].reklamasjonsfrist).toMatch(/§ 27/);
    expect(etter.feil[0].reklamasjonsfrist).toBeUndefined();
  });

  it("gir modellen det rapporten sier, i rapportens rekkefølge, og ingenting uten rapport", () => {
    const med = byggSaken(svar({ feil: [{ ...svar().feil[0], rapport: { punkter: ["overslag", "bekrefter", "ikke_slitasje"] } }] })).kjoper;
    expect(med.feil[0].rapport_sier).toEqual(["bekrefter feilen", "sier at feilen ikke er normal slitasje", "har kostnadsoverslag"]);
    expect(med.feil[0].verksted_undersokt).toBe("skriftlig");
    expect(byggSaken(svar()).kjoper.feil[0].rapport_sier).toBeNull();
  });

  it("lar formodningsregelen være uten betydning for feil i det selgeren sa eller lovet", () => {
    const service = byggSaken(svar({ feil: [{ ...svar().feil[0], hoved: "service", under: ["servicehefte"] }] })).kjoper;
    expect(service.feil[0].formodningsregelen_gjelder).toBeNull();
  });

  it("gir rangeringen og modellen de samme svarene", () => {
    const { sak, kjoper } = byggSaken(svar({ somDenEr: null }));
    expect(sak.alder).toBe(9);
    expect(sak.somDenEr).toBeNull();
    expect(kjoper.som_den_er).toBe("vet ikke");
    expect(sak.kategorier[0]).toMatchObject({ hoved: "motor", under: ["turbo"], niva: 1, opplysning: false, verksted: true });
    expect(kjoper.feil[0].underkategorier).toEqual(["motor.turbo (Turbo)"]);
  });
});
