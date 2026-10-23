import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { AvgjorendeFeil } from "@/lib/avgjorende/skjema";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import type { Kandidat } from "@/lib/matching/typer";
import { byggStatistikk, type Statistikkrad, type Tellevedtak } from "./statistikk";
import type { Svar } from "@/lib/vedtaksvalg/kjoper";
import { bilnavnFra, celleFor, lignende, tallblokker } from "./vurdering";

// The model must never be reached before payment.
const velgVedtak = vi.fn();
vi.mock("@/lib/vedtaksvalg/valg", () => ({ velgVedtak }));

type Feil = { hoved: string; under: string[]; oppdaget: string };
const sak = (s: Partial<Omit<Svar, "feil">> & { feil?: Feil[] } = {}): Svar => {
  const { feil = [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01" }], ...rest } = s;
  return { kjopsdato: "2025-03-10", km: 142_000, ar: 2017, somDenEr: "nei", krav: null, forsok: null, ...rest, feil: feil.map((f) => ({ ...f, beskrivelse: null, opplysning: null, verksted: null, rapport: null })) };
};

const rad = (nokkel: string, n: number, m: number, r: Partial<Statistikkrad> = {}): Statistikkrad => ({
  nokkel,
  antallSaker: n,
  antallMedhold: m,
  fullt: 0,
  avslag: null,
  avslagAntall: 0,
  heving: 0,
  prisavslag: 0,
  retting: 0,
  erstatning: 0,
  ...r,
});


describe("tallene", () => {
  const statistikk = new Map([
    ["motor", rad("motor", 1009, 401, { heving: 81, prisavslag: 51, retting: 8 })],
    ["motor.turbo", rad("motor.turbo", 138, 54, { heving: 7 })],
    ["motor.eksos", rad("motor.eksos", 4, 2)],
    ["hoyvolt", rad("hoyvolt", 4, 1)],
  ]);

  it("bruker underkategorien når den har minst fem saker", () => {
    const [b] = tallblokker(sak(), statistikk);
    expect(b).toEqual({ nokkel: "motor.turbo", tema: "turbo", tall: { saker: 138, medhold: 54, heving: 7, prisavslag: 0, retting: 0, erstatning: 0 } });
  });

  it("faller tilbake til hovedkategorien under fem saker, og ved flere underkategorier", () => {
    expect(tallblokker(sak({ feil: [{ hoved: "motor", under: ["eksos"], oppdaget: "2025-04-01" }] }), statistikk)[0].nokkel).toBe("motor");
    expect(tallblokker(sak({ feil: [{ hoved: "motor", under: ["turbo", "eksos"], oppdaget: "2025-04-01" }] }), statistikk)[0].nokkel).toBe("motor");
    expect(tallblokker(sak({ feil: [{ hoved: "motor", under: [], oppdaget: "2025-04-01" }] }), statistikk)[0].tall).toMatchObject({ saker: 1009, heving: 81 });
  });

  it("gir ingen blokk under fem saker, og ingenting uten saker", () => {
    expect(tallblokker(sak({ feil: [{ hoved: "hoyvolt", under: [], oppdaget: "2025-04-01" }] }), statistikk)).toEqual([]);
    expect(tallblokker(sak({ feil: [{ hoved: "fukt", under: [], oppdaget: "2025-04-01" }] }), statistikk)).toEqual([]);
  });
});

describe("tellingen", () => {
  const feil = (id: string, under: string, utfall: AvledetFeil["utfall"]): AvledetFeil =>
    ({ id, hovedkategori: "motor", underkategori: under, komponent: null, utfall, samlet: false, avslagsgrunn: null, bevisgrunnlag: null, dager_etter_levering: null, viste_seg: "ukjent", formodning: "ikke_nevnt", sitat: null, tidsniva: 1 }) as AvledetFeil;
  const v = (id: number, utfall: string, f: AvledetFeil[], r: Partial<Tellevedtak> = {}): Tellevedtak => ({ id, utfall, sanksjoner: null, feil: f, avgjorende: null, ...r });

  it("teller vedtak der utvalget vurderte feilen, og medhold for feilen", () => {
    const rader = byggStatistikk([
      v(1, "medhold", [feil("a", "turbo", "medhold")], { sanksjoner: ["heving"] }),
      v(2, "ikke_medhold", [feil("a", "turbo", "avvist")]),
      v(3, "delvis_medhold", [feil("a", "turbo", "ikke_vurdert"), feil("b", "olje", "medhold")], { sanksjoner: ["prisavslag"] }),
      v(4, "avvist", [feil("a", "turbo", "avvist")]),
    ]);
    const turbo = rader.find((r) => r.nokkel === "motor.turbo")!;
    expect([turbo.antallSaker, turbo.antallMedhold, turbo.heving]).toEqual([2, 1, 1]);
    const motor = rader.find((r) => r.nokkel === "motor")!;
    expect([motor.antallSaker, motor.antallMedhold, motor.heving, motor.prisavslag]).toEqual([3, 2, 1, 1]);
    expect(rader.find((r) => r.nokkel === "alle")).toMatchObject({ antallSaker: 3, antallMedhold: 2 });
  });

  it("bruker sanksjonen for feilen alene når vedtaket har flere feil med medhold", () => {
    const a: AvgjorendeFeil = { id: "a", avgjorende: "", hjemmel: [], bevis: [], samlet_med: [], under_tvil: false, sanksjoner: ["retting"], sitater: [] };
    const rader = byggStatistikk([v(1, "medhold", [feil("a", "turbo", "medhold"), feil("b", "olje", "medhold")], { sanksjoner: ["heving"], avgjorende: { selger_svarte: true, feil: [a] } })]);
    expect(rader.find((r) => r.nokkel === "motor.turbo")).toMatchObject({ retting: 1, heving: 0 });
    // Two defects with medhold and no extraction for this one: what it got alone cannot be told.
    expect(rader.find((r) => r.nokkel === "motor.olje")).toMatchObject({ retting: 0, heving: 0 });
  });
});

describe("én definisjon av medhold", () => {
  const f = (id: string, hoved: string, utfall: AvledetFeil["utfall"], r: Partial<AvledetFeil> = {}): AvledetFeil =>
    ({ id, hovedkategori: hoved, underkategori: null, komponent: null, utfall, samlet: false, avslagsgrunn: null, bevisgrunnlag: null, dager_etter_levering: null, viste_seg: "ukjent", formodning: "ikke_nevnt", sitat: null, tidsniva: 1, ...r }) as AvledetFeil;
  const v = (id: number, utfall: string, feil: AvledetFeil[]): Tellevedtak => ({ id, utfall, sanksjoner: null, feil, avgjorende: null });

  it("«alle»: bare vedtak med vurdert feil, og medhold bare når en vurdert feil fikk medhold", () => {
    const rader = byggStatistikk([
      v(1, "medhold", [f("a", "motor", "medhold")]),
      // Won, but on no assessed defect (only a claim outside the car).
      v(2, "delvis_medhold", [f("a", "utenfor", "medhold"), f("b", "motor", "avvist")]),
      // No defect assessed at all.
      v(3, "medhold", [f("a", "motor", "ikke_vurdert")]),
    ]);
    expect(rader.find((r) => r.nokkel === "alle")).toMatchObject({ antallSaker: 2, antallMedhold: 1, fullt: 1 });
  });
  it("celler per kategori og tidsnivå, med den vanligste grunnen i de tapte", () => {
    const rader = byggStatistikk([
      v(1, "ikke_medhold", [f("a", "elektrisk", "avvist", { tidsniva: 2, avslagsgrunn: "ikke_sannsynliggjort_ved_levering" })]),
      v(2, "ikke_medhold", [f("a", "elektrisk", "avvist", { tidsniva: 2, avslagsgrunn: "ikke_sannsynliggjort_ved_levering" }), f("b", "elektrisk", "avvist", { tidsniva: 2, avslagsgrunn: "paregnelig_slitasje" })]),
      v(3, "delvis_medhold", [f("a", "elektrisk", "medhold", { tidsniva: 2 }), f("b", "elektrisk", "avvist", { tidsniva: 2, avslagsgrunn: "paregnelig_slitasje" })]),
      v(4, "medhold", [f("a", "elektrisk", "medhold", { tidsniva: 1 })]),
    ]);
    // The reasons in a decision the buyer won do not count.
    expect(rader.find((r) => r.nokkel === "elektrisk:2")).toMatchObject({ antallSaker: 3, antallMedhold: 1, fullt: 0, avslag: "ikke_sannsynliggjort_ved_levering", avslagAntall: 2 });
    expect(rader.find((r) => r.nokkel === "elektrisk:1")).toMatchObject({ antallSaker: 1, antallMedhold: 1, fullt: 1 });
    expect(rader.find((r) => r.nokkel === "elektrisk")).toMatchObject({ antallSaker: 4, antallMedhold: 2 });
  });
  it("cellen for kjøperen: bare etter formodningen, og bare fra 30 vedtak", () => {
    const stat = new Map([["elektrisk:2", rad("elektrisk:2", 61, 10, { avslag: "ikke_dokumentert", avslagAntall: 20 })], ["motor:2", rad("motor:2", 29, 9)], ["motor:1", rad("motor:1", 700, 300)]]);
    expect(celleFor([{ hoved: "motor", niva: 1 }], stat)).toBeNull();
    expect(celleFor([{ hoved: "motor", niva: 2 }], stat)).toBeNull();
    expect(celleFor([{ hoved: "motor", niva: 2 }, { hoved: "elektrisk", niva: 2 }], stat)).toMatchObject({ hoved: "elektrisk", niva: 2, saker: 61, medhold: 10, avslag: "ikke_dokumentert", avslagAntall: 20 });
  });
});

describe("kortene", () => {
  const SITAT = "Turboen var i dårligere stand enn klageren kunne forvente.";
  const f = (id: string): AvledetFeil =>
    ({ id, hovedkategori: "motor", underkategori: "turbo", komponent: null, utfall: "medhold", samlet: false, avslagsgrunn: null, bevisgrunnlag: null, dager_etter_levering: null, viste_seg: "ukjent", formodning: "ikke_nevnt", sitat: SITAT, tidsniva: 1 }) as AvledetFeil;
  const kandidat = (id: number, k: Partial<Kandidat> = {}): Kandidat => ({
    id,
    saksnummer: `FKU-2025-${id}`,
    vedtaksdato: "2025-05-01",
    km: 150_000 + id,
    alder: 12,
    somDenEr: false,
    sanksjoner: ["prisavslag", "erstatning"],
    mangelsgrunnlag: null,
    paragrafer: null,
    tvistetema: null,
    feil: [f("f1")],
    avgjorende: { selger_svarte: true, bil: `Bil ${id}`, feil: [{ id: "f1", avgjorende: "", hjemmel: [], bevis: [], samlet_med: [], under_tvil: false, sanksjoner: ["prisavslag"], sitater: [SITAT, "Feilen må ha vært til stede ved levering."] }] },
    ...k,
  });
  const alle = [1, 2, 3, 4, 5].map((i) => kandidat(i));
  const v = lignende({ svar: sak({ km: 120_000, ar: 2017 }), alle, statistikk: new Map(), bilnavn: () => null });

  it("er de tre øverste fra rangeringen, uten sitater og uten lenker", () => {
    expect(v.kort).toHaveLength(3);
    // Equal points: the ranking's order (date, then id).
    expect(v.kort.map((k) => k.saksnummer)).toEqual(["1", "2", "3"]);
    const json = JSON.stringify(v);
    expect(json).not.toContain("Turboen var");
    expect(json).not.toMatch(/«|https?:/);
    expect(v.kort[0]).toEqual({ id: 1, saksnummer: "1", ar: "2025", bil: "Bil 1", km: 150_001, somDenEr: false, fikk: ["prisavslag"], feil: "turbo" });
  });

  it("sammenligner bilen bare når det går i kjøperens favør", () => {
    expect(v.sammenligning).toBe("Bilen din er yngre og har gått kortere enn i disse sakene.");
    expect(lignende({ svar: sak({ km: 200_000, ar: 2010 }), alle, statistikk: new Map(), bilnavn: () => null }).sammenligning).toBeNull();
  });

  it("kaller aldri modellen", () => expect(velgVedtak).not.toHaveBeenCalled());

  it("tallene følger feilen kortene viser når kjøperen har flere feil", () => {
    const statistikk = new Map([
      ["klima", rad("klima", 300, 100)],
      ["motor.turbo", rad("motor.turbo", 138, 54)],
    ]);
    const r = lignende({ svar: sak({ km: 120_000, ar: 2017, feil: [{ hoved: "klima", under: [], oppdaget: "2025-04-01" }, { hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01" }] }), alle, statistikk, bilnavn: () => null });
    expect(r.kort[0].feil).toBe("turbo");
    expect(r.tall[0].nokkel).toBe("motor.turbo");
  });

  it("gir ingen kort uten vedtak på nivå A", () => expect(lignende({ svar: sak({ feil: [{ hoved: "fukt", under: ["lukt"], oppdaget: "2025-04-01" }] }), alle, statistikk: new Map(), bilnavn: () => null }).kort).toEqual([]));

  it.each(["src/app/sak/vurdering.ts", "src/app/sak/lignende-db.ts", "src/app/sak/brevet-actions.ts"])("nevner ikke modellen i %s", (fil) => {
    const kilde = readFileSync(fil, "utf8");
    expect(kilde).not.toMatch(/vedtaksvalg\/valg|@\/lib\/ai|velgVedtak|finnVedtak|anthropic/i);
  });
});

describe("bilnavnFra", () => {
  it("merke, modell og årsmodell", () => expect(bilnavnFra("Toyota", "RAV4", 2015)).toBe("Toyota RAV4 2015"));
  it("bare årsmodell", () => expect(bilnavnFra(null, null, 2014)).toBe("Bil, årsmodell 2014"));
  it("ingenting", () => expect(bilnavnFra(null, null, null)).toBeNull());
});
