import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { vedtak } from "@/db/schema";
import { type Forbruk, kallVerktoy } from "@/lib/ai/klient";
import { komponentnavn } from "@/lib/feil/kategorier";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { avgjorendeFor, type Niva, type Rangert } from "@/lib/matching/ranger";
import { poengtekst } from "@/lib/matching/rett";
import type { Brukersak, Kandidat } from "@/lib/matching/typer";
import type { Kjoper } from "./kjoper";
import { avsnittA, avsnittB, type Malvedtak } from "./mal";
import { feiltekst } from "@/lib/logg";

// Bump when the instruction or the answer changes.
export const VEDTAKSVALG_VERSJON = "vedtaksvalg-v11";

// The fields of a candidate beside those the ranking uses.
export type Vedtaksdetaljer = {
  kildeUrl: string;
  // The committee as the decision names itself (see UTVALG_I_TEKSTEN).
  utvalg: string;
  merke: string | null;
  modell: string | null;
  arsmodell: number | null;
};

// The committee's name as the decision itself uses it, in bokmål. The texts say Forbrukerklageutvalget
// from 2017 on, though the archive and the act changed later, so a date rule gets it wrong. Decisions
// in nynorsk say «Forbrukarklageutvalet».
export const UTVALG_I_TEKSTEN = sql<string>`case when ${vedtak.fulltekstRenset} ~* 'forbruk(e|a)rklageutval' then 'Forbrukerklageutvalget' else 'Forbrukertvistutvalget' end`;

// Quotes offered for a level-B decision; they come from all its accepted defects.
const MAKS_SITATER_B = 6;

// A quote the model may pick, with the defect it was said about (null for a legal point's sentence).
export type Sitatvalg = { id: string; tekst: string; feil: AvledetFeil | null };

// The verified quotes a candidate offers: on level A those about the buyer's defect; on level B the
// committee's sentences for the buyer's legal points (v4), else those about any accepted defect.
export function sitatvalg(r: Rangert, k: Kandidat): Sitatvalg[] {
  const rettslige = k.avgjorende?.rettslige_sitater?.filter((s) => r.rett.includes(s.poeng));
  if (r.niva === "B" && rettslige?.length) return rettslige.map((s, i) => ({ id: `s${i + 1}`, tekst: s.sitat, feil: null }));
  const feil = r.feil ? [r.feil] : k.feil.filter((f) => f.utfall === "medhold");
  const ut = feil.flatMap((f) => (avgjorendeFor(k.avgjorende, f)?.sitater ?? []).map((tekst) => ({ tekst, feil: f })));
  return (r.niva === "A" ? ut : ut.slice(0, MAKS_SITATER_B)).map((s, i) => ({ id: `s${i + 1}`, ...s }));
}

const INSTRUKS = `Du velger vedtakene et klagebrev for en kjøper av bruktbil skal vise til, og sitatene fra vedtakene som skal stå i brevet. Teksten i brevet lages av koden; du skriver ingen tekst. Svar med verktøyet velg_vedtak.

Kjøperen reklamerer på én eller flere feil (\`feil\`, nummerert med \`nr\`). Kandidatene er gruppert per feil (\`feil_nr\`) og sortert etter systemets poeng innenfor gruppen. Velg ett vedtak for hver feil, blant kandidatene i den feilens gruppe. Det samme vedtaket kan velges for flere feil.

For hver feil:
- Nivå A er vedtak om samme feil som kjøperens, som utvalget vurderte for seg.
- Nivå B er vedtak som avgjorde et rettslig spørsmål i kjøperens sak (\`rettslige_poeng\`), uten å være om samme feil.

Velg et vedtak på nivå A hvis det finnes et. Blant dem: velg det der feilen ligner beskrivelsen av den feilen mest (samme del, samme slags svikt), og deretter det der bilen ligner (alder, km, «som den er»).
Har kjøperen en skriftlig verkstedrapport (\`rapport_sier\` på feilen), foretrekk blant like gode vedtak det der \`bevisgrunnlag\` viser at utvalget la vekt på sakkyndig dokumentasjon (verksted, EU-kontroll).
På nivå B: velg vedtaket der et sitat uttrykker det rettslige poenget tydeligst.

Sitatene: oppgi id-ene til 1 eller 2 sitater fra det valgte vedtaket på nivå A, og til 1 sitat på nivå B. Velg setninger der utvalget sier hvorfor feilen var en mangel, eller uttrykker det rettslige poenget. Ikke velg setninger som bare gjengir fakta eller hva en part har forklart, eller som taler mot kjøperen.`;

const VERKTOY = {
  name: "velg_vedtak",
  description: "Ett vedtak per feil, med sitatene brevet skal bruke.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["valg"],
    properties: {
      valg: {
        type: "array",
        description: "Ett valg for hver feil som har kandidater.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["feil_nr", "vedtak_id", "sitater"],
          properties: {
            feil_nr: { type: "integer", description: "feil_nr til gruppen vedtaket er valgt fra." },
            vedtak_id: { type: "integer", description: "vedtak_id til vedtaket du valgte for feilen." },
            sitater: { type: "array", items: { type: "string" }, description: "Id-ene til sitatene, i den rekkefølgen de skal stå." },
          },
        },
      },
    },
  },
};

// The model's choice for one fault, and its answer for them all.
export type Feilsvar = { vedtak_id: number; sitater: string[] };
export type Feilvalg = Feilsvar & { feil_nr: number };
export type Modellsvar = { valg: Feilvalg[] };

// What a level-B decision was about: the defect the quote is about, else its accepted defects.
const annenFeil = (k: Kandidat, f: AvledetFeil | null) =>
  f ? komponentnavn(f) : k.feil.filter((x) => x.utfall === "medhold").map(komponentnavn).slice(0, 3).join(", ") || "en mangel ved bilen";

// Leaves out empty values, so the model reads only what is known.
const kompakt = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));

function kandidattekst(r: Rangert, k: Kandidat, d: Vedtaksdetaljer | undefined, sitater: Sitatvalg[]) {
  return kompakt({
    vedtak_id: k.id,
    niva: r.niva,
    feil: r.feil ? komponentnavn(r.feil) : null,
    rettslige_poeng: r.niva === "B" ? r.rett.map(poengtekst) : null,
    bil: [d?.merke, d?.modell, d?.arsmodell].filter(Boolean).join(" "),
    km_ved_kjop: k.km,
    alder_ved_kjop: k.alder,
    som_den_er: k.somDenEr || null,
    // What the committee granted for this defect alone, not for the decision as a whole. On level B it
    // stands with each quote about a defect; a legal point's sentence has none.
    utvalget_ga: r.feil ? (avgjorendeFor(k.avgjorende, r.feil)?.sanksjoner ?? []) : null,
    // What the committee rested its conclusion on for this defect (a workshop report, an inspection,
    // the ad and so on), so a buyer's written report can be matched with a decision that weighed one.
    bevisgrunnlag: r.feil ? (avgjorendeFor(k.avgjorende, r.feil)?.bevis ?? []) : null,
    sitater: sitater.map((s) =>
      kompakt({
        id: s.id,
        tekst: s.tekst,
        om: r.niva === "B" && s.feil ? komponentnavn(s.feil) : null,
        utvalget_ga: r.niva === "B" && s.feil ? (avgjorendeFor(k.avgjorende, s.feil)?.sanksjoner ?? []) : null,
      }),
    ),
  });
}

// The model's answer if it holds: a candidate and quotes of its own, as many as the level takes.
// Otherwise the highest-ranked candidate and its first quotes. Never asks again.
export function tolkSvar(svar: Feilsvar | null, kandidater: Rangert[], sitater: Map<number, Sitatvalg[]>): { r: Rangert; valgte: Sitatvalg[]; fulgt: boolean } {
  const antall = (r: Rangert) => (r.niva === "A" ? 2 : 1);
  const r = svar && kandidater.find((x) => x.id === svar.vedtak_id);
  if (r) {
    const egne = sitater.get(r.id) ?? [];
    const valgte = [...new Set(svar.sitater)].flatMap((id) => egne.filter((s) => s.id === id)).slice(0, antall(r));
    if (valgte.length) return { r, valgte, fulgt: true };
  }
  const forste = kandidater[0];
  return { r: forste, valgte: (sitater.get(forste.id) ?? []).slice(0, antall(forste)), fulgt: false };
}

// The decisions the buyer can pick instead of the chosen one: the rest of the ranking that have
// quotes, each with its first quotes, as tolkSvar takes them without a model answer.
export function alternativer(kandidater: Rangert[], valgtId: number, sitater: Map<number, Sitatvalg[]>): { r: Rangert; valgte: Sitatvalg[] }[] {
  return kandidater
    .filter((r) => r.id !== valgtId && (sitater.get(r.id)?.length ?? 0) > 0)
    .map((r) => ({ r, valgte: tolkSvar(null, [r], sitater).valgte }));
}

// The letter's sentence when there is no candidate.
export const LOVSETNING = "Kravet bygger på lovens vilkår.";

// The choice for one fault; null for a fault without candidates (the law's sentence).
export type Feilresultat = {
  r: Rangert;
  niva: Niva;
  avsnitt: string;
  sitater: string[];
  // Whether the model's choice was used; false when the ranking's first candidate was.
  fulgt: boolean;
  // The buyer's other options in the letter (alternativer), each with its paragraph.
  alternativer: { r: Rangert; avsnitt: string; sitater: string[] }[];
} | null;

export type Valgresultat = { feil: Feilresultat[]; modell: string | null; forbruk: Forbruk };

// `kandidater`: the ranking for each fault, in the order of kjoper.feil and sak.kategorier.
export type Valggrunnlag = {
  kjoper: Kjoper;
  sak: Brukersak;
  kandidater: Rangert[][];
  alle: Map<number, Kandidat>;
  detaljer: Map<number, Vedtaksdetaljer>;
};

// Each candidate's quotes, by decision id, one map per fault: a decision offers the quotes about the
// fault it was ranked for, so the same decision can offer others under another fault.
export const sitaterFor = (opts: Valggrunnlag) => opts.kandidater.map((liste) => new Map(liste.map((r) => [r.id, sitatvalg(r, opts.alle.get(r.id)!)])));

// Everything the model reads, as one fingerprint: the same fingerprint gets the same answer, so a
// stored answer can stand in for a new call.
export const grunnlagFor = (kjoper: Kjoper, kandidater: Rangert[][]) =>
  createHash("sha256")
    .update(JSON.stringify([VEDTAKSVALG_VERSJON, kjoper, kandidater.map((l) => l.map((r) => r.id))]))
    .digest("hex");

const INGEN_FORBRUK: Forbruk = { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 };

// The one model call, for all the faults. Null when it fails, or when no fault has candidates: the
// ranking alone still gives a letter. `rask` is for a buyer waiting on the page (kallVerktoy).
export async function sporModellen(opts: Valggrunnlag & { rask?: boolean }): Promise<{ svar: Modellsvar | null; modell: string | null; forbruk: Forbruk }> {
  const sitater = sitaterFor(opts);
  const grupper = opts.kandidater
    .map((liste, i) => ({ feil_nr: i + 1, kandidater: liste.map((r) => kandidattekst(r, opts.alle.get(r.id)!, opts.detaljer.get(r.id), sitater[i].get(r.id)!)) }))
    .filter((g) => g.kandidater.length);
  if (!grupper.length) return { svar: null, modell: null, forbruk: INGEN_FORBRUK };
  try {
    const kall = await kallVerktoy<Modellsvar>({
      system: INSTRUKS,
      verktoy: VERKTOY,
      bruker: `Kjøperens sak:\n${JSON.stringify(opts.kjoper)}\n\nKandidatene per feil:\n${JSON.stringify(grupper)}`,
      effort: "low",
      maksTokens: 2000,
      rask: opts.rask,
    });
    return { svar: Array.isArray(kall.input?.valg) ? kall.input : null, modell: kall.modell, forbruk: kall.forbruk };
  } catch (e) {
    console.error("vedtaksvalget: modellkallet feilet, bruker rangeringen", feiltekst(e));
    return { svar: null, modell: null, forbruk: INGEN_FORBRUK };
  }
}

// A model answer as a case keeps it (sak.vedtaksvalg): per fault (by index), the decision and its
// quotes as text, since their ids are positions that move when the ranking does.
export type LagretSvar = { grunnlag: string; valg: ({ vedtakId: number; sitater: string[] } | null)[] };

// A stored answer in this form; one from before (one decision for the case) is not.
export const erLagretSvar = (x: unknown): x is LagretSvar =>
  !!x && typeof x === "object" && typeof (x as LagretSvar).grunnlag === "string" && Array.isArray((x as LagretSvar).valg);

// The answer as tolkSvar takes it, held against the candidates and quotes as they are now.
export function tilLagret(grunnlag: string, svar: Modellsvar, sitater: Map<number, Sitatvalg[]>[]): LagretSvar {
  return {
    grunnlag,
    valg: sitater.map((egneFeil, i) => {
      const v = svar.valg.find((x) => x.feil_nr === i + 1);
      if (!v) return null;
      const egne = egneFeil.get(v.vedtak_id) ?? [];
      return { vedtakId: v.vedtak_id, sitater: v.sitater.flatMap((id) => egne.filter((s) => s.id === id).map((s) => s.tekst)) };
    }),
  };
}

// A stored answer back to the model's form, for the faults whose decision is still a candidate; null
// when none is, or when the answer is in the form from before.
export function fraLagret(lagret: unknown, kandidater: Rangert[][], sitater: Map<number, Sitatvalg[]>[]): Modellsvar | null {
  if (!erLagretSvar(lagret)) return null;
  const valg = lagret.valg.flatMap((v, i) => {
    if (!v || !kandidater[i]?.some((r) => r.id === v.vedtakId)) return [];
    const egne = sitater[i].get(v.vedtakId) ?? [];
    return [{ feil_nr: i + 1, vedtak_id: v.vedtakId, sitater: v.sitater.flatMap((t) => egne.filter((s) => s.tekst === t).map((s) => s.id)) }];
  });
  return valg.length ? { valg } : null;
}

// What changed since the list the buyer last got: the recommendation before, when it is another one
// now, and the decisions that are new on the list. Null the first time and when nothing changed.
export type Endring = { forrigeAnbefalt: { id: number; saksnummer: string | null } | null; nye: number[] };
export function endringMot(forrige: readonly number[] | undefined, liste: readonly number[], saksnummer: (id: number) => string | null): Endring | null {
  if (!forrige?.length) return null;
  const nye = liste.filter((id) => !forrige.includes(id));
  const annenAnbefalt = forrige[0] !== liste[0];
  if (!nye.length && !annenAnbefalt) return null;
  return { forrigeAnbefalt: annenAnbefalt ? { id: forrige[0], saksnummer: saksnummer(forrige[0]) } : null, nye };
}

// The choice and the template for each fault, from a model answer or none (each ranking's first
// candidate). A fault without candidates gets null.
export function byggValg(svar: Modellsvar | null, opts: Valggrunnlag, modell: string | null = null, forbruk: Forbruk = INGEN_FORBRUK): Valgresultat {
  const sitater = sitaterFor(opts);
  const feil = opts.kandidater.map((kandidater, i): Feilresultat => {
    if (!kandidater.length) return null;
    const { r, valgte, fulgt } = tolkSvar(svar?.valg.find((v) => v.feil_nr === i + 1) ?? null, kandidater, sitater[i]);
    const avsnitt = byggAvsnitt(r, opts.alle.get(r.id)!, opts.detaljer.get(r.id)!, valgte, opts.sak);
    const andre = alternativer(kandidater, r.id, sitater[i]).map((a) => ({
      r: a.r,
      avsnitt: byggAvsnitt(a.r, opts.alle.get(a.r.id)!, opts.detaljer.get(a.r.id)!, a.valgte, opts.sak),
      sitater: a.valgte.map((x) => x.tekst),
    }));
    return { r, niva: r.niva, avsnitt, sitater: valgte.map((x) => x.tekst), fulgt, alternativer: andre };
  });
  return { feil, modell, forbruk };
}

// Chooses the decision and fills the template: the ranking in code, one call for the choice, then
// the template. `alle` holds every ranked decision by id. `utenModell` skips the call and takes the
// ranking's first candidate (to measure what the call adds).
export async function velgVedtak(opts: Valggrunnlag & { utenModell?: boolean }): Promise<Valgresultat> {
  if (opts.utenModell) return byggValg(null, opts);
  const { svar, modell, forbruk } = await sporModellen(opts);
  return byggValg(svar, opts, modell, forbruk);
}

function byggAvsnitt(r: Rangert, k: Kandidat, d: Vedtaksdetaljer, valgte: Sitatvalg[], sak: Brukersak): string {
  // In a dispute over the mileage the recorded km is the disputed figure, so it is left out.
  const kmOmstridt = k.feil.some((f) => f.utfall === "medhold" && f.hovedkategori === "historikk" && f.underkategori === "km");
  const v: Malvedtak = {
    utvalg: d.utvalg,
    saksnummer: k.saksnummer,
    // The meeting date and the signature disagree in some decisions; the date stands only when they agree.
    vedtaksdato: k.vedtaksdato && k.vedtaksdato === k.avgjorende?.signaturdato ? k.vedtaksdato : null,
    bil: k.avgjorende?.bil ?? null,
    merke: d.merke,
    modell: d.modell,
    arsmodell: d.arsmodell,
    km: kmOmstridt ? null : k.km,
    alder: k.alder,
    somDenEr: k.somDenEr,
  };
  const tekster = valgte.map((s) => s.tekst);
  return r.niva === "A" && r.feil
    ? avsnittA(v, komponentnavn(r.feil), tekster, avgjorendeFor(k.avgjorende, r.feil)?.sanksjoner ?? [], sak)
    : avsnittB(v, annenFeil(k, valgte[0].feil), tekster[0]);
}
