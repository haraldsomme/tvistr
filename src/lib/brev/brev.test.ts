import { describe, expect, it } from "vitest";
import type { KlageInput } from "@/lib/vurdering/typer";
import { byggBrev, type Brev } from "./brev";
import type { Utfylling } from "./utfylling";

const IDAG = "2026-10-02";

// Purchased March 2026, defect inside six months, dealer not contacted, no evidence.
const grunn = (): KlageInput => ({
  bilOgKjop: { kjopsdato: "2026-03-12", kjopesumNok: 250000, kmVedKjop: 80000 },
  feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "nei" },
  bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: false },
});

const tekst = (b: Brev) => b.avsnitt.join("\n");

// The contact answer of the assessment is yes or no; what the dealer did is filled in on the letter page.
type Forhold = "nei" | "venter" | "avvist" | "forsokt";
const forhold = (i: KlageInput, f: Forhold): Utfylling => {
  i.feilen.kontakt = f === "nei" ? "nei" : "ja";
  return f === "nei" ? {} : { retting: f };
};
const brevFor = (f: Forhold, u: Utfylling = {}, idag = IDAG) => {
  const i = grunn();
  return byggBrev(i, idag, { ...forhold(i, f), ...u });
};

describe("byggBrev", () => {
  it("setter dato og svarfrist 14 dager frem, også over månedsskifte", () => {
    const b = byggBrev(grunn(), "2026-10-20");
    expect(b.stedDato).toBe("[Sted], 20. oktober 2026");
    expect(tekst(b)).toContain("innen 3. november 2026");
  });

  it("nevner kjøpet med måned, år og beløp med tusenskille", () => {
    const t = tekst(byggBrev(grunn(), IDAG));
    expect(t).toContain("12. mars 2026");
    expect(t).toContain("250 000 kr");
  });

  it("bruker plassholder når kjøpesummen mangler", () => {
    const i = grunn();
    i.bilOgKjop.kjopesumNok = null;
    expect(tekst(byggBrev(i, IDAG))).toContain("[kjøpesum]");
  });

  it("lister flere feiltyper i løpende tekst", () => {
    const i = grunn();
    i.feilen.typer = ["motor", "bremser", "rust"];
    expect(tekst(byggBrev(i, IDAG))).toContain("feil ved motoren, bremsene og rust");
  });

  it("sier bare «en feil» når kun «annet» er valgt", () => {
    const i = grunn();
    i.feilen.typer = ["annet"];
    const t = tekst(byggBrev(i, IDAG));
    expect(t).toContain("Bilen har en feil.");
    expect(t).not.toContain("feil ved");
  });

  describe("bevisbyrde (§ 18)", () => {
    it("viser til § 18 innenfor presumsjonsperioden, med to år for kjøp fra 2024", () => {
      const t = tekst(byggBrev(grunn(), IDAG));
      expect(t).toContain("§ 18");
      expect(t).toContain("innen seks måneder etter levering");
      expect(t).toContain("antas å ha eksistert ved leveringen");
      expect(t).toContain("innen to år");
    });

    it("bruker seks måneder som periode for kjøp før 2024", () => {
      const i = grunn();
      i.bilOgKjop.kjopsdato = "2023-05-31";
      expect(tekst(byggBrev(i, IDAG))).toMatch(/§ 18 at en mangel som viser seg innen seks måneder/);
    });

    it("utelater § 18 utenfor presumsjonsperioden", () => {
      const i = grunn();
      i.feilen.oppdaget = "over_2_ar";
      const t = tekst(byggBrev(i, IDAG));
      expect(t).not.toContain("§ 18");
      expect(t).toContain("mer enn to år etter levering");
    });

    it("en rapport som sier feilen var der før kjøpet støtter presumsjonen innenfor perioden", () => {
      const i = grunn();
      i.bevis = { verkstedrapport: true, rapportSierForKjop: true, bilder: false };
      const t = tekst(byggBrev(i, IDAG));
      expect(t).toContain("støtter også at feilen var der allerede da jeg overtok bilen");
      expect(t).not.toContain("§ 18 første ledd");
    });

    it("en rapport er beviset etter § 18 første ledd utenfor presumsjonsperioden", () => {
      const i = grunn();
      i.feilen.oppdaget = "over_2_ar";
      i.bevis = { verkstedrapport: true, rapportSierForKjop: true, bilder: false };
      expect(tekst(byggBrev(i, IDAG))).toContain("sannsynligvis var til stede før jeg overtok bilen, jf. § 18 første ledd");
    });

    it("ingen rapportsetning uten rapport, eller når den ikke sier noe om tidspunktet", () => {
      expect(tekst(byggBrev(grunn(), IDAG))).not.toContain("verksted- eller tilstandsrapport");
      const i = grunn();
      i.bevis = { verkstedrapport: true, rapportSierForKjop: false, bilder: false };
      expect(tekst(byggBrev(i, IDAG))).not.toContain("verksted- eller tilstandsrapport sier");
    });
  });

  describe("femårsfristen", () => {
    it("sier at fristen er overholdt når det er reklamert innen fem år, men mer enn fem år er gått", () => {
      const i = grunn();
      i.bilOgKjop.kjopsdato = "2020-01-01";
      i.feilen.kontakt = "ja";
      i.feilen.reklamertInnenFemAr = true;
      const t = tekst(byggBrev(i, IDAG, { retting: "avvist" }));
      expect(t).toContain("Det er mer enn fem år siden jeg overtok bilen, men jeg tok dette opp med dere innen fem år, slik at fristen i § 27 andre ledd er overholdt.");
    });

    it("ingen slik setning innenfor fem år, eller når fristen er ute", () => {
      expect(tekst(byggBrev(grunn(), IDAG))).not.toContain("er overholdt");
      const i = grunn();
      i.bilOgKjop.kjopsdato = "2020-01-01";
      i.feilen.kontakt = "nei";
      expect(tekst(byggBrev(i, IDAG))).not.toContain("er overholdt");
    });
  });

  it("sier at feilen ikke ble opplyst bare når svaret er nei", () => {
    expect(tekst(byggBrev(grunn(), IDAG))).toContain("Jeg ble heller ikke opplyst om feilen før kjøpet.");
    const i = grunn();
    i.feilen.opplystForKjop = "ja";
    expect(tekst(byggBrev(i, IDAG))).not.toContain("ikke opplyst");
  });

  describe("krav følger kontakten med forhandleren", () => {
    it.each(["nei", "venter"] as const)("%s: krever retting (§ 29, § 30) med forbehold om §§ 31–33", (kontakt) => {
      const t = tekst(brevFor(kontakt));
      expect(t).toContain("§ 27");
      expect(t).toContain("jf. § 29 og § 30");
      expect(t).toContain("§ 31 og § 32");
      expect(t).toContain("§ 33");
      expect(t).not.toContain("[prisavslag / heving av kjøpet]");
    });

    it.each(["avvist", "forsokt"] as const)("%s: krever prisavslag eller heving (§ 31, § 32), ikke retting", (kontakt) => {
      const t = tekst(brevFor(kontakt));
      expect(t).toContain("§ 27");
      expect(t).toContain("[prisavslag / heving av kjøpet]");
      expect(t).toContain("jf. § 31 og § 32");
      expect(t).toContain("§ 33");
      expect(t).not.toContain("§ 29");
    });

    it("beskriver hva forhandleren har gjort", () => {
      expect(tekst(brevFor("avvist"))).toContain("avvist å rette");
      expect(tekst(brevFor("forsokt"))).toContain("forsøkt å rette feilen uten å lykkes");
    });
  });

  describe("vedlegg", () => {
    it("nevner bare kjøpekontrakt uten rapport og bilder", () => {
      const t = tekst(byggBrev(grunn(), IDAG));
      expect(t).toContain("Vedlagt følger kjøpekontrakt.");
      expect(t).not.toContain("verkstedrapport");
      expect(t).not.toContain("bilder");
    });

    it("nevner verkstedrapport når den finnes", () => {
      const i = grunn();
      i.bevis = { verkstedrapport: true, rapportSierForKjop: true, bilder: false };
      expect(tekst(byggBrev(i, IDAG))).toContain("Vedlagt følger kjøpekontrakt og verkstedrapport.");
    });

    it("nevner bilder når det ikke finnes rapport", () => {
      const i = grunn();
      i.bevis = { verkstedrapport: false, rapportSierForKjop: null, bilder: true };
      expect(tekst(byggBrev(i, IDAG))).toContain("Vedlagt følger kjøpekontrakt og bilder av feilen.");
    });
  });

  it("har plassholdere for det skjemaet ikke samler, alle i hakeparentes", () => {
    const b = byggBrev(grunn(), IDAG);
    expect(b.avsender).toContain("[Ditt navn]");
    expect(b.mottaker).toContain("[Forhandlerens navn]");
    expect(b.emne).toContain("[merke og modell]");
    expect(b.emne).toContain("[reg.nr.]");
    expect(tekst(b)).toContain("[Beskriv feilen");
    expect(b.underskrift).toBe("[Ditt navn]");
  });

  describe("kjøretøy fra oppslaget", () => {
    const bil = { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2019 };

    it("fyller emnet med merke, modell, år og reg.nr.", () => {
      const b = byggBrev(grunn(), IDAG, { kjoretoy: bil });
      expect(b.emne).toBe("Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999");
    });

    it("utelater året når det er ukjent", () => {
      expect(byggBrev(grunn(), IDAG, { kjoretoy: { ...bil, ar: null } }).emne).toBe("Reklamasjon på mangel – Testmerke Modell X, reg.nr. ZZ 99999");
    });

    it("har plassholdere uten kjøretøy", () => {
      const b = byggBrev(grunn(), IDAG);
      expect(b.emne).toContain("[reg.nr.]");
    });
  });

  describe("forhandler", () => {
    it("setter Brreg-forhandleren som mottaker med org.nr.", () => {
      const b = byggBrev(grunn(), IDAG, { forhandler: { type: "brreg", orgnr: "999888777", navn: "Testbil AS" } });
      expect(b.mottaker).toEqual(["Testbil AS", "Org.nr. 999 888 777", "[Forhandlerens adresse]", "[Postnummer og sted]"]);
    });

    it("setter adressen fra Brreg som postadresse i mottakeren", () => {
      const adresse = { linjer: ["Industriveien 3"], postnummer: "0184", poststed: "Oslo" };
      const b = byggBrev(grunn(), IDAG, { forhandler: { type: "brreg", orgnr: "999888777", navn: "Testbil AS", adresse } });
      expect(b.mottaker).toEqual(["Testbil AS", "Org.nr. 999 888 777", "Industriveien 3", "0184 Oslo"]);
      expect(b.mottaker.join()).not.toContain("[");
    });

    it("setter forhandler skrevet av kjøperen som mottaker, uten org.nr.", () => {
      const b = byggBrev(grunn(), IDAG, { forhandler: { type: "fritekst", navn: " Bilsalget " } });
      expect(b.mottaker).toEqual(["Bilsalget", "[Forhandlerens adresse]", "[Postnummer og sted]"]);
    });

    it("beholder plassholderen uten forhandler", () => {
      expect(byggBrev(grunn(), IDAG).mottaker[0]).toBe("[Forhandlerens navn]");
    });
  });

  it("skriver kjøpsdagen og kjøpesummen", () => {
    expect(tekst(byggBrev(grunn(), IDAG))).toContain("fra dere 12. mars 2026 for 250 000 kr");
  });

  describe("beskrivelsen av feilen", () => {
    const feilen = { dato: "2026-09-02", egen: "motorlampa lyser og bilen mister kraft", feil: [], avsnitt: ["Motorlampen lyser, og bilen mister trekkraft i motbakker"] };

    it("erstatter plassholderen med datoen og den godkjente teksten", () => {
      const b = byggBrev(grunn(), IDAG, { feilen });
      expect(b.avsnitt[0]).toBe(
        "Jeg viser til kjøp av ovennevnte bil fra dere 12. mars 2026 for 250 000 kr. Feilen viste seg første gang 2. september 2026. Motorlampen lyser, og bilen mister trekkraft i motbakker.",
      );
      expect(tekst(b)).not.toContain("[Beskriv feilen");
      expect(tekst(b)).not.toContain("motorlampa");
    });

    it("setter ikke to punktum når teksten alt slutter med ett", () => {
      expect(byggBrev(grunn(), IDAG, { feilen: { ...feilen, avsnitt: ["Motoren stopper."] } }).avsnitt[0]).toMatch(/Motoren stopper\.$/);
    });

    it("deler beskrivelsen i avsnitt og skriver «Den første feilen» ved flere feil", () => {
      const b = byggBrev(grunn(), IDAG, { feilen: { ...feilen, feil: ["Motoren", "Rust"], avsnitt: ["Motorlampen lyser", "Det er rust på bakskjermen."] } });
      expect(b.avsnitt[0]).toMatch(/Den første feilen viste seg 2\. september 2026\. Motorlampen lyser\.$/);
      expect(b.avsnitt[1]).toBe("Det er rust på bakskjermen.");
    });
  });

  describe("uriktige opplysninger før kjøpet", () => {
    const medFeilopplysning = () => {
      const i = grunn();
      i.feilen.feilOpplysning = "ja_dokumentert";
      return i;
    };

    it("ber om opplysningen når brukeren har svart ja, men ikke fylt den inn", () => {
      expect(tekst(byggBrev(medFeilopplysning(), IDAG))).toContain("[Skriv hva annonsen eller selgeren opplyste som ikke stemte.]");
      expect(tekst(byggBrev(grunn(), IDAG))).not.toContain("annonsen eller selgeren");
    });

    it("siterer opplysningen med kilden og viser til § 16", () => {
      const t = tekst(byggBrev(medFeilopplysning(), IDAG, { opplysning: { kilde: "annonse", tekst: "Bilen har ny clutch." } }));
      expect(t).toContain("I annonsen ble det opplyst følgende om bilen: «Bilen har ny clutch». Dette stemmer ikke, og bilen svarer dermed ikke til opplysningene dere har gitt, jf. § 16.");
    });

    it.each([
      ["kontrakt", "I kjøpekontrakten ble det opplyst"],
      ["melding", "I en melding fra dere ble det opplyst"],
      ["muntlig", "Muntlig før kjøpet ble det opplyst"],
    ] as const)("kilde %s", (kilde, start) => {
      expect(tekst(byggBrev(medFeilopplysning(), IDAG, { opplysning: { kilde, tekst: "Ny clutch" } }))).toContain(start);
    });

    it("tar ikke med en opplysning når svaret fra vurderingen er nei", () => {
      expect(tekst(byggBrev(grunn(), IDAG, { opplysning: { kilde: "annonse", tekst: "Ny clutch" } }))).not.toContain("Ny clutch");
    });
  });

  describe("tidligere reklamasjon", () => {
    it("venter: nevner når og hvordan feilen ble tatt opp, og krever fortsatt retting", () => {
      const t = tekst(brevFor("venter", { reklamasjon: { dato: "2026-09-03", mate: "epost" } }));
      expect(t).toContain("Jeg tok opp feilen med dere første gang 3. september 2026 på e-post.");
      expect(t).toContain("jf. § 29 og § 30");
    });

    it("avvist: sier at forhandleren avviste", () => {
      const t = tekst(brevFor("avvist", { reklamasjon: { dato: "2026-09-03", mate: "oppmote" } }));
      expect(t).toContain("Jeg tok opp feilen med dere første gang 3. september 2026 ved oppmøte hos dere, men dere har avvist å rette den.");
    });

    it("forsøkt rettet: sier hvor mange ganger", () => {
      const r = { dato: "2026-09-03", mate: "telefon" as const };
      expect(tekst(brevFor("forsokt", { reklamasjon: { ...r, forsok: 1 } }))).toContain("Dere har forsøkt å rette feilen én gang uten å lykkes.");
      expect(tekst(brevFor("forsokt", { reklamasjon: { ...r, forsok: 3 } }))).toContain("Dere har forsøkt å rette feilen tre ganger uten å lykkes.");
      expect(tekst(brevFor("forsokt", { reklamasjon: r }))).toContain("Dere har forsøkt å rette feilen uten å lykkes.");
    });

    it("tas ikke med når forhandleren ikke er kontaktet", () => {
      expect(tekst(byggBrev(grunn(), IDAG, { reklamasjon: { dato: "2026-09-03", mate: "epost" } }))).not.toContain("tok opp feilen");
    });
  });

  describe("kravet", () => {
    it("prisavslag med kjent utbedringskostnad krever beløpet", () => {
      const t = tekst(brevFor("avvist", { krav: { type: "prisavslag", utbedringNok: 38000, utgifter: [] } }));
      expect(t).toContain("krever prisavslag på 38 000 kr, som tilsvarer kostnaden ved å få mangelen rettet, jf. § 31.");
      expect(t).not.toContain("[prisavslag / heving av kjøpet]");
      expect(t).not.toContain("§ 29");
    });

    it("prisavslag uten kjent kostnad krever et forholdsmessig prisavslag", () => {
      expect(tekst(brevFor("avvist", { krav: { type: "prisavslag", utgifter: [] } }))).toContain("krever et forholdsmessig prisavslag, jf. § 31.");
    });

    it("heving krever kjøpesummen tilbake mot at bilen leveres tilbake", () => {
      const t = tekst(brevFor("avvist", { krav: { type: "heving", utgifter: [] } }));
      expect(t).toContain("hever kjøpet, jf. § 32, og krever kjøpesummen på 250 000 kr tilbakebetalt mot at bilen leveres tilbake.");
    });

    it("valget brukes ikke når forhandleren ennå kan rette", () => {
      const t = tekst(byggBrev(grunn(), IDAG, { krav: { type: "heving", utgifter: [] } }));
      expect(t).toContain("jf. § 29 og § 30");
      expect(t).not.toContain("hever kjøpet");
    });

    it("utgifter kreves erstattet med poster og sum", () => {
      const krav = { utgifter: [{ type: "verksted" as const, belopNok: 4500 }, { type: "tauing" as const, belopNok: 2000 }] };
      const t = tekst(byggBrev(grunn(), IDAG, { krav }));
      expect(t).toContain("I tillegg krever jeg erstatning for utgiftene mangelen har påført meg, jf. § 33: verksted og feilsøking 4 500 kr og tauing 2 000 kr, til sammen 6 500 kr.");
      expect(t).toContain("samt ytterligere erstatning etter § 33");
    });

    it("én utgift står uten sum, og etter avvisning forbeholdes ytterligere tap", () => {
      const t = tekst(brevFor("avvist", { krav: { type: "prisavslag", utgifter: [{ type: "leiebil", belopNok: 3000 }] } }));
      expect(t).toContain("jf. § 33: leiebil 3 000 kr.");
      expect(t).not.toContain("til sammen");
      expect(t).toContain("Jeg forbeholder meg retten til å kreve erstatning for ytterligere tap.");
    });
  });

  describe("vedlegg valgt av brukeren", () => {
    it("lister de valgte vedleggene", () => {
      const t = tekst(byggBrev(grunn(), IDAG, { vedlegg: ["kjopekontrakt", "verkstedrapport", "annonse", "meldinger", "kvitteringer"] }));
      expect(t).toContain("Vedlagt følger kjøpekontrakt, verkstedrapport, annonsen, meldinger mellom oss og kvitteringer.");
    });

    it("utelater avsnittet når ingenting legges ved", () => {
      const b = byggBrev(grunn(), IDAG, { vedlegg: [] });
      expect(tekst(b)).not.toContain("Vedlagt");
      // Five paragraphs plus the paragraph on wear and the decision the letter cites.
      expect(b.avsnitt).toHaveLength(7);
    });
  });

  describe("avsender", () => {
    const avsender = { navn: "Test Testesen", adresse: "Testveien 1", postnummer: "0184", poststed: "Oslo" };

    it("fyller avsender, sted og underskrift", () => {
      const b = byggBrev(grunn(), IDAG, { avsender });
      expect(b.avsender).toEqual(["Test Testesen", "Testveien 1", "0184 Oslo"]);
      expect(b.stedDato).toBe("Oslo, 2. oktober 2026");
      expect(b.underskrift).toBe("Test Testesen");
    });

    it("tar med telefon når den er oppgitt", () => {
      expect(byggBrev(grunn(), IDAG, { avsender: { ...avsender, telefon: "400 00 000" } }).avsender).toEqual(["Test Testesen", "Testveien 1", "0184 Oslo", "Tlf. 400 00 000"]);
    });
  });

  it("har ingen hakeparenteser når alt er fylt inn", () => {
    const i = grunn();
    i.feilen.feilOpplysning = "ja_dokumentert";
    const b = byggBrev(i, IDAG, {
      ...forhold(i, "forsokt"),
      kjoretoy: { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2019 },
      forhandler: { type: "brreg", orgnr: "999888777", navn: "Testbil AS", adresse: { linjer: ["Industriveien 3"], postnummer: "0184", poststed: "Oslo" } },
      feilen: { dato: "2026-09-02", egen: "Motorlampen lyser og bilen mister kraft.", feil: [], avsnitt: ["Motorlampen lyser, og bilen mister trekkraft."] },
      opplysning: { kilde: "annonse", tekst: "Ny clutch" },
      reklamasjon: { dato: "2026-09-03", mate: "epost", forsok: 2 },
      krav: { type: "heving", utgifter: [{ type: "verksted", belopNok: 4500 }] },
      vedlegg: ["kjopekontrakt", "verkstedrapport"],
      avsender: { navn: "Test Testesen", adresse: "Testveien 1", postnummer: "0184", poststed: "Oslo" },
    });
    const alt = [...b.avsender, ...b.mottaker, b.stedDato, b.emne, ...b.avsnitt, b.hilsen, b.underskrift].join("\n");
    expect(alt).not.toMatch(/[\[\]]/);
    expect(alt).not.toMatch(/undefined|null|NaN/);
  });

  it("lekker ikke undefined, null eller tomme avsnitt", () => {
    for (const kontakt of ["nei", "venter", "avvist", "forsokt"] as const) {
      for (const oppdaget of ["innen_6_mnd", "6_mnd_til_2_ar", "over_2_ar"] as const) {
        const i = grunn();
        i.feilen.oppdaget = oppdaget;
        const b = byggBrev(i, IDAG, forhold(i, kontakt));
        const alt = [...b.avsender, ...b.mottaker, b.stedDato, b.emne, ...b.avsnitt, b.hilsen, b.underskrift];
        for (const del of alt) {
          expect(del.trim()).not.toBe("");
          expect(del).not.toMatch(/undefined|null|NaN/);
        }
      }
    }
  });
});
