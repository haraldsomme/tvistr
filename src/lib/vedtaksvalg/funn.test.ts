import { describe, expect, it } from "vitest";
import type { Lagret as Avgjorende } from "@/lib/avgjorende/skjema";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { anvendPaAvgjorende, anvendPaFeilvurdering, type Kontrollfunn } from "./funn";

const feil = (id: string) => ({ id, samlet: false }) as AvledetFeil;
const avg: Avgjorende = {
  selger_svarte: true,
  rettslige_sitater: [{ poeng: "heving", sitat: "Mangelen er ikke uvesentlig." }],
  feil: [{ id: "f1", avgjorende: "", hjemmel: [], bevis: [], samlet_med: [], under_tvil: false, sanksjoner: [], sitater: ["Turboen var defekt ved levering.", "Partene er enige om feilen."] }],
};
const funn = (f: Partial<Kontrollfunn>): Kontrollfunn => ({ vedtakId: 7, feilId: "f1", sporsmal: "sitat", sitat: null, begrunnelse: "", ...f });

describe("tilbakeskriving av kontrollfunn", () => {
  it("setter samlet på en feil som ikke er nevnt eller ikke vurdert for seg", () => {
    const ut = anvendPaFeilvurdering({ feil: [feil("f1"), feil("f2")] }, [funn({ sporsmal: "for_seg" })]);
    expect(ut.feil.map((f) => f.samlet)).toEqual([true, false]);
  });

  it("fjerner sitater som ikke er utvalgets standpunkt, også rettslige", () => {
    const ut = anvendPaAvgjorende(avg, [funn({ sitat: "Partene er enige om feilen." }), funn({ feilId: null, sitat: "Mangelen er ikke uvesentlig." })]);
    expect(ut.feil[0].sitater).toEqual(["Turboen var defekt ved levering."]);
    expect(ut.rettslige_sitater).toEqual([]);
  });

});
