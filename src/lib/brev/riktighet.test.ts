import { describe, expect, it } from "vitest";
import { fritekstMerknad, type Riktighetssak, vurderRiktighet } from "./riktighet";

type Feil = Riktighetssak["feil"][number];
const feil = (f: Partial<Feil> = {}): Feil => ({ hoved: "motor", under: ["turbo"], opplysning: "nei", verksted: "nei", rapport: null, beskrivelse: null, konklusjon: null, ...f });
const RAPPORT = { navn: "Verksted AS", dato: "2025-05-01", punkter: ["bekrefter" as const], overslag: null };

// A case no rule touches: one technical defect, a reasonable price, a car dealer as seller.
const SAK: Riktighetssak = {
  kjopsdato: "2025-03-10",
  kjopesum: 150_000,
  forsteRegistrert: 2016,
  somDenEr: "nei",
  krav: "retting",
  forsok: 0,
  svar: null,
  feil: [feil()],
  utlegg: [],
  selger: { orgnr: "999999999", status: null, naeringskode: "45.111" },
};
const sak = (s: Partial<Riktighetssak>): Riktighetssak => ({ ...SAK, ...s });
const regler = (s: Riktighetssak) => {
  const r = vurderRiktighet(s);
  return { stopp: r.stopp.map((m) => m.regel), advarsler: r.advarsler.map((m) => m.regel) };
};

describe("en sak i orden", () => {
  it("gir ingen stopp og ingen advarsler", () => expect(regler(SAK)).toEqual({ stopp: [], advarsler: [] }));
});

describe("regler som stopper", () => {
  const TILFELLER: [string, Partial<Riktighetssak>, string][] = [
    ["garanti uten at selger sa noe", { feil: [feil({ hoved: "garanti", under: [], opplysning: "nei" })] }, "garanti_uten_lofte"],
    ["bare «vet ikke» og prisavslag", { krav: "prisavslag", feil: [feil({ hoved: "vet_ikke", under: ["lyd"] })] }, "vet_ikke_krav"],
    ["bare «vet ikke» og heving", { krav: "heving", feil: [feil({ hoved: "vet_ikke", under: ["lyd"] })] }, "vet_ikke_krav"],
    ["samme underkategori to ganger", { feil: [feil(), feil()] }, "samme_feil_to_ganger"],
    ["kjøpesum under 5 000 kr", { kjopesum: 4_999 }, "kjopesum_utenfor"],
    ["kjøpesum over 3 000 000 kr", { kjopesum: 3_000_001 }, "kjopesum_utenfor"],
    ["første registrering etter kjøpsåret", { forsteRegistrert: 2026 }, "registrert_etter_kjop"],
    ["ugyldig organisasjonsnummer", { selger: { orgnr: "999999998", status: null, naeringskode: "45.111" } }, "orgnr_ugyldig"],
    ["lenke i beskrivelsen", { feil: [feil({ beskrivelse: "Se www.bilforum.no for detaljer" })] }, "fritekst_lenke"],
    ["lenke i konklusjonen", { feil: [feil({ konklusjon: "Rapport: https://verksted.no/rapport/12" })] }, "fritekst_lenke"],
    ["beskrivelse med bare tall", { feil: [feil({ beskrivelse: "12345 !!" })] }, "fritekst_bare_tegn"],
  ];
  for (const [navn, endring, regel] of TILFELLER) it(navn, () => expect(regler(sak(endring)).stopp).toContain(regel));

  it("stopper ikke på grensene: 5 000 kr, 3 000 000 kr, registrert i kjøpsåret, garanti lovet muntlig, «vet ikke» med retting", () => {
    for (const s of [
      sak({ kjopesum: 5_000 }),
      sak({ kjopesum: 3_000_000 }),
      sak({ forsteRegistrert: 2025 }),
      sak({ feil: [feil({ hoved: "garanti", under: [], opplysning: "muntlig" })] }),
      sak({ feil: [feil({ hoved: "vet_ikke", under: ["lyd"] })] }),
    ])
      expect(regler(s).stopp).toEqual([]);
  });

  it("godtar vanlig tekst med tall og forkortelser", () => {
    for (const t of ["Bilen mistet kraft etter 3 uker.", "Ca. 38 000 kr, jf. fkjl.", "EU-kontroll underkjent 12.05."]) expect(fritekstMerknad(t, "beskrivelse", "motor")).toBeNull();
  });
});

describe("regler som advarer", () => {
  const TILFELLER: [string, Partial<Riktighetssak>, string][] = [
    ["kjent feil og «vet ikke» med prisavslag", { krav: "prisavslag", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 20_000 } }), feil({ hoved: "vet_ikke", under: ["lyd"] })] }, "vet_ikke_blandet"],
    ["kjent feil og «vet ikke» med heving", { krav: "heving", svar: "avviste", feil: [feil(), feil({ hoved: "vet_ikke", under: ["lyd"] })] }, "vet_ikke_blandet"],
    ["prisavslag uten overslag", { krav: "prisavslag" }, "prisavslag_uten_overslag"],
    ["heving uten rettingsforsøk og uten avslag", { krav: "heving" }, "heving_uten_retting"],
    ["heving og en liten utbedring", { krav: "heving", svar: "avviste", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 14_999 } })] }, "heving_liten_utbedring"],
    ["fraråder bruk og prisavslag", { krav: "prisavslag", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["frarader", "overslag"], overslag: 40_000 } })] }, "frarader_prisavslag"],
    ["«som den er» fra 2024 og selger sa noe om en teknisk feil", { somDenEr: "ja", feil: [feil({ opplysning: "muntlig" })] }, "som_den_er_opplyst"],
    ["utlegg over kjøpesummen", { utlegg: [{ belop: 100_000 }, { belop: 60_000 }] }, "utlegg_over_kjopesum"],
    ["lav kjøpesum og heving", { krav: "heving", svar: "avviste", kjopesum: 19_999 }, "lav_kjopesum_heving"],
    ["selger under konkurs", { selger: { orgnr: "999999999", status: "konkurs", naeringskode: "45.111" } }, "selger_konkurs"],
    ["selger under avvikling", { selger: { orgnr: "999999999", status: "avvikling", naeringskode: "45.111" } }, "selger_konkurs"],
    ["selger er ikke bilforhandler", { selger: { orgnr: "999999999", status: null, naeringskode: "68.209" } }, "selger_ikke_bilforhandler"],
  ];
  for (const [navn, endring, regel] of TILFELLER) it(navn, () => expect(regler(sak(endring)).advarsler).toContain(regel));

  it("advarer ikke når vilkåret ikke er oppfylt", () => {
    // «Som den er» before 2024 is the old § 17; heving after a refusal; a large repair; several defects.
    expect(regler(sak({ kjopsdato: "2023-05-02", forsteRegistrert: 2016, somDenEr: "ja", feil: [feil({ opplysning: "muntlig" })] })).advarsler).not.toContain("som_den_er_opplyst");
    expect(regler(sak({ krav: "heving", svar: "ikke_svart" })).advarsler).not.toContain("heving_uten_retting");
    expect(regler(sak({ krav: "heving", forsok: 1, svar: "annet" })).advarsler).not.toContain("heving_uten_retting");
    expect(regler(sak({ krav: "heving", svar: "avviste", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 15_000 } })] })).advarsler).not.toContain("heving_liten_utbedring");
    expect(
      regler(sak({ krav: "heving", svar: "avviste", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 1_000 } }), feil({ hoved: "elektrisk", under: ["lys"] })] })).advarsler,
    ).not.toContain("heving_liten_utbedring");
    expect(regler(sak({ krav: "retting", feil: [feil(), feil({ hoved: "vet_ikke", under: ["lyd"] })] })).advarsler).not.toContain("vet_ikke_blandet");
    expect(regler(sak({ utlegg: [{ belop: 150_000 }] })).advarsler).not.toContain("utlegg_over_kjopesum");
    expect(regler(sak({ selger: { orgnr: "999999999", status: null, naeringskode: null } })).advarsler).toEqual([]);
  });

  it("sier hvilket krav den kjente feilen får ved «vet ikke» og prisavslag", () => {
    const r = vurderRiktighet(sak({ krav: "prisavslag", feil: [feil(), feil({ hoved: "vet_ikke", under: ["lyd"] })] }));
    expect(r.advarsler.find((m) => m.regel === "vet_ikke_blandet")?.melding).toBe("Du har valgt både en kjent feil og «vet ikke». Brevet krever retting av den ukjente og prisavslag for den kjente.");
  });
});
