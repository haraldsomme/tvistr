import { describe, expect, it } from "vitest";
import { rensSvar } from "./rens";

const svar = { kjopsdato: "2025-03-10", km: 120000, ar: 2017, somDenEr: "nei", krav: null, forsok: null, feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01", beskrivelse: null, opplysning: null, verksted: null, rapport: null }] };

describe("rensSvar", () => {
  it("godtar et gyldig svar", () => expect(rensSvar(svar)).not.toBeNull());
  it("#6 km og årsmodell utenfor området blir null i stedet for å avvise saken", () => {
    expect(rensSvar({ ...svar, km: 2_000_000, ar: 202 })).toMatchObject({ km: null, ar: null });
  });
  it("avviser ukjent kategori", () => expect(rensSvar({ ...svar, feil: [{ ...svar.feil[0], hoved: "x" }] })).toBeNull());
});
