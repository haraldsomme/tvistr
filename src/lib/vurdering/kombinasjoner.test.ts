import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FEILTYPER_KNAPPER, kjopsalderAv, oppdagetMulig, sporOmFemarsfrist, tilKlageInput, type Innsending } from "./innsending";
import type { Statistikk } from "./statistikk";
import { FEILOPPLYSNING_VALG, KJOPSFORM_VALG, KONTAKT_VALG, OPPDAGET_VALG, type FeilKnapp } from "./typer";
import { vurder } from "./vurder";
import { POST } from "@/app/api/vurder/route";

// The statistics need the database; the route is tested with a neutral stub (no points either way).
vi.mock("@/lib/vurdering/statistikk", () => ({
  hentStatistikk: async () => ({ n: 200, vunnet: 120, andel: 0.6, lav: 0.55, hoy: 0.65, basis: 0.6, trinn: 1, beskrivelse: "test", spesifikk: true }),
}));

// 1000 random but valid form submissions, run through the same path as the real form: validation,
// the engine and the API route. The expected level is worked out here from the rules as the user
// would state them, not by calling the engine's own functions.

const IDAG = "2026-10-01";
const ANTALL = 1000;

// Small seeded generator so a failure can be reproduced.
function frø(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tilfeldig = frø(20261001);
const velg = <T>(liste: readonly T[]): T => liste[Math.floor(tilfeldig() * liste.length)];
const sjanse = (p: number) => tilfeldig() < p;

// A purchase month between 2012 and the current month, most of them recent.
function kjopMaaned(): { ar: number; maned: number } {
  const ar = sjanse(0.55) ? 2021 + Math.floor(tilfeldig() * 6) : 2012 + Math.floor(tilfeldig() * 9);
  const maned = 1 + Math.floor(tilfeldig() * (ar === 2026 ? 10 : 12));
  return { ar, maned };
}

function lagInnsending(): Innsending {
  const { ar, maned } = kjopMaaned();
  const i: Innsending = {
    // Two thirds from a dealer; the rest is stopped by the law at the first step.
    kjopsform: velg(["forhandler", "forhandler", "forhandler", "forhandler", "privatperson", "firma"] as const),
    feiltyper: [],
    // The end of the month, but not after today: the form no longer accepts a purchase in the future.
    kjopAlder: "",
    kjopsdato: maanedsslutt(ar, maned) > IDAG ? IDAG : maanedsslutt(ar, maned),
    kjopesum: "",
    kmVedKjop: "",
    oppdaget: "",
    opplystForKjop: velg(["ja", "nei"] as const),
    feilOpplysning: velg(FEILOPPLYSNING_VALG),
    kontakt: velg(KONTAKT_VALG),
    reklamertInnenFemAr: "",
    verkstedrapport: velg(["ja", "nei"] as const),
    rapportSierForKjop: "",
    bilder: "",
  };
  const antall = 1 + Math.floor(tilfeldig() * 4);
  while (i.feiltyper.length < antall) {
    const f = velg(FEILTYPER_KNAPPER);
    if (!i.feiltyper.includes(f)) i.feiltyper.push(f);
  }
  const mulige = OPPDAGET_VALG.filter((o) => oppdagetMulig(i, o, IDAG));
  i.oppdaget = velg(mulige);
  if (i.verkstedrapport === "ja") i.rapportSierForKjop = velg(["ja", "nei"] as const);
  else i.bilder = velg(["ja", "nei"] as const);
  i.kjopAlder = kjopsalderAv(i, IDAG);
  if (sporOmFemarsfrist(i, IDAG)) i.reklamertInnenFemAr = velg(["ja", "nei"] as const);
  // A third are cheap, a third far-driven, so every combination of the two shows up.
  i.kjopesum = String(sjanse(0.33) ? 15_000 + Math.floor(tilfeldig() * 35_000) : 50_000 + Math.floor(tilfeldig() * 450_000));
  i.kmVedKjop = String(sjanse(0.33) ? 200_001 + Math.floor(tilfeldig() * 150_000) : Math.floor(tilfeldig() * 200_001));
  return i;
}

// ---- Expected result, from the rules as stated in the product, with the statistics scenario as input.

type Scenario = { navn: string; stat: Statistikk };
const stat = (lav: number, hoy: number, spesifikk = true): Statistikk => ({ n: 200, vunnet: 120, andel: (lav + hoy) / 2, lav, hoy, basis: 0.6, trinn: 1, beskrivelse: "test", spesifikk });
const SCENARIER: Scenario[] = [
  { navn: "nøytral", stat: stat(0.55, 0.65) },
  { navn: "klart bedre enn vanlig", stat: stat(0.7, 0.8) },
  { navn: "klart dårligere enn vanlig", stat: stat(0.4, 0.5) },
  { navn: "bredt utvalg", stat: stat(0.7, 0.8, false) },
];

const maanedsslutt = (ar: number, maned: number) => new Date(Date.UTC(ar, maned, 0)).toISOString().slice(0, 10);

// A date plus months; the 31st plus a month lands on the last day of a shorter month.
function pluss(dato: string, maneder: number): string {
  const [ar, maned, dag] = dato.split("-").map(Number);
  const mal = maned - 1 + maneder;
  const siste = new Date(Date.UTC(ar + Math.floor(mal / 12), (mal % 12) + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ar + Math.floor(mal / 12), mal % 12, Math.min(dag, siste))).toISOString().slice(0, 10);
}

type Forventet = { niva: "god" | "svak" | "utenfor"; stopp: "firma" | "privat" | "frist" | null };

function forventet(i: Innsending): Forventet {
  const kjop = i.kjopsdato;
  const kjopAr = Number(kjop.slice(0, 4));
  const kjopManed = Number(kjop.slice(5, 7));

  // Complaining is possible for five years. With no complaint yet it is today that counts; otherwise whether the first complaint came within them.
  const fristSlutt = maanedsslutt(kjopAr + 5, kjopManed);
  const fristUte = IDAG > fristSlutt && (i.kontakt === "nei" || i.reklamertInnenFemAr === "nei");

  // The law itself stops the claim: not a purchase from a dealer, or past the five-year limit.
  const stopp = i.kjopsform === "firma" ? "firma" : i.kjopsform === "privatperson" ? "privat" : fristUte ? "frist" : null;
  if (stopp) return { niva: "utenfor", stopp };

  // Presumption that the defect was there at delivery: six months, two years for purchases from 2024.
  const toAar = kjop >= "2024-01-01";
  const presumsjon = i.oppdaget === "innen_6_mnd" || (i.oppdaget === "6_mnd_til_2_ar" && toAar);

  const rapport = i.verkstedrapport === "ja";
  const rapportSierFor = rapport && i.rapportSierForKjop === "ja";

  // Outside the presumption only a report that points back to before the purchase lifts the case.
  let niva: "god" | "svak" = !presumsjon && !rapportSierFor ? "svak" : "god";
  // Knew about the defect: decisive for purchases before 2024; from 2024 the buyer must also have accepted it expressly.
  if (i.opplystForKjop === "ja" && i.feilOpplysning === "nei" && !toAar) niva = "svak";
  // Has not told the dealer, and the latest the defect can have shown is over a year ago («mer enn 2 år» has no latest).
  const senest = { innen_6_mnd: 6, "6_mnd_til_2_ar": 24 }[i.oppdaget as "innen_6_mnd"];
  if (i.kontakt === "nei" && senest !== undefined && IDAG > pluss(kjop, senest + 12)) niva = "svak";
  return { niva, stopp: null };
}

const TITTEL: Record<"god" | "svak" | "utenfor", RegExp> = {
  // The same title whatever the level; the page lists what speaks for and against the case.
  god: /^Du kan ha en sak mot forhandleren\.$/,
  svak: /^Du kan ha en sak mot forhandleren\.$/,
  utenfor: /^(Forbrukerkjøpsloven gjelder ikke for dette kjøpet\.|Forbrukerkjøpsloven gjelder ikke når du kjøper av en privatperson\.|Fristen for å reklamere er trolig ute\.)$/,
};

// How each defect button shows up in an example sentence. «Annet» has no group of its own.
const FRASE: Partial<Record<FeilKnapp, string>> = {
  motor: "motorfeil",
  girkasse: "girkassen",
  elektrisk: "elektrisk feil",
  understell: "understellet",
  bremser: "bremsefeil",
  rust: "rust",
  fukt: "fukt eller lekkasje",
  klimaanlegg: "klimaanlegget",
  km_service: "service",
  // The decisions speak of an earlier damage, not always of a collision.
  skade: "skade",
  batteri: "elbilbatteriet",
};

const MAL = /^I 20\d\d fikk kjøper(en|ne) av en .+ (delvis )?medhold etter å ha klaget på .+ (etter|som) kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at .+)\.$/;

describe(`${ANTALL} tilfeldige skjemaregistreringer`, () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${IDAG}T12:00:00Z`));
  });
  afterAll(() => vi.useRealTimers());

  const innsendinger = Array.from({ length: ANTALL }, lagInnsending);

  it("dekker feiltyper, tidspunkt, kontakt og bevis bredt", () => {
    for (const f of FEILTYPER_KNAPPER) expect(innsendinger.filter((i) => i.feiltyper.includes(f)).length, f).toBeGreaterThan(150);
    for (const o of OPPDAGET_VALG) expect(innsendinger.filter((i) => i.oppdaget === o).length, o).toBeGreaterThan(100);
    for (const k of KONTAKT_VALG) expect(innsendinger.filter((i) => i.kontakt === k).length, k).toBeGreaterThan(150);
    for (const k of KJOPSFORM_VALG) expect(innsendinger.filter((i) => i.kjopsform === k).length, k).toBeGreaterThan(100);
    expect(innsendinger.filter((i) => i.reklamertInnenFemAr !== "").length).toBeGreaterThan(50);
    expect(new Set(innsendinger.map((i) => JSON.stringify(i))).size).toBeGreaterThan(950);
  });

  it("alle godtas av valideringen", () => {
    const avvist = innsendinger.map((i) => tilKlageInput(i, IDAG)).filter((r) => !r.ok);
    expect(avvist).toEqual([]);
  });

  it("gir forventet vurdering og et eksempelvedtak i alle fire statistikkscenarier", async () => {
    const avvik: string[] = [];
    const teller = { god: 0, svak: 0, utenfor: 0, lignende: 0, tilnaermet: 0, regel: 0 };

    for (const [n, i] of innsendinger.entries()) {
      const parsed = tilKlageInput(i, IDAG);
      if (!parsed.ok) continue;
      const grupper = [...new Set(i.feiltyper)].filter((f) => FRASE[f]);

      for (const s of SCENARIER) {
        const v = await vurder(parsed.input, { hentStatistikk: async () => s.stat, idag: IDAG });
        const f = forventet(i);
        const merke = `#${n} ${s.navn} ${JSON.stringify(i)}`;

        if (v.niva !== f.niva) avvik.push(`${merke}: forventet ${f.niva}, fikk ${v.niva}`);
        if (s === SCENARIER[0]) teller[v.niva]++;

        if (f.stopp === "frist") {
          if (!v.grunnlag.some((g) => g.paragraf === "forbrukerkjøpsloven § 27")) avvik.push(`${merke}: frist ute mangler henvisning til § 27`);
          if (!/mer enn fem år/.test(v.begrunnelse)) avvik.push(`${merke}: frist ute mangler forklaring`);
        }

        if (!TITTEL[f.niva].test(v.tittel)) avvik.push(`${merke}: tittel «${v.tittel}» passer ikke til ${f.niva}`);
        if (
          /undefined|NaN|null|\[object/.test(
            `${v.tittel} ${v.begrunnelse} ${v.grunnlag.map((g) => g.tekst).join(" ")}`,
          )
        )
          avvik.push(`${merke}: teknisk rest i tekst`);
        if (v.grunnlag.length < 1) avvik.push(`${merke}: grunnlaget er tomt`);
        for (const g of v.grunnlag) if (Boolean(g.lenke) !== Boolean(g.paragraf)) avvik.push(`${merke}: paragraf og lenke må følges åt`);

        // A claim the law stops has one reason, no example, no advice and no statistics.
        if (f.niva === "utenfor") {
          if (v.grunnlag.length !== 1 || v.eksempel !== null || v.tiltak.length !== 0 || v.statistikk !== null) avvik.push(`${merke}: stoppet sak skal ha ett grunnlag og ingen eksempel, tiltak eller statistikk`);
          continue;
        }

        const e = v.eksempel;
        if (!e) {
          avvik.push(`${merke}: INGEN henvisning`);
          continue;
        }
        const h = e.henvisning;
        if (s === SCENARIER[0]) teller[e.treff]++;
        if (!MAL.test(h.setning)) avvik.push(`${merke}: setning følger ikke malen: ${h.setning}`);
        if (!h.kildeUrl.startsWith("https://") || !h.ref) avvik.push(`${merke}: henvisningen mangler kilde`);
        if (/ ikke medhold /.test(h.setning)) avvik.push(`${merke}: henvisningen skal være en sak kjøperen vant: ${h.setning}`);
        if (grupper.length === 0 && e.treff !== "regel") avvik.push(`${merke}: uten egen feilgruppe skal henvisningen være en regel-sak, fikk ${e.treff}`);
        if (e.treff !== "regel" && !grupper.some((g) => h.setning.includes(FRASE[g]!))) avvik.push(`${merke}: henvisningen handler ikke om en av de valgte feilene (${grupper.join(", ")}): ${h.setning}`);
      }
    }

    console.info("Fordeling (nøytral statistikk):", teller);
    expect(avvik.slice(0, 15)).toEqual([]);
    expect(avvik).toHaveLength(0);
    expect(teller.god).toBeGreaterThan(50);
    expect(teller.svak).toBeGreaterThan(50);
    expect(teller.lignende).toBeGreaterThan(300);
    expect(teller.regel).toBeGreaterThan(0);
  });

  it("API-ruten gir samme resultat og lekker ikke statistikk", async () => {
    const avvik: string[] = [];
    for (const [n, i] of innsendinger.entries()) {
      const res = await POST(
        new Request("http://localhost/api/vurder", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": `10.1.${n >> 8}.${n & 255}` },
          body: JSON.stringify(i),
        }),
      );
      const json = await res.json();
      const f = forventet(i);
      const merke = `#${n} ${JSON.stringify(i)}`;
      if (res.status !== 200) {
        avvik.push(`${merke}: status ${res.status} ${JSON.stringify(json)}`);
        continue;
      }
      if (json.niva !== f.niva) avvik.push(`${merke}: forventet ${f.niva}, fikk ${json.niva}`);
      if (f.niva === "utenfor") {
        if (json.eksempel !== null || json.styrker.length !== 0 || json.svakheter.length !== 1) avvik.push(`${merke}: stoppet sak skal bare ha ett punkt og ingen eksempel`);
      } else if (!json.eksempel?.setning || !json.eksempel?.kildeUrl || !json.eksempel?.ref || !json.eksempel?.organ) {
        avvik.push(`${merke}: ruten ga ingen henvisning`);
      }
      // Strengths: exactly three for a good case; weaknesses never hold a point that speaks for the case.
      if (f.niva === "god" && json.styrker.length !== 3) avvik.push(`${merke}: god sak skal ha tre styrker, fikk ${json.styrker.length}`);
      if (json.styrker.some((p: { vekt: string }) => p.vekt !== "for") || json.svakheter.some((p: { vekt: string }) => p.vekt === "for")) avvik.push(`${merke}: punkt i feil liste`);
      const nokler = Object.keys(json).sort().join(",");
      if (nokler !== "begrunnelse,eksempel,niva,styrker,svakheter,tiltak,tittel,utvalg") avvik.push(`${merke}: uventede felt i svaret: ${nokler}`);
      if (f.niva !== "svak" && json.tiltak.some((t: { tekst?: string }) => t.tekst !== undefined)) avvik.push(`${merke}: tiltakstekst skal ikke sendes ut gratis`);
    }
    expect(avvik.slice(0, 15)).toEqual([]);
  });

  it("ruten avviser skjemaer som ikke kan stemme", async () => {
    const mal = innsendinger.find((i) => i.kjopsdato.startsWith("2022") && i.verkstedrapport === "nei" && i.kjopsform === "forhandler")!;
    const stor = { ...mal, kjopsdato: "2027-03-31" };
    const ukjentOppdaget = { ...mal, oppdaget: "aldri" };
    const utenFeil = { ...mal, feiltyper: [] };
    const nyligKjop = { ...mal, kjopsdato: "2026-09-30", oppdaget: "over_2_ar" };
    const uten = { ...mal, kontakt: "" };
    const utenKjopsform = { ...mal, kjopsform: "" };
    for (const [navn, kropp] of Object.entries({ stor, ukjentOppdaget, utenFeil, nyligKjop, uten, utenKjopsform, tom: {}, liste: [] })) {
      const res = await POST(new Request("http://localhost/api/vurder", { method: "POST", headers: { "x-forwarded-for": `10.2.0.${navn.length}${navn.charCodeAt(0)}` }, body: JSON.stringify(kropp) }));
      expect(res.status, navn).toBe(400);
    }
  });
});
