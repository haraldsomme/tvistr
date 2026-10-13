import { describe, expect, it } from "vitest";
import { STUB_PROFIL, type Vippsprofil } from "@/lib/vipps/profil";
import { bakgrunn } from "./bakgrunn";
import { alleSetninger, byggBrev, somTekst } from "./brev";
import { frist } from "./frist";
import { avsender, mottaker, stedDato, tittel } from "./hode";
import { krav } from "./krav";
import { mangelen } from "./mangelen";
import { mangel, praksis, tidspunkt } from "./rettslig";
import { FEILSETT, FEILSETT_ENKLE, KJOPSDATO, lagSak, produkt, samle, TIDLIGERE_DATO, type Lov } from "./testsak";
import type { Brevsak, Setning } from "./typer";
import { vedlegg } from "./vedlegg";

// One snapshot file per paragraph: the distinct texts over the axes the paragraph reads (see samle).
const LOV = ["før_2024", "etter_2024"] as const;
const SOM_DEN_ER = ["ja", "nei", "vet_ikke"] as const;
const TID = ["innen_6_mnd", "6_til_24_mnd", "over_24_mnd"] as const;
const KILDE = ["skriftlig", "muntlig", "nei"] as const;
const FEILNAVN = Object.keys(FEILSETT) as (keyof typeof FEILSETT)[];

const tekst = (xs: Setning[][] | Setning[]) => (xs as (Setning | Setning[])[]).map((x) => (Array.isArray(x) ? x.map((y) => y.tekst).join(" ") : x.tekst)).join("\n");
const snapshot = (navn: string) => `./__snapshots__/${navn}.txt`;
const tidligere = (lov: Lov, ja: boolean): Brevsak["tidligere"] => (ja ? { dato: TIDLIGERE_DATO[lov], form: "skriftlig" } : null);

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
    const ut = samle(
      { somDenEr: SOM_DEN_ER, tidligere: [null, "skriftlig", "muntlig"] as const, feilsett: FEILNAVN, opplysning: KILDE, forsteRegistrert: [2016, null] },
      (v) =>
        tekst(
          bakgrunn(lagSak("etter_2024", { somDenEr: v.somDenEr, tidligere: v.tidligere ? { dato: TIDLIGERE_DATO.etter_2024, form: v.tidligere } : null, bil: { ...lagSak("etter_2024").bil, forsteRegistrert: v.forsteRegistrert }, feil: FEILSETT[v.feilsett]("innen_6_mnd", v.opplysning, "nei") })),
        ),
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
      tekst(mangelen(lagSak("etter_2024", { forsok: v.forsok, feil: FEILSETT[v.feilsett]("6_til_24_mnd", "nei", "muntlig") }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("mangelen-forsok"));
  });
});

describe("avsnitt 3: rettslig vurdering", () => {
  it("mangel gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ lov: LOV, somDenEr: SOM_DEN_ER, feilsett: FEILNAVN, opplysning: KILDE }, (v) =>
      tekst(mangel(lagSak(v.lov, { somDenEr: v.somDenEr, feil: FEILSETT[v.feilsett]("innen_6_mnd", v.opplysning, "nei") }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("rettslig-mangel"));
  });

  it("tidspunkt gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ lov: LOV, feilsett: ["teknisk", "to_tekniske_ulik_tid", "teknisk_og_opplysning", "opplysning", "vet_ikke"] as const, tid: TID, verksted: KILDE, tidligere: [false, true] }, (v) =>
      tekst(tidspunkt(lagSak(v.lov, { tidligere: tidligere(v.lov, v.tidligere), feil: FEILSETT[v.feilsett](v.tid, "nei", v.verksted) }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("rettslig-tidspunkt"));
  });

  it("praksis er vedtaksavsnittet uendret, og utelates uten vedtak", () => {
    const s = lagSak("etter_2024");
    expect(praksis(s)).toEqual([{ tekst: s.praksis!.avsnitt, kilde: "vedtak:22/2868", lenke: s.praksis!.kildeUrl }]);
    expect(praksis({ ...s, praksis: null })).toEqual([]);
  });
});

describe("avsnitt 4: krav", () => {
  it("gir samme tekst som sist for hver kombinasjon", async () => {
    const utlegg = { ingen: [], ett: [{ beskrivelse: "Tauing", belop: 1200 }], to: [{ beskrivelse: "Tauing.", belop: 1200 }, { beskrivelse: "Leiebil", belop: 3000 }] };
    const ut = samle({ krav: ["retting", "prisavslag", "heving"] as const, forsok: [0, 1, 2, 3], overslag: [null, 12_500], utlegg: Object.keys(utlegg) as (keyof typeof utlegg)[], feilsett: ["teknisk", "to_tekniske_ulik_tid"] as const }, (v) =>
      tekst(krav(lagSak("etter_2024", { krav: v.krav, forsok: v.forsok, overslag: v.overslag, utlegg: utlegg[v.utlegg], feil: FEILSETT[v.feilsett]("innen_6_mnd", "nei", "nei") }))),
    );
    await expect(ut).toMatchFileSnapshot(snapshot("krav"));
  });
});

describe("avsnitt 5: frist og vedlegg", () => {
  it("frist gir samme tekst som sist", async () => {
    const profiler = [STUB_PROFIL, { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon }, { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon, epost: "  " }, null];
    const ut = samle({ kjoper: profiler.map((_, i) => i) }, (v) => tekst(frist(lagSak("etter_2024", { kjoper: profiler[v.kjoper] }))) || "(ingen)");
    await expect(ut).toMatchFileSnapshot(snapshot("frist"));
  });

  it("vedlegg gir samme tekst som sist for hver kombinasjon", async () => {
    const ut = samle({ verksted: KILDE, opplysning: KILDE, utlegg: [false, true], tidligere: [null, "skriftlig", "muntlig"] as const }, (v) =>
      tekst(vedlegg(lagSak("etter_2024", { feil: FEILSETT.teknisk("innen_6_mnd", v.opplysning, v.verksted), utlegg: v.utlegg ? [{ beskrivelse: "Tauing", belop: 1200 }] : [], tidligere: v.tidligere ? { dato: TIDLIGERE_DATO.etter_2024, form: v.tidligere } : null }))) || "(ingen)",
    );
    await expect(ut).toMatchFileSnapshot(snapshot("vedlegg"));
  });
});

// The checks that hold for every letter, over a wide product of the answers.
describe("alle brev", () => {
  const FORBUDT = /\b(klart|åpenbart|utvilsomt)\b|jeg er klar over|jeg mener/i;
  const UGYLDIG = /undefined|\bnull\b|NaN|\[object|\{|\}|\s{2,}/;
  // The buyer's own words and the decision's quotes are not ours to word.
  const egne = (x: Setning) => x.kilde.startsWith("vedtak:") || x.kilde.endsWith(".beskrivelse");

  const brev = produkt({
    lov: LOV,
    somDenEr: SOM_DEN_ER,
    feilsett: FEILNAVN,
    tid: TID,
    opplysning: KILDE,
    verksted: KILDE,
    krav: ["retting", "prisavslag", "heving"] as const,
    forsok: [0, 2],
    tillegg: [false, true],
  }).map((v) => ({
    v,
    brev: byggBrev(
      lagSak(v.lov, {
        somDenEr: v.somDenEr,
        krav: v.krav,
        forsok: v.forsok,
        feil: FEILSETT[v.feilsett](v.tid, v.opplysning, v.verksted, v.tillegg ? "Bilen mistet kraft etter tre uker." : null),
        tidligere: tidligere(v.lov, v.tillegg),
        overslag: v.tillegg ? 12_500 : null,
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
