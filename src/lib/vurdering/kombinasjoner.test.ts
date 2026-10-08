import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { kjopsalderAv, oppdagetMulig, sporOmFemarsfrist, tilKlageInput, TOM_INNSENDING, type Innsending } from "./innsending";
import type { Statistikk } from "./statistikk";
import { KJOPSFORM_VALG, OPPDAGET_VALG, OPPLYST_VALG } from "./typer";
import { vurder } from "./vurder";
import { POST } from "@/app/api/vurder/route";

// The statistics need the database; the route is tested with a neutral stub (no points either way).
vi.mock("@/lib/vurdering/statistikk", () => ({
  hentStatistikk: async () => ({ n: 200, vunnet: 120, andel: 0.6, lav: 0.55, hoy: 0.65, basis: 0.6, trinn: 1, beskrivelse: "test", spesifikk: true }),
}));

// 1000 random but valid form submissions, run through the same path as the real form: validation,
// the engine and the API route. Only what the assessment asks before purchase is answered: when the car
// was bought, who from, whether the dealer was told within five years (over five years only), how long
// after the purchase the defect showed and whether the buyer knew about it. The expected level is worked
// out here from the rules as the user would state them, not by calling the engine's own functions.

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
    ...TOM_INNSENDING,
    // Two thirds from a dealer; the rest is stopped by the law at the first step.
    kjopsform: velg(["forhandler", "forhandler", "forhandler", "forhandler", "privatperson", "firma"] as const),
    // The end of the month, but not after today: the form no longer accepts a purchase in the future.
    kjopsdato: maanedsslutt(ar, maned) > IDAG ? IDAG : maanedsslutt(ar, maned),
    opplystForKjop: velg(OPPLYST_VALG),
  };
  const mulige = OPPDAGET_VALG.filter((o) => oppdagetMulig(i, o, IDAG));
  i.oppdaget = velg(mulige);
  i.kjopAlder = kjopsalderAv(i, IDAG);
  if (sporOmFemarsfrist(i, IDAG)) i.reklamertInnenFemAr = velg(["ja", "nei"] as const);
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

type Forventet = { niva: "sak" | "utenfor"; stopp: "firma" | "privat" | "frist" | "kjent" | null; varsler: RegExp[] };

function forventet(i: Innsending): Forventet {
  const kjop = i.kjopsdato;
  const kjopAr = Number(kjop.slice(0, 4));
  const kjopManed = Number(kjop.slice(5, 7));

  // Complaining is possible for five years: past them, the buyer must have complained within them.
  const fristSlutt = maanedsslutt(kjopAr + 5, kjopManed);
  const fristUte = IDAG > fristSlutt && i.reklamertInnenFemAr === "nei";
  // Before 2024 a defect the buyer knew of, as it is, cannot be complained about (§ 16 third paragraph as it read then).
  const toAar = kjop >= "2024-01-01";
  const kjent = i.opplystForKjop === "ja_som_opplyst" && !toAar;

  // The law itself stops the claim: not a purchase from a dealer, past the five-year limit, or a known defect.
  const stopp = i.kjopsform === "firma" ? "firma" : i.kjopsform === "privatperson" ? "privat" : fristUte ? "frist" : kjent ? "kjent" : null;
  if (stopp) return { niva: "utenfor", stopp, varsler: [] };

  // Presumption that the defect was there at delivery: six months, two years for purchases from 2024.
  const presumsjon = i.oppdaget === "innen_6_mnd" || (i.oppdaget === "6_mnd_til_2_ar" && toAar);
  const periode = toAar ? "2 år" : "6 måneder";
  return {
    niva: "sak",
    stopp: null,
    varsler: [
      presumsjon
        ? new RegExp(`^Feilen viste seg innen ${periode} etter kjøpet\\. Da er det forhandleren som må vise`)
        : new RegExp(`^Feilen viste seg mer enn ${periode} etter kjøpet\\. Da må du vise .* vurdering fra verksted`),
      ...(i.opplystForKjop === "ja_verre" ? [/^Du visste om feilen, men den er verre eller annerledes enn du fikk vite\. Brevet bygger på forskjellen\.$/] : []),
    ],
  };
}

const TITTEL: Record<"sak" | "utenfor", RegExp> = {
  // The same title for every case the law does not stop; the warning says what the buyer must know.
  sak: /^Du kan ha en sak mot forhandleren\.$/,
  utenfor: /^(Forbrukerkjøpsloven gjelder ikke for dette kjøpet\.|Forbrukerkjøpsloven gjelder ikke når du kjøper av en privatperson\.|Fristen for å reklamere er trolig ute\.|Du kan ikke klage på en feil du kjente til da du kjøpte bilen\.)$/,
};


describe(`${ANTALL} tilfeldige skjemaregistreringer`, () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${IDAG}T12:00:00Z`));
  });
  afterAll(() => vi.useRealTimers());

  const innsendinger = Array.from({ length: ANTALL }, lagInnsending);

  it("dekker kjøpsform, tidspunkt, opplysning og femårsfristen bredt, og svarer ikke på noe annet", () => {
    for (const o of OPPDAGET_VALG) expect(innsendinger.filter((i) => i.oppdaget === o).length, o).toBeGreaterThan(100);
    for (const o of OPPLYST_VALG) expect(innsendinger.filter((i) => i.opplystForKjop === o).length, o).toBeGreaterThan(150);
    for (const k of KJOPSFORM_VALG) expect(innsendinger.filter((i) => i.kjopsform === k).length, k).toBeGreaterThan(100);
    expect(innsendinger.filter((i) => i.reklamertInnenFemAr !== "").length).toBeGreaterThan(50);
    expect(innsendinger.filter((i) => i.opplystForKjop === "ja_som_opplyst" && i.kjopsdato < "2024-01-01" && i.kjopsform === "forhandler").length).toBeGreaterThan(50);
    for (const i of innsendinger) expect({ ...i, kjopsform: "", kjopAlder: "", kjopsdato: "", oppdaget: "", opplystForKjop: "", reklamertInnenFemAr: "" }).toEqual(TOM_INNSENDING);
    expect(new Set(innsendinger.map((i) => JSON.stringify(i))).size).toBeGreaterThan(800);
  });

  it("alle godtas av valideringen", () => {
    const avvist = innsendinger.map((i) => tilKlageInput(i, IDAG)).filter((r) => !r.ok);
    expect(avvist).toEqual([]);
  });

  it("gir forventet vurdering i alle fire statistikkscenarier", async () => {
    const avvik: string[] = [];
    const teller = { sak: 0, utenfor: 0 };

    for (const [n, i] of innsendinger.entries()) {
      const parsed = tilKlageInput(i, IDAG);
      if (!parsed.ok) continue;

      for (const s of SCENARIER) {
        const v = await vurder(parsed.input, { hentStatistikk: async () => s.stat, idag: IDAG });
        const f = forventet(i);
        const merke = `#${n} ${s.navn} ${JSON.stringify(i)}`;

        if (v.niva !== f.niva) avvik.push(`${merke}: forventet ${f.niva}, fikk ${v.niva}`);
        if (s === SCENARIER[0]) teller[v.niva]++;

        if (f.niva === "sak" && (v.varsler.length !== f.varsler.length || f.varsler.some((r, n) => !r.test(v.varsler[n])))) avvik.push(`${merke}: varsler ${JSON.stringify(v.varsler)}`);
        if (f.stopp === "kjent" && !/§ 16 tredje ledd/.test(v.begrunnelse)) avvik.push(`${merke}: kjent feil mangler forklaring`);
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

        // A claim the law stops has one reason, no warnings and no statistics.
        if (f.niva === "utenfor" && (v.grunnlag.length !== 1 || v.varsler.length !== 0 || v.statistikk !== null)) avvik.push(`${merke}: stoppet sak skal ha ett grunnlag og ingen varsler eller statistikk`);
      }
    }

    console.info("Fordeling (nøytral statistikk):", teller);
    expect(avvik.slice(0, 15)).toEqual([]);
    expect(avvik).toHaveLength(0);
    expect(teller.sak).toBeGreaterThan(300);
    expect(teller.utenfor).toBeGreaterThan(300);
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
      // A stopped claim: the one point and no warnings. Otherwise the warnings, no points and the comparison.
      if (f.niva === "utenfor" && (json.grunnlag.length !== 1 || json.varsler.length !== 0 || json.utvalg !== null)) avvik.push(`${merke}: stoppet sak skal bare ha ett punkt`);
      if (f.niva === "sak" && (json.grunnlag.length !== 0 || json.varsler.length !== f.varsler.length || !json.utvalg)) avvik.push(`${merke}: sak skal ha varsler og utvalg, ingen punkter`);
      const nokler = Object.keys(json).sort().join(",");
      if (nokler !== "begrunnelse,grunnlag,niva,tittel,utvalg,varsler") avvik.push(`${merke}: uventede felt i svaret: ${nokler}`);
      if (json.utvalg && Object.keys(json.utvalg).sort().join(",") !== "n,vunnet") avvik.push(`${merke}: uventede felt i utvalget`);
    }
    expect(avvik.slice(0, 15)).toEqual([]);
  });

  it("ruten avviser skjemaer som ikke kan stemme", async () => {
    const mal = innsendinger.find((i) => i.kjopsdato.startsWith("2022") && i.kjopsform === "forhandler" && i.opplystForKjop === "nei")!;
    const stor = { ...mal, kjopsdato: "2027-03-31" };
    const ukjentOppdaget = { ...mal, oppdaget: "aldri" };
    const nyligKjop = { ...mal, kjopsdato: "2026-09-30", oppdaget: "over_2_ar" };
    const utenOpplyst = { ...mal, opplystForKjop: "" };
    const ukjentOpplyst = { ...mal, opplystForKjop: "kanskje" };
    const utenFemar = { ...mal, kjopsdato: "2019-05-31", reklamertInnenFemAr: "" };
    const utenKjopsform = { ...mal, kjopsform: "" };
    // What the assessment does not ask is still checked when it is sent.
    const ugyldigRapport = { ...mal, verkstedrapport: "kanskje" };
    for (const [navn, kropp] of Object.entries({ stor, ukjentOppdaget, nyligKjop, utenOpplyst, ukjentOpplyst, utenFemar, utenKjopsform, ugyldigRapport, tom: {}, liste: [] })) {
      const res = await POST(new Request("http://localhost/api/vurder", { method: "POST", headers: { "x-forwarded-for": `10.2.0.${navn.length}${navn.charCodeAt(0)}` }, body: JSON.stringify(kropp) }));
      expect(res.status, navn).toBe(400);
    }
  });
});
