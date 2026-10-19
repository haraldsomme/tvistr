import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lager = vi.hoisted(() => ({ kaker: new Map<string, string>(), valg: new Map<string, Record<string, unknown>>(), rad: [] as unknown[] }));
const satt = vi.fn<(v: unknown) => void>();
const slettet = vi.fn<() => void>();
const valgt = vi.fn<(w: unknown) => void>();

vi.mock("react", () => ({ cache: <T>(f: T) => f }));
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
    select: () => ({ from: () => ({ where: (w: unknown) => ({ limit: async () => (valgt(w), lager.rad) }) }) }),
    delete: () => ({ where: async () => slettet() }),
  },
}));

const { OKT, INNE, lagOkt, innlogget, loggUt, sha256hex } = await import("./okt");

beforeEach(() => {
  vi.clearAllMocks();
  lager.kaker.clear();
  lager.valg.clear();
  lager.rad = [];
});

describe("lagOkt", () => {
  it("lagrer bare hashen, og setter begge kakene", async () => {
    await lagOkt("sub-1");
    const token = lager.kaker.get(OKT)!;
    const rad = satt.mock.calls[0][0] as { tokenHash: string; sub: string; utloper: Date };
    expect(rad.tokenHash).toBe(sha256hex(token));
    expect(rad.tokenHash).not.toBe(token);
    expect(rad.sub).toBe("sub-1");
    const dager = (rad.utloper.getTime() - Date.now()) / 86_400_000;
    expect(dager).toBeGreaterThan(89.99);
    expect(dager).toBeLessThanOrEqual(90);
    expect(lager.valg.get(OKT)).toMatchObject({ httpOnly: true, maxAge: 90 * 86400, path: "/", sameSite: "lax" });
    expect(lager.kaker.get(INNE)).toBe("1");
    expect(lager.valg.get(INNE)?.httpOnly).toBeFalsy();
    expect(lager.valg.get(INNE)).toMatchObject({ maxAge: 90 * 86400, path: "/", sameSite: "lax" });
  });
});

describe("innlogget", () => {
  it("gir sub for en levende økt", async () => {
    lager.kaker.set(OKT, "token");
    lager.rad = [{ sub: "sub-1" }];
    expect(await innlogget()).toBe("sub-1");
  });
  it("gir null uten kake, uten å spørre databasen", async () => {
    expect(await innlogget()).toBeNull();
    expect(valgt).not.toHaveBeenCalled();
  });
  it("gir null når økten er utløpt, og spør bare om rader som ikke har utløpt", async () => {
    lager.kaker.set(OKT, "token");
    expect(await innlogget()).toBeNull();
    const { sql, params } = new PgDialect().sqlToQuery(valgt.mock.calls[0][0] as never);
    expect(sql).toMatch(/"utloper" > \$\d/);
    const na = new Date(params.find((p) => p !== sha256hex("token")) as string);
    expect(Math.abs(na.getTime() - Date.now())).toBeLessThan(5000);
    expect(params).toContain(sha256hex("token"));
  });
});

describe("loggUt", () => {
  it("sletter raden og begge kakene", async () => {
    lager.kaker.set(OKT, "token");
    lager.kaker.set(INNE, "1");
    await loggUt();
    expect(slettet).toHaveBeenCalledTimes(1);
    expect(lager.kaker.has(OKT)).toBe(false);
    expect(lager.kaker.has(INNE)).toBe(false);
  });
});
