import { describe, expect, it } from "vitest";
import { PRISKLASSER, typiskBelop } from "./belop";

describe("typiskBelop", () => {
  it("velger prisklasse etter kjøpesum og runder til nærmeste tusen", () => {
    expect(typiskBelop(35_000)).toMatchObject({ lav: 5000, hoy: 18000, median: 10000 });
    expect(typiskBelop(189_000)).toMatchObject({ lav: 10000, hoy: 31000, median: 20000 });
    expect(typiskBelop(500_000)).toMatchObject({ lav: 12000, hoy: 40000 });
  });

  it("grensene er eksklusive oppover", () => {
    expect(typiskBelop(49_999).n).toBe(PRISKLASSER[0].n);
    expect(typiskBelop(50_000).n).toBe(PRISKLASSER[1].n);
  });
});
