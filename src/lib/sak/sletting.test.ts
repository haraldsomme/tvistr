import { describe, expect, it, vi } from "vitest";

const slettet = vi.hoisted(() => [] as unknown[]);
vi.mock("@/db", () => ({
  db: {
    delete: (t: unknown) => ({ where: () => ({ returning: async () => (slettet.push(t), [{}, {}]) }) }),
  },
}));

const { slettUtlopteInnlogginger } = await import("./sletting");

describe("slettUtlopteInnlogginger", () => {
  it("sletter økter og påbegynte innlogginger, og teller begge", async () => {
    expect(await slettUtlopteInnlogginger(new Date("2026-10-19T12:00:00Z"))).toBe(4);
    expect(slettet).toHaveLength(2);
  });
});
