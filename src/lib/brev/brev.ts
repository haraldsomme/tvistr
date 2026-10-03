import { beregnFaktorer, iDag, type Faktorer } from "@/lib/vurdering/faktorer";
import { NAAR } from "@/lib/vurdering/grunnlag";
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

const FEIL_PLASSHOLDER = "[Beskriv feilen: når den viste seg, hva som skjer, og hva verkstedet har funnet.]";
const KRAV_ALTERNATIV = "[prisavslag / heving av kjøpet]";
const OPPLYSNING_PLASSHOLDER = "[Skriv hva annonsen eller selgeren opplyste som ikke stemte.]";

export function norskDato(iso: string): string {
  const [ar, maned, dag] = iso.split("-").map(Number);
  return `${dag}. ${MANEDER[maned - 1]} ${ar}`;
}

function pluss14(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + SVARFRIST_DAGER);
  return d.toISOString().slice(0, 10);
}

const kroner = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

function liste(ledd: string[]): string {
  return ledd.length <= 1 ? (ledd[0] ?? "") : `${ledd.slice(0, -1).join(", ")} og ${ledd[ledd.length - 1]}`;
}

const medPunktum = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);

// Legal wording that goes beyond restating a rule in the form: in one place so a lawyer can read it.
// Not reviewed by a lawyer yet.
const FORBEHOLD_AVSNITT: Record<Forbehold, string | null> = {
  som_den_er:
    "Selv om bilen ble solgt «som den er», fritar ikke det dere for ansvar overfor meg som forbruker. Et slikt forbehold kan ikke innskrenke rettighetene mine etter forbrukerkjøpsloven, jf. § 3.",
  garanti: "Garantien dere ga kommer i tillegg til rettighetene mine etter forbrukerkjøpsloven, og innskrenker dem ikke, jf. § 3.",
  ingen: null,
  vet_ikke: null,
};

export const JURIDISK = {
  hevingSubsidiart: (utbedringNok?: number) =>
    utbedringNok ? `Dersom dere ikke godtar heving, krever jeg subsidiært prisavslag på ${kroner(utbedringNok)}, jf. § 31.` : "Dersom dere ikke godtar heving, krever jeg subsidiært et forholdsmessig prisavslag, jf. § 31.",
  rente: "Jeg krever også forsinkelsesrente etter forsinkelsesrenteloven §§ 2 og 3 av det beløpet dere skylder meg, fra forfall til betaling skjer.",
  forbehold: FORBEHOLD_AVSNITT,
  slitasje: (km?: number) =>
    `Jeg bestrider at feilen er normal slitasje. ${km !== undefined ? `Bilen hadde gått ${kroner(km).replace(/ kr$/, "")} km da jeg kjøpte den, og ` : ""}feilen er mer omfattende enn jeg med rimelighet kunne vente ut fra bilens alder, kilometerstand og pris, jf. § 15.`,
  lignende: "Jeg viser til Forbrukerklageutvalgets behandling av lignende saker.",
} as const;

// Does the letter still have something to fill in? Placeholders are written in square brackets.
export const harPlassholder = (b: Brev) => [...b.avsender, ...b.mottaker, b.stedDato, b.emne, ...b.avsnitt, b.underskrift].some((t) => /\[[^\]]+\]/.test(t));

// A decision the buyer cites, resolved from the database (see mappe/hent.ts).
export type LignendeRef = { saksnummer: string; ar: number; utfall: "medhold" | "delvis_medhold"; moment: string; kildeUrl: string };

const UTFALL_TEKST = { medhold: "medhold", delvis_medhold: "delvis medhold" } as const;

function lignendeAvsnitt(refs: LignendeRef[]): string[] {
  if (refs.length === 0) return [];
  return [`${JURIDISK.lignende} ${refs.map((r) => `Sak ${r.saksnummer} (${r.ar}, ${UTFALL_TEKST[r.utfall]}): ${medPunktum(r.moment)}`).join(" ")}`];
}

function innvendinger(input: KlageInput, f: Faktorer, u: Utfylling): string[] {
  const ledd: string[] = [];
  const forbehold = u.forbehold && JURIDISK.forbehold[u.forbehold];
  if (forbehold) ledd.push(forbehold);
  if (f.slitasjeAktuelt) ledd.push(JURIDISK.slitasje(input.bilOgKjop.kmVedKjop));
  return ledd.length ? [ledd.join(" ")] : [];
}

function kjopetOgFeilen(input: KlageInput, u: Utfylling): string {
  const { kjopsdato, kjopesumNok } = input.bilOgKjop;
  const sum = kjopesumNok != null ? kroner(kjopesumNok) : "[kjøpesum]";
  const kjopet = `Jeg viser til kjøp av ovennevnte bil fra dere ${kjopsdato ? norskDato(kjopsdato) : "[kjøpsdato]"} for ${sum}.`;
  if (u.feilen) return `${kjopet} Feilen viste seg første gang ${norskDato(u.feilen.dato)}. ${medPunktum(u.feilen.tekst)}`;
  const feil = [...new Set(input.feilen.typer)].map((t) => FEIL_I_SETNING[t]).filter((t): t is string => t !== null);
  const feilen = feil.length > 0 ? `Bilen har feil ved ${liste(feil)}.` : "Bilen har en feil.";
  return `${kjopet} ${feilen} ${FEIL_PLASSHOLDER}`;
}

const OPPLYSNING_KILDE: Record<Opplysning["kilde"], string> = {
  annonse: "I annonsen",
  kontrakt: "I kjøpekontrakten",
  melding: "I en melding fra dere",
  muntlig: "Muntlig før kjøpet",
};

function mangelOgBevisbyrde(input: KlageInput, idag: string, u: Utfylling): string {
  const f = beregnFaktorer(input, idag);
  const setninger = ["Bilen har etter dette en mangel etter forbrukerkjøpsloven § 16."];
  if (f.presumsjon) {
    const periode = f.presumsjonManeder === 24 ? "to år" : "seks måneder";
    setninger.push(
      `Feilen viste seg ${NAAR[f.oppdaget]} etter levering, og det følger da av § 18 at en mangel som viser seg innen ${periode} antas å ha eksistert ved leveringen, med mindre dere beviser noe annet.`,
    );
  } else {
    setninger.push(`Feilen viste seg ${NAAR[f.oppdaget]} etter levering.`);
  }
  // The buyer answered that the ad or the dealer said something that was not true.
  if (input.feilen.feilOpplysning !== "nei") {
    setninger.push(
      u.opplysning
        ? `${OPPLYSNING_KILDE[u.opplysning.kilde]} ble det opplyst følgende om bilen: «${u.opplysning.tekst.replace(/[.!?]+$/, "")}». Dette stemmer ikke, og bilen svarer dermed ikke til opplysningene dere har gitt, jf. § 16.`
        : OPPLYSNING_PLASSHOLDER,
    );
  }
  if (input.feilen.opplystForKjop === "nei") setninger.push("Jeg ble heller ikke opplyst om feilen før kjøpet.");
  return setninger.join(" ");
}

// The dealer may try to repair first (§ 29). Once the dealer has refused or tried without success,
// the buyer can go on to a price reduction or cancelling (§§ 31 and 32). The form does not ask how
// serious the defect is, so the choice between the two is the buyer's, made on the letter page.
const harFatt = (retting: Retting | undefined) =>
  retting === "avvist" || retting === "forsokt" || retting === "reparert_selv";

const MATE: Record<Reklamasjon["mate"], string> = {
  epost: "på e-post",
  sms: "på SMS",
  telefon: "på telefon",
  oppmote: "ved oppmøte hos dere",
  brev: "i brev",
};
const GANGER = ["én gang", "to ganger", "tre ganger", "fire ganger", "fem ganger", "seks ganger", "sju ganger", "åtte ganger", "ni ganger"];

// What has happened between the buyer and the dealer so far. Empty when the dealer is not contacted.
function historikk(
  kontakt: KlageInput["feilen"]["kontakt"],
  retting: Retting | undefined,
  r: Reklamasjon | undefined,
): string {
  if (retting === "reparert_selv")
    return "Jeg har fått feilen utbedret hos et annet verksted. ";
  if (kontakt === "nei") return "";
  const forste =
    r &&
    `Jeg tok opp feilen med dere første gang ${norskDato(r.dato)} ${MATE[r.mate]}`;
  if (retting === "avvist")
    return forste
      ? `${forste}, men dere har avvist å rette den. `
      : "Jeg har tatt opp feilen med dere, men dere har avvist å rette den. ";
  if (retting === "forsokt") {
    const forsok = `Dere har forsøkt å rette feilen ${r?.forsok ? `${GANGER[r.forsok - 1]} ` : ""}uten å lykkes. `;
    return forste ? `${forste}. ${forsok}` : forsok;
  }
  return forste ? `${forste}. ` : "";
}

function krav(input: KlageInput, u: Utfylling): string {
  const start = `${historikk(input.feilen.kontakt, u.retting, u.reklamasjon)}Jeg reklamerer herved i medhold av forbrukerkjøpsloven § 27 og`;
  if (!harFatt(u.retting)) {
    return `${start} krever at dere retter mangelen for egen regning innen rimelig tid, jf. § 29 og § 30. Retting skal skje uten kostnad og uten vesentlig ulempe for meg.`;
  }
  if (u.krav?.type === "heving") {
    const sum = input.bilOgKjop.kjopesumNok != null ? kroner(input.bilOgKjop.kjopesumNok) : "[kjøpesum]";
    return `${start} hever kjøpet, jf. § 32, og krever kjøpesummen på ${sum} tilbakebetalt mot at bilen leveres tilbake. ${JURIDISK.hevingSubsidiart(u.krav.utbedringNok)} ${JURIDISK.rente}`;
  }
  if (u.krav?.type === "prisavslag") {
    const avslag = u.krav.utbedringNok
      ? `${start} krever prisavslag på ${kroner(u.krav.utbedringNok)}, som tilsvarer kostnaden ved å få mangelen rettet, jf. § 31.`
      : `${start} krever et forholdsmessig prisavslag, jf. § 31.`;
    return `${avslag} ${JURIDISK.rente}`;
  }
  return `${start} krever ${KRAV_ALTERNATIV}, jf. § 31 og § 32.`;
}

const UTGIFT: Record<Utgift["type"], string> = { verksted: "verksted og feilsøking", tauing: "tauing", leiebil: "leiebil", annet: "andre utgifter" };

// Costs claimed as damages (§ 33), and what the buyer reserves the right to claim later.
function erstatningOgForbehold(u: Utfylling): string {
  const utgifter = u.krav?.utgifter ?? [];
  const sum = utgifter.reduce((s, x) => s + x.belopNok, 0);
  const erstatning = utgifter.length
    ? `I tillegg krever jeg erstatning for utgiftene mangelen har påført meg, jf. § 33: ${liste(utgifter.map((x) => `${UTGIFT[x.type]} ${kroner(x.belopNok)}`))}${utgifter.length > 1 ? `, til sammen ${kroner(sum)}` : ""}. `
    : "";
  if (harFatt(u.retting)) {
    return `${erstatning}${utgifter.length ? "Jeg forbeholder meg retten til å kreve erstatning for ytterligere tap." : "Jeg forbeholder meg også retten til erstatning for mitt økonomiske tap etter § 33."}`;
  }
  return `${erstatning}Dersom retting ikke skjer innen rimelig tid, forbeholder jeg meg retten til å kreve prisavslag eller heving av kjøpet etter § 31 og § 32, samt ${utgifter.length ? "ytterligere erstatning" : "erstatning for mitt økonomiske tap"} etter § 33.`;
}

const VEDLEGG_NAVN: Record<Vedlegg, string> = {
  kjopekontrakt: "kjøpekontrakt",
  verkstedrapport: "verkstedrapport",
  bilder: "bilder av feilen",
  annonse: "annonsen",
  meldinger: "meldinger mellom oss",
  kvitteringer: "kvitteringer",
};

// What the buyer says is enclosed. Until they have chosen, it follows the evidence from the assessment.
export function vedleggFor(input: KlageInput, u: Utfylling): Vedlegg[] {
  if (u.vedlegg) return u.vedlegg;
  const { verkstedrapport, bilder } = input.bevis;
  return ["kjopekontrakt", ...(verkstedrapport ? (["verkstedrapport"] as const) : []), ...(bilder ? (["bilder"] as const) : [])];
}

// The letter from the answers of the assessment and what the buyer has filled in on the letter
// page. Whatever is not filled in yet is a placeholder in square brackets.
export function byggBrev(
  input: KlageInput,
  idag = iDag(),
  utfylt: Utfylling = {},
  lignende: LignendeRef[] = [],
): Brev {
  const f = beregnFaktorer(input, idag);
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
  const adresse = forhandler?.type === "brreg" ? forhandler.adresse : undefined;
  const adresseLinjer = adresse ? [...adresse.linjer, `${adresse.postnummer} ${adresse.poststed}`] : [];
  const avsenderLinjer = avsender ? [avsender.navn, avsender.adresse, `${avsender.postnummer} ${avsender.poststed}`, ...(avsender.telefon ? [`Tlf. ${avsender.telefon}`] : [])] : [];
  const vedlagt = vedleggFor(input, u);
  return {
    avsender: avsender ? avsenderLinjer : ["[Ditt navn]", "[Din adresse]", "[Postnummer og sted]"],
    mottaker: [forhandler?.navn.trim() || "[Forhandlerens navn]", ...(orgnrLinje ? [orgnrLinje] : []), ...(adresse ? adresseLinjer : ["[Forhandlerens adresse]", "[Postnummer og sted]"])],
    stedDato: `${avsender?.poststed ?? "[Sted]"}, ${norskDato(idag)}`,
    emne: kjoretoy ? `Reklamasjon på mangel – ${bil}, reg.nr. ${kjoretoy.regnr}` : "Reklamasjon på mangel – [merke og modell], reg.nr. [reg.nr.]",
    avsnitt: [
      kjopetOgFeilen(input, u),
      mangelOgBevisbyrde(input, idag, u),
      ...innvendinger(input, f, u),
      ...lignendeAvsnitt(lignende),
      krav(input, u),
      erstatningOgForbehold(u),
      `Jeg ber om skriftlig svar innen ${SVARFRIST_DAGER} dager fra dette brevets dato, det vil si innen ${norskDato(pluss14(idag))}. Hører jeg ikke fra dere innen fristen, vil jeg bringe saken inn for Forbrukerklageutvalget.`,
      ...(vedlagt.length ? [`Vedlagt følger ${liste(vedlagt.map((v) => VEDLEGG_NAVN[v]))}.`] : []),
    ],
    hilsen: "Med vennlig hilsen",
    underskrift: avsender?.navn ?? "[Ditt navn]",
  };
}
