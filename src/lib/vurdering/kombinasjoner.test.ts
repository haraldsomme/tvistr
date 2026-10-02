import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FEILTYPER_KNAPPER, oppdagetMulig, sporOmReklamasjonsdato, tilKlageInput, type Innsending } from "./innsending";
import type { Statistikk } from "./statistikk";
import { FEILOPPLYSNING_VALG, KONTAKT_VALG, OPPDAGET_VALG, type FeilKnapp } from "./typer";
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
    feiltyper: [],
    kjopAr: String(ar),
    kjopManed: String(maned),
    kjopesum: "",
    kmVedKjop: "",
    oppdaget: "",
    opplystForKjop: velg(["ja", "nei", "usikker"] as const),
    feilOpplysning: velg(FEILOPPLYSNING_VALG),
    kontakt: velg(KONTAKT_VALG),
    reklamasjonManed: "",
    reklamasjonAr: "",
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
  if (sporOmReklamasjonsdato(i, IDAG)) {
    // Any month from the purchase month to now, so some are past the five-year deadline and some are not.
    const fra = ar * 12 + (maned - 1);
    const til = 2026 * 12 + 9;
    const m = fra + Math.floor(tilfeldig() * (til - fra + 1));
    i.reklamasjonAr = String(Math.floor(m / 12));
    i.reklamasjonManed = String((m % 12) + 1);
  }
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

type Forventet = { niva: "sterk" | "middels" | "svak" | "ikke_aktuell"; fristUte: boolean };

function forventet(i: Innsending, s: Statistikk): Forventet {
  const kjopAr = Number(i.kjopAr);
  const kjopManed = Number(i.kjopManed);
  const kjop = maanedsslutt(kjopAr, kjopManed);

  // Complaining is possible for five years. With no complaint yet it is today that counts; otherwise the first complaint.
  const fristSlutt = maanedsslutt(kjopAr + 5, kjopManed);
  const klaget = i.kontakt !== "nei";
  const fristUte = !klaget ? IDAG > fristSlutt : i.reklamasjonAr !== "" && maanedsslutt(Number(i.reklamasjonAr), Number(i.reklamasjonManed)) > fristSlutt;
  if (fristUte) return { niva: "ikke_aktuell", fristUte };

  // Presumption that the defect was there at delivery: six months, two years for purchases from 2024.
  const toAar = kjop >= "2024-01-01";
  const presumsjon = i.oppdaget === "innen_6_mnd" || (i.oppdaget === "6_mnd_til_2_ar" && toAar);

  const rapport = i.verkstedrapport === "ja";
  const rapportSierFor = rapport && i.rapportSierForKjop === "ja";
  const rapportTiger = rapport && i.rapportSierForKjop === "nei";
  const harBevis = rapport || i.bilder === "ja";

  let poeng = 0;
  if (s.spesifikk && s.lav > s.basis) poeng += 1;
  if (s.spesifikk && s.hoy < s.basis) poeng -= 1;
  if (presumsjon) poeng += rapportSierFor ? 3 : 2;
  else poeng += rapportSierFor ? 2 : -1;
  if (i.kontakt === "forsokt") poeng += 2;
  if (i.feilOpplysning === "ja_dokumentert") poeng += 1;

  let niva: "sterk" | "middels" | "svak" = poeng >= 3 ? "sterk" : poeng >= 1 ? "middels" : "svak";
  // Told about the defect: decisive for purchases before 2024; from 2024 the buyer must also have accepted it expressly.
  if (i.opplystForKjop === "ja" && i.feilOpplysning === "nei") niva = toAar ? (niva === "sterk" ? "middels" : niva) : "svak";
  if (i.opplystForKjop === "ja" && i.feilOpplysning === "ja_udokumentert" && niva === "sterk") niva = "middels";
  if (niva === "sterk" && presumsjon && rapportTiger) niva = "middels";
  if (niva === "sterk" && !harBevis) niva = "middels";
  // A cheap or far-driven car is never a strong case when the defect can be put down to wear.
  const slitasjefeil = i.feiltyper.some((t) => t !== "km_service" && t !== "skade" && t !== "annet") || i.feiltyper.every((t) => t === "annet");
  if (niva === "sterk" && slitasjefeil && (Number(i.kjopesum) < 50_000 || Number(i.kmVedKjop) > 200_000)) niva = "middels";
  return { niva, fristUte };
}

const TITTEL: Record<"sterk" | "middels" | "svak", RegExp> = {
  sterk: /^Du har etter alt å dømme krav på (prisavslag eller heving|at forhandleren retter feilen)\.$/,
  middels: /^Du kan ha krav på (prisavslag eller heving|at forhandleren retter feilen)\.$/,
  svak: /^Det blir vanskelig å nå fram med et krav slik saken står nå\.$/,
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
  km_service: "kilometerstand eller service",
  skade: "kollisjonsskade",
  batteri: "elbilbatteriet",
};

const MAL = /^I 20\d\d fikk kjøperen av en .+ (ikke |delvis )?medhold etter å ha klaget på .+ (etter|som) kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at .+)\.$/;

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
    expect(innsendinger.filter((i) => i.reklamasjonAr !== "").length).toBeGreaterThan(50);
    expect(new Set(innsendinger.map((i) => JSON.stringify(i))).size).toBeGreaterThan(950);
  });

  it("alle godtas av valideringen", () => {
    const avvist = innsendinger.map((i) => tilKlageInput(i, IDAG)).filter((r) => !r.ok);
    expect(avvist).toEqual([]);
  });

  it("gir forventet vurdering og et eksempelvedtak i alle fire statistikkscenarier", async () => {
    const avvik: string[] = [];
    const teller = { sterk: 0, middels: 0, svak: 0, ikke_aktuell: 0, lignende: 0, tilnaermet: 0, generell: 0, tapt: 0, vunnet: 0 };
    const batteriBare: number[] = [];

    for (const [n, i] of innsendinger.entries()) {
      const parsed = tilKlageInput(i, IDAG);
      if (!parsed.ok) continue;
      const grupper = [...new Set(i.feiltyper)].filter((f) => FRASE[f]);

      for (const s of SCENARIER) {
        const v = await vurder(parsed.input, { hentStatistikk: async () => s.stat, idag: IDAG });
        const f = forventet(i, s.stat);
        const merke = `#${n} ${s.navn} ${JSON.stringify(i)}`;

        if (v.niva !== f.niva) avvik.push(`${merke}: forventet ${f.niva}, fikk ${v.niva} (poeng ${v.poeng})`);
        if (s === SCENARIER[0]) teller[v.niva]++;

        if (f.niva === "ikke_aktuell") {
          if (v.eksempel !== null) avvik.push(`${merke}: frist ute skal ikke ha eksempel`);
          if (!/Fristen for å klage er dessverre ute/.test(v.tittel)) avvik.push(`${merke}: feil tittel ved frist ute: ${v.tittel}`);
          if (v.grunnlag.length !== 1 || v.grunnlag[0].paragraf !== "forbrukerkjøpsloven § 27") avvik.push(`${merke}: frist ute mangler henvisning til § 27`);
          continue;
        }

        if (!TITTEL[f.niva].test(v.tittel)) avvik.push(`${merke}: tittel «${v.tittel}» passer ikke til ${f.niva}`);
        const krav = i.kontakt === "forsokt" || i.kontakt === "avvist" ? "prisavslag eller heving" : "at forhandleren retter feilen";
        if (f.niva !== "svak" && !v.tittel.includes(krav)) avvik.push(`${merke}: tittelen skal nevne «${krav}»`);
        if (/undefined|NaN|null|\[object/.test(`${v.tittel} ${v.begrunnelse} ${v.grunnlag.map((g) => g.tekst).join(" ")}`)) avvik.push(`${merke}: teknisk rest i tekst`);
        if (v.grunnlag.length < 1) avvik.push(`${merke}: grunnlaget er tomt`);
        for (const g of v.grunnlag) if (Boolean(g.lenke) !== Boolean(g.paragraf)) avvik.push(`${merke}: paragraf og lenke må følges åt`);

        const e = v.eksempel;
        if (!e) {
          avvik.push(`${merke}: INGEN eksempelsak`);
          continue;
        }
        if (s === SCENARIER[0]) {
          teller[e.treff]++;
          teller[e.utfall]++;
        }
        if (!MAL.test(e.setning)) avvik.push(`${merke}: setning følger ikke malen: ${e.setning}`);
        if (!e.kildeUrl.startsWith("https://") || !e.saksnummer) avvik.push(`${merke}: eksempelet mangler kilde`);
        if (e.utfall !== (f.niva === "svak" ? "tapt" : "vunnet")) avvik.push(`${merke}: ${f.niva} skal ha ${f.niva === "svak" ? "tapt" : "vunnet"} sak, fikk ${e.utfall}`);
        if (/ ikke medhold /.test(e.setning) !== (e.utfall === "tapt")) avvik.push(`${merke}: setningen passer ikke til utfallet ${e.utfall}`);

        if (grupper.length === 0) {
          if (e.treff !== "generell") avvik.push(`${merke}: uten egen feilgruppe skal eksempelet være generelt, fikk ${e.treff}`);
          if (s === SCENARIER[0] && i.feiltyper.every((t) => t === "batteri" || t === "annet") && i.feiltyper.includes("batteri")) batteriBare.push(n);
        } else {
          if (e.treff === "generell") avvik.push(`${merke}: har feilgruppe men fikk generelt eksempel`);
          if (!grupper.some((g) => e.setning.includes(FRASE[g]!))) avvik.push(`${merke}: eksempelet handler ikke om en av de valgte feilene (${grupper.join(", ")}): ${e.setning}`);
        }
        if (e.setning.includes("gjort kjent med feilen") && !(f.niva === "svak" && i.opplystForKjop === "ja" && i.feilOpplysning === "nei" && Number(i.kjopAr) < 2024)) {
          avvik.push(`${merke}: «opplyst»-eksempel uten at feilen var opplyst`);
        }
      }
    }

    console.info("Fordeling (nøytral statistikk):", teller);
    console.info(`Registreringer med bare «Batteri» (og evt. «Annet») som feil, som får generelt eksempel: ${batteriBare.length}`);
    expect(avvik.slice(0, 15)).toEqual([]);
    expect(avvik).toHaveLength(0);
    expect(teller.sterk).toBeGreaterThan(50);
    expect(teller.middels).toBeGreaterThan(50);
    expect(teller.svak).toBeGreaterThan(50);
    expect(teller.ikke_aktuell).toBeGreaterThan(10);
    expect(teller.lignende).toBeGreaterThan(300);
    expect(teller.tilnaermet).toBeGreaterThan(0);
    expect(teller.generell).toBeGreaterThan(0);
  });

  it("API-ruten gir samme resultat og lekker ikke poeng eller statistikk", async () => {
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
      const f = forventet(i, SCENARIER[0].stat);
      const merke = `#${n} ${JSON.stringify(i)}`;
      if (res.status !== 200) {
        avvik.push(`${merke}: status ${res.status} ${JSON.stringify(json)}`);
        continue;
      }
      if (json.niva !== f.niva) avvik.push(`${merke}: forventet ${f.niva}, fikk ${json.niva}`);
      if (f.niva === "ikke_aktuell") {
        if (json.eksempel !== null) avvik.push(`${merke}: frist ute skal ikke ha eksempel`);
      } else if (!json.eksempel?.setning || !json.eksempel?.kildeUrl || !json.eksempel?.saksnummer) {
        avvik.push(`${merke}: ruten ga ingen eksempelsak`);
      } else if (json.eksempel.utfall !== (f.niva === "svak" ? "tapt" : "vunnet")) {
        avvik.push(`${merke}: feil utfall på eksempelet: ${json.eksempel.utfall}`);
      }
      const nokler = Object.keys(json).sort().join(",");
      if (nokler !== "begrunnelse,eksempel,grunnlag,niva,tiltak,tittel,utvalg") avvik.push(`${merke}: uventede felt i svaret: ${nokler}`);
      if (f.niva !== "svak" && f.niva !== "ikke_aktuell" && json.tiltak.some((t: { tekst?: string }) => t.tekst !== undefined)) avvik.push(`${merke}: tiltakstekst skal ikke sendes ut gratis`);
    }
    expect(avvik.slice(0, 15)).toEqual([]);
  });

  it("ruten avviser skjemaer som ikke kan stemme", async () => {
    const mal = innsendinger.find((i) => i.kjopAr === "2022" && i.verkstedrapport === "nei")!;
    const stor = { ...mal, kjopAr: "2027" };
    const ukjentOppdaget = { ...mal, oppdaget: "aldri" };
    const utenFeil = { ...mal, feiltyper: [] };
    const nyligKjop = { ...mal, kjopAr: "2026", kjopManed: "9", oppdaget: "over_2_ar" };
    const uten = { ...mal, kontakt: "" };
    for (const [navn, kropp] of Object.entries({ stor, ukjentOppdaget, utenFeil, nyligKjop, uten, tom: {}, liste: [] })) {
      const res = await POST(new Request("http://localhost/api/vurder", { method: "POST", headers: { "x-forwarded-for": `10.2.0.${navn.length}${navn.charCodeAt(0)}` }, body: JSON.stringify(kropp) }));
      expect(res.status, navn).toBe(400);
    }
  });
});
