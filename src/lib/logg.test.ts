import { expect, it } from "vitest";
import { feiltekst } from "./logg";

it("params logges ikke", () => {
  const e = new Error('Failed query: update sak set skjema = $1\nparams: {"b_name":"Kari Testesen"}', { cause: new Error("connection reset") });
  expect(feiltekst(e)).toBe("Failed query: update sak set skjema = $1 ← connection reset");
});
it("annet enn Error", () => expect(feiltekst("x")).toBe("x"));
