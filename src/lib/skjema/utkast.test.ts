import { describe, expect, it } from "vitest";
import enyaq from "@/lib/sammenligning/testdata/enyaq-skjema.json";
import { validerSkjema } from "./skjema";
import { byggSkjema, type FeilUtkast, fjernFeil, tomFeil, tomtUtkast, type Utkast } from "./utkast";

// The Enyaq case as a buyer types it: amounts with spaces, sentences with capitals and full stops,
// and answers to questions that end up hidden (they must not leak into the JSON).
function enyaqUtkast(): Utkast {
  const rapport = (paregnelig: string) => ({ hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: paregnelig, kostnad: "ja" });
  const f = (o: Partial<FeilUtkast>): FeilUtkast => ({ ...tomFeil(), selger_sa_noe: "ja_skriftlig", verksted_sett_pa: "ja_skriftlig", kan_bilen_brukes: "ja", ...o });
  return {
    ...tomtUtkast(),
    selgertype: "forhandler",
    kjopsdato: "2025-03-14",
    pris_kr: "478 000",
    km_ved_kjop: "41 200",
    aarsmodell: "2021",
    merke_modell: "Skoda Enyaq iV 80",
    firmanavn: "Fjordbil Haugesund",
    treff: { foretaksnavn: "Fjordbil Haugesund AS", organisasjonsnummer: "999 000 123", forretningsadresse: "Industrigata 7, 5537 Haugesund" },
    treff_bekreftet: true,
    som_den_er: "nei",
    feil: [
      f({
        kategori: "klimaanlegg",
        en_setning: "Varmepumpen gir ikke varme, og rekkevidden faller kraftig i kulde.",
        dato_oppdaget: "2025-11-20",
        kan_bilen_brukes: "ja_begrenset",
        hvor_sto_det: ["annonse", "sms_epost_chat"],
        avskrift_selger: enyaq.del3_feil[0].avskrift_selger!,
        svar_pa_direkte_sporsmal: "ja",
        verksted_navn_dato: "Skoda Haugesund AS, 04.12.2025",
        rapport_sier: rapport("ja"),
        kostnad_kr: "38400",
        avskrift_verksted: `Verkstedet skriver at ${enyaq.del3_feil[0].avskrift_verksted}.`,
      }),
      f({
        kategori: "dekk_felger",
        en_setning: "Vinterdekkene som fulgte med er fra 2019 og har 4,5 mm mønster, ikke nye 2024-dekk som annonsert.",
        dato_oppdaget: "2025-10-28",
        hvor_sto_det: ["annonse"],
        avskrift_selger: enyaq.del3_feil[1].avskrift_selger!,
        svar_pa_direkte_sporsmal: "ja", // hidden: no message, so it must be false
        verksted_navn_dato: "Dekkhuset Haugesund AS, 28.10.2025",
        rapport_sier: rapport("star_ikke"),
        kostnad_kr: "11 900 kr",
        avskrift_verksted: "4 stk Nokian Hakkapeliitta R3, DOT 3819 (produsert uke 38/2019). Mønsterdybde 4,5–4,8 mm.",
      }),
      f({
        kategori: "servicehistorikk",
        en_setning: "Service ved 30 000 km er ikke utført, selv om annonsen sa at alle servicer var fulgt.",
        dato_oppdaget: "2025-12-04",
        hvor_sto_det: ["annonse"],
        avskrift_selger: enyaq.del3_feil[2].avskrift_selger!,
        verksted_navn_dato: "Skoda Haugesund AS, 04.12.2025",
        rapport_sier: rapport("star_ikke"),
        kostnad_kr: "6900",
        avskrift_verksted: enyaq.del3_feil[2].avskrift_verksted!,
      }),
    ],
    km_na: "52 900",
    tatt_opp: "ja_skriftlig",
    dato_forste_gang: "2025-10-29",
    selgers_svar: "avvist",
    avtale_inngatt: "ja", // hidden: only after a partial offer or an agreement
    selger_la_frem: "nei",
    onsket_losning: "reparasjon",
    navn: "Ingrid Solheim",
    adresse: "Fjellveien 14B,  5532 Haugesund",
    epost: "ingrid.solheim@example.no ",
    bekreft_riktig: true,
    bekreft_ikke_radgivning: true,
  };
}

describe("byggSkjema", () => {
  it("Enyaq slik en bruker taster den gir testdataens JSON", () => {
    const s = byggSkjema(enyaqUtkast(), enyaq._meta.registrert);
    expect(s).toEqual(enyaq);
    expect(validerSkjema(s, "2026-10-09")).toEqual([]);
  });

  it("skjulte spørsmål blir null eller tomme", () => {
    const u = enyaqUtkast();
    u.feil[0].selger_sa_noe = "ja_muntlig";
    u.feil[0].verksted_sett_pa = "nei";
    u.tatt_opp = "nei";
    const s = byggSkjema(u, "2026-10-09T12:00:00+02:00");
    expect(s.del3_feil[0]).toMatchObject({ hvor_sto_det: [], avskrift_selger: null, svar_pa_direkte_sporsmal: false, verksted_navn_dato: null, kostnad_kr: null, avskrift_verksted: null });
    expect(s.del3_feil[0].rapport_sier).toEqual({ hva: "star_ikke", hvorfor: "star_ikke", var_der_ved_overtakelse: "star_ikke", mer_enn_normal_slitasje: "star_ikke", kostnad: "star_ikke" });
    expect(s.del6_kontakt_med_selger).toEqual({
      tatt_opp_med_selger: "nei",
      dato_forste_gang: null,
      selgers_svar: null,
      avtale_inngatt: "nei",
      avtale_beskrivelse: null,
      avtale_gjelder_feil: [],
      selger_la_frem_dokumentasjon: "nei",
      selger_dokumentasjon_kort: null,
    });
    expect(validerSkjema(s, "2026-10-09")).toEqual([]);
  });

  it("avtalen gjelder de valgte feilene, og valget følger med når en feil fjernes", () => {
    const u = { ...enyaqUtkast(), selgers_svar: "enige_om_noe", avtale_inngatt: "ja", avtale_beskrivelse: "Selger betaler dekkene.", avtale_gjelder_feil: ["F3", "F2"] };
    expect(byggSkjema(u, "2026-10-09T12:00:00+02:00").del6_kontakt_med_selger).toMatchObject({ avtale_inngatt: "ja", avtale_gjelder_feil: ["F2", "F3"] });
    // F2 removed: F3 becomes F2.
    expect(fjernFeil(u, 1)).toMatchObject({ avtale_gjelder_feil: ["F2"] });
    expect(fjernFeil(u, 0).avtale_gjelder_feil).toEqual(["F2", "F1"]);
    // A hidden agreement question leaves the list empty.
    expect(byggSkjema({ ...u, selgers_svar: "avvist" }, "2026-10-09T12:00:00+02:00").del6_kontakt_med_selger.avtale_gjelder_feil).toEqual([]);
  });

  it("et treff som ikke er bekreftet, lagres ikke", () => {
    const u = enyaqUtkast();
    u.treff_bekreftet = false;
    expect(byggSkjema(u, "2026-10-09T12:00:00+02:00").del2_selger).toMatchObject({ bronnoysund_treff: null, treff_bekreftet: false });
  });
});
