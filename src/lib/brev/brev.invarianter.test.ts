// What must hold for every letter, checked on the twelve golden letters and on 200 generated cases.
// The generator makes only valid cases (no rule in tidslinje.ts or riktighet.ts stops them), and the
// test checks that it does, so it cannot drift into testing letters the form would never allow.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BREVDATO, SAKER, SELGERE, tilBrevsak } from "../../../scripts/simulerte-saker";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { STUB_PROFIL } from "@/lib/vipps/profil";
import praksisfil from "./__fixtures__/praksis.json";
import { alleSetninger, byggBrev, somTekst, tilDokument } from "./brev";
import { dato, km as kmTekst, kr, maaned, orgnr as orgnrTekst, tall } from "./format";
import { LOVORD, lovversjon, PARAGRAFER } from "./paragrafer";
import { overslagSum, RAPPORT_PUNKTER, type Rapport, SELGER_SVAR, VERKSTED_HVEM } from "./rapport";
import { vurderRiktighet } from "./riktighet";
import { dagerMellom, plussDager, vurderTidslinje } from "./tidslinje";
import type { Brev, Brevfeil, Brevsak, Kilde, Setning } from "./typer";
import { kategorivedlegg } from "./vedlegg";

const PRAKSIS = Object.values(praksisfil as Record<string, Brevsak["praksis"]>).filter((p): p is NonNullable<Brevsak["praksis"]> => !!p);
const FORBUDT = /\b(klart|åpenbart|utvilsomt|garantert)\b|jeg er klar over|jeg mener/i;
const MANED = "januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember";

// The decision's quotes and the buyer's own words are not ours to word.
const fremmed = (x: Setning) => x.kilde.startsWith("vedtak:") || x.kilde.endsWith(".beskrivelse") || x.kilde.endsWith(".konklusjon");

// The timeline and the correctness rules, as the form and the server judge the case.
function vurder(s: Brevsak) {
  const t = vurderTidslinje({
    kjop: s.kjopsdato,
    feil: s.feil.map((f, i) => ({ id: `${i}`, oppdaget: f.oppdaget, omtrentlig: f.omtrentlig, ...(f.rapport && { rapport: f.rapport.dato }) })),
    ...(s.kontakt && { reklamert: s.kontakt.dato }),
    idag: s.dato,
  });
  const r = vurderRiktighet({
    kjopsdato: s.kjopsdato,
    kjopesum: s.kjopesum,
    forsteRegistrert: s.bil.forsteRegistrert,
    somDenEr: s.somDenEr,
    krav: s.krav,
    forsok: s.kontakt?.forsok ?? 0,
    svar: s.kontakt?.svar ?? null,
    feil: s.feil.map((f) => ({ ...f, konklusjon: f.rapport?.konklusjon ?? null })),
    utlegg: s.utlegg,
    selger: { orgnr: s.selger.orgnr, status: null, naeringskode: null },
  });
  return { stopp: [...t.stopp, ...r.stopp] };
}

// Lines on an A4 page in the Word file (Calibri 11, the margins in docx.ts): about 88 characters to a
// line, 54 lines to a page, and a paragraph's space after counted as most of a line. An estimate: the
// test cannot lay the page out the way Word does.
function sider(b: Brev): number {
  const linjer = tilDokument(b).reduce((t, g) => t + g.reduce((u, l) => u + Math.max(1, Math.ceil(l.tekst.length / 88)), 0) + 0.9, 0);
  return linjer / 54;
}

// Everything that must hold, as a list of what does not.
function avvik(s: Brevsak, b: Brev, golden: boolean): string[] {
  const ut: string[] = [];
  const v = lovversjon(s.kjopsdato);
  const setninger = alleSetninger(b);
  const egne = b.avsnitt.flatMap((a) => a.blokker.flatMap((x) => ("setninger" in x ? x.setninger : []))).filter((x) => !fremmed(x));
  const tekst = somTekst(b);

  if (/undefined|\bnull\b|NaN|«»/.test(tekst)) ut.push("tomt felt");
  for (const x of setninger) {
    if (!x.kilde.trim()) ut.push(`uten kilde: ${x.tekst}`);
    if (!fremmed(x) && / {2,}/.test(x.tekst)) ut.push(`doble mellomrom: ${x.tekst}`);
    if (!fremmed(x) && FORBUDT.test(x.tekst)) ut.push(`forsterker: ${x.tekst}`);
  }
  if (/norsk bil/i.test(tekst)) ut.push("«norsk bil»");

  // Every paragraph is one of the table for the buyer's version of the law.
  const refs = [...Object.values(PARAGRAFER[v]).filter((p): p is string => !!p), LOVORD.kravTredjeFjerde.replace("kravene i ", "")].sort((a, c) => c.length - a.length);
  for (const x of egne) {
    let rest = x.tekst;
    for (const r of refs) rest = rest.split(r).join("");
    if (rest.includes("§")) ut.push(`paragraf utenfor tabellen (${v}): ${x.tekst}`);
  }

  // Every date is in the timeline or is the letter's own.
  const datoer = new Set([s.kjopsdato, s.dato, ...(s.kontakt ? [s.kontakt.dato] : []), ...s.feil.flatMap((f) => [f.oppdaget, ...(f.rapport ? [f.rapport.dato] : [])])].map(dato));
  const maaneder = new Set(s.feil.filter((f) => f.omtrentlig).map((f) => maaned(f.oppdaget)));
  for (const x of egne) {
    for (const m of x.tekst.matchAll(new RegExp(`\\b\\d{1,2}\\. (${MANED}) \\d{4}`, "g"))) if (!datoer.has(m[0])) ut.push(`dato utenfor tidslinjen: ${m[0]}`);
    for (const m of x.tekst.matchAll(new RegExp(`\\bi ((${MANED}) \\d{4})`, "g"))) if (!maaneder.has(m[1])) ut.push(`måned utenfor tidslinjen: ${m[1]}`);
  }

  // Every figure is from the answers.
  const utleggSum = s.utlegg.reduce((t, u) => t + u.belop, 0);
  const tallene = new Set([s.kjopesum, s.km, utleggSum, ...s.utlegg.map((u) => u.belop), overslagSum(s)?.sum, s.bil.forsteRegistrert, 14].filter((n): n is number => typeof n === "number").map(String));
  for (const x of egne) {
    let rest = x.tekst.replace(new RegExp(`\\b\\d{1,2}\\. (${MANED}) \\d{4}`, "g"), "").replace(new RegExp(`(${MANED}) \\d{4}`, "g"), "");
    for (const r of refs) rest = rest.split(r).join("");
    // Figures that come with a name from the registry or Vipps: the model («V70»), the plate, the
    // organisation number and the telephone number.
    rest = rest
      .replace(`${s.bil.merke} ${s.bil.modell}`, "")
      .replace(orgnrTekst(s.selger.orgnr), "")
      .replace(s.bil.regnr, "")
      .replace(s.kjoper?.telefon ?? "\u0000", "")
      .replace("1.1.2024", "");
    for (const m of rest.matchAll(/\d{1,3}(?: \d{3})+|\d+/g)) if (!tallene.has(m[0].replace(/ /g, ""))) ut.push(`tall utenfor svarene: ${m[0]} i «${x.tekst}»`);
  }

  // Every name is from Vipps, the register, the vehicle registry or the buyer's report.
  if (s.kjoper && b.avsender[0]?.tekst !== s.kjoper.navn) ut.push("avsender er ikke kjøperen fra Vipps");
  if (s.kjoper && b.hilsen.at(-1)?.tekst !== s.kjoper.navn) ut.push("signaturen er ikke kjøperen fra Vipps");
  if (b.mottaker[0]?.tekst !== s.selger.navn) ut.push("mottaker er ikke selgeren fra registeret");
  if (!b.tittel.tekst.includes(`${s.bil.merke} ${s.bil.modell}`)) ut.push("bilen i tittelen er ikke bilen fra vegvesenet");
  const verksteder = new Set(s.feil.flatMap((f) => (f.rapport ? [f.rapport.navn] : [])));
  for (const m of tekst.matchAll(/Rapport fra (.+) av /g)) if (!verksteder.has(m[1])) ut.push(`verksted som ikke er oppgitt: ${m[1]}`);

  // One claim, the one the buyer chose.
  const krav = egne.filter((x) => x.tekst.startsWith("På dette grunnlaget"));
  const forventet = { retting: "krever jeg at mangel", prisavslag: "krever jeg prisavslag", heving: "hever jeg kjøpet" }[s.krav];
  if (krav.length !== 1 || !krav[0].tekst.includes(forventet)) ut.push(`kravet: ${krav.map((x) => x.tekst).join(" | ")}`);

  // Every enclosure follows from an answer, and every enclosure the letter mentions is listed.
  const vedlegg = b.vedlegg?.punkter.map((p) => p.tekst) ?? [];
  const har = (start: string) => vedlegg.some((p) => p.startsWith(start));
  if ((tekst.includes("Rapporten følger vedlagt") || tekst.includes("som følger vedlagt")) && !har("Rapport fra")) ut.push("rapport nevnt, ikke i vedlegg");
  if (tekst.includes("Kvitteringer vedlegges") && !har("Kvitteringer for utlegg")) ut.push("kvitteringer nevnt, ikke i vedlegg");
  if (har("Rapport fra") && !s.feil.some((f) => f.rapport)) ut.push("rapport i vedlegg uten rapport");
  if (tekst.includes("Dokumentasjon vedlegges") && !s.feil.some((f) => kategorivedlegg(f).some((t) => har(t)))) ut.push("dokumentasjon nevnt, ikke i vedlegg");
  if (har("Annonse/kjøpekontrakt") && !s.feil.some((f) => f.opplysning === "skriftlig")) ut.push("annonse i vedlegg uten skriftlig opplysning");
  if (har("Kvitteringer for utlegg") && !s.utlegg.length) ut.push("kvitteringer uten utlegg");
  if (har("Tidligere reklamasjon") && s.kontakt?.form !== "skriftlig") ut.push("tidligere reklamasjon uten skriftlig reklamasjon");

  // Two A4 pages at three defects.
  if (s.feil.length <= 3 && sider(b) > 2) ut.push(`over to sider (${sider(b).toFixed(2)})`);

  // The comparison in the decision's paragraph uses the same age and km as the rest of the letter.
  if (golden) {
    const p = setninger.find((x) => x.kilde.startsWith("vedtak:"))?.tekst ?? "";
    const alder = /var yngre \((\d+) mot/.exec(p)?.[1];
    if (alder && s.bil.forsteRegistrert && Number(alder) !== Number(s.kjopsdato.slice(0, 4)) - s.bil.forsteRegistrert) ut.push(`alder i sammenligningen: ${alder}`);
    const km = /hadde gått kortere \(([\d ]+) mot/.exec(p)?.[1];
    if (km && km !== tall(s.km)) ut.push(`km i sammenligningen: ${km}`);
    if (km && !tekst.includes(kmTekst(s.km))) ut.push("km i avsnitt 1 og i sammenligningen er ikke like");
  }
  return ut;
}

// A fixed draw, so a failure can be found again.
function trekk(frø: number) {
  let s = frø;
  const r = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const tall = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const en = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const noen = <T,>(xs: readonly T[], min: number, maks: number): T[] => [...xs].sort(() => r() - 0.5).slice(0, tall(min, Math.min(maks, xs.length)));
  return { r, tall, en, noen };
}

const KONKLUSJONER = [null, "Feilen er bekreftet og må utbedres.", "Skaden skyldes slitasje over lang tid; komponenten må skiftes."];
const BESKRIVELSER = [null, "Bilen mistet kraft etter tre uker.", "Lyden kommer ved kald motor og forsvinner etter noen minutter."];
const KILDER: Kilde[] = ["skriftlig", "muntlig", "nei"];

// A valid case: every rule that stops is respected by construction.
function generer(frø: number): Brevsak {
  const { r, tall: n, en, noen } = trekk(frø);
  const idag = BREVDATO;
  const kjopsdato = plussDager(idag, -n(40, 5 * 365 - 40));
  const hoveder = noen(HOVEDKATEGORIER, 1, 3);
  const feil: Brevfeil[] = hoveder.map((h) => {
    const oppdaget = plussDager(kjopsdato, n(1, dagerMellom(kjopsdato, idag)));
    const verksted = en(KILDER);
    const punkter = noen(RAPPORT_PUNKTER.map((p) => p.id), 1, 4);
    const rapport: Rapport | null =
      verksted === "skriftlig"
        ? {
            hvem: en(VERKSTED_HVEM).id,
            navn: en(["Nordre Bil og Verksted AS", "Sentrum Servicesenter AS"]),
            dato: plussDager(oppdaget, n(0, Math.min(180, dagerMellom(oppdaget, idag)))),
            punkter: RAPPORT_PUNKTER.map((p) => p.id).filter((p) => punkter.includes(p)),
            konklusjon: en(KONKLUSJONER),
            overslag: punkter.includes("overslag") && r() < 0.8 ? n(1, 80) * 1_000 : null,
          }
        : null;
    return {
      hoved: h.id,
      under: noen(h.under.map((u) => u.id), 0, 2),
      oppdaget,
      omtrentlig: r() < 0.3,
      beskrivelse: en(BESKRIVELSER),
      // A warranty is something the seller said or promised.
      opplysning: h.id === "garanti" ? en(["skriftlig", "muntlig"] as const) : en(KILDER),
      verksted,
      rapport,
    };
  });
  const forste = feil.map((f) => f.oppdaget).sort()[0];
  const kjopsar = Number(kjopsdato.slice(0, 4));
  return {
    dato: idag,
    kjoper: en([STUB_PROFIL, { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon }, { ...STUB_PROFIL, adresse: undefined }]),
    selger: (({ navn, orgnr, adresse }) => ({ navn, orgnr, adresse: adresse ? { ...adresse, linjer: [...adresse.linjer] } : null }))(en(SELGERE)),
    bil: { regnr: `ZB ${n(10000, 99999)}`, merke: en(["Volkswagen", "Toyota", "Volvo"]), modell: en(["Golf", "Corolla", "V70"]), forsteRegistrert: r() < 0.1 ? null : kjopsar - n(0, 20) },
    kjopsdato,
    km: n(5, 400) * 1_000,
    kjopesum: en([8_000, 19_000, 45_000, 150_000, 420_000, 1_200_000, 2_900_000]),
    somDenEr: en(["ja", "nei", "vet_ikke"] as const),
    feil,
    // Only «vet ikke» can only be repaired.
    krav: feil.every((f) => f.hoved === "vet_ikke") ? "retting" : en(["retting", "prisavslag", "heving"] as const),
    utlegg: noen([{ beskrivelse: "Tauing", belop: 1_800 }, { beskrivelse: "Leiebil", belop: 4_500 }], 0, 2),
    kontakt: r() < 0.5 ? (({ id }) => ({ dato: plussDager(forste, n(0, dagerMellom(forste, idag))), form: en(["skriftlig", "muntlig"] as const), svar: id, forsok: id === "forsokt" ? n(1, 3) : 0 }))(en(SELGER_SVAR)) : null,
    praksis: r() < 0.9 ? en(PRAKSIS) : null,
  };
}

describe("invariantene", () => {
  it("holder for de tolv gylne brevene", () => {
    const funn = SAKER.flatMap((x) => {
      const s = tilBrevsak(x, (praksisfil as Record<string, Brevsak["praksis"]>)[x.navn]);
      expect(vurder(s).stopp, x.navn).toEqual([]);
      return avvik(s, byggBrev(s), true).map((a) => `${x.navn}: ${a}`);
    });
    expect(funn).toEqual([]);
  });

  it("holder for 200 genererte gyldige saker", () => {
    const funn: string[] = [];
    for (let i = 1; i <= 200; i++) {
      const s = generer(20261013 + i);
      // The generator must make only cases the form allows.
      const stopp = vurder(s).stopp;
      if (stopp.length) funn.push(`sak ${i} er ugyldig: ${stopp.map((m) => m.regel).join(", ")}`);
      else funn.push(...avvik(s, byggBrev(s), false).map((a) => `sak ${i}: ${a}`));
    }
    expect(funn.slice(0, 10)).toEqual([]);
  });

  it("dekker de viktige grenene i de genererte sakene", () => {
    const saker = Array.from({ length: 200 }, (_, i) => generer(20261013 + i + 1));
    expect(saker.filter((s) => s.feil.length === 3).length).toBeGreaterThan(20);
    expect(saker.filter((s) => s.feil.some((f) => f.rapport)).length).toBeGreaterThan(50);
    expect(saker.filter((s) => s.kontakt).length).toBeGreaterThan(50);
    expect(saker.filter((s) => lovversjon(s.kjopsdato) === "før_2024").length).toBeGreaterThan(20);
    expect(new Set(saker.map((s) => s.krav)).size).toBe(3);
  });

  it("fanger et brudd når ett er plantet", () => {
    // Without this the test could pass by checking nothing.
    const s = generer(20261014);
    const b = byggBrev(s);
    const plant = (tekst: string): Brev => ({
      ...b,
      avsnitt: b.avsnitt.map((a, i) => (i === 0 ? { ...a, blokker: [{ setninger: [{ tekst, kilde: "fast" }] }, ...a.blokker] } : a)),
    });
    expect(avvik(s, b, false)).toEqual([]);
    expect(avvik(s, plant("Jeg viste til § 99 i loven."), false).join()).toContain("paragraf utenfor tabellen");
    expect(avvik(s, plant("Det skjedde den 1. januar 2020."), false).join()).toContain("dato utenfor tidslinjen");
    expect(avvik(s, plant("Det kostet kr 987\u00a0654."), false).join()).toContain("tall utenfor svarene");
    expect(avvik(s, plant("Det er klart en mangel."), false).join()).toContain("forsterker");
    expect(avvik(s, plant("En norsk bil."), false).join()).toContain("norsk bil");
    expect(avvik(s, plant("Rapporten følger vedlagt."), false).length > 0 || b.vedlegg?.punkter.some((p) => p.tekst.startsWith("Rapport fra"))).toBe(true);
  });

  it("regner lovversjonen bare ett sted", () => {
    // «2024-01-01» as a boundary is in paragrafer.ts and nowhere else in the code.
    const filer = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? filer(join(dir, f)) : [join(dir, f)]));
    const steder = filer("src")
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) && !f.includes("__snapshots__"))
      .filter((f) => readFileSync(f, "utf8").includes('"2024-01-01"'));
    expect(steder).toEqual(["src/lib/brev/paragrafer.ts"]);
  });
});

// Kept for reading the failures: the figures as the letter writes them.
export const _vis = { kr };
