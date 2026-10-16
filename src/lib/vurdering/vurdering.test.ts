import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { AvgjorendeFeil } from "@/lib/avgjorende/skjema";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import type { Kandidat } from "@/lib/matching/typer";
import { byggStatistikk, MIN_PRISAVSLAG, type Statistikkrad, type Tellevedtak } from "./statistikk";
import { vurderingSomTekst } from "./tekst";
import { plussManeder } from "@/lib/brev/tidslinje";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { byggVurdering, fristenErUte, lovlinjer, tallblokker, tallsetninger, type Vurderingssak, vurderStatus } from "./vurdering";

// The model must never be reached before step 7.
const velgVedtak = vi.fn();
vi.mock("@/lib/vedtaksvalg/valg", () => ({ velgVedtak }));

const IDAG = "2026-10-13";
const sak = (s: Partial<Vurderingssak> = {}): Vurderingssak => ({
  kjopsdato: "2025-03-10",
  idag: IDAG,
  km: 142_000,
  ar: 2017,
  somDenEr: "nei",
  feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01" }],
  ...s,
});
const regler = (s: Vurderingssak, a = true) => vurderStatus(s, a).grunner.map((g) => g.regel);

describe("statusen", () => {
  it.each([
    ["mer enn fem år siden kjøpet", sak({ kjopsdato: "2021-10-12" }), true, "ute", []],
    ["akkurat fem år siden kjøpet", sak({ kjopsdato: "2021-10-13", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2021-12-01" }] }), true, "sak", []],
    ["en vanlig sak med vedtak på nivå A", sak(), true, "sak", []],
    ["feil oppdaget mer enn to år etter overtakelsen", sak({ kjopsdato: "2023-03-01", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-03-02" }] }), true, "svak", ["feil_over_to_aar"]],
    ["feil oppdaget nøyaktig to år etter", sak({ kjopsdato: "2023-03-01", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-03-01" }] }), true, "sak", []],
    ["«som den er» før 2024 på en bil over 10 år", sak({ kjopsdato: "2023-05-02", ar: 2012, km: 90_000, somDenEr: "ja", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2023-06-01" }] }), true, "svak", ["som_den_er_gammel"]],
    ["«som den er» før 2024 med over 200 000 km", sak({ kjopsdato: "2023-05-02", ar: 2018, km: 200_001, somDenEr: "ja", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2023-06-01" }] }), true, "svak", ["som_den_er_gammel"]],
    ["«som den er» fra 2024 på en gammel bil", sak({ kjopsdato: "2024-05-02", ar: 2005, km: 300_000, somDenEr: "ja", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2024-06-01" }] }), true, "sak", []],
    ["en gammel bil uten «som den er»", sak({ kjopsdato: "2023-05-02", ar: 2005, km: 300_000, somDenEr: "nei", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2023-06-01" }] }), true, "sak", []],
    ["en slitedel oppdaget etter seks måneder", sak({ feil: [{ hoved: "drivlinje", under: ["clutch"], oppdaget: "2025-09-11" }] }), true, "svak", ["slitedel_sen"]],
    ["en slitedel oppdaget innen seks måneder", sak({ feil: [{ hoved: "drivlinje", under: ["clutch"], oppdaget: "2025-09-10" }] }), true, "sak", []],
    ["ingen vedtak på nivå A", sak(), false, "svak", ["ingen_niva_a"]],
  ] as const)("%s", (_navn, s, a, status, forventet) => {
    expect(vurderStatus(s, a).status).toBe(status);
    if (status !== "ute") expect(regler(s, a)).toEqual(forventet);
  });

  it("gir ingen betalingsknapp og ingen pris når fristen er ute", () => {
    const v = byggVurdering({ sak: sak({ kjopsdato: "2020-07-31" }), alle: [], statistikk: new Map(), bilnavn: () => null });
    expect(v.status).toBe("ute");
    const tekst = vurderingSomTekst(v, "2020-07-31");
    expect(tekst).toContain("Forbrukerrådet");
    expect(tekst).not.toMatch(/Fortsett|kr\.|Betal/);
  });
});

describe("lovlinjene", () => {
  const kombinasjoner = [
    ["før 2024, innen formodningen", sak({ kjopsdato: "2023-05-02", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2023-09-01" }] })],
    ["før 2024, etter formodningen", sak({ kjopsdato: "2023-05-02", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2024-01-01" }] })],
    ["fra 2024, innen formodningen", sak({ kjopsdato: "2025-03-10", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2026-03-01" }] })],
    ["fra 2024, etter formodningen", sak({ kjopsdato: "2024-01-10", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2026-03-01" }] })],
    ["før 2024, «som den er»", sak({ kjopsdato: "2023-05-02", somDenEr: "ja", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2023-09-01" }] })],
    ["fra 2024, «som den er»", sak({ somDenEr: "ja" })],
    ["«vet ikke» om forbeholdet", sak({ somDenEr: "vet_ikke" })],
    ["to feil, én innen og én etter formodningen", sak({ kjopsdato: "2023-05-02", feil: [{ hoved: "motor", under: [], oppdaget: "2023-09-01" }, { hoved: "klima", under: ["ac"], oppdaget: "2024-02-01" }] })],
    ["to feil innen formodningen", sak({ feil: [{ hoved: "motor", under: [], oppdaget: "2025-05-01" }, { hoved: "klima", under: [], oppdaget: "2025-06-01" }] })],
    ["feil i det selgeren sa (ingen formodning)", sak({ feil: [{ hoved: "historikk", under: ["km"], oppdaget: "2025-05-01" }] })],
    ["over to år siden kjøpet, slitedel", sak({ kjopsdato: "2024-01-10", feil: [{ hoved: "understell", under: ["bremser"], oppdaget: "2024-03-01" }] })],
    ["over to år siden kjøpet, ikke slitedel", sak({ kjopsdato: "2024-01-10", feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2024-03-01" }] })],
  ] as const;

  it("er faste tekster valgt av kode, med paragraf fra paragrafer.ts", async () => {
    const tekst = kombinasjoner.map(([navn, s]) => `## ${navn}\n${lovlinjer(s).map((l) => `[${l.ikon}${l.uthevet ? ", uthevet" : ""}] ${l.tekst}${l.paragraf ? ` (${l.paragraf})` : ""}`).join("\n")}`).join("\n\n");
    await expect(`${tekst}\n`).toMatchFileSnapshot("__snapshots__/lovlinjer.txt");
  });

  // Every case that is not past the five years has at least one line in the buyer's favour: every kind
  // of defect and subcategory, purchases before and after 2024, the defect showing itself early and
  // late, and each answer about «som den er», alone and with a second defect.
  it("har alltid minst én linje i kjøperens favør", () => {
    const valg = HOVEDKATEGORIER.flatMap((h) => [{ hoved: h.id, under: [] as string[] }, ...h.under.map((u) => ({ hoved: h.id, under: [u.id] }))]);
    const uten: string[] = [];
    let n = 0;
    for (const kjopsdato of ["2021-11-01", "2022-06-01", "2023-05-02", "2023-12-20", "2024-01-10", "2024-09-01", "2025-03-10", "2026-06-01"])
      for (const m of [1, 5, 7, 18, 23, 25, 40]) {
        const oppdaget = plussManeder(kjopsdato, m);
        if (oppdaget > IDAG) continue;
        for (const somDenEr of ["ja", "nei", "vet_ikke"] as const)
          for (const f of valg)
            for (const feil of [[{ ...f, oppdaget }], [{ hoved: "klima", under: ["ac"], oppdaget: plussManeder(kjopsdato, 1) }, { ...f, oppdaget }]]) {
              const s = sak({ kjopsdato, somDenEr, feil });
              if (fristenErUte(s.kjopsdato, s.idag) || new Set(feil.map((x) => x.hoved)).size < feil.length) continue;
              n++;
              if (!lovlinjer(s).some((l) => l.ikon === "ja")) uten.push(`${kjopsdato} +${m} mnd, «som den er» ${somDenEr}: ${feil.map((x) => [x.hoved, ...x.under].join(".")).join(" + ")}`);
            }
      }
    expect(n).toBeGreaterThan(10_000);
    expect(uten).toEqual([]);
  });

  it("har aldri et paragrafnummer i selve teksten", () => {
    for (const [, s] of kombinasjoner) for (const l of lovlinjer(s)) expect(l.tekst).not.toMatch(/§/);
  });
});

const rad = (nokkel: string, n: number, m: number, r: Partial<Statistikkrad> = {}): Statistikkrad => ({
  nokkel,
  antallSaker: n,
  antallMedhold: m,
  heving: 0,
  prisavslag: 0,
  retting: 0,
  erstatning: 0,
  prisavslagMedianProsent: null,
  alderMedian: null,
  kmMedian: null,
  ...r,
});

describe("tallene", () => {
  const statistikk = new Map([
    ["motor", rad("motor", 1009, 401, { heving: 81, prisavslag: 51, retting: 8, prisavslagMedianProsent: 16.7 })],
    ["motor.turbo", rad("motor.turbo", 138, 54, { heving: 7 })],
    ["motor.eksos", rad("motor.eksos", 4, 2)],
    ["hoyvolt", rad("hoyvolt", 4, 1)],
  ]);

  it("bruker underkategorien når den har minst fem saker", () => {
    const [b] = tallblokker(sak(), statistikk);
    expect(b.nokkel).toBe("motor.turbo");
    expect(tallsetninger(b)).toEqual([
      "Utvalget har behandlet 138 saker om turbo i brukte biler kjøpt fra forhandler. I 54 av dem fikk kjøperen medhold.",
      "Kjøperen fikk heving i 7 av sakene med medhold.",
    ]);
  });

  it("faller tilbake til hovedkategorien under fem saker, og ved flere underkategorier", () => {
    expect(tallblokker(sak({ feil: [{ hoved: "motor", under: ["eksos"], oppdaget: "2025-04-01" }] }), statistikk)[0].nokkel).toBe("motor");
    expect(tallblokker(sak({ feil: [{ hoved: "motor", under: ["turbo", "eksos"], oppdaget: "2025-04-01" }] }), statistikk)[0].nokkel).toBe("motor");
    expect(tallsetninger(tallblokker(sak({ feil: [{ hoved: "motor", under: [], oppdaget: "2025-04-01" }] }), statistikk)[0]).at(-1)).toBe("Prisavslagene lå typisk på 17 % av kjøpesummen.");
  });

  it("viser ingen tall under fem saker, og ingenting uten saker", () => {
    const [b] = tallblokker(sak({ feil: [{ hoved: "hoyvolt", under: [], oppdaget: "2025-04-01" }] }), statistikk);
    expect(b.tall).toBeNull();
    expect(tallsetninger(b)).toEqual(["Vi har vedtak om høyvoltbatteri og lading (elbil og hybrid)."]);
    expect(tallsetninger(b).join(" ")).not.toMatch(/\d/);
    expect(tallblokker(sak({ feil: [{ hoved: "fukt", under: [], oppdaget: "2025-04-01" }] }), statistikk)).toEqual([]);
  });
});

describe("tellingen", () => {
  const feil = (id: string, under: string, utfall: AvledetFeil["utfall"]): AvledetFeil =>
    ({ id, hovedkategori: "motor", underkategori: under, komponent: null, utfall, samlet: false, avslagsgrunn: null, bevisgrunnlag: null, dager_etter_levering: null, viste_seg: "ukjent", formodning: "ikke_nevnt", sitat: null, tidsniva: 1 }) as AvledetFeil;
  const v = (id: number, utfall: string, f: AvledetFeil[], r: Partial<Tellevedtak> = {}): Tellevedtak => ({ id, utfall, alder: 10, km: 100_000, prisavslagProsent: null, sanksjoner: null, feil: f, avgjorende: null, ...r });

  it("teller vedtak der utvalget vurderte feilen, og medhold for feilen", () => {
    const rader = byggStatistikk([
      v(1, "medhold", [feil("a", "turbo", "medhold")], { sanksjoner: ["heving"] }),
      v(2, "ikke_medhold", [feil("a", "turbo", "avvist")]),
      v(3, "delvis_medhold", [feil("a", "turbo", "ikke_vurdert"), feil("b", "olje", "medhold")], { sanksjoner: ["prisavslag"], prisavslagProsent: 10 }),
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

  it("gir median prisavslag først fra ti vedtak", () => {
    const mange = (n: number) => byggStatistikk(Array.from({ length: n }, (_, i) => v(i, "medhold", [feil("a", "turbo", "medhold")], { sanksjoner: ["prisavslag"], prisavslagProsent: i + 1 })));
    expect(mange(MIN_PRISAVSLAG - 1).find((r) => r.nokkel === "motor.turbo")!.prisavslagMedianProsent).toBeNull();
    expect(mange(MIN_PRISAVSLAG).find((r) => r.nokkel === "motor.turbo")!.prisavslagMedianProsent).toBe(5.5);
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
  const v = byggVurdering({ sak: sak({ km: 120_000, ar: 2017 }), alle, statistikk: new Map(), bilnavn: () => null });

  it("er de tre øverste fra rangeringen, uten sitater og uten lenker", () => {
    expect(v.kort).toHaveLength(3);
    // Equal points: the ranking's order (date, then id).
    expect(v.kort.map((k) => k.saksnummer)).toEqual(["1", "2", "3"]);
    const json = JSON.stringify(v);
    expect(json).not.toContain("Turboen var");
    expect(json).not.toMatch(/«|https?:/);
    expect(v.kort[0]).toEqual({ id: 1, saksnummer: "1", ar: "2025", bil: "Bil 1", km: 150_001, somDenEr: false, fikk: ["prisavslag"] });
  });

  it("sammenligner bilen bare når det går i kjøperens favør", () => {
    expect(v.sammenligning).toBe("Bilen din er yngre og har gått kortere enn i disse sakene.");
    expect(byggVurdering({ sak: sak({ km: 200_000, ar: 2010 }), alle, statistikk: new Map(), bilnavn: () => null }).sammenligning).toBeNull();
  });

  it("kaller aldri modellen", () => expect(velgVedtak).not.toHaveBeenCalled());

  it("nevner ikke modellen i serverhandlingen for steg 4", () => {
    const kilde = readFileSync("src/app/sak/vurdering.ts", "utf8");
    expect(kilde).not.toMatch(/vedtaksvalg\/valg|@\/lib\/ai|velgVedtak|finnVedtak|anthropic/i);
  });
});

describe("ordene før betalingsmuren", () => {
  // The brief's forbidden words, and the letter's intensifiers. «sannsynliggjøre» is a different word, and
  // «klart» is left out: «klart til å sende» (ready) is the brief's own text, not an intensifier.
  // «svak» is a status in the code, never a word the buyer reads («svakt», «svakere»).
  const FORBUDT = /(^|[^\p{L}])(vinne|vinner|vinn|sannsynlig|sannsynligvis|åpenbart|utvilsomt)(?![\p{L}])|(^|[^\p{L}])(garanter|svak)|prosent sjanse/iu;
  it("finnes ikke på vurderingsskjermen for de tolv sakene", () => {
    const gylne = JSON.parse(readFileSync("src/lib/vurdering/__fixtures__/gylne.json", "utf8")) as Record<string, Parameters<typeof vurderingSomTekst>[0]>;
    for (const [navn, v] of Object.entries(gylne)) expect(vurderingSomTekst(v, "2025-01-01"), navn).not.toMatch(FORBUDT);
  });
  it("finnes ikke i skjermens faste tekster", () => {
    for (const fil of ["src/app/sak/vurderingsvisning.tsx", "src/lib/vurdering/vurdering.ts", "src/lib/brev/riktighet.ts", "src/lib/brev/tidslinje.ts", "src/app/sak/skjema.tsx", "src/app/page.tsx"]) {
      const tekster = [...readFileSync(fil, "utf8").matchAll(/"([^"\n]*[a-zæøå]{3,}[^"\n]*)"|>([^<>{}\n]*[a-zæøå]{3,}[^<>{}\n]*)</g)].map((m) => m[1] ?? m[2]);
      for (const t of tekster.filter((t) => t !== "svak")) expect(t, fil).not.toMatch(FORBUDT);
    }
  });
});
