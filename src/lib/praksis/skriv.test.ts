// Replays recorded model answers (npm run praksis -- … --opptak) through the current verifier, without the
// API. A change in the verifier's rules shows here; refresh with npm run praksis -- --oppdater-opptak <fil>.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skrivPraksis } from "./skriv";

const MAPPE = join(__dirname, "testdata");
const opptak = readdirSync(MAPPE).filter((f) => f.endsWith(".json") && !f.endsWith("-skjema.json"));

describe("opptak av modellsvar spilles av mot verifiseringen", () => {
  it.each(opptak)("%s", async (fil) => {
    const o = JSON.parse(readFileSync(join(MAPPE, fil), "utf8"));
    const fulltekst = new Map(Object.entries(o.fulltekst as Record<string, string>).map(([k, v]) => [Number(k), v]));
    const p = await skrivPraksis(
      { skjema: o.skjema, feil_id: o.feil_id, modus: o.modus ?? "spesifikk", kandidater: o.kandidater, idag: o.idag, fast: o.fast ?? null },
      { hentFulltekst: async () => fulltekst, hentAnalyse: async () => new Map(), kall: async () => ({ input: o.raa, modell: "opptak", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 } }) },
    );
    expect({ avsnitt: p.avsnitt, vedtak_id: p.vedtak_id, strykninger: p.strykninger }).toEqual(o.fasit);
    // The buyer's name, address and e-mail never reach the model.
    const k = o.skjema.del7_onske_og_kontakt.kjoper;
    for (const x of [k.navn, k.adresse, k.epost]) expect(p.bruker).not.toContain(x);
  });
});
