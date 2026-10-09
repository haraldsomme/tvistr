// Measures the pass 2 pilot against the thresholds in docs/pass2-design.md § 9.2: control agents'
// verdicts, agreement between the two independent controls, run-to-run stability and import statistics.
//
//   npm run pass2:rapport

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { avledAnalyse, type AvledetFeil } from "../src/lib/analyse/avled";
import { INSTRUKS_VERSJON, type Pass2Svar } from "../src/lib/analyse/skjema";
import { hardeFeil, verifiserSvar } from "../src/lib/analyse/verifiser";
import { wilson } from "../src/lib/wilson";

type Dom = { riktig: boolean; riktig_verdi: unknown; sitat: string | null };
const FELT = ["vurdering", "grunnlag", "bevisgrunnlag", "spor", "spor_vunnet", "formodning", "viste_seg"] as const;
type KontrollFeil = { feil_id: string } & Record<(typeof FELT)[number], Dom>;
type Kontroll = {
  vedtak_id: number;
  feil: KontrollFeil[];
  manglende_feil: { beskrivelse: string; sitat: string }[];
  overflodige_feil: string[];
  opplysninger: { riktige: number; feil: number };
  bevis: { riktige: number; feil: number };
};

const M = "data/pass2";
const lesJson = <T>(sti: string) => JSON.parse(readFileSync(sti, "utf8")) as T;
const lesMappe = <T>(mappe: string): T[] =>
  existsSync(mappe) ? readdirSync(mappe).filter((f) => f.endsWith(`.${INSTRUKS_VERSJON}.json`)).map((f) => lesJson<T>(join(mappe, f))) : [];
// v2 and later keep their own lists (pilot-pass2-v2.json); v1 used the plain names.
const listeSti = (navn: string) => {
  const egen = join(M, "lister", `${navn}-${INSTRUKS_VERSJON}.json`);
  return existsSync(egen) ? egen : join(M, "lister", `${navn}.json`);
};
const pst = (x: number) => `${(x * 100).toFixed(1)} %`;

type Andel = { k: number; n: number; andel: number; lav: number };
function andel(k: number, n: number): Andel {
  return { k, n, andel: n ? k / n : 0, lav: wilson(k, n)[0] };
}
// Under 100 points the requirement applies to the lower Wilson bound (design § 9.2).
const oppfylt = (a: Andel, krav: number) => (a.n >= 100 ? a.andel : a.lav) > krav;

function kontrollTall(kontroller: Kontroll[]) {
  const feil = kontroller.flatMap((k) => k.feil);
  const tell = (p: (f: KontrollFeil) => boolean) => andel(feil.filter(p).length, feil.length);
  const sum = (f: (k: Kontroll) => number) => kontroller.reduce((s, k) => s + f(k), 0);
  return {
    saker: kontroller.length,
    vurdering: tell((f) => f.vurdering.riktig),
    grunnlag: tell((f) => f.grunnlag.riktig && f.bevisgrunnlag.riktig),
    sporVunnet: tell((f) => f.spor_vunnet.riktig),
    sporProvd: tell((f) => f.spor.riktig),
    formodning: tell((f) => f.formodning.riktig),
    visteSeg: tell((f) => f.viste_seg.riktig),
    opplysninger: andel(sum((k) => k.opplysninger.riktige), sum((k) => k.opplysninger.riktige + k.opplysninger.feil)),
    bevis: andel(sum((k) => k.bevis.riktige), sum((k) => k.bevis.riktige + k.bevis.feil)),
    manglendeFeil: sum((k) => k.manglende_feil.length),
    overflodigeFeil: sum((k) => k.overflodige_feil.length),
  };
}

// Does quality drop later in a batch? Position = index in the pilot list modulo batch size.
function etterPosisjon(kontroller: Kontroll[], pilot: number[], bolk = 5) {
  return Array.from({ length: bolk }, (_, p) => {
    const ider = new Set(pilot.filter((_, i) => i % bolk === p));
    const feil = kontroller.filter((k) => ider.has(k.vedtak_id)).flatMap((k) => k.feil);
    return andel(feil.filter((f) => f.vurdering.riktig).length, feil.length);
  });
}

// Agreement between the two independent control agents, per field and defect.
function kalibrering(kontroller: Kontroll[], andre: Kontroll[]) {
  const perId = new Map(kontroller.map((k) => [k.vedtak_id, k]));
  let enige = 0;
  let n = 0;
  for (const m of andre) {
    const k = perId.get(m.vedtak_id);
    if (!k) continue;
    for (const mf of m.feil) {
      const kf = k.feil.find((f) => f.feil_id === mf.feil_id);
      if (!kf) continue;
      for (const felt of FELT) {
        n++;
        if (mf[felt].riktig === kf[felt].riktig) enige++;
      }
    }
  }
  return andel(enige, n);
}

// Track coverage from the imported derivations: how many defects have no track at all, and how
// track A splits between written statements and documented silence.
function sporOversikt(pilot: number[]) {
  const ut = { feil: 0, utenSpor: 0, mangler: 0, manglerUtenVunnet: 0, aVariant: {} as Record<string, number>, vunnet: {} as Record<string, number> };
  for (const id of pilot) {
    const sti = join(M, "avledet", `${id}.${INSTRUKS_VERSJON}.json`);
    if (!existsSync(sti)) continue;
    const a = lesJson<{ feil: AvledetFeil[]; ikkeMangelssak?: boolean }>(sti);
    if (a.ikkeMangelssak) continue;
    for (const f of a.feil) {
      ut.feil++;
      if (!f.spor.length) ut.utenSpor++;
      const mangel = f.vurdering === "mangel" || (f.vurdering === "samlet_vurdering" && f.samletUtfall === "mangel");
      if (mangel) {
        ut.mangler++;
        if (!f.sporVunnet.length) ut.manglerUtenVunnet++;
      }
      const nokkel = f.sporVunnet.join("") || "ingen";
      if (mangel) ut.vunnet[nokkel] = (ut.vunnet[nokkel] ?? 0) + 1;
      if (f.sporVunnet.includes("A")) ut.aVariant[f.aVariant ?? "ukjent"] = (ut.aVariant[f.aVariant ?? "ukjent"] ?? 0) + 1;
    }
  }
  return ut;
}

async function stabilitet() {
  const liste = listeSti("stabilitet");
  if (!existsSync(liste)) return null;
  const ider = lesJson<number[]>(liste);
  const rader = await db
    .select({
      id: vedtak.id,
      fulltekstRenset: vedtak.fulltekstRenset,
      utfall: vedtak.utfall,
      tilkjentTotaltNok: vedtak.tilkjentTotaltNok,
      kjopsdato: vedtak.kjopsdato,
      overtakelsesdato: vedtak.overtakelsesdato,
      vedtaksdato: vedtak.vedtaksdato,
      klagerErForbruker: vedtak.klagerErForbruker,
    })
    .from(vedtak)
    .where(inArray(vedtak.id, ider));
  const like = (a: AvledetFeil, b: AvledetFeil) =>
    a.vurdering === b.vurdering && a.grunnlag === b.grunnlag && a.bevisgrunnlag === b.bevisgrunnlag && a.spor.join() === b.spor.join() && a.sporVunnet.join() === b.sporVunnet.join();
  let par = 0;
  let paret = 0;
  let parAvgjort = 0;
  let paretAvgjort = 0;
  let identiske = 0;
  let domIdentiske = 0;
  for (const v of rader) {
    const fil = `${v.id}.${INSTRUKS_VERSJON}.json`;
    const [a, b] = [join(M, "ut", fil), join(M, "ut-stabilitet", fil)];
    if (!existsSync(a) || !existsSync(b) || !v.fulltekstRenset) continue;
    const fakta = { ...v, fulltekstRenset: v.fulltekstRenset };
    const avled = (sti: string): AvledetFeil[] | null => {
      const raa = lesJson<unknown>(sti);
      if (hardeFeil(raa, v.id, true).length) return null;
      return avledAnalyse(verifiserSvar(raa as Pass2Svar, fakta).svar, fakta).feil;
    };
    const alleA = avled(a);
    const alleB = avled(b);
    if (!alleA || !alleB) continue;
    // Defects the committee did not decide are not used in matching (docs/pass2-design.md), so
    // pairing is also reported for decided defects only.
    const avgjort = (f: AvledetFeil) => f.vurdering !== "ikke_vurdert";
    parAvgjort += Math.max(alleA.filter(avgjort).length, alleB.filter(avgjort).length);
    const fa = alleA;
    const fb = alleB;
    par += Math.max(fa.length, fb.length);
    // The component is free text and varies between runs ("registerreim" / "registerreim og
    // strammer"), so pair within the same category on word overlap, best matches first.
    const ord = (f: AvledetFeil) => new Set(f.komponenter.join(" ").toLowerCase().split(/[^\p{L}\d]+/u).filter((w: string) => w.length > 2));
    const likhet = (x: AvledetFeil, y: AvledetFeil) => {
      const [p, q] = [ord(x), ord(y)];
      const felles = [...p].filter((w) => q.has(w)).length;
      return p.size + q.size ? felles / (p.size + q.size - felles) : 0;
    };
    const kandidater = fa
      .flatMap((x) => fb.filter((y) => y.kategori === x.kategori).map((y) => ({ x, y, s: likhet(x, y) })))
      .sort((p, q) => q.s - p.s);
    const bruktA = new Set<AvledetFeil>();
    const bruktB = new Set<AvledetFeil>();
    for (const { x, y, s } of kandidater) {
      if (bruktA.has(x) || bruktB.has(y)) continue;
      const eneste = fa.filter((z) => z.kategori === x.kategori).length === 1 && fb.filter((z) => z.kategori === x.kategori).length === 1;
      if (s < 0.34 && !eneste) continue;
      bruktA.add(x);
      bruktB.add(y);
      paret++;
      if (avgjort(x) && avgjort(y)) paretAvgjort++;
      if (x.vurdering === y.vurdering && x.grunnlag === y.grunnlag && x.bevisgrunnlag === y.bevisgrunnlag) domIdentiske++;
      if (like(x, y)) identiske++;
    }
  }
  return { alle: andel(identiske, par), paret: andel(paret, par), paretAvgjort: andel(paretAvgjort, parAvgjort), dom: andel(domIdentiske, paret) };
}

async function main() {
  const kontroller = lesMappe<Kontroll>(join(M, "kontroll"));
  const andre = lesMappe<Kontroll>(join(M, "kontroll2"));
  const pilotSti = listeSti("pilot");
  const pilot = existsSync(pilotSti) ? lesJson<number[]>(pilotSti) : [];
  const importSti = join(M, `import-${INSTRUKS_VERSJON}.json`);
  const imp = existsSync(importSti)
    ? lesJson<{ importert: number; avvist: number; andelSitaterNullet: number; sitaterNullet: number; sitaterForsokt: number }>(importSti)
    : null;

  const t = kontrollTall(kontroller);
  const stab = await stabilitet();
  const kal = kalibrering(kontroller, andre);
  const pos = etterPosisjon(kontroller, pilot, (INSTRUKS_VERSJON as string) === "pass2-v1" ? 5 : 10);
  const sp = sporOversikt(pilot);

  const rad = (navn: string, a: Andel, krav?: number) =>
    `| ${navn} | ${a.k}/${a.n} | ${pst(a.andel)} | ${pst(a.lav)} | ${krav == null ? "rapporteres" : oppfylt(a, krav) ? `**oppfylt** (> ${pst(krav)})` : `**ikke oppfylt** (> ${pst(krav)})`} |`;
  const linjer = [
    `# Pass 2 – pilotrapport (${INSTRUKS_VERSJON})`,
    "",
    `Kontrollerte saker: ${t.saker}. Manglende feil: ${t.manglendeFeil}. Overflødige feil: ${t.overflodigeFeil}.`,
    "",
    "| Måling | Riktige | Andel | Nedre Wilson | Krav |",
    "|---|---|---|---|---|",
    rad("Utfall per feil (sjekk 3)", t.vurdering, 0.9),
    rad("Grunnlag og bevisgrunnlag (sjekk 4)", t.grunnlag, 0.9),
    rad("Vunnet spor (krav for brevet)", t.sporVunnet, 0.9),
    rad("Prøvd spor (statistikk)", t.sporProvd),
    ...(stab
      ? [
          rad("Stabilitet: vurdering, grunnlag og bevisgrunnlag blant parede", stab.dom, 0.9),
          rad("Stabilitet: avgjorte feil som lot seg pare (mål, brukes i matching)", stab.paretAvgjort, 0.85),
          rad("Stabilitet: alle feil som lot seg pare, inkl. ikke vurdert", stab.paret),
          rad("Stabilitet: alt identisk inkl. spor", stab.alle),
        ]
      : ["| Stabilitet | – | – | – | mangler ut-stabilitet |"]),
    andre.length ? rad("Kalibrering: enighet mellom to kontrollagenter", kal, 0.9) : "| Kalibrering | – | – | – | mangler kontroll2 |",
    rad("Formodning (sjekk 7)", t.formodning),
    rad("Når feilen viste seg (sjekk 8)", t.visteSeg, 0.9),
    rad("Opplysninger (sjekk 5c)", t.opplysninger),
    rad("Bevis (sjekk 6c)", t.bevis, 0.9),
    "",
    imp
      ? `Import: ${imp.importert} importert, ${imp.avvist} avvist. Sitater nullet: ${imp.sitaterNullet}/${imp.sitaterForsokt} (${pst(imp.andelSitaterNullet)}). Alle lagrede sitater er verifisert mot fulltekst.`
      : "Import: ingen importtelling funnet.",
    "",
    "Utfall per feil etter posisjon i bolken (1 = første vedtak agenten behandlet):",
    "",
    ...pos.map((a, i) => `- Posisjon ${i + 1}: ${a.k}/${a.n} (${pst(a.andel)})`),
    "",
    "Spor i piloten (fra importen, alle feil utenom ikke-mangelssaker):",
    "",
    `- Feil uten noe spor (verken prøvd eller vunnet): ${sp.utenSpor}/${sp.feil} (${pst(sp.feil ? sp.utenSpor / sp.feil : 0)})`,
    `- Mangler uten vunnet spor: ${sp.manglerUtenVunnet}/${sp.mangler} (${pst(sp.mangler ? sp.manglerUtenVunnet / sp.mangler : 0)}) – den øvre grensen for hvor ofte et vunnet sammenlignbart vedtak kan finnes per feil`,
    `- Vunnet spor A etter variant: ${Object.entries(sp.aVariant).map(([k, v]) => `${k} ${v}`).join(", ") || "ingen"}`,
    `- Vunnet spor fordelt: ${Object.entries(sp.vunnet).map(([k, v]) => `${k} ${v}`).join(", ") || "ingen"}`,
  ];
  const tekst = linjer.join("\n");
  writeFileSync(join(M, `rapport-${INSTRUKS_VERSJON}.md`), `${tekst}\n`);
  console.log(tekst);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
