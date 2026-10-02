import { describe, expect, it } from "vitest";
import klager from "./testdata/klager.json";
import { beregnFaktorer, leggTilManeder, presumsjonManederFor } from "./faktorer";
import type { KlageInput, TestKlage } from "./typer";

const IDAG = "2026-10-01";
const testklager = klager as TestKlage[];
const hent = (id: number): KlageInput => structuredClone(testklager.find((k) => k.id === id)!.input);
const fakta = (i: KlageInput) => beregnFaktorer(i, IDAG);

describe("testdata", () => {
  it("har 10 klager med unike id-er", () => {
    expect(testklager).toHaveLength(10);
    expect(new Set(testklager.map((k) => k.id)).size).toBe(10);
  });
});

describe("datoer", () => {
  it("legger til måneder", () => {
    expect(leggTilManeder("2024-03-15", 24)).toBe("2026-03-15");
    expect(leggTilManeder("2023-06-15", 6)).toBe("2023-12-15");
  });
});

describe("presumsjon (fkjl § 18)", () => {
  it("to år for kjøp fra 2024: «6 måneder til 2 år» er innenfor, «over 2 år» er det ikke", () => {
    const i = hent(4); // kjøpt 2025-07-01
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 24, presumsjon: true });
    i.feilen.oppdaget = "over_2_ar";
    expect(fakta(i).presumsjon).toBe(false);
  });

  it("seks måneder for kjøp før 2024: bare «innen 6 måneder» er innenfor", () => {
    const i = hent(6); // kjøpt 2023-06-15, over to år
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 6, presumsjon: false });
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    expect(fakta(i).presumsjon).toBe(false);
    i.feilen.oppdaget = "innen_6_mnd";
    expect(fakta(i).presumsjon).toBe(true);
  });

  it("grensen går på kjøpsdato", () => {
    const i = hent(1);
    i.feilen.oppdaget = "6_mnd_til_2_ar";
    i.bilOgKjop.kjopsdato = "2023-12-31";
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 6, presumsjon: false });
    i.bilOgKjop.kjopsdato = "2024-01-31";
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 24, presumsjon: true });
  });

  it("perioden skifter 1. januar 2024", () => {
    expect(presumsjonManederFor("2023-12-31")).toBe(6);
    expect(presumsjonManederFor("2024-01-01")).toBe(24);
  });
});

describe("femårsfristen (fkjl § 27)", () => {
  it("er ute når det har gått mer enn fem år og forhandleren ikke er kontaktet", () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2021-09-30";
    expect(fakta(i).fristUte).toBe(true);
    i.bilOgKjop.kjopsdato = "2021-10-01";
    expect(fakta(i).fristUte).toBe(false);
  });

  it("er ute når første reklamasjon kom mer enn fem år etter kjøpet", () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2017-05-31";
    i.feilen.kontakt = "forsokt";
    i.feilen.forsteReklamasjon = "2022-06-30";
    expect(fakta(i).fristUte).toBe(true);
  });

  it("er ikke ute når første reklamasjon kom innen fem år, selv om kjøpet er eldre", () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2017-05-31";
    i.feilen.kontakt = "forsokt";
    i.feilen.forsteReklamasjon = "2022-05-31";
    expect(fakta(i).fristUte).toBe(false);
  });
});

describe("beregnFaktorer", () => {
  it("reklamasjonsbøtten følger svaret om når feilen viste seg", () => {
    expect(fakta(hent(1)).reklamasjonsbotte).toBe("rask");
    expect(fakta(hent(4)).reklamasjonsbotte).toBe("middels");
    expect(fakta(hent(6)).reklamasjonsbotte).toBe("sen");
  });

  it("statistikken sammenlignes med saker i samme rettslige stilling, svaret om tid er uendret", () => {
    const i = hent(4); // kjøpt 2025-07-01, to års presumsjon
    expect(i.feilen.oppdaget).toBe("6_mnd_til_2_ar");
    expect(fakta(i)).toMatchObject({ presumsjon: true, reklamasjonsbotte: "middels", statistikkbotte: "rask" });
    i.bilOgKjop.kjopsdato = "2023-06-30"; // seks måneders presumsjon: 6 mnd–2 år er utenfor
    expect(fakta(i)).toMatchObject({ presumsjon: false, reklamasjonsbotte: "middels", statistikkbotte: "middels" });
  });

  it("elbilbatteri har egen knapp", () => {
    const i = hent(1);
    i.feilen.typer = ["batteri"];
    expect(fakta(i).feilgrupper).toEqual([["batteri_elbil"]]);
  });

  it("å ikke ha kontaktet forhandleren endrer ingen fakta utenom femårsfristen", () => {
    const venter = hent(4);
    venter.feilen.kontakt = "venter";
    const a = fakta(hent(4));
    const b = fakta(venter);
    expect({ ...a, kontakt: null }).toEqual({ ...b, kontakt: null });
  });

  it("oversetter knappevalg til én gruppe per knapp uten duplikater, og «annet» gir ingen", () => {
    const i = hent(1);
    i.feilen.typer = ["motor", "girkasse", "motor", "annet"];
    expect(fakta(i).feilgrupper).toEqual([["motor"], ["girkasse", "clutch"]]);
    expect(fakta(hent(7)).feilgrupper).toEqual([["km_avvik", "servicehistorikk", "bruktimport_opplysning"]]);
    i.feilen.typer = ["annet"];
    expect(fakta(i).feilgrupper).toEqual([]);
  });

  it("markerer saker utenfor tjenesten, men ikke «vet ikke»", () => {
    expect(fakta(hent(2)).utenforTjenesten).toBe("privat_selger");
    expect(fakta(hent(9)).utenforTjenesten).toBe("ikke_privat_bruk");
    expect(fakta(hent(1)).utenforTjenesten).toBeNull();
    expect(fakta(hent(7)).utenforTjenesten).toBeNull();
  });

  it("opplyst feil gir tak på svak med mindre kjøperen sier at opplysningene var uriktige", () => {
    expect(fakta(hent(3)).opplystTakSvak).toBe(true);
    const villedet = hent(3);
    villedet.feilen.feilOpplysning = "ja_udokumentert";
    expect(fakta(villedet).opplystTakSvak).toBe(false);
    expect(fakta(villedet).opplystTakMiddels).toBe(true);
    villedet.feilen.feilOpplysning = "ja_dokumentert";
    expect(fakta(villedet)).toMatchObject({ opplystTakSvak: false, opplystTakMiddels: false });
    expect(fakta(hent(1)).opplystTakSvak).toBe(false);
  });

  it("feil opplysninger teller bare med dokumentasjon", () => {
    expect(fakta(hent(5)).feilOpplysningerDokumentert).toBe(true);
    const udokumentert = hent(5);
    udokumentert.feilen.feilOpplysning = "ja_udokumentert";
    expect(fakta(udokumentert).feilOpplysningerDokumentert).toBe(false);
    expect(fakta(hent(1)).feilOpplysningerDokumentert).toBe(false);
  });

  it("rapportens svar teller bare når det finnes en rapport", () => {
    const i = hent(10);
    i.bevis.rapportSierForKjop = true;
    expect(fakta(i).rapportSierForKjop).toBeNull();
  });
});
