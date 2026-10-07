import { beregnFaktorer, type Faktorer } from "@/lib/vurdering/faktorer";
import { HENVISNINGER, velgHenvisning, type ValgtHenvisning } from "@/lib/vurdering/henvisninger";
import { gyldigRetting, type KlageInput, type Retting } from "@/lib/vurdering/typer";
import type { Forbehold, Reparasjon, Utfylling, Utgift, Vedlegg } from "./utfylling";

// The complaint letter as data, and what the written letter (src/lib/brev/skriving/) shares with the
// rest of the app: the legal wording the plan rests on (`JURIDISK`), the parts around the paragraphs
// (`brevhode`), the attachments, and formatting. A placeholder in square brackets is something still
// missing.

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

export const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
// How long the dealer gets to answer.
export const SVARFRIST_DAGER = 14;
// Interest on late payment runs from 30 days after a written demand (forsinkelsesrenteloven § 2).
export const RENTE_FORFALL_DAGER = 30;
// § 27 (1): a complaint within two months of discovering the defect is always in time.
export const REKLAMASJON_ALLTID_I_TIDE_MANEDER = 2;

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

export function liste(ledd: string[]): string {
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
  // Interest runs from 30 days after a written demand is sent (forsinkelsesrenteloven § 2). The day the
  // letter is sent is not known, so no date is given.
  rente: `Jeg krever også forsinkelsesrente etter forsinkelsesrenteloven §§ 2 og 3 av det beløpet dere skylder meg, fra ${RENTE_FORFALL_DAGER} dager etter at dette brevet er sendt, til betaling skjer.`,
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

// A quote ends inside the sentence that carries it, so its own full stop goes.
export const utenSluttegn = (t: string) => t.replace(/[.!?]+$/, "");

// The dealer may try to repair first (§ 29). Once the dealer has refused or tried without success,
// the buyer can go on to a price reduction or cancelling (§§ 31 and 32). The form does not ask how
// serious the defect is, so the choice between the two is the buyer's, made on the letter page.
export const harFatt = (retting: Retting | undefined) =>
  retting === "avvist" || retting === "forsokt" || retting === "ikke_rettet" || retting === "reparert_selv";

export const UTGIFT: Record<Utgift["type"], string> = { verksted: "verksted og feilsøking", tauing: "tauing", leiebil: "leiebil", annet: "andre utgifter" };

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

// The decision the letter cites: the same choice as the assessment's, from the same facts, and never
// one from after the letter's date (as in `planlegg`).
export function henvisningFor(input: KlageInput, idag: string, u: Utfylling): ValgtHenvisning | null {
  return velgHenvisning(beregnFaktorer(medBilAr(input, u), idag), HENVISNINGER.filter((h) => h.dato <= idag));
}

// The parts of the letter around its paragraphs: sender, recipient, place and date, subject and
// signature. The written letter's paragraphs go between them (`skriving/render.ts`).
export function brevhode(u: Utfylling, idag: string): Omit<Brev, "avsnitt"> {
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
  return {
    avsender: avsender ? avsenderLinjer : ["[Ditt navn]", "[Din adresse]", "[Postnummer og sted]"],
    mottaker: [forhandler?.navn.trim() || "[Forhandlerens navn]", ...(orgnrLinje ? [orgnrLinje] : []), ...(adresse ? adresseLinjer : ["[Forhandlerens adresse]", "[Postnummer og sted]"])],
    stedDato: `${avsender?.poststed ?? "[Sted]"}, ${norskDato(idag)}`,
    emne: kjoretoy ? `Reklamasjon på mangel – ${bil}, reg.nr. ${kjoretoy.regnr}` : "Reklamasjon på mangel – [merke og modell], reg.nr. [reg.nr.]",
    hilsen: "Med vennlig hilsen",
    underskrift: avsender?.navn ?? "[Ditt navn]",
  };
}
