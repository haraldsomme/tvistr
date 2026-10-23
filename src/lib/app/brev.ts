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
import { feilord } from "@/lib/brev/feilord";
import { fe, feiloverskrift, funn, joinD, listJoinD } from "./feilnavn";
import { liste, tall, tallord } from "@/lib/brev/format";
import { ANDRE_LOVER, LOVORD, RENTER_FRA_REKLAMASJON, SELGER_BEVISER_UVESENTLIG, TILBUD_UTEN_OPPHOLD } from "@/lib/brev/paragrafer";
import { plussManeder } from "@/lib/brev/tidslinje";
import { LOVSETNING } from "@/lib/vedtaksvalg/valg";
import type { Blokk, Del, Presedens, Presedenser } from "./brevtyper";
import { addDays, addMonths, dur, fmtD, parseD } from "./dato";
import { bareOpplysningsfeil, type Feilpost, feilposter, feilposterSortert, virkningFor } from "./feil";
import { cap, lcFirst } from "./format";
import { regler, type Regler } from "./lov";
import { forsokTall, heltall } from "./saken";
import { IKKE_SVART, IMPACT, IMPACT_SOLO, rapportVedlagt, type Skjema, SVAR, vedlegg, WS_SAGT, WS_SAYS, WS_SAYS_FLERE } from "./skjema";

type Tekstfelt = { [K in keyof Skjema]: Skjema[K] extends string ? K : never }[keyof Skjema];

const kr = (n: number) => `kr ${tall(n)}`;
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const trimDot = (s: string) => s.trim().replace(/[.]$/, "");
// The buyer's words inside the letter's «»: their own outer quotes go, inner «» become ‘’.
const unquote = (s: string) => {
  const t = s.trim();
  return trimDot(/^[«"][\s\S]*[»"]$/.test(t) ? t.slice(1, -1) : t).replace(/«/g, "‘").replace(/»/g, "’");
};

// The faults the posts name: a post with two parts of one area dated together is two faults.
const antallFeil = (poster: Feilpost[]) => poster.reduce((n, p) => n + feilord(p.hoved, p.under).length, 0);

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
const ikkeUvesentlig = (g: Del[][]): Del[] => ["Mangelen er ikke uvesentlig: ", ...listJoinD(g), "."];

// The buyer's earlier contact and the seller's answer, as their own paragraph: «Jeg kontaktet dere
// [dato] og opplyste om feilen. Dere svarte at A og at B.» A refusal is «avviste dere reklamasjonen»,
// without reasons when nothing else was answered. Only the faults known on the day are said to be raised.
function henvendelsen(s: Skjema): Del[] {
  if (!s.f_prior) return [];
  const dato = s.f_prior_date.trim() !== "";
  const poster = feilposter(s);
  const kjent = poster.filter((p) => !dato || !p.found || p.found <= s.f_prior_date);
  const feilen = kjent.length === 2 ? "begge feilene" : kjent.length > 1 ? "feilene" : "feilen";
  const ut: Del[] = dato
    ? ["Jeg kontaktet dere ", fe("f_prior_date", fmtD(s.f_prior_date)), ` og opplyste om ${feilen}.`, ...(kjent.length < poster.length ? [" For feil jeg har oppdaget etter det, er dette brevet reklamasjonen."] : [])]
    : [`Jeg har tidligere kontaktet dere og opplyst om ${feilen}.`];
  if (s.f_prior_svar.includes(IKKE_SVART)) return [...ut, " Dere har ikke svart på henvendelsen."];
  const at = SVAR.filter(([id]) => id !== "avvist" && s.f_prior_svar.includes(id)).map(([, , ord]) => `at ${ord}`);
  const svarte = at.length ? `svarte ${liste(at)}` : "";
  if (s.f_prior_svar.includes("avvist")) return [...ut, ` Dere avviste reklamasjonen${svarte ? ` og ${svarte}` : " uten begrunnelse"}.`];
  return svarte ? [...ut, ` Dere ${svarte}.`] : ut;
}

// The law's answer to each objection the seller gave (SVAR, after Forbrukerrådet's «Vanlige spørsmål og
// svar»), each sentence citing the table. «Som den er» has its own paragraph above, and a refusal without
// reasons or «wait and see» need no answer. Nothing is claimed that the answers do not carry: wear is
// only answered inside the presumption or when the workshop ruled it out, lateness only with the law's limits. `alle` is
// whether every objection given is answered somewhere in the letter, so it may say they change nothing.
// Which of the dated faults (not those in what the seller said) showed inside the presumption.
type Formodningsdekning = "ingen" | "en" | "noen" | "alle";

function svarPaInnvendinger(s: Skjema, L: Regler, k: { iFormodning: Formodningsdekning; rettidig: boolean; ikkeSlitasje: boolean }): { ut: string[]; alle: boolean } {
  const har = (id: string) => s.f_prior && s.f_prior_svar.includes(id);
  const ut: string[] = [];
  let alle = true;
  if (har("slitasje")) {
    if (k.iFormodning === "alle") ut.push("Det er dere som må bevise at feilen ikke var til stede ved leveringen, også når dere viser til slitasje eller feil bruk.");
    else if (k.iFormodning !== "ingen")
      ut.push(`For ${k.iFormodning === "noen" ? "feilene" : "feilen"} som viste seg innen ${L.formodningTekst} etter overtakelsen, er det dere som må bevise at ${k.iFormodning === "noen" ? "de" : "den"} ikke var til stede ved leveringen, også når dere viser til slitasje eller feil bruk.`);
    else if (k.ikkeSlitasje) ut.push(`Dere har vist til slitasje eller feil bruk, men ${s.ws === "rapport" ? "verkstedrapporten fastslår" : "verkstedet har opplyst"} at feilen ikke skyldes normal slitasje.`);
    else alle = false;
  }
  if (har("produsent")) ut.push(`Kravet mitt retter seg mot dere som selger, jf. ${L.par("selger")}. Jeg kan gå mot et tidligere salgsledd, men har ingen plikt til det, jf. ${L.par("tidligere_ledd")}.`);
  if (har("betaling")) ut.push(`Retting skal skje uten kostnad for meg, jf. ${L.par("avhjelp_vilkar")}.`);
  if (har("garanti_ute")) ut.push(`At garantien er utløpt, har ikke betydning for kravet, som bygger på loven. En garanti «${LOVORD.garantiBegrenser}», jf. ${L.par("garanti_lov")}.`);
  if (har("for_sent") && !k.rettidig) ut.push(`Fristen for å reklamere er aldri kortere enn to måneder fra jeg oppdaget mangelen, jf. ${L.par("reklamasjon")}. For en bil er den ytterste fristen fem år etter overtakelsen, jf. ${L.par("reklamasjon_5ar")}.`);
  return { ut, alle };
}

// `presedenser`: the decision cited under each fault, by its key (Feilpost.nokkel): one the buyer chose,
// «venter» while finnVedtak is still working, so a letter copied then shows a gap rather than a letter
// without it, or none (missing or null: the law's sentence).
export function byggBrev(s: Skjema, presedenser: Presedenser, idag: string): Blokk[] {
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
      ...(has("c_km") ? [(s.f_parts.historikk ?? []).includes("km") ? " med en oppgitt kilometerstand på " : " med en kilometerstand på ", fe("c_km", s.c_km), " km"] : []), ". ",
      ...(s.f_prior
        ? [
            `Jeg har tidligere reklamert på mangelen overfor dere, og dette brevet bekrefter og utdyper reklamasjonen, jf. ${L.lovRef("reklamasjon")}.`,
          ]
        : [`Bilen har en mangel, og jeg reklamerer med dette etter ${L.lovRef("reklamasjon")}.`]),
    ],
  });

  B.push({ t: "h", tekst: ["Mangelen"] });
  // How each fault affects the buyer, closing its paragraph: «Konsekvensen av feilen er at A, at B og
  // at C.», the most serious first, or «… er kosmetisk[, og senker verdien på bilen].». «Kan ikke
  // brukes» says what «ikke til å stole på» and «påvirker bruken» would, and «ikke til å stole på» says
  // what «påvirker bruken» would. Tagged with the choice, so a click opens it.
  const konsekvens = (p: Feilpost): Del[] => {
    const v = virkningFor(s, p);
    if (!v.length) return [];
    const feilen = feilord(p.hoved, p.under).length > 1 ? "feilene" : "feilen";
    const imp = v.filter((k) => !(k === "palitelig" && v.includes("stopp")) && !(k === "bruk" && (v.includes("stopp") || v.includes("palitelig"))));
    const ledd = IMPACT.filter((x) => imp.includes(x[0])).toReversed().map((x) => `at ${x[4]}`);
    const t = v.includes(IMPACT_SOLO) ? `Konsekvensen av ${feilen} er kosmetisk${v.includes("verdi") ? ", og senker verdien på bilen" : ""}.` : `Konsekvensen av ${feilen} er ${liste(ledd)}.`;
    return [" ", fe(`f_virkning.${p.nokkel}`, t)];
  };
  // How many faults, then one paragraph per fault by the day it was discovered, each under its own
  // numbered subheading when there are several (the same numbers as under «Rettslig grunnlag»).
  if (poster.length) {
    const sortert = feilposterSortert(s);
    B.push({ t: "p", tekst: [`Bilen har ${tallord(antallFeil(sortert))} feil som jeg reklamerer på.`] });
    sortert.forEach((p, i) => {
      if (sortert.length > 1) B.push({ t: "h2", tekst: [`${i + 1}. `, ...feiloverskrift(p, "ubestemt")] });
      B.push({
        t: "p",
        tekst: ["Den ", p.found ? fe(p.felt, fmtD(p.found)) : { ph: "dato" }, " oppdaget jeg ", ...funn([p]), ".", ...(p.desc ? [" ", fe(p.descFelt, sentence(p.desc))] : []), ...konsekvens(p)],
      });
    });
  } else B.push({ t: "p", tekst: ["Den ", vd("f_found", "dato"), " oppdaget jeg ", { ph: "Beskrivelse av feilen" }, "."] });
  const sisteFeil = B.at(-1)!;

  // The evidence in one paragraph: the workshop and its report, and what the seller said before the sale.
  const bevis: Del[][] = [];
  if (s.ws === "rapport" || s.ws === "uten") {
    bevis.push(has("ws_name") ? [fe("ws_name", s.ws_name.trim()), " har undersøkt bilen."] : ["Bilen er undersøkt av et verksted."]);
    if (s.ws === "rapport") {
      const says = s.ws_says.map((k) => (poster.length > 1 ? WS_SAYS_FLERE : WS_SAYS)[k]).filter(Boolean);
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
  // A single sentence closes the last fault paragraph rather than standing alone.
  if (bevis.length === 1 && sisteFeil.t === "p") sisteFeil.tekst.push(" ", ...bevis[0]);
  else if (bevis.length) B.push({ t: "p", tekst: joinD(bevis) });
  const kontakt = henvendelsen(s);
  if (kontakt.length) B.push({ t: "p", tekst: kontakt });

  B.push({ t: "h", tekst: ["Rettslig grunnlag"] });
  const sortert = feilposterSortert(s);
  const flere = sortert.length > 1;
  B.push({
    t: "p",
    tekst: [
      `Etter ${L.lovRef("krav")} skal bilen være i samsvar med avtalen og ha de egenskapene jeg med rette kunne forvente. Når den ikke er det, foreligger det en mangel, jf. ${L.par("avvik")}.`,
      ...(s.seller_said === "lovet" ? [` Det dere opplyste før kjøpet, er en del av avtalen, jf. ${L.par("uriktig")}.`] : []),
      // The faults are gone through one numbered section at a time; the count only when each section is one fault.
      ...(flere ? [` Nedenfor går jeg gjennom ${antallFeil(sortert) === sortert.length ? `de ${tallord(sortert.length)} feilene` : "feilene"} hver for seg.`] : []),
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
  // Then each fault under its own numbered subheading (none for a single fault), in three paragraphs
  // that open with an italic word: whether the defect existed at delivery (the presumption, § 18, or
  // what the workshop concluded), whether the complaint is in time (§ 27), and the decision it cites.
  // Each fault on its own dates, in calendar months as the law and the ranking count (tidsnivaFor).
  const del = parseD(s.c_delivery);
  const formodning = `Etter ${L.par("formodning")} skal en mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises.`;
  const ikkeSlitasje = (s.ws === "rapport" || s.ws === "uten") && s.ws_says.includes("ikke_slitasje");
  const vedLevering = (s.ws === "rapport" || s.ws === "uten") && s.ws_says.includes("levering");
  const rapport = s.ws === "rapport";
  const tidligere = s.f_prior ? parseD(s.f_prior_date) : null;
  // A fault was complained of by the earlier contact when it was known then, else by this letter.
  const reklamertFor = (p: Feilpost) => (tidligere && s.f_prior_date >= p.found ? tidligere : ld);
  const femAr = del ? parseD(plussManeder(s.c_delivery, 60))! : null;
  const unntak = L.par("reklamasjon_unntak") ? `, jf. ${L.par("reklamasjon_unntak")}` : "";
  const gjelderIkke = `gjelder ikke dersom selgeren har opptrådt grovt uaktsomt eller i strid med redelighet og god tro${unntak}.`;
  const iFormodningen = (p: Feilpost) => !!del && !!p.found && p.found >= s.c_delivery && p.found <= plussManeder(s.c_delivery, L.formodningMnd);

  // Why the defect existed at delivery. A fault in what the seller said or promised existed at the sale;
  // inside the presumption the seller must prove otherwise; outside it only what the workshop concluded.
  const forelaa = (p: Feilpost): string => {
    if (opplysningsfeil(p.hoved, p.under)) return "Feilen gjelder det dere opplyste om bilen før kjøpet, og den var dermed til stede ved leveringen.";
    if (!del || !p.found) return `En mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, jf. ${L.par("formodning")}.`;
    if (p.found < s.c_delivery) return "";
    if (iFormodningen(p)) {
      // The exception (§ 18 annet ledd, «uforenlig med varens eller mangelens art») is the seller's usual
      // answer for a used car: wear. It is only answered when the workshop says it is not wear.
      const ikkeUforenlig = ikkeSlitasje ? ` ${rapport ? "Verkstedrapporten fastslår" : "Verkstedet har opplyst"} at feilen ikke skyldes normal slitasje, og formodningen er dermed ikke ${LOVORD.uforenlig}, jf. ${L.par("formodning_unntak")}.` : "";
      return `Feilen viste seg innen ${L.formodningTekst} etter overtakelsen. ${formodning} Det er derfor dere som må bevise at feilen ikke var til stede da jeg overtok bilen.${ikkeUforenlig}`;
    }
    const sier = [vedLevering ? "at feilen var til stede ved leveringen" : "", ikkeSlitasje ? (vedLevering ? "at den ikke skyldes normal slitasje" : "at feilen ikke skyldes normal slitasje") : ""].filter(Boolean);
    if (!sier.length) return "";
    return rapport ? `Verkstedrapporten ${vedLevering ? "konkluderer med" : "fastslår"} ${sier.join(" og ")}.` : `Verkstedet har opplyst ${sier.join(" og ")}.`;
  };

  // Whether the complaint is in time: within two months of the discovery and five years of the
  // handover, or the five-year rule for a fault after two years, or, late, what the law says rather
  // than nothing. An earlier complaint without a date: the letter cannot tell, so it names no day and
  // claims nothing about lateness.
  type Frist = { tekst: Del[]; iTide: boolean; etterFemAr: boolean; sen: boolean };
  const frist = (p: Feilpost): Frist | null => {
    const fd = parseD(p.found);
    if (!fd) return null;
    const reklamert = reklamertFor(p);
    const etterFemAr = !!femAr && reklamert > femAr;
    const iTide = !etterFemAr && reklamert >= fd && reklamert <= addMonths(fd, 2);
    const sen = reklamert > addMonths(fd, 2);
    const etterToAr = !!s.c_delivery && p.found > plussManeder(s.c_delivery, 24) && p.found <= plussManeder(s.c_delivery, 60);
    const t: Del[][] = [];
    const oppdaget: Del[] = [fe(p.felt, fmtD(fd))];
    if (iTide)
      t.push(
        s.f_prior && !tidligere
          ? [`Reklamasjonen er fremsatt innen to måneder etter at jeg oppdaget feilen, jf. ${L.par("reklamasjon")}.`]
          : reklamert === tidligere
            ? ["Jeg reklamerte ", fe("f_prior_date", fmtD(tidligere)), ", innen to måneder etter at jeg oppdaget feilen ", ...oppdaget, `, jf. ${L.par("reklamasjon")}.`]
            : ["Jeg reklamerer med dette brevet, innen to måneder etter at jeg oppdaget feilen ", ...oppdaget, `, jf. ${L.par("reklamasjon")}.`],
      );
    if (etterToAr && !etterFemAr)
      t.push([`At feilen viste seg mer enn to år etter overtakelsen, er ikke til hinder for reklamasjon: en bil er ment å vare vesentlig lenger enn to år, og den ytterste reklamasjonsfristen er derfor fem år, jf. ${L.par("reklamasjon_5ar")}.`]);
    if (etterFemAr && s.c_unntak)
      t.push([`Det er mer enn fem år siden jeg overtok bilen. Fristen på fem år gjelder likevel ikke når selgeren har påtatt seg ansvar for lengre tid ved garanti, eller har opptrådt grovt uaktsomt eller i strid med redelighet og god tro${unntak}. Jeg gjør gjeldende at det er tilfellet her.`]);
    else if (!etterFemAr && sen && !(s.f_prior && !tidligere))
      t.push([
        `Det gikk mer enn to måneder fra jeg oppdaget feilen til jeg reklamerte. To måneder er imidlertid bare lovens korteste frist. Fristen etter ${L.par("reklamasjon")} er «innen rimelig tid», og den ${gjelderIkke}`,
        ...(s.seller_said === "lovet"
          ? [` Dere er en profesjonell forhandler og opplyste før kjøpet at bilen var fri for slike feil. Når det ikke stemte, har dere i det minste opptrådt grovt uaktsomt, og dere kan derfor ikke påberope dere at reklamasjonen kom for sent${unntak}.`]
          : []),
      ]);
    return { tekst: joinD(t), iTide, etterFemAr, sen };
  };

  const frister: Frist[] = [];
  // Without any fault yet: the law's rule alone, and the law's sentence for the decision.
  if (!sortert.length) {
    if (!bareOpplysningsfeil(s)) B.push({ t: "p", tekst: [{ kursiv: "Mangelen forelå ved leveringen." }, ` En mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, jf. ${L.par("formodning")}.`] });
  }
  sortert.forEach((p, i) => {
    if (flere) B.push({ t: "h2", tekst: [`${i + 1}. `, ...feiloverskrift(p, "bestemt")] });
    const fore = forelaa(p);
    if (fore) B.push({ t: "p", tekst: [{ kursiv: "Mangelen forelå ved leveringen." }, ` ${fore}`] });
    const f = frist(p);
    if (f) frister.push(f);
    if (f?.tekst.length) B.push({ t: "p", tekst: [{ kursiv: "Reklamasjonen er rettidig." }, " ", ...f.tekst] });
    const v = presedenser[p.nokkel] ?? null;
    if (v === "venter") B.push({ t: "p", tekst: [{ kursiv: "Praksis fra Forbrukerklageutvalget." }, " ", { ph: "lignende sak hentes" }] });
    else if (v)
      B.push({
        t: "p",
        tekst: [{ kursiv: `Praksis fra ${v.utvalg}.` }, " ", { felt: `vedtak.avsnitt.${p.nokkel}`, tekst: v.avsnitt }, ` ${slutning(v)}${v.kildeUrl ? ` Vedtaket er offentlig tilgjengelig på ${v.kildeUrl}` : ""}`],
      });
    // Without a decision the law's sentence closes the fault's last paragraph.
    else if (B.at(-1)?.t === "p" && (fore || f?.tekst.length)) (B.at(-1) as { tekst: Del[] }).tekst.push(` ${LOVSETNING}`);
    else B.push({ t: "p", tekst: [LOVSETNING] });
  });
  if (!sortert.length) {
    const siste = B.at(-1);
    if (siste?.t === "p") siste.tekst.push(` ${LOVSETNING}`);
    else B.push({ t: "p", tekst: [LOVSETNING] });
  }
  // The answers to the seller's objections, after all the faults: wear is answered inside the
  // presumption, lateness only when not every fault is in time.
  const fysiske = sortert.filter((p) => !opplysningsfeil(p.hoved, p.under) && !!del && !!p.found && p.found >= s.c_delivery);
  const inne = fysiske.filter(iFormodningen).length;
  const iFormodning: Formodningsdekning = !inne ? "ingen" : inne === fysiske.length ? "alle" : inne > 1 ? "noen" : "en";
  const etterFemAr = frister.length ? frister.some((f) => f.etterFemAr) : !!femAr && (tidligere ?? ld) > femAr;
  const rettidig = frister.length > 0 && frister.every((f) => f.iTide);
  const mot = svarPaInnvendinger(s, L, { iFormodning, rettidig: rettidig || etterFemAr, ikkeSlitasje });
  if (mot.ut.length) {
    const flereSvar = SVAR.filter(([id]) => s.f_prior_svar.includes(id)).length > 1;
    B.push({ t: "p", tekst: [[...(mot.alle ? [`${flereSvar ? "Svarene" : "Svaret"} dere ga, endrer ikke kravet.`] : []), ...mot.ut].join(" ")] });
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
    // Repair is still asked for, so the letter does not say here that more repair may be refused.
    const { grunner } = hev ? hevingsgrunner(s, L) : { grunner: [] };
    B.push({
      t: "p",
      tekst: [
        `Dersom retting ikke skjer innen rimelig tid, ikke lykkes eller ikke er mulig, krever jeg subsidiært ${hev ? `å heve kjøpet, jf. ${L.par("heving")}.` : `et forholdsmessig prisavslag, jf. ${L.par("prisavslag")}.`}`,
        ...(grunner.length ? [" ", ...ikkeUvesentlig(grunner)] : []),
        ...(hev ? [bevisbyrde, " Kjøpesummen skal i så fall tilbakebetales mot at bilen leveres tilbake, ", ...renter, "."] : []),
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
function slutning(p: Presedens): string {
  return `${p.niva === "A" ? "Saken gjaldt samme type feil som min" : "Vedtaket avgjør det samme rettslige spørsmålet som min sak reiser"}, og min sak bør derfor vurderes på samme måte.`;
}

const tekst = (d: Del[]) => d.map((x) => (typeof x === "string" ? x : "ph" in x ? `[${x.ph}]` : "felt" in x ? x.tekst : "kursiv" in x ? x.kursiv : "")).join("");

// The letter as plain text for the clipboard, placeholders as «[…]» and hidden text left out.
export function tilTekst(B: Blokk[]): string {
  return B.map((b) => {
    switch (b.t) {
      case "addr":
      case "sign":
        return b.linjer.map(tekst).join("\n");
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
