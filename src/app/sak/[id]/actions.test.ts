import { beforeEach, describe, expect, it, vi } from "vitest";
import { betalt } from "@/lib/vipps/profil";

const hentAlle = vi.fn(async () => []);
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-forwarded-for", "10.0.0.1"]]) }));
vi.mock("@/app/sak/vedtak-db", () => ({ hentAlle, hentBilnavn: async () => () => null }));
vi.mock("@/db", () => ({ db: {} }));

const { finnVedtak, lasOpp } = await import("./actions");

const svar = { kjopsdato: "2025-03-10", km: 120000, ar: 2017, somDenEr: "nei", krav: "retting", forsok: null, feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01", beskrivelse: null, opplysning: null, verksted: null, rapport: null }] };

describe("finnVedtak", () => {
  beforeEach(() => {
    hentAlle.mockClear();
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "1";
  });

  it("gir ingenting uten betaling", async () => {
    const r = await finnVedtak({ svar, ordreId: null });
    expect(r.ok).toBe(false);
    expect(hentAlle).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(/avsnitt|kildeUrl/);
  });

  it("gir ingenting med en ordre som ikke er betalt", async () => {
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "0";
    expect((await finnVedtak({ svar, ordreId: "abcdefgh-1234" })).ok).toBe(false);
    expect(hentAlle).not.toHaveBeenCalled();
  });

  it("avviser ugyldige svar", async () => {
    expect((await finnVedtak({ svar: { ...svar, feil: [{ ...svar.feil[0], hoved: "ukjent" }] }, ordreId: "abcdefgh-1234" })).ok).toBe(false);
    expect((await finnVedtak({ svar: { ...svar, kjopsdato: "2025-13-40" }, ordreId: "abcdefgh-1234" })).ok).toBe(false);
  });

  it("gir en tom liste uten kandidater", async () => expect(await finnVedtak({ svar, ordreId: "abcdefgh-1234" })).toEqual({ ok: true, valg: [] }));
});

describe("lasOpp", () => {
  it("gir en betalt ordre i utvikling", async () => {
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "1";
    const r = await lasOpp();
    expect(r.ok && betalt(r.ordreId)).toBe(true);
  });
  it("er ikke koblet til uten flagget", async () => {
    process.env.TVISTR_HELT_BREV_UTEN_BETALING = "0";
    expect(await lasOpp()).toEqual({ ok: false, melding: "Betaling er ikke koblet til ennå." });
  });
});
