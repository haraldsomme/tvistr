import { KNAPP_TIL_FEILTYPE, type Faktorer, type Reklamasjonsbotte } from "@/lib/vurdering/faktorer";
import { GRUPPER, regelgrunnlag, type Gruppe, type Regelgrunnlag } from "@/lib/vurdering/henvisninger";

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
  // Empty: every case.
  gjelder: { grupper?: Gruppe[]; botter?: Reklamasjonsbotte[]; grunnlag?: Regelgrunnlag[] };
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
    sporsmal: "Hva sier verkstedet eller rapporten om hvorfor feilen oppsto?",
    alternativer: ["Den angir en konkret årsak etter å ha undersøkt bilen", "Den nevner bare mulige årsaker", "Den sier bare hva som er galt eller må byttes", "Jeg har ingen skriftlig vurdering fra verksted"],
    gunstig: ["Den angir en konkret årsak etter å ha undersøkt bilen"],
    argument: "Verkstedet undersøkte bilen og konkluderte med at feilen skyldes «(årsaken verkstedet oppga)». Årsaken er dermed kjent og ligger i bilen selv.",
    forekomst: { vunnet: 25, tapt: 16, skiller: false },
  },
  {
    id: "rapport_upaaregnelig",
    navn: "Feilen er uvanlig for alder og kilometerstand",
    tema: "bevis",
    retning: "for",
    gjelder: {},
    sporsmal: "Sier verkstedet eller rapporten noe om feilen er vanlig for en bil med denne alderen og kilometerstanden?",
    alternativer: ["Ja, at delen normalt skal vare mye lenger", "Ja, at det er en konstruksjons- eller produksjonsfeil ved modellen", "Ja, at slik feil er vanlig for alderen og kilometerstanden", "Nei, den sier ikke noe om det"],
    gunstig: ["Ja, at delen normalt skal vare mye lenger", "Ja, at det er en konstruksjons- eller produksjonsfeil ved modellen"],
    argument: "Ifølge «(hvem som skrev vurderingen)» er dette ikke en feil man må regne med på en bil med denne alderen og kilometerstanden: «(det vurderingen sier)». Bilen var derfor i dårligere stand enn jeg hadde grunn til å regne med, jf. § 15.",
    forekomst: { vunnet: 23, tapt: 7, skiller: true },
  },
  {
    id: "forhandler_annen_arsak",
    navn: "Forhandleren påstår en annen årsak uten belegg",
    tema: "bevis",
    retning: "for",
    gjelder: {},
    sporsmal: "Har forhandleren sagt noe om hva feilen skyldes?",
    alternativer: ["Nei, forhandleren har ikke sagt noe om årsaken", "Ja, at det er min bruk, slitasje eller ytre skade, uten å vise til noen undersøkelse", "Ja, og forhandleren viser til en undersøkelse eller rapport om bilen"],
    gunstig: ["Ja, at det er min bruk, slitasje eller ytre skade, uten å vise til noen undersøkelse"],
    argument: "Dere har hevdet at feilen skyldes «(det forhandleren har sagt)», men har ikke lagt fram noe som underbygger det for denne bilen. En påstand uten dokumentasjon svekker ikke det som ellers viser at feilen var der da jeg overtok bilen.",
    forekomst: { vunnet: 44, tapt: 42, skiller: false },
  },
  {
    id: "dokument_for_salg",
    navn: "Dokument fra før salget viser feilen",
    tema: "bevis",
    retning: "for",
    gjelder: {},
    sporsmal: "Finnes det en rapport, faktura eller EU-kontroll fra før du kjøpte bilen?",
    alternativer: ["Ja, og den nevner feilen eller tegn på den", "Ja, men den nevner ikke feilen", "Nei, jeg har ikke sett noen slike"],
    gunstig: ["Ja, og den nevner feilen eller tegn på den"],
    argument: "Feilen var registrert allerede før salget: «(dokumentet, datoen og det det sier)». Feilen fantes altså da jeg overtok bilen, og dere som forhandler burde ha kjent til den og opplyst om den, og det hadde hatt betydning for kjøpet, jf. § 16.",
    forekomst: { vunnet: 12, tapt: 3, skiller: true },
  },
  {
    id: "udokumenterte_tilleggsfeil",
    navn: "Tilleggsfeil uten dokumentasjon",
    tema: "bevis",
    retning: "mot",
    gjelder: {},
    sporsmal: "Er alle feilene du klager på, beskrevet av et verksted eller dokumentert på annen måte?",
    alternativer: ["Jeg klager bare på én feil", "Ja, alle feilene er dokumentert", "Bare noen av feilene er dokumentert", "Ingen av feilene er dokumentert ennå"],
    gunstig: ["Jeg klager bare på én feil", "Ja, alle feilene er dokumentert"],
    argument: "Kravet mitt gjelder «(feilen eller feilene)», og hver av dem er dokumentert med «(dokumentasjonen)».",
    forekomst: { vunnet: 40, tapt: 29, skiller: false },
  },
  {
    id: "slitedel",
    navn: "Feilen gjelder en slitedel",
    tema: "forventning",
    retning: "mot",
    gjelder: { grupper: ["motor", "elektrisk", "understell", "bremser", "girkasse", "klimaanlegg", "batteri"] },
    sporsmal: "Hva slags del er det som har sviktet?",
    alternativer: ["En del som normalt skal vare like lenge som bilen", "En del med anbefalt byttetid, som ikke var nådd", "En del med anbefalt byttetid, som var nådd eller passert", "En del som slites og byttes jevnlig"],
    gunstig: ["En del som normalt skal vare like lenge som bilen", "En del med anbefalt byttetid, som ikke var nådd"],
    argument: "Delen som har sviktet, «(delen)», er ikke en slitedel, men en del som normalt skal vare «(hvor lenge delen normalt varer)». At den svikter nå, er mer enn jeg kunne regne med ut fra bilens alder, kilometerstand og pris, jf. § 15.",
    forekomst: { vunnet: 25, tapt: 19, skiller: false },
  },
  {
    id: "skjult_feil",
    navn: "Feilen kunne ikke ses ved visning",
    tema: "forventning",
    retning: "for",
    gjelder: {},
    sporsmal: "Kunne feilen ses eller merkes da du så på og prøvekjørte bilen?",
    alternativer: ["Nei, den var skjult og krevde undersøkelse på verksted", "Nei, den viste seg bare under bestemte forhold", "Ja, den kunne ses eller merkes, men jeg la ikke merke til den", "Ja, en varsellampe lyste eller feilen var tydelig"],
    gunstig: ["Nei, den var skjult og krevde undersøkelse på verksted", "Nei, den viste seg bare under bestemte forhold"],
    argument: "Feilen kunne ikke oppdages da jeg så på og prøvekjørte bilen, fordi «(hvorfor feilen ikke kunne oppdages)». Jeg hadde ingen plikt til å undersøke bilen nærmere og kan ikke regnes for å ha kjent til feilen.",
    forekomst: { vunnet: 16, tapt: 6, skiller: true },
  },
  {
    id: "positiv_beskrivelse",
    navn: "Bilen ble beskrevet som i god stand",
    tema: "forventning",
    retning: "for",
    gjelder: { grunnlag: ["forventning", "opplysning"] },
    sporsmal: "Hvordan beskrev annonsen eller forhandleren bilens stand før du kjøpte den?",
    alternativer: ["Med konkrete ord som «velholdt», «nylig EU-godkjent» eller «alt virker»", "Forhandleren svarte ja da jeg spurte konkret om tilstanden", "Annonsen hadde mest tekniske opplysninger", "Annonsen nevnte feil, slitasje eller at bilen trengte reparasjon"],
    gunstig: ["Med konkrete ord som «velholdt», «nylig EU-godkjent» eller «alt virker»", "Forhandleren svarte ja da jeg spurte konkret om tilstanden"],
    argument: "Bilen ble beskrevet som «(det annonsen eller forhandleren sa)». Det ga meg grunn til å forvente en bil i god stand, og feilen er mer enn jeg kunne regne med etter en slik beskrivelse, jf. § 15.",
    forekomst: { vunnet: 44, tapt: 22, skiller: true },
  },
  {
    id: "uriktig_service_arbeid_utstyr",
    navn: "Uriktig om service, utført arbeid eller utstyr",
    tema: "opplysning",
    retning: "for",
    gjelder: { grunnlag: ["opplysning"] },
    sporsmal: "Hva handlet opplysningen som ikke stemte, om?",
    alternativer: ["Service eller servicehistorikk", "Deler som var byttet eller arbeid som var gjort", "Utstyr bilen skulle ha", "Bilens stand generelt"],
    gunstig: ["Service eller servicehistorikk", "Deler som var byttet eller arbeid som var gjort", "Utstyr bilen skulle ha"],
    argument: "Opplysningen om «(det opplysningen gjaldt)» var konkret og uten forbehold, og den stemmer ikke. Slike opplysninger er sentrale når man kjøper bruktbil, og den har virket inn på at jeg kjøpte bilen, jf. § 16.",
    forekomst: { vunnet: 27, tapt: 0, skiller: true },
  },
  {
    id: "tidligere_skade_ikke_opplyst",
    navn: "Tidligere skade eller bruk ikke opplyst",
    tema: "opplysning",
    retning: "for",
    gjelder: {},
    sporsmal: "Har du fått vite noe om bilens historie etter kjøpet som forhandleren ikke fortalte?",
    alternativer: ["Ja, tidligere skade, kondemnering eller innløsning", "Ja, omlakkering eller dårlig utført reparasjon", "Ja, tidligere bruk som drosje, skolebil eller utleiebil", "Ja, noe annet om bilens historie", "Nei"],
    gunstig: ["Ja, tidligere skade, kondemnering eller innløsning", "Ja, omlakkering eller dårlig utført reparasjon", "Ja, tidligere bruk som drosje, skolebil eller utleiebil", "Ja, noe annet om bilens historie"],
    argument: "Dere opplyste ikke at bilen «(det kjøperen har fått vite)». Som forhandler burde dere kjent til dette, og det er en opplysning jeg hadde grunn til å regne med å få fordi den påvirker bilens verdi, jf. § 16.",
    forekomst: { vunnet: 16, tapt: 1, skiller: true },
  },
  {
    id: "bruktimport_ikke_opplyst",
    navn: "Bruktimport ikke opplyst",
    tema: "opplysning",
    retning: "for",
    gjelder: {},
    sporsmal: "Var bilen bruktimportert, og ble det opplyst før du kjøpte den?",
    alternativer: ["Ja, den var bruktimportert, og det ble ikke opplyst", "Ja, den var bruktimportert, og det ble opplyst", "Nei, den var ikke bruktimportert"],
    gunstig: ["Ja, den var bruktimportert, og det ble ikke opplyst"],
    argument: "Bilen er bruktimportert, men det sto verken i annonsen eller i kontrakten. Bruktimport senker bilens verdi og er noe dere skulle ha opplyst om, jf. § 16.",
    forekomst: { vunnet: 7, tapt: 2, skiller: true },
  },
  {
    id: "garanti_uklar",
    navn: "Garantien var feil eller uklart beskrevet",
    tema: "opplysning",
    retning: "for",
    gjelder: {},
    sporsmal: "Hvordan ble garantien beskrevet da du kjøpte bilen?",
    alternativer: ["Garantien var annerledes enn det jeg fikk opplyst", "Jeg fikk ikke vite hva garantien dekket eller hvilke vilkår den hadde", "Kontrakten sa forskjellige ting om garantien", "Garantien og vilkårene var tydelige", "Bilen hadde ingen garanti"],
    gunstig: ["Garantien var annerledes enn det jeg fikk opplyst", "Jeg fikk ikke vite hva garantien dekket eller hvilke vilkår den hadde", "Kontrakten sa forskjellige ting om garantien"],
    argument: "Dere oppga at bilen hadde «(garantien slik den ble beskrevet)», men «(det som ikke stemte eller manglet)». En uriktig opplysning om garantien er en mangel, jf. § 16 første ledd bokstav c. Er det ikke angitt tydelig hvilke feil garantien dekker og hvilke krav jeg kan gjøre gjeldende, gjelder den som en alminnelig garanti for feil som oppstår i garantitiden, jf. § 18 a andre ledd. Uklarhet i en avtale dere selv har skrevet, må gå ut over dere.",
    forekomst: { vunnet: 11, tapt: 0, skiller: true },
  },
  {
    id: "rettet_for_kjop",
    navn: "Opplysningen ble rettet før kjøpet",
    tema: "opplysning",
    retning: "mot",
    gjelder: { grunnlag: ["opplysning"] },
    sporsmal: "Rettet forhandleren opplysningen før du skrev under på kjøpet?",
    alternativer: ["Nei, den ble ikke rettet", "Det sto bare et generelt forbehold om feil i annonsen", "Ja, det sto riktig i kontrakten eller i en melding før kjøpet"],
    gunstig: ["Nei, den ble ikke rettet", "Det sto bare et generelt forbehold om feil i annonsen"],
    argument: "Dere rettet ikke opplysningen før jeg skrev under. Et generelt forbehold om feil i annonsen er ikke nok til å rette en konkret opplysning, jf. § 16.",
    forekomst: { vunnet: 1, tapt: 1, skiller: false },
  },
  {
    id: "tidlige_tegn",
    navn: "Tidlige tegn er dokumentert",
    tema: "tidspunkt",
    retning: "for",
    gjelder: { botter: ["middels", "sen"] },
    sporsmal: "Merket du noe til feilen de første ukene etter kjøpet, og finnes det noe skriftlig fra den tiden?",
    alternativer: ["Ja, og det er dokumentert skriftlig fra den tiden", "Ja, men det ble ikke skrevet ned noe sted", "Nei, feilen kom senere"],
    gunstig: ["Ja, og det er dokumentert skriftlig fra den tiden"],
    argument: "Allerede «(hvor lenge)» etter at jeg overtok bilen, viste det seg tegn på feilen: «(hva som skjedde og hvor det er dokumentert)». Dette er tegn på den samme feilen, og det taler for at feilen var der da jeg overtok bilen.",
    forekomst: { vunnet: 13, tapt: 5, skiller: true },
  },
  {
    id: "km_etter_kjop",
    navn: "Bilen er kjørt langt før feilen viste seg",
    tema: "bruk",
    retning: "mot",
    gjelder: { botter: ["middels", "sen"] },
    sporsmal: "Omtrent hvor langt hadde du kjørt bilen da feilen viste seg?",
    alternativer: ["Under 1 000 km", "1 000–5 000 km", "5 000–15 000 km", "Over 15 000 km"],
    gunstig: ["Under 1 000 km", "1 000–5 000 km"],
    argument: "Feilen viste seg etter at jeg hadde kjørt bilen bare «(omtrent hvor langt)». Så kort kjøring gjør det lite sannsynlig at feilen har oppstått etter overtakelsen.",
    forekomst: { vunnet: 35, tapt: 48, skiller: true },
  },
  {
    id: "egen_bruk",
    navn: "Bruken etter kjøpet kan forklare feilen",
    tema: "bruk",
    retning: "mot",
    gjelder: {},
    sporsmal: "Har noe ved bruken av bilen etter kjøpet kunnet påvirke feilen?",
    alternativer: ["Nei, vanlig bruk, og service er fulgt eller ikke forfalt ennå", "Service eller oljeskift er ikke gjort når det skulle", "Jeg har kjørt med tilhenger eller tung last", "Jeg kjørte videre etter at en varsellampe tente", "Uhell, ytre skade eller egne inngrep"],
    gunstig: ["Nei, vanlig bruk, og service er fulgt eller ikke forfalt ennå"],
    argument: "Jeg har brukt bilen på vanlig måte og fulgt servicen etter kjøpet. Det er ingenting ved min bruk som kan forklare feilen.",
    forekomst: { vunnet: 3, tapt: 4, skiller: false },
  },
  {
    id: "forhandler_erkjente",
    navn: "Forhandleren har tatt ansvar",
    tema: "kontakt",
    retning: "for",
    gjelder: {},
    sporsmal: "Har forhandleren gjort eller sagt noe som viser at de tar ansvar for feilen?",
    alternativer: ["Ja, skriftlig, eller ved å reparere eller betale uten forbehold", "Ja, men bare muntlig", "Ja, men med forbehold om at det var av velvilje", "Nei"],
    gunstig: ["Ja, skriftlig, eller ved å reparere eller betale uten forbehold"],
    argument: "Dere har selv «(det forhandleren gjorde eller skrev)», uten forbehold. Det viser at dere har regnet feilen som deres ansvar, og det taler for at feilen var der da jeg overtok bilen.",
    forekomst: { vunnet: 16, tapt: 5, skiller: true },
  },
  {
    id: "avslo_tilbud",
    navn: "Kjøperen avslo et tilbud om retting",
    tema: "kontakt",
    retning: "mot",
    gjelder: {},
    sporsmal: "Har forhandleren tilbudt å rette feilen?",
    alternativer: ["Nei", "Ja, men bare hvis jeg betalte en del eller godtok andre vilkår", "Ja, gratis, og jeg takket ja", "Ja, gratis, men jeg takket nei eller fikk det gjort et annet sted"],
    gunstig: ["Nei", "Ja, men bare hvis jeg betalte en del eller godtok andre vilkår", "Ja, gratis, og jeg takket ja"],
    argument: "Dere tilbød bare å rette feilen dersom «(vilkåret)». Retting skal skje uten kostnad for meg, så dette var ikke et tilbud om retting, jf. § 30 første ledd. (Brukes bare når forhandleren satte vilkår.)",
    forekomst: { vunnet: 3, tapt: 2, skiller: false },
  },
  {
    id: "kravet_bare_mangelen",
    navn: "Kravet tar med kostnader som ikke gjelder feilen",
    tema: "krav",
    retning: "mot",
    gjelder: {},
    sporsmal: "Gjelder fakturaen eller pristilbudet bare feilen du klager på?",
    alternativer: ["Ja, bare reparasjon av feilen", "Nei, den tar også med service, dekk, EU-kontroll eller annet arbeid", "Jeg har ingen faktura eller pristilbud ennå"],
    gunstig: ["Ja, bare reparasjon av feilen"],
    argument: "Beløpet jeg krever, gjelder bare reparasjonen av feilen og utgifter som er en direkte følge av den, og er dokumentert med «(faktura eller tilbud)».",
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
    argument: "Forholdet senker bilens verdi med «(beløpet)», slik «(takst eller vurdering)» viser. Prisavslaget jeg krever, bygger på dette.",
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
    argument: "Reparasjonen er gjort så rimelig som mulig, «(hvordan den er gjort)», og gjør ikke bilen mer verdt enn den skulle vært da jeg kjøpte den.",
    forekomst: { vunnet: 7, tapt: 0, skiller: false },
  },
  {
    id: "bruksstans_sikkerhet",
    navn: "Bilen kan ikke brukes eller er farlig",
    tema: "krav",
    retning: "for",
    gjelder: {},
    sporsmal: "Hvordan påvirker feilen bruken av bilen?",
    alternativer: ["Bilen kan ikke kjøres, eller den er farlig å kjøre", "Bilen stopper eller svikter av og til", "Bilen kan brukes, men feilen er til hinder", "Feilen er mest kosmetisk"],
    gunstig: ["Bilen kan ikke kjøres, eller den er farlig å kjøre", "Bilen stopper eller svikter av og til"],
    argument: "Feilen gjør at «(hva feilen gjør med bilen)». Den rammer bilens grunnleggende bruk og sikkerhet. (Krever jeg heving, betyr det at mangelen ikke er uvesentlig, jf. § 32.)",
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
    argument: "Rusten sitter i «(hvor rusten sitter)», og «(hvem som vurderte den)» beskriver den slik: «(det vurderingen sier)». Rust i bærende deler av dette omfanget er mer enn jeg kunne regne med ut fra bilens alder og kjørelengde, jf. § 15.",
    forekomst: { vunnet: 3, tapt: 3, skiller: false },
  },
];

// The defect groups of a case, as the library of decisions names them.
const grupperFor = (f: Faktorer): Gruppe[] => GRUPPER.filter((g) => f.feilgrupper.some((fg) => KNAPP_TIL_FEILTYPE[g][0] === fg[0]));

// The moments to ask a buyer about: those that separate won from lost cases and apply to this case's
// defect, timing and the rule the letter rests on.
export function momenterFor(f: Faktorer, katalog: readonly Moment[] = MOMENTER): Moment[] {
  const grupper = grupperFor(f);
  const grunnlag = regelgrunnlag(f);
  return katalog.filter(
    (m) =>
      m.forekomst.skiller &&
      (!m.gjelder.grupper?.length || m.gjelder.grupper.some((g) => grupper.includes(g))) &&
      (!m.gjelder.botter?.length || m.gjelder.botter.includes(f.reklamasjonsbotte)) &&
      (!m.gjelder.grunnlag?.length || m.gjelder.grunnlag.includes(grunnlag)),
  );
}
