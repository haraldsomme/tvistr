import type { Faktorer, Reklamasjonsbotte } from "@/lib/vurdering/faktorer";
import { grupperFor, regelgrunnlag, type Gruppe, type Regelgrunnlag } from "@/lib/vurdering/henvisninger";
import type { Momentsvar } from "./utfylling";

// What Forbrukerklageutvalget weighed in dealer cases, as kinds of facts a buyer can be asked about:
// the catalogue behind the questions of the clarifying round. Built from 199 decisions read by two
// models (docs/momenter.md); every moment has word-for-word evidence in scripts/momenter-belegg.json, and
// `npm run sjekk-momenter` checks it. Not reviewed by a lawyer.

export type Moment = {
  id: string;
  navn: string;
  tema: string;
  // Whether the moment's presence helps («for») or hurts («mot») the buyer.
  retning: "for" | "mot";
  // For a «mot» moment: its favourable side, which is what a buyer or a decision has when it is covered
  // (`navn` names the unfavourable one).
  fordel?: string;
  // Empty: every case.
  gjelder: { grupper?: Gruppe[]; botter?: Reklamasjonsbotte[]; grunnlag?: Regelgrunnlag[] };
  // The step that asks it (src/app/brev/steg/liste.tsx); none: not asked.
  steg?: "kjopet" | "feilen" | "for-kjopet" | "kontakt" | "rapport";
  sporsmal: string;
  alternativer: string[];
  // The answers that speak for the buyer.
  gunstig: string[];
  // How the letter uses a favourable answer.
  argument: string;
  // In how many of the decisions read it was present, won and lost, and whether it separates them.
  forekomst: { vunnet: number; tapt: number; skiller: boolean };
};

// Generated from scripts/momenter-katalog.json and the counts in scripts/momenter-belegg.json.
export const MOMENTER: readonly Moment[] = [
  {
    id: "rapport_arsak",
    navn: "Rapporten angir årsaken",
    tema: "bevis",
    retning: "for",
    gjelder: {},
    steg: "rapport",
    sporsmal: "Hva sier verkstedet eller rapporten om hvorfor feilen oppsto?",
    alternativer: ["Den angir en konkret årsak etter å ha undersøkt bilen", "Den nevner bare mulige årsaker", "Den sier bare hva som er galt eller må byttes", "Jeg har ingen skriftlig vurdering fra verksted"],
    gunstig: ["Den angir en konkret årsak etter å ha undersøkt bilen"],
    argument: "Verkstedet undersøkte bilen og fant at feilen skyldes «(årsaken verkstedet oppga)».",
    forekomst: { vunnet: 25, tapt: 16, skiller: false },
  },
  {
    id: "rapport_upaaregnelig",
    navn: "Feilen er uvanlig for alder og kilometerstand",
    tema: "bevis",
    retning: "for",
    gjelder: {},
    steg: "rapport",
    sporsmal: "Sier verkstedet eller rapporten noe om feilen er vanlig for en bil med denne alderen og kilometerstanden?",
    alternativer: ["Ja, at delen normalt skal vare mye lenger", "Ja, at det er en konstruksjons- eller produksjonsfeil ved modellen", "Ja, at slik feil er vanlig for alderen og kilometerstanden", "Nei, den sier ikke noe om det"],
    gunstig: ["Ja, at delen normalt skal vare mye lenger", "Ja, at det er en konstruksjons- eller produksjonsfeil ved modellen"],
    argument: "Ifølge «(hvem som skrev vurderingen)» er dette ikke en feil som må påregnes på en bil med denne alderen og kilometerstanden: «(det vurderingen sier)». Bilen var dermed i dårligere stand enn jeg hadde grunn til å regne med, jf. § 15.",
    forekomst: { vunnet: 23, tapt: 7, skiller: true },
  },
  {
    id: "forhandler_annen_arsak",
    navn: "Forhandleren påstår en annen årsak uten belegg",
    tema: "bevis",
    retning: "for",
    gjelder: {},
    steg: "kontakt",
    sporsmal: "Har forhandleren sagt noe om hva feilen skyldes?",
    alternativer: ["Nei, forhandleren har ikke sagt noe om årsaken", "Ja, at det er min bruk, slitasje eller ytre skade, uten å vise til noen undersøkelse", "Ja, og forhandleren viser til en undersøkelse eller rapport om bilen"],
    gunstig: ["Ja, at det er min bruk, slitasje eller ytre skade, uten å vise til noen undersøkelse"],
    argument: "Dere har anført at feilen skyldes «(det forhandleren har sagt)», uten å vise til noen undersøkelse av denne bilen.",
    forekomst: { vunnet: 44, tapt: 42, skiller: false },
  },
  {
    id: "dokument_for_salg",
    navn: "Dokument fra før salget viser feilen",
    tema: "bevis",
    retning: "for",
    gjelder: {},
    steg: "for-kjopet",
    sporsmal: "Finnes det en rapport, faktura eller EU-kontroll fra før du kjøpte bilen?",
    alternativer: ["Ja, og den nevner feilen eller tegn på den", "Ja, men den nevner ikke feilen", "Nei, jeg har ikke sett noen slike"],
    gunstig: ["Ja, og den nevner feilen eller tegn på den"],
    argument: "Feilen var registrert før salget: «(dokumentet, datoen og det det sier)». Feilen forelå dermed ved leveringen, og dere skulle ha opplyst om den, jf. § 16.",
    forekomst: { vunnet: 12, tapt: 3, skiller: true },
  },
  {
    id: "udokumenterte_tilleggsfeil",
    navn: "Tilleggsfeil uten dokumentasjon",
    tema: "bevis",
    retning: "mot",
    fordel: "Alle feilene kravet gjelder, er dokumentert",
    gjelder: {},
    sporsmal: "Er alle feilene du klager på, beskrevet av et verksted eller dokumentert på annen måte?",
    alternativer: ["Jeg klager bare på én feil", "Ja, alle feilene er dokumentert", "Bare noen av feilene er dokumentert", "Ingen av feilene er dokumentert ennå"],
    gunstig: ["Jeg klager bare på én feil", "Ja, alle feilene er dokumentert"],
    argument: "Kravet gjelder «(feilen eller feilene)». Hver av dem er dokumentert med «(dokumentasjonen)».",
    forekomst: { vunnet: 40, tapt: 29, skiller: false },
  },
  {
    id: "slitedel",
    navn: "Feilen gjelder en slitedel",
    tema: "forventning",
    retning: "mot",
    fordel: "Delen er ikke en slitedel",
    gjelder: { grupper: ["motor", "elektrisk", "understell", "bremser", "girkasse", "klimaanlegg", "batteri"] },
    sporsmal: "Hva slags del er det som har sviktet?",
    alternativer: ["En del som normalt skal vare like lenge som bilen", "En del med anbefalt byttetid, som ikke var nådd", "En del med anbefalt byttetid, som var nådd eller passert", "En del som slites og byttes jevnlig"],
    gunstig: ["En del som normalt skal vare like lenge som bilen", "En del med anbefalt byttetid, som ikke var nådd"],
    argument: "«(Delen)» er ikke en slitedel; den skal normalt vare «(hvor lenge delen normalt varer)». Svikten går ut over det som kan ventes ut fra bilens alder, kilometerstand og pris, jf. § 15.",
    forekomst: { vunnet: 25, tapt: 19, skiller: false },
  },
  {
    id: "skjult_feil",
    navn: "Feilen kunne ikke ses ved visning",
    tema: "forventning",
    retning: "for",
    gjelder: {},
    steg: "feilen",
    sporsmal: "Hvorfor oppdaget du ikke feilen da du så på bilen?",
    alternativer: ["Den viser seg under bestemte forhold, for eksempel i regn eller med kald motor", "Den er skjult og ble funnet ved undersøkelse på verksted", "Den hadde ikke vist seg ennå", "Den kunne ses eller merkes, men jeg la ikke merke til den"],
    gunstig: ["Den viser seg under bestemte forhold, for eksempel i regn eller med kald motor", "Den er skjult og ble funnet ved undersøkelse på verksted", "Den hadde ikke vist seg ennå"],
    argument: "Feilen kunne ikke oppdages ved besiktigelse eller prøvekjøring: «(hvorfor feilen ikke kunne oppdages)». Jeg kjente derfor ikke til feilen og måtte heller ikke kjenne til den, jf. § 16 tredje ledd.",
    forekomst: { vunnet: 16, tapt: 6, skiller: true },
  },
  {
    id: "positiv_beskrivelse",
    navn: "Bilen ble beskrevet som i god stand",
    tema: "forventning",
    retning: "for",
    gjelder: { grunnlag: ["forventning", "opplysning"] },
    steg: "for-kjopet",
    sporsmal: "Hvordan beskrev annonsen eller forhandleren bilens stand før du kjøpte den?",
    alternativer: ["Med konkrete ord som «velholdt», «nylig EU-godkjent» eller «alt virker»", "Forhandleren svarte ja da jeg spurte konkret om tilstanden", "Annonsen hadde mest tekniske opplysninger", "Annonsen nevnte feil, slitasje eller at bilen trengte reparasjon"],
    gunstig: ["Med konkrete ord som «velholdt», «nylig EU-godkjent» eller «alt virker»", "Forhandleren svarte ja da jeg spurte konkret om tilstanden"],
    argument: "Bilen ble beskrevet som «(det annonsen eller forhandleren sa)». Feilen går ut over det jeg etter denne beskrivelsen kunne vente, jf. § 15.",
    forekomst: { vunnet: 44, tapt: 22, skiller: true },
  },
  {
    id: "uriktig_service_arbeid_utstyr",
    navn: "Uriktig om service, utført arbeid eller utstyr",
    tema: "opplysning",
    retning: "for",
    gjelder: { grunnlag: ["opplysning"] },
    steg: "for-kjopet",
    sporsmal: "Hva handlet opplysningen som ikke stemte, om?",
    alternativer: ["Service eller servicehistorikk", "Deler som var byttet eller arbeid som var gjort", "Utstyr bilen skulle ha", "Bilens stand generelt"],
    gunstig: ["Service eller servicehistorikk", "Deler som var byttet eller arbeid som var gjort", "Utstyr bilen skulle ha"],
    argument: "Opplysningen om «(det opplysningen gjaldt)» var konkret og uten forbehold, og den stemmer ikke. Opplysningen hadde betydning for kjøpet, jf. § 16.",
    forekomst: { vunnet: 27, tapt: 0, skiller: true },
  },
  {
    id: "tidligere_skade_ikke_opplyst",
    navn: "Tidligere skade eller bruk ikke opplyst",
    tema: "opplysning",
    retning: "for",
    gjelder: {},
    steg: "for-kjopet",
    sporsmal: "Har du etter kjøpet fått vite noe om bilens historie som ikke sto i annonsen eller kontrakten?",
    alternativer: ["Ja, tidligere skade, kondemnering eller innløsning", "Ja, omlakkering eller dårlig utført reparasjon", "Ja, tidligere bruk som drosje, skolebil eller utleiebil", "Ja, noe annet om bilens historie", "Nei"],
    gunstig: ["Ja, tidligere skade, kondemnering eller innløsning", "Ja, omlakkering eller dårlig utført reparasjon", "Ja, tidligere bruk som drosje, skolebil eller utleiebil", "Ja, noe annet om bilens historie"],
    argument: "Dere opplyste ikke at bilen «(det kjøperen har fått vite)». Dette er et forhold dere som forhandler burde kjent til, og som jeg hadde grunn til å regne med å få opplyst om, jf. § 16.",
    forekomst: { vunnet: 16, tapt: 1, skiller: true },
  },
  {
    id: "bruktimport_ikke_opplyst",
    navn: "Bruktimport ikke opplyst",
    tema: "opplysning",
    retning: "for",
    gjelder: {},
    steg: "for-kjopet",
    sporsmal: "Var bilen bruktimportert?",
    alternativer: ["Ja, den var bruktimportert, og det sto ikke i annonsen eller kontrakten", "Ja, den var bruktimportert, og det sto i annonsen eller kontrakten", "Nei, den var ikke bruktimportert"],
    gunstig: ["Ja, den var bruktimportert, og det sto ikke i annonsen eller kontrakten"],
    argument: "Bilen er bruktimportert. Det sto verken i annonsen eller i kontrakten. Bruktimport påvirker bilens verdi og skulle vært opplyst, jf. § 16.",
    forekomst: { vunnet: 7, tapt: 2, skiller: true },
  },
  {
    id: "garanti_uklar",
    navn: "Garantien var feil eller uklart beskrevet",
    tema: "opplysning",
    retning: "for",
    gjelder: {},
    steg: "kjopet",
    sporsmal: "Fikk du skriftlige vilkår for garantien?",
    alternativer: ["Ja, og vilkårene stemmer med det jeg fikk vite", "Ja, men vilkårene stemmer ikke med det jeg fikk vite", "Ja, men vilkårene sier forskjellige ting", "Nei, jeg fikk ikke vite hva garantien dekket"],
    gunstig: ["Ja, men vilkårene stemmer ikke med det jeg fikk vite", "Ja, men vilkårene sier forskjellige ting", "Nei, jeg fikk ikke vite hva garantien dekket"],
    argument: "Dere oppga at bilen hadde «(garantien slik den ble beskrevet)», men «(det som ikke stemte eller manglet)». En uriktig opplysning om garantien er en mangel, jf. § 16 første ledd bokstav c. Er det ikke angitt tydelig hvilke feil garantien dekker og hvilke krav jeg kan gjøre gjeldende, gjelder den som en alminnelig garanti for feil som oppstår i garantitiden, jf. § 18 a andre ledd. Uklarhet i vilkår dere selv har utformet, går ut over dere.",
    forekomst: { vunnet: 11, tapt: 0, skiller: true },
  },
  {
    id: "rettet_for_kjop",
    navn: "Opplysningen ble rettet før kjøpet",
    tema: "opplysning",
    retning: "mot",
    fordel: "Opplysningen ble ikke rettet før kjøpet",
    gjelder: { grunnlag: ["opplysning"] },
    sporsmal: "Rettet forhandleren opplysningen før du skrev under på kjøpet?",
    alternativer: ["Nei, den ble ikke rettet", "Det sto bare et generelt forbehold om feil i annonsen", "Ja, det sto riktig i kontrakten eller i en melding før kjøpet"],
    gunstig: ["Nei, den ble ikke rettet", "Det sto bare et generelt forbehold om feil i annonsen"],
    argument: "Dere rettet ikke opplysningen før avtalen ble inngått. Et generelt forbehold om feil i annonsen retter ikke en konkret opplysning, jf. § 16.",
    forekomst: { vunnet: 1, tapt: 1, skiller: false },
  },
  {
    id: "tidlige_tegn",
    navn: "Tidlige tegn er dokumentert",
    tema: "tidspunkt",
    retning: "for",
    gjelder: { botter: ["middels", "sen"] },
    steg: "feilen",
    sporsmal: "Finnes det noe skriftlig fra da du merket feilen første gang?",
    alternativer: ["Ja, det er dokumentert skriftlig fra den tiden", "Nei, det ble ikke skrevet ned"],
    gunstig: ["Ja, det er dokumentert skriftlig fra den tiden"],
    argument: "Allerede «(hvor lenge)» etter overtakelsen viste det seg tegn på feilen: «(hva som skjedde og hvor det er dokumentert)».",
    forekomst: { vunnet: 13, tapt: 5, skiller: true },
  },
  {
    id: "km_etter_kjop",
    navn: "Bilen er kjørt langt før feilen viste seg",
    tema: "bruk",
    retning: "mot",
    fordel: "Bilen var kjørt kort før feilen viste seg",
    gjelder: { botter: ["middels", "sen"] },
    steg: "feilen",
    sporsmal: "Hva sto kilometertelleren på da feilen viste seg?",
    alternativer: ["Under 1 000 km", "1 000–5 000 km", "5 000–15 000 km", "Over 15 000 km"],
    gunstig: ["Under 1 000 km", "1 000–5 000 km"],
    argument: "Da feilen viste seg, hadde jeg kjørt bilen «(hvor langt)» siden overtakelsen.",
    forekomst: { vunnet: 35, tapt: 48, skiller: true },
  },
  {
    id: "egen_bruk",
    navn: "Bruken etter kjøpet kan forklare feilen",
    tema: "bruk",
    retning: "mot",
    fordel: "Feilen skyldes ikke bruken etter kjøpet",
    gjelder: {},
    sporsmal: "Har noe ved bruken av bilen etter kjøpet kunnet påvirke feilen?",
    alternativer: ["Nei, vanlig bruk, og service er fulgt eller ikke forfalt ennå", "Service eller oljeskift er ikke gjort når det skulle", "Jeg har kjørt med tilhenger eller tung last", "Jeg kjørte videre etter at en varsellampe tente", "Uhell, ytre skade eller egne inngrep"],
    gunstig: ["Nei, vanlig bruk, og service er fulgt eller ikke forfalt ennå"],
    argument: "Bilen er brukt på vanlig måte, og service er fulgt etter kjøpet.",
    forekomst: { vunnet: 3, tapt: 4, skiller: false },
  },
  {
    id: "forhandler_erkjente",
    navn: "Forhandleren har tatt ansvar",
    tema: "kontakt",
    retning: "for",
    gjelder: {},
    steg: "kontakt",
    sporsmal: "Har forhandleren godtatt å dekke feilen?",
    alternativer: ["Ja, skriftlig", "Ja, ved å reparere eller betale uten forbehold", "Ja, men bare muntlig", "Ja, men av velvilje", "Nei"],
    gunstig: ["Ja, skriftlig", "Ja, ved å reparere eller betale uten forbehold"],
    argument: "Dere har selv «(det forhandleren gjorde eller skrev)», uten forbehold.",
    forekomst: { vunnet: 16, tapt: 5, skiller: true },
  },
  {
    id: "avslo_tilbud",
    navn: "Kjøperen avslo et tilbud om retting",
    tema: "kontakt",
    retning: "mot",
    fordel: "Kjøperen avslo ikke et tilbud om retting uten kostnad",
    gjelder: {},
    sporsmal: "Har forhandleren tilbudt å rette feilen?",
    alternativer: ["Nei", "Ja, men bare hvis jeg betalte en del eller godtok andre vilkår", "Ja, gratis, og jeg takket ja", "Ja, gratis, men jeg takket nei eller fikk det gjort et annet sted"],
    gunstig: ["Nei", "Ja, men bare hvis jeg betalte en del eller godtok andre vilkår", "Ja, gratis, og jeg takket ja"],
    argument: "Dere tilbød retting på vilkår av «(vilkåret)». Retting skal skje uten kostnad for meg, jf. § 30 første ledd, og tilbudet var derfor ikke et tilbud om retting etter loven. (Brukes bare når forhandleren satte vilkår.)",
    forekomst: { vunnet: 3, tapt: 2, skiller: false },
  },
  {
    id: "kravet_bare_mangelen",
    navn: "Kravet tar med kostnader som ikke gjelder feilen",
    tema: "krav",
    retning: "mot",
    fordel: "Kravet gjelder bare feilen",
    gjelder: {},
    sporsmal: "Gjelder fakturaen eller pristilbudet bare feilen du klager på?",
    alternativer: ["Ja, bare reparasjon av feilen", "Nei, den tar også med service, dekk, EU-kontroll eller annet arbeid", "Jeg har ingen faktura eller pristilbud ennå"],
    gunstig: ["Ja, bare reparasjon av feilen"],
    argument: "Beløpet gjelder reparasjonen av feilen og utgifter som følger direkte av den, og er dokumentert med «(faktura eller tilbud)».",
    forekomst: { vunnet: 36, tapt: 8, skiller: false },
  },
  {
    id: "verditap_dokumentert",
    navn: "Verditapet er dokumentert",
    tema: "krav",
    retning: "for",
    gjelder: { grunnlag: ["opplysning"] },
    sporsmal: "Har du noe skriftlig som viser hvor mye forholdet senker bilens verdi?",
    alternativer: ["Ja, en takst eller verdivurdering", "Ja, svar fra forhandlere ved innbytte eller salg", "Nei, bare mitt eget anslag"],
    gunstig: ["Ja, en takst eller verdivurdering", "Ja, svar fra forhandlere ved innbytte eller salg"],
    argument: "«(Takst eller vurdering)» setter verdireduksjonen til «(beløpet)». Prisavslaget bygger på dette.",
    forekomst: { vunnet: 3, tapt: 1, skiller: false },
  },
  {
    id: "rimelig_reparasjon",
    navn: "Rimelig reparasjon uten standardheving",
    tema: "krav",
    retning: "for",
    gjelder: {},
    sporsmal: "Hvordan er feilen reparert, eller hvordan skal den repareres?",
    alternativer: ["Med brukt eller overhalt del tilsvarende den gamle", "Med ny del, etter det rimeligste av flere tilbud", "Med ny del, etter bare ett tilbud", "Det er ikke bestemt ennå"],
    gunstig: ["Med brukt eller overhalt del tilsvarende den gamle", "Med ny del, etter det rimeligste av flere tilbud"],
    argument: "Reparasjonen er utført «(hvordan den er gjort)» og gir ikke bilen høyere verdi enn den skulle hatt ved leveringen.",
    forekomst: { vunnet: 7, tapt: 0, skiller: false },
  },
  {
    id: "bruksstans_sikkerhet",
    navn: "Bilen kan ikke brukes eller er farlig",
    tema: "krav",
    retning: "for",
    gjelder: {},
    steg: "feilen",
    sporsmal: "Hvordan påvirker feilen bruken av bilen?",
    alternativer: ["Bilen kan ikke brukes", "Bilen er utrygg å kjøre", "Bilen kan brukes, men feilen er til hinder", "Feilen er mest kosmetisk"],
    gunstig: ["Bilen kan ikke brukes", "Bilen er utrygg å kjøre"],
    argument: "Feilen medfører at «(hva feilen gjør med bilen)». Den rammer bilens grunnleggende bruk og sikkerhet. (Krever jeg heving, betyr det at mangelen ikke er uvesentlig, jf. § 32.)",
    forekomst: { vunnet: 38, tapt: 24, skiller: false },
  },
  {
    id: "rust_baerende",
    navn: "Rust i bærende deler",
    tema: "bevis",
    retning: "for",
    gjelder: { grupper: ["rust", "understell", "bremser", "skade"] },
    sporsmal: "Hvor sitter rusten, og hvor alvorlig er den?",
    alternativer: ["Gjennomtæring eller rust i ramme, bærearmer eller bremserør", "Overflaterust på understell eller bærende deler", "Rust i lakk, skjermer eller dører"],
    gunstig: ["Gjennomtæring eller rust i ramme, bærearmer eller bremserør"],
    argument: "Rusten sitter i «(hvor rusten sitter)». «(Hvem som vurderte den)» beskriver den slik: «(det vurderingen sier)». Rust av dette omfanget i bærende deler går ut over det som kan ventes ut fra bilens alder og kjørelengde, jf. § 15.",
    forekomst: { vunnet: 3, tapt: 3, skiller: false },
  },
];

// The moments to ask a buyer about: those that separate won from lost cases and apply to this case's
// defect, timing and the rule the letter rests on.
// Asked although they do not separate won from lost cases: the description and a claim to cancel need
// `bruksstans_sikkerhet`, and the cited decision is compared on the other two (docs/superpowers/specs/2026-10-08-henvisning-a-fortiori-design.md).
export const ALLTID_SPURT: readonly string[] = ["bruksstans_sikkerhet", "rapport_arsak", "forhandler_annen_arsak"];
export function momenterFor(f: Faktorer, katalog: readonly Moment[] = MOMENTER): Moment[] {
  const grupper = grupperFor(f);
  const grunnlag = regelgrunnlag(f);
  return katalog.filter(
    (m) =>
      (m.forekomst.skiller || ALLTID_SPURT.includes(m.id)) &&
      (!m.gjelder.grupper?.length || m.gjelder.grupper.some((g) => grupper.includes(g))) &&
      (!m.gjelder.botter?.length || m.gjelder.botter.includes(f.reklamasjonsbotte)) &&
      (!m.gjelder.grunnlag?.length || m.gjelder.grunnlag.includes(grunnlag)),
  );
}

// What decides whether a step shows a moment's question beyond the case asking it (`momenterFor`): the
// answers the question hangs on. The steps pass what is on screen, the score and the letter plan what is saved.
export type SporsmalKontekst = {
  forbehold?: string;
  rapport?: string;
  kontakt?: string;
  retting?: string;
  bruktimportert?: boolean;
  opplystForKjop?: string;
  // «Sa annonsen eller selgeren noe om bilen som ikke stemte?» in «Før kjøpet».
  feilopplyst?: string;
};
export function vistSporsmal(id: string, k: SporsmalKontekst): boolean {
  switch (id) {
    case "garanti_uklar":
      return k.forbehold === "garanti";
    case "rapport_upaaregnelig":
    case "rapport_arsak":
      return k.rapport === "ja";
    case "forhandler_erkjente":
      return k.kontakt === "ja";
    case "forhandler_annen_arsak":
      return k.retting === "avvist";
    case "bruktimport_ikke_opplyst":
      return k.bruktimportert !== false;
    case "skjult_feil":
      return !k.opplystForKjop?.startsWith("ja");
    case "uriktig_service_arbeid_utstyr":
      return k.feilopplyst === "ja";
    default:
      return true;
  }
}

export const moment = (id: string): Moment | undefined => MOMENTER.find((m) => m.id === id);
// A moment as something a buyer or a decision has: a «mot» moment by its favourable side.
export const fordelNavn = (mo: Moment) => mo.fordel ?? mo.navn;

// How far the buyer had driven when the defect showed, from the two odometer readings. Up to 5 000 km
// counts for the buyer, as the two lowest groups of `km_etter_kjop` did.
const KM_GUNSTIG = 5000;

// `egen`: the buyer's own words instead of an alternative; a fact for the letter, neither for nor against.
type Besvart = { moment: Moment; svar: string; gunstig: boolean; egen: boolean };

// The moments a case has answers to: those the steps saved, the distance driven worked out from the
// odometer, and, for cases from before the steps asked, those the clarifying round gave (matched by
// the alternative's text). An answer from the steps wins.
export function besvarteMomenter(
  momenter: Momentsvar | undefined,
  km: { vedKjop?: number; vedFeil?: number },
  avklaringer: readonly { moment?: string; svar: string | null }[],
): Besvart[] {
  const ut = new Map<string, Besvart>();
  for (const a of avklaringer) {
    const m = a.moment ? moment(a.moment) : undefined;
    if (m && a.svar) ut.set(m.id, { moment: m, svar: a.svar, gunstig: m.gunstig.some((g) => a.svar!.includes(g)), egen: false });
  }
  for (const [id, s] of Object.entries(momenter ?? {})) {
    const m = moment(id);
    const svar = s?.egen ?? s?.svar;
    if (m && svar) ut.set(id, { moment: m, svar, gunstig: m.gunstig.includes(svar) && !s?.egen, egen: Boolean(s?.egen) });
  }
  const kjort = km.vedKjop !== undefined && km.vedFeil !== undefined && km.vedFeil >= km.vedKjop ? km.vedFeil - km.vedKjop : null;
  const m = moment("km_etter_kjop");
  if (m && kjort !== null) ut.set(m.id, { moment: m, svar: `${kjort} km etter kjøpet (kilometerstand ${km.vedFeil} km)`, gunstig: kjort <= KM_GUNSTIG, egen: false });
  return [...ut.values()];
}
