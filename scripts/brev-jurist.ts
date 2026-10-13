// Adds the whole letter to each of the fifteen cases in docs/jurist-gjennomgang.md, below the paragraph
// citing the decision that is already there. The case (defect, when it showed itself, purchase date,
// car, claim), the decision's paragraph and its link are read from the section itself, so the letter
// and the paragraph the jurist has read are the same. The seller, the buyer, the price, the earlier
// notice, the estimate and the expenses are fictitious and vary by section number, so the branches
// of the templates are all seen. No database and no model call.
//
//   npm run brev:jurist
//
// Run again to rewrite the letters after a change to a template.

import { readFileSync, writeFileSync } from "node:fs";
import { byggBrev, somTekst } from "../src/lib/brev/brev";
import { feiltype } from "../src/lib/brev/feiltype";
import type { Brevfeil, Brevsak } from "../src/lib/brev/typer";
import { HOVEDKATEGORIER, VISTE_SEG_VALG } from "../src/lib/feil/kategorier";
import type { Krav } from "../src/lib/matching/typer";
import { BREVDATO, SELGERE } from "./simulerte-saker";
import { STUB_PROFIL } from "../src/lib/vipps/profil";

const DOK = "docs/jurist-gjennomgang.md";
const KOPI = "**Hele brevet (simulert):**";

const BILER = [["Volkswagen", "Golf"], ["Toyota", "Avensis"], ["Skoda", "Octavia"], ["Volvo", "V70"], ["Ford", "Focus"], ["Audi", "A4"], ["BMW", "320d"], ["Opel", "Astra"], ["Kia", "Ceed"], ["Mazda", "6"]];
const PROFILER = [
  STUB_PROFIL,
  STUB_PROFIL,
  { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon, epost: STUB_PROFIL.epost },
  { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon },
];

// 2025-03-10 + 10 months, but never later than the day of the letter.
function plussManeder(iso: string, m: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m);
  const s = d.toISOString().slice(0, 10);
  return s > BREVDATO ? BREVDATO : s;
}

function lesSak(seksjon: string, i: number): Brevsak {
  const felt = (re: RegExp, hva: string) => {
    const m = re.exec(seksjon);
    if (!m) throw new Error(`Seksjon ${i + 1}: fant ikke ${hva}`);
    return m;
  };
  const saksnr = felt(/^## \d+\. (.+?) \(nivå [AB]\)/m, "overskrift")[1];
  const url = felt(/\*\*Vedtaket:\*\* \[[^\]]*\]\(([^)]+)\)/, "lenke")[1];

  // «motor (Motor og eksos), motor.turbo (Turbo)»: a token is only a category when its id is one of ours.
  const under: Record<string, string[]> = {};
  for (const m of felt(/^- Feil: (.+)$/m, "feil")[1].matchAll(/([a-z_]+)(?:\.([a-z_0-9]+))? \(/g)) {
    const h = HOVEDKATEGORIER.find((x) => x.id === m[1]);
    if (!h) continue;
    under[h.id] ??= [];
    if (m[2] && h.under.some((u) => u.id === m[2])) under[h.id].push(m[2]);
  }
  const tid = VISTE_SEG_VALG.find((t) => t.navn === felt(/^- Viste seg: (.+)$/m, "tidspunkt")[1]);
  if (!tid) throw new Error(`Seksjon ${i + 1}: ukjent tidspunkt`);
  const kjopsdato = felt(/^- Kjøpt: (\d{4}-\d{2}-\d{2})/m, "kjøpsdato")[1];
  const bilen = felt(/^- Bilen: (\d+) år, ([\d\s ]+) km, «som den er»: (ja|nei)/m, "bilen");
  const krav = felt(/^- Krav: (retting|prisavslag|heving)/m, "krav")[1] as Krav;
  const avsnitt = felt(/\*\*Avsnittet i brevet:\*\*\n((?:>.*\n?)+)/, "avsnitt")[1].replace(/^> ?/gm, "").trim();

  // The cases of the measurement have no description, and a workshop has put its assessment in writing.
  const feil: Brevfeil[] = Object.entries(under).map(([hoved, u]) => ({
    hoved,
    under: u,
    tid: tid.id,
    beskrivelse: null,
    opplysning: (u.length ? u : [null]).every((x) => feiltype(hoved, x) === "opplysning" || feiltype(hoved, x) === "garanti") && i % 2 === 0 ? "skriftlig" : "nei",
    verksted: "skriftlig",
  }));
  const selger = SELGERE[i % SELGERE.length];
  const [merke, modell] = BILER[i % BILER.length];
  return {
    dato: BREVDATO,
    kjoper: PROFILER[i % PROFILER.length],
    selger: { navn: selger.navn, orgnr: selger.orgnr, adresse: selger.adresse ? { ...selger.adresse, linjer: [...selger.adresse.linjer] } : null },
    bil: { regnr: `ZA ${20001 + i}`, merke, modell, forsteRegistrert: Number(kjopsdato.slice(0, 4)) - Number(bilen[1]) },
    kjopsdato,
    km: Number(bilen[2].replace(/\D/g, "")),
    kjopesum: 60_000 + ((i * 17_000) % 190_000),
    somDenEr: bilen[3] as "ja" | "nei",
    feil,
    krav,
    forsok: 0,
    utlegg: i % 4 === 1 ? [{ beskrivelse: "Tauing", belop: 1_800 }] : [],
    overslag: i % 2 === 0 ? 15_000 + i * 2_500 : null,
    tidligere: i % 3 === 0 ? { dato: plussManeder(kjopsdato, tid.id === "innen_6_mnd" ? 2 : tid.id === "6_til_24_mnd" ? 10 : 30), form: i % 2 === 0 ? "skriftlig" : "muntlig" } : null,
    praksis: { avsnitt, kildeUrl: url, saksnummer: /^FKU-/.test(saksnr) ? null : saksnr },
  };
}

const quote = (t: string) => t.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");

const dok = readFileSync(DOK, "utf8");
const [innledning, ...seksjoner] = dok.split(/^(?=## \d+\. )/m);
const ut = seksjoner.map((s, i) => {
  const ren = s.replace(new RegExp(`${KOPI.replace(/[*()]/g, "\\$&")}\\n[\\s\\S]*?(?=\\*\\*Merknad:\\*\\*)`), "");
  const brev = somTekst(byggBrev(lesSak(ren, i)));
  return ren.replace("**Merknad:**", `${KOPI}\n${quote(brev)}\n\n**Merknad:**`);
});

const NOTAT = `
## Hele brevet

Hvert vedtaksavsnitt over er nå også vist som en del av hele brevet (\`npm run brev:jurist\`). Kjøper, selger, bil, pris, tidligere reklamasjon, kostnadsoverslag og utlegg er diktet opp og varierer fra seksjon til seksjon; feil, tidspunkt, kjøpsdato, bil og krav er de samme som i kjøperens svar. Vedtaksavsnittet er det samme som over.

**Les resten av brevet mot kjøperens svar og loven, og noter under «Merknad»:**
- Står det noe i brevet som ikke følger av kjøperens svar?
- Stemmer paragrafhenvisningene med loven som gjaldt kjøpet (før eller etter 1.1.2024)?
- Er noe formulert som en forsterker, en innrømmelse til selgeren eller et rettslig standpunkt brevet ikke bør ta?
- Er rekkefølgen mangel, tidspunkt og praksis i avsnitt 3 til å følge?
`;
const nyInnledning = innledning.includes("## Hele brevet") ? innledning : innledning.trimEnd() + "\n" + NOTAT + "\n";
writeFileSync(DOK, nyInnledning + ut.join(""));
console.log(`${ut.length} brev skrevet til ${DOK}.`);
