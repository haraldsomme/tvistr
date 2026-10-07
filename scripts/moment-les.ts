// Reads the candidate decisions for the moment catalogue (docs/momenter.md) with the language models.
// Resumable: decisions already read are skipped. Stops on account errors.
//
//   npm run moment-les -- --trinn uttrekk [--grense 3]       Sonnet: what the committee weighed, with quotes
//   npm run moment-les -- --trinn klassifiser [--grense 3]   Sonnet and Opus against the catalogue; a third
//                                                            reading where they disagree; then the counts and
//                                                            scripts/momenter-belegg.json
//   npm run moment-les -- --trinn telling                    only the counts and the evidence file

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { erKontofeil, kallVerktoy, MODELL, MODELL_FORFATTER, type Modell } from "../src/lib/ai/klient";
import { MOMENT_UTTREKK_SYSTEM, MOMENT_VERSJON, momentBruker, momentKlassifiserSystem } from "../src/lib/ai/prompter";
import { normaliserSitat } from "../src/lib/brev/skriving/kontroll";
import { kjorParallelt } from "../src/lib/parallell";

const { values: args } = parseArgs({
  options: { trinn: { type: "string" }, grense: { type: "string" }, samtidig: { type: "string", default: "6" } },
});

const UT = "data/explore/momenter";
const KATALOG = "scripts/momenter-katalog.json";
const BELEGG = "scripts/momenter-belegg.json";
const MAKS_BELEGG = 5;
// A moment separates won from lost cases when the share won with it differs by this much from the share
// won without it, in the direction the catalogue says, and it is present in enough cases.
const SKILLER_PP = 0.15;
const SKILLER_MIN_N = 8;

type Kandidat = { id: number; gruppe: string; botte: string; utfall: string };
type Vedtak = { id: number; tekst: string; utfall: string; feiltyper: string[]; saksnummer: string | null; vedtaksdato: string | null };
type Uttrekk = { momenter: { moment: string; retning: "for" | "mot"; sitat: string; tema: string }[]; avgjorende: string; manglet: string[] };
type Svar = { id: string; til_stede: "ja" | "nei" | "uklart"; retning: "for" | "mot" | "ingen"; sitat: string };
type Klassifisering = { sonnet: Svar[]; opus: Svar[]; tredje?: Svar[]; endelig: Svar[] };
type KatalogPunkt = { id: string; beskrivelse: string; retning: "for" | "mot" };

const les = <T>(fil: string, tom: T): T => (existsSync(fil) ? (JSON.parse(readFileSync(fil, "utf8")) as T) : tom);
const skriv = (fil: string, data: unknown) => writeFileSync(fil, `${JSON.stringify(data, null, 2)}\n`);
const vunnet = (utfall: string) => utfall === "medhold" || utfall === "delvis_medhold";
const iTeksten = (sitat: string, tekst: string) => sitat.trim().split(/\s+/).length >= 3 && normaliserSitat(tekst).includes(normaliserSitat(sitat));

async function hentVedtak(ider: number[]): Promise<Map<number, Vedtak>> {
  const rader = await db
    .select({ id: vedtak.id, tekst: vedtak.fulltekstRenset, utfall: vedtak.utfall, feiltyper: vedtak.feiltyper, saksnummer: vedtak.saksnummer, vedtaksdato: vedtak.vedtaksdato })
    .from(vedtak)
    .where(inArray(vedtak.id, ider));
  return new Map(rader.map((r) => [r.id, { id: r.id, tekst: r.tekst ?? "", utfall: String(r.utfall), feiltyper: r.feiltyper ?? [], saksnummer: r.saksnummer, vedtaksdato: r.vedtaksdato ? String(r.vedtaksdato) : null }]));
}

let kostnad = 0;
let stopp = false;
async function kall<T>(modell: Modell, system: string, verktoy: { name: string; description: string; input_schema: Record<string, unknown> }, bruker: string, effort: "low" | "medium"): Promise<T> {
  const svar = await kallVerktoy<T>({ modell, system, verktoy, bruker, effort, maksTokens: 6000 });
  kostnad += svar.forbruk.kostnadUsd;
  return svar.input;
}

const UTTREKK_VERKTOY = {
  name: "registrer_momenter",
  description: "Registrer forholdene utvalget la vekt på.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["momenter", "avgjorende", "manglet"],
    properties: {
      momenter: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["moment", "retning", "sitat", "tema"],
          properties: {
            moment: { type: "string" },
            retning: { type: "string", enum: ["for", "mot"] },
            sitat: { type: "string" },
            tema: { type: "string", enum: ["bevis", "tidspunkt", "kontakt", "bruk", "opplysning", "forventning", "krav", "annet"] },
          },
        },
      },
      avgjorende: { type: "string" },
      manglet: { type: "array", items: { type: "string" } },
    },
  },
};

const klassifiserVerktoy = (ider: string[]) => ({
  name: "klassifiser_momenter",
  description: "Svar for hvert moment i katalogen.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["svar"],
    properties: {
      svar: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "til_stede", "retning", "sitat"],
          properties: {
            id: { type: "string", enum: ider },
            til_stede: { type: "string", enum: ["ja", "nei", "uklart"] },
            retning: { type: "string", enum: ["for", "mot", "ingen"] },
            sitat: { type: "string" },
          },
        },
      },
    },
  },
});

async function kjor<T>(navn: string, fil: string, gjor: (v: Vedtak) => Promise<T>) {
  const kandidater = les<Kandidat[]>(`${UT}/kandidater.json`, []);
  const resultat = les<Record<string, T>>(fil, {});
  const gjenstar = kandidater.filter((k) => !resultat[k.id]).slice(0, args.grense ? Number(args.grense) : undefined);
  const tekster = await hentVedtak(gjenstar.map((k) => k.id));
  let ferdig = 0;
  await kjorParallelt(
    gjenstar,
    Number(args.samtidig),
    async (k) => {
      const v = tekster.get(k.id);
      if (!v?.tekst) return;
      try {
        resultat[k.id] = await gjor(v);
        skriv(fil, resultat);
        ferdig++;
        if (ferdig % 10 === 0) console.log(`${navn}: ${ferdig}/${gjenstar.length}, ${kostnad.toFixed(2)} USD`);
      } catch (e) {
        if (erKontofeil(e)) stopp = true;
        console.log(`#${k.id}: ${e instanceof Error ? e.message : e}`);
      }
    },
    () => stopp,
  );
  console.log(`${navn}: ${ferdig} lest nå, ${Object.keys(resultat).length}/${kandidater.length} totalt, ${kostnad.toFixed(2)} USD`);
}

async function uttrekk() {
  let forkastet = 0;
  await kjor<Uttrekk & { versjon: string }>("uttrekk", `${UT}/uttrekk.json`, async (v) => {
    const svar = await kall<Uttrekk>(MODELL, MOMENT_UTTREKK_SYSTEM, UTTREKK_VERKTOY, momentBruker(v.tekst, v), "low");
    const momenter = svar.momenter.filter((m) => iTeksten(m.sitat, v.tekst));
    forkastet += svar.momenter.length - momenter.length;
    return { ...svar, momenter, versjon: MOMENT_VERSJON };
  });
  console.log(`forkastede sitater: ${forkastet}`);
}

async function klassifiser() {
  const katalog = les<KatalogPunkt[]>(KATALOG, []);
  if (!katalog.length) throw new Error(`${KATALOG} mangler`);
  const system = momentKlassifiserSystem(katalog);
  const verktoy = klassifiserVerktoy(katalog.map((k) => k.id));
  let uenige = 0;
  let vurdert = 0;
  await kjor<Klassifisering>("klassifiser", `${UT}/klassifisering.json`, async (v) => {
    const bruker = momentBruker(v.tekst, v);
    const vask = (s: { svar: Svar[] }) => s.svar.map((x) => ({ ...x, sitat: x.til_stede === "ja" && iTeksten(x.sitat, v.tekst) ? x.sitat : "" }));
    const [sonnet, opus] = await Promise.all([kall<{ svar: Svar[] }>(MODELL, system, verktoy, bruker, "low"), kall<{ svar: Svar[] }>(MODELL_FORFATTER, system, verktoy, bruker, "low")]);
    const [a, b] = [vask(sonnet), vask(opus)];
    const svarFor = (liste: Svar[], id: string) => liste.find((x) => x.id === id);
    const uenig = katalog.filter((k) => {
      const [x, y] = [svarFor(a, k.id)?.til_stede, svarFor(b, k.id)?.til_stede];
      return (x === "ja" && y === "nei") || (x === "nei" && y === "ja");
    });
    vurdert += katalog.length;
    uenige += uenig.length;
    const tredje = uenig.length ? vask(await kall<{ svar: Svar[] }>(MODELL_FORFATTER, system, verktoy, bruker, "medium")) : undefined;
    // Two of three decide; with one reading «uklart», the first two decide only when they agree.
    const endelig = katalog.map((k): Svar => {
      const lesninger = [svarFor(a, k.id), svarFor(b, k.id), tredje && svarFor(tredje, k.id)].filter((x): x is Svar => !!x);
      const ja = lesninger.filter((x) => x.til_stede === "ja");
      const nei = lesninger.filter((x) => x.til_stede === "nei");
      if (ja.length >= 2) return ja.find((x) => x.sitat) ?? ja[0];
      if (nei.length >= 2) return { id: k.id, til_stede: "nei", retning: "ingen", sitat: "" };
      return { id: k.id, til_stede: "uklart", retning: "ingen", sitat: "" };
    });
    return { sonnet: a, opus: b, ...(tredje && { tredje }), endelig };
  });
  if (vurdert) console.log(`uenighet sonnet/opus: ${uenige}/${vurdert} (${((100 * uenige) / vurdert).toFixed(1)} %)`);
}

// Counts per moment and the evidence file: in how many won and lost decisions it was present (with a
// quote that is in the text), whether it separates them, and up to five decisions, newest first.
async function telling() {
  const katalog = les<KatalogPunkt[]>(KATALOG, []);
  const klass = les<Record<string, Klassifisering>>(`${UT}/klassifisering.json`, {});
  const ider = Object.keys(klass).map(Number);
  const vedtakene = await hentVedtak(ider);
  const belegg: Record<string, unknown> = {};
  console.log("moment".padEnd(34), "med (v/t)", "andel med", "andel uten", "skiller");
  for (const k of katalog) {
    const med = ider.filter((id) => klass[id].endelig.find((x) => x.id === k.id && x.til_stede === "ja" && x.sitat));
    const uten = ider.filter((id) => !med.includes(id));
    const andel = (l: number[]) => (l.length ? l.filter((id) => vunnet(vedtakene.get(id)!.utfall)).length / l.length : 0);
    const diff = andel(med) - andel(uten);
    const skiller = med.length >= SKILLER_MIN_N && (k.retning === "for" ? diff >= SKILLER_PP : diff <= -SKILLER_PP);
    const v = med.filter((id) => vunnet(vedtakene.get(id)!.utfall)).length;
    const utvalg = [...med].sort((x, y) => String(vedtakene.get(y)!.vedtaksdato).localeCompare(String(vedtakene.get(x)!.vedtaksdato))).slice(0, MAKS_BELEGG);
    belegg[k.id] = {
      vunnet: v,
      tapt: med.length - v,
      skiller,
      vedtak: utvalg.map((id) => {
        const x = vedtakene.get(id)!;
        const s = klass[id].endelig.find((y) => y.id === k.id)!;
        return { id, saksnummer: x.saksnummer, utfall: x.utfall, retning: s.retning, sitat: s.sitat };
      }),
    };
    console.log(k.id.padEnd(34), `${med.length} (${v}/${med.length - v})`.padEnd(9), `${Math.round(100 * andel(med))} %`.padEnd(9), `${Math.round(100 * andel(uten))} %`.padEnd(10), skiller ? "ja" : "nei");
  }
  skriv(BELEGG, belegg);
  console.log(`skrev ${BELEGG}`);
}

async function main() {
  if (args.trinn === "uttrekk") await uttrekk();
  else if (args.trinn === "klassifiser") {
    await klassifiser();
    if (!args.grense) await telling();
  } else if (args.trinn === "telling") await telling();
  else throw new Error("--trinn uttrekk|klassifiser|telling");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
