import { beforeEach, describe, expect, it, vi } from "vitest";
import { standard } from "@/lib/app/skjema";
import type { Betaling, Tilstand } from "./klient";

type Rad = { sakId: string; status: string; belopOre: number };
const rad = vi.hoisted(() => ({ ordre: null as Rad | null }));
const hentBetaling = vi.fn<(ref: string) => Promise<Betaling>>();
const capture = vi.fn(async () => ({}));
const kanseller = vi.fn(async () => ({}));
const batch = vi.fn<(q: unknown[]) => Promise<unknown[][]>>(async () => [[{ id: "abcdefghijkm" }], []]);
const sendKvittering = vi.fn(async () => "sendt");
vi.mock("@/lib/epost/kvittering", () => ({ sendKvittering }));
const satt = vi.fn<(v: unknown) => { where: () => { v: unknown } }>((v) => ({ where: () => ({ v }) }));
vi.mock("./klient", () => ({ hentBetaling, capture, kanseller }));
vi.mock("@/db", () => ({
  db: {
    batch,
    // The order, then the case's form: one row serves both.
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (rad.ordre ? [{ ...rad.ordre, skjema: standard("2026-10-19") }] : []) }) }) }),
    update: (tabell: unknown) => ({ set: (v: unknown) => (satt(v), { where: () => ({ tabell, v, returning: () => ({ tabell, v }) }) }) }),
  },
}));

const { avstem } = await import("./avstem");

const nok = (value: number) => ({ currency: "NOK", value });
const betaling = (state: Tilstand, o: { captured?: number; cancelled?: number } = {}): Betaling => ({
  reference: "abcdefghijkm",
  state,
  pspReference: "psp-1",
  amount: nok(24900),
  aggregate: { authorizedAmount: nok(state === "AUTHORIZED" ? 24900 : 0), cancelledAmount: nok(o.cancelled ?? 0), capturedAmount: nok(o.captured ?? 0), refundedAmount: nok(0) },
  profile: { sub: "sub-1" },
});

beforeEach(() => {
  vi.clearAllMocks();
  rad.ordre = { sakId: "sak222222222", status: "opprettet", belopOre: 24900 };
});

describe("avstem", () => {
  it("venter mens betalingen ikke er godkjent", async () => {
    hentBetaling.mockResolvedValue(betaling("CREATED"));
    expect(await avstem("abcdefghijkm")).toEqual({ status: "venter" });
    expect(capture).not.toHaveBeenCalled();
    expect(satt).not.toHaveBeenCalled();
  });

  it("tar capture av en godkjent betaling og åpner saken", async () => {
    hentBetaling.mockResolvedValue(betaling("AUTHORIZED"));
    expect(await avstem("abcdefghijkm")).toEqual({ status: "betalt", sakId: "sak222222222" });
    expect(capture).toHaveBeenCalledWith("abcdefghijkm", 24900);
    const [[o, s]] = batch.mock.calls[0] as unknown as [[{ v: Record<string, unknown> }, { v: Record<string, unknown> }]];
    expect(o.v).toMatchObject({ status: "betalt", transaksjonId: "psp-1" });
    expect(s.v.betalt).toBeInstanceOf(Date);
  });

  it("fyller kjøperen fra Vipps og sender kvitteringen til e-posten de delte", async () => {
    hentBetaling.mockResolvedValue({ ...betaling("AUTHORIZED"), userDetails: { email: "kari@eksempel.no", firstName: "Kari", lastName: "Nordmann" } });
    await avstem("abcdefghijkm");
    const [[, s]] = batch.mock.calls[0] as unknown as [[unknown, { v: { skjema: { b_name: string; b_email: string } } }]];
    expect(s.v.skjema).toMatchObject({ b_name: "Kari Nordmann", b_email: "kari@eksempel.no" });
    expect(sendKvittering).toHaveBeenCalledWith("abcdefghijkm", "kari@eksempel.no");
  });

  it("gir saken eieren fra betalingen, i samme oppdatering som betalt", async () => {
    hentBetaling.mockResolvedValue({ ...betaling("AUTHORIZED"), profile: { sub: "sub-1" } });
    await avstem("abcdefghijkm");
    const [[, s]] = batch.mock.calls[0] as unknown as [[unknown, { v: Record<string, unknown> }]];
    expect(s.v).toMatchObject({ vippsSub: "sub-1" });
    expect(s.v.betalt).toBeInstanceOf(Date);
  });

  it("kansellerer en betaling uten eier, tar ikke pengene og åpner ikke saken", async () => {
    const varsel = vi.spyOn(console, "warn").mockImplementation(() => {});
    hentBetaling.mockResolvedValue({ ...betaling("AUTHORIZED"), profile: undefined, userDetails: { email: "kari@eksempel.no", firstName: "Kari", lastName: "Nordmann" } });
    expect(await avstem("abcdefghijkm")).toEqual({ status: "avbrutt" });
    expect(kanseller).toHaveBeenCalledWith("abcdefghijkm");
    expect(capture).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
    expect(satt).toHaveBeenCalledWith(expect.objectContaining({ status: "avbrutt" }));
    expect(varsel).toHaveBeenCalledWith("vipps: avbrutt uten sub", JSON.stringify({ ref: "abcdefghijkm" }));
    expect(JSON.stringify(varsel.mock.calls)).not.toMatch(/kari|Kari|Nordmann/);
    varsel.mockRestore();
  });

  it("varsler ikke når betalingen har en eier", async () => {
    const varsel = vi.spyOn(console, "warn").mockImplementation(() => {});
    hentBetaling.mockResolvedValue({ ...betaling("AUTHORIZED"), profile: { sub: "sub-1" } });
    await avstem("abcdefghijkm");
    expect(varsel).not.toHaveBeenCalled();
    varsel.mockRestore();
  });

  it("sender ikke kvittering når et annet kall gjorde ordren betalt", async () => {
    hentBetaling.mockResolvedValue(betaling("AUTHORIZED", { captured: 24900 }));
    batch.mockResolvedValueOnce([[], []]);
    expect((await avstem("abcdefghijkm")).status).toBe("betalt");
    expect(sendKvittering).not.toHaveBeenCalled();
  });

  it("tar ikke capture to ganger", async () => {
    hentBetaling.mockResolvedValue(betaling("AUTHORIZED", { captured: 24900 }));
    expect((await avstem("abcdefghijkm")).status).toBe("betalt");
    expect(capture).not.toHaveBeenCalled();
    expect(batch).toHaveBeenCalledOnce();
  });

  it("spør ikke Vipps om en ordre som er betalt", async () => {
    rad.ordre = { sakId: "sak222222222", status: "betalt", belopOre: 24900 };
    expect(await avstem("abcdefghijkm")).toEqual({ status: "betalt", sakId: "sak222222222" });
    expect(hentBetaling).not.toHaveBeenCalled();
  });

  it("åpner ikke saken når capture feiler", async () => {
    hentBetaling.mockResolvedValue(betaling("AUTHORIZED"));
    capture.mockRejectedValueOnce(new Error("nede"));
    expect(await avstem("abcdefghijkm")).toEqual({ status: "venter" });
    expect(batch).not.toHaveBeenCalled();
  });

  it.each(["ABORTED", "EXPIRED", "TERMINATED"] as const)("merker ordren avbrutt ved %s", async (tilstand) => {
    hentBetaling.mockResolvedValue(betaling(tilstand));
    expect(await avstem("abcdefghijkm")).toEqual({ status: "avbrutt" });
    expect(satt).toHaveBeenCalledWith(expect.objectContaining({ status: "avbrutt" }));
    expect(batch).not.toHaveBeenCalled();
  });

  it("åpner ikke en kansellert betaling", async () => {
    hentBetaling.mockResolvedValue(betaling("AUTHORIZED", { cancelled: 24900 }));
    expect(await avstem("abcdefghijkm")).toEqual({ status: "avbrutt" });
    expect(capture).not.toHaveBeenCalled();
  });

  it("kjenner ikke en ukjent referanse", async () => {
    rad.ordre = null;
    expect(await avstem("abcdefghijkm")).toEqual({ status: "ukjent" });
    expect(hentBetaling).not.toHaveBeenCalled();
  });
});
