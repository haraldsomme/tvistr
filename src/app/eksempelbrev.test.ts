import { describe, expect, it } from "vitest";
import { byggBrev, tilTekst } from "@/lib/app/brev";
import { eksempel, syncAreas } from "@/lib/app/skjema";
import { DATO, EMNE, eksempelPresedens, UTDRAG } from "./eksempelbrev";

// The landing page's excerpt must be what the letter writes for the example case.
const idag = "2026-10-16";
const brev = tilTekst(byggBrev(syncAreas({ ...eksempel(idag), c_reg: "AB 12345" }), eksempelPresedens(), idag));

describe("eksempelbrevet på forsiden", () => {
  it.each([DATO, EMNE, ...UTDRAG.flatMap((d) => [...(d.overskrift ? [d.overskrift] : []), ...d.setninger])])("%s", (s) => expect(brev).toContain(s));
});
