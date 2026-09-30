import { describe, expect, it } from "vitest";
import type { Tolkning } from "./ai/skjema";
import { kontroller, maaKontrolleres, sitatFinnes } from "./validering";

const tekst =
  "[KLAGER] kjøpte bilen for kr 150 000. Klager krever prisavslag på kr 30 000. Utvalget tilkjenner et prisavslag på kr 20 000. Klager gis delvis medhold. Bilen ble kjøpt av Bilsalg AS, en bilforhandler.";

function tolkning(over: Partial<Tolkning> = {}): Tolkning {
  return {
    kjoretoytype: "personbil",
    vedtaksdato: "2023-05-10",
    selger_type: "forhandler",
    selger_navn: "Bilsalg AS",
    selger_orgnr: null,
    verksted_navn: null,
    klager_er_forbruker: true,
    merke: "Volkswagen",
    modell: "Golf",
    arsmodell: 2015,
    drivstoff: "diesel",
    km_ved_kjop: 120000,
    kjopesum_nok: 150000,
    bruktimport: false,
    kjopsdato: "2022-03-01",
    overtakelsesdato: "2022-03-03",
    forste_reklamasjon_dato: "2022-05-02",
    forbehold: [],
    forbehold_tekst: null,
    feiltyper: ["girkasse"],
    feil_beskrivelse: "Feil på girkassen.",
    utbedringskostnad_nok: null,
    bevistyper: ["verkstedrapport"],
    bevis_vektlagt: null,
    kravtyper: ["prisavslag"],
    krevd_prisavslag_nok: 30000,
    krevd_erstatning_nok: null,
    krevd_totalt_nok: 30000,
    utfall: "delvis_medhold",
    tilkjent_prisavslag_nok: 20000,
    tilkjent_erstatning_nok: null,
    tilkjent_totalt_nok: 20000,
    gebyr_tilkjent: null,
    enstemmig: true,
    dissens: false,
    lov: "forbrukerkjøpsloven",
    lovversjon: "ukjent",
    paragrafer: ["forbrukerkjøpsloven § 16"],
    prinsipalt_krav: "prisavslag",
    mangelsgrunnlag: [],
    tvistetema: [],
    sammendrag: "…",
    utvalgets_nokkelmomenter: [],
    sitater: {
      utfall: "Klager gis delvis medhold.",
      selger_type: "en bilforhandler",
      kjopesum_nok: "kjøpte bilen for kr 150 000",
      utbedringskostnad_nok: null,
      krevd_prisavslag_nok: "Klager krever prisavslag på kr 30 000",
      krevd_erstatning_nok: null,
      krevd_totalt_nok: "krever prisavslag på kr 30 000",
      tilkjent_prisavslag_nok: "tilkjenner et prisavslag på kr 20 000",
      tilkjent_erstatning_nok: null,
      tilkjent_totalt_nok: "tilkjenner et prisavslag på kr 20 000",
      forbehold: null,
      lovversjon: null,
    },
    konfidens: 0.9,
    tolkningsmerknad: null,
    personopplysninger: { klager: [], personer: [], adresser: [], andre: [] },
    ...over,
  };
}

describe("kontroller", () => {
  it("accepts a consistent interpretation and computes derived fields", () => {
    expect(kontroller(tolkning(), tekst, new Date("2026-01-01"))).toEqual({
      dagerTilReklamasjon: 60,
      alderVedKjop: 7,
      arsaker: [],
    });
  });

  it("flags awarded above claimed and outcome/amount mismatch", () => {
    const k = kontroller(tolkning({ tilkjent_totalt_nok: 40000, utfall: "ikke_medhold", sitater: { ...tolkning().sitater } }), tekst, new Date("2026-01-01"));
    expect(k.arsaker).toContain("tilkjent totalt (40000) > krevd (30000)");
    expect(k.arsaker).toContain("utfall ikke_medhold, men 40000 kr tilkjent");
  });

  it("flags amounts without quotes and quotes not in the text", () => {
    const t = tolkning();
    const k = kontroller(
      { ...t, krevd_totalt_nok: 35000, sitater: { ...t.sitater, krevd_totalt_nok: null, utfall: "Klager får fullt medhold." } },
      tekst,
      new Date("2026-01-01"),
    );
    expect(k.arsaker).toEqual(["sitat for utfall finnes ikke ordrett i vedtaket", "krevd_totalt_nok mangler sitat"]);
  });

  it("does not flag alternative claims, and lets a total reuse a part's quote", () => {
    const t = tolkning();
    const k = kontroller(
      { ...t, krevd_erstatning_nok: 30000, sitater: { ...t.sitater, krevd_totalt_nok: null, krevd_erstatning_nok: "krever prisavslag på kr 30 000" } },
      tekst,
      new Date("2026-01-01"),
    );
    expect(k.arsaker).toEqual([]);
  });

  it("accepts a total without quote when it is the sum of quoted parts", () => {
    const t = tolkning();
    const k = kontroller(
      { ...t, krevd_erstatning_nok: 5000, krevd_totalt_nok: 35000, sitater: { ...t.sitater, krevd_totalt_nok: null, krevd_erstatning_nok: "kjøpte bilen for kr 150 000" } },
      tekst,
      new Date("2026-01-01"),
    );
    expect(k.arsaker).toEqual([]);
  });

  it("accepts the dealer's company name as the quote for selger_type", () => {
    const t = tolkning();
    expect(kontroller({ ...t, sitater: { ...t.sitater, selger_type: null } }, tekst, new Date("2026-01-01")).arsaker).toEqual([]);
  });

  it("keeps interpretation notes without flagging", () => {
    const k = kontroller(tolkning({ tolkningsmerknad: "beløp oppgitt som ca." }), tekst, new Date("2026-01-01"));
    expect(k.arsaker).toEqual(["merknad: beløp oppgitt som ca."]);
    expect(maaKontrolleres(k.arsaker)).toBe(false);
  });

  it("flags dates in the wrong order and low confidence", () => {
    const k = kontroller(tolkning({ forste_reklamasjon_dato: "2021-12-01", konfidens: 0.5 }), tekst, new Date("2026-01-01"));
    expect(k.arsaker).toContain("lav konfidens (0.5)");
    expect(k.arsaker).toContain("første reklamasjon er før overtakelsesdato");
  });
});

describe("sitatFinnes", () => {
  it("tolerates whitespace, case, quote marks and ellipses", () => {
    expect(sitatFinnes("Klager  krever «prisavslag» på kr 30 000", 'klager krever "prisavslag" på kr 30 000')).toBe(true);
    expect(sitatFinnes("kjøpte bilen … kr 150 000", tekst)).toBe(true);
    expect(sitatFinnes("kjøpte båten", tekst)).toBe(false);
  });
});
