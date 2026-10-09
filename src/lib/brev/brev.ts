import type { Faktorer } from "@/lib/vurdering/faktorer";
import { grupperFor, type Faktum, type Gruppe, type Henvisning, type Opplyst, type Sporsmal, type ValgtHenvisning } from "@/lib/vurdering/henvisninger";
import { gyldigRetting, type KlageInput, type Retting } from "@/lib/vurdering/typer";
import { fordelNavn, moment } from "./momenter";
import type { Forbehold, Reparasjon, Utfylling, Utgift, Vedlegg } from "./utfylling";

// The complaint letter as data, and what the written letter (src/lib/brev/skriving/) shares with the
// rest of the app: the legal wording the plan rests on (`JURIDISK`), the parts around the paragraphs
// (`brevhode`), the attachments, and formatting. A placeholder in square brackets is something still
// missing.

const gruppert = (orgnr: string) => orgnr.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

export type Brevdel = { overskrift: string | null; avsnitt: string[] };
export type Brev = {
  avsender: string[];
  mottaker: string[];
  stedDato: string;
  emne: string;
  // The body in parts, each under its heading (none for the opening part); see `DELER` in skriving/brevplan.ts.
  deler: Brevdel[];
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
      ? "Selv om bilen ble solgt «som den er», har den en mangel når den er i dårligere stand enn jeg med rimelighet hadde grunn til å forvente ut fra forbeholdet, kjøpesummen og forholdene ellers, jf. forbrukerkjøpsloven § 17 første ledd bokstav a slik den lød da vi inngikk avtalen."
      : `Et alminnelig forbehold om at bilen selges «som den er», har ingen virkning overfor meg som forbruker, jf. § 15 andre ledd og § 3.${visste ? "" : " Jeg godtok ikke feilen uttrykkelig og særskilt ved kjøpet."}`;
  if (forbehold === "garanti") return "Ved kjøpet ga dere garanti. Garantien kommer i tillegg til mine rettigheter etter forbrukerkjøpsloven og innskrenker dem ikke, jf. § 18 a, jf. § 3.";
  return null;
}

// What the committee took a position on, as the letter states it; keyed by the questions shared with the
// buyer, main question first (`ValgtHenvisning.sporsmal`).
const SPORSMAL_TEKST: Record<string, string> = {
  forventning: "om bilen var i dårligere stand enn kjøperen hadde grunn til å forvente ut fra alder, kilometerstand og pris, eller om feilen var normal slitasje",
  opplysning: "om forhandleren hadde gitt uriktige eller mangelfulle opplysninger om bilen",
  "forventning+levering": "om en feil som viser seg lenge etter kjøpet, likevel skyldes forhold som var der ved leveringen, slik at bilen ikke svarer til det kjøperen hadde grunn til å forvente",
  "opplysning+levering": "om forhandleren hadde gitt uriktige eller mangelfulle opplysninger om bilen, og om feilen var der ved leveringen",
};
const KORT_SPORSMAL: Record<Sporsmal, string> = { forventning: "hva kjøperen kunne forvente av bilen", opplysning: "hva forhandleren opplyste om bilen", levering: "om feilen var der ved leveringen" };
export const GRUPPE_NAVN: Record<Gruppe, string> = {
  motor: "motoren",
  elektrisk: "det elektriske anlegget",
  understell: "understellet",
  km_service: "kilometerstand og servicehistorikk",
  rust: "rust",
  bremser: "bremsene",
  girkasse: "girkassen",
  fukt: "fukt og lekkasje",
  klimaanlegg: "klimaanlegget",
  skade: "en tidligere skade",
  batteri: "batteriet",
};
const OPPLYST_VEDTAK: Record<Opplyst, string> = { ingenting: "Forhandleren hadde ikke opplyst om feilen.", som_den_er: "Bilen var solgt «som den er».", feilen_opplyst: "Forhandleren hadde opplyst om forholdet før kjøpet." };
// What was disclosed is stated as the fact it is, by what the other case had: the buyer is stronger when
// the decision's car was sold «som den er» or the defect disclosed, weaker when the buyer's was.
const STERKERE: Record<Faktum, (h: Henvisning) => string> = {
  alder: () => "en nyere bil",
  km: () => "kortere kjørelengde",
  pris: () => "en dyrere bil",
  opplyst: (h) => (h.opplyst === "feilen_opplyst" ? "feilen var ikke opplyst før kjøpet" : "bilen ble ikke solgt «som den er»"),
  tid: () => "feilen viste seg tidligere etter kjøpet",
};
const SVAKERE: Record<Faktum, (f: Faktorer) => string> = {
  alder: () => "Min bil var eldre enn bilen i vedtaket.",
  km: () => "Min bil hadde gått lenger enn bilen i vedtaket.",
  pris: () => "Min bil kostet mindre enn bilen i vedtaket.",
  opplyst: (f) => (f.opplyst === "ja_verre" ? "I min sak var feilen delvis kjent før kjøpet." : f.opplyst !== "nei" ? "I min sak var feilen opplyst før kjøpet." : "I min sak ble bilen solgt «som den er»."),
  tid: () => "Feilen viste seg senere etter kjøpet i min sak enn i vedtaket.",
};

export const JURIDISK = {
  hevingSubsidiart: (utbedringNok?: number) =>
    utbedringNok ? `Dersom dere ikke godtar heving, krever jeg subsidiært prisavslag på ${kroner(utbedringNok)}, jf. § 31.` : "Dersom dere ikke godtar heving, krever jeg subsidiært et forholdsmessig prisavslag, jf. § 31.",
  // Interest runs from 30 days after a written demand is sent (forsinkelsesrenteloven § 2). The day the
  // letter is sent is not known, so no date is given.
  rente: `Jeg krever også forsinkelsesrente etter forsinkelsesrenteloven §§ 2 og 3 av beløpet fra ${RENTE_FORFALL_DAGER} dager etter at dette brevet er sendt, til betaling skjer.`,
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
    `${km !== undefined ? `Bilen hadde gått ${kroner(km).replace(/ kr$/, "")} km da jeg kjøpte den. ` : ""}${nevnerSlitasje ? "Slitasjen" : "Feilen"} går ut over det som kan ventes ut fra bilens alder, kilometerstand og pris, og er ikke ${nevnerSlitasje ? "normal" : "normal slitasje"}, jf. § 15.`,
  // Bilen is meant to last much longer than two years, so the deadline is five years (§ 27 second paragraph).
  femArsfrist: "Bilen er ment å vare vesentlig lenger enn to år, og fristen for å reklamere er derfor fem år, jf. § 27 andre ledd.",
  // Law first, then the decision, as a lawyer would cite it (spec 2026-10-08): the same legal question and a
  // consumer buying from a dealer; the facts of the decision, what the committee relied on and the outcome;
  // the buyer's case where it holds, from the stronger case to the weaker; and briefly what differs against
  // the buyer. No make, model or amounts awarded; the link goes on its own line at the end of the letter
  // (`render.ts`). «Minst like sterkt» only when the buyer has a favourable answer to every moment the
  // decision was won on. A case under the old rules cited for a purchase from 2024 says the change has not
  // made the rules less favourable to the buyer, where the change matters.
  henvisning: (v: ValgtHenvisning, f: Faktorer, kjoperTid: string | null) => {
    const h = v.henvisning;
    const kilde = `${h.ref} av ${norskDato(h.dato)}`;
    const sporsmal = SPORSMAL_TEKST[v.sporsmal.join("+")];
    const del1 =
      v.sammeSporsmal && sporsmal
        ? `I vedtak ${kilde} tok ${h.organ} stilling til det samme spørsmålet som denne saken gjelder: ${sporsmal}. Saken gjaldt en forbruker som kjøpte bil av en næringsdrivende forhandler.`
        : `I vedtak ${kilde} tok ${h.organ} stilling til om en bil hadde en mangel. Saken gjaldt en forbruker som kjøpte bil av en næringsdrivende forhandler.`;
    const km = (n: number) => kroner(n).replace(/ kr$/, "");
    const pris = [...v.sterkere, ...v.svakere].includes("pris") ? `, for ${kroner(h.pris)}` : "";
    const del2 = `Bilen var ${h.alder} år gammel${h.km !== null ? ` og hadde gått ${km(h.km)} km` : ""} da den ble kjøpt${pris}. ${OPPLYST_VEDTAK[h.opplyst]} ${medPunktum(`${h.feil.charAt(0).toUpperCase()}${h.feil.slice(1)} viste seg ${h.tid}`)} ${medPunktum(h.begrunnelse)} Kjøperen fikk ${utenPunktum(h.utfall)}.`;
    const bil = [f.bilAlder !== null && `var ${f.bilAlder} år gammel`, f.kmVedKjop !== null && `hadde gått ${km(f.kmVedKjop)} km`, f.kjopesumNok !== null && `kostet ${kroner(f.kjopesumNok)}`].filter(Boolean);
    const fakta = [bil.length > 0 && `bilen ${bil.join(", ")}`, kjoperTid && `feilen viste seg ${kjoperTid}`].filter(Boolean).join(", ");
    const minSak = fakta ? ` Min sak: ${fakta}.` : "";
    const sammenligning = v.sterkere.length ? ` Sammenlignet med vedtaket: ${v.sterkere.map((x) => STERKERE[x](h)).join(", ")}.` : "";
    // Only when nothing was disclosed in either case: «heller ikke» would be untrue of a disclosed defect.
    const likt = v.likt.includes("opplyst") && h.opplyst === "ingenting" ? " Feilen var heller ikke opplyst før kjøpet." : "";
    const dekket = v.dekket.map((id) => moment(id)).filter((mo) => mo !== undefined).map((mo) => fordelNavn(mo).toLowerCase());
    // Only with something to point to: a decision won on no listed moment proves nothing «at least as strong».
    const del3 =
      v.mangler.length === 0 && v.ukjent.length === 0 && dekket.length > 0
        ? `De samme momentene trekker minst like sterkt i min sak. Gjenta i én setning det konkrete i saken som svarer til: ${dekket.join(", ")}; vis ikke til at det står ovenfor.${minSak}${sammenligning}${likt}`
        : `${minSak}${sammenligning}${likt} Skriv ikke at momentene trekker like sterkt.`.trim();
    const lov =
      f.presumsjonManeder === 24 && f.oppdaget !== "innen_6_mnd" && h.lov === "før_2024"
        ? ` Vedtaket gjelder et kjøp før lovendringen 1. januar 2024${h.presumsjon ? ", da formodningsperioden i § 18 var seks måneder; den er nå to år" : ""}. Reglene vedtaket bygger på, er ikke endret til kjøperens ugunst.`
        : "";
    const grupper = grupperFor(f);
    // «The same question» only when the decision shares one with the buyer (not the fallback).
    const sisteSporsmal = v.sporsmal.at(-1);
    const annen =
      v.annenFeil && grupper[0]
        ? ` Vedtaket gjaldt ${GRUPPE_NAVN[h.gruppe]} og ikke ${GRUPPE_NAVN[grupper[0]]}${sisteSporsmal ? `, men spørsmålet er det samme: ${KORT_SPORSMAL[sisteSporsmal]}` : ""}.`
        : "";
    const del4 = `${v.svakere.map((x) => ` ${SVAKERE[x](f)}`).join("")}${annen}${lov}`.trim();
    return [del1, del2, del3, del4 && `Kort, uten motargument: ${del4}`].filter(Boolean).join("\n\n");
  },
} as const;

// A firm's name as the buyer typed it, with the form of organisation at its end in capitals («Hompen bil
// as» → «Hompen bil AS»). The rest is left alone: whether it is «Bil» or «bil» is not ours to know.
export const foretaksform = (navn: string) => navn.replace(/\s(asa|as|ans|da|enk|sa)\.?$/i, (_, f: string) => ` ${f.toUpperCase()}`);

// Does the letter still have something to fill in? Placeholders are written in square brackets.
export const harPlassholder = (b: Brev) => [...b.avsender, ...b.mottaker, b.stedDato, b.emne, ...b.deler.flatMap((d) => d.avsnitt), b.underskrift].some((t) => /\[[^\]]+\]/.test(t));

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
  tilbud: "kostnadsoverslag",
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
  // Only when the buyer has said something untrue was said (not answered is not a yes).
  const villedet = input.feilen.feilOpplysning !== undefined && input.feilen.feilOpplysning !== "nei";
  if (villedet && u.opplysning?.kilde === "annonse") trengs.add("annonse");
  if (villedet && u.opplysning?.kilde === "melding") trengs.add("meldinger");
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

// The parts of the letter around its paragraphs: sender, recipient, place and date, subject and
// signature. The written letter's paragraphs go between them (`skriving/render.ts`).
export function brevhode(u: Utfylling, idag: string): Omit<Brev, "deler"> {
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
    mottaker: [(forhandler?.navn.trim() && foretaksform(forhandler.navn.trim())) || "[Forhandlerens navn]", ...(orgnrLinje ? [orgnrLinje] : []), ...(adresse ? adresseLinjer : ["[Forhandlerens adresse]", "[Postnummer og sted]"])],
    stedDato: `${avsender?.poststed ?? "[Sted]"}, ${norskDato(idag)}`,
    emne: kjoretoy ? `Reklamasjon på mangel – ${bil}, reg.nr. ${kjoretoy.regnr}` : "Reklamasjon på mangel – [merke og modell], reg.nr. [reg.nr.]",
    hilsen: "Med vennlig hilsen",
    underskrift: avsender?.navn ?? "[Ditt navn]",
  };
}
