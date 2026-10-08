import { describe, expect, it } from "vitest";
import { MOMENTER } from "@/lib/brev/momenter";
import { beregnFaktorer } from "./faktorer";
import { HENVISNINGER, velgHenvisning, type Henvisning, type Kjoper } from "./henvisninger";
import { FEILTYPER_KNAPPER } from "./innsending";
import { OPPDAGET_VALG, type FeilKnapp, type FeilOpplysning, type KlageInput, type Kjopsform, type Oppdaget, type Opplyst } from "./typer";

const IDAG = "2026-10-01";

type Valg = { typer?: FeilKnapp[]; oppdaget?: Oppdaget; kjopsdato?: string; bilAr?: number; rapport?: boolean; km?: number; pris?: number; feilOpplysning?: FeilOpplysning; opplystForKjop?: Opplyst; kjopsform?: Kjopsform };
const klage = (o: Valg = {}): KlageInput => ({
  bilOgKjop: { kjopsform: o.kjopsform ?? "forhandler", kjopsdato: o.kjopsdato ?? "2025-03-01", kjopesumNok: o.pris ?? 150000, ...(o.km !== undefined && { kmVedKjop: o.km }), ...(o.bilAr !== undefined && { bilAr: o.bilAr }) },
  feilen: { typer: o.typer ?? ["motor"], oppdaget: o.oppdaget ?? "innen_6_mnd", opplystForKjop: o.opplystForKjop ?? "nei", feilOpplysning: o.feilOpplysning ?? "nei", kontakt: "ja" },
  bevis: { verkstedrapport: o.rapport ?? false, rapportSierForKjop: o.rapport ? true : null, bilder: null },
});
const kjoper = (o: Partial<Kjoper> = {}): Kjoper => ({ sporbare: new Set(), dekket: new Set(), opplyst: "ingenting", ...o });
const velg = (o: Valg, bibliotek: Henvisning[], k: Kjoper = kjoper()) => velgHenvisning(beregnFaktorer(klage(o), IDAG), k, bibliotek);

// Made-up posts: the selection rules are tested here, the real library in «biblioteket» below.
let neste = 1;
const post = (o: Partial<Henvisning> = {}): Henvisning => ({
  vedtakId: neste++, ref: "FKU-2024-1", organ: "Forbrukerklageutvalget", dato: "2024-01-31", kildeUrl: "https://example.test/v.pdf",
  lov: "før_2024", presumsjon: false, sporsmal: ["forventning", "levering"], vekt: [], begrunnelse: "Utvalget la vekt på at feilen var uvanlig.",
  alder: 10, km: 150000, pris: 100000, opplyst: "ingenting", botte: "middels", tid: "ett år etter kjøpet", gruppe: "motor",
  feil: "motorhavari", utfall: "heving av kjøpet", ...o,
});

describe("velgHenvisning", () => {
  it("samme rettsspørsmål først", () => {
    const bibliotek = [post({ vedtakId: 1, sporsmal: ["opplysning"], alder: 20 }), post({ vedtakId: 2, sporsmal: ["forventning"], alder: 3 })];
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek);
    expect(v?.henvisning.vedtakId).toBe(2);
    expect(v?.sammeSporsmal).toBe(true);
  });

  it("utenfor formodningen går et vedtak om leveringen foran et som står sterkere på fakta", () => {
    // The buyer: 2 years, 22 000 km, 520 000 kr, defect after the six-month presumption.
    const bareForventning = post({ vedtakId: 60, sporsmal: ["forventning"], alder: 16, km: 191397, pris: 80000, opplyst: "feilen_opplyst" });
    const medLevering = post({ vedtakId: 61, sporsmal: ["forventning", "levering"], alder: 2, km: 22000, pris: 520000 });
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2021, km: 22000, pris: 520000 }, [bareForventning, medLevering]);
    expect(v?.henvisning.vedtakId).toBe(61);
    expect(v?.sporsmal).toEqual(["forventning", "levering"]);
    expect(v?.sammeSporsmal).toBe(true);
  });

  it("uten vedtak med kjøperens spørsmål brukes reserven, og den sier det", () => {
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ sporsmal: ["opplysning"] })]);
    expect(v?.sammeSporsmal).toBe(false);
  });

  it("færrest manglende momenter går foran fakta", () => {
    const bibliotek = [post({ vedtakId: 10, vekt: ["rapport_upaaregnelig"], alder: 20, km: 300000, pris: 20000 }), post({ vedtakId: 11, vekt: ["bruksstans_sikkerhet"], alder: 1 })];
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013, km: 150000, pris: 100000 }, bibliotek, kjoper({ sporbare: new Set(["rapport_upaaregnelig", "bruksstans_sikkerhet"]), dekket: new Set(["bruksstans_sikkerhet"]) }));
    expect(v?.henvisning.vedtakId).toBe(11);
    expect(v?.mangler).toEqual([]);
  });

  it("et moment kjøperen ikke blir spurt om, er ukjent, ikke manglende", () => {
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ vekt: ["slitedel"] })], kjoper());
    expect(v?.mangler).toEqual([]);
    expect(v?.ukjent).toEqual(["slitedel"]);
  });

  it("a fortiori: vedtaket der kjøperen står sterkere på flest fakta", () => {
    // The buyer: 2 years, 22 000 km, 520 000 kr, nothing disclosed.
    const svak = post({ vedtakId: 20, alder: 16, km: 191397, pris: 80000, opplyst: "feilen_opplyst" });
    const lik = post({ vedtakId: 21, alder: 2, km: 22000, pris: 520000 });
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2021, km: 22000, pris: 520000 }, [lik, svak]);
    expect(v?.henvisning.vedtakId).toBe(20);
    expect(v?.sterkere).toEqual(["alder", "km", "pris", "opplyst"]);
    expect(v?.likt).toEqual(["tid"]);
  });

  it("ukjente fakta hos kjøperen telles ikke, og saken får likevel en henvisning", () => {
    // No car year and no mileage: only price (150 000 kr in klage(), the post has 100 000), disclosure and timing compare.
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ km: null })]);
    expect(v?.henvisning).toBeDefined();
    expect(v?.sterkere).toEqual(["pris"]);
    expect(v?.likt).toEqual(["opplyst", "tid"]);
  });

  it("aldri formodningsregelen eller ny lov kjøperen ikke har", () => {
    const bibliotek = [post({ vedtakId: 30, presumsjon: true, alder: 30 }), post({ vedtakId: 31, lov: "etter_2024", alder: 30 }), post({ vedtakId: 32 })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(32);
  });

  it("tid: et vedtak der feilen kom tidligere enn hos kjøperen gir svakere", () => {
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ botte: "rask" })]);
    expect(v?.svakere).toEqual(["tid"]);
    expect(v?.sterkere).toEqual(["pris"]);
  });

  it("med like fakta foretrekkes samme feiltype", () => {
    const bibliotek = [post({ vedtakId: 50, gruppe: "rust" }), post({ vedtakId: 51, gruppe: "bremser" })];
    const v = velg({ typer: ["bremser"], oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, bibliotek);
    expect(v?.henvisning.vedtakId).toBe(51);
    expect(v?.annenFeil).toBe(false);
  });

  it("nærmeste alder ved likt, så nyeste vedtak", () => {
    const bibliotek = [post({ vedtakId: 40, alder: 14 }), post({ vedtakId: 41, alder: 11 }), post({ vedtakId: 42, alder: 11, dato: "2025-01-01" })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(42);
  });

  it("annen feiltype merkes", () => {
    const v = velg({ typer: ["bremser"], oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ gruppe: "rust" })]);
    expect(v?.annenFeil).toBe(true);
  });

  it("når loven stopper kravet, er det ingen henvisning", () => {
    expect(velg({ kjopsform: "privatperson" }, [post()])).toBeNull();
  });
});

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
                for (const opplystForKjop of ["nei", "ja_verre"] as const) {
                  // A defect cannot show more than two years after a purchase 19 months ago.
                  if (kjopsdato === "2025-03-01" && oppdaget === "over_2_ar") continue;
                  const bilAr = alder === null ? undefined : Number(kjopsdato.slice(0, 4)) - alder;
                  const f = beregnFaktorer(klage({ typer, oppdaget, kjopsdato, bilAr, rapport, feilOpplysning, opplystForKjop }), IDAG);
                  const v = velgHenvisning(f, kjoper());
                  const merke = JSON.stringify({ typer, oppdaget, kjopsdato, alder, rapport, feilOpplysning, opplystForKjop });
                  if (!v) {
                    avvik.push(`${merke}: ingen henvisning`);
                    continue;
                  }
                  const h = v.henvisning;
                  if (h.presumsjon && !f.presumsjon) avvik.push(`${merke}: #${h.vedtakId} er vunnet på formodningsregelen`);
                  if (h.lov === "etter_2024" && f.presumsjonManeder !== 24) avvik.push(`${merke}: #${h.vedtakId} er etter ny lov`);
                }
    expect(avvik.slice(0, 15)).toEqual([]);
  });

  it("hvert hovedspørsmål har vedtak med og uten formodning", () => {
    for (const s of ["forventning", "opplysning"] as const)
      for (const presumsjon of [true, false]) expect(HENVISNINGER.some((h) => h.sporsmal.includes(s) && h.presumsjon === presumsjon), `${s} ${presumsjon}`).toBe(true);
  });

  it("alle poster er fullstendige og unike", () => {
    expect(new Set(HENVISNINGER.map((h) => h.vedtakId)).size).toBe(HENVISNINGER.length);
    const momentIder = new Set(MOMENTER.map((m) => m.id));
    for (const h of HENVISNINGER) {
      const navn = `#${h.vedtakId}`;
      expect(h.sporsmal.length, navn).toBeGreaterThan(0);
      for (const id of h.vekt) expect(momentIder.has(id), `${navn} ${id}`).toBe(true);
      expect(h.ref, navn).toMatch(/^(FKU|FTU)-\d{4}-\d+(-\d+)?$/);
      expect(h.kildeUrl, navn).toMatch(/^https:\/\/\S+$/);
      expect(h.dato, navn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(h.begrunnelse, navn).toMatch(/^Utvalget .+\.$/);
    }
  });
});
