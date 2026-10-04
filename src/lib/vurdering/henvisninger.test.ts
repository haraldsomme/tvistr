import { describe, expect, it } from "vitest";
import { beregnFaktorer } from "./faktorer";
import { HENVISNINGER, MAKS_ELDRE_AR, MAKS_NYERE_AR, REGELGRUNNLAG, velgHenvisning, type Henvisning, type LignendePost, type RegelPost } from "./henvisninger";
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
const felles = {
  ref: "FKU-2024-1",
  organ: "Forbrukerklageutvalget",
  dato: "2024-01-31",
  kildeUrl: "https://example.test/v.pdf",
  km: 150000,
  lov: "før_2024",
  setning: "I 2024 fikk kjøperen av en Testbil medhold etter å ha klaget på motorfeil 10 dager etter kjøpet. Utvalget tilkjente 10 000 kr.",
} as const;
let neste = 1;
const lignende = (o: Partial<LignendePost> = {}): LignendePost => ({
  ...felles,
  vedtakId: neste++,
  type: "lignende",
  gruppe: "motor",
  botte: "rask",
  alder: 10,
  presumsjon: true,
  likhet: "En testbil kjøpt hos forhandler fikk motorfeil.",
  konklusjon: "Utvalget kom til at bilen hadde en mangel.",
  ...o,
});
const regel = (o: Partial<RegelPost> = {}): RegelPost => ({
  ...felles,
  vedtakId: neste++,
  type: "regel",
  grunnlag: "formodning",
  alder: 14,
  presumsjon: true,
  regel: "I en sak om en testbil la utvalget formodningsregelen til grunn.",
  ...o,
});
const REGLER = [regel({ vedtakId: 900 }), regel({ vedtakId: 901, grunnlag: "rapport", presumsjon: false }), regel({ vedtakId: 902, grunnlag: "opplysning", presumsjon: false }), regel({ vedtakId: 903, grunnlag: "forventning", presumsjon: false })];

describe("velgHenvisning", () => {
  it("samme feilgruppe og tidsrom gir en lignende sak", () => {
    const v = velg({}, [lignende({ vedtakId: 100 }), ...REGLER]);
    expect(v).toMatchObject({ treff: "lignende", henvisning: { vedtakId: 100 } });
  });

  it("uten sak for tidsrommet brukes nabotidsrommet når formodningsregelen tillater det", () => {
    // Bought 2025, defect after 6–24 months: inside the two-year presumption, so a «rask» decision fits.
    const v = velg({ oppdaget: "6_mnd_til_2_ar" }, [lignende({ vedtakId: 110 }), ...REGLER]);
    expect(v).toMatchObject({ treff: "tilnaermet", henvisning: { vedtakId: 110 } });
  });

  it("aldri en sak vunnet på formodningsregelen for en kjøper som ikke har den", () => {
    // Bought 2023, defect after 6–24 months: the six-month presumption does not reach it.
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [lignende({ vedtakId: 120 }), ...REGLER]);
    expect(v).toMatchObject({ treff: "regel", henvisning: { vedtakId: 903, grunnlag: "forventning" } });
  });

  it("regel-saken følger grunnlaget brevet bygger på", () => {
    expect(velg({ typer: ["annet"] }, REGLER)?.henvisning.vedtakId).toBe(900);
    expect(velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01", rapport: true }, REGLER)?.henvisning.vedtakId).toBe(901);
    expect(velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01", feilOpplysning: "ja_dokumentert" }, REGLER)?.henvisning.vedtakId).toBe(902);
    expect(velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01" }, REGLER)?.henvisning.vedtakId).toBe(903);
  });

  it("kjøperen visste om feilen: fortsatt en henvisning", () => {
    expect(velg({ opplystForKjop: "ja" }, [lignende({ vedtakId: 130 }), ...REGLER])?.henvisning.vedtakId).toBe(130);
  });

  it("en sak etter ny lov brukes bare for kjøp fra 2024, og foretrekkes da", () => {
    const bibliotek = [lignende({ vedtakId: 140 }), lignende({ vedtakId: 141, lov: "etter_2024" }), ...REGLER];
    expect(velg({ kjopsdato: "2023-03-01" }, bibliotek)?.henvisning.vedtakId).toBe(140);
    expect(velg({ kjopsdato: "2025-03-01" }, bibliotek)?.henvisning.vedtakId).toBe(141);
  });

  it("den siterte bilen er ikke mer enn fire år nyere enn kjøperens", () => {
    // The buyer's car was 15 years old at purchase.
    expect(velg({ bilAr: 2010 }, [lignende({ vedtakId: 150, alder: 10 }), ...REGLER])?.treff).toBe("regel");
    expect(velg({ bilAr: 2010 }, [lignende({ vedtakId: 151, alder: 11 }), ...REGLER])?.henvisning.vedtakId).toBe(151);
  });

  it("den siterte bilen er heller ikke mer enn ti år eldre enn kjøperens", () => {
    // The buyer's car was 3 years old; a 37-year-old car is no similar case.
    expect(velg({ bilAr: 2022 }, [lignende({ vedtakId: 155, alder: 37 }), ...REGLER])?.treff).toBe("regel");
    expect(velg({ bilAr: 2022 }, [lignende({ vedtakId: 156, alder: 13 }), ...REGLER])?.henvisning.vedtakId).toBe(156);
  });

  it("nærmeste alder foretrekkes; ukjent alder gir den eldste bilen", () => {
    const bibliotek = [lignende({ vedtakId: 160, alder: 4 }), lignende({ vedtakId: 161, alder: 12 }), ...REGLER];
    expect(velg({ bilAr: 2021 }, bibliotek)?.henvisning.vedtakId).toBe(160);
    expect(velg({}, bibliotek)?.henvisning.vedtakId).toBe(161);
  });

  it("med flere feil vinner samme tidsrom i en annen gruppe over nabotidsrom i den første", () => {
    const bibliotek = [lignende({ vedtakId: 170, botte: "middels", presumsjon: false }), lignende({ vedtakId: 171, gruppe: "rust" }), ...REGLER];
    expect(velg({ typer: ["motor", "rust"] }, bibliotek)?.henvisning.vedtakId).toBe(171);
  });

  it("når loven stopper kravet, er det ingen henvisning", () => {
    expect(velg({ kjopsform: "privatperson" }, [lignende(), ...REGLER])).toBeNull();
  });
});

// The sentence for the buyer, unchanged from the earlier examples.
const MAL = /^I 20\d\d fikk kjøper(en|ne) av en .+ (delvis )?medhold etter å ha klaget på .+ (etter|som) kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at .+)\.$/;

describe("biblioteket", () => {
  it("alle saker loven ikke stopper får en henvisning, og den er aldri vunnet på en fordel kjøperen mangler", () => {
    const avvik: string[] = [];
    const feil: FeilKnapp[][] = [...FEILTYPER_KNAPPER.map((t) => [t]), ["motor", "rust"], ["annet", "bremser"]];
    for (const typer of feil)
      for (const oppdaget of OPPDAGET_VALG)
        for (const kjopsdato of ["2023-03-01", "2025-03-01"])
          for (const alder of [null, 1, 6, 10, 15, 25])
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
                  if (h.type === "lignende" && f.bilAlder !== null && h.alder < f.bilAlder - MAKS_NYERE_AR) avvik.push(`${merke}: #${h.vedtakId} er en mye nyere bil`);
                  if (h.type === "lignende" && f.bilAlder !== null && h.alder > f.bilAlder + MAKS_ELDRE_AR) avvik.push(`${merke}: #${h.vedtakId} er en mye eldre bil`);
                }
    expect(avvik.slice(0, 15)).toEqual([]);
  });

  it("hvert grunnlag har en regel-post etter gammel lov, og bare formodning bygger på formodningsregelen", () => {
    for (const g of REGELGRUNNLAG) expect(HENVISNINGER.some((h) => h.type === "regel" && h.grunnlag === g && h.lov === "før_2024"), g).toBe(true);
    for (const h of HENVISNINGER) if (h.type === "regel") expect(h.presumsjon, `#${h.vedtakId}`).toBe(h.grunnlag === "formodning");
  });

  it("alle poster er fullstendige, unike og følger malen", () => {
    expect(new Set(HENVISNINGER.map((h) => h.vedtakId)).size).toBe(HENVISNINGER.length);
    for (const h of HENVISNINGER) {
      const navn = `#${h.vedtakId}`;
      expect(h.setning, navn).toMatch(MAL);
      expect(h.ref, navn).toMatch(/^(FKU|FTU)-\d{4}-\d+(-\d+)?$/);
      expect(h.kildeUrl, navn).toMatch(/^https:\/\/\S+$/);
      expect(h.dato, navn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const tekster = h.type === "lignende" ? [h.likhet, h.konklusjon] : [h.regel];
      for (const t of tekster) {
        expect(t, navn).toMatch(/^[A-ZÆØÅ].+\.$/);
        expect(t, navn).not.toMatch(/[[\]]|\d+ ?kr\b/);
      }
    }
  });
});
