import { describe, expect, it } from "vitest";
import { PARAGRAFER } from "./paragrafer";
import { dagerMellom, erDato, fristTekst, OVER_TO_AAR_FEIL, OVER_TO_AAR_KJOP, plussDager, plussManeder, type Tidslinje, tidsnivaFor, vurderTidslinje } from "./tidslinje";

const IDAG = "2026-10-13";
const linje = (t: Partial<Tidslinje> = {}): Tidslinje => ({ kjop: "2025-03-10", feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false }], idag: IDAG, ...t });
const regler = (t: Tidslinje) => {
  const v = vurderTidslinje(t);
  return { stopp: v.stopp.map((m) => m.regel), advarsler: v.advarsler.map((m) => m.regel) };
};

describe("datoregning", () => {
  it("teller kalendermåneder og holder seg innenfor måneden", () => {
    expect(plussManeder("2024-08-31", 6)).toBe("2025-02-28");
    expect(plussManeder("2023-08-31", 6)).toBe("2024-02-29");
    expect(plussManeder("2025-03-10", 24)).toBe("2027-03-10");
    expect(plussManeder("2026-10-13", -60)).toBe("2021-10-13");
    expect(plussManeder("2025-01-31", 1)).toBe("2025-02-28");
  });
  it("regner dager og kjenner gyldige datoer", () => {
    expect(dagerMellom("2025-03-10", "2025-03-11")).toBe(1);
    expect(plussDager("2025-02-28", 1)).toBe("2025-03-01");
    expect(erDato("2025-02-29")).toBe(false);
    expect(erDato("2024-02-29")).toBe(true);
    expect(erDato("i går")).toBe(false);
  });
});

describe("tidsnivå fra datoen", () => {
  // [kjøpsdato, oppdaget, tidsnivå]
  const TILFELLER: [string, string, number][] = [
    // Before 2024: six months, then two years.
    ["2023-03-10", "2023-09-10", 1],
    ["2023-03-10", "2023-09-11", 2],
    ["2023-03-10", "2025-03-10", 2],
    ["2023-03-10", "2025-03-11", 3],
    // From 2024: two years.
    ["2024-03-10", "2024-09-11", 1],
    ["2024-03-10", "2026-03-10", 1],
    ["2024-03-10", "2026-03-11", 3],
    // The first of January 2024 is the new law.
    ["2023-12-31", "2024-07-01", 2],
    ["2024-01-01", "2024-07-02", 1],
  ];
  for (const [kjop, oppdaget, niva] of TILFELLER)
    it(`kjøpt ${kjop}, oppdaget ${oppdaget} gir nivå ${niva}`, () => {
      expect(tidsnivaFor(kjop, oppdaget).tidsnivaa).toBe(niva);
      expect(tidsnivaFor(kjop, oppdaget).formodning).toBe(niva === 1);
    });

  it("gir samme nivå som det gamle intervallet for hver dato i intervallet", () => {
    // The old rule (brukerNiva): within six months 1, past two years 3, between: 2 before 2024, 1 after.
    const gammel = (intervall: string, kjop: string) => (intervall === "innen_6_mnd" ? 1 : intervall === "over_24_mnd" ? 3 : kjop < "2024-01-01" ? 2 : 1);
    for (const kjop of ["2022-01-01", "2023-03-01", "2023-06-30", "2024-01-01", "2024-06-01", "2024-08-31"])
      for (let d = 1; d <= 59 * 31; d += 3) {
        const oppdaget = plussDager(kjop, d);
        const n = tidsnivaFor(kjop, oppdaget);
        expect(n.tidsnivaa, `${kjop} ${oppdaget}`).toBe(gammel(n.intervall, kjop));
      }
  });

  it("melder nærhet til en frist innenfor 14 dager, seks måneder bare før 2024", () => {
    expect(tidsnivaFor("2023-03-10", plussDager("2023-09-10", 14)).naerFrist).toBe("6mnd");
    expect(tidsnivaFor("2023-03-10", plussDager("2023-09-10", -14)).naerFrist).toBe("6mnd");
    expect(tidsnivaFor("2023-03-10", plussDager("2023-09-10", 15)).naerFrist).toBeUndefined();
    expect(tidsnivaFor("2024-03-10", "2024-09-10").naerFrist).toBeUndefined();
    expect(tidsnivaFor("2024-03-10", "2026-03-01").naerFrist).toBe("2aar");
    expect(tidsnivaFor("2023-03-10", "2025-03-24").naerFrist).toBe("2aar");
    expect(tidsnivaFor("2021-11-01", "2026-11-10").naerFrist).toBe("5aar");
  });
});

describe("regler som stopper", () => {
  const TILFELLER: [string, Partial<Tidslinje>, string][] = [
    ["kjøpsdato i fremtiden", { kjop: "2026-11-01", feil: [] }, "kjop_fremtid"],
    ["kjøp mer enn fem år tilbake", { kjop: "2021-10-12", feil: [] }, "kjop_fem_aar"],
    ["oppdaget samme dag som kjøpet", { feil: [{ id: "motor", oppdaget: "2025-03-10", omtrentlig: false }] }, "oppdaget_for_kjop"],
    ["oppdaget før kjøpet", { feil: [{ id: "motor", oppdaget: "2025-01-01", omtrentlig: false }] }, "oppdaget_for_kjop"],
    ["oppdaget i fremtiden", { feil: [{ id: "motor", oppdaget: "2026-10-14", omtrentlig: false }] }, "oppdaget_fremtid"],
    ["rapport før oppdaget", { feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false, rapport: "2025-04-30" }] }, "rapport_for_oppdaget"],
    ["rapport i fremtiden", { feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false, rapport: "2026-10-14" }] }, "rapport_fremtid"],
    ["reklamert før første feil", { reklamert: "2025-04-30" }, "reklamert_for_oppdaget"],
    ["reklamert samme dag som kjøpet", { reklamert: "2025-03-10" }, "reklamert_for_oppdaget"],
    ["reklamert i fremtiden", { reklamert: "2026-10-14" }, "reklamert_fremtid"],
  ];
  for (const [navn, t, regel] of TILFELLER) it(navn, () => expect(regler(linje(t)).stopp).toContain(regel));

  it("stopper på manglende kjøpsdato og ingenting annet", () => {
    expect(vurderTidslinje(linje({ kjop: "" })).stopp.map((m) => m.regel)).toEqual(["kjop_mangler"]);
  });

  it("godtar grensene: fem år på dagen, rapport samme dag som oppdaget, reklamert samme dag", () => {
    expect(regler(linje({ kjop: "2021-10-13", feil: [] })).stopp).toEqual([]);
    expect(regler(linje({ feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false, rapport: "2025-05-01" }], reklamert: "2025-05-01" })).stopp).toEqual([]);
    expect(regler(linje({ feil: [{ id: "motor", oppdaget: IDAG, omtrentlig: false }] })).stopp).toEqual([]);
  });

  it("lar en manglende dato være; den kreves andre steder", () => {
    expect(regler(linje({ feil: [{ id: "motor", oppdaget: "", omtrentlig: false }] })).stopp).toEqual([]);
  });

  it("viser stoppet ved riktig felt og feil", () => {
    const v = vurderTidslinje(linje({ feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false, rapport: "2025-04-01" }] }));
    expect(v.stopp).toEqual([{ regel: "rapport_for_oppdaget", felt: "rapport", feilId: "motor", melding: "Rapporten kan ikke være datert før du oppdaget feilen." }]);
  });

  it("måler reklamasjonen mot den første feilen", () => {
    const to = [
      { id: "motor", oppdaget: "2025-05-01", omtrentlig: false },
      { id: "lys", oppdaget: "2025-08-01", omtrentlig: false },
    ];
    expect(regler(linje({ feil: to, reklamert: "2025-05-15" })).stopp).toEqual([]);
    expect(regler(linje({ feil: to, reklamert: "2025-04-15" })).stopp).toContain("reklamert_for_oppdaget");
  });
});

describe("regler som advarer", () => {
  it("advarer når reklamasjonen kom mer enn to måneder etter oppdaget, og ikke på dagen to måneder etter", () => {
    expect(regler(linje({ reklamert: "2025-08-01" })).advarsler).toContain("reklamasjon_sen");
    expect(regler(linje({ reklamert: "2025-07-01" })).advarsler).not.toContain("reklamasjon_sen");
    expect(regler(linje({ reklamert: "2025-07-02" })).advarsler).toContain("reklamasjon_sen");
  });

  it("måler mot brevets dato når brevet er reklamasjonen", () => {
    expect(regler(linje({ feil: [{ id: "motor", oppdaget: "2026-09-01", omtrentlig: false }] })).advarsler).toEqual([]);
    expect(regler(linje({ feil: [{ id: "motor", oppdaget: "2026-08-01", omtrentlig: false }] })).advarsler).toEqual(["reklamasjon_sen"]);
  });

  it("måler en feil oppdaget etter reklamasjonen mot brevet, ikke mot reklamasjonen", () => {
    const v = vurderTidslinje(
      linje({
        feil: [
          { id: "motor", oppdaget: "2025-05-01", omtrentlig: false },
          { id: "lys", oppdaget: "2026-09-20", omtrentlig: false },
        ],
        reklamert: "2025-05-15",
      }),
    );
    expect(v.advarsler).toEqual([]);
  });

  it("advarer om en rapport mer enn seks måneder etter oppdaget", () => {
    expect(regler(linje({ feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false, rapport: "2025-11-02" }], reklamert: "2025-05-10" })).advarsler).toEqual(["rapport_sen"]);
    expect(regler(linje({ feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false, rapport: "2025-11-01" }], reklamert: "2025-05-10" })).advarsler).toEqual([]);
  });

  it("advarer om en dato nær en frist, og krever bekreftelse bare når datoen er omtrentlig", () => {
    const naer = (omtrentlig: boolean) =>
      vurderTidslinje({ kjop: "2023-03-10", feil: [{ id: "motor", oppdaget: "2023-09-15", omtrentlig }], reklamert: "2023-09-20", idag: IDAG }).advarsler;
    expect(naer(false)).toEqual([{ regel: "naer_frist", felt: "oppdaget", feilId: "motor", melding: expect.stringContaining("(seks måneder)") }]);
    expect(naer(false)[0].bekreft).toBeUndefined();
    expect(naer(true)[0].bekreft).toBe(true);
    expect(naer(false)[0].melding).toContain("hvem som må bevise");
  });

  it("sier at to år før 2024 avgjør fristen, ikke bevisbyrden", () => {
    const v = vurderTidslinje({ kjop: "2023-03-10", feil: [{ id: "motor", oppdaget: "2025-03-15", omtrentlig: false }], reklamert: "2025-03-20", idag: IDAG });
    expect(v.advarsler[0].melding).toContain("om reklamasjonen er i tide");
  });

  it("gir ingen advarsel for en tidslinje i orden", () => {
    expect(vurderTidslinje(linje({ feil: [{ id: "motor", oppdaget: "2025-05-01", omtrentlig: false, rapport: "2025-05-20" }], reklamert: "2025-06-01" }))).toMatchObject({ stopp: [], advarsler: [] });
  });
});

describe("teksten i meldingene", () => {
  const meldinger = (t: Tidslinje) => {
    const v = vurderTidslinje(t);
    return [...v.stopp, ...v.advarsler].map((m) => m.melding);
  };
  const FEM_AAR = linje({ kjop: "2021-10-12", feil: [] });
  const SEN = linje({ reklamert: "2025-08-01" });

  it("stopper bare, uten et varsel i tillegg, mer enn fem år etter overtakelsen", () => {
    const v = vurderTidslinje(FEM_AAR);
    expect(v.stopp.map((m) => m.melding)).toEqual([
      "Det er mer enn fem år siden du overtok bilen. Den lengste fristen for å reklamere er fem år (forbrukerkjøpsloven § 27 annet ledd annet punktum), og dette brevet kan ikke brukes etter det. Mener du selger har holdt noe skjult, eller har du en garanti som gjelder lenger, bør du kontakte Forbrukerrådet eller en advokat.",
    ]);
    expect(v.advarsler).toEqual([]);
  });

  it("sier at to måneder er minstefristen, før den sier at reklamasjonen kan være for sen", () => {
    expect(meldinger(SEN)).toEqual([
      "Reklamasjon innen to måneder etter at feilen ble oppdaget er alltid i tide. Etter det vurderes det om du reklamerte innen rimelig tid. Du reklamerer mer enn to måneder etter at feilen ble oppdaget. Selger kan hevde at reklamasjonen er for sen (forbrukerkjøpsloven § 27 første ledd). Du kan likevel lage brevet.",
    ]);
  });

  it("gjør fem år til hovedregelen for bil i varslene om to år", () => {
    expect(OVER_TO_AAR_KJOP).toBe("Det er mer enn to år siden du overtok bilen. For biler gjelder som regel en frist på fem år, men for slitedeler kan fristen være to år. Selger kan bruke det.");
    expect(OVER_TO_AAR_FEIL).toBe("En eller flere feil viste seg mer enn to år etter at du overtok bilen. For biler gjelder som regel en frist på fem år, men for slitedeler kan fristen være to år. Selger kan bruke det.");
    expect(fristTekst("etter_2024")).toBe(
      "Fristen for å reklamere er fem år for deler som er ment å vare vesentlig lenger enn to år, ellers to år, regnet fra overtakelsen (forbrukerkjøpsloven § 27 annet ledd). Reklamasjonen må i tillegg fremsettes innen rimelig tid etter at feilen ble oppdaget (forbrukerkjøpsloven § 27 første ledd).",
    );
  });

  it("henter alle paragrafer fra paragrafer.ts, for begge lovversjoner", () => {
    for (const v of ["før_2024", "etter_2024"] as const) {
      const kjent = Object.values(PARAGRAFER[v]).filter((x): x is string => !!x);
      const tekster = [fristTekst(v), ...meldinger(linje({ kjop: v === "før_2024" ? "2021-10-12" : "2025-03-10", feil: v === "før_2024" ? [] : linje().feil, reklamert: v === "før_2024" ? undefined : "2025-08-01" }))];
      for (const t of tekster)
        for (const [, par] of t.matchAll(/forbrukerkjøpsloven (§ \d+[a-z]?(?: (?:første|annet|tredje) ledd)?(?: (?:første|annet) punktum)?)/g)) expect(kjent, `${par} i «${t}»`).toContain(par);
    }
  });

  it("sier aldri at brevet sendes", () => {
    for (const t of [FEM_AAR, SEN, linje({ feil: [{ id: "motor", oppdaget: "2027-01-01", omtrentlig: false }] })]) for (const m of meldinger(t)) expect(m).not.toMatch(/\bsendes\b|\bsender\b/i);
    for (const t of [fristTekst("før_2024"), fristTekst("etter_2024"), OVER_TO_AAR_KJOP, OVER_TO_AAR_FEIL]) expect(t).not.toMatch(/\bsendes\b|\bsender\b/i);
  });
});
