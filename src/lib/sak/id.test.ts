import { describe, expect, it } from "vitest";
import { erId, nyId } from "./id";

describe("nyId", () => {
  it("gir 12 tegn uten forvekslbare tegn", () => {
    for (let i = 0; i < 200; i++) {
      const id = nyId();
      expect(id).toMatch(/^[a-z2-9]{12}$/);
      expect(id).not.toMatch(/[01ol]/);
      expect(erId(id)).toBe(true);
    }
  });

  it("gjentar seg ikke", () => expect(new Set(Array.from({ length: 1000 }, nyId)).size).toBe(1000));
});

describe("erId", () => {
  it.each([null, 12, "", "abc", "abcdefghijk", "abcdefghijkmn", "abcdefghijk0", "abcdefghijkl", "ABCDEFGHIJKM", "abcdefghijk-"])("avviser %j", (x) => expect(erId(x)).toBe(false));
});
