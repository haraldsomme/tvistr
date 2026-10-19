import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sak } from "@/db/schema";
import { standard } from "@/lib/app/skjema";
import { erId } from "@/lib/sak/id";

const hentAlle = vi.fn<() => Promise<unknown[]>>(async () => []);
const hentBetaltSak = vi.fn<(id: unknown) => Promise<Sak | null>>(async () => null);
const batch = vi.fn<(q: unknown[]) => Promise<unknown[]>>(async () => []);
const pris = vi.hoisted(() => ({ gratis: false }));
// The claim on a model call (update … returning): a row while the case has calls left.
const returnering = vi.fn(async () => [{ n: 1 }]);
type Hvor = { where: () => Promise<undefined> & { returning: typeof returnering } };
const satt = vi.fn<(v: unknown) => Hvor>(() => ({ where: () => Object.assign(Promise.resolve(undefined), { returning: returnering }) }));
const kandidater = vi.hoisted(() => ({ rader: [] as { id: number; niva: string; feil: null; rett: never[]; treff: object }[] }));
const sporModellen = vi.fn(async () => ({ svar: { vedtak_id: 2, sitater: ["s1"] } as { vedtak_id: number; sitater: string[] } | null, modell: "m", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0.01 } }));
const opprettBetaling = vi.fn<(p: { ref: string; belopOre: number; returnUrl: string; beskrivelse: string }) => Promise<{ redirectUrl: string; reference: string }>>(async () => ({ redirectUrl: "https://pay-mt.vipps.no/x", reference: "r" }));
const vipps = vi.hoisted(() => ({ sattOpp: true }));
vi.mock("@/lib/vipps/klient", () => ({ opprettBetaling, vippsSattOpp: () => vipps.sattOpp }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-forwarded-for", "10.0.0.1"],
      ["host", "tvistr.no"],
      ["x-forwarded-proto", "https"],
    ]),
}));
vi.mock("@/app/sak/vedtak-db", () => ({ hentAlle, hentBilnavn: async () => () => null }));
vi.mock("@/lib/sak/db", () => ({ hentBetaltSak }));
vi.mock("@/lib/matching/ranger", () => ({ ranger: () => ({ kandidater: kandidater.rader }), avgjorendeFor: () => undefined }));
// The limits per address are tested on their own; here every call is from the same address.
vi.mock("@/lib/rategrense", () => ({ lagGrense: () => () => false }));
vi.mock("@/lib/matching/likhet", () => ({ likhet: () => 50 }));
// The ranking and the template are tested on their own; here only which answer is used, and when a call is made.
vi.mock("@/lib/vedtaksvalg/valg", async (orig) => {
  const ekte = await orig<typeof import("@/lib/vedtaksvalg/valg")>();
  type R = { id: number };
  return {
    UTVALG_I_TEKSTEN: "utvalg",
    endringMot: ekte.endringMot,
    grunnlagFor: (kjoper: unknown, k: R[]) => JSON.stringify([kjoper, k.map((r) => r.id)]),
    sporModellen,
    sitaterFor: () => new Map(),
    tilLagret: (grunnlag: string, svar: { vedtak_id: number }) => ({ grunnlag, vedtakId: svar.vedtak_id, sitater: ["tekst"] }),
    fraLagret: (l: { vedtakId: number } | undefined, kandidater: R[]) => (l && kandidater.some((r) => r.id === l.vedtakId) ? { vedtak_id: l.vedtakId, sitater: ["s1"] } : null),
    byggValg: (svar: { vedtak_id: number } | null, o: { kandidater: R[] }) => {
      const r = o.kandidater.find((x) => x.id === svar?.vedtak_id) ?? o.kandidater[0];
      return { r, niva: "A", avsnitt: "a", sitater: [], fulgt: !!svar, alternativer: o.kandidater.filter((x) => x !== r).map((x) => ({ r: x, avsnitt: "b", sitater: [] })) };
    },
  };
});
vi.mock("@/lib/pris", () => ({
  PRIS: 249,
  get GRATIS() {
    return pris.gratis;
  },
}));
vi.mock("@/db", () => ({
  db: {
    batch,
    insert: (tabell: unknown) => ({ values: (v: unknown) => ({ tabell, v }) }),
    select: () => ({ from: () => ({ where: async () => [] }) }),
    update: () => ({ set: satt }),
  },
}));

const { finnVedtak, kjop, lagreSak } = await import("./actions");
const { ordre, sak } = await import("@/db/schema");

const idag = "2026-10-17";
const skjema = { ...standard(idag), b_name: "Kari", c_reg: "AB 12345", c_make: "Volvo", c_model: "V60", c_year: "2017", f_cats: ["motor"], f_parts: { motor: ["turbo"] } };
const betaltSak: Sak = { id: "abcdefghijkm", vippsSub: null, sjekk: {}, skjema, betalt: new Date(), vedtaksvalg: null, modellkall: 0, opprettet: new Date(), endret: new Date() };
const svar = { kjopsdato: "2025-03-10", km: 120000, ar: 2017, somDenEr: "nei", krav: "retting", forsok: null, feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01", beskrivelse: null, opplysning: null, verksted: null, rapport: null }] };
const sjekk = { reg: "CD 67890", make: "Audi A4", year: "2019", cats: ["klima"], issues: { klima: ["ac"] }, fdates: { klima: "2026-09-01" }, _screen: "result", _i: 9 };

beforeEach(() => {
  vi.clearAllMocks();
  hentBetaltSak.mockResolvedValue(null);
  hentAlle.mockResolvedValue([]);
  kandidater.rader = [];
  pris.gratis = false;
  vipps.sattOpp = true;
  process.env.TVISTR_HELT_BREV_UTEN_BETALING = "1";
});

describe("finnVedtak", () => {
  it("gir ingenting uten en betalt sak", async () => {
    const r = await finnVedtak({ id: "abcdefghijkm", svar });
    expect(r).toEqual({ ok: false, melding: "Brevet er ikke betalt." });
    expect(hentAlle).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(/avsnitt|kildeUrl/);
  });

  it("avviser ugyldige svar", async () => {
    hentBetaltSak.mockResolvedValue(betaltSak);
    expect((await finnVedtak({ id: betaltSak.id, svar: { ...svar, feil: [{ ...svar.feil[0], hoved: "ukjent" }] } })).ok).toBe(false);
    expect((await finnVedtak({ id: betaltSak.id, svar: { ...svar, kjopsdato: "2025-13-40" } })).ok).toBe(false);
  });

  it("avviser svar om en annen bil eller feil enn saken", async () => {
    hentBetaltSak.mockResolvedValue(betaltSak);
    expect((await finnVedtak({ id: betaltSak.id, svar: { ...svar, ar: 2018 } })).ok).toBe(false);
    expect((await finnVedtak({ id: betaltSak.id, svar: { ...svar, feil: [{ ...svar.feil[0], hoved: "klima", under: [] }] } })).ok).toBe(false);
    expect((await finnVedtak({ id: betaltSak.id, svar: { ...svar, feil: [{ ...svar.feil[0], under: ["registerreim"] }] } })).ok).toBe(false);
    expect(hentAlle).not.toHaveBeenCalled();
  });

  it("gir en tom liste uten kandidater", async () => {
    hentBetaltSak.mockResolvedValue(betaltSak);
    expect(await finnVedtak({ id: betaltSak.id, svar })).toEqual({ ok: true, valg: [], endring: null });
  });
});

describe("finnVedtak: ett modellkall per sett med svar", () => {
  const vedtakene = (...ider: number[]) => {
    hentAlle.mockResolvedValue([1, 2, 3, 4, 5, 7, 8].map((id) => ({ id, saksnummer: `FKU-2024-${id}`, vedtaksdato: null, avgjorende: null, sanksjoner: [], km: null, alder: null, somDenEr: null })));
    kandidater.rader = ider.map((id) => ({ id, niva: "A", feil: null, rett: [], treff: {} }));
  };
  // The case as the database holds it after each call: what finnVedtak last wrote.
  const iBasen = () => {
    let rad: Sak = { ...betaltSak };
    hentBetaltSak.mockImplementation(async () => rad);
    satt.mockImplementation((v: unknown) => {
      if ((v as Partial<Sak>).vedtaksvalg) rad = { ...rad, ...(v as Partial<Sak>) };
      return { where: () => Object.assign(Promise.resolve(undefined), { returning: returnering }) };
    });
  };
  const ider = (f: Awaited<ReturnType<typeof finnVedtak>>) => (f.ok ? f.valg.map((v) => v.id) : null);

  it("bruker det lagrede svaret for de samme svarene", async () => {
    vedtakene(1, 2, 3);
    iBasen();
    const forste = await finnVedtak({ id: betaltSak.id, svar });
    expect(ider(forste)).toEqual([2, 1, 3]);
    expect(forste.ok && forste.endring).toBeNull();
    const andre = await finnVedtak({ id: betaltSak.id, svar });
    expect(ider(andre)).toEqual([2, 1, 3]);
    expect(andre.ok && andre.endring).toBeNull();
    expect(sporModellen).toHaveBeenCalledTimes(1);
  });

  it("spør på nytt når svarene endres, og ikke når de endres tilbake", async () => {
    vedtakene(1, 2, 3);
    iBasen();
    await finnVedtak({ id: betaltSak.id, svar });
    const endret = { ...svar, feil: [{ ...svar.feil[0], beskrivelse: "Turboen hyler" }] };
    await finnVedtak({ id: betaltSak.id, svar: endret });
    await finnVedtak({ id: betaltSak.id, svar });
    await finnVedtak({ id: betaltSak.id, svar: endret });
    expect(sporModellen).toHaveBeenCalledTimes(2);
  });

  it("forteller hva som er nytt når listen endres", async () => {
    vedtakene(1, 2, 3);
    iBasen();
    await finnVedtak({ id: betaltSak.id, svar });
    vedtakene(4, 1, 5);
    sporModellen.mockResolvedValueOnce({ svar: { vedtak_id: 4, sitater: ["s1"] }, modell: "m", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 } });
    const f = await finnVedtak({ id: betaltSak.id, svar: { ...svar, km: 150000 } });
    expect(f.ok && f.endring).toEqual({ forrigeAnbefalt: { id: 2, saksnummer: "2" }, nye: [4, 5] });
  });

  it("bruker rangeringens førstevalg når kallet feiler, og lagrer ikke svaret", async () => {
    vedtakene(1, 2, 3);
    iBasen();
    sporModellen.mockResolvedValueOnce({ svar: null, modell: "m", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 } });
    expect(ider(await finnVedtak({ id: betaltSak.id, svar }))).toEqual([1, 2, 3]);
    await finnVedtak({ id: betaltSak.id, svar });
    expect(sporModellen).toHaveBeenCalledTimes(2);
  });

  it("gjør ingen kall når saken har brukt opp sine, men bruker det lagrede svaret", async () => {
    vedtakene(1, 2, 3);
    iBasen();
    await finnVedtak({ id: betaltSak.id, svar });
    returnering.mockResolvedValueOnce([]);
    expect(ider(await finnVedtak({ id: betaltSak.id, svar: { ...svar, km: 150000 } }))).toEqual([2, 1, 3]);
    expect(sporModellen).toHaveBeenCalledTimes(1);
  });

  it("tar rangeringens førstevalg når taket er nådd og det lagrede vedtaket er borte", async () => {
    vedtakene(1, 2, 3);
    iBasen();
    await finnVedtak({ id: betaltSak.id, svar });
    vedtakene(7, 8);
    returnering.mockResolvedValueOnce([]);
    expect(ider(await finnVedtak({ id: betaltSak.id, svar: { ...svar, km: 150000 } }))).toEqual([7, 8]);
  });

  it("holder på de fem siste svarene", async () => {
    vedtakene(1, 2, 3);
    iBasen();
    for (let km = 1; km <= 6; km++) await finnVedtak({ id: betaltSak.id, svar: { ...svar, km } });
    const lagret = (await hentBetaltSak(betaltSak.id))!.vedtaksvalg!;
    expect(lagret.svar).toHaveLength(5);
    await finnVedtak({ id: betaltSak.id, svar: { ...svar, km: 1 } });
    expect(sporModellen).toHaveBeenCalledTimes(7);
  });
});

describe("kjop", () => {
  it("lagrer en ubetalt sak og en Vipps-ordre, og svarer med Vipps' side", async () => {
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "0";
    expect(await kjop({ sjekk, forrige: null, samtykke: true })).toEqual({ ok: true, url: "https://pay-mt.vipps.no/x" });
    const [[sakRad, ordreRad]] = batch.mock.calls[0] as unknown as [[{ v: Record<string, unknown> }, { v: Record<string, unknown> }]];
    expect(sakRad.v.betalt).toBeNull();
    expect(ordreRad.v).toMatchObject({ sakId: sakRad.v.id, belopOre: 24900, leverandor: "vipps", status: "opprettet", betalt: null });
    const [p] = opprettBetaling.mock.calls[0];
    expect(p).toEqual({ ref: ordreRad.v.id, belopOre: 24900, returnUrl: `https://tvistr.no/betaling/${ordreRad.v.id}`, beskrivelse: "Reklamasjonsbrev for bil" });
  });

  it("merker ordren som feilet når Vipps ikke svarer", async () => {
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "0";
    opprettBetaling.mockRejectedValueOnce(new Error("nede"));
    expect(await kjop({ sjekk, forrige: null, samtykke: true })).toEqual({ ok: false, melding: "Vi fikk ikke kontakt med Vipps. Prøv igjen." });
    expect(satt).toHaveBeenCalledWith(expect.objectContaining({ status: "feilet" }));
  });

  it("lagrer ingenting uten Vipps-nøkler", async () => {
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "0";
    vipps.sattOpp = false;
    expect(await kjop({ sjekk, forrige: null, samtykke: true })).toEqual({ ok: false, melding: "Betaling er ikke tilgjengelig akkurat nå." });
    expect(batch).not.toHaveBeenCalled();
  });

  it("åpner saken gratis i prøveperioden, uten flagget og uten samtykke", async () => {
    pris.gratis = true;
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "0";
    const r = await kjop({ sjekk, forrige: null, samtykke: false });
    expect(r.ok).toBe(true);
    const [[sakRad, ordreRad]] = batch.mock.calls[0] as unknown as [[{ v: Record<string, unknown> }, { v: Record<string, unknown> }]];
    expect(sakRad.v.betalt).toBeInstanceOf(Date);
    expect(ordreRad.v).toMatchObject({ belopOre: 0, leverandor: "gratis", status: "betalt" });
  });

  it("lagrer saken og en betalt ordre i utvikling, og sender til bekreftelsen", async () => {
    const r = await kjop({ sjekk, forrige: null, samtykke: true });
    expect(opprettBetaling).not.toHaveBeenCalled();
    const [[sakRad, ordreRad]] = batch.mock.calls[0] as unknown as [[{ tabell: unknown; v: Record<string, unknown> }, { tabell: unknown; v: Record<string, unknown> }]];
    expect(r).toEqual({ ok: true, url: `/betaling/${ordreRad.v.id}` });
    expect(erId(sakRad.v.id)).toBe(true);
    expect(sakRad.tabell).toBe(sak);
    expect(sakRad.v).toMatchObject({ sjekk: { reg: "CD 67890", cats: ["klima"] } });
    expect(sakRad.v.sjekk).not.toHaveProperty("_screen");
    expect(sakRad.v.betalt).toBeInstanceOf(Date);
    expect((sakRad.v.skjema as { c_make: string }).c_make).toBe("Audi");
    expect(ordreRad.tabell).toBe(ordre);
    expect(ordreRad.v).toMatchObject({ sakId: sakRad.v.id, belopOre: 24900, leverandor: "utvikling", status: "betalt" });
    expect(erId(ordreRad.v.id)).toBe(true);
    expect(ordreRad.v.id).not.toBe(sakRad.v.id);
  });

  it("beholder kjøperen fra forrige sak", async () => {
    hentBetaltSak.mockResolvedValue(betaltSak);
    await kjop({ sjekk, forrige: betaltSak.id, samtykke: true });
    const [[sakRad]] = batch.mock.calls[0] as unknown as [[{ v: { skjema: { b_name: string; c_reg: string } } }]];
    expect([sakRad.v.skjema.b_name, sakRad.v.skjema.c_reg]).toEqual(["Kari", "CD 67890"]);
  });

  it("krever samtykke til at angreretten går tapt", async () => {
    expect(await kjop({ sjekk, forrige: null, samtykke: false })).toEqual({ ok: false, melding: "Kryss av for at brevet åpnes med en gang." });
    expect(batch).not.toHaveBeenCalled();
  });

  it("krever bil og feil", async () => {
    expect((await kjop({ sjekk: { ...sjekk, reg: "" }, forrige: null, samtykke: true })).ok).toBe(false);
    expect((await kjop({ sjekk: { ...sjekk, cats: ["ukjent"] }, forrige: null, samtykke: true })).ok).toBe(false);
    expect((await kjop({ sjekk: "tull", forrige: null, samtykke: true })).ok).toBe(false);
    expect(batch).not.toHaveBeenCalled();
  });
});

describe("lagreSak", () => {
  it("lagrer skjemaet, men bil og feil blir som kjøpt", async () => {
    hentBetaltSak.mockResolvedValue(betaltSak);
    expect(await lagreSak({ id: betaltSak.id, skjema: { ...skjema, b_name: "Ola", c_reg: "ZZ 99999", c_year: "2024", f_cats: ["klima"], ukjent: 1 } })).toEqual({ ok: true });
    const lagret = (satt.mock.calls[0][0] as { skjema: Record<string, unknown> }).skjema;
    expect(lagret).toMatchObject({ b_name: "Ola", c_reg: "AB 12345", c_year: "2017", f_cats: ["motor"] });
    expect(lagret).not.toHaveProperty("ukjent");
  });

  it("lagrer ingenting uten en betalt sak", async () => {
    expect((await lagreSak({ id: "abcdefghijkm", skjema })).ok).toBe(false);
    expect(satt).not.toHaveBeenCalled();
  });

  it("avviser noe som ikke er et skjema", async () => {
    hentBetaltSak.mockResolvedValue(betaltSak);
    expect((await lagreSak({ id: betaltSak.id, skjema: [1, 2] })).ok).toBe(false);
    expect((await lagreSak({ id: betaltSak.id, skjema: { f_desc: "x".repeat(70_000) } })).ok).toBe(false);
    expect(satt).not.toHaveBeenCalled();
  });
});
