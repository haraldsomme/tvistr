import { beforeEach, describe, expect, it, vi } from "vitest";

const innlogget = vi.fn<() => Promise<string | null>>(async () => null);
const rader = vi.hoisted(() => ({ verdi: [] as unknown[] }));
const hvor = vi.fn();
vi.mock("@/lib/innlogging/okt", () => ({ innlogget }));
vi.mock("drizzle-orm", async (orig) => ({
  ...(await orig<typeof import("drizzle-orm")>()),
  eq: (_k: unknown, v: unknown) => ({ eq: v }),
  isNotNull: () => ({ notNull: true }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: () => "desc",
}));
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: (w: unknown) => (hvor(w), { orderBy: async () => rader.verdi }) }) }) },
}));

const { mineBrev, mineKjop } = await import("./mine");

beforeEach(() => {
  innlogget.mockReset().mockResolvedValue(null);
  hvor.mockReset();
  rader.verdi = [];
});

describe("mineKjop", () => {
  it("is empty without a session, and does not ask the database", async () => {
    expect(await mineKjop()).toEqual([]);
    expect(hvor).not.toHaveBeenCalled();
  });

  it("gives the owner's paid cases as Kjopt, selecting only that sub and paid cases", async () => {
    innlogget.mockResolvedValue("sub-1");
    rader.verdi = [{ id: "a".repeat(12), skjema: { c_reg: "AB 12345", f_cats: ["motor"], f_parts: { motor: ["registerreim"] } } }];
    expect(await mineKjop()).toEqual([{ id: "a".repeat(12), reg: "AB 12345", cats: ["motor"], parts: { motor: ["registerreim"] } }]);
    expect(hvor).toHaveBeenCalledWith({ and: [{ eq: "sub-1" }, { notNull: true }] });
  });
});

describe("mineBrev", () => {
  it("is empty without a session, and does not ask the database", async () => {
    expect(await mineBrev()).toEqual({ navn: null, brev: [] });
    expect(hvor).not.toHaveBeenCalled();
  });

  it("gives one row per paid case, with the name from the case", async () => {
    innlogget.mockResolvedValue("sub-1");
    rader.verdi = [
      {
        id: "a".repeat(12),
        betalt: new Date("2026-08-14T10:00:00Z"),
        skjema: { b_name: "Kari Nordmann", c_make: "Toyota", c_model: "RAV4", c_reg: "EL 98765", f_cats: ["drivlinje"], f_parts: { drivlinje: ["girkasse"] } },
      },
    ];
    expect(await mineBrev()).toEqual({
      navn: "Kari Nordmann",
      brev: [{ id: "a".repeat(12), bil: "Toyota RAV4", reg: "EL 98765", feil: "Girkasse", dato: "14. aug. 2026", betalt: new Date("2026-08-14T10:00:00Z") }],
    });
    expect(hvor).toHaveBeenCalledWith({ and: [{ eq: "sub-1" }, { notNull: true }] });
  });

  it("takes the newest name that is filled in", async () => {
    innlogget.mockResolvedValue("sub-1");
    const skjema = { c_make: "", c_model: "", c_reg: "", f_cats: [], f_parts: {} };
    rader.verdi = [
      { id: "b".repeat(12), betalt: new Date("2026-09-01T10:00:00Z"), skjema: { ...skjema, b_name: " " } },
      { id: "c".repeat(12), betalt: new Date("2026-03-11T10:00:00Z"), skjema: { ...skjema, b_name: "Ola Nordmann" } },
    ];
    const r = await mineBrev();
    expect(r.navn).toBe("Ola Nordmann");
    expect(r.brev.map((b) => b.id)).toEqual(["b".repeat(12), "c".repeat(12)]);
  });
});
