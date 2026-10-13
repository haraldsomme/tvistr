import { describe, expect, it } from "vitest";
import { STUB_PROFIL, type Vippsprofil } from "@/lib/vipps/profil";
import { bakgrunn } from "./bakgrunn";
import { alleSetninger, byggBrev, somTekst } from "./brev";
import { frist } from "./frist";
import { avsender, mottaker, stedDato, tittel } from "./hode";
import { krav } from "./krav";
import { mangelen } from "./mangelen";
import { RAPPORT_PUNKTER, type Rapport, type RapportPunkt, type SelgerSvar, VERKSTED_HVEM } from "./rapport";
import { mangel, praksis, tidspunkt } from "./rettslig";
import { FEILSETT, FEILSETT_ENKLE, kontakt as lagKontakt, KJOPSDATO, lagSak, type Lov, produkt, RAPPORT, samle } from "./testsak";
import type { Brevfeil, Kontakt, Setning } from "./typer";
import { vedlegg } from "./vedlegg";

// One snapshot file per paragraph: the distinct texts over the axes the paragraph reads (see samle).
const LOV = ["før_2024", "etter_2024"] as const;
const SOM_DEN_ER = ["ja", "nei", "vet_ikke"] as const;
const TID = ["innen_6_mnd", "6_til_24_mnd", "over_24_mnd"] as const;
const KILDE = ["skriftlig", "muntlig", "nei"] as const;
const FEILNAVN = Object.keys(FEILSETT) as (keyof typeof FEILSETT)[];
const ALLE_PUNKTER = RAPPORT_PUNKTER.map((p) => p.id);
const KONKLUSJON = "Girkassen er utslitt og må skiftes.";

const tekst = (xs: Setning[][] | Setning[]) => (xs as (Setning | Setning[])[]).map((x) => (Array.isArray(x) ? x.map((y) => y.tekst).join(" ") : x.tekst)).join("\n");
const snapshot = (navn: string) => `./__snapshots__/${navn}.txt`;

// The buyer's contact with the seller, by name: «ingen» is no earlier complaint (the letter is the complaint).
const KONTAKT_NAVN = ["ingen", "skriftlig, annet", "muntlig, avviste", "skriftlig, ikke svart", "skriftlig, tilbød retting", "skriftlig, tilbød og 1 forsøk"] as const;
type KontaktNavn = (typeof KONTAKT_NAVN)[number];
function kontaktAv(lov: Lov, navn: KontaktNavn): Kontakt | null {
  const svar: Record<string, SelgerSvar> = { annet: "annet", avviste: "avviste", "ikke svart": "ikke_svart", "tilbød retting": "tilbod_retting", "tilbød og 1 forsøk": "tilbod_retting" };
  if (navn === "ingen") return null;
  const [form, s] = navn.split(", ") as ["skriftlig" | "muntlig", string];
  return lagKontakt(lov, { form, svar: svar[s], forsok: s === "tilbød og 1 forsøk" ? 1 : 0 });
}

// The same defects with a report each: `punkter` and the like change the report, the rest stays.
const rapport = (r: Partial<Rapport> = {}): Rapport => ({ ...RAPPORT, ...r });
const medRapport = (fs: Brevfeil[], r: Rapport): Brevfeil[] => fs.map((f) => ({ ...f, verksted: "skriftlig", rapport: r }));
const lys = (fs: Brevfeil[]): Brevfeil[] => fs.map((f) => ({ ...f, hoved: "elektrisk", under: ["lys"] }));

describe("hode", () => {
  const profiler: Record<string, Vippsprofil | null> = {
    full: STUB_PROFIL,
    uten_adresse: { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon, epost: STUB_PROFIL.epost },
    uten_adresse_og_epost: { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon },
    ingen: null,
  };
  it("gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ kjoper: Object.keys(profiler), selgerAdresse: [true, false] }, ({ kjoper, selgerAdresse }) => {
      const s = lagSak("etter_2024", { kjoper: profiler[kjoper], selger: { ...lagSak("etter_2024").selger, adresse: selgerAdresse ? lagSak("etter_2024").selger.adresse : null }, feil: FEILSETT.teknisk("innen_6_mnd", "nei", "nei") });
      return [tekst(avsender(s)), tekst([stedDato(s)]), tekst(mottaker(s)), tekst([tittel(s)])].join("\n--\n");
    });
    await expect(ut).toMatchFileSnapshot(snapshot("hode"));
  });
});

describe("avsnitt 1: bakgrunn", () => {
  it("gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ somDenEr: SOM_DEN_ER, kontakt: KONTAKT_NAVN, feilsett: FEILNAVN, opplysning: KILDE, forsteRegistrert: [2016, null] }, (v) =>
      tekst(bakgrunn(lagSak("etter_2024", { somDenEr: v.somDenEr, kontakt: kontaktAv("etter_2024", v.kontakt), bil: { ...lagSak("etter_2024").bil, forsteRegistrert: v.forsteRegistrert }, feil: FEILSETT[v.feilsett]("innen_6_mnd", v.opplysning, "nei") }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("bakgrunn"));
  });
});

describe("avsnitt 2: mangelen", () => {
  it("gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ feilsett: FEILSETT_ENKLE, tid: TID, opplysning: KILDE, verksted: KILDE, beskrivelse: [null, "Bilen mistet kraft etter tre uker."] }, (v) =>
      tekst(mangelen(lagSak("etter_2024", { feil: FEILSETT[v.feilsett](v.tid, v.opplysning, v.verksted, v.beskrivelse) }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("mangelen"));
  });

  it("gir samme tekst som sist for rettingsforsøk og flere feil", async () => {
    const ut = samle({ feilsett: ["teknisk", "to_tekniske_ulik_tid", "utstyr_blandet"] as const, forsok: [0, 1, 2, 3] }, (v) =>
      tekst(mangelen(lagSak("etter_2024", { kontakt: v.forsok ? lagKontakt("etter_2024", { forsok: v.forsok }) : null, feil: FEILSETT[v.feilsett]("6_til_24_mnd", "nei", "muntlig") }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("mangelen-forsok"));
  });

  it("gir samme tekst som sist for hver avkrysning i rapporten", async () => {
    const punkter: RapportPunkt[][] = [...ALLE_PUNKTER.map((p) => [p]), ALLE_PUNKTER, [...ALLE_PUNKTER].reverse()];
    const ut = samle({ punkter, konklusjon: [null, KONKLUSJON], hvem: VERKSTED_HVEM.map((h) => h.id) }, (v) =>
      tekst(mangelen(lagSak("etter_2024", { feil: medRapport(FEILSETT.teknisk("6_til_24_mnd", "nei", "skriftlig"), rapport({ punkter: v.punkter, konklusjon: v.konklusjon, hvem: v.hvem })) }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("mangelen-rapport"));
  });

  it("gir ett rapportavsnitt per feil, med hver sin rapport", () => {
    const feil = [
      ...medRapport(FEILSETT.teknisk("6_til_24_mnd", "nei", "skriftlig"), rapport({ navn: "Verksted A", dato: "2025-05-01", punkter: ["bekrefter"] })),
      ...medRapport(lys(FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig")), rapport({ navn: "Verksted B", dato: "2025-06-01", punkter: ["arsak"] })),
    ];
    const t = tekst(mangelen(lagSak("etter_2024", { feil })));
    expect(t).toContain("Feilen er undersøkt av Verksted A (uavhengig verksted) den 1. mai 2025. Verkstedet bekrefter feilen. Rapporten følger vedlagt.");
    expect(t).toContain("Feilen er undersøkt av Verksted B (uavhengig verksted) den 1. juni 2025. Verkstedet har fastslått årsaken. Rapporten følger vedlagt.");
  });

  it("gjengir konklusjonen ordrett, i ytre «»", () => {
    const t = tekst(mangelen(lagSak("etter_2024", { feil: medRapport(FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig"), rapport({ konklusjon: "Turbo «defekt», skal skiftes (ca. 38 000 kr)" })) })));
    expect(t).toContain("Rapporten konkluderer: «Turbo «defekt», skal skiftes (ca. 38 000 kr)». Rapporten følger vedlagt.");
  });

  it("setter ikke punktum etter en konklusjon som allerede slutter på tegnsetting", () => {
    const t = (k: string) => tekst(mangelen(lagSak("etter_2024", { feil: medRapport(FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig"), rapport({ konklusjon: k })) })));
    expect(t("Må skiftes.")).toContain("Rapporten konkluderer: «Må skiftes.» Rapporten følger vedlagt.");
    expect(t("Må skiftes!")).toContain("«Må skiftes!» Rapporten");
    expect(t("Må skiftes")).toContain("«Må skiftes». Rapporten");
  });

  it("skriver «deres eget verksted» for selgers verksted og ingen setning om uavhengighet", () => {
    const t = tekst(mangelen(lagSak("etter_2024", { feil: medRapport(FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig"), rapport({ hvem: "selgers", punkter: ["bekrefter"] })) })));
    expect(t).toContain("(deres eget verksted)");
    expect(t).not.toMatch(/uavhengig/);
    expect(t).toContain("Verkstedet bekrefter feilen.");
  });
});

describe("avsnitt 3: rettslig vurdering", () => {
  it("mangel gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ lov: LOV, somDenEr: SOM_DEN_ER, feilsett: FEILNAVN, opplysning: KILDE, kontakt: [false, true] }, (v) =>
      tekst(mangel(lagSak(v.lov, { somDenEr: v.somDenEr, kontakt: v.kontakt ? lagKontakt(v.lov) : null, feil: FEILSETT[v.feilsett]("innen_6_mnd", v.opplysning, "nei") }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("rettslig-mangel"));
  });

  it("tidspunkt gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ lov: LOV, feilsett: ["teknisk", "to_tekniske_ulik_tid", "teknisk_og_opplysning", "opplysning", "vet_ikke"] as const, tid: TID, verksted: KILDE, kontakt: [false, true] }, (v) =>
      tekst(tidspunkt(lagSak(v.lov, { kontakt: v.kontakt ? lagKontakt(v.lov) : null, feil: FEILSETT[v.feilsett](v.tid, "nei", v.verksted) }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("rettslig-tidspunkt"));
  });

  it("tidspunkt gir samme tekst som sist for rapportens avkrysninger", async () => {
    const punkter: RapportPunkt[][] = [["bekrefter"], ["til_stede"], ["ikke_slitasje"], ["til_stede", "ikke_slitasje"]];
    const ut = samle({ lov: LOV, feilsett: ["teknisk", "to_tekniske_ulik_tid"] as const, tid: TID, punkter }, (v) =>
      tekst(tidspunkt(lagSak(v.lov, { feil: medRapport(FEILSETT[v.feilsett](v.tid, "nei", "skriftlig"), rapport({ punkter: v.punkter })) }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("rettslig-tidspunkt-rapport"));
  });

  it("siterer rapportene med dato når to rapporter sier at feilen forelå ved leveringen", () => {
    const feil = [
      ...medRapport(FEILSETT.teknisk("over_24_mnd", "nei", "skriftlig"), rapport({ dato: "2025-05-01", punkter: ["til_stede"] })),
      ...medRapport(lys(FEILSETT.teknisk("over_24_mnd", "nei", "skriftlig")), rapport({ dato: "2025-06-01", punkter: ["til_stede"] })),
    ];
    expect(tekst(tidspunkt(lagSak("etter_2024", { feil })))).toContain("Verkstedene legger til grunn at feilene forelå ved leveringen, jf. rapportene av 1. mai 2025 og 1. juni 2025.");
  });

  it("har ingen bevissetning uten rapport", () => {
    const t = tekst(tidspunkt(lagSak("etter_2024", { feil: FEILSETT.teknisk("over_24_mnd", "nei", "muntlig") })));
    expect(t).toBe("Reklamasjonen er fremsatt innen to år etter at bilen ble levert, jf. § 27 annet ledd første punktum.");
  });

  it("praksis er vedtaksavsnittet uendret, og utelates uten vedtak", () => {
    const s = lagSak("etter_2024");
    expect(praksis(s)).toEqual([{ tekst: s.praksis!.avsnitt, kilde: "vedtak:22/2868", lenke: s.praksis!.kildeUrl }]);
    expect(praksis({ ...s, praksis: null })).toEqual([]);
  });
});

describe("avsnitt 4: krav", () => {
  const SVAR = ["ingen", "avviste", "ikke_svart", "tilbod_retting", "annet"] as const;
  const OVERSLAG = ["ingen", "ett", "to rapporter", "uten avkrysning", "fraråder"] as const;
  function feilMedOverslag(o: (typeof OVERSLAG)[number]): Brevfeil[] {
    const f = FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig");
    if (o === "ingen") return FEILSETT.teknisk("innen_6_mnd", "nei", "nei");
    if (o === "ett") return medRapport(f, rapport({ punkter: ["overslag"], overslag: 38_000 }));
    if (o === "uten avkrysning") return medRapport(f, rapport({ punkter: ["bekrefter"], overslag: 38_000 }));
    if (o === "fraråder") return medRapport(f, rapport({ punkter: ["frarader"] }));
    return [...medRapport(f, rapport({ navn: "Verksted A", punkter: ["overslag"], overslag: 38_000 })), ...medRapport(lys(f), rapport({ navn: "Verksted B", punkter: ["overslag"], overslag: 4_500 }))];
  }

  it("gir samme tekst som sist for hver kombinasjon", async () => {
    const utlegg = { ingen: [], ett: [{ beskrivelse: "Tauing", belop: 1200 }], to: [{ beskrivelse: "Tauing.", belop: 1200 }, { beskrivelse: "Leiebil", belop: 3000 }] };
    const ut = samle({ krav: ["retting", "prisavslag", "heving"] as const, svar: SVAR, forsok: [0, 1, 3], overslag: OVERSLAG, utlegg: Object.keys(utlegg) as (keyof typeof utlegg)[] }, (v) =>
      tekst(krav(lagSak("etter_2024", { krav: v.krav, kontakt: v.svar === "ingen" ? null : lagKontakt("etter_2024", { svar: v.svar, forsok: v.forsok }), utlegg: utlegg[v.utlegg], feil: feilMedOverslag(v.overslag) }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("krav"));
  });

  it("summerer overslagene over feilene, og bruker dem bare med avkrysningen", () => {
    const t = (o: (typeof OVERSLAG)[number]) => tekst(krav(lagSak("etter_2024", { krav: "prisavslag", feil: feilMedOverslag(o) })));
    expect(t("to rapporter")).toContain("tilsvarende utbedringskostnaden på kr 42\u00a0500 ifølge verkstedenes overslag.");
    expect(t("ett")).toContain("tilsvarende utbedringskostnaden på kr 38\u00a0000 ifølge verkstedets overslag.");
    expect(t("uten avkrysning")).not.toContain("utbedringskostnaden");
    expect(t("ingen")).not.toContain("utbedringskostnaden");
  });

  it("legger til at retting ikke vil bli tilbudt, og utelater selgers rett til å rette, bare ved heving", () => {
    const t = (k: (typeof SVAR)[number], kr: "heving" | "prisavslag") => tekst(krav(lagSak("etter_2024", { krav: kr, kontakt: lagKontakt("etter_2024", { svar: k as SelgerSvar }), feil: FEILSETT.teknisk("innen_6_mnd", "nei", "nei") })));
    expect(t("avviste", "heving")).toContain("Dere har avvist reklamasjonen, og jeg legger til grunn at retting ikke vil bli tilbudt.");
    expect(t("ikke_svart", "heving")).toContain("Dere har ikke besvart reklamasjonen, og jeg legger til grunn at retting ikke vil bli tilbudt.");
    expect(t("avviste", "heving")).not.toContain("Dersom dere ønsker å rette");
    expect(t("annet", "heving")).toContain("Dersom dere ønsker å rette");
    expect(t("avviste", "prisavslag")).toContain("Dersom dere ønsker å rette");
    expect(t("avviste", "prisavslag")).not.toContain("retting ikke vil bli tilbudt");
  });
});

describe("avsnitt 5: frist og vedlegg", () => {
  it("frist gir samme tekst som sist", async () => {
    const profiler = [STUB_PROFIL, { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon }, { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon, epost: "  " }, null];
    const ut = samle({ kjoper: profiler.map((_, i) => i) }, (v) => tekst(frist(lagSak("etter_2024", { kjoper: profiler[v.kjoper] }))) || "(ingen)");
    await expect(ut).toMatchFileSnapshot(snapshot("frist"));
  });

  it("vedlegg gir samme tekst som sist for hver kombinasjon", async () => {
    const RAPPORTER = ["ingen", "en", "to ulike", "samme på to feil"] as const;
    const feilFor = (r: (typeof RAPPORTER)[number], o: (typeof KILDE)[number]): Brevfeil[] => {
      const a = FEILSETT.teknisk("innen_6_mnd", o, "skriftlig");
      if (r === "ingen") return FEILSETT.teknisk("innen_6_mnd", o, "muntlig");
      if (r === "en") return a;
      if (r === "to ulike") return [...medRapport(a, rapport({ navn: "Verksted A", dato: "2025-05-01" })), ...medRapport(lys(a), rapport({ navn: "Verksted B", dato: "2025-06-01" }))];
      return medRapport([...a, ...lys(a)], rapport({ navn: "Verksted A", dato: "2025-05-01" }));
    };
    const ut = samle({ rapporter: RAPPORTER, opplysning: KILDE, utlegg: [false, true], kontakt: ["ingen", "skriftlig, annet", "muntlig, annet"] as const }, (v) =>
      tekst(vedlegg(lagSak("etter_2024", { feil: feilFor(v.rapporter, v.opplysning), utlegg: v.utlegg ? [{ beskrivelse: "Tauing", belop: 1200 }] : [], kontakt: kontaktAv("etter_2024", v.kontakt as KontaktNavn) }))) || "(ingen)",
    );
    await expect(ut).toMatchFileSnapshot(snapshot("vedlegg"));
  });
});

// The checks that hold for every letter, over a wide product of the answers.
describe("alle brev", () => {
  const FORBUDT = /\b(klart|åpenbart|utvilsomt)\b|jeg er klar over|jeg mener/i;
  const UGYLDIG = /undefined|\bnull\b|NaN|\[object|\{|\}|\s{2,}/;
  // The buyer's own words (description, conclusion) and the decision's quotes are not ours to word.
  const egne = (x: Setning) => x.kilde.startsWith("vedtak:") || x.kilde.endsWith(".beskrivelse") || x.kilde.endsWith(".konklusjon");

  const brev = produkt({
    lov: LOV,
    somDenEr: SOM_DEN_ER,
    feilsett: FEILNAVN,
    tid: TID,
    opplysning: KILDE,
    verksted: KILDE,
    krav: ["retting", "prisavslag", "heving"] as const,
    kontakt: ["ingen", "skriftlig, annet", "muntlig, avviste", "skriftlig, tilbød og 1 forsøk"] as const,
    tillegg: [false, true],
  }).map((v) => ({
    v,
    brev: byggBrev(
      lagSak(v.lov, {
        somDenEr: v.somDenEr,
        krav: v.krav,
        kontakt: kontaktAv(v.lov, v.kontakt),
        feil: FEILSETT[v.feilsett](v.tid, v.opplysning, v.verksted, v.tillegg ? "Bilen mistet kraft etter tre uker." : null).map((f) =>
          f.rapport && v.tillegg ? { ...f, rapport: { ...f.rapport, punkter: ALLE_PUNKTER, konklusjon: KONKLUSJON, overslag: 12_500 } } : f,
        ),
        utlegg: v.tillegg ? [{ beskrivelse: "Tauing", belop: 1200 }] : [],
        praksis: v.tillegg ? lagSak(v.lov).praksis : null,
      }),
    ),
  }));

  // Problems are collected and checked once: an expect per sentence is too slow over this many letters.
  const avvik = (sjekk: (x: Setning) => string | null) => {
    const feil: string[] = [];
    for (const { v, brev: b } of brev)
      for (const x of alleSetninger(b)) {
        const f = sjekk(x);
        if (f) feil.push(`${f}: «${x.tekst}» ${JSON.stringify(v)}`);
      }
    return feil.slice(0, 5);
  };

  it("har en kilde på hver setning", () => {
    expect(avvik((x) => (/^(fast|skjema|vipps|brreg|vegvesen|lov|vedtak)/.test(x.kilde.trim()) ? null : "mangler kilde"))).toEqual([]);
  });

  it("har ingen tomme felt og ingen forsterkere", () => {
    expect(avvik((x) => (egne(x) ? null : x.tekst.trim() === "" ? "tom" : UGYLDIG.test(x.tekst) ? "ugyldig" : FORBUDT.test(x.tekst) ? "forsterker" : null))).toEqual([]);
  });

  it("har alle fem avsnitt, og tekst i hvert", () => {
    for (const { brev: b } of brev) {
      expect(b.avsnitt.map((a) => a.overskrift.tekst)).toEqual(["1. Sakens bakgrunn", "2. Mangelen", "3. Rettslig vurdering", "4. Krav", "5. Frist for tilbakemelding"]);
      for (const a of b.avsnitt) expect(a.blokker.length, a.overskrift.tekst).toBeGreaterThan(0);
    }
  });

  it("har ikke samme setning to ganger, bortsett fra mellom feilene i avsnitt 2", () => {
    // The buyer's name is in both the sender field and the signature, and two defects each get their own
    // block under «Mangelen», so only the other sections and each block by itself are checked.
    const dupler = brev.flatMap(({ v, brev: b }) => {
      const blokker = b.avsnitt.flatMap((a) => a.blokker.flatMap((x) => ("setninger" in x ? [{ nr: a.nr, tekster: x.setninger.map((y) => y.tekst) }] : [])));
      const iBlokk = blokker.some((x) => new Set(x.tekster).size !== x.tekster.length);
      const ellers = blokker.filter((x) => x.nr !== 2).flatMap((x) => x.tekster);
      return iBlokk || new Set(ellers).size !== ellers.length ? [JSON.stringify(v)] : [];
    });
    expect(dupler.slice(0, 5)).toEqual([]);
  });

  it("har bare én rapportlinje i vedlegget når feilene har samme rapport", () => {
    // The sets with one defect have one report when the answer is «skriftlig», and none otherwise.
    for (const { v, brev: b } of brev) {
      if (!["teknisk", "opplysning", "garanti", "vet_ikke"].includes(v.feilsett)) continue;
      const linjer = b.vedlegg?.punkter.filter((p) => p.tekst.startsWith("Rapport fra")) ?? [];
      expect(linjer.length, JSON.stringify(v)).toBe(v.verksted === "skriftlig" ? 1 : 0);
    }
  });
});

describe("kjøpt før og etter 2024", () => {
  it("bruker § 17 før 2024 og § 15 annet ledd etter, aldri omvendt", () => {
    const f = FEILSETT.teknisk("innen_6_mnd", "nei", "nei");
    const gammel = somTekst(byggBrev(lagSak("før_2024", { somDenEr: "ja", feil: f })));
    const ny = somTekst(byggBrev(lagSak("etter_2024", { somDenEr: "ja", feil: f })));
    expect(gammel).toContain("§ 17 første ledd bokstav a");
    expect(gammel).not.toContain("§ 15 annet ledd");
    expect(ny).toContain("avtalt unntak etter forbrukerkjøpsloven § 15 annet ledd");
    expect(ny).toContain("spesielt opplyst");
    expect(ny).not.toContain("§ 17");
    expect(KJOPSDATO.før_2024 < "2024-01-01").toBe(true);
  });

  it("sier ikke noe om forbeholdet etter 2024 når selger sa noe om feilen", () => {
    for (const o of ["skriftlig", "muntlig"] as const) {
      const t = somTekst(byggBrev(lagSak("etter_2024", { somDenEr: "ja", feil: FEILSETT.teknisk("innen_6_mnd", o, "nei") })));
      expect(t).not.toContain("avtalt unntak");
      expect(t).toContain("har en mangel etter forbrukerkjøpsloven § 16 første ledd bokstav a");
    }
  });

  it("sier ikke noe om forbeholdet etter 2024 når «som den er» er ukjent eller nei", () => {
    for (const s of ["nei", "vet_ikke"] as const) expect(somTekst(byggBrev(lagSak("etter_2024", { somDenEr: s, feil: FEILSETT.teknisk("innen_6_mnd", "nei", "nei") })))).not.toContain("avtalt unntak");
  });

  it("gjelder formodningen i to år bare etter 2024", () => {
    const f = FEILSETT.teknisk("6_til_24_mnd", "nei", "nei");
    expect(somTekst(byggBrev(lagSak("etter_2024", { feil: f })))).toContain("formodes etter § 18 annet ledd");
    expect(somTekst(byggBrev(lagSak("før_2024", { feil: f })))).not.toContain("formodes");
  });
});

describe("hele brevet med rapport", () => {
  it("setter ikke noe i brevet av det som ikke er krysset av", () => {
    const f = medRapport(FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig"), rapport({ punkter: ["bekrefter"], konklusjon: null }));
    const t = somTekst(byggBrev(lagSak("etter_2024", { feil: f })));
    expect(t).toContain("Verkstedet bekrefter feilen.");
    for (const ord of ["fastslått årsaken", "utviklet seg over tid", "unormal for bilens alder", "fraråder", "konkluderer", "slitasje"]) expect(t, ord).not.toContain(ord);
  });

  it("gir to rapportavsnitt og summert overslag for to feil med hver sin rapport", () => {
    const a = medRapport(FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig"), rapport({ navn: "Verksted A", dato: "2025-05-01", punkter: ["overslag"], overslag: 38_000 }));
    const b = medRapport(lys(FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig")), rapport({ navn: "Verksted B", dato: "2025-06-01", punkter: ["overslag"], overslag: 4_500 }));
    const t = somTekst(byggBrev(lagSak("etter_2024", { feil: [...a, ...b] })));
    expect(t.match(/Rapporten følger vedlagt\./g)).toHaveLength(2);
    expect(t).toContain("kr 42\u00a0500 ifølge verkstedenes overslag");
    expect(t).toContain("– Rapport fra Verksted A av 1. mai 2025\n– Rapport fra Verksted B av 1. juni 2025");
  });

  it("har bare én vedleggslinje når samme rapport gjelder to feil", () => {
    const a = FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig");
    const t = somTekst(byggBrev(lagSak("etter_2024", { feil: medRapport([...a, ...lys(a)], rapport()) })));
    expect(t.match(/– Rapport fra/g)).toHaveLength(1);
  });
});

describe("forhåndsvisning-uten-kjøper", () => {
  it("gir et gyldig brev uten adresse, uten e-post og uten kjøper", () => {
    for (const kjoper of [{ navn: "Kari Testesen", telefon: "+47 900 00 000" }, null] as const) {
      const b = byggBrev(lagSak("etter_2024", { kjoper, feil: FEILSETT.teknisk("innen_6_mnd", "nei", "nei") }));
      const t = somTekst(b);
      expect(t).not.toMatch(/undefined|null/);
      if (kjoper) expect(t).toContain("tlf. +47 900 00 000");
    }
  });
});
