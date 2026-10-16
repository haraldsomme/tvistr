import { sql } from "drizzle-orm";
import { vedtak } from "@/db/schema";
import { type Forbruk, kallVerktoy, MODELL } from "@/lib/ai/klient";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { avgjorendeFor, type Niva, type Rangert } from "@/lib/matching/ranger";
import { poengtekst } from "@/lib/matching/rett";
import type { Brukersak, Kandidat } from "@/lib/matching/typer";
import type { Kjoper } from "./kjoper";
import { avsnittA, avsnittB, type Malvedtak } from "./mal";

// Bump when the instruction or the answer changes.
export const VEDTAKSVALG_VERSJON = "vedtaksvalg-v10";

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

// The defect as the paragraph names it: the component the decision was about, else our subcategory.
export function komponentnavn(f: AvledetFeil): string {
  if (f.komponent) return f.komponent;
  const h = HOVEDKATEGORIER.find((x) => x.id === f.hovedkategori);
  const u = h?.under.find((x) => x.id === f.underkategori);
  return (u?.navn ?? h?.navn ?? f.hovedkategori).toLowerCase();
}

// The verified quotes a candidate offers: on level A those about the buyer's defect; on level B the
// committee's sentences for the buyer's legal points (v4), else those about any accepted defect.
export function sitatvalg(r: Rangert, k: Kandidat): Sitatvalg[] {
  const rettslige = k.avgjorende?.rettslige_sitater?.filter((s) => r.rett.includes(s.poeng));
  if (r.niva === "B" && rettslige?.length) return rettslige.map((s, i) => ({ id: `s${i + 1}`, tekst: s.sitat, feil: null }));
  const feil = r.feil ? [r.feil] : k.feil.filter((f) => f.utfall === "medhold");
  const ut = feil.flatMap((f) => (avgjorendeFor(k.avgjorende, f)?.sitater ?? []).map((tekst) => ({ tekst, feil: f })));
  return (r.niva === "A" ? ut : ut.slice(0, MAKS_SITATER_B)).map((s, i) => ({ id: `s${i + 1}`, ...s }));
}

const INSTRUKS = `Du velger vedtaket et klagebrev for en kjøper av bruktbil skal vise til, og sitatene fra vedtaket som skal stå i brevet. Teksten i brevet lages av koden; du skriver ingen tekst. Svar med verktøyet velg_vedtak.

Kandidatene er sortert etter systemets poeng.
- Nivå A er vedtak om samme feil som kjøperens, som utvalget vurderte for seg.
- Nivå B er vedtak som avgjorde et rettslig spørsmål i kjøperens sak (\`rettslige_poeng\`), uten å være om samme feil.

Velg et vedtak på nivå A hvis det finnes et. Blant dem: velg det der feilen ligner kjøperens beskrivelse mest (samme del, samme slags svikt), og deretter det der bilen ligner (alder, km, «som den er»).
Har kjøperen en skriftlig verkstedrapport (\`rapport_sier\` på feilen), foretrekk blant like gode vedtak det der \`bevisgrunnlag\` viser at utvalget la vekt på sakkyndig dokumentasjon (verksted, EU-kontroll).
På nivå B: velg vedtaket der et sitat uttrykker det rettslige poenget tydeligst.

Sitatene: oppgi id-ene til 1 eller 2 sitater fra det valgte vedtaket på nivå A, og til 1 sitat på nivå B. Velg setninger der utvalget sier hvorfor feilen var en mangel, eller uttrykker det rettslige poenget. Ikke velg setninger som bare gjengir fakta eller hva en part har forklart, eller som taler mot kjøperen.`;

const VERKTOY = {
  name: "velg_vedtak",
  description: "Vedtaket og sitatene brevet skal bruke.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["vedtak_id", "sitater"],
    properties: {
      vedtak_id: { type: "integer", description: "vedtak_id til vedtaket du valgte." },
      sitater: { type: "array", items: { type: "string" }, description: "Id-ene til sitatene, i den rekkefølgen de skal stå." },
    },
  },
};

export type Modellsvar = { vedtak_id: number; sitater: string[] };

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
export function tolkSvar(svar: Modellsvar | null, kandidater: Rangert[], sitater: Map<number, Sitatvalg[]>): { r: Rangert; valgte: Sitatvalg[]; fulgt: boolean } {
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

// The two decisions the buyer can pick instead of the chosen one: the next in the ranking that have
// quotes, each with its first quotes, as tolkSvar takes them without a model answer.
export function alternativer(kandidater: Rangert[], valgtId: number, sitater: Map<number, Sitatvalg[]>): { r: Rangert; valgte: Sitatvalg[] }[] {
  return kandidater
    .filter((r) => r.id !== valgtId && (sitater.get(r.id)?.length ?? 0) > 0)
    .slice(0, 2)
    .map((r) => ({ r, valgte: tolkSvar(null, [r], sitater).valgte }));
}

// The letter's sentence when there is no candidate.
export const LOVSETNING = "Kravet bygger på lovens vilkår.";

export type Valgresultat = {
  r: Rangert;
  niva: Niva;
  avsnitt: string;
  sitater: string[];
  // Whether the model's choice was used; false when the ranking's first candidate was.
  fulgt: boolean;
  // The buyer's other options in the letter (alternativer), each with its paragraph.
  alternativer: { r: Rangert; avsnitt: string; sitater: string[] }[];
  modell: string | null;
  forbruk: Forbruk;
};

// Chooses the decision and fills the template: the ranking in code, one call for the choice, then
// the template. `alle` holds every ranked decision by id. `utenModell` skips the call and takes the
// ranking's first candidate (to measure what the call adds).
export async function velgVedtak(opts: {
  kjoper: Kjoper;
  sak: Brukersak;
  kandidater: Rangert[];
  alle: Map<number, Kandidat>;
  detaljer: Map<number, Vedtaksdetaljer>;
  utenModell?: boolean;
}): Promise<Valgresultat> {
  const sitater = new Map(opts.kandidater.map((r) => [r.id, sitatvalg(r, opts.alle.get(r.id)!)]));
  let svar: Modellsvar | null = null;
  let modell: string | null = null;
  let forbruk: Forbruk = { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 };
  if (!opts.utenModell) {
    try {
      const kall = await kallVerktoy<Modellsvar>({
        system: INSTRUKS,
        verktoy: VERKTOY,
        bruker: `Kjøperens sak:\n${JSON.stringify(opts.kjoper)}\n\nKandidatene:\n${JSON.stringify(opts.kandidater.map((r) => kandidattekst(r, opts.alle.get(r.id)!, opts.detaljer.get(r.id), sitater.get(r.id)!)))}`,
        effort: "low",
        maksTokens: 2000,
        modell: MODELL,
      });
      ({ input: svar, modell, forbruk } = kall);
    } catch (e) {
      // The ranking alone still gives a letter.
      console.error("vedtaksvalget: modellkallet feilet, bruker rangeringen", e);
    }
  }
  const { r, valgte, fulgt } = tolkSvar(svar, opts.kandidater, sitater);
  const avsnitt = byggAvsnitt(r, opts.alle.get(r.id)!, opts.detaljer.get(r.id)!, valgte, opts.sak);
  const andre = alternativer(opts.kandidater, r.id, sitater).map((a) => ({
    r: a.r,
    avsnitt: byggAvsnitt(a.r, opts.alle.get(a.r.id)!, opts.detaljer.get(a.r.id)!, a.valgte, opts.sak),
    sitater: a.valgte.map((x) => x.tekst),
  }));
  return { r, niva: r.niva, avsnitt, sitater: valgte.map((x) => x.tekst), fulgt, modell, forbruk, alternativer: andre };
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
