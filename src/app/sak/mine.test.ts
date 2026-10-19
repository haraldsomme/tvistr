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

const { mineKjop } = await import("./mine");

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
