import { describe, expect, it } from "vitest";
import { trygt } from "./kall";

describe("#7 kall som feiler", () => {
  it("trygt gjør et kastet kall om til en melding", async () => expect(await trygt(Promise.reject(new Error("nett")), "Prøv igjen.")).toEqual({ ok: false, melding: "Prøv igjen." }));
});
