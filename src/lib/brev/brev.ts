import { beregnFaktorer, iDag, kjopsdatoFor, leggTilManeder, type Faktorer } from "@/lib/vurdering/faktorer";
import { NAAR } from "@/lib/vurdering/grunnlag";
import { velgHenvisning, type ValgtHenvisning } from "@/lib/vurdering/henvisninger";
import { kontonummerGruppert } from "./utfylling";
import {
  gyldigRetting,
  type FeilKnapp,
  type KlageInput,
  type Retting,
} from "@/lib/vurdering/typer";
import type {
  Forbehold,
  Opplysning,
  Reklamasjon,
  Reparasjon,
  Utfylling,
  Utgift,
  Vedlegg,
} from "./utfylling";

// The complaint letter as data, so the page can show it now and PDF/Word and new paragraphs can be
// built on the same shape later. Phase 1 is a fixed template: no model call. What the form does not
// collect (names, addresses, car, exact dates, a description of the defect) is a placeholder in
// square brackets that the buyer fills in before sending.

const gruppert = (orgnr: string) => orgnr.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

export type Brev = {
  avsender: string[];
  mottaker: string[];
  stedDato: string;
  emne: string;
  avsnitt: string[];
  hilsen: string;
  underskrift: string;
};

// The defect buttons as they read inside a sentence («feil ved …»). «Annet» says nothing.
const FEIL_I_SETNING: Record<FeilKnapp, string | null> = {
  motor: "motoren",
  girkasse: "girkassen eller clutchen",
  elektrisk: "det elektriske anlegget",
  batteri: "batteriet",
  understell: "understellet og hjulopphenget",
  bremser: "bremsene",
  rust: "rust",
  fukt: "fukt og lekkasje",
  klimaanlegg: "klimaanlegget",
  km_service: "kilometerstanden eller servicehistorikken",
  skade: "kollisjonsskader",
  annet: null,
};

const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
// How long the dealer gets to answer.
export const SVARFRIST_DAGER = 14;
// Interest on late payment runs from 30 days after a written demand (forsinkelsesrenteloven § 2).
export const RENTE_FORFALL_DAGER = 30;
// § 27 (1): a complaint within two months of discovering the defect is always in time.
export const REKLAMASJON_ALLTID_I_TIDE_MANEDER = 2;

// Exported so the letter on screen can turn a placeholder into a button that opens the step that fills it.
export const FEIL_PLASSHOLDER = "[Beskriv feilen: når den viste seg, hva som skjer, og hva verkstedet har funnet.]";
export const KRAV_ALTERNATIV = "[prisavslag / heving av kjøpet]";
export const OPPLYSNING_PLASSHOLDER = "[Skriv hva annonsen eller selgeren opplyste som ikke stemte.]";
export const REPARASJON_PLASSHOLDER = "[dato, og hvorfor dere ikke rettet feilen]";
export const KONTAKT_PLASSHOLDER = "[dato og måte]";

export function norskDato(iso: string): string {
  const [ar, maned, dag] = iso.split("-").map(Number);
  return `${dag}. ${MANEDER[maned - 1]} ${ar}`;
}

export function plussDager(iso: string, dager: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

export const kroner = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

function liste(ledd: string[]): string {
  return ledd.length <= 1 ? (ledd[0] ?? "") : `${ledd.slice(0, -1).join(", ")} og ${ledd[ledd.length - 1]}`;
}

const medPunktum = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);
const utenPunktum = (t: string) => t.replace(/[.!?]+$/, "");

// Legal wording that goes beyond restating a rule in the form: in one place so a lawyer can read it.
// Not reviewed by a lawyer yet.
// «Som den er» was a valid reservation before 2024 (§ 17 as it read then): the car is still defective when
// it is worse than the buyer could expect from the reservation, the price and the rest. From 2024 a general
// reservation has no effect; only a deviation the buyer was told of specifically and accepted expressly and
// separately does (§ 15 second paragraph).
function forbeholdAvsnitt(forbehold: Forbehold, presumsjonManeder: 6 | 24, visste: boolean): string | null {
  if (forbehold === "som_den_er")
    return presumsjonManeder === 6
      ? "Selv om bilen ble solgt «som den er», har den en mangel når den er i dårligere stand enn jeg med rimelighet hadde grunn til å forvente ut fra forbeholdet, kjøpesummen og forholdene ellers, jf. forbrukerkjøpsloven § 17 første ledd bokstav a slik den lød da vi inngikk avtalen. Det er tilfellet her."
      : `Et alminnelig forbehold om at bilen selges «som den er», har ingen virkning overfor meg som forbruker, jf. § 15 andre ledd og § 3.${visste ? "" : " Jeg godtok ikke feilen uttrykkelig og særskilt ved kjøpet."}`;
  if (forbehold === "garanti") return "Garantien dere ga, kommer i tillegg til rettighetene mine etter forbrukerkjøpsloven og innskrenker dem ikke, jf. § 3.";
  return null;
}

export const JURIDISK = {
  hevingSubsidiart: (utbedringNok?: number) =>
    utbedringNok ? `Dersom dere ikke godtar heving, krever jeg subsidiært prisavslag på ${kroner(utbedringNok)}, jf. § 31.` : "Dersom dere ikke godtar heving, krever jeg subsidiært et forholdsmessig prisavslag, jf. § 31.",
  // Interest runs from 30 days after a written demand is sent (forsinkelsesrenteloven § 2).
  rente: (idag: string) =>
    `Jeg krever også forsinkelsesrente etter forsinkelsesrenteloven §§ 2 og 3 av det beløpet dere skylder meg, fra ${RENTE_FORFALL_DAGER} dager etter at dette brevet er sendt (${norskDato(plussDager(idag, RENTE_FORFALL_DAGER))} hvis det sendes i dag) til betaling skjer.`,
  // When the purchase price is paid back, interest runs from the day the buyer complained (§ 50 second paragraph).
  renteHeving: (reklamert: string | null) =>
    `Etter forbrukerkjøpsloven § 50 andre ledd skal dere betale forsinkelsesrente av kjøpesummen fra ${reklamert ? `${norskDato(reklamert)}, da jeg reklamerte,` : "datoen for dette brevet"} til betaling skjer. Krever dere vederlag for bruken av bilen, løper renten fra den dagen dere mottok betalingen.`,
  // § 32: cancelling is not open for a minor defect; from 2024 the dealer must prove that it is minor.
  vesentlig: (presumsjonManeder: 6 | 24) =>
    presumsjonManeder === 24 ? "Mangelen er ikke uvesentlig, og det er dere som må bevise noe annet, jf. § 32." : "Mangelen er ikke uvesentlig, jf. § 32.",
  // From 2024, after a failed repair the buyer may refuse further attempts unless another is reasonable.
  avviserNyttForsok: "Jeg avviser ytterligere retting, jf. § 30 fjerde ledd.",
  // Why the buyer, not the dealer, had the defect repaired (the dealer has the first try, §§ 29 and 30).
  reparasjon: {
    avvist: (dato: string) => `Da dere ikke ville rette feilen, fikk jeg den utbedret hos et annet verksted ${dato}.`,
    ikke_rettet: (dato: string) => `Da feilen ikke ble rettet innen rimelig tid, fikk jeg den utbedret hos et annet verksted ${dato}.`,
    nodvendig: (dato: string) => `Feilen gjorde at jeg ikke kunne bruke bilen, og jeg måtte derfor få den utbedret hos et annet verksted ${dato}.`,
    ingen: (dato: string) => `Jeg fikk feilen utbedret hos et annet verksted ${dato}.`,
  } satisfies Record<Reparasjon["grunn"], (dato: string) => string>,
  forbehold: forbeholdAvsnitt,
  // When the report or the description itself speaks of wear, the letter says the wear is not normal
  // rather than that it is not wear.
  slitasje: (km?: number, nevnerSlitasje = false) =>
    `${nevnerSlitasje ? "Slitasjen er ikke normal." : "Feilen er ikke normal slitasje."} ${km !== undefined ? `Bilen hadde gått ${kroner(km).replace(/ kr$/, "")} km da jeg kjøpte den, og ${nevnerSlitasje ? "slitasjen" : "feilen"}` : "Den"} er mer omfattende enn jeg med rimelighet kunne vente ut fra bilens alder, kilometerstand og pris, jf. § 15.`,
  // Bilen is meant to last much longer than two years, so the deadline is five years (§ 27 second paragraph).
  femArsfrist: (delene: boolean) =>
    `${delene ? "Bilen og delene feilen gjelder, er" : "Bilen er"} ment å vare vesentlig lenger enn to år, og fristen for å reklamere er derfor fem år, jf. § 27 andre ledd.`,
  // Law first, then the decision: case reference, date, one sentence on the likeness and one on the
  // outcome, and a link. No amounts, no names.
  // A case under the old rules cited for a purchase from 2024 says so: the change has not made the rules
  // less favourable to the buyer, and the presumption was six months then.
  // Only where the change matters: a buyer whose defect showed after six months, under the new rules.
  henvisning: ({ henvisning: h, treff }: ValgtHenvisning, f?: Pick<Faktorer, "presumsjonManeder" | "oppdaget">) => {
    const kilde = `(${h.ref}, ${norskDato(h.dato)}, ${h.kildeUrl}).`;
    const lov =
      f?.presumsjonManeder === 24 && f.oppdaget !== "innen_6_mnd" && h.lov === "før_2024"
        ? ` Saken gjaldt et kjøp før 1. januar 2024${h.presumsjon ? ", da formodningsperioden i § 18 var seks måneder" : ""}. Lovendringen har i hovedsak styrket kjøperens stilling.`
        : "";
    // The paragraph before states the presumption, the report or the information, so «the same» points
    // back to it; it does not state what the buyer could expect, so that rule is named here.
    const innledning = h.type === "regel" && h.grunnlag === "forventning" ? "har vurdert hva en kjøper kan forvente av en eldre bil" : "har lagt det samme til grunn tidligere";
    // Only the same kind of defect, not the same timing: not called «a similar case».
    const sak = treff === "lignende" ? "en lignende sak" : "en sak om samme type feil";
    return h.type === "regel"
      ? `${h.organ} ${innledning}. ${utenPunktum(h.regel)} ${kilde}${lov} Jeg ber dere ta hensyn til at utvalget har vurdert en tilsvarende sak slik.`
      : `${h.organ} har behandlet ${sak}. ${medPunktum(h.likhet)} ${utenPunktum(h.konklusjon)} ${kilde}${lov} Jeg ber dere ta hensyn til at utvalget har vurdert en tilsvarende sak slik.`;
  },
} as const;

// Does the letter still have something to fill in? Placeholders are written in square brackets.
export const harPlassholder = (b: Brev) => [...b.avsender, ...b.mottaker, b.stedDato, b.emne, ...b.avsnitt, b.underskrift].some((t) => /\[[^\]]+\]/.test(t));

function innvendinger(input: KlageInput, f: Faktorer, u: Utfylling): string[] {
  const ledd: string[] = [];
  const forbehold = u.forbehold && JURIDISK.forbehold(u.forbehold, f.presumsjonManeder, input.feilen.opplystForKjop === "ja");
  if (forbehold) ledd.push(forbehold);
  const nevnerSlitasje = /slit/i.test([u.rapport?.sitat ?? "", ...(u.feilen?.avsnitt ?? [])].join(" "));
  if (f.slitasjeAktuelt) ledd.push(JURIDISK.slitasje(input.bilOgKjop.kmVedKjop, nevnerSlitasje));
  return ledd.length ? [ledd.join(" ")] : [];
}

// The purchase and the defect: the buyer's first paragraph follows the purchase and the date; the
// rest stand as paragraphs of their own.
function kjopetOgFeilen(input: KlageInput, u: Utfylling): string[] {
  const { kjopsdato, kjopesumNok } = input.bilOgKjop;
  const sum = kjopesumNok != null ? kroner(kjopesumNok) : "[kjøpesum]";
  const kjopet = `Jeg viser til kjøp av ovennevnte bil fra dere ${kjopsdato ? norskDato(kjopsdato) : "[kjøpsdato]"} for ${sum}.`;
  if (u.feilen) {
    const [forste, ...resten] = u.feilen.avsnitt;
    const viste = u.feilen.feil.length > 1 ? "Den første feilen viste seg" : "Feilen viste seg første gang";
    return [`${kjopet} ${viste} ${norskDato(u.feilen.dato)}. ${medPunktum(forste)}`, ...resten.map(medPunktum)];
  }
  const feil = [...new Set(input.feilen.typer)].map((t) => FEIL_I_SETNING[t]).filter((t): t is string => t !== null);
  const feilen = feil.length > 0 ? `Bilen har feil ved ${liste(feil)}.` : "Bilen har en feil.";
  return [`${kjopet} ${feilen} ${FEIL_PLASSHOLDER}`];
}

const OPPLYSNING_KILDE: Record<Opplysning["kilde"], string> = {
  annonse: "I annonsen ble det opplyst følgende om bilen",
  kontrakt: "I kjøpekontrakten ble det opplyst følgende om bilen",
  melding: "I en melding fra dere ble det opplyst følgende om bilen",
  muntlig: "Før kjøpet fikk jeg muntlig opplyst følgende om bilen",
};

// A quote ends inside the sentence that carries it, so its own full stop goes.
export const utenSluttegn = (t: string) => t.replace(/[.!?]+$/, "");

function mangelOgBevisbyrde(input: KlageInput, idag: string, u: Utfylling): string {
  const f = beregnFaktorer(input, idag);
  const setninger = ["Bilen har etter dette en mangel etter forbrukerkjøpsloven § 16."];
  if (f.presumsjon) {
    const periode = f.presumsjonManeder === 24 ? "to år" : "seks måneder";
    setninger.push(
      `Feilen viste seg innen ${periode} etter levering, og det følger da av § 18 andre ledd at en mangel som viser seg innen ${periode} antas å ha eksistert ved leveringen, med mindre dere beviser noe annet.`,
    );
  } else {
    setninger.push(`Feilen viste seg ${NAAR[f.oppdaget]} etter levering.`);
  }
  // A report that points backward in time is evidence either way: inside the presumption it backs it
  // up, outside it is what the buyer has instead of it (§ 18 first paragraph).
  // When the buyer has written down what the report says, the letter names it and quotes it as written.
  if (f.rapportSierForKjop === true) {
    const r = u.rapport;
    const rapport = r ? `En rapport fra ${r.fra} datert ${norskDato(r.dato)}` : "En verksted- eller tilstandsrapport";
    setninger.push(
      f.presumsjon
        ? `${rapport} støtter også at feilen var der allerede da jeg overtok bilen.`
        : `${rapport} sier at feilen sannsynligvis var til stede før jeg overtok bilen, jf. § 18 første ledd.`,
    );
    if (r) setninger.push(`Der står det: «${utenSluttegn(r.sitat)}».`);
  }
  // The buyer answered that the ad or the dealer said something that was not true.
  if (input.feilen.feilOpplysning !== "nei") {
    setninger.push(
      u.opplysning
        ? `${OPPLYSNING_KILDE[u.opplysning.kilde]}: «${utenSluttegn(u.opplysning.tekst)}». Dette stemmer ikke, og bilen svarer dermed ikke til opplysningene dere har gitt, jf. § 16.`
        : OPPLYSNING_PLASSHOLDER,
    );
  }
  if (input.feilen.opplystForKjop === "nei") setninger.push("Jeg kjente ikke til feilen da jeg kjøpte bilen, og dere opplyste ikke om den.");
  return setninger.join(" ");
}

// The dealer may try to repair first (§ 29). Once the dealer has refused or tried without success,
// the buyer can go on to a price reduction or cancelling (§§ 31 and 32). The form does not ask how
// serious the defect is, so the choice between the two is the buyer's, made on the letter page.
export const harFatt = (retting: Retting | undefined) =>
  retting === "avvist" || retting === "forsokt" || retting === "ikke_rettet" || retting === "reparert_selv";

const MATE: Record<Reklamasjon["mate"], string> = {
  epost: "på e-post",
  sms: "på SMS",
  telefon: "på telefon",
  oppmote: "ved oppmøte hos dere",
  brev: "i brev",
};
const GANGER = ["én gang", "to ganger", "tre ganger", "fire ganger", "fem ganger", "seks ganger", "sju ganger", "åtte ganger", "ni ganger"];

// What has happened between the buyer and the dealer so far, in the order it happened: the first
// complaint (and that it came within two months of the defect, when it did), the dealer's answer, and a
// repair elsewhere with the reason the dealer did not make it. Empty when nothing has happened.
function historikk(kontakt: KlageInput["feilen"]["kontakt"], u: Utfylling, f: Faktorer): string {
  // Past five years, the date of the first complaint is what keeps the claim alive (§ 27 second paragraph).
  const femAr = f.femAarGatt && !f.fristUte ? ", innen fem år etter at jeg overtok bilen" : "";
  const { retting, reklamasjon: r, reparasjon, feilen } = u;
  // Each event with its date, so the letter can tell them in the order they happened.
  const hendelser: { dato: string; tekst: string }[] = [];
  if (kontakt === "ja") {
    const iTide =
      r && feilen && r.dato >= feilen.dato && r.dato <= leggTilManeder(feilen.dato, REKLAMASJON_ALLTID_I_TIDE_MANEDER)
        ? ", mindre enn to måneder etter at jeg oppdaget den"
        : "";
    // Without the date the letter reads as a first complaint; the placeholder opens «Kontakt med forhandleren».
    const forste = `Jeg tok opp feilen med dere første gang ${r ? `${norskDato(r.dato)} ${MATE[r.mate]}` : KONTAKT_PLASSHOLDER}${iTide}${femAr}`;
    const dato = r?.dato ?? "";
    if (retting === "avvist") {
      const avvist = r?.svarDato ? `dere avviste ${norskDato(r.svarDato)} å rette den` : "dere har avvist å rette den";
      hendelser.push({ dato, tekst: `${forste}, men ${avvist}.` });
    } else if (retting === "forsokt") {
      hendelser.push({ dato, tekst: `${forste}.` });
      // One attempt has no «last»; it has a day.
      const forsok =
        r?.forsok === 1 && r.svarDato
          ? `Dere forsøkte å rette feilen ${norskDato(r.svarDato)}, uten å lykkes.`
          : `Dere har forsøkt å rette feilen ${[r?.forsok ? GANGER[r.forsok - 1] : "", r?.svarDato ? `${r.forsok ? ", " : ""}sist ${norskDato(r.svarDato)},` : ""].join("")} uten å lykkes.`.replace(/ +/g, " ");
      hendelser.push({ dato: r?.svarDato ?? dato, tekst: forsok });
    } else if (retting === "ikke_rettet") {
      hendelser.push({ dato, tekst: `${forste}. Dere har ikke rettet den innen rimelig tid, selv om bilen har stått til rådighet for retting, jf. § 30.` });
    } else if (retting === "venter") {
      hendelser.push({ dato, tekst: `${forste}. Feilen er ennå ikke rettet.` });
    } else hendelser.push({ dato, tekst: `${forste}.` });
  }
  if (retting === "reparert_selv") {
    hendelser.push(
      reparasjon
        ? { dato: reparasjon.dato, tekst: JURIDISK.reparasjon[reparasjon.grunn](norskDato(reparasjon.dato)) }
        : { dato: "9999", tekst: `Jeg fikk feilen utbedret hos et annet verksted ${REPARASJON_PLASSHOLDER}.` },
    );
  }
  // Stable sort by date; an event without a date keeps its place.
  const sortert = hendelser.every((h) => h.dato) ? [...hendelser].sort((a, b) => (a.dato < b.dato ? -1 : a.dato > b.dato ? 1 : 0)) : hendelser;
  return sortert.length ? `${sortert.map((h) => h.tekst).join(" ")} ` : "";
}

function krav(input: KlageInput, f: Faktorer, u: Utfylling, idag: string): string {
  // A defect that showed after two years: the five-year deadline needs the part to be meant to last
  // longer. Past five years, but the first complaint came in time: says so, since the dealer may
  // otherwise read the date alone as too late.
  // The two years run from delivery to the complaint (§ 27 second paragraph): the first one, or this letter.
  const reklamert = input.feilen.kontakt === "ja" && u.reklamasjon ? u.reklamasjon.dato : idag;
  const femAr = reklamert > leggTilManeder(kjopsdatoFor(input.bilOgKjop, idag), 24);
  // Wrong mileage or hidden damage concerns the car, not a part that wears.
  const delene = f.feilgrupper.length === 0 || f.feilgrupper.some((g) => g[0] !== "km_avvik" && g[0] !== "kollisjonsskade");
  const frist = [
    femAr ? JURIDISK.femArsfrist(delene) : "",
    // With the date of the first complaint in the letter, `historikk` says it came within five years.
    f.femAarGatt && !f.fristUte && !(input.feilen.kontakt === "ja" && u.reklamasjon) ? `Det er mer enn fem år siden jeg overtok bilen, men jeg tok dette opp med dere innen fem år, slik at fristen${femAr ? "" : " i § 27 andre ledd"} er overholdt.` : "",
  ]
    .filter(Boolean)
    .map((t) => `${t} `)
    .join("");
  const r = input.feilen.kontakt === "ja" ? u.reklamasjon : undefined;
  // A complaint already made is confirmed in writing here; otherwise this letter is the complaint, and
  // says so when it comes within the two months that are always in time (§ 27 first paragraph).
  const iTide = input.feilen.kontakt === "nei" && u.feilen && idag <= leggTilManeder(u.feilen.dato, REKLAMASJON_ALLTID_I_TIDE_MANEDER) ? ", mindre enn to måneder etter at jeg oppdaget feilen" : "";
  const reklamerer = input.feilen.kontakt === "ja" ? "Jeg bekrefter herved reklamasjonen skriftlig, jf. forbrukerkjøpsloven § 27." : `Jeg reklamerer herved på mangelen i medhold av forbrukerkjøpsloven § 27${iTide}.`;
  // From 2024 the buyer may refuse another attempt when claiming a price reduction or cancelling.
  const avviser = u.retting === "forsokt" && f.presumsjonManeder === 24 && u.krav?.type ? ` ${JURIDISK.avviserNyttForsok}` : "";
  const start = `${frist}${historikk(input.feilen.kontakt, u, f)}${reklamerer}${avviser}`;
  if (!harFatt(u.retting)) {
    return `${start} Jeg krever at dere retter mangelen for egen regning innen rimelig tid, jf. § 29 og § 30. Retting skal skje uten kostnad og uten vesentlig ulempe for meg.`;
  }
  if (u.krav?.type === "heving") {
    const sum = input.bilOgKjop.kjopesumNok != null ? kroner(input.bilOgKjop.kjopesumNok) : "[kjøpesum]";
    return `${start} Jeg hever kjøpet, jf. § 32, og krever kjøpesummen på ${sum} tilbakebetalt mot at bilen leveres tilbake. ${JURIDISK.vesentlig(f.presumsjonManeder)} ${JURIDISK.hevingSubsidiart(u.krav.utbedringNok)} ${JURIDISK.renteHeving(r?.dato ?? null)}`;
  }
  if (u.krav?.type === "prisavslag") {
    // What the amount stands for: the cost of the repair the buyer had done, the loss in value for wrong
    // mileage or hidden damage, or else what it costs to have the defect repaired.
    const verditap = f.feilgrupper.length > 0 && f.feilgrupper.every((g) => g[0] === "km_avvik" || g[0] === "kollisjonsskade");
    const grunnlag = u.retting === "reparert_selv" ? "som er det reparasjonen kostet" : verditap ? "som tilsvarer verditapet" : "som tilsvarer kostnaden ved å få mangelen rettet";
    const avslag = u.krav.utbedringNok
      ? `${start} Jeg krever prisavslag på ${kroner(u.krav.utbedringNok)}, ${grunnlag}, jf. § 31.`
      : `${start} Jeg krever et forholdsmessig prisavslag, jf. § 31.`;
    return `${avslag} ${JURIDISK.rente(idag)}`;
  }
  return `${start} Jeg krever ${KRAV_ALTERNATIV}, jf. § 31 og § 32.`;
}

const UTGIFT: Record<Utgift["type"], string> = { verksted: "verksted og feilsøking", tauing: "tauing", leiebil: "leiebil", annet: "andre utgifter" };

// Costs claimed as damages (§ 33), and what the buyer reserves the right to claim later.
function erstatningOgForbehold(u: Utfylling, idag: string): string {
  const utgifter = u.krav?.utgifter ?? [];
  const sum = utgifter.reduce((s, x) => s + x.belopNok, 0);
  const erstatning = utgifter.length
    ? `I tillegg krever jeg erstatning for utgiftene mangelen har påført meg, jf. § 33: ${liste(utgifter.map((x) => `${x.type === "annet" && x.beskrivelse ? x.beskrivelse : UTGIFT[x.type]} ${kroner(x.belopNok)}`))}${utgifter.length > 1 ? `, til sammen ${kroner(sum)}` : ""}. `
    : "";
  const konto = kreverPenger(u) && u.avsender?.kontonummer ? `Beløpet bes innbetalt til kontonummer ${kontonummerGruppert(u.avsender.kontonummer)}. ` : "";
  // The claim paragraph carries the interest on a price reduction, which covers what the dealer owes; with
  // cancelling it covers only the price, so costs get their own.
  const rente = utgifter.length && !(harFatt(u.retting) && u.krav?.type === "prisavslag") ? `${JURIDISK.rente(idag)} ` : "";
  if (harFatt(u.retting)) {
    return `${erstatning}${rente}${konto}${utgifter.length ? "Jeg forbeholder meg retten til å kreve erstatning for ytterligere tap." : "Jeg forbeholder meg også retten til erstatning for mitt økonomiske tap etter § 33."}`;
  }
  return `${erstatning}${rente}${konto}Dersom retting ikke skjer innen rimelig tid, forbeholder jeg meg retten til å kreve prisavslag eller heving av kjøpet etter § 31 og § 32, samt ${utgifter.length ? "ytterligere erstatning" : "erstatning for mitt økonomiske tap"} etter § 33.${konto}`;
}

// Does the letter claim money now: a price reduction or cancelling once the dealer has had its try, or
// costs as damages?
export const kreverPenger = (u: Utfylling) => (harFatt(u.retting) && u.krav?.type !== undefined) || (u.krav?.utgifter.length ?? 0) > 0;

export const VEDLEGG_NAVN: Record<Vedlegg, string> = {
  kjopekontrakt: "kjøpekontrakt",
  verkstedrapport: "verkstedrapport",
  faktura: "faktura for reparasjonen",
  tilbud: "pristilbud eller takst",
  bilder: "bilder av feilen",
  annonse: "annonsen",
  meldinger: "meldinger mellom oss",
  kvitteringer: "kvitteringer",
};

// What the letter rests on and so should be enclosed: the contract, the report, the invoice for a repair
// elsewhere, the ad or messages where something untrue was said or the complaint was made, and receipts
// for costs claimed.
export function vedleggBrevetByggerPa(input: KlageInput, u: Utfylling): Vedlegg[] {
  const trengs = new Set<Vedlegg>(["kjopekontrakt"]);
  if (input.bevis.verkstedrapport) trengs.add("verkstedrapport");
  const retting = gyldigRetting(input.feilen.kontakt, u.retting);
  if (retting === "reparert_selv") trengs.add("faktura");
  // An amount claimed before a repair rests on a quote or a valuation.
  else if (harFatt(retting) && u.krav?.type && u.krav.utbedringNok) trengs.add("tilbud");
  if (input.feilen.feilOpplysning !== "nei" && u.opplysning?.kilde === "annonse") trengs.add("annonse");
  if (input.feilen.feilOpplysning !== "nei" && u.opplysning?.kilde === "melding") trengs.add("meldinger");
  if (input.feilen.kontakt === "ja" && (u.reklamasjon?.mate === "epost" || u.reklamasjon?.mate === "sms" || u.reklamasjon?.mate === "brev")) trengs.add("meldinger");
  // The invoice for a repair elsewhere already documents a workshop cost; other costs need receipts.
  const reparert = trengs.has("faktura");
  if ((u.krav?.utgifter ?? []).some((x) => !(reparert && x.type === "verksted"))) trengs.add("kvitteringer");
  return VEDLEGG_REKKEFOLGE.filter((v) => trengs.has(v));
}
const VEDLEGG_REKKEFOLGE = Object.keys(VEDLEGG_NAVN) as Vedlegg[];

// What the buyer says is enclosed. Until they have chosen, it is what the letter rests on, and pictures
// when the assessment said there are some.
export function vedleggFor(input: KlageInput, u: Utfylling): Vedlegg[] {
  if (u.vedlegg) return u.vedlegg;
  const forslag = new Set(vedleggBrevetByggerPa(input, u));
  if (input.bevis.bilder) forslag.add("bilder");
  return VEDLEGG_REKKEFOLGE.filter((v) => forslag.has(v));
}

// The answers do not hold the vehicle; its first registration comes from the registry lookup.
const medBilAr = (input: KlageInput, u: Utfylling): KlageInput =>
  u.kjoretoy?.ar ? { ...input, bilOgKjop: { ...input.bilOgKjop, bilAr: u.kjoretoy.ar } } : input;

// The decision the letter cites: the same choice as the assessment's, from the same facts.
export function henvisningFor(input: KlageInput, idag: string, u: Utfylling): ValgtHenvisning | null {
  return velgHenvisning(beregnFaktorer(medBilAr(input, u), idag));
}

// The letter from the answers of the assessment and what the buyer has filled in on the letter
// page. Whatever is not filled in yet is a placeholder in square brackets.
export function byggBrev(
  input: KlageInput,
  idag = iDag(),
  utfylt: Utfylling = {},
): Brev {
  const f = beregnFaktorer(input, idag);
  const henvisning = henvisningFor(input, idag, utfylt);
  // An answer about the repair that no longer fits the contact answer is not used.
  const u: Utfylling = {
    ...utfylt,
    retting: gyldigRetting(input.feilen.kontakt, utfylt.retting),
  };
  const { kjoretoy, forhandler, avsender } = u;
  const bil =
    kjoretoy &&
    `${kjoretoy.merke} ${kjoretoy.modell}${kjoretoy.ar ? ` (${kjoretoy.ar})` : ""}`;
  const orgnrLinje =
    forhandler?.type === "brreg"
      ? `Org.nr. ${gruppert(forhandler.orgnr)}`
      : null;
  const adresse = forhandler?.adresse;
  const adresseLinjer = adresse ? [...adresse.linjer, `${adresse.postnummer} ${adresse.poststed}`] : [];
  const avsenderLinjer = avsender
    ? [avsender.navn, avsender.adresse, `${avsender.postnummer} ${avsender.poststed}`, ...(avsender.telefon ? [`Tlf. ${avsender.telefon}`] : []), ...(avsender.epost ? [`E-post: ${avsender.epost}`] : [])]
    : [];
  const vedlagt = vedleggFor(input, u);
  return {
    avsender: avsender ? avsenderLinjer : ["[Ditt navn]", "[Din adresse]", "[Postnummer og sted]"],
    mottaker: [forhandler?.navn.trim() || "[Forhandlerens navn]", ...(orgnrLinje ? [orgnrLinje] : []), ...(adresse ? adresseLinjer : ["[Forhandlerens adresse]", "[Postnummer og sted]"])],
    stedDato: `${avsender?.poststed ?? "[Sted]"}, ${norskDato(idag)}`,
    emne: kjoretoy ? `Reklamasjon på mangel – ${bil}, reg.nr. ${kjoretoy.regnr}` : "Reklamasjon på mangel – [merke og modell], reg.nr. [reg.nr.]",
    avsnitt: [
      ...kjopetOgFeilen(input, u),
      mangelOgBevisbyrde(input, idag, u),
      ...(henvisning ? [JURIDISK.henvisning(henvisning, f)] : []),
      ...innvendinger(input, f, u),
      krav(input, f, u, idag),
      erstatningOgForbehold(u, idag),
      `Jeg ber om skriftlig svar innen ${SVARFRIST_DAGER} dager fra dette brevets dato, det vil si innen ${norskDato(plussDager(idag, SVARFRIST_DAGER))}${avsender?.epost ? `, gjerne på e-post til ${avsender.epost}` : ""}. Får jeg ikke svar innen fristen, eller avviser dere kravet, vil jeg klage saken inn til Forbrukertilsynet for mekling og eventuelt behandling i Forbrukerklageutvalget.`,
      ...(vedlagt.length ? [`Vedlagt følger ${liste(vedlagt.map((v) => VEDLEGG_NAVN[v]))}.`] : []),
    ],
    hilsen: "Med vennlig hilsen",
    underskrift: avsender?.navn ?? "[Ditt navn]",
  };
}
