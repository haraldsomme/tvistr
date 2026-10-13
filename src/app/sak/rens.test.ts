import { describe, expect, it } from "vitest";
import { idagOslo, rensBrevsvar, rensVedtakssvar } from "./rens";

const idag = idagOslo();
const aarSiden = (n: number) => `${Number(idag.slice(0, 4)) - n}${idag.slice(4)}`;
// n months ago. The purchase is a year ago, the defects are discovered eight and seven months ago, and
// the report and the complaint come six months ago, after both.
const mndSiden = (n: number) => {
  const d = new Date(`${idag}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};
const halvtAar = () => mndSiden(6);

const RAPPORT = { hvem: "uavhengig", navn: "  Nordre Verksted AS ", dato: halvtAar(), punkter: ["arsak", "bekrefter", "finnes_ikke"], konklusjon: "  Turbo «defekt»,\nmå skiftes  ", overslag: 12_000 };
const SVAR = {
  valg: { elektrisk: ["lys"], motor: ["turbo", "finnes_ikke"] },
  detaljer: {
    motor: { oppdaget: mndSiden(7), beskrivelse: "  Mistet kraft  ", opplysning: "nei", verksted: "skriftlig", rapport: { ...RAPPORT, punkter: ["arsak", "bekrefter", "overslag"] } },
    elektrisk: { oppdaget: mndSiden(8), omtrentlig: true, opplysning: "muntlig", verksted: "nei" },
  },
  kjopsdato: aarSiden(1),
  km: 120_000,
  kjopesum: 150_000,
  ar: 2016,
  somDenEr: "ja",
  krav: "prisavslag",
  kontakt: { reklamert: false },
  bil: { regnr: "AB 12345", merke: "Volkswagen", modell: "Golf", ar: 2016 },
  selgerOrgnr: "999 999 999",
  utlegg: [],
};
const med = (endring: Record<string, unknown>) => ({ ...SVAR, ...endring });
const medMotor = (endring: Record<string, unknown>) => med({ detaljer: { ...SVAR.detaljer, motor: { ...SVAR.detaljer.motor, ...endring } } });
const medRapport = (endring: Record<string, unknown>) => medMotor({ rapport: { ...SVAR.detaljer.motor.rapport, ...endring } });

describe("rensVedtakssvar", () => {
  it("beholder kategoriene i kategoriorden for rangeringen og kjøperens rekkefølge for brevet", () => {
    const r = rensVedtakssvar(SVAR);
    if (!r.ok) throw new Error(r.melding);
    expect(r.svar.valgte.map((h) => h.id)).toEqual(["motor", "elektrisk"]);
    expect(r.svar.rekkefolge).toEqual(["elektrisk", "motor"]);
    expect(r.svar.rent.motor).toEqual(["turbo"]);
    expect(r.svar.detaljer.motor.beskrivelse).toBe("Mistet kraft");
  });

  it("avviser tom feilvalg, manglende oppdagelsesdato og kjøp eldre enn fem år", () => {
    expect(rensVedtakssvar({ ...SVAR, valg: {} })).toEqual({ ok: false, melding: "Velg minst én feil." });
    expect(rensVedtakssvar({ ...SVAR, detaljer: { ...SVAR.detaljer, motor: { ...SVAR.detaljer.motor, oppdaget: undefined } } })).toEqual({ ok: false, melding: "Velg når du oppdaget hver feil." });
    const r = rensVedtakssvar({ ...SVAR, kjopsdato: aarSiden(6) });
    expect(r.ok).toBe(false);
  });
});

describe("kontakt med selger", () => {
  const kontakt = (k: Record<string, unknown>) => {
    const r = rensVedtakssvar({ ...SVAR, kontakt: k });
    return r.ok ? { forsok: r.svar.forsok, kontakt: r.svar.kontakt } : r.melding;
  };

  it("gir ingen kontakt og null rettingsforsøk når kjøperen ikke har reklamert, hva nettleseren enn sender", () => {
    expect(kontakt({ reklamert: false })).toEqual({ forsok: 0, kontakt: null });
    expect(kontakt({ reklamert: false, forsok: 3, svar: "avviste", dato: halvtAar(), form: "skriftlig" })).toEqual({ forsok: 0, kontakt: null });
  });

  it("gir rettingsforsøket fra kontakten når kjøperen har reklamert", () => {
    expect(kontakt({ reklamert: true, dato: halvtAar(), form: "muntlig", forsok: 2, svar: "tilbod_retting" })).toEqual({ forsok: 2, kontakt: { dato: halvtAar(), form: "muntlig", forsok: 2, svar: "tilbod_retting" } });
  });

  it("er uten forsøk og kontakt når feltet ikke er sendt", () => {
    const r = rensVedtakssvar({ ...SVAR, kontakt: undefined });
    expect(r.ok && [r.svar.forsok, r.svar.kontakt]).toEqual([null, null]);
  });

  it("kan ikke gi rettingsforsøk uten reklamasjon", () => {
    // Everything that would make «reklamert: ja» valid is needed; anything less is turned away.
    const ok = { reklamert: true, dato: halvtAar(), form: "skriftlig", forsok: 1, svar: "annet" };
    for (const feil of [{ reklamert: undefined }, { dato: undefined }, { dato: "i går" }, { form: "epost" }, { forsok: 4 }, { forsok: null }, { svar: "kanskje" }, { svar: undefined }]) {
      expect(typeof kontakt({ ...ok, ...feil }), JSON.stringify(feil)).toBe("string");
    }
  });

  it("krever en dato etter kjøpsdatoen og ikke i fremtiden", () => {
    const k = (dato: string) => ({ reklamert: true, dato, form: "skriftlig", forsok: 0, svar: "annet" });
    expect(typeof kontakt(k(aarSiden(1)))).toBe("string");
    expect(typeof kontakt(k(aarSiden(2)))).toBe("string");
    expect(typeof kontakt(k("2999-01-01"))).toBe("string");
    expect(typeof kontakt(k(idag))).toBe("object");
  });
});

describe("rensBrevsvar", () => {
  it("renser et fullt svar", () => {
    const r = rensBrevsvar(SVAR);
    if (!r.ok) throw new Error(r.melding);
    expect(r.svar.feil.map((f) => f.hoved)).toEqual(["elektrisk", "motor"]);
    expect(r.svar.selgerOrgnr).toBe("999999999");
    expect(r.svar.somDenEr).toBe("ja");
    expect(r.svar.kontakt).toBeNull();
  });

  it("godtar «vet ikke» for «som den er»", () => {
    const r = rensBrevsvar(med({ somDenEr: "vet_ikke" }));
    expect(r.ok && r.svar.somDenEr).toBe("vet_ikke");
  });

  it("avviser manglende felt og gir en melding", () => {
    for (const endring of [{ kjopesum: 0 }, { km: null }, { krav: "noe" }, { kontakt: undefined }, { bil: {} }, { bil: { regnr: "!", merke: "A", modell: "B" } }, { selgerOrgnr: "123" }, { selgerOrgnr: undefined }, { kjopsdato: "i går" }]) {
      const r = rensBrevsvar(med(endring));
      expect(r.ok, JSON.stringify(endring)).toBe(false);
      if (!r.ok) expect(r.melding).toBeTruthy();
    }
  });

  it("krever svar på verksted og selgers opplysning for hver feil", () => {
    const r = rensBrevsvar(med({ detaljer: { motor: { oppdaget: mndSiden(7), verksted: "nei" }, elektrisk: { oppdaget: mndSiden(8), opplysning: "nei", verksted: "nei" } } }));
    expect(r.ok).toBe(false);
  });

  it("renser utlegg og avviser linjer uten beskrivelse eller beløp", () => {
    const ok = rensBrevsvar(med({ utlegg: [{ beskrivelse: " Tauing ", belop: 1200 }] }));
    expect(ok.ok && ok.svar.utlegg).toEqual([{ beskrivelse: "Tauing", belop: 1200 }]);
    for (const utlegg of [[{ beskrivelse: "", belop: 100 }], [{ beskrivelse: "Tauing", belop: 0 }], [{ beskrivelse: "Tauing", belop: "100" }]]) expect(rensBrevsvar(med({ utlegg })).ok).toBe(false);
  });

  it("tar med oppdagelsesdatoen og om den er omtrentlig", () => {
    const r = rensBrevsvar(SVAR);
    expect(r.ok && r.svar.feil.map((f) => [f.hoved, f.oppdaget, f.omtrentlig])).toEqual([
      ["elektrisk", mndSiden(8), true],
      ["motor", mndSiden(7), false],
    ]);
  });

  it("tåler søppel", () => {
    expect(rensBrevsvar({}).ok).toBe(false);
    expect(rensBrevsvar({ valg: "motor", detaljer: 5 }).ok).toBe(false);
  });
});

describe("verkstedrapport", () => {
  const rapport = (r: Record<string, unknown>) => {
    const x = rensBrevsvar(r);
    return x.ok ? x.svar.feil.find((f) => f.hoved === "motor")!.rapport : x.melding;
  };

  it("renser rapporten: navn trimmet, avkrysningene i fast rekkefølge, ukjente droppet", () => {
    const r = rapport(SVAR);
    expect(r).toMatchObject({ hvem: "uavhengig", navn: "Nordre Verksted AS", dato: halvtAar(), punkter: ["bekrefter", "arsak", "overslag"], overslag: 12_000 });
  });

  it("renser konklusjonen bare for trim, lengde og doble anførselstegn", () => {
    expect(rapport(SVAR)).toMatchObject({ konklusjon: "Turbo defekt, må skiftes" });
    expect(rapport(medRapport({ konklusjon: "x".repeat(400) }))).toMatchObject({ konklusjon: "x".repeat(300) });
    expect(rapport(medRapport({ konklusjon: "  " }))).toMatchObject({ konklusjon: null });
    // Single quotes and the rest stay as written.
    expect(rapport(medRapport({ konklusjon: "Girkassen er 'utslitt' (ca. 38 000 kr)" }))).toMatchObject({ konklusjon: "Girkassen er 'utslitt' (ca. 38 000 kr)" });
  });

  it("bruker kostnadsoverslaget bare med avkrysningen for det", () => {
    expect(rapport(medRapport({ punkter: ["bekrefter"], overslag: 12_000 }))).toMatchObject({ overslag: null });
    expect(rapport(medRapport({ punkter: ["overslag"], overslag: 12_000 }))).toMatchObject({ overslag: 12_000 });
    expect(rapport(medRapport({ punkter: ["overslag"], overslag: null }))).toMatchObject({ overslag: null });
    expect(rapport(medRapport({ punkter: ["overslag"], overslag: "12000" }))).toMatchObject({ overslag: null });
  });

  it("avviser en rapport som mangler noe, og gir en melding", () => {
    for (const endring of [{ hvem: "noen" }, { navn: " " }, { navn: undefined }, { dato: undefined }, { dato: "2999-01-01" }, { dato: aarSiden(1) }, { dato: aarSiden(3) }, { punkter: [] }, { punkter: ["finnes_ikke"] }]) {
      const r = rapport(medRapport(endring));
      expect(typeof r, JSON.stringify(endring)).toBe("string");
    }
    expect(rapport(medMotor({ rapport: undefined }))).toMatch(/rapporten/i);
  });

  it("kutter navnet ved 60 tegn", () => {
    expect(rapport(medRapport({ navn: "A".repeat(80) }))).toMatchObject({ navn: "A".repeat(60) });
  });

  it("legger ingen rapport til en feil som ikke er undersøkt skriftlig", () => {
    expect(rapport(medMotor({ verksted: "muntlig" }))).toBeNull();
    expect(rapport(medMotor({ verksted: "nei" }))).toBeNull();
  });
});

describe("tidslinjen på serveren", () => {
  // Every order the form makes impossible is turned away here too, with the same message.
  const motor = (endring: Record<string, unknown>) => ({ ...SVAR.detaljer.motor, ...endring });
  const TILFELLER: [string, Record<string, unknown>, RegExp][] = [
    ["kjøpsdato i fremtiden", { kjopsdato: "2999-01-01" }, /fremtiden/],
    ["kjøp mer enn fem år tilbake", { kjopsdato: aarSiden(6) }, /fem år/],
    ["feilen oppdaget før kjøpet", { detaljer: { ...SVAR.detaljer, motor: motor({ oppdaget: aarSiden(2) }) } }, /før du overtok bilen/],
    ["feilen oppdaget samme dag som kjøpet", { detaljer: { ...SVAR.detaljer, motor: motor({ oppdaget: aarSiden(1) }) } }, /før du overtok bilen/],
    ["feilen oppdaget i fremtiden", { detaljer: { ...SVAR.detaljer, motor: motor({ oppdaget: "2999-01-01" }) } }, /fremtiden/],
    ["en dag som ikke finnes", { detaljer: { ...SVAR.detaljer, motor: motor({ oppdaget: "2025-02-30" }) } }, /oppdaget hver feil/],
    ["rapport før feilen ble oppdaget", { detaljer: { ...SVAR.detaljer, motor: motor({ rapport: { ...SVAR.detaljer.motor.rapport, dato: mndSiden(9) } }) } }, /Rapporten kan ikke være datert før/],
    ["reklamert før den første feilen", { kontakt: { reklamert: true, dato: mndSiden(10), form: "skriftlig", forsok: 0, svar: "annet" } }, /før den første feilen/],
  ];
  for (const [navn, endring, melding] of TILFELLER)
    it(`avviser ${navn}`, () => {
      const r = rensBrevsvar({ ...SVAR, ...endring });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.melding).toMatch(melding);
      // The decision search turns it away too, before any ranking.
      expect(rensVedtakssvar({ ...SVAR, ...endring }).ok).toBe(false);
    });

  it("slipper gjennom en sak med advarsler, men ingen stopp", () => {
    const r = rensVedtakssvar({ ...SVAR, kontakt: { reklamert: true, dato: idag, form: "skriftlig", forsok: 0, svar: "annet" } });
    expect(r.ok && r.svar.tidslinje.stopp).toEqual([]);
    expect(r.ok && r.svar.tidslinje.advarsler.map((m) => m.regel)).toContain("reklamasjon_sen");
  });
});

describe("riktighet på serveren", () => {
  // Every stop in riktighet.ts is turned away here too, whatever the browser allowed.
  const D = SVAR.detaljer;
  const TILFELLER: [string, Record<string, unknown>, RegExp][] = [
    ["garanti uten at selger sa noe", { valg: { garanti: [] }, detaljer: { garanti: { oppdaget: mndSiden(7), opplysning: "nei", verksted: "nei" } } }, /garanti må være lovet/],
    ["bare «vet ikke» og prisavslag", { valg: { vet_ikke: ["lyd"] }, detaljer: { vet_ikke: { oppdaget: mndSiden(7), opplysning: "nei", verksted: "nei" } } }, /bare kreve at feilen undersøkes/],
    ["kjøpesum under 5 000 kr", { kjopesum: 4_999 }, /mellom 5 000 og 3 000 000/],
    ["kjøpesum over 3 000 000 kr", { kjopesum: 3_000_001 }, /mellom 5 000 og 3 000 000/],
    ["første registrering etter kjøpet", { bil: { ...SVAR.bil, ar: Number(idag.slice(0, 4)) + 1 } }, /registrert etter kjøpsdatoen/],
    ["organisasjonsnummer med feil kontrollsiffer", { selgerOrgnr: "999999998" }, /ikke gyldig/],
    ["lenke i beskrivelsen", { detaljer: { ...D, motor: { ...D.motor, beskrivelse: "Se https://bilforum.no/tråd" } } }, /Legg ved dokumentet/],
    ["bare tall i konklusjonen", { detaljer: { ...D, motor: { ...D.motor, rapport: { ...D.motor.rapport, konklusjon: "123 456" } } } }, /Skriv med ord/],
  ];
  for (const [navn, endring, melding] of TILFELLER)
    it(`avviser ${navn}`, () => {
      const r = rensBrevsvar({ ...SVAR, ...endring });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.melding).toMatch(melding);
    });

  it("renser beskrivelsen som konklusjonen: linjeskift og doble anførselstegn", () => {
    const r = rensBrevsvar({ ...SVAR, detaljer: { ...D, motor: { ...D.motor, beskrivelse: ' Mistet "kraft"\nog  stoppet ' } } });
    expect(r.ok && r.svar.feil.find((f) => f.hoved === "motor")!.beskrivelse).toBe("Mistet kraft og stoppet");
  });
});
