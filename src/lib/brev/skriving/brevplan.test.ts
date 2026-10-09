import { describe, expect, it } from "vitest";
import { momenterFor, type Moment } from "../momenter";
import { rettelseTilLagring } from "./avklaring";
import { DEL_FOR_ARGUMENT, DELER, planlegg, type ArgumentId } from "./brevplan";
import { forfatterBruker } from "@/lib/ai/prompter";
import type { Utfylling } from "../utfylling";
import { henvisningFor } from "./henvisning";
import { kjoperFor, sakForModell, type Saksmodell } from "./saksmodell";
import { avsender, feilen, modell, svar } from "./testdata";

describe("saksmodell", () => {
  it("sender ikke personopplysninger til modellen", () => {
    const m = modell({
      utfylling: {
        kjoretoy: { regnr: "XX 12345", merke: "Testmerke", modell: "Kombi", ar: 2016 },
        avsender,
        feilen: { ...feilen, egen: "Test Testesen eier bilen XX 12345. Ring 912 34 567 eller test@example.com." },
      },
    });
    const json = JSON.stringify(sakForModell(m));
    for (const x of ["Testesen", "XX 12345", "XX12345", "912 34 567", "example.com", "12345678903", "Testveien"]) expect(json).not.toContain(x);
    expect(json).toContain("Testmerke");
  });

  it("renser kildetekster", () => {
    const m = modell({
      utfylling: { feilen, avsender, kjoretoy: { regnr: "XX 12345", merke: "Testmerke", modell: "Kombi", ar: 2016 } },
      kilder: { rapport: "Kunde: Test Testesen, XX12345, tlf 22 33 44 55, test@example.com. Reimen er slitt." },
    });
    expect(m.kilder.rapport).toBe("Kunde: …, …, tlf …, …. Reimen er slitt.");
  });

  it("lager en sortert tidslinje av datoene saken har", () => {
    const m = modell({
      svar: svar({ kontakt: "ja" }),
      utfylling: { feilen, retting: "avvist", reklamasjon: { dato: "2026-04-05", mate: "epost", svarDato: "2026-04-20" } },
    });
    expect(m.tidslinje).toEqual([
      { type: "kjop", dato: "2026-03-12" },
      { type: "feil", dato: "2026-04-02" },
      { type: "reklamasjon", dato: "2026-04-05" },
      { type: "svar", dato: "2026-04-20" },
    ]);
  });

  it("sender ikke kjøperens navn, regnr. eller telefon til forfatteren gjennom planen", () => {
    const m = modell({
      svar: svar({ kontakt: "ja", verkstedrapport: "ja", rapportSierForKjop: "ja" }),
      utfylling: {
        feilen,
        avsender,
        kjoretoy: { regnr: "XX 12345", merke: "Testmerke", modell: "Kombi", ar: 2016 },
        retting: "avvist",
        reklamasjon: { dato: "2026-04-05", mate: "epost" },
        rapport: { fra: "Test Testesen selv", dato: "2026-04-10", sitat: "Reimen er slitt" },
        krav: { type: "prisavslag", utgifter: [{ type: "annet", belopNok: 900, beskrivelse: "Taxi for Test Testesen, XX 12345, tlf 912 34 567" }] },
      },
    });
    const prompt = forfatterBruker(sakForModell(m), m.kilder, planlegg(m));
    for (const x of ["Testesen", "XX 12345", "912 34 567"]) expect(prompt).not.toContain(x);
  });

  it("lar vanlige ord stå når de også er deler av kjøperens navn", () => {
    const m = modell({ utfylling: { avsender: { ...avsender, navn: "Per Dagsen" }, feilen: { ...feilen, egen: "Leiebilen koster 500 kr per dag." } } });
    expect(JSON.stringify(sakForModell(m))).toContain("500 kr per dag");
    expect(JSON.stringify(sakForModell(modell({ utfylling: { avsender: { ...avsender, navn: "Per Dagsen" }, feilen: { ...feilen, egen: "Per Dagsen eier bilen." } } })))).not.toContain("Dagsen");
  });

  it("kaller datoen det siste forsøket, ikke et svar, når forhandleren har forsøkt å rette", () => {
    const m = modell({
      svar: svar({ kontakt: "ja" }),
      utfylling: { feilen, retting: "forsokt", reklamasjon: { dato: "2026-04-05", mate: "epost", forsok: 2, svarDato: "2026-05-20" } },
    });
    expect(m.tidslinje.map((h) => h.type)).toContain("siste_forsok");
    expect(m.tidslinje.map((h) => h.type)).not.toContain("svar");
    const kontakt = JSON.stringify((sakForModell(m) as { kontakt: unknown }).kontakt);
    expect(kontakt).toContain("sisteForsok");
    expect(kontakt).not.toContain("svarDato");
  });

  it("leser kildetekster og avklaringer fra utfyllingen, og lar dem som gis direkte vinne", () => {
    const utfylling = { feilen, kilder: { rapport: "Reimen er slitt." }, avklaringer: [{ runde: 1, tema: "feilen" as const, sporsmal: "Hvor ofte?", svar: "Hver dag" }] };
    const m = modell({ utfylling });
    expect(m.kilder.rapport).toBe("Reimen er slitt.");
    expect(m.avklaringer).toHaveLength(1);
    expect(modell({ utfylling, kilder: { rapport: "Annen tekst." } }).kilder.rapport).toBe("Annen tekst.");
  });

  it("dropper et svar om retting som ikke passer kontaktsvaret", () => {
    expect(modell({ utfylling: { feilen, retting: "avvist" } }).utfylling.retting).toBeUndefined();
  });
});

const plan = (...a: Parameters<typeof modell>) => planlegg(modell(...a));
const ider = (...a: Parameters<typeof modell>) => plan(...a).argumenter.map((x) => x.id);
const forbudte = (...a: Parameters<typeof modell>) => plan(...a).forbudt.map((x) => x.id);
const antall = (liste: ArgumentId[], id: ArgumentId) => liste.filter((x) => x === id).length;

describe("planlegg", () => {
  it("viser til formodningsregelen med to år for kjøp fra 2024", () => {
    const p = plan();
    expect(p.argumenter.find((a) => a.id === "formodning")?.foring).toContain("innen to år etter levering");
    expect(p.forbudt.map((f) => f.id)).not.toContain("formodning");
  });

  it("bruker seks måneder for kjøp før 2024", () => {
    const p = plan({ svar: svar({ kjopAlder: "2_5", kjopsdato: "2023-05-31" }), utfylling: { feilen: { ...feilen, dato: "2023-08-01" } } });
    expect(p.argumenter.find((a) => a.id === "formodning")?.foring).toContain("innen seks måneder");
  });

  it("forbyr formodningsregelen og tar med femårsfristen når feilen viste seg etter to år", () => {
    const g = { svar: svar({ kjopAlder: "2_5", kjopsdato: "2023-05-31", oppdaget: "over_2_ar" }), utfylling: { feilen: { ...feilen, dato: "2026-08-01" } } };
    expect(forbudte(g)).toContain("formodning");
    expect(ider(g)).toEqual(expect.arrayContaining(["leveringstidspunkt", "femarsfrist"]));
  });

  it("krever retting og forbyr heving og prisavslag før forhandleren har fått prøve", () => {
    expect(ider()).toContain("krav_retting");
    expect(forbudte()).toEqual(expect.arrayContaining(["krav_heving", "krav_prisavslag", "historikk"]));
  });

  it("krever prisavslag etter avvisning, med rente én gang", () => {
    const a = ider({
      svar: svar({ kontakt: "ja" }),
      utfylling: { feilen, retting: "avvist", reklamasjon: { dato: "2026-04-05", mate: "epost" }, krav: { type: "prisavslag", utbedringNok: 20000, utgifter: [{ type: "verksted", belopNok: 3000 }] } },
    });
    expect(a).toEqual(expect.arrayContaining(["historikk", "krav_prisavslag", "erstatning"]));
    expect(antall(a, "rente")).toBe(1);
    expect(a).not.toContain("krav_retting");
  });

  it("hever kjøpet med subsidiært prisavslag, rente av kjøpesummen og av utgiftene", () => {
    const a = ider({
      svar: svar({ kontakt: "ja" }),
      utfylling: { feilen, retting: "forsokt", reklamasjon: { dato: "2026-04-05", mate: "epost", forsok: 2 }, krav: { type: "heving", utbedringNok: 60000, utgifter: [{ type: "leiebil", belopNok: 4000 }] } },
    });
    expect(a).toEqual(expect.arrayContaining(["avviser_nytt_forsok", "krav_heving", "vesentlig", "subsidiaert_prisavslag", "rente_heving", "erstatning"]));
    expect(antall(a, "rente")).toBe(1);
  });

  it("setter argumentene i delenes rekkefølge, og historikken uten paragrafer", () => {
    const saker: Parameters<typeof modell>[] = [
      [],
      [{ svar: svar({ kjopAlder: "2_5", kjopsdato: "2023-05-31", oppdaget: "over_2_ar" }), utfylling: { feilen: { ...feilen, dato: "2026-08-01" } } }],
      [{ svar: svar({ kontakt: "ja" }), utfylling: { feilen, retting: "avvist", reklamasjon: { dato: "2026-04-05", mate: "epost" }, krav: { type: "prisavslag", utbedringNok: 20000, utgifter: [] } } }],
      [{ svar: svar({ kontakt: "ja" }), utfylling: { feilen, retting: "ikke_rettet", reklamasjon: { dato: "2026-04-05", mate: "epost" }, krav: { type: "heving", utgifter: [] } } }],
    ];
    for (const a of saker) {
      const p = plan(...a);
      const deler = p.argumenter.map((x) => DELER.indexOf(DEL_FOR_ARGUMENT[x.id]));
      expect(deler).toEqual([...deler].sort((x, y) => x - y));
      expect(p.argumenter.find((x) => x.id === "historikk")?.foring ?? "").not.toContain("§");
    }
    const p = plan(...saker[2]);
    expect(p.argumenter.find((x) => x.id === "reklamasjon")?.foring).toContain("innen to måneder etter at jeg oppdaget feilen, jf. § 27 første ledd");
  });

  it("tar med kontonummeret bare når brevet krever penger", () => {
    expect(forbudte({ utfylling: { feilen, avsender } })).toContain("kontonummer");
    const p = plan({ svar: svar({ kontakt: "ja" }), utfylling: { feilen, avsender, retting: "avvist", reklamasjon: { dato: "2026-04-05", mate: "epost" }, krav: { type: "prisavslag", utgifter: [] } } });
    expect(p.argumenter.map((x) => x.id)).toContain("kontonummer");
    expect(p.merker).toEqual(expect.arrayContaining(["kontonummer", "epost", "dato:svarfrist"]));
  });

  it("gjør det som mangler, om til plassholdere", () => {
    const p = plan({ svar: svar({ kjopesum: "", kontakt: "ja" }), utfylling: {} });
    const tekster = p.mangler.map((x) => x.tekst);
    expect(tekster).toContain("kjøpesum");
    expect(tekster).toContain("dato og måte du tok opp feilen med forhandleren");
    expect(tekster.some((t) => t.startsWith("beskrivelse av feilen"))).toBe(true);
    for (const t of tekster) expect(t).not.toMatch(/[[\]]/);
  });

  it("en sak uten feiltype, kontakt og rapport gir plassholdere og ingen påstander om dem", () => {
    // What the assessment no longer asks, not yet answered after purchase.
    const m = modell({ svar: svar({ feiltyper: [], kontakt: "", verkstedrapport: "", bilder: "", feilOpplysning: "" }), utfylling: { feilen } });
    const p = planlegg(m);
    expect(p.mangler).toEqual(
      expect.arrayContaining([
        { tekst: "hva feilen gjelder", steg: "feilen" },
        { tekst: "om du har tatt opp feilen med forhandleren", steg: "kontakt" },
        { tekst: "om et verksted har skrevet en rapport om feilen", steg: "rapport" },
      ]),
    );
    // Nothing is argued about them, either way.
    const ider = p.argumenter.map((a) => a.id);
    for (const id of ["historikk", "rapport_bevis", "opplysning", "slitasje"] as const) expect(ider).not.toContain(id);
    expect(p.argumenter.find((a) => a.id === "reklamasjon")?.foring).not.toMatch(/bekrefter|herved/);
    expect(p.argumenter.find((a) => a.id === "mangel")?.foring).not.toContain("§ 15");
    const grunner = p.forbudt.filter((f) => ["historikk", "rapport_bevis", "slitasje"].includes(f.id)).map((f) => f.grunn);
    for (const g of grunner) expect(g).toMatch(/ikke oppgitt/);
    const sak = sakForModell(m) as { feilen: { kategorier: unknown }; kontakt: { tattOppMedForhandleren: unknown }; rapport: unknown };
    expect(sak.feilen.kategorier).toEqual([]);
    expect(sak.kontakt.tattOppMedForhandleren).toBeNull();
    expect(sak.rapport).toBeNull();
    // The same case with the answers gives none of these placeholders.
    const besvart = planlegg(modell({ svar: svar(), utfylling: { feilen } })).mangler.map((x) => x.steg);
    expect(besvart).not.toContain("kontakt");
    expect(besvart).not.toContain("rapport");
    expect(besvart).not.toContain("feilen");
  });

  it("bygger på forskjellen når kjøperen kjente til feilen, men den er verre enn opplyst", () => {
    const foring = (g: Parameters<typeof modell>[0]) => plan(g).argumenter.find((a) => a.id === "kjent_avvik")?.foring;
    const ny = foring({ svar: svar({ opplystForKjop: "ja_verre" }), utfylling: { feilen } });
    expect(ny).toContain("Avviket fra det som ble opplyst, er en mangel, jf. forbrukerkjøpsloven § 16");
    expect(ny).toContain("§ 15 andre ledd");
    // Before 2024 § 15 second paragraph did not exist in that form.
    const gammel = foring({ svar: svar({ opplystForKjop: "ja_verre", kjopAlder: "2_5", kjopsdato: "2023-05-31" }), utfylling: { feilen: { ...feilen, dato: "2023-08-01" } } });
    expect(gammel).toContain("§ 16");
    expect(gammel).not.toContain("§ 15");
    expect(foring({ utfylling: { feilen } })).toBeUndefined();
    expect(forbudte({ utfylling: { feilen } })).toContain("kjent_avvik");
    expect(ider({ svar: svar({ opplystForKjop: "ja_verre" }), utfylling: { feilen } })).not.toContain("kjente_ikke");
  });

  it("en feil kjøperen kjente slik den er: be om kjøpsdatoen når den mangler, ellers advar for kjøp fra 2024", () => {
    const advarsler = (endring: Parameters<typeof svar>[0]) => plan({ svar: svar({ opplystForKjop: "ja_som_opplyst", ...endring }), utfylling: { feilen } }).advarsler.map((a) => a.id);
    expect(advarsler({ kjopAlder: "2_5", kjopsdato: "" })).toContain("kjent_uten_kjopsdato");
    expect(advarsler({})).toEqual(expect.arrayContaining(["kjent_fra_2024"]));
    expect(advarsler({})).not.toContain("kjent_uten_kjopsdato");
  });

  it("lar kilden til vedtaket stå som merke", () => {
    const p = plan();
    expect(p.henvisning).not.toBeNull();
    const foring = p.argumenter.find((a) => a.id === "henvisning")?.foring ?? "";
    expect(foring).toContain("{{henvisning}}");
    expect(foring).not.toContain(p.henvisning!.kildeUrl);
    expect(p.merker).toContain("henvisning");
  });

  it("lar ikke føringen påstå mer enn en innlimt rapport sier", () => {
    const g = { svar: svar({ verkstedrapport: "ja", rapportSierForKjop: "ja" }), utfylling: { feilen, rapport: { fra: "Testverksted AS", dato: "2026-04-10", sitat: "Tetningslisten er sprukket" } } };
    const uten = plan(g).argumenter.find((a) => a.id === "rapport_bevis")?.foring ?? "";
    const med = plan({ ...g, kilder: { rapport: "Tetningslisten er sprukket og må byttes." } }).argumenter.find((a) => a.id === "rapport_bevis")?.foring ?? "";
    expect(uten).toContain("fremgår også av verkstedrapporten at feilen sannsynligvis forelå");
    expect(med).not.toContain("fremgår også av verkstedrapporten");
    expect(med).toContain("bare det den faktisk sier");
  });

  it("viser aldri til et vedtak som er nyere enn brevet", () => {
    const p = plan({ svar: svar({ kjopAlder: "under_2", kjopsdato: "2023-09-01" }), utfylling: { feilen: { ...feilen, dato: "2024-01-15" } } }, "2024-03-01");
    expect(p.henvisning === null || p.henvisning.dato <= "2024-03-01").toBe(true);
  });

  // Carried over from the tests of the template (brev.test.ts), which went with it.
  it("forbeholdet: «som den er» etter loven før og etter 2024, og garantien", () => {
    const foring = (g: Parameters<typeof modell>[0]) => plan(g).argumenter.find((a) => a.id === "forbehold")?.foring ?? "";
    expect(foring({ utfylling: { feilen, forbehold: "som_den_er" } })).toContain("ingen virkning");
    expect(foring({ svar: svar({ kjopAlder: "2_5", kjopsdato: "2023-05-31" }), utfylling: { feilen: { ...feilen, dato: "2023-08-01" }, forbehold: "som_den_er" } })).toContain("slik den lød");
    expect(foring({ utfylling: { feilen, forbehold: "garanti" } })).toContain("Garantien");
    expect(ider({ utfylling: { feilen, forbehold: "ingen" } })).not.toContain("forbehold");
  });

  it("slitasje er et argument for feil slitasje kan forklare, ikke for kilometer og historikk", () => {
    expect(ider({ svar: svar({ feiltyper: ["rust"] }) })).toContain("slitasje");
    expect(forbudte({ svar: svar({ feiltyper: ["km_service"] }) })).toContain("slitasje");
  });

  it("vedleggene er det brevet bygger på: kontrakt, rapport og faktura for reparasjon andre steder", () => {
    const p = plan({ svar: svar({ verkstedrapport: "ja", rapportSierForKjop: "ja" }), utfylling: { feilen, retting: "reparert_selv", reparasjon: { dato: "2026-04-10", grunn: "nodvendig" } } });
    expect(p.argumenter.find((a) => a.id === "vedlegg")?.data.vedlegg).toEqual(["kjøpekontrakt", "verkstedrapport", "faktura for reparasjonen"]);
  });

  it("en uriktig opplysning uten tekst blir en plassholder", () => {
    const p = plan({ svar: svar({ feilOpplysning: "ja_udokumentert" }), utfylling: { feilen } });
    expect(p.argumenter.map((a) => a.id)).toContain("opplysning");
    expect(p.mangler.map((m) => m.tekst)).toContain("hva annonsen eller selgeren opplyste som ikke stemte");
  });

  it("gjør gunstige svar på momenter om til argumenter, og ugunstige til svakheter", () => {
    const avklaring = (svar: string) => ({ runde: 1, moment: "km_etter_kjop", tema: "feilen" as const, sporsmal: "Hvor langt hadde du kjørt?", svar });
    const gunstig = plan({ utfylling: { feilen, avklaringer: [avklaring("Under 1 000 km")] } });
    const m = gunstig.argumenter.find((a) => a.id === "momenter");
    expect(m?.foring).toContain("siden overtakelsen");
    const ugunstig = plan({ utfylling: { feilen, avklaringer: [avklaring("Over 15 000 km")] } });
    expect(ugunstig.argumenter.map((a) => a.id)).not.toContain("momenter");
    expect(ugunstig.advarsler.map((a) => a.id)).toContain("moment-km_etter_kjop");
  });

  it("tar tekstreglene ut av advarslene", () => {
    const p = plan({ utfylling: { feilen: { ...feilen, egen: "Feil", avsnitt: ["Feil."] } } });
    expect(p.advarsler.map((a) => a.id)).not.toContain("feil_kort");
  });
});

describe("henvisningen", () => {
  const foring = (m: Saksmodell) => planlegg(m).argumenter.find((a) => a.id === "henvisning")?.foring ?? "";
  // Bought 2023, the defect showed after more than two years: outside the presumption.
  const utenfor = (momenter?: Utfylling["momenter"]) => modell({ svar: svar({ kjopsdato: "2023-03-01", oppdaget: "over_2_ar", ...(momenter && { verkstedrapport: "ja", rapportSierForKjop: "ja" }) }), utfylling: { feilen, ...(momenter && { momenter }) } });

  it("sier rettsspørsmålet og at kjøpet var fra en næringsdrivende forhandler", () => {
    const t = foring(utenfor());
    expect(t).toMatch(/tok Forbrukerklageutvalget stilling til/);
    expect(t).toMatch(/næringsdrivende forhandler/);
  });

  it("«minst like sterkt» bare når kjøperen har alle momentene vedtaket ble vunnet på", () => {
    // Without the report moments the chosen decision rests on a moment this buyer is not asked; with them, on one they have.
    const saker = [utenfor(), utenfor({ rapport_upaaregnelig: { svar: "Ja, at det er en konstruksjons- eller produksjonsfeil ved modellen" }, rapport_arsak: { svar: "Den angir en konkret årsak etter å ha undersøkt bilen" } })];
    for (const m of saker) {
      const v = henvisningFor(m)!;
      expect(foring(m).includes("minst like sterkt")).toBe(v.mangler.length === 0 && v.ukjent.length === 0 && v.dekket.length > 0);
    }
    // Both branches are exercised.
    expect(saker.map((m) => foring(m).includes("minst like sterkt"))).toEqual([false, true]);
  });

  it("et moment besvart med egne ord teller ikke som dekket", () => {
    expect(kjoperFor(utenfor({ rapport_upaaregnelig: { egen: "Verkstedet sa at det var rart" } })).dekket.has("rapport_upaaregnelig")).toBe(false);
  });

  it("gjengir det utvalget la vekt på, uten merke og modell", () => {
    const m = utenfor();
    const v = henvisningFor(m)!;
    expect(foring(m)).toContain(v.henvisning.begrunnelse);
    expect(foring(m)).not.toMatch(/Volkswagen|Toyota|Mercedes|BMW|Volvo|Audi|Nissan|Ford|Mitsubishi|Tesla|Peugeot|Subaru/);
  });
});

describe("momenterFor", () => {
  const moment = (id: string, gjelder: Moment["gjelder"], skiller = true): Moment => ({
    id,
    navn: id,
    tema: "bevis",
    retning: "for",
    gjelder,
    sporsmal: "?",
    alternativer: ["Ja", "Nei"],
    gunstig: ["Ja"],
    argument: "",
    forekomst: { vunnet: 10, tapt: 2, skiller },
  });
  const katalog = [moment("alle", {}), moment("rust", { grupper: ["rust"] }), moment("svak", {}, false), moment("sen", { botter: ["sen"] })];

  it("tar med momenter som gjelder saken og skiller vunne fra tapte", () => {
    expect(momenterFor(modell().faktorer, katalog).map((m) => m.id)).toEqual(["alle"]);
  });

  it("tar med momenter avgrenset til sakens feilgruppe og tidsrom", () => {
    const m = modell({ svar: svar({ feiltyper: ["rust"], kjopAlder: "2_5", kjopsdato: "2023-05-31", oppdaget: "over_2_ar" }), utfylling: { feilen: { ...feilen, dato: "2026-08-01" } } });
    expect(momenterFor(m.faktorer, katalog).map((x) => x.id)).toEqual(["alle", "rust", "sen"]);
  });
});

describe("rettelseTilLagring", () => {
  const sak = { svar: svar({ kontakt: "ja" }), utfylling: { feilen, reklamasjon: { dato: "2026-04-05", mate: "epost" as const } } };
  const r = (felt: Parameters<typeof rettelseTilLagring>[0]["felt"], verdi: string) => rettelseTilLagring({ felt, verdi, begrunnelse: "" }, sak);

  it("retter svar, datoer i utfyllingen og beløp", () => {
    expect(r("kjopesum", "240000")).toEqual({ svar: { ...sak.svar, kjopesum: "240000" } });
    expect(r("feilen.dato", "2026-04-03")).toEqual({ feilen: { ...feilen, dato: "2026-04-03" } });
    expect(r("reklamasjon.svarDato", "2026-04-20")).toEqual({ reklamasjon: { dato: "2026-04-05", mate: "epost", svarDato: "2026-04-20" } });
    expect(r("krav.utbedringNok", "15000")).toEqual({ krav: { utgifter: [], utbedringNok: 15000 } });
  });

  it("gir null for ugyldige verdier og felt saken ikke har", () => {
    expect(r("kjopsdato", "12.03.2026")).toBeNull();
    expect(r("reparasjon.dato", "2026-05-01")).toBeNull();
    expect(r("kjopesum", "mange")).toBeNull();
  });
});
