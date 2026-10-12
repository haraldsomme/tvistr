import { describe, expect, it } from "vitest";
import type { AvledetFeil, Tidsniva } from "@/lib/feilvurdering/skjema";
import { ranger, trinnFor } from "./ranger";
import type { Brukersak, Kandidat, Kategorisvar } from "./typer";

// Judged together with other defects, without a stated basis and at no time level by default, so
// each criterion is tested on its own. Every defect has a quote, which steps 1–4 require.
const feil = (f: Partial<AvledetFeil> = {}): AvledetFeil => ({
  id: "f1",
  hovedkategori: "motor",
  underkategori: "turbo",
  komponent: null,
  utfall: "medhold",
  samlet: true,
  avslagsgrunn: null,
  bevisgrunnlag: null,
  dager_etter_levering: null,
  viste_seg: "ukjent",
  formodning: "ikke_nevnt",
  sitat: "Turboen var i dårligere stand enn klageren kunne forvente.",
  tidsniva: 1,
  ...f,
});

const kandidat = (id: number, k: Partial<Kandidat> = {}): Kandidat => ({
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
  feil: [feil()],
  ...k,
});

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
const drøftet = { samlet: false, bevisgrunnlag: "utvalgets_skjonn" } as const;

const ider = (r: ReturnType<typeof ranger>) => r.kandidater.map((x) => x.id);
const finn = (r: ReturnType<typeof ranger>, id: number) => r.kandidater.find((x) => x.id === id)!;
const trinn = (f: Partial<AvledetFeil>, s: Brukersak = sak(), k: Partial<Kandidat> = {}) => trinnFor(kandidat(1, { ...k, feil: [feil(f)] }), feil(f), s.kategorier[0], s);

describe("trinnFor: stigen", () => {
  it("gir trinn 1 for samme underkategori på samme eller senere tidspunkt", () => {
    expect(trinn({ tidsniva: 1 })).toBe(1);
    expect(trinn({ tidsniva: 3 })).toBe(1);
  });

  it("gir trinn 2 når tidspunktet er ukjent eller ett nivå tidligere, ikke to", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"], niva: 3 })] });
    expect(trinn({ tidsniva: null }, s)).toBe(2);
    expect(trinn({ tidsniva: 2 }, s)).toBe(2);
    expect(trinn({ tidsniva: 1 }, s)).toBe(4);
  });

  it("flytter en sak der bilen var mildere på både km og alder ned til trinn 4", () => {
    const s = sak({ km: 250_000, alder: 15 });
    expect(trinn({}, s, { km: 20_000, alder: 1 })).toBe(4);
    expect(trinn({}, s, { km: 20_000, alder: 15 })).toBe(1);
  });

  it("gir trinn 3 for en annen del av samme slag, også i en annen hovedkategori", () => {
    expect(trinn({ underkategori: "olje" })).toBe(3);
    expect(trinn({ hovedkategori: "drivlinje", underkategori: "girkasse" })).toBe(3);
    // Exhaust is a wear part, the turbo a main part: only the main category is shared.
    expect(trinn({ underkategori: "eksos" })).toBe(4);
    expect(trinn({ hovedkategori: "drivlinje", underkategori: "clutch" })).toBeNull();
  });

  it("ser bort fra tid og bilprofil for feil som gjelder opplysninger", () => {
    const s = sak({ kategorier: [kat("historikk", { under: ["km"], niva: 3 })], km: 250_000, alder: 15 });
    expect(trinn({ hovedkategori: "historikk", underkategori: "km", tidsniva: 1 }, s, { km: 20_000, alder: 1 })).toBe(1);
  });

  it("starter på trinn 3 når brukeren bare valgte en hovedkategori der alle deler er av samme slag", () => {
    expect(trinn({ hovedkategori: "fukt", underkategori: "lukt" }, sak({ kategorier: [kat("fukt")] }))).toBe(3);
    expect(trinn({ underkategori: "turbo" }, sak({ kategorier: [kat("motor")] }))).toBe(4);
  });

  it("sammenligner «vet ikke» på symptomet", () => {
    const s = sak({ kategorier: [kat("vet_ikke", { under: ["nodmodus"] })] });
    expect(trinn({ hovedkategori: "vet_ikke", underkategori: "nodmodus" }, s)).toBe(1);
    expect(trinn({ hovedkategori: "vet_ikke", underkategori: "lyd" }, s)).toBe(4);
  });

  it("krever et sitat for trinn 1–4", () => {
    expect(trinn({ sitat: null })).toBeNull();
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
    expect(finn(ranger([kandidat(1, { feil: [garanti], paragrafer: ["fkjl § 18a"] })], sak({ kategorier: [kat("garanti")] })), 1).trinn).toBe(3);
  });

  it("setter trinnet foran poengene", () => {
    const s = sak({ km: 150_000, krav: "heving" });
    const r = ranger([kandidat(1, { feil: [feil({ underkategori: "olje", ...drøftet })], km: 150_000, sanksjoner: ["heving"] }), kandidat(2)], s);
    expect(finn(r, 1).poengsum).toBeGreaterThan(finn(r, 2).poengsum);
    expect(ider(r)).toEqual([2, 1]);
  });

  it("sorterer på poeng innenfor et trinn, og likt hver gang", () => {
    const kand = [kandidat(5, { vedtaksdato: "2020-01-01" }), kandidat(3, { vedtaksdato: "2022-01-01" }), kandidat(4, { vedtaksdato: "2022-01-01" }), kandidat(2, { feil: [feil(drøftet)] })];
    const forventet = [2, 3, 4, 5];
    expect(ider(ranger(kand, sak()))).toEqual(forventet);
    expect(ider(ranger([...kand].reverse(), sak()))).toEqual(forventet);
  });

  it("tar med et vedtak uten sammenlignbar feil på trinn 5 når det avgjorde et av brukerens rettslige poeng", () => {
    const s = sak({ krav: "heving" });
    const annen = feil({ hovedkategori: "karosseri", underkategori: "lakk" });
    const r = ranger([kandidat(1, { feil: [annen], sanksjoner: ["heving"], tvistetema: ["heving_vesentlig"] }), kandidat(2, { feil: [annen] })], s);
    expect(ider(r)).toEqual([1]);
    expect(finn(r, 1)).toMatchObject({ trinn: 5, feil: null, rett: ["heving"] });
  });

  it("tar inntil 25 sammenlignbare og fyller opp med rettslige poeng, alltid minst 5", () => {
    const rettslig = (id: number) => kandidat(id, { feil: [feil({ hovedkategori: "karosseri", underkategori: "lakk" })], sanksjoner: ["heving"], tvistetema: ["heving_vesentlig"] });
    const mange = [...Array.from({ length: 28 }, (_, i) => kandidat(i + 1)), ...Array.from({ length: 10 }, (_, i) => rettslig(100 + i))];
    const r = ranger(mange, sak({ krav: "heving" }));
    expect(r.kandidater).toHaveLength(30);
    expect(r.kandidater.filter((x) => x.trinn === 1)).toHaveLength(25);
    expect(r.kandidater.filter((x) => x.trinn === 5)).toHaveLength(5);
    expect(r.perTrinn).toEqual({ 1: 28, 2: 0, 3: 0, 4: 0, 5: 10 });

    const fa = ranger([kandidat(1), ...Array.from({ length: 40 }, (_, i) => rettslig(100 + i))], sak({ krav: "heving" }));
    expect(fa.kandidater).toHaveLength(30);
    expect(fa.kandidater.filter((x) => x.trinn === 5)).toHaveLength(29);
  });

  it("tar med en sak som er publisert to ganger bare én gang", () => {
    const r = ranger([kandidat(1, { saksnummer: "FKU-2025-55355" }), kandidat(2, { saksnummer: "FKU-2025-55355-2" }), kandidat(3, { saksnummer: "16/369" })], sak());
    expect(ider(r)).toHaveLength(2);
    expect(ider(r)).toContain(3);
  });
});

describe("ranger: poeng", () => {
  it("er en vektet sum: km alene taper for alder, som den er og krav", () => {
    const s = sak({ km: 150_000, alder: 8, somDenEr: true, krav: "prisavslag" });
    const r = ranger([kandidat(1, { km: 150_000, alder: 2, somDenEr: false }), kandidat(2, { km: 50_000, alder: 8, somDenEr: true, sanksjoner: ["prisavslag"] })], s);
    expect(finn(r, 2).poengsum - finn(r, 1).poengsum).toBe(3);
  });

  it("gir delpoeng når vedtaket var strengere for kjøperen, og ingenting når det var mildere", () => {
    const s = sak({ kategorier: [kat("motor", { under: ["turbo"], niva: 2 })], km: 150_000, alder: 8, somDenEr: false });
    const strengere = finn(ranger([kandidat(1, { feil: [feil({ tidsniva: 3 })], km: 250_000, alder: 15, somDenEr: true })], s), 1);
    expect([strengere.treff.tidsniva, strengere.treff.km, strengere.treff.alder, strengere.treff.som_den_er]).toEqual(["strengere", "strengere", "strengere", "strengere"]);
    const mildere = finn(ranger([kandidat(1, { km: 20_000, alder: 15, somDenEr: false })], sak({ km: 150_000, alder: 8, somDenEr: true })), 1);
    expect([mildere.treff.km, mildere.treff.som_den_er]).toEqual(["mildere", "mildere"]);
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

  it("trekker fra i maks det brukeren ikke har oppgitt, og det som ikke finnes på trinn 5", () => {
    const x = ranger([kandidat(1)], sak()).kandidater[0];
    expect(x.treff.krav).toBe("ikke_oppgitt");
    expect(x.treff.som_den_er).toBe("ikke_oppgitt");
    const rettslig = ranger([kandidat(1, { feil: [feil({ hovedkategori: "karosseri", underkategori: "lakk" })], sanksjoner: ["heving"], tvistetema: ["heving_vesentlig"] })], sak({ krav: "heving" })).kandidater[0];
    expect(rettslig.treff.underkategori).toBe("ikke_oppgitt");
    expect(rettslig.maks).toBe(2);
  });
});
