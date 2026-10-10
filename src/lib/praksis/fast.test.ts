import { describe, expect, it } from "vitest";
import skjemaJson from "@/lib/sammenligning/testdata/enyaq-skjema.json";
import { avledFeil, avledSak } from "@/lib/sammenligning/avled";
import type { Skjema, SkjemaFeil, VedtakFeil } from "@/lib/sammenligning/typer";
import { eksemplerTekst, fastBlokk, PRAKSIS_FAST } from "./fast";
import { skrivPraksisdel } from "./praksisdel";

const IDAG = "2026-10-09";
const enyaq = skjemaJson as unknown as Skjema;

// A battery defect on C: full report, no seller statement.
const C_RAPPORT = { hva: "ja", hvorfor: "ja", var_der_ved_overtakelse: "ja", mer_enn_normal_slitasje: "ja", kostnad: "ja" } as const;
const batteri = (o: Partial<SkjemaFeil> = {}): SkjemaFeil => ({
  ...enyaq.del3_feil[0],
  id: "F1",
  kategori: "batteri_elbil",
  selger_sa_noe: "nei",
  hvor_sto_det: [],
  avskrift_selger: null,
  svar_pa_direkte_sporsmal: false,
  rapport_sier: C_RAPPORT,
  kostnad_kr: 88_000,
  avskrift_verksted: "«Cellemodul 3 har for lav spenning. Feilen er mer enn normal slitasje og var sannsynligvis til stede ved overtakelsen.»",
  ...o,
});
const skjema = (feil: SkjemaFeil[], endre?: (s: Skjema) => void): Skjema => {
  const s = structuredClone(enyaq);
  s.del3_feil = feil;
  endre?.(s);
  return s;
};

describe("fastBlokk", () => {
  it("C uten vedtak: blokken med kjøperens fakta i slotene", () => {
    const s = skjema([batteri()]);
    const sak = avledSak(s, IDAG);
    const f = avledFeil(sak, s.del3_feil[0]);
    expect(f.spor_primar).toBe("C");
    expect(fastBlokk(sak, f, true)?.tekst).toBe(
      "Forbrukerklageutvalget legger i saker om høyvoltbatteriet avgjørende vekt på om en sakkyndig vurdering viser at feilen går ut over det som er påregnelig for bilens alder og kjørelengde, og om feilen kan føres tilbake til leveringstidspunktet, se for eksempel sak FKU-2026-104368 (2026) og sak FKU-2025-58214 (2025). " +
        "I min sak har verkstedet konkludert slik: «Cellemodul 3 har for lav spenning. Feilen er mer enn normal slitasje og var sannsynligvis til stede ved overtakelsen». " +
        "Bilen var 4 år gammel med 41 200 km da jeg kjøpte den for 478 000 kr, og utbedringen er beregnet til 88 000 kr. Vurderingen oppfyller de kravene utvalget stiller.",
    );
  });

  it("ikke godkjent: ingen blokk i produksjon", () => {
    const s = skjema([batteri()]);
    const sak = avledSak(s, IDAG);
    expect(PRAKSIS_FAST.C.godkjent_av).toBeNull();
    expect(fastBlokk(sak, avledFeil(sak, s.del3_feil[0]))).toBeNull();
  });

  it("en slot uten verdi gir ingen blokk og ingen feil", () => {
    const s = skjema([batteri({ avskrift_verksted: null })]);
    const sak = avledSak(s, IDAG);
    expect(fastBlokk(sak, avledFeil(sak, s.del3_feil[0]), true)).toBeNull();
  });

  it("uten spor: ingen blokk", () => {
    const s = skjema([batteri({ verksted_sett_pa: "ja_muntlig" })]);
    const sak = avledSak(s, IDAG);
    expect(fastBlokk(sak, avledFeil(sak, s.del3_feil[0]), true)).toBeNull();
  });

  it("B sier at selger ikke har lagt frem noe, så ingen B-blokk når selger har det", () => {
    const b = batteri({ kategori: "elektrisk", rapport_sier: { ...C_RAPPORT, mer_enn_normal_slitasje: "star_ikke" } });
    const s = skjema([b], (x) => Object.assign(x.del6_kontakt_med_selger, { selger_la_frem_dokumentasjon: "ja", selger_dokumentasjon_kort: "EU-kontroll" }));
    const sak = avledSak(s, IDAG);
    const f = avledFeil(sak, b);
    expect(f.spor_primar).toBe("B");
    expect(fastBlokk(sak, f, true)).toBeNull();
    const uten = skjema([b]);
    expect(fastBlokk(avledSak(uten, IDAG), avledFeil(avledSak(uten, IDAG), b), true)?.tekst).toContain(`viste seg ${f.dager_til_feil} dager etter leveringen`);
  });

  it("eksemplene i fast format", () => {
    expect(eksemplerTekst(PRAKSIS_FAST.C.eksempler)).toBe("sak FKU-2026-104368 (2026) og sak FKU-2025-58214 (2025)");
    expect(eksemplerTekst([...PRAKSIS_FAST.C.eksempler, PRAKSIS_FAST.B.eksempler[0]])).toBe("sak FKU-2026-104368 (2026), sak FKU-2025-58214 (2025) og sak FKU-2026-11234 (2026)");
  });
});

describe("skrivPraksisdel: spesifikk, så generell, så fast blokk", () => {
  const vedtakFeil = (o: Partial<VedtakFeil>): VedtakFeil =>
    ({ vedtak_id: 1, feil_id: "f1", spor: "C", saksnummer: "X", vedtaksdato: "2025-01-01", kilde_url: "u", utfall: "medhold", grunn: null, selger_type: "forhandler", kategori: "motor", komponenter: [], grunnlag: null, spor_vunnet: ["C"], a_variant: null, alvor: [], dager_etter_levering: 100, viste_seg_kilde: "vedtak", lovversjon: "før_2024", alder_ved_kjop: 4, km_ved_kjop: 50_000, kjopesum_nok: 400_000, utbedringskostnad_nok: null, tilkjent_totalt_nok: null, belop_tilkjent_nok: null, sanksjon: "erstatning", selger_bevis_finnes: false, forbehold: [], forste_henvendelse_dato: null, start_dato: null, antall_feil: 1, opplysninger: [], bevis: [], ...o }) as VedtakFeil;
  const deps = (o: { kall?: Parameters<typeof skrivPraksisdel>[2]["kall"] } = {}) => ({
    hentKandidater: async () => [],
    hentFulltekst: async (ider: number[]) => new Map(ider.map((id) => [id, "Utvalget ser slik på saken\nUtvalget finner at feilen går ut over det påregnelige for bilens alder og kjørelengde."])),
    hentEksempler: async (e: Array<{ vedtak_id: number; feil_id: string }>) => e.map((x) => vedtakFeil({ vedtak_id: x.vedtak_id, feil_id: x.feil_id })),
    utkast: true,
    ...o,
  });
  const nullSvar = async () => ({ input: { valgt_vedtak_id: null, eksempel_vedtak_ids: [], grunn_ingen: "ingen", begrunnelse: "", sitat: null, setninger: [] }, modell: "test", forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 } });

  it("uten vedtak og når generell modus ikke kan belegges: den faste blokken, én gang, på feilen som koster mest", async () => {
    const s = skjema([batteri({ id: "F1", kostnad_kr: 20_000 }), batteri({ id: "F2", kategori: "motor", kostnad_kr: 90_000 })]);
    const d = await skrivPraksisdel(s, IDAG, deps({ kall: nullSvar }));
    expect(d.avsnitt.map((a) => [a.feil_id, a.modus])).toEqual([["F2", "fast"]]);
    expect(d.avsnitt[0].avsnitt).toContain("i saker om motoren");
    expect(d.forsok.map((f) => [f.feil_id, f.modus])).toEqual([["F2", "generell"]]);
    // The purchase is after 2024 and the examples are not.
    expect(d.lovendring).toMatch(/^Begge vedtakene gjelder kjøp før forbrukerkjøpsloven ble endret/);
  });

  it("uten godkjent blokk og uten utkast: ingen avsnitt og ingen kall", async () => {
    let kalt = false;
    const d = await skrivPraksisdel(skjema([batteri()]), IDAG, { ...deps(), utkast: false, kall: async () => ((kalt = true), nullSvar()) });
    expect(d.avsnitt).toEqual([]);
    expect(kalt).toBe(false);
  });

  it("feil uten spor får verken generell modus eller fast blokk", async () => {
    let kalt = false;
    const d = await skrivPraksisdel(skjema([batteri({ verksted_sett_pa: "ja_muntlig" })]), IDAG, deps({ kall: async () => ((kalt = true), nullSvar()) }));
    expect(d.avsnitt).toEqual([]);
    expect(kalt).toBe(false);
  });
});
