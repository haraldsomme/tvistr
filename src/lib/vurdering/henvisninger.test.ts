import { describe, expect, it } from "vitest";
import { beregnFaktorer } from "./faktorer";
import { HENVISNINGER, REGELGRUNNLAG, velgHenvisning, type Henvisning } from "./henvisninger";
import { FEILTYPER_KNAPPER } from "./innsending";
import { OPPDAGET_VALG, type FeilKnapp, type FeilOpplysning, type KlageInput, type Kjopsform, type Oppdaget } from "./typer";

const IDAG = "2026-10-01";

type Valg = { typer?: FeilKnapp[]; oppdaget?: Oppdaget; kjopsdato?: string; bilAr?: number; rapport?: boolean; feilOpplysning?: FeilOpplysning; opplystForKjop?: "ja" | "nei"; kjopsform?: Kjopsform };
const klage = (o: Valg = {}): KlageInput => ({
  bilOgKjop: { kjopsform: o.kjopsform ?? "forhandler", kjopsdato: o.kjopsdato ?? "2025-03-01", kjopesumNok: 150000, ...(o.bilAr !== undefined && { bilAr: o.bilAr }) },
  feilen: { typer: o.typer ?? ["motor"], oppdaget: o.oppdaget ?? "innen_6_mnd", opplystForKjop: o.opplystForKjop ?? "nei", feilOpplysning: o.feilOpplysning ?? "nei", kontakt: "ja" },
  bevis: { verkstedrapport: o.rapport ?? false, rapportSierForKjop: o.rapport ? true : null, bilder: null },
});
const velg = (o: Valg, bibliotek: Henvisning[]) => velgHenvisning(beregnFaktorer(klage(o), IDAG), bibliotek);

// Made-up posts: the selection rules are tested here, the real library in «biblioteket» below.
let neste = 1;
const post = (o: Partial<Henvisning> = {}): Henvisning => ({
  vedtakId: neste++,
  ref: "FKU-2024-1",
  organ: "Forbrukerklageutvalget",
  dato: "2024-01-31",
  kildeUrl: "https://example.test/v.pdf",
  gruppe: "motor",
  botte: "middels",
  alder: 10,
  km: null,
  lov: "før_2024",
  presumsjon: false,
  setning: "I 2024 fikk kjøperen av en Testbil medhold etter å ha klaget på motorfeil ett år etter kjøpet. Utvalget tilkjente 10 000 kr.",
  likhet: "En testbil kjøpt hos forhandler fikk motorfeil.",
  konklusjon: "Utvalget kom til at bilen hadde en mangel.",
  ...o,
});

describe("velgHenvisning", () => {
  it("bilens alder teller mer enn feiltypen", () => {
    // The buyer's car was 2 years old with a brake defect; a 2-year-old car with another defect beats a 16-year-old with brakes.
    const bibliotek = [post({ vedtakId: 100, alder: 2, gruppe: "klimaanlegg" }), post({ vedtakId: 101, alder: 16, gruppe: "bremser" })];
    const v = velg({ typer: ["bremser"], oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2021 }, bibliotek);
    expect(v?.henvisning.vedtakId).toBe(100);
    expect(v?.likheter).toEqual(["alder", "tidsrom"]);
  });

  it("med lik alder avgjør tidsrommet, så feiltypen", () => {
    const bibliotek = [post({ vedtakId: 110, botte: "sen" }), post({ vedtakId: 111, gruppe: "rust" }), post({ vedtakId: 112 })];
    expect(velg({ typer: ["motor"], oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(112);
    expect(velg({ typer: ["rust"], oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(111);
  });

  it("en nyere bil teller mer mot enn en like mye eldre", () => {
    // The buyer's car was 10: a 7-year-old car is 3 years newer, a 13-year-old 3 years older.
    const bibliotek = [post({ vedtakId: 120, alder: 7 }), post({ vedtakId: 121, alder: 13 })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(121);
  });

  it("aldri en sak vunnet på formodningsregelen for en kjøper som ikke har den", () => {
    // Bought 2023, defect after 6–24 months: the six-month presumption does not reach it.
    const bibliotek = [post({ vedtakId: 130, botte: "rask", presumsjon: true }), post({ vedtakId: 131, alder: 30 })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(131);
    // Bought 2025, defect after 6–24 months: inside the two-year presumption, so the closer car fits.
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2025-03-01", bilAr: 2015 }, bibliotek)?.henvisning.vedtakId).toBe(130);
  });

  it("en sak etter ny lov brukes bare for kjøp fra 2024, og foretrekkes da", () => {
    const bibliotek = [post({ vedtakId: 140 }), post({ vedtakId: 141, lov: "etter_2024" })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, bibliotek)?.henvisning.vedtakId).toBe(140);
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2025-03-01" }, bibliotek)?.henvisning.vedtakId).toBe(141);
  });

  it("samme regel teller når brevet bygger på en rapport eller en uriktig opplysning", () => {
    const bibliotek = [post({ vedtakId: 150 }), post({ vedtakId: 151, alder: 11, grunnlag: "rapport", regel: "I en sak om en testbil la utvalget vekt på en rapport." })];
    const v = velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01", bilAr: 2013, rapport: true }, bibliotek);
    expect(v?.henvisning.vedtakId).toBe(151);
    expect(v?.likheter).toContain("regel");
    expect(velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(150);
  });

  it("ukjent alder gir den eldste bilen", () => {
    const bibliotek = [post({ vedtakId: 160, alder: 4 }), post({ vedtakId: 161, alder: 12 })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, bibliotek)?.henvisning.vedtakId).toBe(161);
  });

  it("kjøperen visste om feilen: fortsatt en henvisning", () => {
    expect(velg({ opplystForKjop: "ja" }, [post({ vedtakId: 170 })])?.henvisning.vedtakId).toBe(170);
  });

  it("når loven stopper kravet, er det ingen henvisning", () => {
    expect(velg({ kjopsform: "privatperson" }, [post()])).toBeNull();
  });
});

// The sentence for the buyer, unchanged from the earlier examples.
const MAL = /^I 20\d\d fikk kjøper(en|ne) av en .+ (delvis )?medhold etter å ha klaget på .+ (etter|som) kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at .+)\.$/;

// The most the cited car's age may differ from the buyer's. Without the presumption only up to 20 years:
// the database has no won dealer decision on a car over 17 years where the defect showed after six months
// (checked October 2026, docs/henvisninger.md).
const MAKS_ALDERSFORSKJELL = 4;
const DEKKET_UTEN_FORMODNING_AR = 20;

describe("biblioteket", () => {
  it("alle saker loven ikke stopper får en henvisning, og den er aldri vunnet på en fordel kjøperen mangler", () => {
    const avvik: string[] = [];
    const feil: FeilKnapp[][] = [...FEILTYPER_KNAPPER.map((t) => [t]), ["motor", "rust"], ["annet", "bremser"]];
    for (const typer of feil)
      for (const oppdaget of OPPDAGET_VALG)
        for (const kjopsdato of ["2023-03-01", "2025-03-01"])
          for (const alder of [null, 1, 6, 10, 15, 20, 25, 30])
            for (const rapport of [false, true])
              for (const feilOpplysning of ["nei", "ja_dokumentert"] as const)
                for (const opplystForKjop of ["nei", "ja"] as const) {
                  // A defect cannot show more than two years after a purchase 19 months ago.
                  if (kjopsdato === "2025-03-01" && oppdaget === "over_2_ar") continue;
                  const bilAr = alder === null ? undefined : Number(kjopsdato.slice(0, 4)) - alder;
                  const f = beregnFaktorer(klage({ typer, oppdaget, kjopsdato, bilAr, rapport, feilOpplysning, opplystForKjop }), IDAG);
                  const v = velgHenvisning(f);
                  const merke = JSON.stringify({ typer, oppdaget, kjopsdato, alder, rapport, feilOpplysning, opplystForKjop });
                  if (!v) {
                    avvik.push(`${merke}: ingen henvisning`);
                    continue;
                  }
                  const h = v.henvisning;
                  if (h.presumsjon && !f.presumsjon) avvik.push(`${merke}: #${h.vedtakId} er vunnet på formodningsregelen`);
                  if (h.lov === "etter_2024" && f.presumsjonManeder !== 24) avvik.push(`${merke}: #${h.vedtakId} er etter ny lov`);
                  // The library covers car ages well enough that the cited car is never far off.
                  const dekket = f.bilAlder !== null && (f.presumsjon || f.bilAlder <= DEKKET_UTEN_FORMODNING_AR);
                  if (dekket && Math.abs(h.alder - f.bilAlder!) > MAKS_ALDERSFORSKJELL) avvik.push(`${merke}: #${h.vedtakId} er ${h.alder} år, kjøperens bil ${f.bilAlder}`);
                }
    expect(avvik.slice(0, 15)).toEqual([]);
  });

  it("hvert grunnlag har en sak med regel etter gammel lov, og bare formodning bygger på formodningsregelen", () => {
    for (const g of REGELGRUNNLAG) expect(HENVISNINGER.some((h) => h.regel && h.grunnlag === g && h.lov === "før_2024"), g).toBe(true);
    for (const h of HENVISNINGER) if (h.grunnlag === "formodning") expect(h.presumsjon, `#${h.vedtakId}`).toBe(true);
  });

  it("alle poster er fullstendige, unike og følger malen", () => {
    expect(new Set(HENVISNINGER.map((h) => h.vedtakId)).size).toBe(HENVISNINGER.length);
    for (const h of HENVISNINGER) {
      const navn = `#${h.vedtakId}`;
      expect(h.setning, navn).toMatch(MAL);
      expect(h.ref, navn).toMatch(/^(FKU|FTU)-\d{4}-\d+(-\d+)?$/);
      expect(h.kildeUrl, navn).toMatch(/^https:\/\/\S+$/);
      expect(h.dato, navn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const tekster = [h.likhet, h.konklusjon, ...(h.regel ? [h.regel] : [])];
      for (const t of tekster) {
        expect(t, navn).toMatch(/^[A-ZÆØÅ].+\.$/);
        expect(t, navn).not.toMatch(/[[\]]|\d+ ?kr\b/);
      }
    }
  });
});
