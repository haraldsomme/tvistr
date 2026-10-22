// The buyer's faults as the letter writes them in a sentence, per main category and subcategory
// (src/lib/feil/kategorier.ts). `ved` follows «feil ved» and is joined with the others («feil ved
// turboen og clutchen»); `tekst` stands on its own after «oppdaget jeg» («rust», «at kilometerstanden
// ikke stemmer»). `kort` names the area in «Rettslig grunnlag» («Feilen ved motoren viste seg …»).

export type Feilord = { ved: string } | { tekst: string };

const v = (ved: string): Feilord => ({ ved });
const t = (tekst: string): Feilord => ({ tekst });

type Omrade = { hel: Feilord; kort: string; under: Record<string, Feilord> };

export const FEILORD: Record<string, Omrade> = {
  motor: {
    hel: v("motoren eller eksosanlegget"),
    kort: "ved motoren",
    under: {
      turbo: v("turboen"),
      registerreim: v("registerreimen eller registerkjedet"),
      olje: t("unormalt oljeforbruk eller oljelekkasje"),
      kjoling: v("kjølesystemet eller topplokket"),
      drivstoff: v("drivstoffsystemet eller injektorene"),
      eksos: v("eksosanlegget eller katalysatoren"),
      utslipp: v("utslippssystemet (EGR, partikkelfilter eller AdBlue)"),
      annet_motor: v("motoren"),
    },
  },
  drivlinje: {
    hel: v("girkassen, clutchen eller drivlinjen"),
    kort: "ved drivlinjen",
    under: { girkasse: v("girkassen"), clutch: v("clutchen"), firehjul: v("firehjulstrekket, drivakslene eller differensialen") },
  },
  understell: {
    hel: v("bremsene, understellet eller styringen"),
    kort: "ved understellet",
    under: { bremser: v("bremsene"), demping: v("støtdemperne eller hjulopphenget"), styring: v("styringen"), hjullager: v("hjullagrene") },
  },
  karosseri: {
    hel: t("rust eller skader på lakk og karosseri"),
    kort: "ved karosseriet",
    under: { rust: t("rust"), lakk: t("lakkskader eller bulker"), ruter: t("skader på ruter eller speil") },
  },
  fukt: {
    hel: t("fukt eller feil i interiøret"),
    kort: "i interiøret",
    under: { fukt: t("fukt eller vannlekkasje"), lukt: t("unormal lukt i bilen"), interior: t("skader på seter eller interiør") },
  },
  elektrisk: {
    hel: v("det elektriske anlegget"),
    kort: "ved det elektriske anlegget",
    under: {
      infotainment: v("infotainmentsystemet, navigasjonen eller kameraet"),
      sikkerhet: v("sikkerhetssystemene (airbag, setebelter, ABS, sensorer eller førerassistent)"),
      lys: v("lysene"),
      startbatteri: v("startbatteriet, dynamoen eller startmotoren"),
      annet_el: v("det elektriske anlegget"),
    },
  },
  klima: {
    hel: v("klimaanlegget eller varmen"),
    kort: "ved klimaanlegget",
    under: { ac: v("klimaanlegget (AC)"), varme: v("varmepumpen eller varmeapparatet"), parkeringsvarmer: v("parkeringsvarmeren") },
  },
  hoyvolt: {
    hel: v("høyvoltbatteriet eller ladingen"),
    kort: "ved høyvoltbatteriet",
    under: { kapasitet: t("redusert kapasitet og rekkevidde på batteriet"), lading: v("ladingen eller ladeutstyret"), hybrid: v("hybridsystemet") },
  },
  utstyr: {
    hel: t("at utstyret ikke er som lovet"),
    kort: "ved utstyret",
    under: {
      utstyr: t("at utstyr mangler eller ikke virker"),
      dekk: v("dekkene eller felgene"),
      nokler: t("at nøkler eller tilbehør ikke er som lovet"),
      utstyrsniva: t("at bilen har et annet utstyrsnivå enn lovet"),
    },
  },
  service: {
    hel: t("at service ikke er utført som opplyst"),
    kort: "ved servicen",
    under: { service: t("at service ikke er utført som opplyst"), servicehefte: t("at serviceheftet mangler") },
  },
  historikk: {
    hel: t("at bilens historikk ikke er som opplyst"),
    kort: "ved bilens historikk",
    under: {
      skade: t("at bilen har tidligere skader eller har vært i en kollisjon"),
      km: t("at kilometerstanden ikke stemmer"),
      bruk: t("at bilens tidligere bruk eller antall eiere ikke er som opplyst"),
      import: t("at opplysningene om import, årsmodell eller identitet ikke stemmer"),
      ombygging: t("at bilen er bygget om eller tunet"),
      eu: v("EU-kontrollen eller registreringen"),
      pant: t("at bilen har pant eller heftelser"),
    },
  },
  garanti: { hel: t("at garantien ikke er som lovet"), kort: "ved garantien", under: {} },
  vet_ikke: {
    hel: t("en feil der årsaken ennå ikke er kjent"),
    kort: "med ukjent årsak",
    under: { varsellampe: t("at en varsellampe lyser"), nodmodus: t("at bilen går i nødmodus"), lyd: t("at bilen lager unormal lyd"), vibrasjon: t("at bilen vibrerer") },
  },
};

// The area's faults in the table's order: the ticked subcategories, or the whole area without one.
export function feilord(hoved: string, under: string[]): Feilord[] {
  const o = FEILORD[hoved];
  if (!o) return [t(hoved)];
  const valgt = Object.entries(o.under).filter(([id]) => under.includes(id)).map(([, f]) => f);
  return valgt.length ? valgt : [o.hel];
}

export const kortFeil = (hoved: string) => FEILORD[hoved]?.kort ?? `ved ${hoved}`;
