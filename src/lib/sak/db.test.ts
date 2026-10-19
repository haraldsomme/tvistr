import { beforeEach, describe, expect, it, vi } from "vitest";

const rad = vi.hoisted(() => ({ verdi: null as Record<string, unknown> | null }));
const innlogget = vi.fn<() => Promise<string | null>>(async () => null);
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => (rad.verdi ? [rad.verdi] : []) }) }) }) } }));
vi.mock("@/lib/innlogging/okt", () => ({ innlogget }));

const { hentEgenSak } = await import("./db");

const id = "abcdefghijkm";
beforeEach(() => {
  vi.clearAllMocks();
  innlogget.mockResolvedValue(null);
  rad.verdi = { id, vippsSub: "sub-1", betalt: new Date() };
});

describe("hentEgenSak", () => {
  it("gir saken til eieren", async () => {
    innlogget.mockResolvedValue("sub-1");
    expect(await hentEgenSak(id)).toBe(rad.verdi);
  });
  it("gir null når ingen er innlogget", async () => {
    expect(await hentEgenSak(id)).toBeNull();
  });
  it("gir null for en annen konto", async () => {
    innlogget.mockResolvedValue("sub-2");
    expect(await hentEgenSak(id)).toBeNull();
  });
  it("gir null når saken ikke har eier", async () => {
    rad.verdi = { id, vippsSub: null, betalt: new Date() };
    innlogget.mockResolvedValue("sub-1");
    expect(await hentEgenSak(id)).toBeNull();
  });
  it("gir null for en ugyldig id", async () => {
    innlogget.mockResolvedValue("sub-1");
    expect(await hentEgenSak("x")).toBeNull();
  });
});
