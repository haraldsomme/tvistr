import { describe, expect, it } from "vitest";
import type { AvledetFeil, Tidsniva } from "@/lib/feilvurdering/skjema";
import { ranger as rangerMedVekter, type Brukersak, type Kandidat } from "./ranger";
import { VEKTER } from "./vekter";

// Without the lower bound, so the points can be tested on plain decisions; it has its own test.
const ranger = (k: Kandidat[], s: Brukersak) => rangerMedVekter(k, s, { ...VEKTER, terskel: 0 });

// Judged together with other defects and without a stated basis by default, so the points for an
// own assessment and the basis are tested on their own.
const feil = (f: Partial<AvledetFeil> = {}): AvledetFeil => ({
  id: "f1",
  hovedkategori: "motor",
  underkategori: null,
  komponent: null,
  utfall: "medhold",
  samlet: true,
  avslagsgrunn: null,
  bevisgrunnlag: null,
  dager_etter_levering: null,
  viste_seg: "ukjent",
  formodning: "ikke_nevnt",
  sitat: null,
  tidsniva: null,
  ...f,
});

const kandidat = (id: number, k: Partial<Kandidat> = {}): Kandidat => ({
  id,
  vedtaksdato: null,
  km: null,
  alder: null,
  somDenEr: null,
  sanksjoner: null,
  mangelsgrunnlag: null,
  paragrafer: null,
  feil: [feil()],
  ...k,
});

const kat = (hoved: string, k: Partial<Brukersak["kategorier"][number]> = {}) => ({
  hoved,
  under: [] as string[],
  niva: 1 as Tidsniva,
  opplysning: null,
  verksted: null,
  ...k,
});

const sak = (s: Partial<Brukersak> = {}): Brukersak => ({
  kategorier: [kat("motor")],
  km: null,
  alder: null,
  somDenEr: null,
  krav: null,
  ...s,
});

// A defect the committee weighed itself, on its own assessment.
const drøftet = { samlet: false, bevisgrunnlag: "utvalgets_skjonn" } as const;

// Three plain decisions, so the time filter is not dropped in tests that do not mean it to be.
const fyll = [kandidat(901), kandidat(902), kandidat(903)];
const ider = (r: ReturnType<typeof ranger>) => r.rangert.map((x) => x.id);
const finn = (r: ReturnType<typeof ranger>, id: number) => r.rangert.find((x) => x.id === id)!;

describe("ranger: filter", () => {
  it("slipper aldri gjennom en feil uten medhold", () => {
    const r = ranger(
      [...fyll, kandidat(1, { feil: [feil({ utfall: "avvist" }), feil({ hovedkategori: "karosseri" })] }), kandidat(2, { feil: [feil({ utfall: "ikke_vurdert" })] })],
      sak(),
    );
    expect(ider(r)).not.toContain(1);
    expect(ider(r)).not.toContain(2);
  });

  it("tar med strengere tidsnivå, men ikke mildere, så lenge filteret står", () => {
    const s = sak({ kategorier: [kat("motor", { niva: 2 })] });
    const r = ranger([...fyll, kandidat(1, { feil: [feil({ tidsniva: 3 })] }), kandidat(2, { feil: [feil({ tidsniva: 1 })] })], s);
    expect(r.utenTidsfilter).toBe(false);
    expect(ider(r)).toContain(1);
    expect(ider(r)).not.toContain(2);
  });

  it("dropper tidsfilteret ved under tre treff, og merker grunnlaget som svakt", () => {
    const s = sak({ kategorier: [kat("motor", { niva: 3 })] });
    const r = ranger([kandidat(1, { feil: [feil({ tidsniva: 3 })] }), kandidat(2, { feil: [feil({ tidsniva: 1 })] })], s);
    expect(r.utenTidsfilter).toBe(true);
    expect(r.svaktGrunnlag).toBe(true);
    expect(ider(r)).toEqual([1, 2]);
  });

  it("tar med samme underkategori ett tidsnivå mildere, foran andre underkategorier, men ikke to", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"], niva: 3 })], km: 150_000 });
    const r = ranger(
      [
        kandidat(1, { feil: [feil({ underkategori: "olje", tidsniva: 3 })], km: 150_000 }),
        kandidat(2, { feil: [feil({ underkategori: "olje", tidsniva: 3 })], km: 150_000 }),
        kandidat(3, { feil: [feil({ underkategori: "olje", tidsniva: 3 })], km: 150_000 }),
        kandidat(4, { feil: [feil({ underkategori: "turbo", tidsniva: 2, ...drøftet })] }),
        kandidat(5, { feil: [feil({ underkategori: "turbo", tidsniva: 3, ...drøftet })] }),
        kandidat(6, { feil: [feil({ underkategori: "eksos", tidsniva: 1 })] }),
        kandidat(7, { feil: [feil({ underkategori: "turbo", tidsniva: 1 })] }),
      ],
      s,
    );
    expect(ider(r)).toEqual([5, 4, 1, 2, 3]);
    expect(finn(r, 4).tidOk).toBe(false);
    expect(r.utenTidsfilter).toBe(true);
    expect(r.perKategori).toEqual({ motor: 4 });
    expect(r.antall).toBe(4);
  });

  it("gir et vedtak med bare ukjente felt 0 poeng, uten å filtrere det bort", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"], opplysning: true, verksted: true })], km: 150_000, alder: 7, somDenEr: true, krav: "heving" });
    const r = ranger([kandidat(1), kandidat(2), kandidat(3)], s);
    expect(r.rangert).toHaveLength(3);
    for (const x of r.rangert) {
      expect(x.poengsum).toBe(0);
      expect(x.maks).toBe(25);
      const { egen_vurdering, ...resten } = x.treff;
      expect(egen_vurdering).toBe("ulikt");
      expect(Object.values(resten).every((t) => t === "ukjent")).toBe(true);
    }
  });

  it("gir vedtak fra begge kategoriene og teller per kategori", () => {
    const s = sak({ kategorier: [kat("motor"), kat("karosseri")] });
    const r = ranger(
      [
        kandidat(1),
        kandidat(2, { feil: [feil({ hovedkategori: "karosseri" })] }),
        kandidat(3, { feil: [feil(), feil({ id: "f2", hovedkategori: "karosseri" })] }),
        kandidat(4, { feil: [feil({ hovedkategori: "fukt" })] }),
      ],
      s,
    );
    expect(ider(r).sort()).toEqual([1, 2, 3]);
    expect(r.perKategori).toEqual({ motor: 2, karosseri: 2 });
  });
});

describe("ranger: poeng", () => {
  it("er en vektet sum: km alene taper for alder, som den er og krav", () => {
    const s = sak({ km: 150_000, alder: 8, somDenEr: true, krav: "prisavslag" });
    const r = ranger(
      [...fyll, kandidat(1, { km: 150_000, alder: 2, somDenEr: false }), kandidat(2, { km: 50_000, alder: 8, somDenEr: true, sanksjoner: ["prisavslag"] })],
      s,
    );
    expect(finn(r, 1).poengsum).toBe(3);
    expect(finn(r, 2).poengsum).toBe(6);
    expect(ider(r)[0]).toBe(2);
  });

  it("gir delpoeng når vedtaket var strengere for kjøperen, og ingenting når det var mildere", () => {
    const s = sak({ kategorier: [kat("motor", { niva: 2 })], km: 150_000, alder: 8, somDenEr: false });
    const r = ranger(
      [
        ...fyll,
        kandidat(1, { feil: [feil({ tidsniva: 3 })], km: 250_000, alder: 15, somDenEr: true }),
        kandidat(2, { feil: [feil({ tidsniva: 2 })], km: 20_000, alder: 1, somDenEr: false }),
      ],
      s,
    );
    const strengere = finn(r, 1);
    expect([strengere.treff.tidsniva, strengere.treff.km, strengere.treff.alder, strengere.treff.som_den_er]).toEqual(["strengere", "strengere", "strengere", "strengere"]);
    expect(strengere.poengsum).toBe(4);
    const mildere = ranger([...fyll, kandidat(1, { km: 20_000, alder: 1, somDenEr: false })], sak({ km: 150_000, alder: 8, somDenEr: true }));
    expect([finn(mildere, 1).treff.km, finn(mildere, 1).treff.alder, finn(mildere, 1).treff.som_den_er]).toEqual(["mildere", "mildere", "mildere"]);
    expect(finn(mildere, 1).poengsum).toBe(0);
  });

  it("gir halv uttelling for kravet når vedtaket hadde flere feil med medhold", () => {
    const s = sak({ krav: "heving" });
    const r = ranger(
      [...fyll, kandidat(1, { sanksjoner: ["heving"] }), kandidat(2, { sanksjoner: ["heving"], feil: [feil(), feil({ id: "f2", hovedkategori: "karosseri" })] })],
      s,
    );
    expect([finn(r, 1).treff.krav, finn(r, 1).poengsum]).toEqual(["likt", 2]);
    expect([finn(r, 2).treff.krav, finn(r, 2).poengsum]).toEqual(["delvis", 1]);
  });

  it("gir poeng for egen vurdering bare når utvalget drøftet feilen selv", () => {
    const r = ranger(
      [
        ...fyll,
        kandidat(1, { feil: [feil({ samlet: false, bevisgrunnlag: "utvalgets_skjonn" })] }),
        kandidat(2, { feil: [feil({ samlet: false, bevisgrunnlag: "erkjent_av_selger" })] }),
      ],
      sak(),
    );
    expect(finn(r, 1).treff.egen_vurdering).toBe("likt");
    expect(finn(r, 2).treff.egen_vurdering).toBe("ulikt");
    expect(ider(r)[0]).toBe(1);
  });

  it("sammenligner grunnlaget med hva brukeren har", () => {
    const med = (opplysning: boolean, verksted: boolean) => sak({ kategorier: [kat("motor", { opplysning, verksted })] });
    const kand = [
      ...fyll,
      kandidat(1, { feil: [feil({ bevisgrunnlag: "selgers_opplysning" })] }),
      kandidat(2, { feil: [feil({ bevisgrunnlag: "sakkyndig_dokumentasjon" })] }),
      kandidat(3, { feil: [feil({ bevisgrunnlag: "formodning_ikke_motbevist" })] }),
      kandidat(4, { feil: [feil({ bevisgrunnlag: "uomtvistet" })] }),
    ];
    const ja = ranger(kand, med(true, true));
    const nei = ranger(kand, med(false, false));
    expect([1, 2, 3, 4].map((id) => finn(ja, id).treff.grunnlag)).toEqual(["likt", "likt", "likt", "ukjent"]);
    expect([1, 2, 3, 4].map((id) => finn(nei, id).treff.grunnlag)).toEqual(["mildere", "mildere", "likt", "ukjent"]);
    // The presumption does not help a user past the presumption period.
    const senere = ranger(kand, sak({ kategorier: [kat("motor", { niva: 2 })] }));
    expect(finn(senere, 3).treff.grunnlag).toBe("mildere");
  });

  it("lar tilbakeholdt opplysning passe uten at selger sa noe, og utelater seire på garanti", () => {
    const r = ranger(
      [
        ...fyll,
        kandidat(1, { feil: [feil({ bevisgrunnlag: "selgers_opplysning" })], mangelsgrunnlag: ["tilbakeholdt_opplysning"] }),
        kandidat(2, { feil: [feil({ bevisgrunnlag: "utvalgets_skjonn", sitat: "Feilen er omfattet av garantien." })], paragrafer: ["fkjl § 18a"] }),
      ],
      sak({ kategorier: [kat("motor", { opplysning: false })] }),
    );
    expect(finn(r, 1).treff.grunnlag).toBe("likt");
    expect(ider(r)).not.toContain(2);
  });

  it("trekker fra i maks det brukeren ikke har oppgitt", () => {
    const x = ranger(fyll, sak()).rangert[0];
    expect(x.maks).toBe(12);
    expect(x.treff.krav).toBe("ikke_oppgitt");
    expect(x.treff.som_den_er).toBe("ikke_oppgitt");
    expect(x.treff.underkategori).toBe("ikke_oppgitt");
  });

  it("lar den beste feilen i vedtaket stå for det", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"] })] });
    const r = ranger([...fyll, kandidat(1, { feil: [feil({ underkategori: "olje", tidsniva: 2 }), feil({ id: "f2", underkategori: "turbo", tidsniva: 1 })] })], s);
    expect(finn(r, 1).feil.id).toBe("f2");
    expect(finn(r, 1).poengsum).toBe(8);
    expect(ider(r)[0]).toBe(1);
  });

  it("setter samme underkategori foran, selv med færre poeng", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"] })], km: 150_000, krav: "heving" });
    const r = ranger(
      [
        ...fyll,
        kandidat(1, { feil: [feil({ underkategori: "olje", tidsniva: 1, ...drøftet })], km: 150_000, sanksjoner: ["heving"] }),
        kandidat(2, { feil: [feil({ underkategori: "turbo", ...drøftet })] }),
      ],
      s,
    );
    expect(finn(r, 1).poengsum).toBeGreaterThan(finn(r, 2).poengsum);
    expect(ider(r)[0]).toBe(2);
  });

  it("utelater treff under terskelen, heller enn å fylle opp", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"] })], km: 150_000, krav: "heving" });
    const r = rangerMedVekter(
      [...fyll, kandidat(1, { feil: [feil({ underkategori: "olje", tidsniva: 1, ...drøftet })], km: 150_000, sanksjoner: ["heving"] }), kandidat(2, { feil: [feil({ underkategori: "turbo" })] })],
      s,
    );
    expect(ider(r)).toEqual([1]);
  });

  it("setter en feil utvalget avgjorde for seg foran en som ble vurdert samlet", () => {
    const r = ranger(
      [...fyll, kandidat(1, { feil: [feil({ tidsniva: 1 })], km: 150_000, sanksjoner: ["heving"] }), kandidat(2, { feil: [feil(drøftet)] })],
      sak({ km: 150_000, krav: "heving" }),
    );
    expect(finn(r, 1).poengsum).toBeGreaterThan(finn(r, 2).poengsum);
    expect(ider(r)[0]).toBe(2);
  });
});

describe("ranger: rekkefølge", () => {
  it("er lik hver gang: tidsnivå likt, så nyeste vedtak, så id", () => {
    const kand = [
      kandidat(5, { vedtaksdato: "2020-01-01" }),
      kandidat(3, { vedtaksdato: "2022-01-01" }),
      kandidat(4, { vedtaksdato: "2022-01-01" }),
      kandidat(1, { vedtaksdato: null }),
      kandidat(2, { feil: [feil({ tidsniva: 1 })], vedtaksdato: "2015-01-01", km: 300_000 }),
    ];
    const s = sak({ km: 150_000 });
    const forventet = [2, 3, 4, 5, 1];
    expect(ider(ranger(kand, s))).toEqual(forventet);
    expect(ider(ranger([...kand].reverse(), s))).toEqual(forventet);
    expect(ider(ranger([kand[2], kand[4], kand[0], kand[3], kand[1]], s))).toEqual(forventet);
  });
});
