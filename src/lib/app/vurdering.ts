// The free verdict: sterk / god / kreverMer from the buyer's answers, frist when the five years have
// run out, or utenfor when the case is not one the letter covers. Ported from the artifact (evaluate,
// wsFactors); the presumption period and the «som den er» rule follow the law version of the purchase
// (lov.ts). Each row has a weight (`w`), and the level is their sum. The weights were set once from
// the decisions (docs/ferdigkriterier.md, «Vurderingen», npm run vurdering:kalibrer): rows the
// committee's outcomes do not move (late notice, «som den er», dates to check) weigh nothing.
import { opplysningsfeil } from "@/lib/brev/feiltype";
import { LOVORD } from "@/lib/brev/paragrafer";
import { plussManeder } from "@/lib/brev/tidslinje";
import { addMonths, dayDiff, dur, fmtD, parseD } from "./dato";
import { feilposter } from "./feil";
import { regler, type Regler } from "./lov";
import { forsokTall } from "./saken";
import { SVAR, type Skjema } from "./skjema";
import type { Celle } from "@/lib/vurdering/vurdering";

export type Niva = "sterk" | "god" | "kreverMer" | "frist" | "utenfor" | "ukjent";
// `w`: how much the row moves the level; without it the row weighs nothing.
export type Faktor = { s: "good" | "warn" | "bad" | "info"; t: string; d: string; law?: string; w?: number };
export type Sjekksvar = {
  seller?: "forhandler" | "privat" | "leasing";
  buyer?: "privat" | "naering";
  asis?: "ja" | "nei" | "vetikke";
  // The purchase date decides the law version; the handover date stands in when it is missing.
  kjopsdato?: string;
  delivery?: string;
  // The first and the last day a fault was noticed, when there are several.
  found?: string;
  sist?: string;
  notified?: "ja" | "nei";
  notifiedDate?: string;
  // The first fault found after the earlier complaint, which this letter is the complaint for.
  senereFunnet?: string;
  sev?: number;
  // Every fault is in what the seller said or promised (opplysningsfeil); `noenOpplysning`: at least one.
  opplysning?: boolean;
  noenOpplysning?: boolean;
  // The main categories of the faults that are not in what the seller said.
  fysiske?: string[];
  // The workshop, what the seller said before the sale, the attempts at repair and the dealer's answer.
  ws?: string;
  ws_says?: string[];
  seller_said?: string;
  k_forsok?: string;
  f_prior_svar?: string[];
  // Past five years: the buyer says the dealer held something back, or a warranty runs longer.
  unntak?: boolean;
};
export type Resultat = {
  tier: Niva;
  badge: string;
  title: string;
  summary: string;
  advice?: string[];
  factors: Faktor[];
  // The sum of the weights, for sterk, god and kreverMer.
  poeng?: number;
};

const UTENFOR = {
  privat: {
    title: "Kjøp fra privatperson dekkes ikke her",
    summary: "Ved kjøp mellom privatpersoner gjelder kjøpsloven, og selgeren kan ha tatt forbehold i kontrakten. Brevet er laget for kjøp fra forhandler.",
    advice: ["Les kontrakten og se etter forbehold som «som den er».", "Si fra skriftlig til selgeren så snart som mulig.", "Forbrukerrådet gir gratis råd, også om kjøp fra privatperson."],
  },
  leasing: {
    title: "Leasing har egne regler",
    summary: "Når bilen er leaset, er det leasingselskapet som eier den. Feil på bilen tar du opp med leasingselskapet etter leieavtalen.",
    advice: ["Les leieavtalen og se hva den sier om feil og mangler.", "Kontakt leasingselskapet skriftlig.", "Forbrukerrådet kan hjelpe hvis du ikke kommer til enighet."],
  },
  naering: {
    title: "Kjøp gjennom firma dekkes ikke her",
    summary: "Når bilen er kjøpt i næring, gjelder kjøpsloven, og kontrakten kan begrense rettighetene dine. Brevet er laget for privatpersoner som har kjøpt bil av en forhandler.",
    advice: ["Les kontrakten og se hva den sier om feil og reklamasjon.", "Si fra skriftlig til forhandleren så snart som mulig.", "Snakk med en advokat hvis saken gjelder store beløp."],
  },
};

// No level promises an outcome, and only the levels where most such cases were won say «trolig»
// (docs/ferdigkriterier.md).
const TIER = {
  sterk: { badge: "Sterk sak", title: "Du har trolig en sterk sak", summary: "Ut fra svarene dine taler det meste for deg. Send en skriftlig reklamasjon så snart som mulig." },
  god: { badge: "God sak", title: "Du har trolig en god sak", summary: "Loven er på din side, men forhandleren kan bestride noe av det. Se punktene under, og send en skriftlig reklamasjon så snart som mulig." },
  kreverMer: {
    badge: "Krever mer",
    title: "Saken din kan være krevende",
    summary: "Forhandleren kan komme til å bestride kravet. Punktene under viser hva forhandleren kan si, og hva du bør skaffe. Send likevel en skriftlig reklamasjon nå: du må si fra innen rimelig tid etter at du oppdaget feilen, og brevet er første steg hvis saken skal til mekling.",
  },
};

const FRIST = {
  badge: "Normalt ingen sak",
  title: "Fristen på fem år er normalt ute",
  summary: "Det er mer enn fem år siden du overtok bilen. Da er det normalt for sent å reklamere, med mindre forhandleren holdt tilbake noe eller en garanti gir lengre frist.",
  advice: ["Se om garantien gir lengre frist enn fem år.", "Har forhandleren holdt tilbake noe den visste om, gjelder ikke fristen på fem år.", "Forbrukerrådet gir gratis råd."],
};

// The level from the weights: two or more for sterk, below zero for kreverMer.
const sumFor = (F: Faktor[]) => F.reduce((n, f) => n + (f.w ?? 0), 0);
const nivaFor = (sum: number): "sterk" | "god" | "kreverMer" => (sum >= 2 ? "sterk" : sum >= 0 ? "god" : "kreverMer");

// Where the marker stands on the strength bar, 0 to 1: each level has a third, Krever mer on the left,
// and the weights place it within its third (the ends are open: -4 or less, 5 or more). Past five years
// it stands at the far left; without a verdict, or outside what the letter covers, there is none.
const TREDJE: Record<"kreverMer" | "god" | "sterk", { fra: number; lo: number; hi: number }> = {
  kreverMer: { fra: 0, lo: -4, hi: -1 },
  god: { fra: 1 / 3, lo: 0, hi: 1 },
  sterk: { fra: 2 / 3, lo: 2, hi: 5 },
};
export function styrke(r: Pick<Resultat, "tier" | "poeng">): number | null {
  if (r.tier === "frist") return 0.02;
  if (r.tier === "utenfor" || r.tier === "ukjent" || r.poeng === undefined) return null;
  const t = TREDJE[r.tier];
  const p = Math.min(t.hi, Math.max(t.lo, r.poeng));
  return t.fra + (p - t.lo + 0.5) / (t.hi - t.lo + 1) / 3;
}

// Faults the committee most often turned down as wear (understell 59 %, drivlinje 39 % of the rejected,
// the two highest; 2026-10-23).
const SLITASJE = ["understell", "drivlinje"];

export function evaluate(q: Sjekksvar, idag: string): Resultat {
  const ut = (k: keyof typeof UTENFOR): Resultat => ({ tier: "utenfor", badge: "Utenfor det vi dekker", ...UTENFOR[k], factors: [] });
  if (q.seller === "privat") return ut("privat");
  if (q.seller === "leasing") return ut("leasing");
  if (q.buyer === "naering") return ut("naering");

  const today = parseD(idag)!;
  const L = regler(q.kjopsdato || q.delivery);
  const F: Faktor[] = [{ s: "good", t: "Forbrukerkjøpsloven gjelder", d: "Du kjøpte som privatperson fra en forhandler. Loven kan ikke avtales bort til din ugunst." }];
  // A date in the future cannot be judged: only «Sjekk datoene», no conclusion about the limits.
  const fremtid = [q.kjopsdato, q.delivery, q.found, q.sist, q.notified === "ja" ? q.notifiedDate : undefined].some((d) => d && d > idag);
  const del = fremtid ? null : parseD(q.delivery),
    fd = fremtid ? null : parseD(q.found);
  // The five years run from the handover; a complaint made after them is too late whenever the fault showed.
  const reklamert = q.notified === "ja" && q.notifiedDate ? q.notifiedDate : idag;
  let ute = false;
  // The fault showed after the presumption period: the buyer must show it was there at delivery.
  let etter = false;
  if (del && fd) {
    if (fd < del) F.push({ s: "warn", t: "Feilen ble oppdaget før overtakelsen", d: "Var feilen kjent før du overtok bilen, kan det svekke saken. Sjekk at datoene stemmer.", w: -1 });
    else {
      // Calendar months, as the law and the ranking count (tidsnivaFor).
      const d = dur(del, fd) || "samme dag";
      const fem = plussManeder(q.delivery!, 60);
      ute = q.found! > fem || reklamert > fem;
      if (ute) {
        const t = q.found! > fem ? `Feilen viste seg ${d} etter overtakelsen.` : "Det er mer enn fem år siden du overtok bilen.";
        // Without the exception the case stops here (FRIST); with it, the row says what the buyer must show.
        if (!q.unntak) return { tier: "frist", ...FRIST, factors: [...F, { s: "bad", t: "Fristen er ute", d: `${t} Den absolutte fristen på fem år har gått ut, ${UNNTAK_FEM_AR}.`, law: L.ref("reklamasjon_5ar") }] };
        etter = true;
        F.push({ s: "bad", t: "Fristen er ute", d: `${t} Du har svart at forhandleren holdt tilbake noe, eller at en garanti gir lengre frist. Da kan du reklamere etter fem år, men du må kunne vise det.`, law: L.ref("reklamasjon_5ar"), w: -2 });
      } else if (q.opplysning)
        F.push({ s: "good", t: "Bilen var ikke som selgeren opplyste", d: "Avviket fantes allerede da du kjøpte bilen, så du trenger ikke formodningsregelen. Du må vise hva selgeren opplyste, og at bilen ikke var slik.", law: L.ref("uriktig"), w: 2 });
      else if (q.found! <= plussManeder(q.delivery!, L.formodningMnd))
        F.push({ s: "good", t: `Feilen viste seg innen ${L.formodningTekst}`, d: `Feilen viste seg ${d} etter overtakelsen. Da regnes den som hovedregel for å ha vært der fra start, og det er forhandleren som må bevise noe annet.`, law: L.ref("formodning"), w: 1 });
      else {
        etter = true;
        F.push({ s: "warn", t: `Mer enn ${q.found! > plussManeder(q.delivery!, 24) ? "to år" : L.formodningTekst} etter overtakelsen`, d: "Du er innenfor femårsfristen for bil, men må selv sannsynliggjøre at feilen skyldes forhold ved leveringen.", law: L.ref("reklamasjon_5ar"), w: -1 });
      }
    }
  } else if (!fremtid) F.push({ s: "warn", t: "Datoene mangler", d: "Uten kjøpsdato og dato for når feilen ble oppdaget, kan vi ikke vurdere fristene. Vurderingen er derfor foreløpig." });

  // Some, not all, faults are in what the seller said: those need no presumption either.
  if (!ute && !q.opplysning && q.noenOpplysning)
    F.push({ s: "good", t: "En av feilene gjelder det selgeren opplyste", d: "Det avviket fantes allerede da du kjøpte bilen. Du må vise hva selgeren opplyste, og at bilen ikke var slik.", law: L.ref("uriktig"), w: 2 });

  // Dates that cannot all be right.
  const avvik = [
    fremtid ? "En av datoene er frem i tid." : "",
    q.notified === "ja" && q.notifiedDate && q.found && q.notifiedDate < q.found ? "Du har oppgitt at du sa fra før du oppdaget feilen." : "",
  ].filter(Boolean);
  if (avvik.length) F.push({ s: "warn", t: "Sjekk datoene", d: `${avvik.join(" ")} Sjekk at datoene stemmer.` });
  if (!ute && !q.opplysning && del && fd && q.sist && fd >= del && q.found! <= plussManeder(q.delivery!, L.formodningMnd) && q.sist > plussManeder(q.delivery!, L.formodningMnd))
    F.push({ s: "warn", t: "Én av feilene viste seg senere", d: `Én av feilene viste seg mer enn ${L.formodningTekst} etter overtakelsen. For den må du selv sannsynliggjøre at den skyldes forhold ved leveringen.` });

  // Not yet complained of, counted from the day the fault was found.
  // ponytail: six months as the line for «sent» is a judgement, not the law's; «rimelig tid» has no fixed limit.
  const ikkeReklamert = (fra: Date): Faktor[] => {
    if (today <= addMonths(fra, 2)) return [{ s: "good", t: "Du er i tide", d: `Sender du reklamasjonen innen ${fmtD(addMonths(fra, 2))}, er den alltid rettidig.`, law: L.ref("reklamasjon") }];
    // Notice after two months does not move the outcome in the decisions (60.7 % against 60.0 %), so it
    // weighs nothing. More than six months without any notice cannot be measured (every decided case
    // had one) and weighs by judgement: the dealer's first answer will be that it is too late.
    if (today <= addMonths(fra, 6))
      return [{ s: "warn", t: "Det har gått mer enn to måneder", d: "Du må reklamere innen rimelig tid etter at du oppdaget feilen. Send reklamasjonen nå, og forklar i brevet hvorfor den kommer først nå.", law: L.ref("reklamasjon") }];
    return [
      {
        s: "bad",
        t: "Reklamasjonen kommer sent",
        d: `Du oppdaget feilen for ${dur(fra, today)} siden uten å si fra. Forhandleren vil trolig si at reklamasjonen kommer for sent. Da hjelper det bare om forhandleren ga uriktige opplysninger eller holdt noe tilbake, eller en garanti gir lengre frist.`,
        law: L.ref("reklamasjon_unntak"),
        w: -2,
      },
    ];
  };
  if (!ute && fd && fd >= (del ?? fd)) {
    const lim = addMonths(fd, 2),
      nd = parseD(q.notifiedDate);
    if (q.notified === "ja" && nd && nd >= fd) {
      if (nd <= lim) F.push({ s: "good", t: "Du sa fra i tide", d: `Du sa fra ${dayDiff(fd, nd) <= 0 ? "samme dag som" : `${dur(fd, nd)} etter at`} du oppdaget feilen. Reklamasjon innen to måneder er alltid rettidig.`, law: L.ref("reklamasjon") });
      else F.push({ s: "warn", t: "Du sa fra etter mer enn to måneder", d: "Det kan fortsatt være innen rimelig tid, men forhandleren kan bestride det. Bekreft reklamasjonen skriftlig nå." });
    } else if (q.notified === "ja" && !nd) F.push({ s: "info", t: "Du har sagt fra", d: "Bekreft reklamasjonen skriftlig, så har du dokumentasjon på datoen." });
    else F.push(...ikkeReklamert(fd));
    // A fault found after the earlier complaint is complained of by this letter.
    const senere = q.notified === "ja" && nd ? parseD(q.senereFunnet) : null;
    if (senere) F.push(...ikkeReklamert(senere));
  }

  // Before 2024 «som den er» is judged by old § 17; from 2024 a general clause is no agreed exception
  // under § 15 annet ledd, so it does not weaken the case.
  if (q.asis === "ja")
    F.push(
      L.versjon === "før_2024"
        ? { s: "warn", t: "Solgt «som den er»", d: `Du må vise at bilen er ${LOVORD.dårligereStand.replace("jeg", "du")}, eller at forhandleren holdt tilbake opplysninger.`, law: L.ref("forbehold") }
        : { s: "info", t: "Solgt «som den er»", d: "Et generelt forbehold om at bilen selges «som den er», er ikke et avtalt unntak. Det gjelder bare egenskaper du ble spesielt opplyst om og uttrykkelig godtok.", law: L.ref("forbehold") },
    );

  const sev = q.sev ?? 0;
  if (sev >= 4) F.push({ s: "good", t: "Alvorlig feil", d: "Kan gi grunnlag for å heve kjøpet hvis forhandleren ikke klarer å rette feilen.", law: L.ref("heving") });
  else if (sev === 1) F.push({ s: "info", t: "Kosmetisk feil", d: "Kan gi rett til retting eller prisavslag, men normalt ikke heving." });

  F.push(...wsFactors({ ws: q.ws, ws_says: q.ws_says, seller_said: q.seller_said, c_purchase: q.kjopsdato, opplysning: q.opplysning || q.noenOpplysning }, etter), ...feilFaktorer(q), ...forsokFaktor(q, L));

  // Without any date there is nothing to weigh yet.
  if (!q.delivery || !q.found) return { tier: "ukjent", badge: "Foreløpig", title: "Legg inn datoene for å se hvor sterk saken er", summary: "Saksstyrken regnes ut når du har lagt inn når du overtok bilen og når du oppdaget feilen.", factors: F };
  const poeng = sumFor(F);
  const tier = nivaFor(poeng);
  return { tier, ...TIER[tier], factors: F, poeng };
}

// § 27 annet ledd fjerde punktum (a warranty for longer) and fjerde ledd (the seller grossly negligent or
// in bad faith), lovdata.no 2026-10-18.
const UNNTAK_FEM_AR = "med mindre en garanti gir lengre frist, eller forhandleren har opptrådt grovt uaktsomt eller i strid med redelighet og god tro";

// A defect the seller told of, from 2024: it counts against the buyer only as an agreed exception. Before
// 2024 (old § 16 tredje ledd) nothing the buyer knew; from 2024 what the buyer knew weighs in what they
// could reasonably expect (§ 15 tredje ledd bokstav b, Prop. 49 LS kap. 10.1.5).
const KJENT_ETTER_2024 = (L: Regler): Faktor => ({
  s: "warn",
  t: "Du ble opplyst om feilen",
  d: "Det teller mot deg bare hvis du ble spesielt opplyst om akkurat dette avviket og uttrykkelig godtok det. Det du visste, kan likevel påvirke hva du kunne forvente.",
  law: L.ref("forbehold"),
  w: -1,
});

// What the report must say when the fault showed late: that it was there at delivery, or is not wear.
// After the presumption period the buyer lost most often because that was not shown (46 % of the
// rejected faults; wear 27 %), so a report that says it weighs as much as the period lost.
const SVARER_PA_LEVERING = ["levering", "ikke_slitasje"];

const WS_FAKTOR = {
  rapport: (says: string[], etter: boolean): Faktor =>
    etter && !says.some((x) => SVARER_PA_LEVERING.includes(x))
      ? {
          s: "warn",
          t: "Be verkstedet skrive om feilen fantes ved leveringen",
          d: "Feilen viste seg sent, så du må selv vise at den fantes da du overtok bilen. Det er den vanligste grunnen til at slike saker tapes. Kryss av hvis rapporten sier det, eller be verkstedet ta det med.",
        }
      : {
          s: "good",
          t: "Verkstedrapport støtter saken",
          d: says.includes("levering") ? "Rapporten sier at feilen var til stede ved levering. Det er sterk dokumentasjon. Legg den ved brevet." : says.length ? "Legg ved rapporten når du sender brevet." : "Kryss av hva rapporten sier, så bruker vi det i brevet.",
          w: etter ? 1 : 0,
        },
  uten: (says: string[]): Faktor => ({
    s: "info",
    t: "Verkstedet har sett på feilen",
    d: `${says.length ? "Det verkstedet sa, står i brevet." : "Kryss av hva verkstedet sa, så bruker vi det i brevet."} En skriftlig rapport gjør saken sterkere, og forhandleren kan be om å se den.`,
  }),
  nei: (_: string[], etter: boolean): Faktor =>
    etter
      ? { s: "warn", t: "Få en verkstedrapport før du sender", d: "Feilen viste seg sent, så du må selv vise at den fantes ved leveringen. En rapport som sier det, eller at feilen ikke er slitasje, svarer på de vanligste grunnene til at slike saker tapes." }
      : { s: "info", t: "Ingen verkstedrapport ennå", d: "En rapport fra et uavhengig verksted som beskriver feilen og årsaken, gjør saken mye sterkere." },
};

// What the writer adds to the verdict: the workshop and what the seller said before the sale. `etter`:
// the fault showed after the presumption period. `opplysning`: a fault in what the seller said already
// weighs, so «lovet» does not count twice.
export function wsFactors(s: { ws?: string; ws_says?: string[]; seller_said?: string; c_purchase?: string; c_delivery?: string; opplysning?: boolean }, etter = false): Faktor[] {
  const F: Faktor[] = [];
  const dato = s.c_purchase || s.c_delivery;
  if (s.ws === "rapport" || s.ws === "uten" || s.ws === "nei") F.push(WS_FAKTOR[s.ws](s.ws_says ?? [], etter));
  if (s.seller_said === "lovet") F.push({ s: "good", t: "Selger sa at bilen var fri for slike feil", d: "Det selger opplyste før kjøpet, er en del av avtalen. Avvik fra det er en mangel.", law: regler(dato).ref("uriktig"), w: s.opplysning ? 0 : 2 });
  else if (s.seller_said === "opplyste") {
    const L = regler(dato);
    F.push(L.versjon === "før_2024" ? { s: "bad", t: "Selger opplyste om feilen", d: "Du kan normalt ikke reklamere på en feil selger fortalte om før kjøpet.", w: -2 } : { ...KJENT_ETTER_2024(L), t: "Selger opplyste om feilen" });
  }
  return F;
}

// The kind of fault: wear, an unknown cause, and what the dealer has answered. Only the faults that are
// not in what the seller said, and the weight only when all of them are of the kind.
function feilFaktorer(q: Sjekksvar): Faktor[] {
  const F: Faktor[] = [];
  const fys = q.fysiske ?? [];
  const svar = q.f_prior_svar ?? [];
  const rapport = q.ws === "rapport" ? (q.ws_says ?? []) : [];
  const alle = (kat: string[]) => fys.length > 0 && !q.noenOpplysning && fys.every((c) => kat.includes(c));
  const sagtSlitasje = svar.includes("slitasje") ? " Forhandleren har alt sagt at det er slitasje." : "";
  if (fys.some((c) => SLITASJE.includes(c))) {
    if (rapport.includes("ikke_slitasje")) F.push({ s: "good", t: "Verkstedet sier at feilen ikke er slitasje", d: `Slitasje er den vanligste grunnen til at slike feil blir avvist. Rapporten svarer på det.${sagtSlitasje}` });
    else
      F.push({
        s: "warn",
        t: "Forhandleren kan si at det er slitasje",
        d: `Slitasje er den vanligste grunnen til at utvalget avviser feil på understell og drivlinje.${sagtSlitasje} En verkstedrapport som sier at feilen ikke skyldes normal slitasje, svarer på det.`,
        w: alle(SLITASJE) ? -2 : 0,
      });
  } else if (svar.includes("slitasje")) F.push({ s: "info", t: "Forhandleren mener det er slitasje", d: "Brevet svarer på det med det loven sier. En verkstedrapport som sier at feilen ikke skyldes normal slitasje, styrker saken." });
  // «Vet ikke ennå»: turned down most often as not documented (56 % of the rejected).
  if (alle(["vet_ikke"]) && !rapport.includes("aarsak"))
    F.push({ s: "warn", t: "Årsaken er ikke funnet ennå", d: "Slike saker blir oftest avvist fordi feilen ikke er dokumentert. Få feilen undersøkt av et verksted, så vet du hva du klager på.", w: -2 });
  const andre = svar.filter((x) => x !== "slitasje" && SVAR.some(([id]) => id === x));
  if (andre.length) F.push({ s: "info", t: "Brevet svarer på det forhandleren har sagt", d: "Brevet tar for seg innvendingene forhandleren har kommet med, og viser til det loven sier." });
  return F;
}

// Failed repairs: the attempts after which the buyer may refuse more (§ 30: two before 2024, one after).
function forsokFaktor(q: Sjekksvar, L: Regler): Faktor[] {
  const n = forsokTall(q.k_forsok ?? "");
  if (n === null || n < 1) return [];
  if (n >= (L.versjon === "før_2024" ? 2 : 1))
    return [{ s: "good", t: "Forhandleren har ikke klart å rette feilen", d: `Etter ${n === 1 ? "det mislykkede forsøket" : "de mislykkede forsøkene"} kan du avvise flere forsøk og kreve prisavslag eller heving.`, law: L.ref("avhjelp_avvise"), w: 1 }];
  return [{ s: "info", t: "Ett rettingsforsøk har ikke løst feilen", d: "For kjøp før 2024 kan forhandleren normalt forsøke to ganger før du kan kreve prisavslag eller heving." }];
}

// The row on how cases like this went, when the fault showed after the presumption period (Celle):
// added beside the verdict where «Lignende saker» has arrived. Counts, never a share.
const AVSLAG_TEKST: Record<string, string> = {
  ikke_sannsynliggjort_ved_levering: "at det ikke var vist at feilen fantes ved leveringen",
  paregnelig_slitasje: "at feilen ble regnet som normal slitasje",
  ikke_dokumentert: "at feilen ikke var dokumentert",
};

export function celleFaktor(c: Celle): Faktor {
  const grunn = c.avslag ? AVSLAG_TEKST[c.avslag] : undefined;
  const tapt = c.saker - c.medhold;
  return {
    s: "info",
    t: "Slik gikk lignende saker",
    d: [
      `Feilen viste seg etter ${c.niva === 3 ? "to år" : "seks måneder"}, så du må selv vise at den fantes ved leveringen.`,
      `I ${c.saker} saker om ${c.tema} som viste seg like sent og gikk helt til Forbrukerklageutvalget, fikk kjøperen medhold i ${c.medhold}.`,
      grunn && tapt > 0 ? `Den vanligste grunnen til at kjøperen tapte, var ${grunn} (${c.avslagAntall} av ${tapt}). En verkstedrapport som sier at feilen fantes ved leveringen, og at den ikke er slitasje, svarer på det.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

// The verdict with the row on cases like this one, after the row on when the fault showed.
export function medCelle(r: Resultat, c: Celle | null | undefined): Resultat {
  if (!c || r.tier === "utenfor" || r.tier === "frist" || r.tier === "ukjent") return r;
  const i = r.factors.findIndex((f) => f.t.startsWith("Mer enn ") || f.t === "Fristen er ute");
  if (i < 0) return r;
  return { ...r, factors: [...r.factors.slice(0, i + 1), celleFaktor(c), ...r.factors.slice(i + 1)] };
}

// The verdict in the writer: the check's rules on the writer's answers, the workshop, what the seller
// said, the repair attempts and the dealer's answer. Without dates it is only preliminary.
export const writerQ = (s: Skjema): Sjekksvar => {
  const opp = s.f_cats.map((c) => opplysningsfeil(c, s.f_parts[c] ?? []));
  return {
    seller: "forhandler",
    buyer: "privat",
    asis: s.c_asis ? "ja" : "nei",
    kjopsdato: s.c_purchase || s.c_delivery,
    delivery: s.c_delivery,
    found: s.f_found,
    opplysning: s.f_cats.length > 0 && opp.every(Boolean),
    noenOpplysning: opp.some(Boolean),
    fysiske: s.f_cats.filter((_, i) => !opp[i]),
    sist: feilposter(s).map((p) => p.found).filter(Boolean).sort().at(-1),
    sev: s.f_sev,
    notified: s.f_prior ? "ja" : "nei",
    notifiedDate: s.f_prior_date,
    senereFunnet: s.f_prior && s.f_prior_date ? feilposter(s).map((p) => p.found).filter((d) => d > s.f_prior_date).sort()[0] : undefined,
    ws: s.ws,
    ws_says: s.ws_says,
    seller_said: s.seller_said,
    k_forsok: s.k_forsok,
    f_prior_svar: s.f_prior ? s.f_prior_svar : [],
    unntak: s.c_unntak,
  };
};

// `q`: the verdict's answers when they are not only the writer's (the draft's, utkast.ts).
export const skriverResultat = (s: Skjema, idag: string, q: Sjekksvar = writerQ(s)): Resultat => evaluate(q, idag);
