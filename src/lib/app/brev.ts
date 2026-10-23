import "server-only";
// The complaint letter, built on the server from the writer's answers (the artifact's buildLetter;
// sent to the browser by brevet-actions.ts, never as code). Periods and paragraphs follow the law
// version of the purchase (lov.ts). The section citing a decision is Tvistr's paragraph from
// finnVedtak (mal.ts), never written here.
//
// Each paragraph is about one thing (the purchase, a fault, the evidence, a rule of law, a claim), and
// the answers become clauses in it rather than sentences of their own: facts under «Mangelen», law
// under «Rettslig grunnlag», and each claim before its grounds.
import { opplysningsfeil } from "@/lib/brev/feiltype";
import { feilord, kortFeil } from "@/lib/brev/feilord";
import { liste, tall } from "@/lib/brev/format";
import { ANDRE_LOVER, LOVORD, RENTER_FRA_REKLAMASJON, SELGER_BEVISER_UVESENTLIG, TILBUD_UTEN_OPPHOLD } from "@/lib/brev/paragrafer";
import { plussManeder } from "@/lib/brev/tidslinje";
import type { Kriterium } from "@/lib/matching/ranger";
import { LOVSETNING } from "@/lib/vedtaksvalg/valg";
import type { Blokk, Del, Presedens } from "./brevtyper";
import { addDays, addMonths, dur, fmtD, parseD } from "./dato";
import { bareOpplysningsfeil, type Feilpost, feilposter } from "./feil";
import { cap, lcFirst } from "./format";
import { regler, type Regler } from "./lov";
import { forsokTall, heltall } from "./saken";
import { IKKE_SVART, IMPACT, rapportVedlagt, type Skjema, SVAR, vedlegg, WS_SAGT, WS_SAYS } from "./skjema";

type Tekstfelt = { [K in keyof Skjema]: Skjema[K] extends string ? K : never }[keyof Skjema];

const kr = (n: number) => `kr ${tall(n)}`;
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const trimDot = (s: string) => s.trim().replace(/[.]$/, "");
// The buyer's words inside the letter's «»: their own outer quotes go, inner «» become ‘’.
const unquote = (s: string) => {
  const t = s.trim();
  return trimDot(/^[«"][\s\S]*[»"]$/.test(t) ? t.slice(1, -1) : t).replace(/«/g, "‘").replace(/»/g, "’");
};
// One of the buyer's answers as written in the letter, tagged with its field; nothing when empty.
const fe = (felt: string, tekst: string): Del => (tekst ? { felt, tekst } : "");
// liste and join(" ") over parts, so a tagged answer stays its own part.
const listJoinD = (a: Del[][]): Del[] => a.flatMap((x, i) => [...(i === 0 ? [] : i === a.length - 1 ? [" og "] : [", "]), ...x]);
const joinD = (a: Del[][]): Del[] => a.flatMap((x, i) => [...(i ? [" "] : []), ...x]);

// The faults after «oppdaget jeg», each tagged with its area: «feil ved turboen og clutchen» first,
// then the phrases of their own («rust»). «ved» is repeated when a name has its own «og», «eller» or
// comma, so the list stays readable.
function funn(poster: Feilpost[]): Del[] {
  const ord = poster.flatMap((p) => feilord(p.hoved, p.under).map((o) => ({ c: p.hoved, o })));
  const ved = ord.flatMap(({ c, o }) => ("ved" in o ? [{ c, t: o.ved }] : []));
  const sammensatt = ved.some((x) => /,| og | eller /.test(x.t));
  const deler: Del[][] = [];
  if (ved.length) deler.push(["feil ved ", ...listJoinD(ved.map((x, i) => [...(i && sammensatt ? ["ved "] : []), fe(`f_parts.${x.c}`, x.t)]))]);
  for (const { c, o } of ord) if ("tekst" in o) deler.push([fe(`f_parts.${c}`, o.tekst)]);
  return listJoinD(deler);
}

// The faults by name in «Rettslig grunnlag»: «ved bremsene» for one subcategory, else the area
// («ved motoren»), each name once.
const kort = (p: Feilpost) => {
  const o = p.under.length === 1 ? feilord(p.hoved, p.under)[0] : null;
  return o && "ved" in o ? `ved ${o.ved}` : kortFeil(p.hoved);
};
const kortNavn = (poster: Feilpost[]) => {
  const navn = [...new Map(poster.map((p) => [kort(p), p.hoved])).entries()];
  return listJoinD(navn.map(([t, c]) => [fe(`f_parts.${c}`, t)]));
};

// A defect so serious the buyer need not accept a remedy first (§ 29 tredje ledd tredje punktum, from
// 2024): only from the answers that show it.
const alvorlig = (s: Skjema) => alvorGrunner(s).length > 0;

// Whether the seller is past the remedy for a price reduction or heving claimed first: the attempts the
// law lets the buyer refuse more of (§ 30: two before 2024, one after), or a defect so serious.
function forbiAvhjelp(s: Skjema, L: Regler): boolean {
  const n = forsokTall(s.k_forsok);
  return (n !== null && n >= (L.versjon === "før_2024" ? 2 : 1)) || (!!L.par("avhjelp_umiddelbart") && alvorlig(s));
}

// The answers that show the defect is serious, as clauses (for a price reduction claimed at once; for
// heving they are among hevingsgrunner already).
function alvorGrunner(s: Skjema): string[] {
  const g: string[] = [];
  if (s.f_drivable === "nei") g.push("bilen kan ikke brukes");
  if (s.f_impact.includes("sikkerhet")) g.push("feilen går ut over sikkerheten");
  if (s.ws === "rapport" && s.ws_says.includes("frarader")) g.push("verkstedet fraråder videre bruk");
  else if (s.ws === "uten" && s.ws_says.includes("frarader")) g.push("verkstedet har frarådet videre bruk");
  return g;
}

// Why the defect is not insignificant (fkjl. § 32), from the answers only: each clause has a field
// behind it, and none is written without one. The repair cost is left out under 5 % of the price,
// where the figure would weaken the argument. `folge` is what the failed attempts mean for the remedy.
function hevingsgrunner(s: Skjema, L: Regler): { grunner: Del[][]; folge: string } {
  const g: Del[][] = [];
  let folge = "";
  const kost = heltall(s.k_cost),
    pris = heltall(s.c_price);
  if (kost && pris) {
    const pst = Math.round((100 * kost) / pris);
    if (pst >= 5) g.push(["utbedringen er anslått til kr ", fe("k_cost", s.k_cost.trim()), `, som utgjør ${pst} % av kjøpesummen`]);
  }
  // The attempts: two for the same defect before 2024 (old § 30 annet ledd), one after (§ 30 fjerde
  // ledd), unless it is reasonable to give the seller another.
  const n = forsokTall(s.k_forsok);
  const ganger = n !== null && n >= 3 ? "tre eller flere ganger" : n === 2 ? (s.k_forsok === "2+" ? "to eller flere ganger" : "to ganger") : "";
  if (L.versjon === "før_2024") {
    if (n !== null && n >= 2) {
      g.push([`dere har forsøkt å rette feilen ${ganger} uten å lykkes`]);
      folge = `Etter de mislykkede rettingsforsøkene har dere ikke lenger rett til å rette, jf. ${L.par("avhjelp_avvise")}.`;
    } else if (n === 1) g.push(["ett rettingsforsøk har ikke løst feilen"]);
  } else if (n !== null && n >= 1) {
    g.push([`dere har forsøkt å rette feilen${ganger ? ` ${ganger}` : ""} uten å lykkes`]);
    folge = `Etter ${n === 1 ? "det mislykkede rettingsforsøket" : "de mislykkede rettingsforsøkene"} kan jeg avvise videre retting, jf. ${L.par("avhjelp_avvise")}.`;
  }
  g.push(...alvorGrunner(s).map((x) => [x]));
  if (s.seller_said === "lovet") g.push(["bilen avviker fra det dere uttrykkelig opplyste før kjøpet"]);
  return { grunner: g, folge };
}

// The impact clauses whose adjective agrees with «Feilene».
const FLERTALL: Record<string, string> = { kosmetisk: "er synlige", plagsom: "er plagsomme i daglig bruk" };

const ikkeUvesentlig = (g: Del[][]): Del[] => ["Mangelen er ikke uvesentlig: ", ...listJoinD(g), "."];

// What the seller answered when the buyer raised the fault, as one sentence: «Da jeg tok opp feilen,
// svarte dere at A og at B.» A refusal is «avviste dere reklamasjonen».
function forhandlerensSvar(s: Skjema): string {
  if (!s.f_prior) return "";
  if (s.f_prior_svar.includes(IKKE_SVART)) return "Jeg har ikke fått svar fra dere.";
  const at = SVAR.filter(([id]) => id !== "avvist" && s.f_prior_svar.includes(id)).map(([, , ord]) => `at ${ord}`);
  const avvist = s.f_prior_svar.includes("avvist");
  if (!at.length && !avvist) return "";
  const svarte = `svarte ${avvist ? "" : "dere "}${liste(at)}`;
  return `Da jeg tok opp feilen, ${avvist ? `avviste dere reklamasjonen${at.length ? ` og ${svarte}` : ""}` : svarte}.`;
}

// The law's answer to each objection the seller gave (SVAR, after Forbrukerrådet's «Vanlige spørsmål og
// svar»), each sentence citing the table. «Som den er» has its own paragraph above, and a refusal without
// reasons or «wait and see» need no answer. Nothing is claimed that the answers do not carry: wear is
// only answered inside the presumption or when the workshop ruled it out, lateness only with the law's limits. `alle` is
// whether every objection given is answered somewhere in the letter, so it may say they change nothing.
function svarPaInnvendinger(s: Skjema, L: Regler, k: { iFormodning: boolean; rettidig: boolean; ikkeSlitasje: boolean }): { ut: string[]; alle: boolean } {
  const har = (id: string) => s.f_prior && s.f_prior_svar.includes(id);
  const ut: string[] = [];
  let alle = true;
  if (har("slitasje")) {
    if (k.iFormodning) ut.push("Det er dere som må bevise at feilen ikke var til stede ved leveringen, også når dere viser til slitasje eller feil bruk.");
    else if (k.ikkeSlitasje) ut.push(`Dere har vist til slitasje eller feil bruk, men ${s.ws === "rapport" ? "verkstedrapporten fastslår" : "verkstedet har opplyst"} at feilen ikke skyldes normal slitasje.`);
    else alle = false;
  }
  if (har("produsent")) ut.push(`Kravet mitt retter seg mot dere som selger, jf. ${L.par("selger")}. Jeg kan gå mot et tidligere salgsledd, men har ingen plikt til det, jf. ${L.par("tidligere_ledd")}.`);
  if (har("betaling")) ut.push(`Retting skal skje uten kostnad for meg, jf. ${L.par("avhjelp_vilkar")}.`);
  if (har("garanti_ute")) ut.push(`At garantien er utløpt, har ikke betydning for kravet, som bygger på loven. En garanti «${LOVORD.garantiBegrenser}», jf. ${L.par("garanti_lov")}.`);
  if (har("for_sent") && !k.rettidig) ut.push(`Fristen for å reklamere er aldri kortere enn to måneder fra jeg oppdaget mangelen, jf. ${L.par("reklamasjon")}. For en bil er den ytterste fristen fem år etter overtakelsen, jf. ${L.par("reklamasjon_5ar")}.`);
  return { ut, alle };
}

// `presedens`: the decision the buyer chose, null without one (the law's sentence), or «venter» while
// finnVedtak is still working, so a letter copied then shows a gap rather than a letter without it.
export function byggBrev(s: Skjema, presedens: Presedens | null | "venter", idag: string): Blokk[] {
  const L = regler(s.c_purchase || s.c_delivery);
  const has = (k: Tekstfelt) => s[k].trim() !== "";
  // The buyer's answer as its own part, tagged with the field (fe), or a placeholder.
  const v = (k: Tekstfelt, ph: string): Del => (has(k) ? fe(k, s[k].trim()) : { ph });
  const vd = (k: Tekstfelt, ph: string): Del => (has(k) ? fe(k, fmtD(s[k])) : { ph });
  const ld = parseD(s.l_date) ?? parseD(idag)!;
  // Set when the case is bought: no answer the buyer edits.
  const dato = fmtD(ld);
  const B: Blokk[] = [];
  const poster = feilposter(s);

  const snd: Del[][] = [[v("b_name", "Ditt navn")], [v("b_addr", "Adresse")], [v("b_zip", "Postnr."), " ", v("b_city", "Poststed")]];
  if (has("b_phone")) snd.push(["Telefon: ", fe("b_phone", s.b_phone)]);
  if (has("b_email")) snd.push(["E-post: ", fe("b_email", s.b_email)]);
  B.push({ t: "addr", linjer: snd });
  const rc: Del[][] = [[v("d_name", "Forhandlerens navn")]];
  if (has("d_org")) rc.push(["Org.nr. ", fe("d_org", s.d_org)]);
  rc.push([v("d_addr", "Adresse")], [v("d_zip", "Postnr."), " ", v("d_city", "Poststed")]);
  B.push({ t: "addr", linjer: rc });
  B.push({ t: "date", tekst: [has("b_city") ? fe("b_city", s.b_city) : { ph: "Sted" }, ", ", dato] });

  // Make and model joined by a space and trimmed at the ends, each its own part.
  const bil = (["c_make", "c_model"] as const).filter(has);
  const car: Del[] = bil.length
    ? joinD(bil.map((k) => [fe(k, bil.length === 1 ? s[k].trim() : k === bil[0] ? s[k].trimStart() : s[k].trimEnd())]))
    : [{ ph: "Merke og modell" }];
  const reg = v("c_reg", "reg.nr.");
  B.push({ t: "subj", tekst: ["Reklamasjon på mangel ved ", ...car, ", reg.nr. ", reg] });
  // The purchase and the complaint in one paragraph. An earlier contact was the complaint, which this
  // letter confirms; without one, the letter is the complaint.
  B.push({
    t: "p",
    tekst: [
      "Jeg viser til mitt kjøp av brukt ", ...car, ...(has("c_year") ? [", årsmodell ", fe("c_year", s.c_year)] : []), ", reg.nr. ", reg, ". ",
      // The purchase date only when the buyer gave one other than the handover.
      ...(has("c_purchase") && s.c_purchase !== s.c_delivery
        ? ["Jeg kjøpte bilen ", vd("c_purchase", "kjøpsdato"), " for kr ", v("c_price", "kjøpesum"), " og overtok den ", vd("c_delivery", "overtakelsesdato")]
        : ["Jeg kjøpte og overtok bilen ", vd("c_delivery", "kjøpsdato"), " for kr ", v("c_price", "kjøpesum")]),
      ...(has("c_km") ? [" med en kilometerstand på ", fe("c_km", s.c_km), " km"] : []), ". ",
      ...(s.f_prior
        ? [
            ...(has("f_prior_date") ? ["Jeg tok opp mangelen med dere ", fe("f_prior_date", fmtD(s.f_prior_date))] : ["Jeg har tidligere tatt opp mangelen med dere"]),
            `, og dette brevet bekrefter og utdyper reklamasjonen, jf. ${L.lovRef("reklamasjon")}.`,
            ...(has("f_prior_date") && poster.some((p) => p.found > s.f_prior_date) ? [" For feil jeg har oppdaget senere, er dette brevet reklamasjonen."] : []),
          ]
        : [`Bilen har en mangel, og jeg reklamerer med dette etter ${L.lovRef("reklamasjon")}.`]),
    ],
  });

  B.push({ t: "h", tekst: ["Mangelen"] });
  // How the faults affect the buyer, as one sentence of «Feilen …» clauses. «Kan ikke brukes» says what
  // «ikke til å stole på» and «påvirker bruken» would, and «ikke til å stole på» says what «påvirker
  // bruken» would; the clauses with «gjør at» come last, so the list stays readable.
  const imp = s.f_impact.filter((k) => !(k === "palitelig" && s.f_impact.includes("stopp")) && !(k === "bruk" && (s.f_impact.includes("stopp") || s.f_impact.includes("palitelig"))));
  const flere = poster.length > 1;
  const ledd = IMPACT.filter((x) => imp.includes(x[0])).map((x) => (flere && FLERTALL[x[0]]) || x[4]);
  const virkning = ledd.length ? `${flere ? "Feilene" : "Feilen"} ${liste([...ledd.filter((x) => !x.startsWith("gjør at")), ...ledd.filter((x) => x.startsWith("gjør at"))])}.` : "";
  // One paragraph per fault, by the day it was discovered, «også» from the second. Faults of the same
  // day without a description of their own share a sentence.
  if (poster.length) {
    const sortert = poster.map((p, i) => ({ p, i })).sort((a, b) => (a.p.found || "9").localeCompare(b.p.found || "9") || a.i - b.i).map((x) => x.p);
    const grupper: Feilpost[][] = [];
    for (const p of sortert) {
      const g = grupper.at(-1);
      if (g && p.found && p.found === g[0].found && g.every((x) => !x.desc)) g.push(p);
      else grupper.push([p]);
    }
    grupper.forEach((g, i) => {
      const d = g[0].found,
        siste = g.at(-1)!;
      B.push({
        t: "p",
        tekst: [
          "Den ", d ? fe(g[0].felt, fmtD(d)) : { ph: "dato" }, ` oppdaget jeg ${i ? "også " : ""}`, ...funn(g), ".",
          ...(siste.desc ? [" ", fe(siste.descFelt, sentence(siste.desc))] : []),
          ...(i === grupper.length - 1 && virkning ? [" ", virkning] : []),
        ],
      });
    });
  } else B.push({ t: "p", tekst: ["Den ", vd("f_found", "dato"), " oppdaget jeg ", { ph: "Beskrivelse av feilen" }, ".", ...(virkning ? [" ", virkning] : [])] });

  // The evidence in one paragraph: the workshop and its report, what the seller said before the sale,
  // and what they answered when the buyer raised the fault.
  const bevis: Del[][] = [];
  if (s.ws === "rapport" || s.ws === "uten") {
    bevis.push(has("ws_name") ? [fe("ws_name", s.ws_name.trim()), " har undersøkt bilen."] : ["Bilen er undersøkt av et verksted."]);
    if (s.ws === "rapport") {
      const says = s.ws_says.map((k) => WS_SAYS[k]).filter(Boolean);
      bevis.push([`Verkstedrapporten${rapportVedlagt(s) ? ", som følger vedlagt," : ""} ${says.length ? liste(says) : "beskriver feilen"}.`]);
      if (has("ws_quote")) bevis.push(["Rapportens konklusjon er: «", fe("ws_quote", unquote(s.ws_quote)), "»."]);
    } else {
      // Without a report the letter says what the workshop told the buyer, as told, and where the dealer can check it.
      const sagt = s.ws_says.map((k) => WS_SAGT[k]).filter(Boolean);
      const opplyst = sagt.flatMap((x) => x.opplyst ?? []).map((x, i) => (i ? x.replace("at feilen", "at den") : x));
      const gjort = [...sagt.flatMap((x) => x.gjort ?? []), ...(opplyst.length ? [`opplyst meg om ${liste(opplyst)}`] : [])];
      if (gjort.length) bevis.push([`Verkstedet har ${liste(gjort)}.`]);
      if (has("ws_quote")) bevis.push(["Slik jeg oppfattet verkstedet: ", fe("ws_quote", sentence(unquote(s.ws_quote)))]);
      if (gjort.length || has("ws_quote")) bevis.push(["Dere kan kontakte verkstedet for å få dette bekreftet."]);
    }
  }
  if (s.seller_said === "lovet") bevis.push(has("seller_txt") ? ["Før kjøpet opplyste dere: «", fe("seller_txt", unquote(s.seller_txt)), "»."] : ["Før kjøpet ga dere uttrykk for at bilen var fri for slike feil."]);
  const svaret = forhandlerensSvar(s);
  if (svaret) bevis.push([svaret]);
  // A single sentence closes the last fault paragraph rather than standing alone.
  const sisteFeil = B.at(-1);
  if (bevis.length === 1 && sisteFeil?.t === "p") sisteFeil.tekst.push(" ", ...bevis[0]);
  else if (bevis.length) B.push({ t: "p", tekst: joinD(bevis) });

  B.push({ t: "h", tekst: ["Rettslig grunnlag"] });
  B.push({
    t: "p",
    tekst: [
      `Etter ${L.lovRef("krav")} skal bilen være i samsvar med avtalen og ha de egenskapene jeg med rette kunne forvente. Når den ikke er det, foreligger det en mangel, jf. ${L.par("avvik")}.`,
      ...(s.seller_said === "lovet" ? [` Det dere opplyste før kjøpet, er en del av avtalen, jf. ${L.par("uriktig")}.`] : []),
    ],
  });
  // Before 2024 old § 17; from 2024 a general «som den er» is no agreed exception under § 15 annet ledd
  // (the wording the lawyer reviewed in the earlier letter).
  // Also when the seller answered with «som den er» though the buyer did not tick it for the contract:
  // the sentence then speaks of the reservation without saying the car was sold with it.
  if (s.c_asis || s.f_prior_svar.includes("som_den_er")) {
    const pastatt = !s.c_asis;
    B.push({
      t: "p",
      tekst: [
        L.versjon === "før_2024"
          ? `${pastatt ? "Et forbehold om at bilen selges «som den er», fritar dere ikke uten videre for ansvar." : "Bilen ble solgt «som den er»."} Etter ${L.lovRef("forbehold")} har bilen likevel en mangel når den er ${LOVORD.dårligereStand}.${s.seller_said === "lovet" && L.par("forbehold_uriktig") ? ` Bilen har også en mangel når den ikke svarer til opplysninger dere ga før kjøpet, jf. ${L.par("forbehold_uriktig")}.` : ""}`
          : `${pastatt ? "Et generelt forbehold om at bilen selges «som den er», er ikke" : "Forbeholdet om at bilen ble solgt «som den er», er ikke"} et avtalt unntak etter ${L.lovRef("forbehold")}. Unntaket fra ${LOVORD.kravTredjeFjerde} forutsetter at jeg ved inngåelsen av avtalen ${LOVORD.avtaltUnntak}.`,
      ],
    });
  }
  // When the faults showed and when the buyer complained, in one paragraph.
  const del = parseD(s.c_delivery),
    found = parseD(s.f_found);
  const tid: Del[][] = [];
  const formodning = `Etter ${L.par("formodning")} skal en mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises.`;
  // Each fault on its own date, in calendar months as the law and the ranking count (tidsnivaFor):
  // the presumption only for the faults inside it, the five-year rule only between two and five years.
  // A fault in what the seller said or promised existed at the sale: no presumption for it.
  // Said by the workshop without a report, it is told as what the workshop said.
  const ikkeSlitasje = (s.ws === "rapport" || s.ws === "uten") && s.ws_says.includes("ikke_slitasje");
  let iFormodning = false;
  const datert = poster.filter((p) => p.found && s.c_delivery && p.found >= s.c_delivery && !opplysningsfeil(p.hoved, p.under));
  if (s.c_delivery && datert.length) {
    const inne = datert.filter((p) => p.found <= plussManeder(s.c_delivery, L.formodningMnd));
    const sene = datert.filter((p) => p.found > plussManeder(s.c_delivery, 24) && p.found <= plussManeder(s.c_delivery, 60));
    const alene = datert.length === 1;
    if (inne.length) {
      const hvem: [Del[], string] = alene
        ? [[`Feilen viste seg ${dur(del!, parseD(inne[0].found)!) || "samme dag"} etter overtakelsen.`], "feilen"]
        : inne.length === datert.length
          ? [[`Feilene viste seg innen ${L.formodningTekst} etter overtakelsen.`], "feilene"]
          : [[`${inne.length > 1 ? "Feilene" : "Feilen"} `, ...kortNavn(inne), ` viste seg innen ${L.formodningTekst} etter overtakelsen.`], inne.length > 1 ? "disse feilene" : "denne feilen"];
      // The exception (§ 18 annet ledd, «uforenlig med varens eller mangelens art») is the seller's usual
      // answer for a used car: wear. It is only answered when the workshop report says it is not wear.
      const unntak = ikkeSlitasje ? ` ${s.ws === "rapport" ? "Verkstedrapporten fastslår" : "Verkstedet har opplyst"} at feilen ikke skyldes normal slitasje, og formodningen er derfor ikke ${LOVORD.uforenlig}, jf. ${L.par("formodning_unntak")}.` : "";
      tid.push([...hvem[0], ` ${formodning} Det er dermed dere som må bevise at ${hvem[1]} ikke var til stede da jeg overtok bilen.${unntak}`]);
      iFormodning = true;
    }
    if (sene.length) {
      const hvem: Del[] = alene ? [`Feilen viste seg ${dur(del!, parseD(sene[0].found)!)} etter overtakelsen.`] : [`${sene.length > 1 ? "Feilene" : "Feilen"} `, ...kortNavn(sene), " viste seg mer enn to år etter overtakelsen."];
      tid.push([...hvem, ` En bil er ment å vare vesentlig lenger enn to år, og reklamasjonsfristen er derfor fem år, jf. ${L.par("reklamasjon_5ar")}.`]);
    }
  } else if ((!del || !found) && !bareOpplysningsfeil(s)) tid.push([`En mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, jf. ${L.par("formodning")}.`]);
  // Each fault was complained of by the earlier contact when it was known then, else by this letter.
  // Timely only when it surely is: within two months of the discovery and five years of the handover,
  // and not dated before the discovery.
  const tidligere = s.f_prior ? parseD(s.f_prior_date) : null;
  const nr = tidligere ?? ld;
  const etterFemAr = !!del && nr > parseD(plussManeder(s.c_delivery, 60))!;
  const reklamertFor = (p: Feilpost) => (tidligere && s.f_prior_date >= p.found ? tidligere : ld);
  const medDato = poster.filter((p) => parseD(p.found));
  const iTide = etterFemAr ? [] : medDato.filter((p) => reklamertFor(p) >= parseD(p.found)! && reklamertFor(p) <= addMonths(parseD(p.found)!, 2));
  const rettidig = medDato.length > 0 && iTide.length === medDato.length;
  if (rettidig) tid.push([`Reklamasjonen er fremsatt innen to måneder etter at jeg oppdaget ${medDato.length > 1 ? "feilene" : "feilen"}, og er dermed rettidig etter ${L.par("reklamasjon")}.`]);
  else if (iTide.length)
    tid.push(["Reklamasjonen på feilen ", ...kortNavn(iTide), ` er fremsatt innen to måneder etter at jeg oppdaget ${iTide.length > 1 ? "dem" : "den"}, og er dermed rettidig etter ${L.par("reklamasjon")}.`]);
  // Late, the letter says what the law says rather than nothing: the limit is «rimelig tid», and a seller
  // who acted in bad faith cannot rely on it. The buyer's own ground only when the seller promised.
  const unntak = L.par("reklamasjon_unntak") ? `, jf. ${L.par("reklamasjon_unntak")}` : "";
  if (etterFemAr && s.c_unntak)
    tid.push([`Det er mer enn fem år siden jeg overtok bilen. Fristen på fem år gjelder likevel ikke når selgeren har påtatt seg ansvar for lengre tid ved garanti, eller har opptrådt grovt uaktsomt eller i strid med redelighet og god tro${unntak}. Jeg gjør gjeldende at det er tilfellet her.`]);
  else if (!etterFemAr && medDato.some((p) => reklamertFor(p) > addMonths(parseD(p.found)!, 2)))
    tid.push([
      `Reklamasjonsfristen etter ${L.par("reklamasjon")} er «innen rimelig tid», og fristen gjelder ikke dersom selgeren har opptrådt grovt uaktsomt eller i strid med redelighet og god tro${unntak}.`,
      ...(s.seller_said === "lovet" ? [" Opplysningen dere ga før kjøpet, var uriktig, og jeg gjør gjeldende at fristen av den grunn ikke er til hinder for kravet."] : []),
    ]);
  // The timeliness alone joins the paragraph before it.
  const forrige = B.at(-1);
  if (tid.length === 1 && rettidig && forrige?.t === "p") forrige.tekst.push(" ", ...tid[0]);
  else if (tid.length) B.push({ t: "p", tekst: joinD(tid) });
  const mot = svarPaInnvendinger(s, L, { iFormodning, rettidig, ikkeSlitasje });
  if (mot.ut.length) {
    const flereSvar = SVAR.filter(([id]) => s.f_prior_svar.includes(id)).length > 1;
    B.push({ t: "p", tekst: [[...(mot.alle ? [`${flereSvar ? "Svarene" : "Svaret"} dere ga, endrer ikke kravet.`] : []), ...mot.ut].join(" ")] });
  }

  if (presedens === "venter") {
    B.push({ t: "h", tekst: ["Praksis fra Forbrukerklageutvalget"] });
    B.push({ t: "p", tekst: [{ ph: "lignende sak hentes" }] });
  } else if (presedens) {
    B.push({ t: "h", tekst: [`Praksis fra ${presedens.utvalg}`] });
    B.push({
      t: "prec",
      avsnitt: [[{ felt: "vedtak.avsnitt", tekst: presedens.avsnitt }], [`${slutning(presedens, s)}${presedens.kildeUrl ? ` Vedtaket er offentlig tilgjengelig på ${presedens.kildeUrl}` : ""}`]],
    });
  } else {
    // Without a decision the law's sentence closes «Rettslig grunnlag».
    const siste = B.at(-1);
    if (siste?.t === "p") siste.tekst.push(` ${LOVSETNING}`);
    else B.push({ t: "p", tekst: [LOVSETNING] });
  }

  B.push({ t: "h", tekst: ["Krav"] });
  const kjop: Del = has("c_price") ? fe("c_price", s.c_price) : { ph: "kjøpesum" };
  // Interest on the repaid price (fkjl. § 50 annet ledd). The day it runs from is only claimed where
  // the table has verified it, and only with a known day of the complaint: the earlier contact when
  // dated, else this letter.
  const reklamert = s.f_prior ? (has("f_prior_date") ? fe("f_prior_date", fmtD(s.f_prior_date)) : null) : dato;
  const renter: Del[] = [
    "med tillegg av renter etter forsinkelsesrenteloven",
    ...(RENTER_FRA_REKLAMASJON[L.versjon] ? [" fra den dag jeg reklamerte", ...(reklamert ? [", ", reklamert] : [])] : []),
    `, jf. ${L.par("renter_heving")}`,
  ];
  // A loaner: before 2024 a right when the repair keeps the buyer from the car for more than a week and
  // the claim is reasonable (old § 30 tredje ledd); from 2024 a weight in whether the remedy is without
  // significant inconvenience (§ 30 første ledd annet punktum).
  const lanebil = () =>
    L.versjon === "før_2024"
      ? `Vil rettingen medføre at jeg i mer enn en uke blir avskåret fra å bruke bilen, ber jeg om at dere stiller en erstatningsbil til rådighet for deres regning, jf. ${L.par("erstatningsbil")}.`
      : `Jeg ber om at dere stiller lånebil til disposisjon mens bilen er til reparasjon. Om rettingen skjer uten vesentlig ulempe for meg, skal det blant annet legges vekt på om dere stiller en erstatningsbil til rådighet, jf. ${L.par("erstatningsbil")}.`;
  // Price reduction or heving claimed first while the seller may still offer a remedy (§ 29 tredje ledd):
  // the letter says so, as Forbrukerrådet's template does, and keeps the claim for when no lawful remedy
  // comes. From 2024 a defect the answers show is serious is claimed at once with the law's words.
  // A wrong odometer or a missing service record is nothing to repair: no offer, nothing to examine.
  const forbi = forbiAvhjelp(s, L) || bareOpplysningsfeil(s);
  const umiddelbart = !!L.par("avhjelp_umiddelbart") && alvorlig(s) && (forsokTall(s.k_forsok) ?? 0) < 1;
  const tilbud = (krav: string) =>
    ` Jeg er kjent med at dere kan tilby å rette mangelen${TILBUD_UTEN_OPPHOLD[L.versjon] ? ", dersom det skjer uten opphold" : ""}, jf. ${L.par("avhjelp_tilbud")}. Rettingen må i så fall skje uten kostnad, uten vesentlig ulempe for meg og innen rimelig tid, jf. ${L.par("avhjelp_vilkar")}. Skjer ikke det, fastholder jeg kravet om ${krav}.`;
  const straks = `Mangelen er etter sin art så alvorlig at det ikke er rimelig å forvente at jeg skal godta et tilbud om avhjelp, jf. ${L.par("avhjelp_umiddelbart")}.`;
  // § 32 is cited in the same paragraph; this one says who must prove the exception.
  const bevisbyrde = SELGER_BEVISER_UVESENTLIG[L.versjon] ? " Det er dere som har bevisbyrden for at mangelen er uvesentlig." : "";
  // Forbrukerrådet's template: the seller may examine the defect and repair it. From 2024 the buyer must
  // make the thing available (§ 30 annet ledd); before, the offer stands without a paragraph.
  const rad = (hva: string) => ` Bilen kan stilles til rådighet for ${hva} etter nærmere avtale${L.par("rad") ? `, jf. ${L.par("rad")}` : ""}.`;
  switch (s.k_main) {
    case "retting":
      B.push({ t: "p", tekst: [`Jeg krever at mangelen rettes, jf. ${L.par("retting")}. Rettingen skal skje uten kostnad for meg, innen rimelig tid og uten vesentlig ulempe for meg.${rad("undersøkelse og retting")} ${lanebil()}`] });
      break;
    case "prisavslag": {
      const alvor = alvorGrunner(s);
      B.push({
        t: "p",
        tekst: [
          "Jeg krever et forholdsmessig prisavslag på kr ", v("k_amount", "beløp"), `, jf. ${L.par("prisavslag")}`,
          ...(has("k_cost") ? [", basert på et overslag over utbedringskostnaden på kr ", fe("k_cost", s.k_cost.trim())] : []), ".",
          umiddelbart ? ` ${cap(liste(alvor))}, og mangelen er derfor etter sin art så alvorlig at det ikke er rimelig å forvente at jeg skal godta et tilbud om avhjelp, jf. ${L.par("avhjelp_umiddelbart")}.` : forbi ? "" : tilbud("prisavslag"),
          bareOpplysningsfeil(s) ? "" : rad(forbi ? "undersøkelse" : "undersøkelse og retting"),
        ],
      });
      break;
    }
    case "heving": {
      const { grunner, folge } = hevingsgrunner(s, L);
      B.push({
        t: "p",
        tekst: [
          // Without a ground to skip the remedy the letter claims heving rather than declaring it.
          ...(grunner.length ? [`${forbi ? "Jeg hever kjøpet" : "Jeg krever å heve kjøpet"}, jf. ${L.par("heving")}. `, ...ikkeUvesentlig(grunner)] : [`Jeg krever å heve kjøpet, jf. ${L.par("heving")}, fordi mangelen ikke er uvesentlig.`]),
          bevisbyrde, folge ? ` ${folge}` : "",
          umiddelbart ? ` ${straks}` : forbi ? "" : tilbud("heving"),
          " Kjøpesummen på kr ", kjop, " skal da tilbakebetales mot at bilen leveres tilbake til dere, ", ...renter, ".",
          rad(forbi || umiddelbart ? "undersøkelse" : "undersøkelse og retting"),
          " Jeg ber om at dere tar kontakt for å avtale tilbakelevering og oppgjør.",
        ],
      });
      break;
    }
    default:
      B.push({ t: "p", tekst: ["Jeg krever ", { ph: "velg krav i steg 4" }, "."] });
  }
  if (s.k_main === "retting" && (s.k_alt === "prisavslag" || s.k_alt === "heving")) {
    const hev = s.k_alt === "heving";
    const { grunner, folge } = hev ? hevingsgrunner(s, L) : { grunner: [], folge: "" };
    B.push({
      t: "p",
      tekst: [
        `Dersom retting ikke skjer innen rimelig tid, ikke lykkes eller ikke er mulig, krever jeg subsidiært ${hev ? `å heve kjøpet, jf. ${L.par("heving")}.` : `et forholdsmessig prisavslag, jf. ${L.par("prisavslag")}.`}`,
        ...(grunner.length ? [" ", ...ikkeUvesentlig(grunner)] : []),
        ...(hev ? [bevisbyrde, folge ? ` ${folge}` : "", " Kjøpesummen skal i så fall tilbakebetales mot at bilen leveres tilbake, ", ...renter, "."] : []),
      ],
    });
  }
  // The expenses in one sentence, with their sum when there are more than one.
  if (s.k_exp) {
    const it = s.exp.map((x, i) => ({ ...x, i })).filter((x) => x.t || x.a);
    const sum = it.reduce((a, x) => a + (+x.a || 0), 0);
    B.push({
      t: "p",
      tekst: [
        `Jeg krever også erstatning for utgiftene jeg har hatt som følge av mangelen, jf. ${L.par("erstatning")}`,
        ...(it.length
          ? [": ", ...listJoinD(it.map((x) => [`${kr(+x.a || 0)} til `, x.t.trim() ? fe(`exp.${x.i}`, lcFirst(trimDot(x.t))) : { ph: "utgift" }])), it.length > 1 ? `, til sammen ${kr(sum)}` : "", "."]
          : [": ", { ph: "legg til utgiftene" }, "."]),
      ],
    });
  }

  // Fourteen days is what the buyer is told is reasonable in most cases.
  const dd = fmtD(addDays(ld, 14));
  const nxt = "bringe saken inn for Forbrukertilsynet for mekling og eventuelt videre til Forbrukerklageutvalget";
  // An amount the seller must pay (a price reduction or compensation) draws late-payment interest
  // when it is paid late; when it falls due follows forsinkelsesrenteloven § 2, which the letter does
  // not restate. The purchase price repaid after heving has its own rule above (renter).
  const hva = [s.k_main === "prisavslag" ? "prisavslaget" : "", s.k_exp && s.exp.some((x) => x.t || x.a) ? "erstatningen for utgiftene" : ""].filter(Boolean);
  const belop = hva.length ? ` ${cap(liste(hva))} bes utbetalt innen fristen. Ved forsinket betaling kreves forsinkelsesrente etter ${ANDRE_LOVER.forsinkelsesrente}.` : "";
  B.push({ t: "p", tekst: [`Jeg ber om en skriftlig tilbakemelding innen ${dd} med forslag til hvordan dere vil løse saken.${belop} Kommer vi ikke til enighet, vil jeg ${nxt}.`] });
  B.push({ t: "sign", linjer: [["Med vennlig hilsen"], [""], [v("b_name", "Ditt navn")]] });
  // The list of attachments follows the signature, as in a Norwegian business letter.
  const att = vedlegg(s);
  if (att.length) {
    B.push({ t: "h", tekst: ["Vedlegg"] });
    B.push({ t: "ol", punkter: att.map((a) => [a]) });
  }
  return B;
}

// The letter's own conclusion after the decision's paragraph (which mal.ts fills and the done criteria
// measure): every clause follows from a field, and the car is only said not to be worse placed when
// each side the ranking compared is level or in the buyer's favour.
function slutning(p: Presedens, s: Skjema): string {
  const sider: Kriterium[] = ["km", "alder", "som_den_er"];
  const ikkeSvakere = sider.every((k) => p.treff[k] === "likt" || p.treff[k] === "mildere");
  const lik = p.niva === "A" ? "Saken gjaldt samme type feil som min" : "Vedtaket avgjør det samme rettslige spørsmålet som min sak reiser";
  const d = [`${lik}${ikkeSvakere ? ", og min bil var ikke i et svakere utgangspunkt" : ""}.`];
  if (s.k_main && p.utfall.includes(s.k_main)) d.push(`Kjøperen fikk der medhold i ${s.k_main}, som er det jeg krever.`);
  d.push("Min sak bør derfor vurderes på samme måte.");
  return d.join(" ");
}

const tekst = (d: Del[]) => d.map((x) => (typeof x === "string" ? x : "ph" in x ? `[${x.ph}]` : "felt" in x ? x.tekst : "")).join("");

// The letter as plain text for the clipboard, placeholders as «[…]» and hidden text left out.
export function tilTekst(B: Blokk[]): string {
  return B.map((b) => {
    switch (b.t) {
      case "addr":
      case "sign":
        return b.linjer.map(tekst).join("\n");
      case "prec":
        return b.avsnitt.map(tekst).join("\n\n");
      case "ol":
        return b.punkter.map((i, n) => `${n + 1}. ${tekst(i)}`).join("\n");
      default:
        return tekst(b.tekst);
    }
  })
    .join("\n\n")
    .replace(/[  ]/g, " ");
}

export const emne = (B: Blokk[]) => {
  const s = B.find((b) => b.t === "subj");
  return s && "tekst" in s ? tekst(s.tekst) : "";
};
