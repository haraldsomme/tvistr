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
    for (const t of ["Bilen mistet kraft etter 3 uker.", "Ca. 38 000 kr, jf. fkjl.", "EU-kontroll underkjent 12.05.", "Lyd fra turbo, f.eks. ved 80 km/t.", "Sa det var i orden.De visste det."])
      expect(fritekstMerknad(t, "beskrivelse", "motor")).toBeNull();
    // Shortened links, other countries, a path, capitals, an invisible character and a full-width dot.
    for (const t of ["se bit.ly/3abcd", "rapporten ligger på example.de/rapport", "se verksted.bilxyz/rapport", "se FINN.NO", "WWW.FINN.NO", "se vg\u200b.no", "se finn．no"])
      expect(fritekstMerknad(t, "beskrivelse", "motor")?.regel).toBe("fritekst_lenke");
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
    ["selger sa noe om en teknisk feil, med «som den er» fra 2024", { somDenEr: "ja", feil: [feil({ opplysning: "muntlig" })] }, "som_den_er_opplyst"],
    ["utlegg over kjøpesummen", { utlegg: [{ belop: 100_000 }, { belop: 60_000 }] }, "utlegg_over_kjopesum"],
    ["lav kjøpesum og heving", { krav: "heving", svar: "avviste", kjopesum: 19_999 }, "lav_kjopesum_heving"],
    ["selger under konkurs", { selger: { orgnr: "999999999", status: "konkurs", naeringskode: "45.111" } }, "selger_konkurs"],
    ["selger under avvikling", { selger: { orgnr: "999999999", status: "avvikling", naeringskode: "45.111" } }, "selger_konkurs"],
    ["selger er ikke bilforhandler", { selger: { orgnr: "999999999", status: null, naeringskode: "68.209" } }, "selger_ikke_bilforhandler"],
    ["selger er verksted (SN2025)", { selger: { orgnr: "999999999", status: null, naeringskode: "95.310" } }, "selger_ikke_bilforhandler"],
  ];
  for (const [navn, endring, regel] of TILFELLER) it(navn, () => expect(regler(sak(endring)).advarsler).toContain(regel));

  it("advarer ikke når vilkåret ikke er oppfylt", () => {
    // Nothing said before the purchase; heving after a refusal; a large repair; several defects.
    expect(regler(sak({ feil: [feil({ opplysning: "nei" })] })).advarsler).not.toContain("som_den_er_opplyst");
    expect(regler(sak({ krav: "heving", svar: "ikke_svart" })).advarsler).not.toContain("heving_uten_retting");
    expect(regler(sak({ krav: "heving", forsok: 1, svar: "forsokt" })).advarsler).not.toContain("heving_uten_retting");
    expect(regler(sak({ krav: "heving", svar: "avviste", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 15_000 } })] })).advarsler).not.toContain("heving_liten_utbedring");
    expect(
      regler(sak({ krav: "heving", svar: "avviste", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 1_000 } }), feil({ hoved: "elektrisk", under: ["lys"] })] })).advarsler,
    ).not.toContain("heving_liten_utbedring");
    expect(regler(sak({ krav: "retting", feil: [feil(), feil({ hoved: "vet_ikke", under: ["lyd"] })] })).advarsler).not.toContain("vet_ikke_blandet");
    expect(regler(sak({ utlegg: [{ belop: 150_000 }] })).advarsler).not.toContain("utlegg_over_kjopesum");
    expect(regler(sak({ selger: { orgnr: "999999999", status: null, naeringskode: null } })).advarsler).toEqual([]);
    // Brreg's codes from 2025 (SN2025): cars retail and wholesale, and motorcycles.
    for (const naeringskode of ["47.810", "46.710", "47.830", "45.400"]) expect(regler(sak({ selger: { orgnr: "999999999", status: null, naeringskode } })).advarsler).toEqual([]);
  });

  it("sier hvilket krav den kjente feilen får ved «vet ikke» og prisavslag", () => {
    const r = vurderRiktighet(sak({ krav: "prisavslag", feil: [feil(), feil({ hoved: "vet_ikke", under: ["lyd"] })] }));
    expect(r.advarsler.find((m) => m.regel === "vet_ikke_blandet")?.melding).toBe("Du har valgt både en kjent feil og «vet ikke». Brevet krever retting av den ukjente og prisavslag for den kjente.");
  });
});

describe("opplysning om feilen før kjøpet", () => {
  // What the buyer knew at the purchase cannot be relied on: before 2024, after 2024, with or without a reservation.
  for (const [navn, kjopsdato, somDenEr] of [
    ["før 2024 med «som den er»", "2023-05-02", "ja"],
    ["før 2024 uten «som den er»", "2023-05-02", "nei"],
    ["fra 2024 uten «som den er»", "2025-03-10", "nei"],
  ] as const)
    it(`advarer ${navn}`, () => expect(regler(sak({ kjopsdato, somDenEr, feil: [feil({ opplysning: "muntlig" })] })).advarsler).toContain("som_den_er_opplyst"));
});

describe("teksten i meldingene", () => {
  const alle = () => {
    const r = [
      vurderRiktighet(sak({ krav: "heving", svar: "avviste", feil: [feil({ opplysning: "muntlig", verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 1_000 } })], selger: { orgnr: "999999999", status: "konkurs", naeringskode: "68.209" } })),
    ];
    return r.flatMap((x) => [...x.stopp, ...x.advarsler]).map((m) => m.melding);
  };
  it("sier at brukeren kan lage brevet, ikke at det sendes", () => {
    expect(alle().length).toBeGreaterThan(3);
    for (const m of alle()) expect(m).not.toMatch(/\bsendes\b|\bsender\b/i);
    const konkurs = vurderRiktighet(sak({ selger: { orgnr: "999999999", status: "konkurs", naeringskode: "45.111" } })).advarsler[0].melding;
    expect(konkurs).toBe("Foretaket er registrert som konkurs. Du kan likevel lage brevet, men kravet kan være vanskelig å inndrive.");
  });
  it("forklarer heving ved liten utbedring som lovens vilkår, ikke som utvalgets vane", () => {
    const m = vurderRiktighet(sak({ krav: "heving", svar: "avviste", feil: [feil({ verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["overslag"], overslag: 1_000 } })] })).advarsler.find((x) => x.regel === "heving_liten_utbedring")?.melding;
    expect(m).toBe("Heving krever at mangelen ikke er uvesentlig. Når utbedringen koster lite i forhold til kjøpesummen, blir heving sjelden godtatt. Vurder prisavslag.");
  });
  it("sier hva opplysningen før kjøpet betyr", () => {
    const m = vurderRiktighet(sak({ feil: [feil({ opplysning: "muntlig" })] })).advarsler.find((x) => x.regel === "som_den_er_opplyst")?.melding;
    expect(m).toBe("Hvis selger opplyste om akkurat denne feilen før kjøpet, kan du som regel ikke reklamere på den. Sjekk hva som ble sagt, og om det gjaldt denne feilen eller noe annet.");
  });
});
