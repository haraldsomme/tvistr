import { describe, expect, it } from "vitest";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { byggBrev, somTekst } from "./brev";
import { krav } from "./krav";
import { kategorivedlegg, vedlegg } from "./vedlegg";
import { mangelen } from "./mangelen";
import { feil, gyldig, lagSak, type Lov, samle } from "./testsak";
import type { Brevfeil, Setning } from "./typer";

// The corrections after the review of the twelve test letters (docs/brev.md): the time limit for every
// kind of defect, the documents that belong to a category, and no invitation to repair what cannot be.
const LOV: Lov[] = ["før_2024", "etter_2024"];
const tekst = (xs: Setning[][] | Setning[]) => (xs as (Setning | Setning[])[]).map((x) => (Array.isArray(x) ? x.map((y) => y.tekst).join(" ") : x.tekst)).join("\n");
const snapshot = (navn: string) => `./__snapshots__/${navn}.txt`;
const RETTING = "Dersom dere ønsker å rette";

describe("femårsfristen når feilen viste seg etter to år", () => {
  it("står i brevet for hver kategori og underkategori, i begge lovversjoner", () => {
    const mangler: string[] = [];
    for (const lov of LOV)
      for (const h of HOVEDKATEGORIER)
        for (const under of [[], ...h.under.map((u) => [u.id])]) {
          // A symptom alone can only be examined and repaired (riktighet.ts).
          const brev = somTekst(byggBrev(lagSak(lov, { krav: h.id === "vet_ikke" ? "retting" : "prisavslag", feil: [feil(h.id, under, "over_24_mnd", "muntlig", "nei")] })));
          if (!brev.includes("Reklamasjonen er fremsatt innen fristen på fem år etter at bilen ble levert, jf. § 27 annet ledd annet punktum.")) mangler.push(`${lov} ${h.id}.${under[0] ?? ""}`);
        }
    expect(mangler).toEqual([]);
  });

  it("sier hvilken feil den gjelder når en annen feil viste seg innenfor fristen", () => {
    const brev = somTekst(byggBrev(lagSak("etter_2024", { feil: [feil("motor", ["turbo"], "innen_6_mnd", "nei", "nei"), feil("vet_ikke", ["nodmodus"], "over_24_mnd", "nei", "nei")] })));
    expect(brev).toContain("For nødmodus: Reklamasjonen er fremsatt innen fristen på fem år");
  });

  it("står ikke for en feil som viste seg innen to år", () => {
    for (const k of ["vet_ikke", "garanti", "historikk"]) {
      const brev = somTekst(byggBrev(lagSak("etter_2024", { krav: k === "vet_ikke" ? "retting" : "prisavslag", feil: [feil(k, [], "6_til_24_mnd", "muntlig", "nei")] })));
      expect(brev, k).not.toContain("fristen på fem år");
    }
  });
});

describe("garanti", () => {
  it("er avvik fra avtalen og uriktig opplysning, ikke § 18 a", () => {
    for (const lov of LOV) {
      const brev = somTekst(byggBrev(lagSak(lov, { feil: [feil("garanti", [], "innen_6_mnd", "skriftlig", "nei")] })));
      expect(brev).toContain("Bilen ble ikke levert med den garantien som ble avtalt. Den svarer dermed ikke til avtalen, jf. forbrukerkjøpsloven § 15 første ledd, jf. § 16 første ledd bokstav a, og til opplysningene dere ga om garantien, jf. § 16 første ledd bokstav c.");
      expect(brev).not.toContain("18 a");
    }
  });
});

describe("vedlegg etter kategori", () => {
  const sak = (fs: Brevfeil[], kontakt = null) => lagSak("etter_2024", { feil: fs, kontakt });
  const KATEGORIER = {
    km: [feil("historikk", ["km"], "6_til_24_mnd", "nei", "nei")],
    servicehefte: [feil("service", ["servicehefte"], "6_til_24_mnd", "nei", "nei")],
    service: [feil("service", ["service"], "6_til_24_mnd", "nei", "nei")],
    skade: [feil("historikk", ["skade"], "6_til_24_mnd", "nei", "nei")],
    eu: [feil("historikk", ["eu"], "6_til_24_mnd", "nei", "nei")],
    "km og skade": [feil("historikk", ["km", "skade"], "6_til_24_mnd", "nei", "nei")],
    turbo: [feil("motor", ["turbo"], "6_til_24_mnd", "nei", "nei")],
  };

  it("gir samme tekst som sist for hver kategori", async () => {
    const ut = samle({ kategori: Object.keys(KATEGORIER) as (keyof typeof KATEGORIER)[], opplysning: ["skriftlig", "muntlig", "nei"] as const, verksted: ["skriftlig", "nei"] as const }, (v) => {
      const fs = KATEGORIER[v.kategori].map((f) => feil(f.hoved, f.under, "6_til_24_mnd", v.opplysning, v.verksted));
      return `${tekst(mangelen(sak(fs)))}\n---\n${tekst(vedlegg(sak(fs))) || "(ingen)"}`;
    });
    await expect(ut).toMatchFileSnapshot(snapshot("vedlegg-kategori"));
  });

  it("legger Utskrift fra Statens vegvesen ved et brev med kilometerstand, uansett svar", () => {
    for (const opplysning of ["skriftlig", "muntlig", "nei"] as const)
      for (const kontakt of [false, true]) {
        const s = lagSak("etter_2024", { feil: [feil("historikk", ["km"], "6_til_24_mnd", opplysning, "nei")], kontakt: kontakt ? lagSak("etter_2024").kontakt ?? null : null });
        expect(byggBrev(s).vedlegg?.punkter.map((p) => p.tekst), `${opplysning} ${kontakt}`).toContain("Utskrift fra Statens vegvesen");
      }
  });

  it("fører samme vedlegg bare én gang, og ikke et servicehefte som mangler", () => {
    const fs = [feil("service", ["service", "servicehefte"], "6_til_24_mnd", "muntlig", "nei")];
    expect(kategorivedlegg(fs[0])).toEqual(["Servicehefte"]);
    expect(vedlegg(sak(fs)).filter((x) => x.tekst === "Servicehefte")).toHaveLength(1);
    expect(kategorivedlegg(feil("service", ["servicehefte"], "6_til_24_mnd", "muntlig", "nei"))).toEqual([]);
  });

  it("nevner dokumentet som vedlegges bare for feil med vedlegg av kategorien", () => {
    expect(tekst(mangelen(sak(KATEGORIER.km)))).toContain("Utskrift fra Statens vegvesen vedlegges.");
    expect(tekst(mangelen(sak(KATEGORIER.turbo)))).not.toContain(" vedlegges.");
    expect(tekst(mangelen(sak(KATEGORIER.turbo)))).not.toContain("Dokumentasjon vedlegges");
  });
});

describe("tilbud om retting", () => {
  const SAKER: Record<string, Brevfeil[]> = {
    teknisk: [feil("motor", ["turbo"], "innen_6_mnd", "nei", "nei")],
    "vet ikke": [feil("vet_ikke", ["varsellampe"], "innen_6_mnd", "nei", "nei")],
    garanti: [feil("garanti", [], "innen_6_mnd", "skriftlig", "nei")],
    utstyr: [feil("utstyr", ["utstyr"], "innen_6_mnd", "skriftlig", "nei")],
    eu: [feil("historikk", ["eu"], "innen_6_mnd", "skriftlig", "nei")],
    ombygging: [feil("historikk", ["ombygging"], "innen_6_mnd", "skriftlig", "nei")],
    "service": [feil("service", ["service"], "innen_6_mnd", "skriftlig", "nei")],
    servicehefte: [feil("service", ["servicehefte"], "innen_6_mnd", "skriftlig", "nei")],
    "service uten underkategori": [feil("service", [], "innen_6_mnd", "skriftlig", "nei")],
    km: [feil("historikk", ["km"], "innen_6_mnd", "skriftlig", "nei")],
    bruk: [feil("historikk", ["bruk"], "innen_6_mnd", "skriftlig", "nei")],
    import: [feil("historikk", ["import"], "innen_6_mnd", "skriftlig", "nei")],
    skade: [feil("historikk", ["skade"], "innen_6_mnd", "skriftlig", "nei")],
    pant: [feil("historikk", ["pant"], "innen_6_mnd", "skriftlig", "nei")],
    "km og skade": [feil("historikk", ["km", "skade"], "innen_6_mnd", "skriftlig", "nei")],
    "km og turbo": [feil("historikk", ["km"], "innen_6_mnd", "skriftlig", "nei"), feil("motor", ["turbo"], "innen_6_mnd", "nei", "nei")],
  };
  const UTEN_TILBUD = ["service", "servicehefte", "service uten underkategori", "km", "bruk", "import", "skade", "pant", "km og skade"];

  it("gir samme tekst som sist for hver kategori", async () => {
    const ut = samle({ saker: Object.keys(SAKER), krav: ["prisavslag", "heving"] as const }, (v) => tekst(krav(lagSak("etter_2024", { krav: v.krav, feil: SAKER[v.saker] }))));
    await expect(ut).toMatchFileSnapshot(snapshot("krav-retting"));
  });

  it("utelates bare når ingen av feilene kan rettes", () => {
    for (const [navn, fs] of Object.entries(SAKER))
      for (const k of ["prisavslag", "heving"] as const) {
        // A symptom alone cannot be met with a reduction or cancellation: the form stops it.
        for (const s of gyldig(() => lagSak("etter_2024", { krav: k, feil: fs }))) expect(tekst(krav(s)).includes(RETTING), `${navn} ${k}`).toBe(!UTEN_TILBUD.includes(navn));
      }
  });
});
