import { describe, expect, it } from "vitest";
import { BREVDATO, SAKER } from "../../../scripts/simulerte-saker";
import forventet from "./__fixtures__/forventet.json";
import gylne from "./__fixtures__/gylne.json";
import { lovlinjer, type VurderingResultat, vurderStatus } from "./vurdering";

// The twelve simulated cases on the letters' date. forventet.json was written from the rules before the
// assessment was run; gylne.json is the assessment from the database (npm run vurdering:gylne), whose
// only part outside the rules is whether the ranking found a decision on the same defect (level A).
const sak = (x: (typeof SAKER)[number]) => ({ kjopsdato: x.kjopsdato, idag: BREVDATO, km: x.km, ar: x.ar, somDenEr: x.somDenEr, feil: x.feil.map((f) => ({ hoved: f.hoved, under: f.under, oppdaget: f.oppdaget })) });
type Forventet = { grunner: string[]; frist: "ja" | "nei"; bevisbyrde: ("ja" | "nei")[]; forbehold: boolean };

describe("vurderingen av de tolv simulerte sakene", () => {
  it.each(SAKER.map((x) => [x.navn, x] as const))("%s", (navn, x) => {
    const f = (forventet as unknown as Record<string, Forventet>)[navn];
    const g = (gylne as unknown as Record<string, VurderingResultat>)[navn];
    const harA = g.kort.length > 0;
    const { status, grunner } = vurderStatus(sak(x), harA);
    expect(grunner.map((r) => r.regel)).toEqual([...f.grunner, ...(harA ? [] : ["ingen_niva_a"])]);
    expect(status).toBe(f.grunner.length || !harA ? "svak" : "sak");
    expect(g.status).toBe(status);

    const linjer = lovlinjer(sak(x));
    expect(linjer).toEqual(g.lovlinjer);
    expect(linjer.find((l) => l.tema === "frist")!.ikon).toBe(f.frist);
    expect(linjer.filter((l) => l.tema === "bevisbyrde").map((l) => l.ikon)).toEqual(f.bevisbyrde);
    expect(linjer.some((l) => l.tema === "forbehold")).toBe(f.forbehold);
  });
});
