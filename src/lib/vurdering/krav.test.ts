import { describe, expect, it } from "vitest";
import { beregnFaktorer } from "./faktorer";
import { alleKrav, anbefaltKrav, foreslaKrav, hevingSjanse, HEVING, utbedringsAndel } from "./krav";
import klager from "./testdata/klager.json";
import type { KlageInput, TestKlage } from "./typer";

const hent = (id: number): KlageInput => structuredClone((klager as TestKlage[]).find((k) => k.id === id)!.input);

// Sak 1: kjøpesum 219 000, utbedring 85 000 (39 %), forhandleren har forsøkt å rette.
function faktorer(over: (i: KlageInput) => void = () => {}, id = 1) {
  const i = hent(id);
  over(i);
  return beregnFaktorer(i, null, "2026-10-01");
}

describe("anbefaltKrav", () => {
  it("anbefaler retting når forhandleren ikke har fått prøve, uansett ønske", () => {
    for (const kontakt of ["nei", "venter"] as const) {
      const f = faktorer((i) => (i.feilen.kontakt = kontakt));
      expect(anbefaltKrav(f, null)).toBe("retting");
      expect(anbefaltKrav(f, "levere_tilbake")).toBe("retting");
    }
  });

  it("uten ønske anbefales prisavslag, som oftest fører frem", () => {
    expect(anbefaltKrav(faktorer(), null)).toBe("prisavslag");
  });

  it("anbefaler heving når bruker ønsker det og feilen er stor nok", () => {
    expect(anbefaltKrav(faktorer(), "levere_tilbake")).toBe("heving");
  });

  it("anbefaler prisavslag når feilen koster under en fjerdedel, selv om bruker vil levere tilbake", () => {
    const f = faktorer((i) => (i.feilen.utbedringskostnadNok = 20_000)); // 9 % av 219 000
    expect(anbefaltKrav(f, "levere_tilbake")).toBe("prisavslag");
  });

  it("ukjent utbedringskostnad hindrer ikke heving når bruker ønsker det", () => {
    const f = faktorer((i) => (i.feilen.utbedringskostnadNok = null));
    expect(utbedringsAndel(f)).toBeNull();
    expect(anbefaltKrav(f, "levere_tilbake")).toBe("heving");
  });
});

describe("hevingSjanse", () => {
  it("bruker grunnraten når ingen faktorer er kjent", () => {
    const f = faktorer((i) => {
      i.feilen.kontakt = "nei";
      i.feilen.utbedringskostnadNok = null;
    });
    expect(hevingSjanse(f)).toEqual({ pst: HEVING.grunn, grunn: "" });
  });

  it("forsøkt retting løfter sjansen", () => {
    expect(hevingSjanse(faktorer((i) => (i.feilen.utbedringskostnadNok = null))).pst).toBe(HEVING.rettingForsokt);
  });

  it("lover aldri mer enn den mest forsiktige faktoren", () => {
    const f = faktorer((i) => (i.feilen.utbedringskostnadNok = 10_000));
    expect(hevingSjanse(f).pst).toBe(HEVING.utbedringUnder25);
    expect(hevingSjanse(f).grunn).toMatch(/fjerdedel/);
  });

  it("utbedringsandel deler på kjøpesum", () => {
    expect(hevingSjanse(faktorer((i) => (i.feilen.utbedringskostnadNok = 150_000))).pst).toBe(HEVING.utbedringOver50);
    expect(hevingSjanse(faktorer()).pst).toBe(HEVING.utbedring25til50);
  });
});

describe("foreslaKrav", () => {
  it("ikke bedt om retting: alle tre, retting først, de andre som alternativ", () => {
    const k = foreslaKrav(faktorer((i) => (i.feilen.kontakt = "nei")), "levere_tilbake");
    expect(k.map((x) => x.krav)).toEqual(["retting", "prisavslag", "heving"]);
    expect(k.filter((x) => x.anbefalt)).toHaveLength(1);
    expect(k[1].sjanse).toMatch(/^Hvis forhandleren ikke lykkes med å rette/);
    expect(k[0].tekst).toMatch(/levere bilen tilbake/);
  });

  it("retting allerede forsøkt: bare prisavslag og heving, anbefalt først", () => {
    const k = foreslaKrav(faktorer(), "levere_tilbake");
    expect(k.map((x) => x.krav)).toEqual(["heving", "prisavslag"]);
    expect(k[0].anbefalt).toBe(true);
  });

  it("prisavslag viser beløpsspenn for brukerens prisklasse", () => {
    const pris = foreslaKrav(faktorer(), null).find((x) => x.krav === "prisavslag")!;
    expect(pris.sjanse).toMatch(/Typisk tilkjent 10 000 kr–31 000 kr/);
  });

  it("heving viser sjanse avrundet til nærmeste fem, og riktig bevisbyrde (fkjl § 32)", () => {
    const heving = foreslaKrav(faktorer(), null).find((x) => x.krav === "heving")!;
    expect(heving.sjanse).toMatch(/^Ca\. 35 % av dem som krever heving får det\./); // 34 → 35
    expect(heving.tekst).toMatch(/kan bare nekte hvis de kan vise at mangelen er uvesentlig/);
  });

  it("reparasjonsønske etter mislykket retting nevner reparasjon hos annet verksted", () => {
    const k = foreslaKrav(faktorer((i) => (i.feilen.kontakt = "avvist")), "reparasjon");
    expect(k.find((x) => x.krav === "prisavslag")!.tekst).toMatch(/annet verksted/);
  });
});

describe("alleKrav", () => {
  it("gir én liste per ønske pluss standard, hver med nøyaktig ett anbefalt", () => {
    const alle = alleKrav(faktorer());
    expect(Object.keys(alle).sort()).toEqual(["levere_tilbake", "pengene_tilbake_beholde", "reparasjon", "standard"]);
    for (const liste of Object.values(alle)) expect(liste.filter((k) => k.anbefalt)).toHaveLength(1);
    expect(alle.levere_tilbake[0].krav).toBe("heving");
    expect(alle.standard[0].krav).toBe("prisavslag");
  });
});
