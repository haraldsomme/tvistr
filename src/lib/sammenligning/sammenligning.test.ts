import { describe, expect, it } from "vitest";
import skjemaJson from "./testdata/enyaq-skjema.json";
import { avledSanksjon, type SanksjonFakta } from "@/lib/analyse/avled";
import { avledFeil, avledSak, erSpesifikk } from "./avled";
import { MAKS_KANDIDATER, sammenlign } from "./index";
import { velgOpplysning, vurderKriterier } from "./kriterier";
import { sterkereEnn, velgTilBrev } from "./ranger";
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
    viste_seg_kilde: "vedtak",
    lovversjon: "før_2024",
    alder_ved_kjop: 6,
    km_ved_kjop: 90_000,
    kjopesum_nok: 300_000,
    utbedringskostnad_nok: null,
    tilkjent_totalt_nok: 16_066,
    belop_tilkjent_nok: null,
    sanksjon: "erstatning",
    selger_bevis_finnes: false,
    forbehold: ["som_den_er"],
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
  return { vedtak: v, kriterier, antall_sterkere: kriterier.filter((k) => k.utfall === "sterkere").length, svakhet: dom.godkjent ? dom.svakhet : null, dom };
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
  it("T1: F1 mot et 110357-lignende vedtak gir to sterkere", () => {
    const x = vurder(enyaq, enyaq.del3_feil[0], vedtakFeil());
    expect(x.kriterier.map((k) => [k.navn, k.utfall])).toEqual([
      ["form", "lik"],
      ["konkrethet", "lik"],
      ["direkte_sporsmal", "sterkere"],
      ["forbehold", "sterkere"],
    ]);
    expect(x.dom.godkjent).toBe(true);
    expect(x.antall_sterkere).toBe(2);
  });

  it("direkte spørsmål leses fra skjemaet, ikke fra at det var en melding", () => {
    const nei = feil({ svar_pa_direkte_sporsmal: false });
    expect(vurder(enyaq, nei, vedtakFeil()).kriterier.find((k) => k.navn === "direkte_sporsmal")?.utfall).toBe("lik");
    expect(vurder(enyaq, enyaq.del3_feil[0], vedtakFeil()).kriterier.find((k) => k.navn === "direkte_sporsmal")?.utfall).toBe("sterkere");
  });

  it("ukjent skjemaversjon avvises", async () => {
    await expect(sammenlign(skjema((s) => (s._meta.skjema_versjon = "0.4")), async () => [], IDAG)).rejects.toThrow(/skjemaversjon/);
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
    expect(avledFeil(avledSak(s, IDAG), f).spor_primar).toBe("C");
    const x = vurder(s, f, v);
    expect(x.dom).toMatchObject({ godkjent: true });
    expect(x.svakhet?.navn).toBe("tid_til_feil");
    expect(x.kriterier.filter((k) => k.utfall === "sterkere").map((k) => k.navn)).toEqual(expect.arrayContaining(["alder", "km", "pris"]));
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

  it("T12: velgTilBrev tar de to feilene med flest sterkere momenter, så kostnad", () => {
    expect(
      velgTilBrev([
        { feil_id: "F1", kostnad: 38_400, antall_sterkere: 2 },
        { feil_id: "F2", kostnad: 90_000, antall_sterkere: 1 },
        { feil_id: "F3", kostnad: 6_900, antall_sterkere: 1 },
        { feil_id: "F4", kostnad: 500_000, antall_sterkere: null },
      ]),
    ).toEqual(["F1", "F2"]);
  });

  it("T13: samme input gir identisk output", async () => {
    const hent: HentKandidater = async (q) =>
      q.spor === "A" && !q.tapte ? [vedtakFeil({ vedtak_id: 3 }), vedtakFeil({ vedtak_id: 2, vedtaksdato: "2026-03-01" }), vedtakFeil({ vedtak_id: 1, forbehold: [] })] : [];
    const forste = JSON.stringify(await sammenlign(enyaq, hent, IDAG));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(await sammenlign(enyaq, hent, IDAG))).toBe(forste);
    // Most stronger points first (1 was sold without reservation, so the buyer's is not stronger there), then the newest.
    expect(JSON.parse(forste).feil[0].kandidater.map((k: { vedtak_id: number }) => k.vedtak_id)).toEqual([2, 3, 1]);
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

  it("kostnadsandelen bruker vedtakets utbedringskostnad, ikke en bevisfaktura", () => {
    const s = skjema((s) => Object.assign(s.del1_kjopet, { kjopsdato: "2024-06-04", pris_kr: 520_000 }));
    const f = feil({ kategori: "rust", en_setning: "Rust.", dato_oppdaget: "2025-01-10", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kostnad_kr: 64_000 });
    const bevis = [{ type: "faktura" as const, avsender: null, fremlagt_av: "klager" as const, dato: null, km_ved_undersokelse: null, arsak: "ingen" as const, ved_levering: "ja" as const, paregnelig: "utover" as const, kostnad_nok: 2_600, utvalgets_vurdering: "vektlagt" as const, avslagsgrunn: null, gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null }];
    expect(vurder(s, f, vedtakFeil({ spor: "C", bevis })).kriterier.find((k) => k.navn === "kostnad_pris")?.utfall).toBe("utelat");
    expect(vurder(s, f, vedtakFeil({ spor: "C", bevis, utbedringskostnad_nok: 15_000 })).kriterier.find((k) => k.navn === "kostnad_pris")?.utfall).toBe("sterkere");
  });

  it("spor B: senere feil kan bare adresseres når verkstedet knytter den til leveringen (S06)", () => {
    const f = (levering: "ja" | "star_ikke") =>
      feil({ selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kategori: "elektrisk", dato_oppdaget: "2025-05-20", rapport_sier: { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: levering, mer_enn_normal_slitasje: "star_ikke", kostnad: "ja" } });
    const v = vedtakFeil({ spor: "B", kategori: "elektrisk", spor_vunnet: ["B"], dager_etter_levering: 5 });
    expect(vurder(enyaq, f("star_ikke"), v).dom).toMatchObject({ godkjent: false });
    expect(vurder(enyaq, f("ja"), v).dom).toMatchObject({ godkjent: true });
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

  it("spor uten vedtak er middels; tapte saker er informasjon og påvirker ikke styrken", async () => {
    // Seller showed counter-evidence; the only B decision had none, so it is rejected.
    const s = skjema((s) => {
      s.del3_feil = [{ ...brems, kategori: "motor" }];
      s.del6_kontakt_med_selger.selger_la_frem_dokumentasjon = "ja";
      s.del6_kontakt_med_selger.selger_dokumentasjon_kort = "EU-kontroll";
    });
    const tapt = (id: number, grunn: string, dato: string) => bVedtak({ vedtak_id: id, kategori: "motor", saksnummer: `22/${id}`, vedtaksdato: dato, grunn, selger_bevis_finnes: true, bevis: [RAPPORT_LEVERING] });
    const r = await sammenlign(
      s,
      async (q) => (q.spor !== "B" ? [] : q.tapte ? [tapt(3, "paregnelig_slitasje", "2026-01-01"), tapt(2, "paregnelig_slitasje", "2025-01-01"), tapt(1, "ikke_dokumentert", "2024-01-01")] : [bVedtak({ kategori: "motor", saksnummer: "22/1000", dager_etter_levering: 300 })]),
      IDAG,
    );
    expect(r.feil[0]).toMatchObject({ kandidater: [], styrke: "middels", styrke_grunn: "ingen_vedtak" });
    expect(r.feil[0].tapte).toEqual({
      fordeling: { paregnelig_slitasje: 2, ikke_dokumentert: 1 },
      nyeste: [
        { saksnummer: "22/3", vedtaksdato: "2026-01-01", kilde_url: "https://example.org/1.pdf", grunn: "paregnelig_slitasje" },
        { saksnummer: "22/2", vedtaksdato: "2025-01-01", kilde_url: "https://example.org/1.pdf", grunn: "paregnelig_slitasje" },
      ],
    });
    expect(r.valgt_til_brev).toEqual([]);
  });

  it("feil uten spor er svak og hentes ikke", async () => {
    const s = skjema((s) => (s.del3_feil = [feil({ kategori: "motor", selger_sa_noe: "ja_muntlig", hvor_sto_det: [], avskrift_selger: null, verksted_sett_pa: "ja_muntlig" })]));
    let hentet = false;
    const r = await sammenlign(s, async () => ((hentet = true), [vedtakFeil({ kategori: "motor" })]), IDAG);
    expect(r.feil[0]).toMatchObject({ ingen_spor_arsak: "muntlig_opplysning", styrke: "svak", styrke_grunn: "ingen_spor", kandidater: [], tapte: null });
    expect(hentet).toBe(false);
  });

  it("feil med vedtak er sterk, også når en lignende sak er tapt", async () => {
    const r = await sammenlign(enyaq, async (q) => (q.spor === "A" ? [vedtakFeil({ kategori: "klimaanlegg", grunn: q.tapte ? "annet" : null })] : []), IDAG);
    expect(r.feil[0]).toMatchObject({ styrke: "sterk", styrke_grunn: null, kandidater: [{ vedtak_id: 1 }] });
  });

  it("reklamasjon mer enn to måneder etter oppdagelsen gir høyst middels (fkjl. § 27)", async () => {
    const s = skjema((s) => (s.del6_kontakt_med_selger.dato_forste_gang = "2026-03-01"));
    const r = await sammenlign(s, async (q) => (q.spor === "A" && !q.tapte ? [vedtakFeil({ kategori: q.kategori })] : []), IDAG);
    expect(r.feil[0]).toMatchObject({ reklamasjon_over_to_mnd: true, styrke: "middels", styrke_grunn: "reklamert_sent" });
    expect(r.feil[0].kandidater).toHaveLength(1);
    // Not taken up yet: the letter is the complaint, so the time runs to today.
    const ikke = skjema((s) => Object.assign(s.del6_kontakt_med_selger, { tatt_opp_med_selger: "nei", dato_forste_gang: null, selgers_svar: null }));
    expect((await sammenlign(ikke, async () => [], IDAG)).feil.map((f) => f.reklamasjon_over_to_mnd)).toEqual([true, true, true]);
    const nylig = skjema((s) => (Object.assign(s.del6_kontakt_med_selger, { tatt_opp_med_selger: "nei", dato_forste_gang: null, selgers_svar: null }), (s.del3_feil = [{ ...s.del3_feil[0], dato_oppdaget: "2026-09-20" }])));
    expect((await sammenlign(nylig, async () => [], IDAG)).feil[0].reklamasjon_over_to_mnd).toBe(false);
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
  const RAPPORT_LEVERING_C = { ...bevis("rotarsak"), ved_levering: "ja", paregnelig: "utover" } as VedtakFeil["bevis"][number];

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
  });

  it("bare samme kategori, ett kall per spor, primærsporet først", async () => {
    const s = skjema((s) => (s.del3_feil = [enyaq.del3_feil[0]]));
    const spurt: Array<[string, string]> = [];
    const hent: HentKandidater = async (q) => {
      if (q.tapte) return [];
      spurt.push([q.spor, q.kategori]);
      if (q.spor === "A") return [vedtakFeil({ vedtak_id: 8, kategori: q.kategori, vedtaksdato: "2021-01-01" })];
      if (q.spor === "C") return [vedtakFeil({ vedtak_id: 7, spor: "C", spor_vunnet: ["C"], kategori: q.kategori, bevis: [RAPPORT_LEVERING_C], dager_etter_levering: 300 })];
      return [];
    };
    const r = await sammenlign(s, hent, IDAG);
    expect(spurt).toEqual([
      ["A", "klimaanlegg"],
      ["C", "klimaanlegg"],
      ["B", "klimaanlegg"],
    ]);
    // A comes before C, even though the C decision is newer.
    expect(r.feil[0].kandidater.map((k) => [k.vedtak_id, k.spor])).toEqual([
      [8, "A"],
      [7, "C"],
    ]);
  });

  it("et vedtak på to spor teller én gang, og høyst fem kandidater", async () => {
    const s = skjema((s) => (s.del3_feil = [enyaq.del3_feil[0]]));
    const mange = (spor: "A" | "C") =>
      Array.from({ length: 4 }, (_, i) =>
        vedtakFeil({ vedtak_id: i + 1, spor, spor_vunnet: ["A", "C"], kategori: "klimaanlegg", bevis: [RAPPORT_LEVERING_C], dager_etter_levering: 300, vedtaksdato: `2025-0${i + 1}-01` }),
      );
    const r = await sammenlign(s, async (q) => (q.tapte || q.spor === "B" ? [] : q.spor === "A" ? mange("A") : [...mange("C"), vedtakFeil({ vedtak_id: 9, spor: "C", spor_vunnet: ["C"], kategori: "klimaanlegg", bevis: [RAPPORT_LEVERING_C], dager_etter_levering: 300 })]), IDAG);
    const ider = r.feil[0].kandidater.map((k) => k.vedtak_id);
    expect(new Set(ider).size).toBe(ider.length);
    expect(ider).toHaveLength(MAKS_KANDIDATER);
    expect(ider).toContain(9);
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
    expect(r.feil[0].kandidater[0]?.vedtak_id).toBe(7);
    expect(r.feil[1]).toMatchObject({ kandidater: [], styrke: null, styrke_grunn: null, tapte: null });
    expect(r.valgt_til_brev).not.toContain("F2");
    // The settled defect is not matched at all.
    expect(spurt).not.toContain("interior_lukt");
    expect((await sammenlign(s, hent, IDAG)).feil[1].kandidater).toEqual([]);
  });

});

describe("kostnad over kjøpesummen (skjema 1.2)", () => {
  it("andelen sammenlignes bare når brukeren har bekreftet beløpet", () => {
    const s = skjema((s) => Object.assign(s.del1_kjopet, { kjopsdato: "2024-06-04", pris_kr: 52_000 }));
    const f = (bekreftet: boolean) =>
      feil({ kategori: "rust", en_setning: "rust", dato_oppdaget: "2025-01-10", selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kostnad_kr: 100_000, kostnad_over_pris_bekreftet: bekreftet });
    const v = vedtakFeil({ spor: "C", kategori: "rust", spor_vunnet: ["C"], utbedringskostnad_nok: 15_000 });
    expect(vurder(s, f(false), v).kriterier.find((k) => k.navn === "kostnad_pris")?.utfall).toBe("utelat");
    expect(vurder(s, f(true), v).kriterier.find((k) => k.navn === "kostnad_pris")?.utfall).toBe("sterkere");
  });
});

describe("dager fra en bevisdato er «påvist senest» (21/5099)", () => {
  const f = (dato: string) => feil({ selger_sa_noe: "nei", hvor_sto_det: [], avskrift_selger: null, kategori: "elektrisk", dato_oppdaget: dato });
  const v = vedtakFeil({ spor: "B", kategori: "elektrisk", spor_vunnet: ["B"], dager_etter_levering: 182, viste_seg_kilde: "bevisdato" });
  const tid = (dato: string) => vurder(enyaq, f(dato), v).kriterier.find((k) => k.navn === "tid_til_feil")?.utfall;

  it("tidligere enn grensen er ikke vist å være tidligere; senere er vist å være senere", () => {
    expect(tid("2025-07-12")).toBe("lik"); // 120 days against «senest 182»
    expect(tid("2025-12-12")).toBe("svakere"); // 273 days
    expect(vurder(enyaq, f("2025-07-12"), { ...v, viste_seg_kilde: "vedtak" }).kriterier.find((k) => k.navn === "tid_til_feil")?.utfall).toBe("sterkere");
  });
});
