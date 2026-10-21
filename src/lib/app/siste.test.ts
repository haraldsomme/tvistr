import { describe, expect, it } from "vitest";
import { sisteVinner } from "./siste";

describe("sisteVinner", () => {
  it("bare det siste kallet gjelder", () => {
    const s = sisteVinner();
    const a = s.start();
    const b = s.start();
    expect(s.gjelder(a)).toBe(false);
    expect(s.gjelder(b)).toBe(true);
  });
});
