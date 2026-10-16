// The free verdict: sterk / mulig / svak from the buyer's answers, or utenfor when the case is not one
// the letter covers. Ported from the artifact (evaluate, wsFactors); the presumption period and the
// «som den er» rule follow the law version of the purchase (lov.ts).
import { opplysningsfeil } from "@/lib/brev/feiltype";
import { LOVORD } from "@/lib/brev/paragrafer";
import { plussManeder } from "@/lib/brev/tidslinje";
import { addMonths, dayDiff, dur, fmtD, iso, parseD } from "./dato";
import { regler } from "./lov";
import type { Skjema } from "./skjema";

export type Niva = "sterk" | "mulig" | "svak" | "utenfor" | "ukjent";
export type Faktor = { s: "good" | "warn" | "bad" | "info"; t: string; d: string; law?: string };
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
  known?: "nei" | "opplyst" | "synlig";
  cause?: "nei" | "slitasje" | "uhell" | "vetikke";
  notified?: "ja" | "nei";
  notifiedDate?: string;
  km?: string;
  sev?: number;
  // Every fault is in what the seller said or promised (opplysningsfeil).
  opplysning?: boolean;
};
export type Resultat = {
  tier: Niva;
  badge: string;
  title: string;
  summary: string;
  pos?: string;
  advice?: string[];
  factors: Faktor[];
  claim?: string;
  alt?: "heving" | "prisavslag";
  sendBy?: string | null;
  docs?: string;
};

const UTENFOR = {
  privat: {
    title: "Kjøp fra privatperson dekkes ikke her",
    summary: "Ved kjøp mellom privatpersoner gjelder kjøpsloven, og selgeren kan ha tatt forbehold i kontrakten. Brevskriveren er laget for kjøp fra forhandler.",
    advice: ["Les kontrakten og se etter forbehold som «som den er».", "Si fra skriftlig til selgeren så snart som mulig.", "Forbrukerrådet gir gratis råd, også om kjøp fra privatperson."],
  },
  leasing: {
    title: "Leasing har egne regler",
    summary: "Når bilen er leaset, er det leasingselskapet som eier den. Feil på bilen tar du opp med leasingselskapet etter leieavtalen.",
    advice: ["Les leieavtalen og se hva den sier om feil og mangler.", "Kontakt leasingselskapet skriftlig.", "Forbrukerrådet kan hjelpe hvis du ikke kommer til enighet."],
  },
  naering: {
    title: "Kjøp gjennom firma dekkes ikke her",
    summary: "Når bilen er kjøpt i næring, gjelder kjøpsloven, og kontrakten kan begrense rettighetene dine. Brevskriveren er laget for privatpersoner som har kjøpt bil av en forhandler.",
    advice: ["Les kontrakten og se hva den sier om feil og reklamasjon.", "Si fra skriftlig til forhandleren så snart som mulig.", "Snakk med en advokat hvis saken gjelder store beløp."],
  },
};

const TIER = {
  sterk: { badge: "Sterk sak", title: "Du har trolig en god sak", summary: "Ut fra svarene dine taler det meste for deg. Send en skriftlig reklamasjon så snart som mulig.", pos: "84%" },
  mulig: { badge: "Mulig sak", title: "Du kan ha en sak, men noe bør avklares", summary: "Noen forhold kan svekke saken. Se punktene under. En verkstedrapport eller annen dokumentasjon kan gjøre den sterkere.", pos: "50%" },
  svak: { badge: "Svak sak", title: "Saken ser vanskelig ut", summary: "Ett eller flere forhold taler tydelig mot deg. Du kan likevel reklamere, men vurder å få gratis råd fra Forbrukerrådet først.", pos: "16%" },
};

export function evaluate(q: Sjekksvar, idag: string): Resultat {
  const ut = (k: keyof typeof UTENFOR): Resultat => ({ tier: "utenfor", badge: "Utenfor det vi dekker", ...UTENFOR[k], factors: [] });
  if (q.seller === "privat") return ut("privat");
  if (q.seller === "leasing") return ut("leasing");
  if (q.buyer === "naering") return ut("naering");

  const today = parseD(idag)!;
  const L = regler(q.kjopsdato || q.delivery);
  const F: Faktor[] = [{ s: "good", t: "Forbrukerkjøpsloven gjelder", d: "Du kjøpte som privatperson fra en forhandler. Loven kan ikke avtales bort til din ugunst." }];
  const del = parseD(q.delivery),
    fd = parseD(q.found);
  // The five years run from the handover; a complaint made after them is too late whenever the fault showed.
  const reklamert = q.notified === "ja" && q.notifiedDate ? q.notifiedDate : idag;
  let ute = false;
  if (del && fd) {
    if (fd < del) F.push({ s: "warn", t: "Feilen ble oppdaget før overtakelsen", d: "Var feilen kjent før du overtok bilen, kan det svekke saken. Sjekk at datoene stemmer." });
    else {
      // Calendar months, as the law and the ranking count (tidsnivaFor).
      const d = dur(del, fd) || "samme dag";
      const fem = plussManeder(q.delivery!, 60);
      ute = q.found! > fem || reklamert > fem;
      if (ute)
        F.push({
          s: "bad",
          t: "Fristen er ute",
          d: q.found! > fem ? `Feilen viste seg ${d} etter overtakelsen. Den absolutte fristen på fem år har gått ut, med mindre en garanti gir lengre frist.` : "Det er mer enn fem år siden du overtok bilen. Den absolutte fristen på fem år har gått ut, med mindre en garanti gir lengre frist.",
          law: L.ref("reklamasjon_5ar"),
        });
      else if (q.opplysning)
        F.push({ s: "good", t: "Bilen var ikke som selgeren opplyste", d: "Avviket fantes allerede da du kjøpte bilen, så du trenger ikke formodningsregelen. Det er nok å vise hva selgeren opplyste.", law: L.ref("uriktig") });
      else if (q.found! <= plussManeder(q.delivery!, L.formodningMnd))
        F.push({ s: "good", t: `Feilen viste seg innen ${L.formodningTekst}`, d: `Feilen viste seg ${d} etter overtakelsen. Da regnes den som hovedregel for å ha vært der fra start, og det er forhandleren som må bevise noe annet.`, law: L.ref("formodning") });
      else F.push({ s: "warn", t: `Mer enn ${q.found! > plussManeder(q.delivery!, 24) ? "to år" : L.formodningTekst} etter overtakelsen`, d: "Du er innenfor femårsfristen for bil, men må selv sannsynliggjøre at feilen skyldes forhold ved leveringen.", law: L.ref("reklamasjon_5ar") });
    }
  } else F.push({ s: "warn", t: "Datoene mangler", d: "Uten overtakelsesdato og dato for når feilen ble oppdaget, kan vi ikke vurdere fristene. Vurderingen er derfor foreløpig." });

  // Dates that cannot all be right.
  const avvik = [
    [q.kjopsdato, q.delivery, q.found, q.sist, q.notified === "ja" ? q.notifiedDate : undefined].some((d) => d && d > idag) ? "En av datoene er frem i tid." : "",
    q.notified === "ja" && q.notifiedDate && q.found && q.notifiedDate < q.found ? "Du har oppgitt at du sa fra før du oppdaget feilen." : "",
  ].filter(Boolean);
  if (avvik.length) F.push({ s: "warn", t: "Sjekk datoene", d: `${avvik.join(" ")} Sjekk at datoene stemmer.` });
  if (!ute && !q.opplysning && del && fd && q.sist && fd >= del && q.found! <= plussManeder(q.delivery!, L.formodningMnd) && q.sist > plussManeder(q.delivery!, L.formodningMnd))
    F.push({ s: "warn", t: "Én av feilene viste seg senere", d: `Én av feilene viste seg mer enn ${L.formodningTekst} etter overtakelsen. For den må du selv sannsynliggjøre at den skyldes forhold ved leveringen.` });

  let sendBy: string | null = null;
  if (!ute && fd && fd >= (del ?? fd)) {
    const lim = addMonths(fd, 2),
      nd = parseD(q.notifiedDate);
    if (q.notified === "ja" && nd && nd >= fd) {
      if (nd <= lim) F.push({ s: "good", t: "Du sa fra i tide", d: `Du sa fra ${dayDiff(fd, nd) <= 0 ? "samme dag som" : `${dur(fd, nd)} etter at`} du oppdaget feilen. Reklamasjon innen to måneder er alltid rettidig.`, law: L.ref("reklamasjon") });
      else F.push({ s: "warn", t: "Du sa fra etter mer enn to måneder", d: "Det kan fortsatt være innen rimelig tid, men forhandleren kan bestride det. Bekreft reklamasjonen skriftlig nå." });
    } else if (q.notified === "ja" && !nd) F.push({ s: "info", t: "Du har sagt fra", d: "Bekreft reklamasjonen skriftlig, så har du dokumentasjon på datoen." });
    else if (today <= lim) {
      sendBy = iso(lim);
      F.push({ s: "good", t: "Du er i tide", d: `Sender du reklamasjonen innen ${fmtD(lim)}, er den alltid rettidig.`, law: L.ref("reklamasjon") });
    } else F.push({ s: "warn", t: "Det har gått mer enn to måneder", d: "Du må reklamere innen rimelig tid etter at du oppdaget feilen. Send reklamasjonen så snart som mulig." });
  }

  if (q.known === "opplyst") F.push({ s: "bad", t: "Du ble informert om feilen", d: "Du kan normalt ikke reklamere på en feil du kjente til da du kjøpte bilen." });
  else if (q.known === "synlig") F.push({ s: "warn", t: "Feilen var synlig ved kjøpet", d: "Feil du måtte ha sett da du kjøpte bilen, kan være vanskelig å reklamere på." });
  else if (q.known === "nei") F.push({ s: "good", t: "Feilen var ukjent ved kjøpet", d: "Du visste ikke om feilen da du kjøpte bilen." });

  if (q.cause === "uhell") F.push({ s: "bad", t: "Skade eller feil bruk", d: "Feil som skyldes uhell, skade eller feil bruk etter overtakelsen, regnes ikke som en mangel." });
  else if (q.cause === "slitasje") F.push({ s: "warn", t: "Kan være vanlig slitasje", d: `Normal slitasje er ikke en mangel. Det avhenger av bilens alder${q.km ? `, kilometerstand (${q.km} km)` : ""} og hva du kunne forvente.` });
  else if (q.cause === "vetikke") F.push({ s: "info", t: "Årsaken er uklar", d: "En verkstedrapport som beskriver feilen og årsaken, gjør saken mye sterkere." });
  else if (q.cause === "nei") F.push({ s: "good", t: "Feilen skyldes bilen", d: "Feilen har oppstått uten uhell eller feil bruk." });

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

  const bad = F.filter((f) => f.s === "bad").length,
    warn = F.filter((f) => f.s === "warn").length;
  const tier = bad ? "svak" : warn === 0 ? "sterk" : warn <= 2 ? "mulig" : "svak";
  const alt = sev >= 4 ? "heving" : "prisavslag";
  const claim = sev === 1 ? "Krev at feilen rettes. Prisavslag kan være et alternativ hvis du kan leve med feilen." : `Krev at forhandleren retter feilen, med ${alt} som subsidiært krav hvis rettingen ikke lykkes.`;
  // Always a used car, so the advice is always to get the workshop's word in writing.
  const docs = "Få et verksted til å beskrive feilen og årsaken skriftlig. Ta vare på kontrakt, bilder og kvitteringer.";
  return { tier, ...TIER[tier], factors: F, claim, alt, sendBy, docs };
}

const WS_FAKTOR = {
  rapport: (says: string[]): Faktor => ({
    s: "good",
    t: "Verkstedrapport støtter saken",
    d: says.includes("levering") ? "Rapporten sier at feilen var til stede ved levering. Det er sterk dokumentasjon. Legg den ved brevet." : says.length ? "Legg ved rapporten når du sender brevet." : "Kryss av hva rapporten sier, så bruker vi det i brevet.",
  }),
  uten: (): Faktor => ({ s: "info", t: "Be om en skriftlig rapport", d: "Verkstedet har sett på bilen. En skriftlig rapport som beskriver feilen og årsaken, gjør saken sterkere." }),
  nei: (): Faktor => ({ s: "info", t: "Ingen verkstedrapport ennå", d: "En rapport fra et uavhengig verksted som beskriver feilen og årsaken, gjør saken mye sterkere." }),
};

// What the writer adds to the verdict: the workshop and what the seller said before the sale.
export function wsFactors(s: { ws?: string; ws_says?: string[]; seller_said?: string; dato?: string }): Faktor[] {
  const F: Faktor[] = [];
  if (s.ws === "rapport" || s.ws === "uten" || s.ws === "nei") F.push(WS_FAKTOR[s.ws](s.ws_says ?? []));
  if (s.seller_said === "lovet") F.push({ s: "good", t: "Selger sa at bilen var fri for slike feil", d: "Det selger opplyste før kjøpet, er en del av avtalen. Avvik fra det er en mangel.", law: regler(s.dato).ref("uriktig") });
  else if (s.seller_said === "opplyste") F.push({ s: "bad", t: "Selger opplyste om feilen", d: "Du kan normalt ikke reklamere på en feil selger fortalte om før kjøpet." });
  return F;
}

// The verdict in the writer: the check's rules on the writer's answers, plus the workshop and what the
// seller said. Without dates it is only preliminary.
export const writerQ = (s: Skjema): Sjekksvar => ({
  seller: "forhandler",
  buyer: "privat",
  asis: s.c_asis ? "ja" : "nei",
  km: s.c_km,
  kjopsdato: s.c_purchase || s.c_delivery,
  delivery: s.c_delivery,
  found: s.f_found,
  opplysning: s.f_cats.length > 0 && s.f_cats.every((c) => opplysningsfeil(c, s.f_parts[c] ?? [])),
  sist: s.f_cats.map((c) => s.f_area[c]?.found).filter((d): d is string => !!d).sort().at(-1),
  sev: s.f_sev,
  known: (s.f_known || undefined) as Sjekksvar["known"],
  cause: (s.f_cause || undefined) as Sjekksvar["cause"],
  notified: s.f_prior ? "ja" : "nei",
  notifiedDate: s.f_prior_date,
});

export function skriverResultat(s: Skjema, idag: string): Resultat {
  const r = evaluate(writerQ(s), idag);
  const ut = { ...r, factors: [...r.factors, ...wsFactors({ ...s, dato: s.c_purchase || s.c_delivery })] };
  if (!s.c_delivery && !s.f_found) return { ...ut, tier: "ukjent", badge: "Foreløpig", title: "Legg inn datoene for å se hvor sterk saken er", summary: "Saksstyrken regnes ut når du har lagt inn når du overtok bilen og når du oppdaget feilen." };
  return ut;
}
