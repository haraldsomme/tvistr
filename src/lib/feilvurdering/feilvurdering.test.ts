import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { avled, avledLovversjon, prisavslagProsent, tidsniva } from "./avled";
import { AVSLAGSGRUNNER, BEVISGRUNNLAG, FORMODNING, SANKSJONER, UTFALL, VISTE_SEG } from "./skjema";
import { finnesIFulltekst, fulltekstVarianter, lesSvar } from "./verifiser";

const FULLTEKST = `Utvalget ser slik på saken:
Det antas følgelig at feilen forelå ved leverings-
tidspunktet, jf. fkjl. § 18 annet ledd. Bremser er å betegne som slitedeler som vanligvis vil kreve flere utskiftinger.`;

const feil = (p: Record<string, unknown>) => ({
  id: "f1",
  hovedkategori: "motor",
  underkategori: "turbo",
  komponent: "turbo",
  utfall: "medhold",
  samlet: false,
  avslagsgrunn: null,
  bevisgrunnlag: "formodning_ikke_motbevist",
  dager_etter_levering: 20,
  viste_seg: "innen_6_mnd",
  formodning: "ikke_nevnt",
  sitat: null,
  ...p,
});
const svar = (feilListe: unknown[], p: Record<string, unknown> = {}) => ({ vedtak_id: 7, feil: feilListe, sanksjoner: ["prisavslag"], rettingsforsok: null, som_den_er: false, usikkerhet: null, ...p });

describe("instruksen", () => {
  const instruks = readFileSync(new URL("./instruks.md", import.meta.url), "utf8");
  it("nevner alle kategori-id-ene og alle verdiene i listene", () => {
    for (const h of HOVEDKATEGORIER) {
      expect(instruks).toContain(`\`${h.id}\``);
      for (const u of h.under) expect(instruks).toContain(`\`${u.id}\``);
    }
    for (const v of [...UTFALL, ...AVSLAGSGRUNNER, ...BEVISGRUNNLAG, ...SANKSJONER, ...VISTE_SEG, ...FORMODNING]) expect(instruks).toContain(`\`${v}\``);
  });
});

describe("sitatkontroll", () => {
  const v = fulltekstVarianter(FULLTEKST);
  it("finner sitat over et linjeskift med bindestrek", () => {
    expect(finnesIFulltekst("Det antas følgelig at feilen forelå ved leveringstidspunktet", v)).toBe(true);
  });
  it("godtar utelatelse med … når hver bit er lang nok", () => {
    expect(finnesIFulltekst("Det antas følgelig at feilen … jf. fkjl. § 18 annet ledd", v)).toBe(true);
    expect(finnesIFulltekst("Det antas … ledd", v)).toBe(false);
  });
  it("avviser omskrevet tekst", () => {
    expect(finnesIFulltekst("Det antas derfor at feilen forelå ved levering", v)).toBe(false);
  });
});

describe("lesSvar", () => {
  it("avviser feil vedtak og like id-er", () => {
    expect(lesSvar(svar([feil({})]), 8, FULLTEKST).ok).toBe(false);
    expect(lesSvar(svar([feil({}), feil({})]), 7, FULLTEKST).ok).toBe(false);
    expect(lesSvar(svar([feil({ hovedkategori: "fly" })]), 7, FULLTEKST).ok).toBe(false);
  });

  it("nuller sitat som ikke står ordrett, og underkategori fra en annen hovedkategori", () => {
    const r = lesSvar(svar([feil({ sitat: "Utvalget mener at turboen var defekt ved levering", underkategori: "bremser" })]), 7, FULLTEKST);
    expect(r.ok && r.svar.feil[0]).toMatchObject({ sitat: null, underkategori: null });
    expect(r.ok && r.kontroll).toHaveLength(2);
  });

  it("beholder et ordrett sitat og nuller grunner som ikke passer utfallet", () => {
    const r = lesSvar(
      svar([feil({ utfall: "avvist", avslagsgrunn: "paregnelig_slitasje", bevisgrunnlag: "uomtvistet", sitat: "Bremser er å betegne som slitedeler" })]),
      7,
      FULLTEKST,
    );
    expect(r.ok && r.svar.feil[0]).toMatchObject({ avslagsgrunn: "paregnelig_slitasje", bevisgrunnlag: null, sitat: "Bremser er å betegne som slitedeler" });
  });
});

describe("avled", () => {
  it("samler kategoriene med medhold og den tidligste dagen", () => {
    const r = lesSvar(
      svar([feil({}), feil({ id: "f2", hovedkategori: "understell", underkategori: "bremser", utfall: "avvist", avslagsgrunn: "paregnelig_slitasje", bevisgrunnlag: null, dager_etter_levering: 5 }), feil({ id: "f3", hovedkategori: "garanti", underkategori: null })]),
      7,
      FULLTEKST,
    );
    if (!r.ok) throw new Error(r.feil);
    const a = avled(r.svar, { kjopsdato: "2023-05-01", overtakelsesdato: null, vedtaksdato: null });
    expect(a).toMatchObject({ godtatteKategorier: ["motor", "garanti"], godtatteUnderkategorier: ["motor.turbo"], dagerTilFeil: 5, lovversjon: "før_2024" });
    expect(a.lagret.feil.map((f) => f.tidsniva)).toEqual([1, 1, 1]);
    expect(a.godtatteNiva).toEqual(["motor:1", "motor.turbo:1", "garanti:1"]);
  });

  it("regner lovversjon fra kjøp, overtakelse eller vedtaksdato", () => {
    expect(avledLovversjon({ kjopsdato: "2024-01-01", overtakelsesdato: null, vedtaksdato: null })).toBe("etter_2024");
    expect(avledLovversjon({ kjopsdato: null, overtakelsesdato: null, vedtaksdato: "2024-03-01" })).toBe("før_2024");
    expect(avledLovversjon({ kjopsdato: null, overtakelsesdato: null, vedtaksdato: "2025-03-01" })).toBe("ukjent");
  });
});

describe("tidsniva", () => {
  const f = (p: Partial<Parameters<typeof tidsniva>[0]>) => ({ dager_etter_levering: null, viste_seg: "ukjent" as const, formodning: "ikke_nevnt" as const, ...p });
  it("regner nivået etter lovversjonens frist", () => {
    expect(tidsniva(f({ viste_seg: "6_til_22_mnd" }), 183, null)).toBe(2);
    expect(tidsniva(f({ viste_seg: "6_til_22_mnd" }), 730, null)).toBe(1);
    expect(tidsniva(f({ dager_etter_levering: 200 }), 183, null)).toBe(2);
  });
  it("gir nivå 3 fra 22 måneder, også innenfor presumsjonen etter 2024", () => {
    expect(tidsniva(f({ viste_seg: "22_til_24_mnd", formodning: "anvendt" }), 730, null)).toBe(3);
    expect(tidsniva(f({ dager_etter_levering: 800 }), 183, null)).toBe(3);
  });
  it("bruker formodningen og reklamasjonsdagen når tiden er ukjent", () => {
    expect(tidsniva(f({ formodning: "anvendt" }), 183, null)).toBe(1);
    expect(tidsniva(f({ formodning: "etter_fristen" }), 183, null)).toBe(2);
    expect(tidsniva(f({}), 183, 60)).toBe(1);
    expect(tidsniva(f({}), 183, 300)).toBe(null);
    expect(tidsniva(f({ viste_seg: "innen_6_mnd" }), null, null)).toBe(null);
  });
});

describe("prisavslagProsent", () => {
  it("regner andelen av kjøpesummen bare ved prisavslag", () => {
    expect(prisavslagProsent(["prisavslag", "erstatning"], 15000, 120000)).toBe(12.5);
    expect(prisavslagProsent(["erstatning"], 15000, 120000)).toBe(null);
    expect(prisavslagProsent(["prisavslag"], 150000, 120000)).toBe(null);
    expect(prisavslagProsent(["prisavslag"], null, 120000)).toBe(null);
  });
});

