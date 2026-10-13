import { describe, expect, it } from "vitest";
import type { AvledetFeil, Tidsniva } from "@/lib/feilvurdering/skjema";
import type { AvgjorendeFeil } from "@/lib/avgjorende/skjema";
import { nivaA, ranger } from "./ranger";
import type { Brukersak, Kandidat, Kategorisvar } from "./typer";

// Judged on its own, without a stated basis, at time level 1 by default. Every defect gets two
// verified quotes in `avgjorende` (see `kandidat`), which level A requires.
const feil = (f: Partial<AvledetFeil> = {}): AvledetFeil => ({
  id: "f1",
  hovedkategori: "motor",
  underkategori: "turbo",
  komponent: null,
  utfall: "medhold",
  samlet: false,
  avslagsgrunn: null,
  bevisgrunnlag: null,
  dager_etter_levering: null,
  viste_seg: "ukjent",
  formodning: "ikke_nevnt",
  sitat: "Turboen var i dårligere stand enn klageren kunne forvente.",
  tidsniva: 1,
  ...f,
});

const SITATER = ["Turboen var i dårligere stand enn klageren kunne forvente.", "Feilen må ha vært til stede ved levering."];
const avg = (f: AvledetFeil, a: Partial<AvgjorendeFeil> = {}): AvgjorendeFeil => ({ id: f.id, avgjorende: "", hjemmel: [], bevis: [], samlet_med: [], under_tvil: false, sanksjoner: [], sitater: SITATER, ...a });

// `avgjorende` defaults to two quotes for each defect; pass it to override.
const kandidat = (id: number, k: Partial<Kandidat> = {}): Kandidat => {
  const fl = k.feil ?? [feil()];
  return {
    id,
    saksnummer: `${id}/1`,
    vedtaksdato: null,
    km: null,
    alder: null,
    somDenEr: null,
    sanksjoner: null,
    mangelsgrunnlag: null,
    paragrafer: null,
    tvistetema: null,
    avgjorende: { selger_svarte: true, feil: fl.map((f) => avg(f)) },
    ...k,
    feil: fl,
  };
};

const kat = (hoved: string, k: Partial<Kategorisvar> = {}): Kategorisvar => ({ hoved, under: [], niva: 1 as Tidsniva, opplysning: null, verksted: null, ...k });

const sak = (s: Partial<Brukersak> = {}): Brukersak => ({
  kategorier: [kat("motor", { under: ["turbo"] })],
  km: null,
  alder: null,
  somDenEr: null,
  krav: null,
  forsok: null,
  ...s,
});

// A defect the committee weighed itself, on its own assessment.
const drøftet = { bevisgrunnlag: "utvalgets_skjonn" } as const;

const ider = (r: ReturnType<typeof ranger>) => r.kandidater.map((x) => x.id);
const finn = (r: ReturnType<typeof ranger>, id: number) => r.kandidater.find((x) => x.id === id)!;
const a = (f: Partial<AvledetFeil> = {}, s: Brukersak = sak(), k: Partial<Kandidat> = {}) => nivaA(kandidat(1, { ...k, feil: [feil(f)] }), feil(f), s.kategorier[0], s);
// A decision on another defect that settled the buyer's claim to cancel the purchase (level B).
const rettslig = (id: number) => kandidat(id, { feil: [feil({ hovedkategori: "karosseri", underkategori: "lakk" })], sanksjoner: ["heving"], tvistetema: ["heving_vesentlig"] });

describe("nivaA: samme feil", () => {
  it("gjelder samme underkategori, vurdert for seg, med to verifiserte sitater", () => {
    expect(a()).toBe(true);
    expect(a({ underkategori: "olje" })).toBe(false);
    expect(a({ utfall: "avvist" })).toBe(false);
  });

  it("gjelder aldri en feil som ble vurdert sammen med andre", () => {
    expect(a({ samlet: true })).toBe(false);
    const f = feil();
    expect(nivaA(kandidat(1, { avgjorende: { selger_svarte: true, feil: [avg(f, { samlet_med: ["f2"] })] } }), f, sak().kategorier[0], sak())).toBe(false);
  });

  it("gjelder ikke en feil utvalgets vurdering ikke nevner eller ikke vurderte for seg (v4)", () => {
    const f = feil();
    const med = (x: Partial<AvgjorendeFeil>) => nivaA(kandidat(1, { avgjorende: { selger_svarte: true, feil: [avg(f, x)] } }), f, sak().kategorier[0], sak());
    expect([med({ nevnt_i_vurderingen: false }), med({ vurdert_for_seg: false }), med({ nevnt_i_vurderingen: true, vurdert_for_seg: true })]).toEqual([false, false, true]);
  });

  it("krever minst to verifiserte sitater fra utvalgets vurdering", () => {
    const f = feil();
    const med = (sitater: string[]) => nivaA(kandidat(1, { avgjorende: { selger_svarte: true, feil: [avg(f, { sitater })] } }), f, sak().kategorier[0], sak());
    expect(med(SITATER.slice(0, 1))).toBe(false);
    expect(nivaA(kandidat(1, { avgjorende: null }), f, sak().kategorier[0], sak())).toBe(false);
  });

  it("gjelder ikke når bilen i vedtaket var mildere på én av aksene", () => {
    const s = sak({ km: 250_000, alder: 15 });
    expect(a({}, s, { km: 250_000, alder: 15 })).toBe(true);
    expect(a({}, s, { km: 20_000, alder: 15 })).toBe(false);
    expect(a({}, s, { km: 250_000, alder: 1 })).toBe(false);
    // Unknown in the decision is not milder.
    expect(a({}, s)).toBe(true);
  });

  it("gjelder ikke når kjøperens bil var solgt «som den er» og vedtakets ikke", () => {
    const s = sak({ somDenEr: true });
    expect(a({}, s, { somDenEr: false })).toBe(false);
    expect(a({}, s, { somDenEr: true })).toBe(true);
  });

  it("ser bort fra bilprofilen for feil i det selgeren sa", () => {
    const s = sak({ kategorier: [kat("historikk", { under: ["km"] })], km: 250_000, somDenEr: true });
    expect(a({ hovedkategori: "historikk", underkategori: "km" }, s, { km: 20_000, somDenEr: false })).toBe(true);
  });

  it("regner feil i samme hovedkategori som samme feil når kjøperen ikke valgte underkategori", () => {
    expect(a({ hovedkategori: "klima", underkategori: "ac" }, sak({ kategorier: [kat("klima")] }))).toBe(true);
    expect(a({ hovedkategori: "motor", underkategori: "turbo" }, sak({ kategorier: [kat("klima")] }))).toBe(false);
  });

  it("sammenligner «vet ikke» på symptomet", () => {
    const s = sak({ kategorier: [kat("vet_ikke", { under: ["nodmodus"] })] });
    expect(a({ hovedkategori: "vet_ikke", underkategori: "nodmodus" }, s)).toBe(true);
    expect(a({ hovedkategori: "vet_ikke", underkategori: "lyd" }, s)).toBe(false);
  });
});

describe("ranger: kandidatlisten", () => {
  it("tar aldri med en feil uten medhold", () => {
    const r = ranger([kandidat(1, { feil: [feil({ utfall: "avvist" })] }), kandidat(2, { feil: [feil({ utfall: "ikke_vurdert" })] })], sak());
    expect(ider(r)).toEqual([]);
  });

  it("utelater seire på garanti, med mindre brukeren klager på garanti", () => {
    const garantifeil = feil({ sitat: "Feilen er omfattet av garantien og utgjør en mangel." });
    expect(ider(ranger([kandidat(1, { feil: [garantifeil], paragrafer: ["fkjl § 18a"] })], sak()))).toEqual([]);
    const garanti = feil({ hovedkategori: "garanti", underkategori: null, sitat: "Garantien var ikke som lovet i kontrakten." });
    // The warranty has no subcategories, so the same main category is the same defect.
    expect(finn(ranger([kandidat(1, { feil: [garanti], paragrafer: ["fkjl § 18a"] })], sak({ kategorier: [kat("garanti")] })), 1).niva).toBe("A");
  });

  it("tar med et vedtak om en annen feil på nivå B når det avgjorde et av brukerens rettslige poeng", () => {
    const s = sak({ krav: "heving" });
    const r = ranger([rettslig(1), kandidat(2, { feil: [feil({ hovedkategori: "karosseri", underkategori: "lakk" })] })], s);
    expect(ider(r)).toEqual([1]);
    expect(finn(r, 1)).toMatchObject({ niva: "B", feil: null, rett: ["heving"] });
  });

  it("krever fra v4 utvalgets egen setning for det rettslige poenget på nivå B", () => {
    const s = sak({ krav: "heving" });
    const v4 = (rettslige_sitater: { poeng: "heving" | "prisavslag"; sitat: string }[]) => {
      const k = rettslig(1);
      return { ...k, avgjorende: { ...k.avgjorende!, rettslige_sitater } };
    };
    expect(ider(ranger([v4([{ poeng: "heving", sitat: "Mangelen er ikke uvesentlig." }])], s))).toEqual([1]);
    expect(ider(ranger([v4([{ poeng: "prisavslag", sitat: "Prisavslaget settes skjønnsmessig." }])], s))).toEqual([]);
  });

  it("tar ikke med et vedtak uten verifisert sitat, heller ikke på nivå B", () => {
    const uten = { ...rettslig(1), avgjorende: null };
    expect(ider(ranger([uten, kandidat(2, { avgjorende: null })], sak({ krav: "heving" })))).toEqual([]);
  });

  it("setter nivå A foran B uansett poeng, og tar ti", () => {
    const s = sak({ krav: "heving" });
    const r = ranger([...Array.from({ length: 12 }, (_, i) => rettslig(100 + i)), kandidat(1)], s);
    expect(ider(r)[0]).toBe(1);
    expect(r.kandidater).toHaveLength(10);
    expect(r.perNiva).toEqual({ A: 1, B: 12 });
  });

  it("sorterer på poeng innenfor et nivå, og likt hver gang", () => {
    const kand = [kandidat(5, { vedtaksdato: "2020-01-01" }), kandidat(3, { vedtaksdato: "2022-01-01" }), kandidat(4, { vedtaksdato: "2022-01-01" }), kandidat(2, { feil: [feil(drøftet)] })];
    const forventet = [2, 3, 4, 5];
    expect(ider(ranger(kand, sak()))).toEqual(forventet);
    expect(ider(ranger([...kand].reverse(), sak()))).toEqual(forventet);
  });

  it("tar med en sak som er publisert to ganger bare én gang", () => {
    const r = ranger([kandidat(1, { saksnummer: "FKU-2025-55355" }), kandidat(2, { saksnummer: "FKU-2025-55355-2" }), kandidat(3, { saksnummer: "16/369" })], sak());
    expect(ider(r)).toHaveLength(2);
    expect(ider(r)).toContain(3);
  });
});

describe("ranger: poeng", () => {
  it("er en vektet sum: km alene taper for alder og som den er", () => {
    const s = sak({ km: 150_000, alder: 8, somDenEr: true, krav: "prisavslag" });
    // Both are milder on one side, so both are level B on the price-reduction point; the points still differ.
    const b = (id: number, k: Partial<Kandidat>) => ({ ...rettslig(id), sanksjoner: ["prisavslag"], tvistetema: ["prisavslag_storrelse"], ...k });
    const r = ranger([b(1, { km: 150_000, alder: 2, somDenEr: false }), b(2, { km: 50_000, alder: 8, somDenEr: true })], s);
    expect(finn(r, 2).poengsum - finn(r, 1).poengsum).toBe(1);
  });

  it("gir delpoeng når vedtaket var strengere for kjøperen, og ingenting når det var mildere", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"], niva: 2 })], km: 150_000, alder: 8, somDenEr: false });
    const strengere = finn(ranger([kandidat(1, { feil: [feil({ tidsniva: 3 })], km: 250_000, alder: 15, somDenEr: true })], s), 1);
    expect([strengere.treff.tidsniva, strengere.treff.km, strengere.treff.alder, strengere.treff.som_den_er]).toEqual(["strengere", "strengere", "strengere", "strengere"]);
    // A milder car is not level A; as a level-B decision it still gets no points for it.
    const mildere = finn(ranger([{ ...rettslig(1), km: 20_000, alder: 15, somDenEr: false }], sak({ km: 150_000, alder: 8, somDenEr: true, krav: "heving" })), 1);
    expect([mildere.niva, mildere.treff.km, mildere.treff.som_den_er]).toEqual(["B", "mildere", "mildere"]);
  });

  it("gir halv uttelling for kravet når vedtaket hadde flere feil med medhold", () => {
    const s = sak({ krav: "heving" });
    const r = ranger([kandidat(1, { sanksjoner: ["heving"] }), kandidat(2, { sanksjoner: ["heving"], feil: [feil(), feil({ id: "f2", hovedkategori: "karosseri" })] })], s);
    expect(finn(r, 1).treff.krav).toBe("likt");
    expect(finn(r, 2).treff.krav).toBe("delvis");
  });

  it("sammenligner grunnlaget med hva brukeren har", () => {
    const med = (opplysning: boolean) => sak({ kategorier: [kat("motor", { under: ["turbo"], opplysning, verksted: opplysning })] });
    const kand = [
      kandidat(1, { feil: [feil({ bevisgrunnlag: "selgers_opplysning" })] }),
      kandidat(2, { feil: [feil({ bevisgrunnlag: "sakkyndig_dokumentasjon" })] }),
      kandidat(3, { feil: [feil({ bevisgrunnlag: "selgers_opplysning" })], mangelsgrunnlag: ["tilbakeholdt_opplysning"] }),
    ];
    expect([1, 2, 3].map((id) => finn(ranger(kand, med(true)), id).treff.grunnlag)).toEqual(["likt", "likt", "likt"]);
    expect([1, 2, 3].map((id) => finn(ranger(kand, med(false)), id).treff.grunnlag)).toEqual(["mildere", "mildere", "likt"]);
  });

  it("trekker fra i maks det brukeren ikke har oppgitt, og det som ikke finnes på nivå B", () => {
    const x = ranger([kandidat(1)], sak()).kandidater[0];
    expect(x.treff.krav).toBe("ikke_oppgitt");
    expect(x.treff.som_den_er).toBe("ikke_oppgitt");
    const b = ranger([rettslig(1)], sak({ krav: "heving" })).kandidater[0];
    expect(b.treff.underkategori).toBe("ikke_oppgitt");
    expect(b.maks).toBe(2);
  });
});
