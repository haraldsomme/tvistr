import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { standard } from "@/lib/app/skjema";
import { sha256hex } from "@/lib/innlogging/okt";

const REF = "abcdefghijkm";
const HEMMELIG = "hemmelig-n-som-kom-med-lenken";
type Ordrerad = { id: string; sakId: string; belopOre: number; leverandor: string; status: string; betalt: Date | null; kvitteringSendt: Date | null; innloggingHash: string | null };
const rader = vi.hoisted(() => ({ ordre: null as unknown, sak: null as unknown }));
const avstem = vi.fn(async () => ({ status: "betalt" as const, sakId: "sak222222222" }));
const { lagOkt, innlogget } = vi.hoisted(() => ({ lagOkt: vi.fn<(sub: string) => Promise<void>>(async () => {}), innlogget: vi.fn<() => Promise<string | null>>(async () => null) }));
// The conditional clearing of the secret (update … returning): a row when this call cleared it.
const tomt = vi.fn<() => Promise<{ id: string }[]>>(async () => [{ id: REF }]);
const vilkar = vi.fn<(w: unknown) => void>();
const satt = vi.fn<(v: unknown) => void>();

vi.mock("next/headers", () => ({ headers: async () => new Map([["x-forwarded-for", "10.0.0.1"]]) }));
vi.mock("@/lib/rategrense", () => ({ lagGrense: () => () => false }));
vi.mock("@/lib/vipps/avstem", () => ({ avstem }));
vi.mock("@/lib/vipps/klient", () => ({ hentBetaling: async () => ({ userDetails: { email: "kari@eksempel.no" } }) }));
vi.mock("@/lib/innlogging/okt", async (orig) => ({ ...(await orig<typeof import("@/lib/innlogging/okt")>()), lagOkt, innlogget }));
vi.mock("@/db", async () => {
  const { ordre } = await import("@/db/schema");
  return {
    db: {
      select: () => ({ from: (t: unknown) => ({ where: () => ({ limit: async () => [t === ordre ? rader.ordre : rader.sak].filter(Boolean) }) }) }),
      update: () => ({ set: (v: unknown) => (satt(v), { where: (w: unknown) => (vilkar(w), { returning: tomt }) }) }),
    },
  };
});

const { sjekkBetaling } = await import("./actions");

const minutterSiden = (m: number) => new Date(Date.now() - m * 60_000);
const ordrerad = (o: Partial<Ordrerad> = {}): Ordrerad => ({ id: REF, sakId: "sak222222222", belopOre: 24900, leverandor: "vipps", status: "betalt", betalt: minutterSiden(5), kvitteringSendt: null, innloggingHash: sha256hex(HEMMELIG), ...o });

beforeEach(() => {
  vi.clearAllMocks();
  rader.ordre = ordrerad();
  rader.sak = { skjema: { ...standard("2026-10-19"), c_make: "Volvo", c_reg: "AB 12345" }, vippsSub: "sub-1" };
  innlogget.mockResolvedValue(null);
});

const innloggetSvar = (r: Awaited<ReturnType<typeof sjekkBetaling>>) => (r.status === "betalt" ? r.bekreftelse.innlogget : null);

describe("sjekkBetaling: innlogget etter kjøpet", () => {
  it("logger inn eieren med riktig hemmelighet, én gang", async () => {
    const r = await sjekkBetaling(REF, HEMMELIG);
    expect(r.status).toBe("betalt");
    expect(innloggetSvar(r)).toBe(true);
    expect(lagOkt).toHaveBeenCalledOnce();
    expect(lagOkt).toHaveBeenCalledWith("sub-1");
    expect(satt).toHaveBeenCalledWith({ innloggingHash: null });
    // One statement: only the call that finds the hash still there clears it.
    const q = new PgDialect().sqlToQuery(vilkar.mock.calls[0][0] as never);
    expect(q.sql).toBe('("ordre"."id" = $1 and "ordre"."innlogging_hash" = $2)');
    expect(q.params).toEqual([REF, sha256hex(HEMMELIG)]);
  });

  it("logger ikke inn igjen når hemmeligheten alt er brukt", async () => {
    tomt.mockResolvedValueOnce([]);
    const r = await sjekkBetaling(REF, HEMMELIG);
    expect(r.status).toBe("betalt");
    expect(innloggetSvar(r)).toBe(false);
    expect(lagOkt).not.toHaveBeenCalled();
  });

  it("sier innlogget når økten alt er eierens", async () => {
    innlogget.mockResolvedValue("sub-1");
    tomt.mockResolvedValueOnce([]);
    expect(innloggetSvar(await sjekkBetaling(REF, HEMMELIG))).toBe(true);
    expect(lagOkt).not.toHaveBeenCalled();
  });

  it("sier ikke innlogget når økten er en annens", async () => {
    innlogget.mockResolvedValue("sub-2");
    expect(innloggetSvar(await sjekkBetaling(REF, "feil"))).toBe(false);
  });

  it.each([
    ["feil hemmelighet", () => ["feil"]],
    ["ingen hemmelighet", () => [undefined]],
    ["en hemmelighet som ikke er tekst", () => [["x"]]],
    ["betalt for 61 minutter siden", () => ((rader.ordre = ordrerad({ betalt: minutterSiden(61) })), [HEMMELIG])],
    ["en sak uten eier", () => ((rader.sak = { ...(rader.sak as object), vippsSub: null }), [HEMMELIG])],
    ["en ordre uten hash", () => ((rader.ordre = ordrerad({ innloggingHash: null })), [HEMMELIG])],
  ])("logger ikke inn med %s", async (_, oppsett) => {
    const [n] = oppsett();
    const r = await sjekkBetaling(REF, n);
    expect(r.status).toBe("betalt");
    expect(innloggetSvar(r)).toBe(false);
    expect(lagOkt).not.toHaveBeenCalled();
    expect(tomt).not.toHaveBeenCalled();
  });

  it("logger ikke inn før betalingen er gjennomført", async () => {
    avstem.mockResolvedValueOnce({ status: "venter" } as never);
    expect(await sjekkBetaling(REF, HEMMELIG)).toEqual({ status: "venter" });
    expect(lagOkt).not.toHaveBeenCalled();
  });

  it("logger inn eieren av en sak fra utvikling", async () => {
    rader.ordre = ordrerad({ leverandor: "utvikling" });
    rader.sak = { ...(rader.sak as object), vippsSub: "utvikling" };
    expect(innloggetSvar(await sjekkBetaling(REF, HEMMELIG))).toBe(true);
    expect(avstem).not.toHaveBeenCalled();
    expect(lagOkt).toHaveBeenCalledWith("utvikling");
  });
});
