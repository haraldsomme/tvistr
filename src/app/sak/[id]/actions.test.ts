import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sak } from "@/db/schema";
import { standard } from "@/lib/app/skjema";
import { erId } from "@/lib/sak/id";

const hentAlle = vi.fn(async () => []);
const hentBetaltSak = vi.fn<(id: unknown) => Promise<Sak | null>>(async () => null);
const batch = vi.fn<(q: unknown[]) => Promise<unknown[]>>(async () => []);
const pris = vi.hoisted(() => ({ gratis: false }));
const satt = vi.fn<(v: unknown) => { where: () => Promise<void> }>(() => ({ where: async () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-forwarded-for", "10.0.0.1"]]) }));
vi.mock("@/app/sak/vedtak-db", () => ({ hentAlle, hentBilnavn: async () => () => null }));
vi.mock("@/lib/sak/db", () => ({ hentBetaltSak }));
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
    update: () => ({ set: satt }),
  },
}));

const { finnVedtak, kjop, lagreSak } = await import("./actions");
const { ordre, sak } = await import("@/db/schema");

const idag = "2026-10-17";
const skjema = { ...standard(idag), b_name: "Kari", c_reg: "AB 12345", c_make: "Volvo", c_model: "V60", c_year: "2017", f_cats: ["motor"], f_parts: { motor: ["turbo"] } };
const betaltSak: Sak = { id: "abcdefghijkm", sjekk: {}, skjema, betalt: new Date(), opprettet: new Date(), endret: new Date() };
const svar = { kjopsdato: "2025-03-10", km: 120000, ar: 2017, somDenEr: "nei", krav: "retting", forsok: null, feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01", beskrivelse: null, opplysning: null, verksted: null, rapport: null }] };
const sjekk = { reg: "CD 67890", make: "Audi A4", year: "2019", cats: ["klima"], issues: { klima: ["ac"] }, fdates: { klima: "2026-09-01" }, _screen: "result", _i: 9 };

beforeEach(() => {
  vi.clearAllMocks();
  hentBetaltSak.mockResolvedValue(null);
  pris.gratis = false;
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
    expect(await finnVedtak({ id: betaltSak.id, svar })).toEqual({ ok: true, valg: [] });
  });
});

describe("kjop", () => {
  it("er ikke koblet til uten flagget, og lagrer ingenting", async () => {
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "0";
    expect(await kjop({ sjekk, forrige: null, samtykke: true })).toEqual({ ok: false, melding: "Betaling er ikke koblet til ennå." });
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

  it("lagrer saken og en betalt ordre i utvikling", async () => {
    const r = await kjop({ sjekk, forrige: null, samtykke: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(erId(r.sak.id)).toBe(true);
    expect(r.sak).toMatchObject({ reg: "CD 67890", cats: ["klima"], parts: { klima: ["ac"] } });
    const [[sakRad, ordreRad]] = batch.mock.calls[0] as unknown as [[{ tabell: unknown; v: Record<string, unknown> }, { tabell: unknown; v: Record<string, unknown> }]];
    expect(sakRad.tabell).toBe(sak);
    expect(sakRad.v).toMatchObject({ id: r.sak.id, sjekk: { reg: "CD 67890", cats: ["klima"] } });
    expect(sakRad.v.sjekk).not.toHaveProperty("_screen");
    expect(sakRad.v.betalt).toBeInstanceOf(Date);
    expect((sakRad.v.skjema as { c_make: string }).c_make).toBe("Audi");
    expect(ordreRad.tabell).toBe(ordre);
    expect(ordreRad.v).toMatchObject({ sakId: r.sak.id, belopOre: 24900, leverandor: "utvikling", status: "betalt" });
    expect(erId(ordreRad.v.id)).toBe(true);
    expect(ordreRad.v.id).not.toBe(r.sak.id);
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
