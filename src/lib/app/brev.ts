import "server-only";
// The complaint letter, built on the server from the writer's answers (the artifact's buildLetter;
// sent to the browser by brevet-actions.ts, never as code). Periods and paragraphs follow the law
// version of the purchase (lov.ts). The section citing a decision is Tvistr's paragraph from
// finnVedtak (mal.ts), never written here.
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { opplysningsfeil } from "@/lib/brev/feiltype";
import { liste, tall } from "@/lib/brev/format";
import { ANDRE_LOVER, LOVORD, RENTER_FRA_REKLAMASJON, SELGER_BEVISER_UVESENTLIG, TILBUD_UTEN_OPPHOLD } from "@/lib/brev/paragrafer";
import { plussManeder } from "@/lib/brev/tidslinje";
import type { Kriterium } from "@/lib/matching/ranger";
import { LOVSETNING } from "@/lib/vedtaksvalg/valg";
import type { Blokk, Del, Presedens } from "./brevtyper";
import { addDays, addMonths, dur, fmtD, parseD } from "./dato";
import { lcFirst } from "./format";
import { regler, type Regler } from "./lov";
import { forsokTall, heltall } from "./saken";
import { DOCS, IMPACT, type Skjema, SVAR, WS_SAYS, WS_WHO } from "./skjema";

type Tekstfelt = { [K in keyof Skjema]: Skjema[K] extends string ? K : never }[keyof Skjema];

const kr = (n: number) => `kr ${tall(n)}`;
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const trimDot = (s: string) => s.trim().replace(/[.]$/, "");
const unquote = (s: string) => trimDot(s.trim().replace(/^[«"]|[»"]$/g, ""));
// One of the buyer's answers as written in the letter, tagged with its field; nothing when empty.
const fe = (felt: string, tekst: string): Del => (tekst ? { felt, tekst } : "");
// liste and join(" ") over parts, so a tagged answer stays its own part.
const listJoinD = (a: Del[][]): Del[] => a.flatMap((x, i) => [...(i === 0 ? [] : i === a.length - 1 ? [" og "] : [", "]), ...x]);
const joinD = (a: Del[][]): Del[] => a.flatMap((x, i) => [...(i ? [" "] : []), ...x]);

// «Kapasitet og rekkevidde; lading og ladeutstyr», or the area's name when no part is ticked.
function feilnavn(hoved: string, under: string[]): string {
  const h = HOVEDKATEGORIER.find((x) => x.id === hoved);
  if (!h) return hoved;
  const navn = under.map((u) => h.under.find((x) => x.id === u)?.navn ?? u).map((n, i) => (i ? lcFirst(n) : n));
  if (!navn.length) return h.navn;
  return navn.some((n) => /\bog\b|,/.test(n)) ? navn.join("; ") : liste(navn);
}

// The attachments, in the form's order. A workshop report the letter says is attached is always listed,
// and so are the receipts behind an expense claim (Forbrukerrådet: keep the receipts).
export function vedlegg(s: Skjema): string[] {
  const ids = new Set(s.f_docs);
  if (s.ws === "rapport") ids.add("verksted");
  if (harUtgifter(s)) ids.add("kvitt");
  return [...DOCS.filter(([id]) => ids.has(id)).map(([, navn]) => navn), ...s.files];
}

const harUtgifter = (s: Skjema) => s.k_exp && s.exp.some((x) => x.t || x.a);

// A defect so serious the buyer need not accept a remedy first (§ 29 tredje ledd tredje punktum, from
// 2024): only from the answers that show it.
const alvorlig = (s: Skjema) => alvorGrunner(s).length > 0;

// Whether the seller is past the remedy for a price reduction or heving claimed first: the attempts the
// law lets the buyer refuse more of (§ 30: two before 2024, one after), or a defect so serious.
function forbiAvhjelp(s: Skjema, L: Regler): boolean {
  const n = forsokTall(s.k_forsok);
  return (n !== null && n >= (L.versjon === "før_2024" ? 2 : 1)) || (!!L.par("avhjelp_umiddelbart") && alvorlig(s));
}

// The answers that show the defect is serious, as sentences (for a price reduction claimed at once; for
// heving they are among hevingsgrunner already).
function alvorGrunner(s: Skjema): string[] {
  const g: string[] = [];
  if (s.f_drivable === "nei") g.push("Bilen kan ikke brukes.");
  if (s.f_impact.includes("sikkerhet")) g.push("Feilen går ut over sikkerheten.");
  if (s.ws === "rapport" && s.ws_says.includes("frarader")) g.push("Verkstedet fraråder videre bruk.");
  return g;
}

// Why the defect is not insignificant (fkjl. § 32), from the answers only: each sentence has a field
// behind it, and none is written without one. The repair cost is left out under 5 % of the price,
// where the figure would weaken the argument.
function hevingsgrunner(s: Skjema, L: Regler): Del[][] {
  const g: Del[][] = [];
  const kost = heltall(s.k_cost),
    pris = heltall(s.c_price);
  if (kost && pris) {
    const pst = Math.round((100 * kost) / pris);
    if (pst >= 5) g.push(["Utbedringen er anslått til kr ", fe("k_cost", s.k_cost.trim()), `, som utgjør ${pst} % av kjøpesummen.`]);
  }
  // The attempts: two for the same defect before 2024 (old § 30 annet ledd), one after (§ 30 fjerde
  // ledd), unless it is reasonable to give the seller another.
  const n = forsokTall(s.k_forsok);
  const ganger = n !== null && n >= 3 ? "tre eller flere ganger" : n === 2 ? "to ganger" : "";
  if (L.versjon === "før_2024") {
    if (n !== null && n >= 2) g.push([`Dere har forsøkt å rette feilen ${ganger} uten å lykkes, og har dermed ikke lenger rett til å rette, jf. ${L.par("avhjelp_avvise")}.`]);
    else if (n === 1) g.push(["Ett rettingsforsøk har ikke løst feilen."]);
  } else if (n !== null && n >= 1) g.push([`Dere har forsøkt å rette feilen${ganger ? ` ${ganger}` : ""} uten å lykkes, og jeg kan derfor avvise videre retting, jf. ${L.par("avhjelp_avvise")}.`]);
  g.push(...alvorGrunner(s).map((x) => [x]));
  if (s.seller_said === "lovet") g.push(["Bilen avviker fra det dere uttrykkelig opplyste før kjøpet."]);
  return g;
}

// The law's answer to each objection the seller gave (SVAR, after Forbrukerrådet's «Vanlige spørsmål og
// svar»), each sentence citing the table. «Som den er» has its own paragraph above, and a refusal without
// reasons or «wait and see» need no answer. Nothing is claimed that the answers do not carry: wear is
// only answered inside the presumption or with a report, lateness only with the law's limits.
function svarPaInnvendinger(s: Skjema, L: Regler, k: { iFormodning: boolean; rettidig: boolean; ikkeSlitasje: boolean; firm: boolean }): string[] {
  const har = (id: string) => s.f_prior && s.f_prior_svar.includes(id);
  const ut: string[] = [];
  if (har("slitasje")) {
    if (k.iFormodning) ut.push("At dere viser til slitasje eller feil bruk, endrer ikke dette. Det er dere som må bevise at feilen ikke var til stede ved leveringen.");
    else if (k.ikkeSlitasje) ut.push("Dere har vist til slitasje eller feil bruk. Verkstedrapporten fastslår at feilen ikke skyldes normal slitasje.");
  }
  if (har("produsent")) ut.push(`Kravet mitt retter seg mot dere som selger, jf. ${L.par("selger")}. Jeg kan gå mot et tidligere salgsledd, men har ingen plikt til det, jf. ${L.par("tidligere_ledd")}.`);
  if (har("betaling")) ut.push(`Retting skal skje uten kostnad for meg, jf. ${L.par("avhjelp_vilkar")}${k.firm ? ", og jeg betaler ikke for den" : ""}.`);
  if (har("garanti_ute")) ut.push(`At garantien er utløpt, har ikke betydning for kravet, som bygger på loven. En garanti «${LOVORD.garantiBegrenser}», jf. ${L.par("garanti_lov")}.`);
  if (har("for_sent") && !k.rettidig) ut.push(`Fristen for å reklamere er aldri kortere enn to måneder fra jeg oppdaget mangelen, jf. ${L.par("reklamasjon")}. For en bil er den ytterste fristen fem år etter overtakelsen, jf. ${L.par("reklamasjon_5ar")}.`);
  return ut;
}

// `presedens`: the decision the buyer chose, null without one (the law's sentence), or «venter» while
// finnVedtak is still working, so a letter copied then shows a gap rather than a letter without it.
export function byggBrev(s: Skjema, presedens: Presedens | null | "venter", idag: string): Blokk[] {
  const L = regler(s.c_purchase || s.c_delivery);
  const has = (k: Tekstfelt) => s[k].trim() !== "";
  // The buyer's answer as its own part, tagged with the field (fe), or a placeholder.
  const v = (k: Tekstfelt, ph: string): Del => (has(k) ? fe(k, s[k].trim()) : { ph });
  const vd = (k: Tekstfelt, ph: string): Del => (has(k) ? fe(k, fmtD(s[k])) : { ph });
  // The tone changes how each argument is put, never what it claims: both tones cite the same
  // paragraphs, amounts and dates, and «Bestemt» states no right the law does not give.
  const firm = s.l_tone === "bestemt";
  const tone = <T,>(saklig: T, bestemt: T) => (firm ? bestemt : saklig);
  const ld = parseD(s.l_date) ?? parseD(idag)!;
  const dato: Del = parseD(s.l_date) ? fe("l_date", fmtD(ld)) : fmtD(ld);
  const B: Blokk[] = [];

  const snd: Del[][] = [[v("b_name", "Ditt navn")], [v("b_addr", "Adresse")], [v("b_zip", "Postnr."), " ", v("b_city", "Poststed")]];
  if (has("b_phone")) snd.push(["Telefon: ", fe("b_phone", s.b_phone)]);
  if (has("b_email")) snd.push(["E-post: ", fe("b_email", s.b_email)]);
  B.push({ t: "addr", linjer: snd });
  const rc: Del[][] = [[v("d_name", "Forhandlerens navn")]];
  if (has("d_org")) rc.push(["Org.nr. ", fe("d_org", s.d_org)]);
  if (has("d_contact")) rc.push(["Att.: ", fe("d_contact", s.d_contact)]);
  rc.push([v("d_addr", "Adresse")], [v("d_zip", "Postnr."), " ", v("d_city", "Poststed")]);
  B.push({ t: "addr", linjer: rc });
  B.push({ t: "date", tekst: [has("l_place") ? fe("l_place", s.l_place) : has("b_city") ? fe("b_city", s.b_city) : { ph: "Sted" }, ", ", dato] });

  // Make and model joined by a space and trimmed at the ends, each its own part.
  const bil = (["c_make", "c_model"] as const).filter(has);
  const car: Del[] = bil.length
    ? joinD(bil.map((k) => [fe(k, bil.length === 1 ? s[k].trim() : k === bil[0] ? s[k].trimStart() : s[k].trimEnd())]))
    : [{ ph: "Merke og modell" }];
  const reg = v("c_reg", "reg.nr.");
  B.push({ t: "subj", tekst: ["Reklamasjon på mangel ved ", ...car, ", reg.nr. ", reg] });
  B.push({
    t: "p",
    tekst: [
      "Jeg viser til mitt kjøp av brukt ", ...car, ...(has("c_year") ? [", årsmodell ", fe("c_year", s.c_year)] : []), ", reg.nr. ", reg,
      ". Bilen ble kjøpt ", vd("c_purchase", "kjøpsdato"), " for kr ", v("c_price", "kjøpesum"), ", og jeg overtok den ", vd("c_delivery", "overtakelsesdato"),
      ...(has("c_km") ? [" med en kilometerstand på ", fe("c_km", s.c_km), " km"] : []), ".",
    ],
  });
  B.push({ t: "p", tekst: [firm ? `Bilen har en mangel. Jeg reklamerer med dette formelt etter ${L.lovRef("reklamasjon")} og forventer at saken behandles uten opphold.` : `Bilen har en mangel, og jeg reklamerer med dette etter ${L.lovRef("reklamasjon")}.`] });

  B.push({ t: "h", tekst: ["Mangelen"] });
  if (s.f_cats.length) {
    B.push({ t: "p", tekst: ["Jeg har oppdaget følgende feil ved bilen:"] });
    B.push({
      t: "ul",
      punkter: s.f_cats.map((c) => {
        const a = s.f_area[c],
          desc = (s.f_catdesc[c] ?? "").trim();
        return [
          fe(`f_parts.${c}`, feilnavn(c, s.f_parts[c] ?? [])), ", oppdaget ", a?.found ? fe(`f_area.${c}.found`, fmtD(a.found)) : { ph: "dato" }, ".",
          ...(desc ? [" ", fe(`f_catdesc.${c}`, sentence(desc))] : []),
        ];
      }),
    });
    if (has("f_desc")) B.push({ t: "p", tekst: [fe("f_desc", sentence(s.f_desc))] });
  } else B.push({ t: "p", tekst: ["Den ", vd("f_found", "dato"), " oppdaget jeg følgende feil: ", has("f_desc") ? fe("f_desc", sentence(s.f_desc)) : { ph: "Beskrivelse av feilen" }] });

  const ex: string[] = [];
  if (s.f_drivable === "nei") ex.push("Bilen kan ikke brukes slik den er nå.");
  else if (s.f_drivable === "delvis") ex.push("Bilen kan bare brukes i begrenset grad, og jeg kan ikke stole på den i vanlig bruk.");
  const imp = s.f_impact
    .filter((k) => !(k === "stopp" && s.f_drivable === "nei") && !(k === "palitelig" && s.f_drivable === "delvis") && !(k === "bruk" && (s.f_drivable === "nei" || s.f_drivable === "delvis")))
    .map((k) => IMPACT.find((x) => x[0] === k)?.[4])
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (imp.length) ex.push(`Konsekvensen er at ${liste(imp)}.`);
  if (ex.length) B.push({ t: "p", tekst: [ex.join(" ")] });

  if (s.ws === "rapport" || s.ws === "uten") {
    const p: Del[] = [`Bilen er undersøkt av ${WS_WHO[s.ws_who] ?? "et verksted"}`, ...(has("ws_name") ? [", ", fe("ws_name", s.ws_name.trim())] : []), "."];
    if (s.ws === "rapport") {
      const says = s.ws_says.map((k) => WS_SAYS[k]).filter(Boolean);
      p.push(" Verkstedrapporten", ...(has("ws_date") ? [" datert ", fe("ws_date", fmtD(s.ws_date))] : []), ` ${says.length ? liste(says) : "beskriver feilen"}.`);
      if (has("ws_quote")) p.push(" Rapportens konklusjon er: «", fe("ws_quote", unquote(s.ws_quote)), "».");
      p.push(" Rapporten følger vedlagt.");
    }
    B.push({ t: "p", tekst: p });
  }
  if (s.seller_said === "lovet") {
    const sa: Del[] = has("seller_txt") ? ["Før kjøpet opplyste dere: «", fe("seller_txt", unquote(s.seller_txt)), "»."] : ["Før kjøpet ga dere uttrykk for at bilen var fri for slike feil."];
    B.push({ t: "p", tekst: [...sa, ` ${tone("Opplysningen er en del av avtalen", "Dere er bundet av opplysningen, som er en del av avtalen")}, jf. ${L.lovRef("uriktig")}.`] });
  }
  if (s.f_prior) {
    const how = has("f_prior_how") ? ` ${s.f_prior_how === "oppmøte" ? "ved oppmøte" : `på ${s.f_prior_how}`}` : "";
    const p: Del[] = [`Jeg tok opp feilen med dere${how} `, has("f_prior_date") ? fe("f_prior_date", fmtD(s.f_prior_date)) : "tidligere", "."];
    const svar: Del[][] = [...SVAR.filter(([id]) => s.f_prior_svar.includes(id)).map(([, , ord]) => [ord]), ...(has("f_prior_resp") ? [[fe("f_prior_resp", trimDot(s.f_prior_resp))]] : [])];
    if (svar.length) p.push(" Svaret jeg fikk, var at ", ...listJoinD(svar), ".");
    p.push(tone(" Forholdet er ikke løst, og dette brevet bekrefter og utdyper reklamasjonen.", " Saken er fortsatt ikke løst. Dette brevet bekrefter og utdyper reklamasjonen, og jeg forventer nå en løsning."));
    B.push({ t: "p", tekst: p });
  }

  B.push({ t: "h", tekst: ["Rettslig grunnlag"] });
  B.push({ t: "p", tekst: [`Etter ${L.lovRef("krav")} skal bilen være i samsvar med avtalen og ha de egenskapene jeg med rette kunne forvente. ${tone("Når den ikke er det, foreligger det en mangel", "Det har den ikke, og bilen har derfor en mangel")}, jf. ${L.par("avvik")}.`] });
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
          ? `${pastatt ? "Et forbehold om at bilen selges «som den er», fritar dere ikke uten videre for ansvar." : tone("Bilen ble solgt «som den er».", "At bilen ble solgt «som den er», fritar dere ikke uten videre for ansvar.")} Etter ${L.lovRef("forbehold")} har bilen likevel en mangel når den er ${LOVORD.dårligereStand}.`
          : `${pastatt ? "Et generelt forbehold om at bilen selges «som den er», er ikke" : tone("Forbeholdet om at bilen ble solgt «som den er», er ikke", "Forbeholdet om at bilen ble solgt «som den er», endrer ikke dette. Det er ikke")} et avtalt unntak etter ${L.lovRef("forbehold")}. Unntaket fra ${LOVORD.kravTredjeFjerde} forutsetter at jeg ved inngåelsen av avtalen ${LOVORD.avtaltUnntak}.`,
      ],
    });
  }
  const del = parseD(s.c_delivery),
    found = parseD(s.f_found);
  const formodning = `Etter ${L.par("formodning")} skal en mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises.`;
  // Each fault on its own date, in calendar months as the law and the ranking count (tidsnivaFor):
  // the presumption only for the faults inside it, the five-year rule only between two and five years.
  // A fault in what the seller said or promised existed at the sale: no presumption for it.
  const ikkeSlitasje = s.ws === "rapport" && s.ws_says.includes("ikke_slitasje");
  let iFormodning = false;
  const datert = s.f_cats.map((c) => ({ c, d: s.f_area[c]?.found ?? "" })).filter((x) => x.d && s.c_delivery && x.d >= s.c_delivery && !opplysningsfeil(x.c, s.f_parts[x.c] ?? []));
  const ved = (xs: typeof datert) => listJoinD(xs.map((x) => [fe(`f_parts.${x.c}`, lcFirst(feilnavn(x.c, s.f_parts[x.c] ?? [])))]));
  if (s.c_delivery && datert.length) {
    const inne = datert.filter((x) => x.d <= plussManeder(s.c_delivery, L.formodningMnd));
    const sene = datert.filter((x) => x.d > plussManeder(s.c_delivery, 24) && x.d <= plussManeder(s.c_delivery, 60));
    const alene = datert.length === 1;
    if (inne.length) {
      const hvem: [Del[], string] = alene
        ? [[`Feilen viste seg ${dur(del!, parseD(inne[0].d)!) || "samme dag"} etter overtakelsen.`], "feilen"]
        : inne.length === datert.length
          ? [[`Feilene viste seg innen ${L.formodningTekst} etter overtakelsen.`], "feilene"]
          : [[`${inne.length > 1 ? "Feilene" : "Feilen"} ved `, ...ved(inne), ` viste seg innen ${L.formodningTekst} etter overtakelsen.`], inne.length > 1 ? "disse feilene" : "denne feilen"];
      // The exception (§ 18 annet ledd, «uforenlig med varens eller mangelens art») is the seller's usual
      // answer for a used car: wear. It is only answered when the workshop report says it is not wear.
      const unntak = ikkeSlitasje ? ` Formodningen er ikke ${LOVORD.uforenlig}, jf. ${L.par("formodning_unntak")}: verkstedrapporten fastslår at feilen ikke skyldes normal slitasje.` : "";
      B.push({ t: "p", tekst: [...hvem[0], ` ${formodning} ${tone("Det er dermed dere som må bevise", "Bevisbyrden ligger hos dere. Dere må bevise")} at ${hvem[1]} ikke var til stede da jeg overtok bilen.${unntak}`] });
      iFormodning = true;
    }
    if (sene.length) {
      const hvem: Del[] = alene ? [`Feilen viste seg ${dur(del!, parseD(sene[0].d)!)} etter overtakelsen.`] : [`${sene.length > 1 ? "Feilene" : "Feilen"} ved `, ...ved(sene), " viste seg mer enn to år etter overtakelsen."];
      B.push({ t: "p", tekst: [...hvem, ` En bil er ment å vare vesentlig lenger enn to år, og reklamasjonsfristen er derfor fem år, jf. ${L.par("reklamasjon_5ar")}.${tone("", " Dere kan ikke avvise reklamasjonen fordi det har gått mer enn to år.")}`] });
    }
  } else if ((!del || !found) && !s.f_cats.every((c) => opplysningsfeil(c, s.f_parts[c] ?? []))) B.push({ t: "p", tekst: [`En mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, jf. ${L.par("formodning")}.`] });
  let rettidig = false;
  if (found) {
    const nr = (s.f_prior && parseD(s.f_prior_date)) || ld;
    const etterFemAr = !!del && nr > parseD(plussManeder(s.c_delivery, 60))!;
    // Timely only when it surely is: within two months of the discovery and five years of the handover,
    // and not dated before the discovery. Later than two months the letter claims nothing.
    if (!etterFemAr && nr >= found && nr <= addMonths(found, 2)) rettidig = true;
    if (rettidig) B.push({ t: "p", tekst: [`Reklamasjonen er fremsatt innen to måneder etter at jeg oppdaget feilen${tone(", og er dermed rettidig", ". Den er rettidig")} etter ${L.par("reklamasjon")}${tone("", ", og dere kan ikke avvise den som for sen")}.`] });
  }
  // Not when the complaint is that the promised warranty is missing.
  if (s.c_warranty && !s.f_cats.includes("garanti")) B.push({ t: "p", tekst: [`Bilen er også omfattet av garanti. ${tone("Garantien gjelder i tillegg til mine rettigheter etter loven og begrenser dem ikke.", "Garantien kommer i tillegg til mine rettigheter etter loven, og dere kan ikke bruke garantivilkårene til å begrense dem.")}`] });
  for (const p of svarPaInnvendinger(s, L, { iFormodning, rettidig, ikkeSlitasje, firm })) B.push({ t: "p", tekst: [p] });

  if (s.prec_on) {
    if (presedens === "venter") {
      B.push({ t: "h", tekst: ["Praksis fra Forbrukerklageutvalget"] });
      B.push({ t: "p", tekst: [{ ph: "lignende sak hentes" }] });
    } else if (presedens) {
      B.push({ t: "h", tekst: [`Praksis fra ${presedens.utvalg}`] });
      B.push({ t: "prec", avsnitt: [[{ felt: "vedtak.avsnitt", tekst: presedens.avsnitt }], ...(presedens.kildeUrl ? [[`Vedtaket er offentlig tilgjengelig på ${presedens.kildeUrl}`]] : [])] });
      B.push({ t: "p", tekst: [slutning(presedens, s, firm)] });
    } else B.push({ t: "p", tekst: [LOVSETNING] });
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
      ? `Vil rettingen medføre at jeg i mer enn en uke blir avskåret fra å bruke bilen, ${tone("ber jeg om", "krever jeg")} at dere stiller en erstatningsbil til rådighet for deres regning, jf. ${L.par("erstatningsbil")}.`
      : `Jeg ${tone("ber om", "forventer")} at dere stiller lånebil til disposisjon mens bilen er til reparasjon. Om rettingen skjer uten vesentlig ulempe for meg, skal det blant annet legges vekt på om dere stiller en erstatningsbil til rådighet, jf. ${L.par("erstatningsbil")}.`;
  // Price reduction or heving claimed first while the seller may still offer a remedy (§ 29 tredje ledd):
  // the letter says so, as Forbrukerrådet's template does, and keeps the claim for when no lawful remedy
  // comes. From 2024 a defect the answers show is serious is claimed at once with the law's words.
  const forbi = forbiAvhjelp(s, L);
  const umiddelbart = !!L.par("avhjelp_umiddelbart") && alvorlig(s) && (forsokTall(s.k_forsok) ?? 0) < 1;
  const tilbud = (krav: string) =>
    `Jeg er kjent med at dere kan tilby å rette mangelen${TILBUD_UTEN_OPPHOLD[L.versjon] ? ", dersom det skjer uten opphold" : ""}, jf. ${L.par("avhjelp_tilbud")}. Rettingen må i så fall skje uten kostnad, uten vesentlig ulempe for meg og innen rimelig tid, jf. ${L.par("avhjelp_vilkar")}. ${tone(`Skjer ikke det, fastholder jeg kravet om ${krav}.`, `Skjer ikke det, står kravet om ${krav} fast.`)}`;
  const straks = `Mangelen er etter sin art så alvorlig at det ikke er rimelig å forvente at jeg skal godta et tilbud om avhjelp, jf. ${L.par("avhjelp_umiddelbart")}.`;
  // § 32 is cited in the same sentence before; this one says who must prove the exception.
  const bevisbyrde = SELGER_BEVISER_UVESENTLIG[L.versjon] ? " Det er dere som har bevisbyrden for at mangelen er uvesentlig." : "";
  switch (s.k_main) {
    case "retting":
      B.push({ t: "p", tekst: [`${tone("Mitt krav er", "Jeg krever")} at mangelen rettes, jf. ${L.par("retting")}. ${tone("Rettingen skal skje", "Etter loven skal rettingen skje")} uten kostnad for meg, innen rimelig tid og uten vesentlig ulempe for meg.${s.k_loaner ? ` ${lanebil()}` : ""}`] });
      break;
    case "prisavslag":
      B.push({ t: "p", tekst: [tone("Mitt krav er et forholdsmessig prisavslag på kr ", "Jeg krever et forholdsmessig prisavslag på kr "), v("k_amount", "beløp"), `, jf. ${L.par("prisavslag")}.`, ...(has("k_basis") ? [" Beløpet bygger på ", fe("k_basis", trimDot(s.k_basis)), "."] : has("k_cost") ? [" Beløpet bygger på et overslag over utbedringskostnaden på kr ", fe("k_cost", s.k_cost.trim()), "."] : [])] });
      if (umiddelbart) B.push({ t: "p", tekst: [`${alvorGrunner(s).join(" ")} ${straks}`] });
      else if (!forbi) B.push({ t: "p", tekst: [tilbud("prisavslag")] });
      break;
    case "heving": {
      const g = hevingsgrunner(s, L);
      B.push({
        t: "p",
        tekst: [
          // Without a ground to skip the remedy the letter claims heving rather than declaring it.
          ...(g.length ? [...joinD(g), " Mangelen er derfor ikke uvesentlig"] : ["Mangelen er ikke uvesentlig"]),
          `, og ${forbi ? (g.length ? "jeg hever kjøpet" : "jeg hever med dette kjøpet") : "jeg krever å heve kjøpet"}, jf. ${L.par("heving")}.${bevisbyrde} `,
          ...tone<Del[]>(
            ["Kjøpesummen på kr ", kjop, " skal da tilbakebetales mot at bilen leveres tilbake til dere"],
            ["Jeg krever kjøpesummen på kr ", kjop, " tilbakebetalt mot at bilen leveres tilbake til dere"],
          ),
          ", ", ...renter, ". ",
          tone("Jeg ber om at dere tar kontakt for å avtale tilbakelevering og oppgjør.", "Ta kontakt med meg for å avtale tilbakelevering og oppgjør."),
        ],
      });
      if (umiddelbart) B.push({ t: "p", tekst: [straks] });
      else if (!forbi) B.push({ t: "p", tekst: [tilbud("heving")] });
      break;
    }
    default:
      B.push({ t: "p", tekst: ["Jeg krever ", { ph: "velg krav i steg 4" }, "."] });
  }
  if (s.k_main === "retting" && (s.k_alt === "prisavslag" || s.k_alt === "heving")) {
    const g = s.k_alt === "heving" ? hevingsgrunner(s, L) : [];
    B.push({
      t: "p",
      tekst: [
        `Dersom retting ikke skjer innen rimelig tid, ikke lykkes eller ikke er mulig, ${tone("vil jeg subsidiært kreve", "krever jeg subsidiært")} ${s.k_alt === "prisavslag" ? `et forholdsmessig prisavslag, jf. ${L.par("prisavslag")}.` : `å heve kjøpet, jf. ${L.par("heving")}.`}`,
        ...(g.length ? [" ", ...joinD(g), " Mangelen er derfor ikke uvesentlig."] : []),
        ...(s.k_alt === "heving" ? [bevisbyrde] : []),
        ...(s.k_alt === "heving" ? [" Kjøpesummen skal i så fall tilbakebetales mot at bilen leveres tilbake, ", ...renter, "."] : []),
      ],
    });
  }
  // Forbrukerrådet's template: the seller may examine the defect and repair it. From 2024 the buyer must
  // make the thing available (§ 30 annet ledd); before, the offer stands without a paragraph.
  if (s.k_main) {
    const hva = s.k_main === "heving" && (forbi || umiddelbart) ? "undersøkelse" : "undersøkelse og retting";
    B.push({ t: "p", tekst: [`Bilen kan stilles til rådighet for ${hva} etter nærmere avtale${L.par("rad") ? `, jf. ${L.par("rad")}` : ""}.`] });
  }
  if (s.k_exp) {
    const it = s.exp.map((x, i) => ({ ...x, i })).filter((x) => x.t || x.a);
    B.push({ t: "p", tekst: [`${tone("Jeg fremmer også krav om", "I tillegg krever jeg")} erstatning for utgifter jeg har hatt som følge av mangelen, jf. ${L.par("erstatning")}${it.length ? ":" : ""}`, ...(it.length ? [] : [" ", { ph: "legg til utgiftene" }, "."])] });
    if (it.length) B.push({ t: "exp", rader: it.map((x) => [[x.t ? fe(`exp.${x.i}`, x.t) : { ph: "utgift" }], kr(+x.a || 0)]), sum: kr(it.reduce((a, x) => a + (+x.a || 0), 0)) });
  }
  if (s.k_hold) B.push({ t: "p", tekst: [tone("Inntil saken er løst, vil jeg holde tilbake kr ", "Inntil saken er løst, holder jeg tilbake kr "), v("k_hold_amt", "beløp"), ` av det jeg skylder dere, jf. ${L.par("tilbakehold")}.`] });

  const dd: Del = s.k_days ? fmtD(addDays(ld, +s.k_days)) : { ph: "svarfrist" };
  const nxt = "bringe saken inn for Forbrukertilsynet for mekling og eventuelt videre til Forbrukerklageutvalget";
  // An amount the seller must pay (a price reduction or compensation) draws late-payment interest
  // when it is paid late; when it falls due follows forsinkelsesrenteloven § 2, which the letter does
  // not restate. The purchase price repaid after heving has its own rule above (renter).
  const belop = s.k_main === "prisavslag" || (s.k_exp && s.exp.some((x) => x.t || x.a)) ? ` Beløpet bes utbetalt innen fristen. Ved forsinket betaling kreves forsinkelsesrente etter ${ANDRE_LOVER.forsinkelsesrente}.` : "";
  B.push({ t: "p", tekst: firm ? ["Jeg krever skriftlig svar innen ", dd, `.${belop} Hører jeg ikke fra dere innen fristen, vil jeg ${nxt}.`] : ["Jeg ber om en skriftlig tilbakemelding innen ", dd, ` med forslag til hvordan dere vil løse saken.${belop} Kommer vi ikke til enighet, vil jeg ${nxt}.`] });
  B.push({ t: "sign", linjer: [[tone("Med vennlig hilsen", "Med hilsen")], [""], [v("b_name", "Ditt navn")]] });
  // The list of attachments follows the signature, as in a Norwegian business letter.
  const att = vedlegg(s);
  if (att.length) {
    B.push({ t: "h", tekst: ["Vedlegg"] });
    const forste = att.length - s.files.length;
    B.push({ t: "ol", punkter: att.map((a, i) => [i < forste ? a : fe(`files.${i - forste}`, a)]) });
  }
  return B;
}

// The letter's own conclusion after the decision's paragraph (which mal.ts fills and the done criteria
// measure): every sentence follows from a field, and the car is only said not to be worse placed when
// each side the ranking compared is level or in the buyer's favour.
function slutning(p: Presedens, s: Skjema, firm: boolean): string {
  const sider: Kriterium[] = ["km", "alder", "som_den_er"];
  const ikkeSvakere = sider.every((k) => p.treff[k] === "likt" || p.treff[k] === "mildere");
  const d = [p.niva === "A" ? "Saken gjaldt samme type feil som i min sak." : "Vedtaket avgjør det samme rettslige spørsmålet som denne saken reiser."];
  if (ikkeSvakere) d.push("Bilen i min sak var ikke i et svakere utgangspunkt.");
  if (s.k_main && p.utfall.includes(s.k_main)) d.push(`Kjøperen fikk medhold i ${s.k_main}, som er det jeg krever.`);
  d.push(firm && ikkeSvakere ? "Min sak står minst like sterkt, og utfallet bør bli det samme." : "Min sak bør vurderes på samme måte.");
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
      case "ul":
        return b.punkter.map((i) => `– ${tekst(i)}`).join("\n");
      case "ol":
        return b.punkter.map((i, n) => `${n + 1}. ${tekst(i)}`).join("\n");
      case "exp":
        return `${b.rader.map(([a, c]) => `– ${tekst(a)}: ${c}`).join("\n")}\nSum: ${b.sum}`;
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

