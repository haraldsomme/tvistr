import { describe, expect, it } from "vitest";
import enyaq from "@/lib/sammenligning/testdata/enyaq-skjema.json";
import testsaker from "@/lib/sammenligning/testdata/testsaker.json";
import { RAPPORT_TOM, type Skjema, stubb, validerSkjema } from "./skjema";

const IDAG = "2026-10-09";
const endret = (endre: (s: Skjema) => void) => {
  const s = structuredClone(enyaq) as unknown as Skjema;
  endre(s);
  return s;
};
const felt = (s: unknown) => validerSkjema(s, IDAG).map((f) => f.felt);

describe("validerSkjema (docs/skjema.md)", () => {
  it("Enyaq-saken og alle ti testsakene passerer", () => {
    expect(validerSkjema(enyaq, IDAG)).toEqual([]);
    for (const s of testsaker.saker) expect([s.id, validerSkjema(s.input, IDAG)]).toEqual([s.id, []]);
  });

  it("privatkjøp sjekkes bare til og med del 1", () => {
    expect(felt(endret((s) => ((s.del1_kjopet.selgertype = "privat"), (s.del2_selger.firmanavn_oppgitt = null))))).toEqual([]);
  });

  it("alle felt må være med, og ingen andre", () => {
    expect(felt(endret((s) => delete (s.del1_kjopet as Partial<Skjema["del1_kjopet"]>).merke_modell_valgfritt))).toContain("del1_kjopet.merke_modell_valgfritt");
    expect(felt(endret((s) => Object.assign(s.del3_feil[0], { melding_svar_pa_sporsmal: "ja" })))).toEqual(["del3_feil[0].melding_svar_pa_sporsmal"]);
    expect(felt(endret((s) => (s._meta.skjema_versjon = "0.4")))).toEqual(["_meta.skjema_versjon"]);
  });

  it("datoer og tall på tvers av felt", () => {
    expect(felt(endret((s) => (s.del3_feil[1].dato_oppdaget = "2025-03-01")))).toContain("del3_feil[1].dato_oppdaget");
    expect(felt(endret((s) => (s.del6_kontakt_med_selger.dato_forste_gang = "2025-10-01")))).toContain("del6_kontakt_med_selger.dato_forste_gang");
    expect(felt(endret((s) => (s.km_na = 40_000)))).toContain("km_na");
    expect(felt(endret((s) => (s.del1_kjopet.aarsmodell = 2026)))).toContain("del1_kjopet.aarsmodell");
  });

  it("betingede felt følger svaret de hører til", () => {
    // Written statement without where or what.
    expect(felt(endret((s) => (s.del3_feil[1].hvor_sto_det = [])))).toContain("del3_feil[1].hvor_sto_det");
    // Direct question only for messages.
    expect(felt(endret((s) => (s.del3_feil[1].svar_pa_direkte_sporsmal = true)))).toContain("del3_feil[1].svar_pa_direkte_sporsmal");
    // No written report: the report answers are «står ikke» and the texts are empty.
    expect(
      felt(endret((s) => Object.assign(s.del3_feil[0], { verksted_sett_pa: "nei", rapport_sier: RAPPORT_TOM, kostnad_kr: null, avskrift_verksted: null, verksted_navn_dato: null }))),
    ).toEqual([]);
    expect(felt(endret((s) => (s.del3_feil[0].verksted_sett_pa = "nei")))).toEqual(
      expect.arrayContaining(["del3_feil[0].rapport_sier.hva", "del3_feil[0].rapport_sier.hvorfor", "del3_feil[0].avskrift_verksted"]),
    );
    // An agreement only follows a partial offer or an agreement.
    expect(felt(endret((s) => (s.del6_kontakt_med_selger.avtale_inngatt = "ja")))).toContain("del6_kontakt_med_selger.avtale_inngatt");
  });

  it("avtalen sier hvilke feil den gjelder", () => {
    const avtale = (gjelder: string[]) =>
      endret((s) => Object.assign(s.del6_kontakt_med_selger, { selgers_svar: "enige_om_noe", avtale_inngatt: "ja", avtale_beskrivelse: "selger betaler dekkene", avtale_gjelder_feil: gjelder }));
    expect(felt(avtale(["F2"]))).toEqual([]);
    expect(felt(avtale([]))).toEqual(["del6_kontakt_med_selger.avtale_gjelder_feil"]);
    expect(felt(avtale(["F4"]))).toEqual(["del6_kontakt_med_selger.avtale_gjelder_feil"]);
    expect(felt(avtale(["F1", "F1"]))).toEqual(["del6_kontakt_med_selger.avtale_gjelder_feil"]);
    // No agreement: the list is empty.
    expect(felt(endret((s) => (s.del6_kontakt_med_selger.avtale_gjelder_feil = ["F1"])))).toEqual(["del6_kontakt_med_selger.avtale_gjelder_feil"]);
  });

  it("én setning i «Feilen er at …»", () => {
    expect(felt(endret((s) => (s.del3_feil[0].en_setning = "varmepumpen virker ikke. Rekkevidden faller")))).toContain("del3_feil[0].en_setning");
  });
});

describe("stubb", () => {
  it("lagrer svaret som fullføring av setningen", () => {
    expect(stubb("Varmepumpen gir ikke varme.", "Feilen er at")).toBe("varmepumpen gir ikke varme");
    expect(stubb("Feilen er at bremsene skurrer ", "Feilen er at")).toBe("bremsene skurrer");
    expect(stubb("AC-anlegget lekker", "Feilen er at")).toBe("AC-anlegget lekker");
    expect(stubb("EU-kontrollen ble ikke godkjent.", "Feilen er at")).toBe("EU-kontrollen ble ikke godkjent");
  });
});
