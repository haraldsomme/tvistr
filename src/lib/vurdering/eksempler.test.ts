import { describe, expect, it } from "vitest";
import klager from "./testdata/klager.json";
import { alleEksempler, finnEksempel } from "./eksempler";
import { beregnFaktorer } from "./faktorer";
import type { KlageInput, TestKlage } from "./typer";

const IDAG = "2026-10-01";
const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);
const eksempel = (i: KlageInput, niva: "sterk" | "middels" | "svak" = "sterk") => finnEksempel(beregnFaktorer(i, IDAG), niva);

describe("eksempelsaker", () => {
  it("velger saken for feilgruppen og tiden til feilen viste seg", () => {
    const i = hent(1);
    i.feilen.typer = ["rust"];
    i.feilen.oppdaget = "innen_6_mnd";
    expect(eksempel(i)?.setning).toMatch(/Toyota Land Cruiser/);
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    expect(eksempel(i)?.setning).toMatch(/kjøpet kunne heves/);
  });

  it("med flere feil brukes den vanligste gruppen som har en sak", () => {
    const i = hent(1);
    i.feilen.oppdaget = "innen_6_mnd";
    i.feilen.typer = ["skade", "motor", "rust"];
    expect(eksempel(i)?.setning).toMatch(/motorfeil/);
    // Brakes have no decision for this timing, so rust is used.
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    i.feilen.typer = ["bremser", "rust"];
    expect(eksempel(i)?.setning).toMatch(/rust/);
  });

  it("gir ingen sak for «Annet», for svake saker og der ingen sak holdt", () => {
    const i = hent(1);
    i.feilen.typer = ["annet"];
    expect(eksempel(i)).toBeNull();
    i.feilen.typer = ["motor"];
    expect(eksempel(i, "svak")).toBeNull();
    i.feilen.typer = ["bremser"];
    i.feilen.oppdaget = "over_2_ar";
    expect(eksempel(i, "middels")).toBeNull();
  });

  it("alle setninger følger malen og har kilde", () => {
    const alle = alleEksempler();
    expect(alle).toHaveLength(25);
    expect(new Set(alle.map((e) => e.vedtakId)).size).toBe(25);
    for (const e of alle) {
      expect(e.setning).toMatch(/^I 20\d\d fikk kjøperen av en .+ (delvis )?medhold etter å ha klaget på .+ etter kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at kjøpet kunne heves)\.$/);
      expect(e.kildeUrl).toMatch(/^https:\/\//);
      expect(e.saksnummer).toBeTruthy();
    }
  });
});
