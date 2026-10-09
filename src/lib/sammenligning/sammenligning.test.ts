import { describe, expect, it } from "vitest";
import skjemaJson from "./testdata/enyaq-skjema.json";
import { avledSanksjon, type SanksjonFakta } from "@/lib/analyse/avled";
import { byggArgumenter, lovendring, renderAvsnitt, velgSitat } from "./argumenter";
import { avledFeil, avledSak, erSpesifikk } from "./avled";
import { sammenlign } from "./index";
import { velgOpplysning, vurderKriterier } from "./kriterier";
import { fordel, ranger, sterkereEnn, velgTilBrev } from "./ranger";
import type { HentKandidater, Skjema, SkjemaFeil, VedtakFeil, Vurdert } from "./typer";

const IDAG = "2026-10-09";
const enyaq = skjemaJson as unknown as Skjema;

function vedtakFeil(o: Partial<VedtakFeil> = {}): VedtakFeil {
  return {
    vedtak_id: 1,
    feil_id: "f1",
    spor: "A",
    saksnummer: "FKU-2026-110357",
    vedtaksdato: "2026-02-18",
    kilde_url: "https://example.org/1.pdf",
    utfall: "delvis_medhold",
    grunn: null,
    selger_type: "forhandler",
    kategori: "elektrisk",
    komponenter: ["parkeringsvarmer"],
    grunnlag: "feil_opplysning",
    spor_vunnet: ["A"],
    a_variant: "uttalelse",
    alvor: [],
    dager_etter_levering: 117,
    lovversjon: "før_2024",
    alder_ved_kjop: 6,
    km_ved_kjop: 90_000,
    kjopesum_nok: 300_000,
    utbedringskostnad_nok: null,
    tilkjent_totalt_nok: 16_066,
    belop_tilkjent_nok: null,
    antall_mangler: 1,
    sanksjon: "erstatning",
    selger_bevis_finnes: false,
    forbehold: ["som_den_er"],
    forbehold_frase: "som den er",
    forste_henvendelse_dato: null,
    start_dato: "2023-07-10",
    antall_feil: 1,
    opplysninger: [
      {
        type: "uttalelse",
        form: "annonse",
        ordlyd: "parkeringsvarmer",
        rekkevidde: "spesifikk",
        gjelder: "parkeringsvarmer",
        svar_pa_direkte_sporsmal: false,
        status: "lagt_til_grunn",
        vekt: "for_klager",
        gjelder_feil: ["f1"],
        sitat: null,
        sitat_verifisert: null,
        ordlyd_verifisert: true,
      },
    ],
    bevis: [],
    begrunnelse_sitater: [{ tema: "opplysning", tekst: "Utvalget finner at bilen ikke hadde parkeringsvarmer slik annonsen opplyste.", gjelder_feil: ["f1"] }],
    ...o,
  };
}

function skjema(endre: (s: Skjema) => void): Skjema {
  const s = structuredClone(enyaq);
  endre(s);
  return s;
}

const feil = (o: Partial<SkjemaFeil>): SkjemaFeil => ({ ...enyaq.del3_feil[0], ...o });

function vurder(s: Skjema, f: SkjemaFeil, v: VedtakFeil): Vurdert & { dom: ReturnType<typeof sterkereEnn> } {
  const sak = avledSak(s, IDAG);
  const p = avledFeil(sak, f);
  const opplysning = v.spor === "A" && p.a_variant ? velgOpplysning(v, p.a_variant) : null;
  const kriterier = vurderKriterier(sak, p, v, opplysning);
  const dom = sterkereEnn(kriterier, sak, v);
  return { vedtak: v, opplysning, kriterier, antall_sterkere: kriterier.filter((k) => k.utfall === "sterkere").length, svakhet: dom.godkjent ? dom.svakhet : null, dom };
}

describe("avledning (fasit: forventet_output_enyaq.json)", () => {
  it("saken", () => {
    expect(avledSak(enyaq, IDAG)).toMatchObject({
      lov: "etter_2024",
      formodningsfrist_dager: 730,
      alder_ved_kjop: 4,
      prisband: "450k+",
      aldersband: "4-8",
      kmband: "<60k",
      km_siden_kjop: 11_700,
      mnd_siden_kjop: 19,
      km_per_mnd: 616,
      svakhet_sak: null,
      selger_motbevis: false,
      forlik: false,
      onsket_losning: "retting",
      heving_tillatt_i_praksis: false,
    });
  });

  it("T1–T3: feilene, spor og kategori", () => {
    const sak = avledSak(enyaq, IDAG);
    const [f1, f2, f3] = enyaq.del3_feil.map((f) => avledFeil(sak, f));
    expect(f1).toMatchObject({ kategori_pass2: "klimaanlegg", dager_til_feil: 251, innen_frist: true, slitedel: false, spor_primar: "A", a_variant: "uttalelse", spor_sekundar: "C", spor_alle: ["A", "C", "B"] });
    expect(f2).toMatchObject({ kategori_pass2: "dekk_felger", dager_til_feil: 228, innen_frist: true, slitedel: true, spor_primar: "A", spor_sekundar: "B", spor_alle: ["A", "B"] });
    expect(f3).toMatchObject({ kategori_pass2: "servicehistorikk", dager_til_feil: 265, slitedel: false, spor_primar: "A", spor_sekundar: "B", spor_alle: ["A", "B"] });
  });

  it("T14: km-svakhet", () => {
    const km = (kmNa: number, kjopsdato: string) => avledSak(skjema((s) => ((s.km_na = 41_200 + kmNa), (s.del1_kjopet.kjopsdato = kjopsdato))), IDAG).svakhet_sak;
    expect(km(11_700, "2025-03-14")).toBeNull();
    expect(km(25_000, "2024-04-09")).toBe("km");
    expect(km(9_000, "2026-05-09")).toBe("km");
  });

  it("T4: bremser med muntlig opplysning gir ikke A, men slitedelen får B innen fristen", () => {
    const sak = avledSak(enyaq, IDAG);
    const p = avledFeil(sak, feil({ kategori: "bremser", dato_oppdaget: "2025-11-14", selger_sa_noe: "ja_muntlig", hvor_sto_det: [], avskrift_selger: null, rapport_sier: { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } }));
    expect(p.spor_alle).toEqual(["B"]);
    expect(p.ingen_spor_arsak).toBeNull();
    const uten = avledFeil(sak, feil({ kategori: "bremser", dato_oppdaget: "2025-11-14", selger_sa_noe: "ja_muntlig", hvor_sto_det: [], avskrift_selger: null, verksted_sett_pa: "ja_muntlig" }));
    expect(uten.spor_alle).toEqual([]);
    expect(uten.ingen_spor_arsak).toBe("muntlig_opplysning");
  });

  it("T5: girkasse på gammel bil der rapporten ikke sier hvilken del som er feil, gir ingen spor", () => {
    const s = skjema((s) => Object.assign(s.del1_kjopet, { aarsmodell: 2014, km_ved_kjop: 255_000 }));
    const p = avledFeil(avledSak(s, IDAG), feil({ kategori: "girkasse", dato_oppdaget: "2025-03-24", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, rapport_sier: { hva: "nei", hvorfor: "nei", var_der_ved_overtakelse: "star_ikke", mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } }));
    expect(p.slitedel).toBe(true);
    expect(p.spor_alle).toEqual([]);
  });

  it("T6: rust etter 8 måneder før 2024, uten påregnelighet, gir ingen spor", () => {
    const s = skjema((s) => (s.del1_kjopet.kjopsdato = "2023-01-10"));
    const p = avledFeil(avledSak(s, IDAG), feil({ kategori: "rust", en_setning: "Rust i terskler.", dato_oppdaget: "2023-09-10", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, rapport_sier: { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } }));
    expect(p.kategori_pass2).toBe("rust");
    expect(p.spor_alle).toEqual([]);
    expect(p.ingen_spor_arsak).toBe("utenfor_frist");
  });
});

describe("kriterier og «sterkere enn»", () => {
  it("T1: F1 mot et 110357-lignende vedtak gir to sterkere og fasitens argumenter", () => {
    const x = vurder(enyaq, enyaq.del3_feil[0], vedtakFeil());
    expect(x.kriterier.map((k) => [k.navn, k.utfall])).toEqual([
      ["form", "lik"],
      ["konkrethet", "lik"],
      ["direkte_sporsmal", "sterkere"],
      ["forbehold", "sterkere"],
      ["kategori", "lik"],
    ]);
    expect(x.dom.godkjent).toBe(true);
    const sak = avledSak(enyaq, IDAG);
    expect(byggArgumenter(sak, avledFeil(sak, enyaq.del3_feil[0]), x)).toEqual([
      "I vedtaket sto opplysningen i annonsen; i min sak står den både i annonsen og i en skriftlig melding fra selger.",
      "Opplysningen ble gitt som svar på mitt direkte spørsmål.",
      "Bilen i vedtaket var solgt «som den er»; min bil ble solgt uten forbehold.",
    ]);
  });

  it("praksisavsnittet har fem ledd i fast rekkefølge", () => {
    const x = vurder(enyaq, enyaq.del3_feil[0], vedtakFeil());
    const sak = avledSak(enyaq, IDAG);
    const p = avledFeil(sak, enyaq.del3_feil[0]);
    expect(renderAvsnitt(p, x, byggArgumenter(sak, p, x), { tema: "formodning", tekst: "Innklagde har ikke bevist at feilen er oppstått senere" })).toBe(
      "Forbrukerklageutvalget har i vedtak FKU-2026-110357 av 18. februar 2026 lagt til grunn at selger hadde gitt en uriktig opplysning om det elektriske utstyret. " +
        "Annonsen oppga «parkeringsvarmer». Utvalget uttalte: «Innklagde har ikke bevist at feilen er oppstått senere». Kjøperen fikk erstattet 16 066 kr. " +
        "Min sak står minst like sterkt på de momentene utvalget bygde på. I vedtaket sto opplysningen i annonsen; i min sak står den både i annonsen og i en skriftlig melding fra selger. " +
        "Opplysningen ble gitt som svar på mitt direkte spørsmål. Bilen i vedtaket var solgt «som den er»; min bil ble solgt uten forbehold.",
    );
  });

  const avsnitt = (o: Partial<VedtakFeil>, endre?: (v: VedtakFeil) => void) => {
    const v = vedtakFeil(o);
    endre?.(v);
    const x = vurder(enyaq, enyaq.del3_feil[0], v);
    const sak = avledSak(enyaq, IDAG);
    const p = avledFeil(sak, enyaq.del3_feil[0]);
    return renderAvsnitt(p, x, byggArgumenter(sak, p, x), null);
  };

  it("beløpet sier hva det dekker", () => {
    expect(avsnitt({ belop_tilkjent_nok: 3_000, antall_mangler: 4, sanksjon: "prisavslag_og_erstatning", tilkjent_totalt_nok: 38_652 })).toContain(
      "Kjøperen fikk tilkjent 3 000 kr for denne mangelen.",
    );
    expect(avsnitt({ antall_mangler: 3, sanksjon: "prisavslag_og_erstatning", tilkjent_totalt_nok: 12_490 })).toContain(
      "Kjøperen fikk prisavslag og erstatning på til sammen 12 490 kr for manglene i saken.",
    );
    expect(avsnitt({ belop_tilkjent_nok: 12_490, sanksjon: "prisavslag_og_erstatning", tilkjent_totalt_nok: 12_490 })).toContain(
      "Kjøperen fikk prisavslag og erstatning på til sammen 12 490 kr for denne mangelen.",
    );
    expect(avsnitt({ antall_mangler: 2, sanksjon: "prisavslag", tilkjent_totalt_nok: 7_000 })).toContain("Kjøperen fikk prisavslag på til sammen 7 000 kr for manglene i saken.");
    expect(avsnitt({ sanksjon: "heving", belop_tilkjent_nok: 11_535 })).toContain("Kjøpet ble hevet.");
  });

  it("forbeholdet siteres med vedtakets ord", () => {
    expect(avsnitt({ forbehold_frase: "som den står" })).toContain("Bilen i vedtaket var solgt «som den står»; min bil ble solgt uten forbehold.");
    expect(avsnitt({ forbehold: ["annet"], forbehold_frase: null })).toContain("Salget i vedtaket hadde et forbehold om bilens stand; min bil ble solgt uten forbehold.");
  });

  it("kort ordlyd: «i utstyrslisten» bare når vedtaket sier det", () => {
    expect(avsnitt({}, (v) => Object.assign(v.opplysninger[0], { sitat: "Klimaanlegg sto i utstyrslisten i annonsen.", sitat_verifisert: true }))).toContain(
      "Annonsen oppga «parkeringsvarmer» i utstyrslisten.",
    );
    expect(avsnitt({}, (v) => Object.assign(v.opplysninger[0], { ordlyd: "Bilen har nye bremser bak" }))).toContain("Opplysningen sto i annonsen og lød: «Bilen har nye bremser bak».");
  });

  it("direkte spørsmål leses fra skjemaet, ikke fra at det var en melding", () => {
    const nei = feil({ svar_pa_direkte_sporsmal: false });
    expect(vurder(enyaq, nei, vedtakFeil()).kriterier.find((k) => k.navn === "direkte_sporsmal")?.utfall).toBe("lik");
    expect(vurder(enyaq, enyaq.del3_feil[0], vedtakFeil()).kriterier.find((k) => k.navn === "direkte_sporsmal")?.utfall).toBe("sterkere");
  });

  it("ukjent skjemaversjon avvises", async () => {
    await expect(sammenlign(skjema((s) => (s._meta.skjema_versjon = "0.4")), async () => [], IDAG)).rejects.toThrow(/skjemaversjon/);
  });

  it("lovendringen sies én gang, i entall eller flertall", () => {
    const sak = avledSak(enyaq, IDAG);
    expect(lovendring(sak, [vedtakFeil()])).toMatch(/^Vedtaket gjelder et kjøp før forbrukerkjøpsloven ble endret 1\. januar 2024\..*Ingen av reglene vedtaket bygger på/);
    expect(lovendring(sak, [vedtakFeil(), vedtakFeil()])).toMatch(/^Begge vedtakene gjelder kjøp/);
    expect(lovendring(sak, [vedtakFeil({ lovversjon: "etter_2024" })])).toBeNull();
    expect(lovendring(avledSak(skjema((s) => (s.del1_kjopet.kjopsdato = "2023-05-01")), IDAG), [vedtakFeil()])).toBeNull();
  });

  it("T3: samme kategori gir kategoribonus", () => {
    const x = vurder(enyaq, enyaq.del3_feil[2], vedtakFeil({ kategori: "servicehistorikk", forbehold: [] }));
    expect(x.kriterier.find((k) => k.navn === "kategori")?.utfall).toBe("sterkere");
    expect(x.antall_sterkere).toBe(1);
  });

  it("T8: annonse mot kontrakt er én adressert svakhet", () => {
    const v = vedtakFeil();
    v.opplysninger[0].form = "kontrakt";
    const x = vurder(enyaq, enyaq.del3_feil[1], v);
    expect(x.dom).toMatchObject({ godkjent: true });
    expect(x.svakhet?.navn).toBe("form");
  });

  it("vedtak uten opplysning knyttet til feilen forkastes", () => {
    const v = vedtakFeil({ antall_feil: 2 });
    v.opplysninger[0].gjelder_feil = ["f2"];
    expect(vurder(enyaq, enyaq.del3_feil[0], v).dom).toMatchObject({ godkjent: false });
  });

  it("T7: rust på spor C, senere enn vedtaket men bedre bil", () => {
    const s = skjema((s) => Object.assign(s.del1_kjopet, { kjopsdato: "2024-03-01", aarsmodell: 2022, km_ved_kjop: 22_000, pris_kr: 520_000 }));
    const f = feil({ kategori: "rust", en_setning: "Rust under bilen.", dato_oppdaget: "2025-09-01", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kan_bilen_brukes: "ja" });
    const v = vedtakFeil({
      spor: "C",
      kategori: "rust",
      spor_vunnet: ["C"],
      dager_etter_levering: 300,
      bevis: [
        { type: "verkstedrapport", avsender: null, fremlagt_av: "klager", dato: null, km_ved_undersokelse: null, arsak: "rotarsak", ved_levering: "ja", paregnelig: "utover", kostnad_nok: 20_000, utvalgets_vurdering: "vektlagt", avslagsgrunn: null, gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null },
      ],
    });
    const sak = avledSak(s, IDAG);
    const p = avledFeil(sak, f);
    expect(p.spor_primar).toBe("C");
    const x = vurder(s, f, v);
    expect(x.dom).toMatchObject({ godkjent: true });
    expect(x.svakhet?.navn).toBe("tid_til_feil");
    expect(x.kriterier.filter((k) => k.utfall === "sterkere").map((k) => k.navn)).toEqual(expect.arrayContaining(["alder", "km", "pris"]));
    expect(byggArgumenter(sak, p, x)).toContain(
      "Bilen var 2 år med 22 000 km og kostet 520 000 kr, mot 6 år, 90 000 km og 300 000 kr i vedtaket.",
    );
  });

  it("T9: selger har lagt frem motbevis; B-vedtak uten selgers bevis forkastes", () => {
    const s = skjema((s) => (s.del6_kontakt_med_selger.selger_la_frem_dokumentasjon = "ja"));
    const f = feil({ selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kategori: "motor", rapport_sier: { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } });
    expect(avledFeil(avledSak(s, IDAG), f).spor_primar).toBe("B");
    expect(vurder(s, f, vedtakFeil({ spor: "B", kategori: "motor", spor_vunnet: ["B"] })).dom).toMatchObject({ godkjent: false });
  });
});

describe("sanksjon, valg og reproduserbarhet", () => {
  it("T11: heving leses fra slutningen, ikke fra beløpene", () => {
    const fakta = (slutning: string, o: Partial<SanksjonFakta> = {}): SanksjonFakta => ({
      fulltekstRenset: `Lang begrunnelse. Forbrukerklageutvalget fatter slikt vedtak: ${slutning}`,
      utfall: "medhold",
      kravtyper: ["heving", "erstatning"],
      kjopesumNok: 209_000,
      tilkjentPrisavslagNok: null,
      tilkjentErstatningNok: null,
      tilkjentTotaltNok: 11_535,
      ...o,
    });
    // Net settlement: only 11 535 kr paid, but the car goes back (17/1629).
    expect(avledSanksjon(fakta("2. [KLAGER] frifinnes for kjøpesummen på kr 209 000, mot å stille den påklagde bilen til disposisjon for [PERSON]."))).toBe("heving");
    // A full stop inside "3.0" and a date does not end the clause (21/4203).
    expect(avledSanksjon(fakta("Nye AS plikter å betale kr 80 000 fra 20.02.2019, mot at Nissan Patrol 3.0 GR med registreringsnummer [PERSONOPPLYSNING] stilles til disposisjon."))).toBe("heving");
    // Returning a part is not rescission (24/1726).
    expect(avledSanksjon(fakta("Auto AS plikter å betale 4 655 kroner, mot at [KLAGER] returnerer mottatt ladekabel.", { tilkjentErstatningNok: 4_655, tilkjentTotaltNok: 4_655 }))).toBe("erstatning");
    // A return clause without a rescission claim is a trade-in (21/6296).
    expect(avledSanksjon(fakta("Tesla plikter å ta bilen i innbytte, mot at [KLAGER] stiller bilen til disposisjon.", { kravtyper: ["erstatning"] }))).not.toBe("heving");
    // Price repaid without a return clause (14/1382).
    expect(avledSanksjon(fakta("Bilportalen AS plikter å betale kr 249 000 til [KLAGER].", { kjopesumNok: 249_000, tilkjentTotaltNok: 249_000 }))).toBe("heving");
    expect(avledSanksjon(fakta("Plikter å betale prisavslag.", { kravtyper: ["prisavslag"], tilkjentPrisavslagNok: 7_000, tilkjentTotaltNok: 7_000 }))).toBe("prisavslag");
    expect(avledSanksjon(fakta("mot at bilen stilles til disposisjon", { utfall: "ikke_medhold" }))).toBeNull();
  });

  it("T11: bruker som vil ha retting, ber ikke om hevingsvedtak", async () => {
    const kall: boolean[] = [];
    await sammenlign(enyaq, async (q) => (kall.push(q.heving_tillatt), []), IDAG);
    expect(kall.every((h) => h === false)).toBe(true);
  });

  it("T10: privatkjøp stopper før matching", async () => {
    let hentet = false;
    const r = await sammenlign(skjema((s) => (s.del1_kjopet.selgertype = "privat")), async () => ((hentet = true), []), IDAG);
    expect(r.stopp).toBe("privat_selger");
    expect(hentet).toBe(false);
  });

  it("T12: velgTilBrev bruker styrke og kategoribonus før kostnad", () => {
    const x = (antall: number, kategori: string): Vurdert => ({ vedtak: vedtakFeil({ kategori }), opplysning: null, kriterier: [], antall_sterkere: antall, svakhet: null });
    expect(
      velgTilBrev([
        { feil_id: "F1", kostnad: 38_400, valgt: x(2, "elektrisk"), kategori: "klimaanlegg" },
        { feil_id: "F2", kostnad: 90_000, valgt: x(1, "utstyr_mangler"), kategori: "dekk_felger" },
        { feil_id: "F3", kostnad: 6_900, valgt: x(1, "servicehistorikk"), kategori: "servicehistorikk" },
      ]),
    ).toEqual(["F1", "F3"]);
  });

  it("to feil som peker på samme vedtak: den sterkeste får det, den andre tar neste", () => {
    const x = (id: number, antall: number): Vurdert => ({ vedtak: vedtakFeil({ vedtak_id: id }), opplysning: null, kriterier: [], antall_sterkere: antall, svakhet: null });
    const valgt = fordel(
      new Map([
        ["F1", [x(7, 2), x(8, 1)]],
        ["F2", [x(7, 3)]],
      ]),
      new Map([["F1", 1], ["F2", 1]]),
    );
    expect(valgt.get("F2")?.vedtak.vedtak_id).toBe(7);
    expect(valgt.get("F1")?.vedtak.vedtak_id).toBe(8);
  });

  it("T13: samme input gir identisk output", async () => {
    const hent: HentKandidater = async (q) =>
      q.spor === "A"
        ? [vedtakFeil({ vedtak_id: 3 }), vedtakFeil({ vedtak_id: 2, kategori: "klimaanlegg" }), vedtakFeil({ vedtak_id: 1, kategori: "servicehistorikk", forbehold: [] })]
        : [];
    const forste = JSON.stringify(await sammenlign(enyaq, hent, IDAG));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(await sammenlign(enyaq, hent, IDAG))).toBe(forste);
    const r = JSON.parse(forste);
    expect(r.feil.map((f: { kandidat: { vedtak_id: number } | null }) => f.kandidat?.vedtak_id)).toEqual([2, 3, 1]);
  });
});

describe("rettelser etter testsakene S01–S10", () => {
  it("en skriftlig opplysning er konkret når den nevner en komponent og ikke sier noe om hele bilen (presisjon først)", () => {
    expect(erSpesifikk("«WEBASTO, NAVI, HENGEFESTER»")).toBe(true);
    // «Mye utstyr» is about the whole car, so the list is general: a false A is worse than a missing one.
    expect(erSpesifikk("«LAV KM, WEBASTO, LANG, MYE UTSTYR ++»")).toBe(false);
    expect(erSpesifikk("«Dekk ser bra ut.»")).toBe(false);
    expect(erSpesifikk("«Pen BMW x1 xDrive18d Sport Line til salgs.»")).toBe(false);
    // Compounds by their last part, sale terms, and the form's legal facts.
    expect(erSpesifikk("«Nye vinterdekk på alufelg»")).toBe(true);
    expect(erSpesifikk("«Bilen selges fri for heftelser.»")).toBe(true);
    expect(erSpesifikk("«Grei bruksbil selges billig.»")).toBe(false);
    expect(erSpesifikk("«Tatt godt vare på»")).toBe(false);
    expect(erSpesifikk("«Kjøretøyets oljeforbruk er litt høyere enn vanlig.»")).toBe(true);
    expect(erSpesifikk("«Bilen er i meget god stand»")).toBe(false);
    expect(erSpesifikk("Pen og velholdt bil, strøken!")).toBe(false);
  });

  it("på spor C går samme kategori foran flere sterkere momenter (S04)", () => {
    const s = skjema((s) => Object.assign(s.del1_kjopet, { kjopsdato: "2024-06-04", aarsmodell: 2022, km_ved_kjop: 22_000, pris_kr: 520_000 }));
    const f = feil({ kategori: "rust", en_setning: "Rust i terskel.", dato_oppdaget: "2026-01-10", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kan_bilen_brukes: "ja" });
    const bevis = [{ type: "verkstedrapport" as const, avsender: null, fremlagt_av: "klager" as const, dato: null, km_ved_undersokelse: null, arsak: "rotarsak" as const, ved_levering: "ja" as const, paregnelig: "utover" as const, kostnad_nok: null, utvalgets_vurdering: "vektlagt" as const, avslagsgrunn: null, gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null }];
    const annen = vurder(s, f, vedtakFeil({ vedtak_id: 1, spor: "C", kategori: "drivlinje", dager_etter_levering: 600, alder_ved_kjop: 4, km_ved_kjop: 24_000, kjopesum_nok: 318_900, bevis }));
    const rust = vurder(s, f, vedtakFeil({ vedtak_id: 2, spor: "C", kategori: "rust", dager_etter_levering: 178, alder_ved_kjop: 15, km_ved_kjop: 178_200, kjopesum_nok: 49_000, bevis }));
    expect(annen.antall_sterkere).toBeGreaterThan(rust.antall_sterkere - 1);
    expect(rust.kriterier.find((k) => k.navn === "kategori")?.utfall).toBe("sterkere");
    const sak = avledSak(s, IDAG);
    expect(ranger([annen, rust], avledFeil(sak, f), sak)[0].vedtak.kategori).toBe("rust");
  });

  it("kostnadsandelen bruker vedtakets utbedringskostnad, ikke en bevisfaktura", () => {
    const s = skjema((s) => Object.assign(s.del1_kjopet, { kjopsdato: "2024-06-04", pris_kr: 520_000 }));
    const f = feil({ kategori: "rust", en_setning: "Rust.", dato_oppdaget: "2025-01-10", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kostnad_kr: 64_000 });
    const bevis = [{ type: "faktura" as const, avsender: null, fremlagt_av: "klager" as const, dato: null, km_ved_undersokelse: null, arsak: "ingen" as const, ved_levering: "ja" as const, paregnelig: "utover" as const, kostnad_nok: 2_600, utvalgets_vurdering: "vektlagt" as const, avslagsgrunn: null, gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null }];
    expect(vurder(s, f, vedtakFeil({ spor: "C", bevis })).kriterier.find((k) => k.navn === "kostnad_pris")?.utfall).toBe("utelat");
    expect(vurder(s, f, vedtakFeil({ spor: "C", bevis, utbedringskostnad_nok: 15_000 })).kriterier.find((k) => k.navn === "kostnad_pris")?.utfall).toBe("sterkere");
  });

  it("km-svakheten tas opp i avsnittet bare når verkstedet knytter feilen til leveringen (S09)", () => {
    const s = skjema((s) => ((s.del1_kjopet.kjopsdato = "2024-04-01"), (s.km_na = s.del1_kjopet.km_ved_kjop + 25_000)));
    const sak = avledSak(s, IDAG);
    const uten = feil({ rapport_sier: { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "star_ikke", mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } });
    expect(byggArgumenter(sak, avledFeil(sak, uten), vurder(s, uten, vedtakFeil())).join(" ")).not.toContain("km siden kjøpet");
    const med = feil({});
    expect(byggArgumenter(sak, avledFeil(sak, med), vurder(s, med, vedtakFeil()))).toContain(
      "Jeg har kjørt 25 000 km siden kjøpet. Verkstedet har likevel knyttet feilen til leveringstidspunktet.",
    );
  });

  it("spor B: senere feil kan bare adresseres når verkstedet knytter den til leveringen (S06)", () => {
    const f = (levering: "ja" | "star_ikke") =>
      feil({ selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kategori: "elektrisk", dato_oppdaget: "2025-05-20", rapport_sier: { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: levering, mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } });
    const v = vedtakFeil({ spor: "B", kategori: "elektrisk", spor_vunnet: ["B"], dager_etter_levering: 5 });
    expect(vurder(enyaq, f("star_ikke"), v).dom).toMatchObject({ godkjent: false });
    expect(vurder(enyaq, f("ja"), v).dom).toMatchObject({ godkjent: true });
  });

  it("spor B: egen innledning når selger i vedtaket la frem dokumentasjon (S06)", () => {
    const f = feil({ selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kategori: "elektrisk", dato_oppdaget: "2025-03-16" });
    const x = vurder(enyaq, f, vedtakFeil({ spor: "B", kategori: "elektrisk", spor_vunnet: ["B"], dager_etter_levering: 5, selger_bevis_finnes: true }));
    const sak = avledSak(enyaq, IDAG);
    expect(renderAvsnitt(avledFeil(sak, f), x, [], null)).toContain(
      "lagt til grunn at en feil som viste seg 5 dager etter leveringen, forelå ved leveringen, og at selgers dokumentasjon ikke var tilstrekkelig til å motbevise dette.",
    );
  });

  it("sitater som kan snus mot kjøperen, brukes ikke (S08)", () => {
    const synlig = { tema: "opplysning" as const, tekst: "På bakgrunn av at skaden er lett synlig på bilen mener utvalget at innklagde var klar over skaden.", gjelder_feil: ["f1"] };
    expect(velgSitat(vedtakFeil({ begrunnelse_sitater: [synlig] }))).toBeNull();
    const annet = { ...synlig, tekst: "Utvalget legger til grunn at selger kjente til skaden da bilen ble solgt." };
    expect(velgSitat(vedtakFeil({ begrunnelse_sitater: [synlig, annet] }))?.tekst).toBe(annet.tekst.replace(/\.$/, ""));
    const sannsynlig = { ...synlig, tekst: "Utvalget finner det sannsynliggjort at innklagde har gitt uriktige opplysninger om bilen." };
    expect(velgSitat(vedtakFeil({ begrunnelse_sitater: [sannsynlig] }))).not.toBeNull();
    const senere = { ...synlig, tekst: "Utvalget finner at selger har gitt uriktige opplysninger om klimaanlegget. Kjøperen burde likevel ha undersøkt bilen." };
    expect(velgSitat(vedtakFeil({ begrunnelse_sitater: [senere] }))?.tekst).toBe("Utvalget finner at selger har gitt uriktige opplysninger om klimaanlegget");
  });

  it("sitatfragmenter brukes ikke (S06, S09)", () => {
    const fragment = { tema: "formodning" as const, tekst: "foreligget på overtagelsestidspunktet ettersom selgeren ikke har ført motbevis", gjelder_feil: ["f1"] };
    expect(velgSitat(vedtakFeil({ spor: "B", begrunnelse_sitater: [fragment] }))).toBeNull();
    const hel = { ...fragment, tekst: "Utvalget legger til grunn at feilen forelå ved leveringen, ettersom selgeren ikke har ført motbevis." };
    expect(velgSitat(vedtakFeil({ spor: "B", begrunnelse_sitater: [fragment, hel] }))?.tekst).toBe(hel.tekst.replace(/\.$/, ""));
    // Stored without its full stop, but the full text shows the sentence ends there.
    const utenPunktum = { ...fragment, tekst: "Utvalget legger til grunn at feilen forelå ved leveringen", neste_tegn: " De" };
    expect(velgSitat(vedtakFeil({ spor: "B", begrunnelse_sitater: [utenPunktum] }))?.tekst).toBe(utenPunktum.tekst);
    const avkuttet = { ...fragment, tekst: "Det foreligger uansett opplysningssvikt i form av feilopplysninger knyttet til at bilen", neste_tegn: " ik" };
    expect(velgSitat(vedtakFeil({ spor: "B", begrunnelse_sitater: [avkuttet] }))).toBeNull();
  });

  it("alvor ligger i outputen (S10)", async () => {
    const r = await sammenlign(enyaq, async () => [], IDAG);
    expect(r.feil[0]).toMatchObject({ kan_bilen_brukes: "ja_begrenset", alvor: true });
  });
});

describe("vedtak per feil: regler fra 2026-10-09", () => {
  const BREMS_RAPPORT = { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } as const;
  const brems = feil({ kategori: "bremser", dato_oppdaget: "2025-11-14", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, rapport_sier: BREMS_RAPPORT });
  const RAPPORT_LEVERING = { type: "verkstedrapport", avsender: null, fremlagt_av: "klager", dato: null, km_ved_undersokelse: null, arsak: "rotarsak", ved_levering: "ja", paregnelig: "utover", kostnad_nok: 20_000, utvalgets_vurdering: "vektlagt", avslagsgrunn: null, gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null } as VedtakFeil["bevis"][number];
  const bVedtak = (o: Partial<VedtakFeil>) => vedtakFeil({ spor: "B", spor_vunnet: ["B"], grunnlag: null, opplysninger: [], forbehold: [], ...o });

  it("generelle utsagn gir ikke spor A", () => {
    const sak = avledSak(enyaq, IDAG);
    const p = avledFeil(sak, feil({ kategori: "rust", selger_sa_noe: "ja_skriftlig", hvor_sto_det: ["annonse"], avskrift_selger: "«Meget pen og velholdt bil»", verksted_sett_pa: "nei", rapport_sier: { hva: "star_ikke", hvorfor: "star_ikke", var_der_ved_overtakelse: "star_ikke", mer_enn_normal_slitasje: "star_ikke", kostnad: "star_ikke" } }));
    expect(p.spor_alle).toEqual([]);
    expect(p.ingen_spor_arsak).toBe("rapport_mangler");
  });

  it("utenfor fristen: bare C, aldri B, også for slitedeler", () => {
    const s = skjema((s) => (s.del1_kjopet.kjopsdato = "2023-01-10"));
    const p = avledFeil(avledSak(s, IDAG), { ...brems, dato_oppdaget: "2023-12-10" });
    expect(p.innen_frist).toBe(false);
    expect(p.spor_alle).toEqual([]);
    expect(p.ingen_spor_arsak).toBe("utenfor_frist");
  });

  it("slitedel på B: bare mot et B-vedtak i samme slitedelskategori", () => {
    const krit = (v: VedtakFeil) => vurder(enyaq, brems, v);
    const sammeKategori = krit(bVedtak({ kategori: "bremser" }));
    expect(sammeKategori.kriterier.find((k) => k.navn === "ikke_slitedel")?.utfall).toBe("lik");
    expect(sammeKategori.dom.godkjent).toBe(true);
    expect(krit(bVedtak({ kategori: "dekk_felger" })).dom).toMatchObject({ godkjent: false, grunn: "svakere på ikke_slitedel" });
    expect(krit(bVedtak({ kategori: "motor" })).dom).toMatchObject({ godkjent: false, grunn: "svakere på ikke_slitedel" });
  });

  it("en feil som ikke er slitedel, er sterkere enn et slitedelsvedtak, også motor på gammel bil i vedtaket", () => {
    const motor = feil({ kategori: "motor", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, rapport_sier: BREMS_RAPPORT });
    const x = vurder(enyaq, motor, bVedtak({ kategori: "motor", alder_ved_kjop: 12, km_ved_kjop: 210_000 }));
    expect(x.kriterier.find((k) => k.navn === "ikke_slitedel")?.utfall).toBe("sterkere");
  });

  it("feil uten vedtak er svak og får nærmeste vinnende vedtak med det brukeren mangler", async () => {
    // Seller showed counter-evidence; the only B decision had none, so it is rejected and becomes the nearest.
    const s = skjema((s) => {
      s.del3_feil = [{ ...brems, kategori: "motor" }];
      s.del6_kontakt_med_selger.selger_la_frem_dokumentasjon = "ja";
      s.del6_kontakt_med_selger.selger_dokumentasjon_kort = "EU-kontroll";
    });
    const r = await sammenlign(s, async (q) => (q.spor === "B" ? [bVedtak({ kategori: "motor", saksnummer: "22/1000", dager_etter_levering: 300 })] : []), IDAG);
    expect(r.feil[0]).toMatchObject({ godkjent: false, avsnitt: null, styrke: "svak" });
    expect(r.feil[0].naermeste).toMatchObject({ saksnummer: "22/1000", spor: "B", mangler: ["selger_motbevis"] });
    expect(r.valgt_til_brev).toEqual([]);
  });

  it("feil uten spor får nærmeste C-vedtak, med rapportens innhold som det som mangler", async () => {
    const s = skjema((s) => (s.del3_feil = [feil({ kategori: "motor", selger_sa_noe: "ja_muntlig", hvor_sto_det: [], avskrift_selger: null, verksted_sett_pa: "ja_muntlig" })]));
    const spurt: string[] = [];
    const r = await sammenlign(s, async (q) => (spurt.push(q.spor), q.spor === "C" ? [vedtakFeil({ spor: "C", spor_vunnet: ["C"], kategori: "motor", saksnummer: "23/3446", dager_etter_levering: 300, bevis: [RAPPORT_LEVERING] })] : []), IDAG);
    expect(r.feil[0]).toMatchObject({ ingen_spor_arsak: "muntlig_opplysning", godkjent: false, styrke: "svak", kandidat: null, avsnitt: null });
    expect(r.feil[0].naermeste).toMatchObject({ saksnummer: "23/3446", spor: "C" });
    expect(r.feil[0].naermeste?.mangler).toEqual(expect.arrayContaining(["utover_paregnelig", "ved_levering"]));
    expect(spurt).toEqual(expect.arrayContaining(["C", "B"]));
  });

  it("nærmeste foretrekker vedtak der alt som mangler, kan skaffes med en rapport", async () => {
    const s = skjema((s) => (s.del3_feil = [feil({ kategori: "motor", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, verksted_sett_pa: "nei" })]));
    const c = (o: Partial<VedtakFeil>) => vedtakFeil({ spor: "C", spor_vunnet: ["C"], kategori: "motor", dager_etter_levering: 300, ...o });
    // Newer, but the user's car is older than the decision's (no report changes that).
    const nyereMenEldreBil = c({ vedtak_id: 1, saksnummer: "26/1", vedtaksdato: "2026-05-01", alder_ved_kjop: 2, bevis: [] });
    const rapportKanLukke = c({ vedtak_id: 2, saksnummer: "24/2", vedtaksdato: "2024-05-01", bevis: [RAPPORT_LEVERING] });
    const r = await sammenlign(s, async (q) => (q.spor === "C" ? [nyereMenEldreBil, rapportKanLukke] : []), IDAG);
    expect(r.feil[0].naermeste).toMatchObject({ saksnummer: "24/2", mangler: ["utover_paregnelig", "ved_levering"] });
  });

  it("feil med vedtak og uten motstridende tap er sterk og har ingen nærmeste", async () => {
    const r = await sammenlign(enyaq, async (q) => (q.spor === "A" && !q.tapte ? [vedtakFeil({ kategori: "klimaanlegg" })] : []), IDAG);
    expect(r.feil[0]).toMatchObject({ godkjent: true, styrke: "sterk", naermeste: null, motstridende: null });
  });

  it("én dag står i entall i avsnittet", () => {
    const s = skjema((s) => (s.del6_kontakt_med_selger.dato_forste_gang = "2025-10-29"));
    const f = { ...brems, kategori: "motor" as const, dato_oppdaget: "2025-10-28" };
    const x = vurder(s, f, bVedtak({ kategori: "motor", dager_etter_levering: 300, start_dato: "2023-07-10", forste_henvendelse_dato: "2024-05-16" }));
    const sak = avledSak(s, IDAG);
    expect(byggArgumenter(sak, avledFeil(sak, f), x)).toContain("Jeg reklamerte 1 dag etter at feilen ble oppdaget.");
  });

  it("reklamert for sent og forlik er flagg, ikke stopp", async () => {
    const s = skjema((s) => {
      s.del6_kontakt_med_selger.dato_forste_gang = "2026-03-01";
      Object.assign(s.del6_kontakt_med_selger, { selgers_svar: "enige_om_noe", avtale_inngatt: "ja", avtale_beskrivelse: "selger betaler dekkene" });
    });
    const r = await sammenlign(s, async () => [], IDAG);
    expect(r.stopp).toBeNull();
    expect(r.sak.forlik).toBe(true);
    expect(r.feil.map((f) => f.reklamasjon_over_to_mnd)).toEqual([true, true, true]);
    expect((await sammenlign(enyaq, async () => [], IDAG)).feil.map((f) => f.reklamasjon_over_to_mnd)).toEqual([null, false, null]);
  });
});

describe("vedtak per feil: årsak, kategori, forlik og middels styrke", () => {
  const RAPPORT = { hva: "ja", hvorfor: "star_ikke", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } as const;
  const motor = feil({ kategori: "motor", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, rapport_sier: RAPPORT });
  const bevis = (arsak: string) => ({ type: "verkstedrapport", avsender: null, fremlagt_av: "klager", dato: null, km_ved_undersokelse: null, arsak, ved_levering: "uttaler_seg_ikke", paregnelig: "uttaler_seg_ikke", kostnad_nok: null, utvalgets_vurdering: "vektlagt", avslagsgrunn: null, gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null }) as VedtakFeil["bevis"][number];
  const b = (o: Partial<VedtakFeil>) => vedtakFeil({ spor: "B", spor_vunnet: ["B"], grunnlag: null, opplysninger: [], forbehold: [], kategori: "motor", dager_etter_levering: 300, ...o });

  it("B krever bare at rapporten sier hvilken del som er feil", () => {
    const sak = avledSak(enyaq, IDAG);
    expect(avledFeil(sak, motor).spor_alle).toEqual(["B"]);
    expect(avledFeil(sak, { ...motor, rapport_sier: { ...RAPPORT, hva: "star_ikke" } })).toMatchObject({ spor_alle: [], ingen_spor_arsak: "rapport_mangler" });
  });

  it("årsak er et vanlig kriterium på B", () => {
    const utfall = (f: SkjemaFeil, v: VedtakFeil) => vurder(enyaq, f, v).kriterier.find((k) => k.navn === "arsak");
    const medArsak = { ...motor, rapport_sier: { ...RAPPORT, hvorfor: "ja" as const } };
    expect(utfall(medArsak, b({ bevis: [bevis("komponent")] }))).toMatchObject({ utfall: "sterkere", krav: false });
    expect(utfall(motor, b({ bevis: [bevis("rotarsak")] }))).toMatchObject({ utfall: "svakere", krav: false });
    expect(utfall(motor, b({ bevis: [] }))?.utfall).toBe("lik");
    const sak = avledSak(enyaq, IDAG);
    expect(byggArgumenter(sak, avledFeil(sak, medArsak), vurder(enyaq, medArsak, b({ bevis: [bevis("komponent")] })))).toContain(
      "Verkstedet har i tillegg forklart hvorfor delen sviktet.",
    );
  });

  it("manglende årsak inngår i det nærmeste vedtaket som noe en rapport kan gi", async () => {
    const s = skjema((s) => (s.del3_feil = [motor]));
    const r = await sammenlign(s, async (q) => (q.spor === "B" && !q.tapte ? [b({ saksnummer: "22/7", bevis: [bevis("rotarsak")] })] : []), IDAG);
    expect(r.feil[0].naermeste).toMatchObject({ saksnummer: "22/7", mangler: ["arsak"] });
  });

  it("B og C krever samme kategori; A faller tilbake til samme opplysningsgruppe, aldri på tvers", async () => {
    expect(vurder(enyaq, motor, b({ kategori: "girkasse" })).dom).toMatchObject({ godkjent: false, grunn: "svakere på kategori" });
    // A: speil → ryggekamera is the same group; lien → DAB radio is not.
    const speil = feil({ kategori: "utstyr_mangler" });
    expect(vurder(enyaq, speil, vedtakFeil({ kategori: "elektrisk" })).kriterier.find((k) => k.navn === "kategori")?.utfall).toBe("lik");
    const pant = feil({ kategori: "heftelse_pant" });
    expect(vurder(enyaq, pant, vedtakFeil({ kategori: "elektrisk" })).dom).toMatchObject({ godkjent: false, grunn: "svakere på kategori" });
    // A fetches its own category first; the rest of the group only when nothing there is approved.
    const s = skjema((s) => (s.del3_feil = [{ ...enyaq.del3_feil[0], kategori: "utstyr_mangler" }]));
    const vedtak = [vedtakFeil({ vedtak_id: 1, kategori: "elektrisk" }), vedtakFeil({ vedtak_id: 2, kategori: "utstyr_mangler", forbehold: [] })];
    const spurt: string[][] = [];
    const fra = (godkjennes: boolean): HentKandidater => async (q) => {
      if (q.tapte || q.spor !== "A") return [];
      spurt.push(q.kategorier);
      return vedtak.filter((v) => q.kategorier.includes(v.kategori)).map((v) => (godkjennes || v.kategori !== "utstyr_mangler" ? v : { ...v, opplysninger: [] }));
    };
    const r = await sammenlign(s, fra(true), IDAG);
    expect(r.feil[0].kandidat?.vedtak_id).toBe(2);
    expect(spurt).toEqual([["utstyr_mangler"]]);
    // 30 rejected hits in the category cannot hide the group: it is a query of its own.
    spurt.length = 0;
    const r2 = await sammenlign(s, fra(false), IDAG);
    expect(spurt).toEqual([["utstyr_mangler"], ["elektrisk", "klimaanlegg", "dekk_felger", "karosseri_lakk_glass", "interior_lukt"]]);
    expect(r2.feil[0].kandidat?.vedtak_id).toBe(1);
    // B and C only ever ask for the category.
    const alle: string[][] = [];
    await sammenlign(enyaq, async (q) => (alle.push([q.spor, ...q.kategorier]), []), IDAG);
    expect(alle).toContainEqual(["C", "klimaanlegg"]);
    expect(alle.filter(([spor]) => spor !== "A").every((x) => x.length === 2)).toBe(true);
  });

  it("tap hentes bare fra samme kategori, også på A", async () => {
    const tapteSpurt: string[][] = [];
    await sammenlign(enyaq, async (q) => (q.tapte ? (tapteSpurt.push(q.kategorier), []) : q.spor === "A" ? [vedtakFeil({ kategori: "klimaanlegg" })] : []), IDAG);
    expect(tapteSpurt.length).toBeGreaterThan(0);
    expect(tapteSpurt.every((k) => k.length === 1)).toBe(true);
  });

  it("selgers motbevis forkaster vedtak på B og C, ikke på A", () => {
    const s = skjema((s) => Object.assign(s.del6_kontakt_med_selger, { selger_la_frem_dokumentasjon: "ja", selger_dokumentasjon_kort: "EU-kontroll" }));
    expect(vurder(s, enyaq.del3_feil[0], vedtakFeil({ kategori: "klimaanlegg", selger_bevis_finnes: false })).dom.godkjent).toBe(true);
    const c = vedtakFeil({ spor: "C", spor_vunnet: ["C"], kategori: "klimaanlegg", selger_bevis_finnes: false, bevis: [] });
    expect(vurder(s, enyaq.del3_feil[0], c).dom).toMatchObject({ godkjent: false, grunn: "selger har motbevis, det hadde ikke selger i vedtaket" });
    // It stays a flag for the letter engine on A.
    expect(avledSak(s, IDAG).selger_motbevis).toBe(true);
  });

  it("forlik gjelder bare feilene avtalen gjelder; de er ute av brevet", async () => {
    const s = skjema((s) =>
      Object.assign(s.del6_kontakt_med_selger, { selgers_svar: "enige_om_noe", avtale_inngatt: "ja", avtale_beskrivelse: "selger betaler dekkene", avtale_gjelder_feil: ["F2"] }),
    );
    // F1 and F2 both want decision 7; F2 is settled and must not take it from F1.
    const spurt: string[] = [];
    const hent: HentKandidater = async (q) => {
      if (q.tapte) return [];
      spurt.push(q.kategori);
      return q.spor === "A" ? [vedtakFeil({ vedtak_id: 7, kategori: q.kategori, saksnummer: `7-${q.kategori}` })] : [];
    };
    const s2 = skjema((x) => {
      Object.assign(x.del6_kontakt_med_selger, { selgers_svar: "enige_om_noe", avtale_inngatt: "ja", avtale_beskrivelse: "selger betaler", avtale_gjelder_feil: ["F2"] });
      x.del3_feil[1] = { ...x.del3_feil[1], kategori: "interior_lukt", kostnad_kr: 99_000 };
    });
    const r = await sammenlign(s2, hent, IDAG);
    expect(r.feil.map((f) => f.forlik)).toEqual([false, true, false]);
    expect(r.feil[0].kandidat?.vedtak_id).toBe(7);
    expect(r.feil[1]).toMatchObject({ kandidat: null, styrke: null, naermeste: null, motstridende: null });
    expect(r.valgt_til_brev).not.toContain("F2");
    // The settled defect is not matched at all.
    expect(spurt).not.toContain("interior_lukt");
    expect((await sammenlign(s, hent, IDAG)).feil[1].kandidat).toBeNull();
  });

  it("et tapt vedtak i samme kategori og spor med minst like god profil gir middels, med det som skilte", async () => {
    // S02: a wear part (old car), the report ties the defect to delivery but gives no cause.
    const gammel = (s: Skjema) => (Object.assign(s.del1_kjopet, { aarsmodell: 2014, km_ved_kjop: 255_000 }), (s.km_na = 256_000), (s.del3_feil = [{ ...motor, dato_oppdaget: "2025-03-24" }]));
    const s = skjema(gammel);
    const levering = { ...bevis("komponent"), ved_levering: "ja" } as VedtakFeil["bevis"][number];
    const vunnet = b({ vedtak_id: 10, saksnummer: "21/13427", dager_etter_levering: 31, alder_ved_kjop: 10, km_ved_kjop: 126_400 });
    const tapt = b({ vedtak_id: 11, saksnummer: "FKU-2026-56288", spor_vunnet: [], utfall: "avvist", grunn: "paregnelig_slitasje", dager_etter_levering: 16, alder_ved_kjop: 11, km_ved_kjop: 255_000, bevis: [levering] });
    const hent: HentKandidater = async (q) => (q.spor !== "B" ? [] : q.tapte ? [tapt] : [vunnet]);
    const r = await sammenlign(s, hent, IDAG);
    expect(r.feil[0]).toMatchObject({ godkjent: true, styrke: "middels", kandidat: { saksnummer: "21/13427" } });
    expect(r.feil[0].avsnitt).not.toBeNull();
    expect(r.feil[0].motstridende).toMatchObject({ saksnummer: "FKU-2026-56288", grunn: "paregnelig_slitasje" });
    expect(r.feil[0].motstridende?.skilte).toEqual([
      "I FKU-2026-56288 la utvalget til grunn at feilen var vanlig slitasje for bilens alder og kjørelengde.",
      "Bilen i FKU-2026-56288 hadde gått 255 000 km, mot 126 400 km i 21/13427.",
    ]);
    // A loss where the user is stronger on the profile (here: the losing buyer had no report on delivery while ours has) is no contradiction.
    // Of two losses, the one with the most similar facts is shown, not the one strongest against the user.
    const sterkTaper = b({ vedtak_id: 12, saksnummer: "FKU-2025-141827", spor_vunnet: [], utfall: "avvist", grunn: "paregnelig_slitasje", dager_etter_levering: 2, alder_ved_kjop: 14, km_ved_kjop: 261_000, bevis: [{ ...levering, arsak: "rotarsak" }] });
    const to = await sammenlign(s, async (q) => (q.spor !== "B" ? [] : q.tapte ? [sterkTaper, tapt] : [vunnet]), IDAG);
    expect(to.feil[0].motstridende?.saksnummer).toBe("FKU-2026-56288");
    // Lost for lack of what the user has: the report calls it more than normal wear.
    const utover = skjema((x) => (gammel(x), (x.del3_feil[0].rapport_sier.mer_enn_normal_slitasje = "ja")));
    expect((await sammenlign(utover, async (q) => (q.spor !== "B" ? [] : q.tapte ? [tapt] : [vunnet]), IDAG)).feil[0].styrke).toBe("sterk");
    // Unknown on the lost side is not «as good»: the user has the cause, the lost decision's evidence does not say.
    const medArsak = skjema((x) => (gammel(x), (x.del3_feil[0].rapport_sier.hvorfor = "ja")));
    const ukjentArsak = { ...tapt, bevis: [{ ...levering, arsak: "ingen" }] } as VedtakFeil;
    expect((await sammenlign(medArsak, async (q) => (q.spor !== "B" ? [] : q.tapte ? [ukjentArsak] : [vunnet]), IDAG)).feil[0].styrke).toBe("sterk");
    const svakereTap = { ...tapt, bevis: [] };
    const lev = await sammenlign(s, async (q) => (q.spor !== "B" ? [] : q.tapte ? [svakereTap] : [vunnet]), IDAG);
    expect(lev.feil[0].styrke).toBe("sterk");
  });
});

describe("rangering etter selgertype", () => {
  it("mot en forhandler går et forhandlervedtak foran et formidlingsvedtak, rett etter kategori", () => {
    const sak = avledSak(enyaq, IDAG);
    const f = avledFeil(sak, enyaq.del3_feil[0]);
    const x = (o: Partial<VedtakFeil>): Vurdert => ({ vedtak: vedtakFeil({ spor: "C", spor_vunnet: ["C"], kategori: "klimaanlegg", ...o }), opplysning: null, kriterier: [], antall_sterkere: 2, svakhet: null });
    // The commission sale is newer and has more stronger points; the dealer decision still comes first.
    const formidling = { ...x({ vedtak_id: 1, selger_type: "formidling", vedtaksdato: "2026-01-01" }), antall_sterkere: 4 };
    const forhandler = x({ vedtak_id: 2, selger_type: "forhandler", vedtaksdato: "2022-01-01" });
    expect(ranger([formidling, forhandler], f, sak).map((v) => v.vedtak.vedtak_id)).toEqual([2, 1]);
    // The category still comes first.
    const annenKategori = x({ vedtak_id: 3, selger_type: "forhandler", kategori: "elektrisk" });
    expect(ranger([annenKategori, formidling], f, sak).map((v) => v.vedtak.vedtak_id)).toEqual([1, 3]);
  });
});
