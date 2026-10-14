// The corrections after the full runs of the form (2026-10-14): the letter is the complaint and says
// so, the earlier complaint covers only the defects discovered before it, what the seller said about a
// technical defect, the reduction with estimates for some defects, and the documents named.
import { describe, expect, it } from "vitest";
import { byggBrev, somTekst } from "./brev";
import { vurderRiktighet } from "./riktighet";
import { feil, kontakt, lagSak, RAPPORT } from "./testsak";
import { vedlegg } from "./vedlegg";
import type { Brevfeil, Brevsak } from "./typer";

const brev = (s: Brevsak) => somTekst(byggBrev(s));
// The purchase in 2024 (etter_2024: 2024-03-10) and a letter dated 2026-10-13 (testsak.ts BASE).
const turbo = (oppdaget: string, endring: Partial<Brevfeil> = {}): Brevfeil => ({ ...feil("motor", ["turbo"], "innen_6_mnd", "nei", "nei"), oppdaget, ...endring });
const lys = (oppdaget: string, endring: Partial<Brevfeil> = {}): Brevfeil => ({ ...feil("elektrisk", ["lys"], "innen_6_mnd", "nei", "nei"), oppdaget, ...endring });

describe("brevet er reklamasjonen når kjøperen ikke har reklamert før", () => {
  it("sier at det reklameres, med mangel i entall og flertall", () => {
    expect(brev(lagSak("etter_2024", { kontakt: null, feil: [turbo("2026-09-01")] }))).toContain("Jeg reklamerer herved på følgende mangel.");
    expect(brev(lagSak("etter_2024", { kontakt: null, feil: [turbo("2026-09-01"), lys("2026-09-02")] }))).toContain("Jeg reklamerer herved på følgende mangler.");
  });

  it("kaller ikke et symptom uten kjent årsak en mangel", () => {
    const t = brev(lagSak("etter_2024", { kontakt: null, krav: "retting", feil: [{ ...feil("vet_ikke", ["varsellampe"], "innen_6_mnd", "nei", "nei"), oppdaget: "2026-09-01" }] }));
    expect(t).toContain("Jeg reklamerer herved på følgende feil.");
    expect(t).not.toContain("jeg reklamerer herved på denne");
  });

  it("sier ikke at det reklameres når kjøperen har reklamert før", () => {
    expect(brev(lagSak("etter_2024", { kontakt: kontakt("etter_2024", { dato: "2026-09-10" }), feil: [turbo("2026-09-01")] }))).not.toContain("Jeg reklamerer herved");
  });
});

describe("rimelig tid (§ 27 første ledd)", () => {
  const SETNING = "Reklamasjonen er fremsatt innen to måneder etter at feilen ble oppdaget, og dermed innen rimelig tid, jf. § 27 første ledd.";

  it("står når brevet kommer innen to måneder etter oppdagelsen", () => {
    expect(brev(lagSak("etter_2024", { kontakt: null, feil: [turbo("2026-08-13")] }))).toContain(SETNING);
    expect(brev(lagSak("etter_2024", { kontakt: null, feil: [turbo("2026-08-12")] }))).not.toContain("dermed innen rimelig tid");
  });

  it("regnes fra den tidligere reklamasjonen for feilene den omfattet", () => {
    expect(brev(lagSak("etter_2024", { kontakt: kontakt("etter_2024", { dato: "2025-01-15" }), feil: [turbo("2025-01-01")] }))).toContain(SETNING);
    expect(brev(lagSak("etter_2024", { kontakt: kontakt("etter_2024", { dato: "2025-06-15" }), feil: [turbo("2025-01-01")] }))).not.toContain("dermed innen rimelig tid");
  });

  it("regner en omtrentlig dato fra den første i måneden", () => {
    // «i august 2026»: the 31st would be within two months of 13 October, the 1st is not.
    expect(brev(lagSak("etter_2024", { kontakt: null, feil: [turbo("2026-08-31", { omtrentlig: true })] }))).not.toContain("dermed innen rimelig tid");
    expect(brev(lagSak("etter_2024", { kontakt: null, feil: [turbo("2026-08-31")] }))).toContain(SETNING);
  });

  it("sier hvilke feil den gjelder når ikke alle er i tide", () => {
    expect(brev(lagSak("etter_2024", { kontakt: null, feil: [turbo("2026-09-01"), lys("2026-01-01")] }))).toContain("For turbo: Reklamasjonen er fremsatt innen to måneder etter at feilen ble oppdaget");
  });
});

describe("en feil oppdaget etter reklamasjonen", () => {
  const s = lagSak("etter_2024", {
    kontakt: kontakt("etter_2024", { dato: "2025-03-14", forsok: 2, svar: "forsokt" }),
    krav: "heving",
    feil: [turbo("2025-02-01"), lys("2026-08-14")],
  });

  it("var ikke med i reklamasjonen, og reklameres i brevet", () => {
    const t = brev(s);
    expect(t).toContain("Jeg reklamerte skriftlig til dere den 14. mars 2025 på turbo.");
    expect(t).toContain("Lys reklameres herved.");
  });

  it("er ikke med i rettingsforsøkene eller hevingsgrunnen", () => {
    const t = brev(s);
    expect(t).toContain("Dere har forsøkt å rette turbo to ganger uten at det har lykkes.");
    expect(t).not.toContain("rette feilene");
    expect(t).toContain("og dere har ikke lykkes med å rette turbo etter to forsøk.");
  });

  it("kan selger fortsatt tilby å rette", () => {
    expect(brev({ ...s, krav: "prisavslag" })).toContain("Dersom dere ønsker å rette lys selv, ber jeg om beskjed innen fristen under.");
  });

  it("nevner ikke feilene i reklamasjonssetningen når alle var med", () => {
    expect(brev({ ...s, feil: [turbo("2025-02-01")] })).toContain("Jeg reklamerte skriftlig til dere den 14. mars 2025.");
  });
});

describe("hva selger sa om en teknisk feil", () => {
  const sak = (somDenEr: Brevsak["somDenEr"], opplysning: Brevfeil["opplysning"], opplyst: Brevfeil["opplyst"], lov: "før_2024" | "etter_2024" = "etter_2024") =>
    lagSak(lov, { somDenEr, kontakt: null, feil: [{ ...feil("motor", ["turbo"], "innen_6_mnd", opplysning, "nei"), opplyst }] });

  it("«i orden» gir § 16 c, opplysningen i bakgrunnen og annonsen som vedlegg bare når den er skriftlig", () => {
    for (const form of ["skriftlig", "muntlig"] as const) {
      const s = sak("nei", form, "i_orden");
      const t = brev(s);
      expect(t).toContain(`Før kjøpet opplyste dere ${form} at turbo var i orden eller nylig utbedret.`);
      expect(t).toContain("Bilen svarer ikke til de opplysningene dere ga om turbo, og har en mangel etter forbrukerkjøpsloven § 16 første ledd bokstav c.");
      expect(vedlegg(s).map((v) => v.tekst).includes("Annonse/kjøpekontrakt"), form).toBe(form === "skriftlig");
    }
  });

  it("«opplyste om feilen» gir advarselen og verken § 16 c eller annonsen", () => {
    const s = sak("nei", "skriftlig", "feilen");
    const t = brev(s);
    expect(t).not.toContain("bokstav c");
    expect(t).not.toContain("Annonse/kjøpekontrakt");
    const r = vurderRiktighet({ kjopsdato: s.kjopsdato, kjopesum: s.kjopesum, forsteRegistrert: null, somDenEr: "nei", krav: s.krav, forsok: 0, svar: null, feil: s.feil.map((f) => ({ ...f, konklusjon: null })), utlegg: [], selger: null });
    expect(r.advarsler.map((m) => m.regel)).toContain("som_den_er_opplyst");
  });

  it("«i orden» gir ikke advarselen om at feilen kan være unntatt", () => {
    const s = sak("nei", "skriftlig", "i_orden");
    const r = vurderRiktighet({ kjopsdato: s.kjopsdato, kjopesum: s.kjopesum, forsteRegistrert: null, somDenEr: "nei", krav: s.krav, forsok: 0, svar: null, feil: s.feil.map((f) => ({ ...f, konklusjon: null })), utlegg: [], selger: null });
    expect(r.advarsler.map((m) => m.regel)).not.toContain("som_den_er_opplyst");
  });

  it("motbeviset mot «som den er» gis for feilene selger ikke opplyste om", () => {
    const FORBEHOLD = "er ikke et avtalt unntak etter";
    expect(brev(sak("ja", "nei", null))).toContain(FORBEHOLD);
    expect(brev(sak("ja", "skriftlig", "i_orden"))).toContain(FORBEHOLD);
    expect(brev(sak("ja", "skriftlig", "feilen"))).not.toContain(FORBEHOLD);
    const blandet = lagSak("etter_2024", { somDenEr: "ja", kontakt: null, feil: [turbo("2026-09-01"), lys("2026-09-02", { opplysning: "muntlig", opplyst: "feilen" })] });
    expect(brev(blandet)).toContain("For turbo: Forbeholdet om at bilen ble solgt «som den er», er ikke et avtalt unntak");
  });

  it("før 2024 vurderes «som den er» etter § 17 uansett hva selger sa", () => {
    for (const [opplysning, opplyst] of [["nei", null], ["skriftlig", "i_orden"], ["skriftlig", "feilen"]] as const)
      expect(brev(sak("ja", opplysning, opplyst, "før_2024")), `${opplysning} ${opplyst}`).toContain("Selv om bilen ble solgt «som den er»");
  });
});

describe("prisavslag når bare noen feil har overslag", () => {
  const medOverslag = { ...RAPPORT, punkter: [...RAPPORT.punkter, "overslag" as const], overslag: 38_500 };
  const s = lagSak("etter_2024", {
    kontakt: null,
    krav: "prisavslag",
    feil: [turbo("2026-09-01", { verksted: "skriftlig", rapport: { ...medOverslag, dato: "2026-09-10" } }), lys("2026-09-02")],
  });

  it("krever overslaget som minst og resten når det er dokumentert", () => {
    const t = brev(s);
    expect(t).toContain("På dette grunnlaget krever jeg prisavslag, jf. § 31. Prisavslaget skal minst tilsvare utbedringskostnaden for turbo, kr 38 500 ifølge verkstedets overslag. For lys fastsettes prisavslaget når utbedringskostnaden er dokumentert.");
    expect(t).not.toContain("tilsvarende utbedringskostnaden");
  });

  it("advarer i skjemaet", () => {
    const r = vurderRiktighet({ kjopsdato: s.kjopsdato, kjopesum: s.kjopesum, forsteRegistrert: null, somDenEr: "nei", krav: "prisavslag", forsok: 0, svar: null, feil: s.feil.map((f) => ({ ...f, konklusjon: null })), utlegg: [], selger: null });
    expect(r.advarsler.find((m) => m.regel === "prisavslag_delvis_overslag")?.melding).toBe("Kostnadsoverslag mangler for lys. Brevet krever prisavslag for den uten beløp.");
  });

  it("er uendret når alle feil har overslag", () => {
    const alle = { ...s, feil: s.feil.map((f) => ({ ...f, verksted: "skriftlig" as const, rapport: { ...medOverslag, dato: "2026-09-10", overslag: 10_000 } })) };
    expect(brev(alle)).toContain("tilsvarende utbedringskostnaden på kr 20 000 ifølge verkstedets overslag");
  });
});

describe("dokumentene som vedlegges", () => {
  it("nevnes med navn, ikke som «Dokumentasjon»", () => {
    const t = brev(lagSak("etter_2024", { kontakt: null, feil: [{ ...feil("historikk", ["km"], "innen_6_mnd", "skriftlig", "muntlig"), oppdaget: "2026-09-01" }] }));
    expect(t).toContain("Feilen er undersøkt av verksted. Utskrift fra Statens vegvesen vedlegges.");
    expect(t).not.toContain("Dokumentasjon vedlegges");
  });

  it("legger ikke ved et servicehefte som mangler", () => {
    const s = lagSak("etter_2024", { kontakt: null, feil: [{ ...feil("service", ["servicehefte"], "innen_6_mnd", "muntlig", "nei"), oppdaget: "2026-09-01" }] });
    expect(vedlegg(s).map((v) => v.tekst)).not.toContain("Servicehefte");
    expect(brev(s)).not.toContain("Servicehefte vedlegges");
  });
});
