import { describe, expect, it } from "vitest";
import klager from "./testdata/klager.json";
import { alleEksempler, finnEksempel } from "./eksempler";
import { beregnFaktorer } from "./faktorer";
import { FEILTYPER_KNAPPER } from "./innsending";
import { OPPDAGET_VALG, type KlageInput, type TestKlage } from "./typer";

const IDAG = "2026-10-01";
const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);
const eksempel = (i: KlageInput) => finnEksempel(beregnFaktorer(i, IDAG));

describe("eksempelsaker", () => {
  it("velger saken for feilgruppen og tiden til feilen viste seg", () => {
    const i = hent(1);
    i.feilen.typer = ["rust"];
    i.feilen.oppdaget = "innen_6_mnd";
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "lignende" });
    expect(eksempel(i)?.setning).toMatch(/Toyota Land Cruiser/);
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    expect(eksempel(i)?.setning).toMatch(/kjøpet kunne heves/);
  });

  it("med flere feil brukes den vanligste gruppen som har en sak for tidsrommet", () => {
    const i = hent(1);
    i.feilen.oppdaget = "innen_6_mnd";
    i.feilen.typer = ["skade", "motor", "rust"];
    expect(eksempel(i)?.setning).toMatch(/motorfeil/);
    // Brakes have no won decision for this timing, so rust is used before a brake case from another timing.
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    i.feilen.typer = ["bremser", "rust"];
    expect(eksempel(i)).toMatchObject({ treff: "lignende" });
    expect(eksempel(i)?.setning).toMatch(/rust/);
  });

  it("uten sak for tidsrommet brukes nærmeste tidsrom i samme gruppe", () => {
    const i = hent(1);
    i.feilen.typer = ["bremser"];
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "tilnaermet" });
    expect(eksempel(i)?.setning).toMatch(/bremsefeil/);
  });

  it("elbilbatteri har egne eksempler: vunnet bare for korteste tidsrom, ellers nærmeste", () => {
    const i = hent(1);
    i.feilen.typer = ["batteri"];
    i.feilen.oppdaget = "innen_6_mnd";
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "lignende" });
    expect(eksempel(i)?.setning).toMatch(/Tesla Model S .+ elbilbatteriet/);
    i.feilen.oppdaget = "over_2_ar";
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "tilnaermet" });
  });

  it("«Annet» gir et generelt eksempel", () => {
    const i = hent(1);
    i.feilen.typer = ["annet"];
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "generell" });
  });

  it("alle vurderte saker får et eksempel der kjøperen fikk medhold", () => {
    for (const type of FEILTYPER_KNAPPER) {
      for (const oppdaget of OPPDAGET_VALG) {
        const i = hent(1);
        i.feilen.typer = [type];
        i.feilen.oppdaget = oppdaget;
        const e = eksempel(i);
        expect(e, `${type} ${oppdaget}`).not.toBeNull();
        expect(e!.utfall).toBe("vunnet");
        expect(e!.setning).toMatch(/ medhold /);
        expect(e!.setning).not.toMatch(/ ikke medhold /);
      }
    }
  });

  it("alle setninger følger malen og har kilde", () => {
    const alle = alleEksempler();
    expect(alle).toHaveLength(29);
    expect(new Set(alle.map((e) => e.vedtakId)).size).toBe(29);
    for (const e of alle) {
      expect(e.setning).toMatch(
        /^I 20\d\d fikk kjøperen av en .+ (delvis )?medhold etter å ha klaget på .+ (etter|som) kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at .+)\.$/,
      );
      expect(e.kildeUrl).toMatch(/^https:\/\//);
      expect(e.saksnummer).toBeTruthy();
    }
  });
});
