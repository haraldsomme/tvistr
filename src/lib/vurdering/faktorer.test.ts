import { describe, expect, it } from "vitest";
import klager from "./testdata/klager.json";
import { beregnFaktorer, dagerMellom, leggTilManeder } from "./faktorer";
import type { KlageInput, TestKlage } from "./typer";

const IDAG = "2026-10-01";
const testklager = klager as TestKlage[];
const hent = (id: number): KlageInput => structuredClone(testklager.find((k) => k.id === id)!.input);
const fakta = (i: KlageInput, tolkning: Parameters<typeof beregnFaktorer>[1] = null) => beregnFaktorer(i, tolkning, IDAG);

describe("testdata", () => {
  it("har 10 klager med unike id-er", () => {
    expect(testklager).toHaveLength(10);
    expect(new Set(testklager.map((k) => k.id)).size).toBe(10);
  });
});

describe("datoer", () => {
  it("teller kalenderdager", () => {
    expect(dagerMellom("2026-01-01", "2026-01-31")).toBe(30);
    expect(dagerMellom("2026-03-01", "2026-03-01")).toBe(0);
  });

  it("legger til måneder", () => {
    expect(leggTilManeder("2024-03-15", 24)).toBe("2026-03-15");
    expect(leggTilManeder("2023-06-15", 6)).toBe("2023-12-15");
  });
});

describe("presumsjon (fkjl § 18)", () => {
  it("to år for kjøp fra 2024", () => {
    const i = hent(4); // kjøpt 2025-07-01
    i.feilen.oppdagetDato = "2027-06-30";
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 24, presumsjon: true });
    i.feilen.oppdagetDato = "2027-07-02";
    expect(fakta(i).presumsjon).toBe(false);
  });

  it("seks måneder for kjøp før 2024", () => {
    const i = hent(6); // kjøpt 2023-06-15, oppdaget 2025-12-01
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 6, presumsjon: false });
    i.feilen.oppdagetDato = "2023-12-14";
    expect(fakta(i).presumsjon).toBe(true);
  });

  it("grensen går på kjøpsdato", () => {
    const i = hent(1);
    i.bilOgKjop.kjopsdato = "2023-12-31";
    i.feilen.oppdagetDato = "2024-08-01";
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 6, presumsjon: false });
    i.bilOgKjop.kjopsdato = "2024-01-01";
    expect(fakta(i)).toMatchObject({ presumsjonManeder: 24, presumsjon: true });
  });
});

describe("femårsfristen (fkjl § 27)", () => {
  it("er ute når det har gått mer enn fem år og forhandleren ikke er kontaktet", () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2021-09-30";
    i.feilen.oppdagetDato = "2021-12-01";
    expect(fakta(i).fristUte).toBe(true);
    i.bilOgKjop.kjopsdato = "2021-10-01";
    expect(fakta(i).fristUte).toBe(false);
  });

  it("gjelder ikke når forhandleren allerede er kontaktet, siden vi ikke vet når", () => {
    const i = hent(4);
    i.bilOgKjop.kjopsdato = "2020-01-01";
    i.feilen.oppdagetDato = "2020-03-01";
    i.feilen.kontakt = "venter";
    expect(fakta(i).fristUte).toBe(false);
  });
});

describe("beregnFaktorer", () => {
  it("reklamasjonsbøtten måles fra kjøp til oppdaget", () => {
    expect(fakta(hent(1)).reklamasjonsbotte).toBe("rask"); // 21 dager
    expect(fakta(hent(4)).reklamasjonsbotte).toBe("middels"); // 431 dager
    expect(fakta(hent(6)).reklamasjonsbotte).toBe("sen"); // 900 dager
  });

  it("å ikke ha kontaktet forhandleren endrer ingen fakta utenom femårsfristen", () => {
    const venter = hent(4);
    venter.feilen.kontakt = "venter";
    const a = fakta(hent(4));
    const b = fakta(venter);
    expect({ ...a, kontakt: null }).toEqual({ ...b, kontakt: null });
  });

  it("oversetter kontakt til rettingsstatus", () => {
    const i = hent(1);
    const status = (k: KlageInput["feilen"]["kontakt"]) => {
      i.feilen.kontakt = k;
      return fakta(i).forhandlerRetting;
    };
    expect(status("nei")).toBe("ikke_spurt");
    expect(status("venter")).toBe("ikke_spurt");
    expect(status("avvist")).toBe("avvist");
    expect(status("forsokt")).toBe("forsokt");
  });

  it("slår sammen knappevalg og fritekst uten duplikater", () => {
    expect(fakta(hent(7), { feiltyper: ["km_avvik", "servicehistorikk"], mangelsgrunnlag: [] }).feiltyper).toEqual(["km_avvik", "servicehistorikk"]);
    expect(fakta(hent(1), { feiltyper: ["motor", "elektrisk"], mangelsgrunnlag: [] }).feiltyper).toEqual(["motor", "elektrisk"]);
  });

  it("markerer saker utenfor tjenesten, men ikke «vet ikke»", () => {
    expect(fakta(hent(2)).utenforTjenesten).toBe("privat_selger");
    expect(fakta(hent(9)).utenforTjenesten).toBe("ikke_privat_bruk");
    expect(fakta(hent(1)).utenforTjenesten).toBeNull();
    expect(fakta(hent(7)).utenforTjenesten).toBeNull();
  });

  it("opplyst feil gir tak på svak med mindre fritekst viser villedning", () => {
    expect(fakta(hent(3)).opplystTakSvak).toBe(true);
    expect(fakta(hent(3), { feiltyper: [], mangelsgrunnlag: ["feil_opplysninger"] }).opplystTakSvak).toBe(false);
    expect(fakta(hent(1)).opplystTakSvak).toBe(false);
  });

  it("feil opplysninger teller bare med dokumentasjon", () => {
    const tolkning = { feiltyper: [], mangelsgrunnlag: ["feil_opplysninger" as const] };
    expect(fakta(hent(5), tolkning).feilOpplysningerDokumentert).toBe(true);
    const udokumentert = hent(5);
    udokumentert.bevis = { ...udokumentert.bevis, annonse: false, kjopekontrakt: false, korrespondanse: false };
    expect(fakta(udokumentert, tolkning).feilOpplysningerDokumentert).toBe(false);
    expect(fakta(hent(5)).feilOpplysningerDokumentert).toBe(false);
  });

  it("beskrivelseskvalitet: modellens svar, med faste regler for lengde og selvmotsigelse", () => {
    const med = (beskrivelse: string, kvalitet: "ubrukelig" | "tynn" | "god" | undefined, feiltyper: ("rust" | "annet")[] = []) => {
      const i = hent(4);
      i.feilen.beskrivelse = beskrivelse;
      return fakta(i, kvalitet ? { feiltyper, mangelsgrunnlag: [], kvalitet } : null).beskrivelseKvalitet;
    };
    const lang = "Det er gjennomrustet i bunnen bak hjulbuene, og det var ikke synlig da jeg kjøpte bilen.";
    expect(med("blabla", "god")).toBe("ubrukelig"); // under 15 tegn
    expect(med("Bremsene hviner.", "god")).toBe("tynn"); // under 60 tegn
    expect(med("Bremsene hviner.", "ubrukelig")).toBe("ubrukelig");
    expect(med(lang, "god")).toBe("god");
    expect(med(lang, "ubrukelig", ["rust"])).toBe("tynn"); // modellen fant en konkret feil
    expect(med(lang, "ubrukelig", ["annet"])).toBe("ubrukelig");
    expect(med(lang, undefined)).toBe("god");
  });

  it("rapportens svar teller bare når det finnes en rapport", () => {
    const i = hent(10);
    i.bevis.rapportSierForKjop = true;
    expect(fakta(i).rapportSierForKjop).toBeNull();
  });
});
