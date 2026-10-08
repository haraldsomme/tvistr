import { MANEDER, RENTE_FORFALL_DAGER, SVARFRIST_DAGER } from "../brev";
import { DEL_FOR_ARGUMENT, DELER, OVERSKRIFT, type ArgumentId, type Brevplan, type Del } from "./brevplan";
import { kjentMonster, sakForModell, type Saksmodell } from "./saksmodell";
import type { Avvik, AvvikRegel, Utkast } from "./typer";

// What code can check in a written letter before anyone reads it: every argument of the plan is there
// and none it forbids; every amount, number and date is one the case or the plan has; every quote is a
// word-for-word extract of a pasted text; no sentence says the same twice; placeholders are only the
// plan's; no relative time; not too long; nothing that identifies the buyer.

export const MAKS_ORD = 650;
// A range of km or kr («1 000–5 000 km») is an answer option from the form, not a fact.
const INTERVALL = /\d\s*[–-]\s*\d[\d\u00a0 ]*\s*(?:km|kr)\b/;
const MERKE = /\{\{([^{}]+)\}\}/g;
// Words in quotation marks that are a fixed legal expression, not a quote.
const FASTE_UTTRYKK = ["«som den er»"];
const ANTALL = "\\d+|en|ett|et|to|tre|fire|fem|seks|sju|syv|åtte|ni|ti|noen|flere|et par";
const RELATIV_TID = new RegExp(
  `(?<!\\p{L})(?:i dag|i går|i morgen|i fjor|i år|forrige (?:uke|måned|år)|neste (?:uke|måned|år)|denne (?:uken|måneden)|for (?:${ANTALL}) (?:dag|dager|uke|uker|måned|måneder|år) siden|hvis det sendes)(?!\\p{L})`,
  "iu",
);
const ISO_DATO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const NORSK_DATO = new RegExp(`(\\d{1,2})\\.\\s(${MANEDER.join("|")})\\s(\\d{4})`, "giu");
const TALLDATO = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
const PARAGRAF = /§§?\s*\d+(?:\s*(?:,|og|-|–)\s*\d+)*/g;
// Thousands may be grouped with a space, a no-break space or a full stop.
const TALL = /\d{1,3}(?:[ . ]\d{3})+(?!\d)|\d+/g;
// Periods and deadlines the letter may give in figures.
const FASTE_TALL = [2, 5, 6, 24, SVARFRIST_DAGER, RENTE_FORFALL_DAGER];
const LOV = /(\p{L}+loven)(?!\p{L})/giu;
// An argument may move this many places in the plan's order before it counts as out of order.
const MAKS_FLYTT = 2;
const MIN_ORD_FOR_LIKHET = 6;
const MAKS_LIKHET = 0.6;

const pad = (n: number) => String(n).padStart(2, "0");
const tallI = (t: string) => [...t.matchAll(TALL)].map((x) => Number(x[0].replace(/[ . ]/g, "")));
const utenDatoer = (t: string) => t.replace(ISO_DATO, " ").replace(NORSK_DATO, " ").replace(TALLDATO, " ");
function datoerI(t: string): string[] {
  return [
    ...[...t.matchAll(ISO_DATO)].map((x) => x[0]),
    ...[...t.matchAll(NORSK_DATO)].map((x) => `${x[3]}-${pad(MANEDER.indexOf(x[2].toLowerCase()) + 1)}-${pad(Number(x[1]))}`),
    ...[...t.matchAll(TALLDATO)].map((x) => `${x[3]}-${pad(Number(x[2]))}-${pad(Number(x[1]))}`),
  ];
}
const ordI = (t: string) => t.toLowerCase().replace(MERKE, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
function likhet(a: string[], b: string[]): number {
  const tri = (o: string[]) => new Set(o.slice(0, -2).map((_, i) => o.slice(i, i + 3).join(" ")));
  const [x, y] = [tri(a), tri(b)];
  const felles = [...x].filter((t) => y.has(t)).length;
  return felles / (x.size + y.size - felles || 1);
}
export const normaliserSitat = (t: string) => t.replace(/[«»"“”„]/g, '"').replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!?,;:]+$/, "");

// The dates and numbers the letter may contain: those in the case, the pasted texts and the plan.
function tillatt(m: Saksmodell, plan: Brevplan) {
  const kilde = [JSON.stringify(sakForModell(m)), JSON.stringify(m.kilder), ...plan.argumenter.map((a) => `${a.foring} ${JSON.stringify(a.data)}`)].join("\n");
  const datoer = new Set([...datoerI(kilde), "2024-01-01"]);
  const tall = new Set([...tallI(utenDatoer(kilde)), ...FASTE_TALL, ...[...datoer].flatMap((d) => d.split("-").map(Number))]);
  return { datoer, tall };
}

export function kontroller(utkast: Utkast, plan: Brevplan, m: Saksmodell): Avvik[] {
  const avvik: Avvik[] = [];
  const legg = (regel: AvvikRegel, tekst: string, setning?: string) => void avvik.push({ regel, tekst, ...(setning !== undefined && { setning }) });
  const setninger = utkast.avsnitt.flatMap((a) => a.setninger);

  // Arguments.
  const planlagt = new Set(plan.argumenter.map((a) => a.id));
  const forbudt = new Map(plan.forbudt.map((f) => [f.id, f.grunn]));
  const dekket = new Set(setninger.flatMap((s) => s.argumenter));
  for (const a of plan.argumenter) if (!dekket.has(a.id)) legg("dekning", `Argumentet «${a.id}» mangler.`);
  for (const s of setninger)
    for (const id of s.argumenter) {
      if (forbudt.has(id)) legg("forbudt", `Argumentet «${id}» skal ikke være med: ${forbudt.get(id)}`, s.tekst);
      else if (!planlagt.has(id)) legg("ukjent_argument", `Argumentet «${id}» er ikke i planen.`, s.tekst);
    }

  // Marks and quotes.
  const sitater = new Map(utkast.sitater.map((s) => [s.id, s]));
  const brukt = new Map<string, number>();
  const merker = new Set(plan.merker);
  const sett = new Set<string>();
  for (const s of setninger)
    for (const [, navn] of s.tekst.matchAll(MERKE)) {
      sett.add(navn);
      if (navn.startsWith("sitat:")) {
        const id = navn.slice("sitat:".length);
        if (!sitater.has(id)) legg("merke", `Sitatet «${id}» finnes ikke.`, s.tekst);
        brukt.set(id, (brukt.get(id) ?? 0) + 1);
      } else if (!merker.has(navn)) legg("merke", `Merket {{${navn}}} kan ikke brukes i dette brevet.`, s.tekst);
    }
  for (const navn of plan.merker) if (navn !== "epost" && !sett.has(navn)) legg("merke", `Merket {{${navn}}} mangler.`);
  for (const [id, n] of brukt) if (n > 1) legg("sitat", `Sitatet «${id}» er brukt ${n} ganger.`);
  for (const s of utkast.sitater) {
    const kilde = m.kilder[s.kilde];
    if (!kilde) legg("sitat", `Det finnes ingen kildetekst «${s.kilde}» å sitere fra.`, s.tekst);
    else if (s.tekst.trim().split(/\s+/).length < 2 || !normaliserSitat(kilde).includes(normaliserSitat(s.tekst))) legg("sitat", `Sitatet «${s.id}» står ikke ordrett i kildeteksten.`, s.tekst);
  }

  // Order: each argument where the plan puts it, give or take a merged sentence.
  const plass = new Map(plan.argumenter.map((a, i) => [a.id, i]));
  const forste = new Set<string>();
  let lengst = -1;
  for (const s of setninger)
    for (const id of s.argumenter) {
      const i = plass.get(id);
      if (i === undefined || forste.has(id)) continue;
      forste.add(id);
      if (i < lengst - MAKS_FLYTT && !avvik.some((a) => a.regel === "rekkefolge")) legg("rekkefolge", `Argumentet «${id}» står etter argumenter planen setter senere.`, s.tekst);
      lengst = Math.max(lengst, i);
    }

  // Parts: each paragraph covers arguments from one part of the letter, and the parts come in order, so
  // the headings `render.ts` sets fall between paragraphs.
  const navn = (d: Del) => OVERSKRIFT[d] ?? "Innledningen";
  const overskrifter = new Set(Object.values(OVERSKRIFT).filter(Boolean).map((o) => o!.toLowerCase()));
  for (const s of setninger)
    if (!s.argumenter.length && overskrifter.has(s.tekst.trim().replace(/[.:]$/, "").toLowerCase())) legg("inndeling", "Overskriftene settes av systemet og skal ikke stå i teksten.", s.tekst);
  let forrige = -1;
  for (const a of utkast.avsnitt) {
    const deler = [...new Set(a.setninger.flatMap((s) => s.argumenter).map((id) => DEL_FOR_ARGUMENT[id as ArgumentId]).filter(Boolean))];
    if (deler.length > 1 && !avvik.some((x) => x.regel === "inndeling" && x.tekst.startsWith("Avsnittet blander")))
      legg("inndeling", `Avsnittet blander ${deler.map(navn).join(" og ")}; hver del har egne avsnitt.`, a.setninger[0]?.tekst);
    const i = deler.length ? Math.min(...deler.map((d) => DELER.indexOf(d))) : forrige;
    if (i < forrige && !avvik.some((x) => x.regel === "inndeling" && x.tekst.startsWith("Et avsnitt")))
      legg("inndeling", `Et avsnitt under ${navn(DELER[i])} står etter ${navn(DELER[forrige])}.`, a.setninger[0]?.tekst);
    forrige = Math.max(forrige, i);
  }

  // Paragraphs and acts: only those the plan cites.
  const foringer = plan.argumenter.map((a) => a.foring).join(" ");
  const paragrafer = new Set([...foringer.matchAll(PARAGRAF)].flatMap((x) => tallI(x[0])));
  const lover = new Set([...foringer.matchAll(LOV)].map((x) => x[1].toLowerCase()));

  // Each sentence.
  const { datoer, tall } = tillatt(m, plan);
  const manglerTekster = new Set(plan.mangler.map((x) => x.tekst));
  const funnet = new Set<string>();
  const kjente = m.kjente.map(kjentMonster);
  for (const s of setninger) {
    const t = s.tekst.replace(MERKE, " ");
    if (/[«»"“”„]/.test(FASTE_UTTRYKK.reduce((r, x) => r.replaceAll(x, " "), t))) legg("anforselstegn", "Anførselstegn utenfor et sitatmerke.", s.tekst);
    for (const [hel, innhold] of t.matchAll(/\[([^\]]*)\]/g)) {
      const mangel = /^MANGLER: (.+)$/.exec(innhold)?.[1];
      if (mangel && manglerTekster.has(mangel)) funnet.add(mangel);
      else legg("hakeparentes", `${hel} er ikke en plassholder fra planen.`, s.tekst);
    }
    for (const [ref] of t.matchAll(PARAGRAF)) for (const n of tallI(ref)) if (!paragrafer.has(n)) legg("paragraf", `§ ${n} står ikke i planen.`, s.tekst);
    for (const [, lov] of t.matchAll(LOV)) if (!lover.has(lov.toLowerCase())) legg("paragraf", `${lov} står ikke i planen.`, s.tekst);
    if (RELATIV_TID.test(t)) legg("relativ_tid", "Relativt tidsuttrykk; bruk en dato.", s.tekst);
    if (INTERVALL.test(t)) legg("skjemarest", "Et intervall fra skjemaet; skriv en øvre grense («under 5 000 km»).", s.tekst);
    for (const d of datoerI(t)) if (!datoer.has(d)) legg("dato", `Datoen ${d} finnes ikke i saken.`, s.tekst);
    const rest = utenDatoer(t).replace(PARAGRAF, " ").replace(/\[[^\]]*\]/g, " ");
    for (const n of tallI(rest)) if (!tall.has(n)) legg("tall", `Tallet ${n} finnes ikke i saken.`, s.tekst);
    if (kjente.some((r) => r.test(t))) legg("personopplysning", "Teksten inneholder en personopplysning om kjøperen.", s.tekst);
  }
  for (const x of plan.mangler) if (!funnet.has(x.tekst)) legg("hakeparentes", `[MANGLER: ${x.tekst}] mangler.`);

  // Repetition and length.
  const ord = setninger.map((s) => ordI(s.tekst));
  for (let i = 0; i < ord.length; i++)
    for (let j = i + 1; j < ord.length; j++) {
      const [a, b] = [ord[i], ord[j]];
      if (a.length === 0 || b.length === 0) continue;
      if (a.join(" ") === b.join(" ") || (a.length >= MIN_ORD_FOR_LIKHET && b.length >= MIN_ORD_FOR_LIKHET && likhet(a, b) >= MAKS_LIKHET)) legg("gjentakelse", "To setninger sier nesten det samme.", setninger[j].tekst);
    }
  const antall = ord.reduce((n, o) => n + o.length, 0);
  if (antall > MAKS_ORD) legg("lengde", `Brevet har ${antall} ord; grensen er ${MAKS_ORD}.`);
  return avvik;
}
