import { leggTilManeder, maneder } from "@/lib/vurdering/faktorer";
import { NAAR } from "@/lib/vurdering/grunnlag";
import {
  harFatt,
  JURIDISK,
  kreverPenger,
  kroner,
  liste,
  norskDato,
  REKLAMASJON_ALLTID_I_TIDE_MANEDER,
  SVARFRIST_DAGER,
  UTGIFT,
  vedleggFor,
  VEDLEGG_NAVN,
} from "../brev";
import { besvarteMomenter } from "../momenter";
import { sjekkBrev, type Advarsel } from "../sjekk";
import { henvisningFor } from "./henvisning";
import { rensTekst, type Saksmodell } from "./saksmodell";

// The rules of the letter worked out in code before anything is written: what it must argue, in order,
// each with the legal wording it rests on (`foring`); what it must not argue; and what is missing and so
// stands as a placeholder. The author may word it freely but not change its legal content. Not reviewed
// by a lawyer.

export const ARGUMENT_IDER = [
  "innledning",
  "feilen",
  "mangel",
  "formodning",
  "tidspunkt",
  "rapport_bevis",
  "opplysning",
  "kjente_ikke",
  "momenter",
  "henvisning",
  "forbehold",
  "slitasje",
  "femarsfrist",
  "frist_overholdt",
  "historikk",
  "reklamasjon",
  "avviser_nytt_forsok",
  "krav_retting",
  "krav_heving",
  "krav_prisavslag",
  "krav_valg",
  "vesentlig",
  "subsidiaert_prisavslag",
  "rente_heving",
  "rente",
  "erstatning",
  "kontonummer",
  "forbehold_tap",
  "svarfrist",
  "vedlegg",
] as const;
export type ArgumentId = (typeof ARGUMENT_IDER)[number];

// The parts of the letter, in order, and the heading each stands under; the opening part has none and
// stands right under the subject line. Which part a paragraph belongs to follows from the arguments its
// sentences cover, so the author writes no headings and old letters get them too.
export const DELER = ["innledning", "faktum", "rettslig_grunnlag", "krav", "svarfrist", "vedlegg"] as const;
export type Del = (typeof DELER)[number];
export const OVERSKRIFT: Record<Del, string | null> = {
  innledning: null,
  faktum: "Faktum",
  rettslig_grunnlag: "Rettslig grunnlag",
  krav: "Krav",
  svarfrist: "Svarfrist og videre saksgang",
  vedlegg: "Vedlegg",
};
export const DEL_FOR_ARGUMENT: Record<ArgumentId, Del> = {
  innledning: "innledning",
  feilen: "faktum",
  tidspunkt: "faktum",
  kjente_ikke: "faktum",
  momenter: "faktum",
  historikk: "faktum",
  formodning: "rettslig_grunnlag",
  rapport_bevis: "rettslig_grunnlag",
  opplysning: "rettslig_grunnlag",
  forbehold: "rettslig_grunnlag",
  slitasje: "rettslig_grunnlag",
  mangel: "rettslig_grunnlag",
  henvisning: "rettslig_grunnlag",
  femarsfrist: "rettslig_grunnlag",
  frist_overholdt: "rettslig_grunnlag",
  reklamasjon: "rettslig_grunnlag",
  avviser_nytt_forsok: "krav",
  krav_retting: "krav",
  krav_heving: "krav",
  krav_prisavslag: "krav",
  krav_valg: "krav",
  vesentlig: "krav",
  subsidiaert_prisavslag: "krav",
  rente_heving: "krav",
  rente: "krav",
  erstatning: "krav",
  kontonummer: "krav",
  forbehold_tap: "krav",
  svarfrist: "svarfrist",
  vedlegg: "vedlegg",
};
// The part of a paragraph or sentence: that of the first argument it covers, or null for a plain transition.
export const delFor = (argumenter: readonly string[]): Del | null => {
  const id = argumenter.find((a): a is ArgumentId => a in DEL_FOR_ARGUMENT);
  return id ? DEL_FOR_ARGUMENT[id] : null;
};

export type Argument = { id: ArgumentId; foring: string; data: Record<string, unknown> };
export type Forbud = { id: ArgumentId; grunn: string };
// What is missing, as it stands in the placeholder «[MANGLER: tekst]», and the step that fills it in.
export type Mangel = { tekst: string; steg: string };
export type Kildehenvisning = { ref: string; organ: string; dato: string; kildeUrl: string };
export type Brevplan = {
  argumenter: Argument[];
  forbudt: Forbud[];
  mangler: Mangel[];
  henvisning: Kildehenvisning | null;
  // The marks the author may use besides quotes; filled in by `render.ts`.
  merker: string[];
  // The points of `sjekkBrev` about the case, not the text: the author must not contradict them.
  advarsler: Advarsel[];
};

export function planlegg(m: Saksmodell): Brevplan {
  const { input, faktorer: f, utfylling: u, idag, kjopsdato } = m;
  const argumenter: Argument[] = [];
  const forbudt: Forbud[] = [];
  const mangler: Mangel[] = [];
  const merker = ["dato:svarfrist"];
  const legg = (id: ArgumentId, foring: string, data: Record<string, unknown> = {}) => void argumenter.push({ id, foring, data });
  const forby = (id: ArgumentId, grunn: string) => void forbudt.push({ id, grunn });
  const mangel = (tekst: string, steg: string) => void mangler.push({ tekst, steg });
  // The plan is sent to the author: what the buyer typed is cleaned as the case is.
  const rens = (t: string) => rensTekst(t, m.kjente);
  const { kjopesumNok, kmVedKjop } = input.bilOgKjop;
  const kontakt = input.feilen.kontakt === "ja";
  const retting = u.retting;
  const r = kontakt ? u.reklamasjon : undefined;
  const utgifter = u.krav?.utgifter ?? [];
  // «Mangelen» or «manglene»: the letter speaks of as many defects as the buyer named.
  const flere = (u.feilen?.feil.length ?? 1) > 1;
  const mangelen = flere ? "manglene" : "mangelen";

  // Innledning and Faktum: the purchase, the defect, what the buyer knew and what has happened since.
  if (!input.bilOgKjop.kjopsdato) mangel("kjøpsdato", "kjopet");
  if (kjopesumNok == null) mangel("kjøpesum", "kjopet");
  legg("innledning", "Vis til kjøpet av bilen fra dere, med kjøpsdatoen og kjøpesummen.", { kjopsdato: input.bilOgKjop.kjopsdato ?? null, kjopesumNok: kjopesumNok ?? null });
  if (!u.feilen) mangel("beskrivelse av feilen: når den viste seg, hva som skjer, og hva verkstedet har funnet", "feilen");
  legg(
    "feilen",
    "Beskriv feilen ut fra kjøperens egne opplysninger, som nøkterne observasjoner: hva som skjer, når og hvor ofte, hva det betyr for bruken av bilen, og hva et verksted har funnet (gjengitt som verkstedets funn).",
    { forsteGang: u.feilen?.dato ?? null, antallFeil: u.feilen?.feil.length ?? null },
  );

  // Without the presumption, when the defect showed is a fact of its own; with it, it is the formodning.
  if (!f.presumsjon) legg("tidspunkt", `Feilen viste seg ${NAAR[f.oppdaget]} etter levering.`);
  if (input.feilen.opplystForKjop === "nei") legg("kjente_ikke", "Jeg kjente ikke til feilen da jeg kjøpte bilen, og dere opplyste ikke om den.");

  // The moments the buyer answered with an alternative: a favourable answer becomes an argument in the moment's own wording;
  // an unfavourable one is a weakness the author must not contradict.
  const gunstige: string[] = [];
  const svake: Advarsel[] = [];
  for (const { moment, svar: s, gunstig, egen } of besvarteMomenter(u.momenter, { vedKjop: kmVedKjop, vedFeil: u.kmVedFeil }, m.avklaringer)) {
    // The buyer's own words stand in the case (`forhold`) for the author, but argue nothing either way.
    if (egen) continue;
    const svar = rens(s);
    if (gunstig) gunstige.push(`${moment.navn}: ${moment.argument} Kjøperens svar: «${svar}».`);
    else svake.push({ id: `moment-${moment.id}`, tekst: `${moment.navn}: kjøperen svarte «${svar}».`, steg: moment.steg ?? null, alvor: "myk" });
  }
  if (gunstige.length) {
    legg(
      "momenter",
      `Forbrukerklageutvalget har lagt vekt på disse forholdene i lignende saker. Ta dem med som fakta der de hører hjemme, uten å argumentere ut fra dem. Plassholderne i parentes fylles med det kjøperen har svart; et svar som er et intervall, skrives som en øvre grense («under 5 000 km»); skriv ingenting kjøperen ikke har svart. ${gunstige.join(" ")}`,
    );
  } else forby("momenter", "Kjøperen har ikke gitt gunstige svar om forhold utvalget legger vekt på.");

  // What has happened between the buyer and the dealer, in the order it happened: events only; what they
  // mean under § 27 and § 30 stands in Rettslig grunnlag and Krav.
  const hendelser: string[] = [];
  if (kontakt) {
    if (!u.reklamasjon) mangel("dato og måte du tok opp feilen med forhandleren", "kontakt");
    hendelser.push("Når og hvordan jeg tok opp feilen med dere første gang.");
    if (retting === "avvist") hendelser.push("Dere avviste å rette feilen.");
    if (retting === "forsokt") hendelser.push("Dere har forsøkt å rette feilen uten å lykkes (antall forsøk og datoen for det siste forsøket står i dataene når de er kjent).");
    if (retting === "ikke_rettet") hendelser.push("Dere har ikke rettet feilen, selv om bilen har stått til rådighet for retting.");
    if (retting === "venter") hendelser.push("Feilen er ennå ikke rettet.");
  }
  if (retting === "reparert_selv") {
    if (u.reparasjon) hendelser.push(JURIDISK.reparasjon[u.reparasjon.grunn](norskDato(u.reparasjon.dato)));
    else mangel("dato for reparasjonen, og hvorfor forhandleren ikke rettet feilen", "kontakt");
  }
  if (kontakt || retting === "reparert_selv") {
    legg("historikk", `Fortell i tidsrekkefølge hva som har skjedd: ${hendelser.join(" ")}`.trim(), {
      forsteReklamasjon: r ? { dato: r.dato, mate: r.mate } : null,
      [retting === "forsokt" ? "sisteForsok" : "forhandlerensSvar"]: r?.svarDato ?? null,
      antallForsok: r?.forsok ?? null,
      retting: retting ?? null,
      reparasjon: retting === "reparert_selv" ? (u.reparasjon ?? null) : null,
    });
  } else forby("historikk", "Kjøperen har ikke tatt opp feilen med dere før, og bilen er ikke reparert andre steder.");

  // Rettslig grunnlag: the burden of proof and the information given; the conclusion that the car has a
  // defect comes after them, as a lawyer would put it, then the decision and the deadlines.
  if (f.presumsjon) {
    const periode = f.presumsjonManeder === 24 ? "to år" : "seks måneder";
    legg("formodning", `Feilen viste seg innen ${periode} etter levering og antas derfor å ha eksistert ved leveringen, med mindre dere beviser noe annet, jf. forbrukerkjøpsloven § 18 andre ledd.`, { periode });
  } else forby("formodning", "Feilen viste seg etter formodningsperioden i § 18 andre ledd.");
  if (f.rapportSierForKjop === true) {
    legg(
      "rapport_bevis",
      // With the report's own text, the letter says what it says, not what the buyer answered it says.
      m.kilder.rapport
        ? `En verksted- eller tilstandsrapport er limt inn. Gjengi eller siter bare det den faktisk sier om årsaken og om når feilen oppsto. Sier den ikke noe om tidspunktet, skriv ikke at den viser eller støtter at feilen var der da jeg overtok bilen${f.presumsjon ? "" : ", jf. § 18 første ledd"}.`
        : f.presumsjon
          ? "En verksted- eller tilstandsrapport støtter også at feilen var der allerede da jeg overtok bilen."
          : "En verksted- eller tilstandsrapport sier at feilen sannsynligvis var til stede før jeg overtok bilen, jf. § 18 første ledd.",
      { fra: u.rapport ? rens(u.rapport.fra) : null, dato: u.rapport?.dato ?? null, kanSiteres: Boolean(m.kilder.rapport) },
    );
  } else forby("rapport_bevis", "Ingen rapport sier at feilen var der før kjøpet.");
  if (input.feilen.feilOpplysning !== "nei") {
    if (!u.opplysning) mangel("hva annonsen eller selgeren opplyste som ikke stemte", "for-kjopet");
    legg("opplysning", "Det dere opplyste om bilen før kjøpet, var uriktig. Bilen svarer dermed ikke til de opplysningene dere ga, jf. § 16.", { kilde: u.opplysning?.kilde ?? null, kanSiteres: Boolean(m.kilder.opplysning) });
  } else forby("opplysning", "Kjøperen har ikke sagt at dere ga uriktige opplysninger.");

  // What the dealer may object.
  const forbehold = u.forbehold && JURIDISK.forbehold(u.forbehold, f.presumsjonManeder, input.feilen.opplystForKjop === "ja");
  if (forbehold) legg("forbehold", forbehold, { forbehold: u.forbehold });
  const nevnerSlitasje = /slit/i.test([u.rapport?.sitat ?? "", u.feilen?.egen ?? "", ...(u.feilen?.avsnitt ?? []), m.kilder.rapport ?? ""].join(" "));
  if (f.slitasjeAktuelt) legg("slitasje", JURIDISK.slitasje(kmVedKjop, nevnerSlitasje), { kmVedKjop: kmVedKjop ?? null });
  else forby("slitasje", "Feilen er ikke av en type slitasje kan forklare.");

  // The conclusion, after what it rests on.
  legg("mangel", `Bilen har etter dette ${flere ? "mangler" : "en mangel"} etter forbrukerkjøpsloven § 16${f.slitasjeAktuelt ? ", jf. § 15" : ""}.`);

  // The decision the letter cites (spec 2026-10-08); its source is a mark, the numbers of both cases are data.
  // Never a decision from after the letter's own date.
  const valgt = henvisningFor(m);
  let henvisning: Kildehenvisning | null = null;
  if (valgt) {
    const h = valgt.henvisning;
    henvisning = { ref: h.ref, organ: h.organ, dato: h.dato, kildeUrl: h.kildeUrl };
    merker.push("henvisning");
    // From the exact purchase date only: an estimated one would make the months up.
    const mnd = input.bilOgKjop.kjopsdato && u.feilen?.dato ? maneder(input.bilOgKjop.kjopsdato, u.feilen.dato) : null;
    const kjoperTid = mnd === null ? null : mnd < 1 ? "mindre enn en måned etter kjøpet" : `${mnd} ${mnd === 1 ? "måned" : "måneder"} etter kjøpet`;
    legg("henvisning", JURIDISK.henvisning(valgt, f, kjoperTid).replace(`${h.ref} av ${norskDato(h.dato)}`, "{{henvisning}}"), {
      vedtak: { alder: h.alder, km: h.km, pris: h.pris },
      kjoper: { alder: f.bilAlder, km: f.kmVedKjop, pris: f.kjopesumNok },
      dekket: valgt.dekket,
      mangler: valgt.mangler,
      ukjent: valgt.ukjent,
      sterkere: valgt.sterkere,
      svakere: valgt.svakere,
    });
  }

  // Deadlines. The two years run from delivery to the first complaint, or to this letter.
  const reklamert = r ? r.dato : idag;
  if (reklamert > leggTilManeder(kjopsdato, 24)) legg("femarsfrist", JURIDISK.femArsfrist);
  else forby("femarsfrist", "Reklamasjonen kommer innen to år etter levering.");
  if (f.femAarGatt && !f.fristUte) legg("frist_overholdt", "Det er mer enn fem år siden jeg overtok bilen, men jeg tok feilen opp med dere innen fem år, slik at fristen i § 27 andre ledd er overholdt.", { forsteReklamasjon: r?.dato ?? null });

  // The complaint itself: a first one, or the written confirmation of one already made (§ 27), with
  // whether it came within two months of the discovery.
  const iTide = !kontakt && u.feilen && idag <= leggTilManeder(u.feilen.dato, REKLAMASJON_ALLTID_I_TIDE_MANEDER);
  const komITide = kontakt && u.reklamasjon && u.feilen && u.reklamasjon.dato >= u.feilen.dato && u.reklamasjon.dato <= leggTilManeder(u.feilen.dato, REKLAMASJON_ALLTID_I_TIDE_MANEDER);
  legg(
    "reklamasjon",
    kontakt
      ? `${komITide ? "Reklamasjonen kom innen to måneder etter at jeg oppdaget feilen, jf. § 27 første ledd. " : ""}Med dette brevet bekrefter jeg reklamasjonen skriftlig.`
      : `Jeg reklamerer herved på ${mangelen}, jf. forbrukerkjøpsloven § 27${iTide ? ", innen to måneder etter at jeg oppdaget feilen" : ""}.`,
  );
  if (retting === "forsokt" && f.presumsjonManeder === 24 && u.krav?.type) legg("avviser_nytt_forsok", JURIDISK.avviserNyttForsok);

  // Krav. The dealer has the first try (§ 29); then a price reduction or cancelling (§§ 31, 32).
  if (!harFatt(retting)) {
    legg("krav_retting", `Jeg krever at dere retter ${mangelen} innen rimelig tid, uten kostnad og uten vesentlig ulempe for meg, jf. § 29 og § 30.`);
    for (const id of ["krav_heving", "krav_prisavslag", "krav_valg"] as const) forby(id, "Dere har ikke fått forsøke å rette feilen ennå (§ 29).");
  } else {
    forby("krav_retting", "Dere har allerede fått forsøke å rette feilen, eller den er reparert andre steder.");
    // Why the buyer may go past repair (§ 29): the dealer refused, failed or did not repair in time.
    const grunn = retting === "avvist" ? "Da dere har avvist å rette " : retting === "forsokt" ? "Da retting ikke har lykkes, " : retting === "ikke_rettet" ? "Da retting ikke har skjedd innen rimelig tid, jf. § 30, " : "";
    const grunnMedObjekt = retting === "avvist" ? `${grunn}${mangelen}, ` : grunn;
    if (u.krav?.type === "heving") {
      legg("krav_heving", `${grunnMedObjekt}${grunnMedObjekt ? "hever jeg" : "Jeg hever"} kjøpet, jf. § 32, og krever kjøpesummen${kjopesumNok != null ? ` på ${kroner(kjopesumNok)}` : ""} tilbakebetalt mot at bilen leveres tilbake.`, { kjopesumNok: kjopesumNok ?? null });
      legg("vesentlig", JURIDISK.vesentlig(f.presumsjonManeder));
      legg("subsidiaert_prisavslag", JURIDISK.hevingSubsidiart(u.krav.utbedringNok), { utbedringNok: u.krav.utbedringNok ?? null });
      legg("rente_heving", JURIDISK.renteHeving(r?.dato ?? null));
      forby("krav_prisavslag", "Kjøperen hever kjøpet; prisavslag kreves bare subsidiært.");
    } else if (u.krav?.type === "prisavslag") {
      const verditap = f.feilgrupper.length > 0 && f.feilgrupper.every((g) => g[0] === "km_avvik" || g[0] === "kollisjonsskade");
      const grunnlag = retting === "reparert_selv" ? "som er det reparasjonen kostet" : verditap ? "som tilsvarer verditapet" : `som tilsvarer kostnaden ved å få ${mangelen} rettet`;
      legg("krav_prisavslag", `${grunnMedObjekt}${grunnMedObjekt ? "krever jeg" : "Jeg krever"} ${u.krav.utbedringNok ? `prisavslag på ${kroner(u.krav.utbedringNok)}, ${grunnlag}` : "et forholdsmessig prisavslag"}, jf. § 31.`, { belopNok: u.krav.utbedringNok ?? null });
      legg("rente", JURIDISK.rente);
      forby("krav_heving", "Kjøperen har valgt prisavslag.");
    } else {
      mangel("prisavslag eller heving av kjøpet", "krav");
      legg("krav_valg", "Jeg krever prisavslag eller heving av kjøpet, jf. § 31 og § 32. Valget er ikke gjort, så plassholderen står der kravet skal stå.");
    }
  }

  // Costs as damages (§ 33). Interest covers them too, once.
  if (utgifter.length) {
    const sum = utgifter.reduce((s, x) => s + x.belopNok, 0);
    const poster = utgifter.map((x) => `${x.type === "annet" && x.beskrivelse ? rens(x.beskrivelse) : UTGIFT[x.type]} ${kroner(x.belopNok)}`);
    legg("erstatning", `I tillegg krever jeg erstatning for utgiftene ${mangelen} har påført meg, jf. § 33: ${liste(poster)}${utgifter.length > 1 ? `, til sammen ${kroner(sum)}` : ""}.`, { sumNok: sum });
    if (!argumenter.some((a) => a.id === "rente")) legg("rente", JURIDISK.rente);
  } else forby("erstatning", "Kjøperen krever ingen utgifter dekket.");
  if (kreverPenger(u) && u.avsender?.kontonummer) {
    merker.push("kontonummer");
    // The sum when the letter claims more than one amount and all of them are known.
    const deler = [u.krav?.type === "prisavslag" ? u.krav.utbedringNok : u.krav?.type === "heving" ? kjopesumNok : undefined, ...utgifter.map((x) => x.belopNok)].filter((x): x is number => x != null);
    const samlet = deler.length > 1 && deler.length === 1 + utgifter.length ? deler.reduce((s, x) => s + x, 0) : null;
    legg("kontonummer", samlet ? `Det samlede beløpet, ${kroner(samlet)}, bes innbetalt til kontonummer {{kontonummer}}.` : "Beløpet bes innbetalt til kontonummer {{kontonummer}}.", { samletNok: samlet });
  } else forby("kontonummer", "Brevet krever ikke penger nå, eller kontonummeret er ikke oppgitt.");
  legg(
    "forbehold_tap",
    harFatt(retting)
      ? utgifter.length
        ? "Jeg forbeholder meg retten til å kreve erstatning for ytterligere tap."
        : "Jeg tar forbehold om å kreve erstatning for mitt økonomiske tap etter § 33."
      : `Skjer retting ikke innen rimelig tid, tar jeg forbehold om å kreve prisavslag eller heving av kjøpet etter § 31 og § 32, og ${utgifter.length ? "ytterligere erstatning" : "erstatning for mitt økonomiske tap"} etter § 33.`,
  );

  // Svarfrist og videre saksgang, and Vedlegg.
  if (u.avsender?.epost) merker.push("epost");
  legg(
    "svarfrist",
    `Jeg ber om skriftlig svar innen ${SVARFRIST_DAGER} dager fra dette brevets dato, det vil si innen {{dato:svarfrist}}${u.avsender?.epost ? ", til e-post {{epost}}" : ""}. Får jeg ikke svar innen fristen, eller avviser dere kravet, vil jeg bringe saken inn for Forbrukertilsynet for mekling og eventuelt behandling i Forbrukerklageutvalget.`,
  );
  const vedlagt = vedleggFor(input, u).map((v) => VEDLEGG_NAVN[v]);
  if (vedlagt.length) legg("vedlegg", `Vedlagt følger ${liste(vedlagt)}.`, { vedlegg: vedlagt });

  const advarsler = [...sjekkBrev(input, u, idag, valgt).map((a) => ({ ...a, tekst: rens(a.tekst) })), ...svake];
  return { argumenter, forbudt, mangler, henvisning, merker, advarsler };
}
