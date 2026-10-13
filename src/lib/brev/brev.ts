import { bakgrunn } from "./bakgrunn";
import { frist } from "./frist";
import { avsender, mottaker, stedDato, tittel } from "./hode";
import { krav } from "./krav";
import { mangelen } from "./mangelen";
import { mangel, praksis, tidspunkt } from "./rettslig";
import type { Avsnitt, Blokk, Brev, Brevsak, Setning } from "./typer";
import { vedlegg } from "./vedlegg";

const fast = (tekst: string): Setning => ({ tekst, kilde: "fast" });
const blokk = (setninger: Setning[], forhandsvis?: boolean): Blokk[] => (setninger.length ? [{ setninger, ...(forhandsvis && { forhandsvis }) }] : []);

// The whole letter, built from the answers and nothing else. Every sentence carries its source.
export function byggBrev(s: Brevsak): Brev {
  const deler: [string, Blokk[]][] = [
    ["Sakens bakgrunn", blokk(bakgrunn(s), true)],
    ["Mangelen", mangelen(s).flatMap((b) => blokk(b))],
    ["Rettslig vurdering", [...blokk(mangel(s)), ...blokk(tidspunkt(s)), ...blokk(praksis(s), true)]],
    ["Krav", krav(s).flatMap((b) => blokk(b))],
    ["Frist for tilbakemelding", blokk(frist(s))],
  ];
  const avsnitt: Avsnitt[] = deler.map(([navn, blokker], i) => ({ nr: i + 1, overskrift: fast(`${i + 1}. ${navn}`), blokker }));
  const punkter = vedlegg(s);
  return {
    avsender: avsender(s),
    stedDato: stedDato(s),
    mottaker: mottaker(s),
    tittel: tittel(s),
    avsnitt,
    hilsen: [fast("Med vennlig hilsen"), ...(s.kjoper ? [{ tekst: s.kjoper.navn, kilde: "vipps:navn" }] : [])],
    vedlegg: punkter.length ? { overskrift: fast("Vedlegg:"), punkter } : null,
  };
}

const tegn = (b: Blokk) => ("skjult" in b ? b.skjult : b.setninger.reduce((n, x) => n + x.tekst.length, 0));

// What is shown before payment: the heading, the background and the paragraph citing the decision.
// The rest is replaced by its length alone, so the hidden text is never sent to the browser.
export function forhandsvisning(b: Brev): Brev {
  return {
    ...b,
    avsnitt: b.avsnitt.map((a) => ({
      ...a,
      blokker: a.blokker.map((x): Blokk => ("setninger" in x && x.forhandsvis ? x : { skjult: Math.round(tegn(x) / 10) * 10 })),
    })),
    hilsen: [],
    vedlegg: null,
  };
}

// A line of the document. `skjult` is the length of a hidden block, drawn as blurred bars.
export type Linje = { tekst: string; stil: "adresse" | "stedDato" | "tittel" | "overskrift" | "tekst" | "hilsen" | "vedleggOverskrift" | "vedlegg"; lenke?: string; skjult?: number };

// The letter as groups of lines, the single source for the screen, the copied text and the Word file.
// Sentences of a block run together on one line.
export function tilDokument(b: Brev): Linje[][] {
  const linjer = (xs: Setning[], stil: Linje["stil"]): Linje[] => xs.map((x) => ({ tekst: x.tekst, stil, ...(x.lenke && { lenke: x.lenke }) }));
  const grupper: Linje[][] = [
    linjer(b.avsender, "adresse"),
    linjer([b.stedDato], "stedDato"),
    linjer(b.mottaker, "adresse"),
    linjer([b.tittel], "tittel"),
  ];
  for (const a of b.avsnitt) {
    grupper.push(linjer([a.overskrift], "overskrift"));
    for (const x of a.blokker) {
      if ("skjult" in x) grupper.push([{ tekst: "", stil: "tekst", skjult: x.skjult }]);
      else grupper.push([{ tekst: x.setninger.map((y) => y.tekst).join(" "), stil: "tekst", ...(x.setninger.find((y) => y.lenke) && { lenke: x.setninger.find((y) => y.lenke)!.lenke }) }]);
    }
  }
  grupper.push(linjer(b.hilsen, "hilsen"));
  if (b.vedlegg) grupper.push([...linjer([b.vedlegg.overskrift], "vedleggOverskrift"), ...linjer(b.vedlegg.punkter, "vedlegg").map((l) => ({ ...l, tekst: `– ${l.tekst}` }))]);
  return grupper.filter((g) => g.length);
}

// The plain text, for «Kopier tekst» and the golden files.
export const somTekst = (b: Brev): string => tilDokument(b).map((g) => g.map((l) => l.tekst).join("\n")).join("\n\n");

// Every sentence of the letter with its source, for the traceability test.
export function alleSetninger(b: Brev): Setning[] {
  return [
    ...b.avsender,
    b.stedDato,
    ...b.mottaker,
    b.tittel,
    ...b.avsnitt.flatMap((a) => [a.overskrift, ...a.blokker.flatMap((x) => ("setninger" in x ? x.setninger : []))]),
    ...b.hilsen,
    ...(b.vedlegg ? [b.vedlegg.overskrift, ...b.vedlegg.punkter] : []),
  ];
}
