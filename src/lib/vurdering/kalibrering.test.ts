import { describe, expect, it } from "vitest";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { type Kalibreringsvedtak, kriterier, medhold, tilSkjema, vurder } from "./kalibrering";

const f = (id: string, hoved: string, utfall: AvledetFeil["utfall"], r: Partial<AvledetFeil> = {}): AvledetFeil =>
  ({ id, hovedkategori: hoved, underkategori: null, komponent: null, utfall, samlet: false, avslagsgrunn: null, bevisgrunnlag: null, dager_etter_levering: null, viste_seg: "ukjent", formodning: "ikke_nevnt", sitat: null, tidsniva: null, ...r }) as AvledetFeil;
const v = (r: Partial<Kalibreringsvedtak> = {}): Kalibreringsvedtak => ({
  id: 1,
  utfall: "medhold",
  kjopsdato: "2022-03-01",
  overtakelsesdato: null,
  vedtaksdato: "2023-06-01",
  forsteReklamasjon: "2022-06-01",
  somDenEr: false,
  bevistyper: null,
  rettingsforsok: null,
  arsmodell: 2015,
  km: 120_000,
  feil: [f("a", "motor", "medhold", { dager_etter_levering: 60 })],
  ...r,
});

describe("vedtaket som kjøperens svar", () => {
  it("datoene, feilene og reklamasjonen", () => {
    const { skjema, idag } = tilSkjema(v());
    expect(idag).toBe("2022-06-01");
    expect(skjema).toMatchObject({ c_purchase: "2022-03-01", c_delivery: "2022-03-01", f_cats: ["motor"], f_found: "2022-04-30", f_prior: true, f_prior_date: "2022-06-01" });
  });
  it("feil utvalget ikke vurderte, og krav utenfor bilen, er ikke med", () =>
    expect(tilSkjema(v({ feil: [f("a", "motor", "medhold", { dager_etter_levering: 60 }), f("b", "klima", "ikke_vurdert"), f("c", "utenfor", "avvist")] })).skjema.f_cats).toEqual(["motor"]));
  it("bare perioden: en dag i den, og aldri etter reklamasjonen", () => {
    expect(tilSkjema(v({ feil: [f("a", "motor", "medhold", { viste_seg: "6_til_22_mnd" })], forsteReklamasjon: "2024-01-01" })).skjema.f_found).toBe("2023-04-05");
    expect(tilSkjema(v({ feil: [f("a", "motor", "medhold", { viste_seg: "6_til_22_mnd" })] })).skjema.f_found).toBe("2022-06-01");
  });
  it("verkstedrapport og rettingsforsøk", () =>
    expect(tilSkjema(v({ bevistyper: ["verkstedrapport"], rettingsforsok: 3 })).skjema).toMatchObject({ ws: "rapport", k_forsok: "2+" }));
  it("medhold krever en vurdert feil med medhold", () => {
    expect(medhold(v())).toBe(true);
    expect(medhold(v({ feil: [f("a", "motor", "avvist"), f("b", "utenfor", "medhold")] }))).toBe(false);
    expect(medhold(v({ utfall: "ikke_medhold" }))).toBe(false);
  });
  it("kjører den virkelige vurderingen", () => expect(vurder(v()).tier).toBe("god"));
});

describe("kriteriene", () => {
  it("avstand mellom naboene, andel per nivå og «trolig»", () => {
    const k = kriterier(
      [
        { tier: "sterk", n: 30, medhold: 24, fullt: 0 },
        { tier: "god", n: 50, medhold: 30, fullt: 0 },
        { tier: "kreverMer", n: 20, medhold: 10, fullt: 0 },
      ],
      (t) => t === "sterk",
    );
    expect(k.every((x) => x.gronn)).toBe(true);
    const rod = kriterier([{ tier: "sterk", n: 90, medhold: 60, fullt: 0 }, { tier: "god", n: 10, medhold: 6, fullt: 0 }], () => false);
    expect(rod.filter((x) => !x.gronn).map((x) => x.navn)).toEqual(["sterk > god med minst 10 poeng", "god har minst 15 % av vedtakene"]);
  });
});
