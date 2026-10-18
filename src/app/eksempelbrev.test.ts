import { describe, expect, it } from "vitest";
import { byggBrev, tilTekst } from "@/lib/app/brev";
import { eksempel, syncAreas } from "@/lib/app/skjema";
import { DATO, EMNE, FANER, eksempelPresedens } from "./eksempelbrev";

// The landing page's excerpts must be what the letter writes for the example case.
const idag = "2026-10-16";
const brev = tilTekst(byggBrev(syncAreas({ ...eksempel(idag), c_reg: "AB 12345" }), eksempelPresedens(), idag));

describe("eksempelbrevet på forsiden", () => {
  it.each([DATO, EMNE, ...FANER.flatMap((f) => [f.overskrift, ...f.setninger])])("%s", (s) => expect(brev).toContain(s));
  it.each(FANER.flatMap((f) => f.merk.map((m) => [f.id, m])))("%s: «%s» står i teksten", (id, m) => expect(FANER.find((f) => f.id === id)!.setninger.join(" ")).toContain(m));
  it("det viste vedtaket er det som siteres", () => {
    const f = FANER.find((x) => x.id === "vunnet")!;
    expect(f.setninger[0]).toContain("sak 104368 av 2.2.2026");
    expect(f.lenke).toContain("FKU-2026-104368");
  });
});
