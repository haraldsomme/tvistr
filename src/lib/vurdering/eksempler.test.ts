import { describe, expect, it } from "vitest";
import klager from "./testdata/klager.json";
import { alleEksempler, finnEksempel } from "./eksempler";
import { beregnFaktorer } from "./faktorer";
import { FEILTYPER_KNAPPER } from "./innsending";
import { OPPDAGET_VALG, type KlageInput, type Niva, type TestKlage } from "./typer";

const IDAG = "2026-10-01";
const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);
const eksempel = (i: KlageInput, niva: Niva = "sterk") => finnEksempel(beregnFaktorer(i, IDAG), niva);

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
    expect(eksempel(i, "middels")).toMatchObject({ utfall: "vunnet", treff: "tilnaermet" });
    expect(eksempel(i, "middels")?.setning).toMatch(/bremsefeil/);
  });

  it("svake saker får en tapt sak, og en sak tapt av samme grunn når feilen var opplyst", () => {
    const i = hent(1);
    i.feilen.typer = ["motor"];
    i.feilen.oppdaget = "over_2_ar";
    expect(eksempel(i, "svak")).toMatchObject({ utfall: "tapt", treff: "lignende" });
    expect(eksempel(i, "svak")?.setning).toMatch(/ikke medhold .+ ikke var vist at bilen hadde en mangel/);
    i.feilen.opplystForKjop = "ja";
    i.feilen.feilOpplysning = "nei";
    // Purchases from 2024 follow another rule, so they get an ordinary lost decision.
    expect(eksempel(i, "svak")?.setning).not.toMatch(/gjort kjent med feilen før kjøpet/);
    i.bilOgKjop.kjopsdato = "2021-02-14";
    expect(eksempel(i, "svak")?.setning).toMatch(/gjort kjent med feilen før kjøpet/);
  });

  it("elbilbatteri har egne eksempler: vunnet bare for korteste tidsrom, ellers nærmeste", () => {
    const i = hent(1);
    i.feilen.typer = ["batteri"];
    i.feilen.oppdaget = "innen_6_mnd";
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "lignende" });
    expect(eksempel(i)?.setning).toMatch(/Tesla Model S .+ elbilbatteriet/);
    i.feilen.oppdaget = "over_2_ar";
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "tilnaermet" });
    expect(eksempel(i, "svak")).toMatchObject({ utfall: "tapt", treff: "lignende" });
    expect(eksempel(i, "svak")?.setning).toMatch(/klaget for sent/);
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    expect(eksempel(i, "svak")?.setning).toMatch(/Kia Soul/);
  });

  it("«Annet» gir et generelt eksempel, og saker som ikke er vurdert gir ingen", () => {
    const i = hent(1);
    i.feilen.typer = ["annet"];
    expect(eksempel(i)).toMatchObject({ utfall: "vunnet", treff: "generell" });
    expect(eksempel(i, "svak")).toMatchObject({ utfall: "tapt", treff: "generell" });
    expect(eksempel(i, "ikke_aktuell")).toBeNull();
  });

  it("alle vurderte saker får et eksempel med riktig utfall", () => {
    for (const type of FEILTYPER_KNAPPER) {
      for (const oppdaget of OPPDAGET_VALG) {
        for (const niva of ["sterk", "middels", "svak"] as const) {
          const i = hent(1);
          i.feilen.typer = [type];
          i.feilen.oppdaget = oppdaget;
          const e = eksempel(i, niva);
          expect(e, `${type} ${oppdaget} ${niva}`).not.toBeNull();
          expect(e!.utfall).toBe(niva === "svak" ? "tapt" : "vunnet");
          expect(e!.setning).toMatch(/ medhold /);
          expect(/ ikke medhold /.test(e!.setning)).toBe(niva === "svak");
        }
      }
    }
  });

  it("alle setninger følger malen og har kilde", () => {
    const alle = alleEksempler();
    expect(alle).toHaveLength(62);
    expect(new Set(alle.map((e) => e.vedtakId)).size).toBe(62);
    for (const e of alle) {
      expect(e.setning).toMatch(
        /^I 20\d\d fikk kjøperen av en .+ (ikke |delvis )?medhold etter å ha klaget på .+ (etter|som) kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at .+)\.$/,
      );
      expect(e.kildeUrl).toMatch(/^https:\/\//);
      expect(e.saksnummer).toBeTruthy();
    }
  });
});
