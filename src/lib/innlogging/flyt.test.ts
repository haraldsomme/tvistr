import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Start = { state: string; nonce: string; verifier: string; til: string };
const lager = vi.hoisted(() => ({ kaker: new Map<string, string>(), valg: new Map<string, Record<string, unknown>>(), rad: [] as Start[], inne: null as string | null }));
const satt = vi.fn<(v: unknown) => void>();
const slettHvor = vi.fn<(w: unknown) => void>();
const byttKode = vi.fn<(p: { kode: string; redirectUri: string; verifier: string; nonce: string }) => Promise<{ sub: string }>>();
const innloggingsUrl = vi.fn(async (p: { state: string; nonce: string; utfordring: string; redirectUri: string }) => `https://vipps.test/auth?state=${p.state}`);
const lagOkt = vi.fn<(sub: string) => Promise<void>>(async () => {});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (lager.kaker.has(n) ? { name: n, value: lager.kaker.get(n) } : undefined),
    set: (n: string, v: string, o: Record<string, unknown>) => (lager.kaker.set(n, v), lager.valg.set(n, o)),
    delete: (n: string) => lager.kaker.delete(n),
  }),
}));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: async (v: unknown) => satt(v) }),
    delete: () => ({ where: (w: unknown) => ({ returning: async () => (slettHvor(w), lager.rad) }) }),
  },
}));
vi.mock("@/lib/innlogging/vipps-login", () => ({ byttKode, innloggingsUrl, pkce: () => ({ verifier: "ver-1", utfordring: "utf-1" }) }));
vi.mock("@/lib/innlogging/okt", () => ({ lagOkt, innlogget: async () => lager.inne }));

const { trygtMal, opprinnelse, START } = await import("./flyt");
const { GET: tilbake } = await import("@/app/logg-inn/vipps/route");
const { GET: start } = await import("@/app/logg-inn/route");

const sporring = (s: string, h: Record<string, string> = { host: "tvistr.no" }) => new Request(`https://intern${s}`, { headers: h });
const til = (r: Response) => r.headers.get("location");

beforeEach(() => {
  vi.clearAllMocks();
  lager.kaker.clear();
  lager.valg.clear();
  lager.rad = [{ state: "st-1", nonce: "no-1", verifier: "ver-1", til: "/sak/abcdefghijkm" }];
  lager.inne = null;
  byttKode.mockResolvedValue({ sub: "sub-1" });
});

describe("trygtMal", () => {
  it("beholder en sti i appen", () => {
    expect(trygtMal("/sak/abcdefghijkm")).toBe("/sak/abcdefghijkm");
    expect(trygtMal("/min-side?x=1")).toBe("/min-side?x=1");
  });
  it.each(["//evil.no", "/\\evil.no", "https://evil.no", "javascript:alert(1)", "", "/\t/evil.no", undefined, 42])("sender %j til Min side", (t) => {
    expect(trygtMal(t)).toBe("/min-side");
  });
});

describe("opprinnelse", () => {
  it("bruker videresendt vert og protokoll", () => {
    expect(opprinnelse(sporring("/", { host: "intern", "x-forwarded-host": "tvistr.no", "x-forwarded-proto": "https" }).headers)).toBe("https://tvistr.no");
  });
  it("gir https uten protokoll, og http for localhost", () => {
    expect(opprinnelse(sporring("/", { host: "tvistr.no" }).headers)).toBe("https://tvistr.no");
    expect(opprinnelse(sporring("/", { host: "localhost:3000" }).headers)).toBe("http://localhost:3000");
  });
});

describe("GET /logg-inn", () => {
  it("lagrer starten, setter kaken og sender til Vipps", async () => {
    const r = await start(sporring("/logg-inn?til=/sak/abcdefghijkm"));
    expect(r.status).toBe(302);
    const rad = satt.mock.calls[0][0] as Start;
    expect(rad).toMatchObject({ verifier: "ver-1", til: "/sak/abcdefghijkm" });
    expect(Buffer.from(rad.state, "base64url").length).toBeGreaterThanOrEqual(16);
    expect(Buffer.from(rad.nonce, "base64url").length).toBeGreaterThanOrEqual(16);
    expect(rad.nonce).not.toBe(rad.state);
    expect(lager.kaker.get(START)).toBe(rad.state);
    expect(lager.valg.get(START)).toMatchObject({ httpOnly: true, maxAge: 600, path: "/", sameSite: "lax" });
    expect(innloggingsUrl).toHaveBeenCalledWith({ state: rad.state, nonce: rad.nonce, utfordring: "utf-1", redirectUri: "https://tvistr.no/logg-inn/vipps" });
    expect(til(r)).toBe(`https://vipps.test/auth?state=${rad.state}`);
  });
  it("lagrer Min side når målet ikke er trygt", async () => {
    await start(sporring("/logg-inn?til=//evil.no"));
    expect((satt.mock.calls[0][0] as Start).til).toBe("/min-side");
  });
  it("sender en innlogget bruker rett til målet", async () => {
    lager.inne = "sub-1";
    const r = await start(sporring("/logg-inn?til=/sak/abcdefghijkm"));
    expect(r.status).toBe(302);
    expect(til(r)).toBe("https://tvistr.no/sak/abcdefghijkm");
    expect(satt).not.toHaveBeenCalled();
  });
});

describe("GET /logg-inn/vipps", () => {
  it("logger inn med lagret verifier og nonce, og sender til målet", async () => {
    lager.kaker.set(START, "st-1");
    const r = await tilbake(sporring("/logg-inn/vipps?code=k-1&state=st-1"));
    expect(byttKode).toHaveBeenCalledWith({ kode: "k-1", redirectUri: "https://tvistr.no/logg-inn/vipps", verifier: "ver-1", nonce: "no-1" });
    expect(lagOkt).toHaveBeenCalledWith("sub-1");
    expect(lager.kaker.has(START)).toBe(false);
    expect(r.status).toBe(302);
    expect(til(r)).toBe("https://tvistr.no/sak/abcdefghijkm");
    const { sql, params } = new PgDialect().sqlToQuery(slettHvor.mock.calls[0][0] as never);
    expect(sql).toMatch(/"state" = \$\d/);
    expect(sql).toMatch(/"opprettet" > \$\d/);
    expect(params).toContain("st-1");
    const grense = new Date(params.find((p) => p !== "st-1") as string).getTime();
    expect(Math.abs(grense - (Date.now() - 600_000))).toBeLessThan(5000);
  });
  it("godtar tilbakekallet uten START-kaken (en annen nettleser)", async () => {
    const r = await tilbake(sporring("/logg-inn/vipps?code=k-1&state=st-1"));
    expect(lagOkt).toHaveBeenCalledWith("sub-1");
    expect(til(r)).toBe("https://tvistr.no/sak/abcdefghijkm");
  });

  const avvist = async (s: string) => {
    const r = await tilbake(sporring(s));
    expect(r.status).toBe(302);
    expect(til(r)).toBe("https://tvistr.no/logg-inn/feil");
    expect(lagOkt).not.toHaveBeenCalled();
  };
  it("avviser en brukt eller gammel state", async () => {
    lager.rad = [];
    await avvist("/logg-inn/vipps?code=k-1&state=st-1");
    expect(byttKode).not.toHaveBeenCalled();
  });
  it("avviser når START-kaken er en annen", async () => {
    lager.kaker.set(START, "st-annen");
    await avvist("/logg-inn/vipps?code=k-1&state=st-1");
    expect(byttKode).not.toHaveBeenCalled();
  });
  it("avviser ?error, og bruker opp starten", async () => {
    await avvist("/logg-inn/vipps?error=access_denied&state=st-1");
    expect(slettHvor).toHaveBeenCalledTimes(1);
    expect(byttKode).not.toHaveBeenCalled();
  });
  it("avviser uten state", async () => {
    await avvist("/logg-inn/vipps?code=k-1");
    expect(slettHvor).not.toHaveBeenCalled();
  });
  it("avviser når byttKode feiler", async () => {
    byttKode.mockRejectedValue(new Error("Vipps Login token: 400"));
    await avvist("/logg-inn/vipps?code=k-1&state=st-1");
  });
});
