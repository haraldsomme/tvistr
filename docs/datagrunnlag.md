# Datagrunnlag for Tvistr

*Generert 2026-09-30 16:58 med `npm run rapport`. Tallene er hentet direkte fra databasen; seksjonen «Kjente hull og svakheter» vedlikeholdes i `scripts/rapport.ts`.*

## 1. Innhenting

Kilder: Forbrukertvistutvalget (`hist`, innsyn.onacos.no, til og med 2020), Forbrukerklageutvalget 2021–mai 2025 (`prod`, innsyn.onacos.no) og Forbrukerklageutvalget etter mai 2025 (`wp`, forbrukertilsynet.no). Utvalg: saker klassifisert som brukt bil og campingvogn/bobil, i `hist` også tittelsøk på «bruktbil», «brukt bil» og «bobil» for den uklassifiserte perioden 2018–2020; i `wp` kategori «Kjøretøy». Vedtak før 2013 er hoppet over.

**Saker per arkiv og status**

| Arkiv | Status | Saker |
| --- | --- | --- |
| hist | hentet | 2612 |
| hist | ingen_dokument | 29 |
| hist | hoppet_over | 8 |
| prod | hentet | 1720 |
| prod | duplikat | 2 |
| prod | ingen_dokument | 8 |
| wp | hentet | 212 |

**Nedlastede vedtak per år**

| År | hist | prod | wp | Totalt |
| --- | --- | --- | --- | --- |
| 2013 | 137 | 0 | 0 | 137 |
| 2014 | 188 | 0 | 0 | 188 |
| 2015 | 327 | 0 | 0 | 327 |
| 2016 | 697 | 0 | 0 | 697 |
| 2017 | 461 | 0 | 0 | 461 |
| 2018 | 210 | 0 | 0 | 210 |
| 2019 | 416 | 0 | 0 | 416 |
| 2020 | 176 | 0 | 0 | 176 |
| 2021 | 0 | 413 | 0 | 413 |
| 2022 | 0 | 596 | 0 | 596 |
| 2023 | 0 | 486 | 0 | 486 |
| 2024 | 0 | 217 | 0 | 217 |
| 2025 | 0 | 8 | 76 | 84 |
| 2026 | 0 | 0 | 136 | 136 |

## 2. Klassifisering

4544 dokumenter er klassifisert; 3608 gjelder kjøp av brukt kjøretøy.

| Kategori | Dokumenter |
| --- | --- |
| brukt kjoretoy | 3608 |
| annet | 491 |
| verksted tjeneste | 216 |
| nytt kjoretoy | 165 |
| baat | 62 |
| leasing leie | 2 |

## 3. Tolkede vedtak

3608 vedtak er tolket (0 feilet og kan kjøres på nytt). Prompt- og modellversjoner:

| Prompt | Modell | Vedtak |
| --- | --- | --- |
| tolk-v3 | claude-sonnet-5-5 | 3608 |

**Nøkkeltall:** median krevd 54 493 kr, median tilkjent når noe ble tilkjent 22 062 kr.

| Utfall | Vedtak | Andel |
| --- | --- | --- |
| delvis medhold | 1467 | 41 % |
| ikke medhold | 1405 | 39 % |
| medhold | 646 | 18 % |
| avvist | 90 | 2 % |

**Vinnersjanse per selgertype**

| Gruppe | Saker | Medhold | 95 % intervall |
| --- | --- | --- | --- |
| forhandler | 2347 | 63 % | 61 %–64 % |
| privat | 1040 | 49 % | 46 %–52 % |
| formidling | 213 | 63 % | 57 %–70 % |
| ukjent | 8 | 13 % | 2 %–47 % |

**Vinnersjanse per feiltype**

| Gruppe | Saker | Medhold | 95 % intervall |
| --- | --- | --- | --- |
| annet | 1646 | 65 % | 62 %–67 % |
| motor | 1598 | 56 % | 53 %–58 % |
| elektrisk | 1255 | 61 % | 58 %–63 % |
| understell hjuloppheng | 976 | 58 % | 55 %–61 % |
| rust | 801 | 59 % | 55 %–62 % |
| bremser | 734 | 57 % | 54 %–61 % |
| servicehistorikk | 502 | 72 % | 68 %–76 % |
| girkasse | 463 | 53 % | 48 %–57 % |
| fukt lekkasje | 438 | 57 % | 52 %–61 % |
| klimaanlegg | 330 | 59 % | 54 %–64 % |
| kollisjonsskade | 244 | 66 % | 59 %–71 % |
| clutch | 179 | 45 % | 38 %–53 % |
| km avvik | 161 | 72 % | 65 %–78 % |
| bruktimport opplysning | 135 | 73 % | 65 %–80 % |
| batteri elbil | 113 | 55 % | 46 %–64 % |
| ramme chassis | 102 | 66 % | 56 %–74 % |

**Vinnersjanse per mangelsgrunnlag**

| Gruppe | Saker | Medhold | 95 % intervall |
| --- | --- | --- | --- |
| avvik fra avtale | 1677 | 59 % | 57 %–62 % |
| feil opplysninger | 1472 | 62 % | 60 %–65 % |
| vesentlig darligere stand | 1337 | 50 % | 47 %–52 % |
| tilbakeholdt opplysning | 1222 | 51 % | 49 %–54 % |
| annet | 160 | 61 % | 53 %–68 % |
| offentligrettslige krav | 22 | 86 % | 67 %–95 % |

## 4. Feltdekning

Andel av tolkede vedtak der feltet har en verdi. Lav dekning betyr at opplysningen sjelden står i vedtaket, ikke nødvendigvis at uttrekket er feil (f.eks. står tilkjent beløp bare når klager fikk medhold).

| Felt | Utfylt | Andel |
| --- | --- | --- |
| vedtaksdato | 3600 | 100 % |
| kjoretoytype | 3608 | 100 % |
| selger_type (ikke ukjent) | 3600 | 100 % |
| selger_navn (forhandler) | 3298 | 91 % |
| selger_orgnr | 124 | 3 % |
| merke | 3597 | 100 % |
| modell | 3521 | 98 % |
| arsmodell | 3558 | 99 % |
| drivstoff | 1578 | 44 % |
| km_ved_kjop | 3263 | 90 % |
| kjopesum_nok | 3567 | 99 % |
| kjopsdato | 3521 | 98 % |
| overtakelsesdato | 796 | 22 % |
| forste_reklamasjon_dato | 2286 | 63 % |
| dager_til_reklamasjon | 2264 | 63 % |
| forbehold | 2457 | 68 % |
| feiltyper | 3572 | 99 % |
| utbedringskostnad_nok | 2241 | 62 % |
| bevistyper | 3544 | 98 % |
| kravtyper | 3576 | 99 % |
| prinsipalt_krav | 3550 | 98 % |
| mangelsgrunnlag | 3561 | 99 % |
| tvistetema | 3608 | 100 % |
| krevd_totalt_nok | 3510 | 97 % |
| utfall | 3608 | 100 % |
| tilkjent_totalt_nok | 2057 | 57 % |
| enstemmig | 3505 | 97 % |
| lov | 3548 | 98 % |
| lovversjon (ikke ukjent) | 200 | 6 % |
| paragrafer | 3599 | 100 % |
| sammendrag | 3608 | 100 % |
| sitat for utfall | 3597 | 100 % |

## 5. Kvalitet og treffsikkerhet

- Flagget for manuell kontroll: **891 av 3608** (25 %).
- Kontrollert i kvalitetssjekken på /data: **30**, hvorav **30 riktige** og **0 feil** – treffsikkerhet 100 %.
- Gjennomsnittlig konfidens fra modellen: 0.84.

**Vanligste grunner til flagg**

| Grunn | Vedtak |
| --- | --- |
| krevd_totalt_nok mangler sitat | 251 |
| tilkjent_totalt_nok mangler sitat | 182 |
| utfall medhold, men tilkjent < krevd | 88 |
| sitat for forbehold finnes ikke ordrett i vedtaket | 85 |
| utbedringskostnad_nok mangler sitat | 69 |
| kontrollkallet fant 1 gjenværende personopplysning | 67 |
| lav konfidens | 50 |
| selger_type mangler sitat | 41 |
| sitat for kjopesum_nok finnes ikke ordrett i vedtaket | 26 |
| sitat for utbedringskostnad_nok finnes ikke ordrett i vedtaket | 25 |
| tilkjent_erstatning_nok mangler sitat | 21 |
| sitat for selger_type finnes ikke ordrett i vedtaket | 21 |

## 6. Kostnad

| Steg | Dokumenter | Kostnad | Per dokument |
| --- | --- | --- | --- |
| Klassifisering | 4544 | $31.58 | $0.0069 |
| Tolking inkl. personvernkontroll | 3608 | $182.07 | $0.0505 |

Tolking tar i snitt 17 sekunder per vedtak (8 parallelle kall i full kjøring). Modell: claude-sonnet-5-5. Kostnaden for kall som feilet eller ble tolket på nytt er ikke med i tallene over.

## 7. Kjente hull og svakheter

- **Utvalgsskjevhet:** Bare saker som endte med vedtak er med. Forlik, trukne saker og saker løst før utvalget mangler, så «vinnersjanse» betyr sjanse *gitt at saken går til vedtak*.
- **robots.txt:** innsyn.onacos.no forbyr automatisert henting i robots.txt. Prosjekteier valgte å hente likevel (2026-09-29), med lavt tempo og tydelig User-Agent. Forbrukertilsynet bør kontaktes om varig tilgang.
- **Klassifiseringshull i hist:** Forbrukertvistutvalget sluttet å klassifisere saker i 2018. Saker fra 2018–2020 er funnet med tittelsøk, som kan ha oversett bruktbilsaker som ikke nevner «bruktbil», «brukt bil» eller «bobil».
- **Feilklassifiserte saker:** Bruktbilsaker som arkivet har lagt under andre kategorier (f.eks. «Andre kjøretøy», «Verkstedtjenester») er ikke hentet.
- **2020 og 2024–2025:** Få vedtak i 2020 (overgangen fra Forbrukertvistutvalget til Forbrukerklageutvalget) og i 2025 (prod-arkivet slutter i mai, wp-arkivet starter i juli).
- **Org.nr.:** Selgers organisasjonsnummer står sjelden i vedtakene, så oppslag på forhandler skjer mest på normalisert firmanavn.
- **Lovversjon:** Vedtakene sier sjelden eksplisitt hvilken lovversjon som gjelder; feltet er stort sett «ukjent».
- **Personvern:** Navn fjernes i to trinn (modellens liste + kode, deretter et uavhengig kontrollkall). Firmanavn som inneholder et personnavn (enkeltpersonforetak) beholdes som firmanavn. Rå PDF-er ligger bare lokalt.
- **Etterkontroll av personvern (2026-09-30):** Et søk etter 60 vanlige fornavn i alle rensede fulltekster ga 249 treff i 107 vedtak. Nesten alle var firmanavn (særlig importøren Harald A. Møller AS), «Per»/«Hans» brukt som vanlige ord, bilmodeller og gatenavn i firmaadresser. Tre vedtak hadde reelle rester (navnefragmenter i en ødelagt tabell, en fullmektigs adresse i løpende tekst og forfatternavn i en litteraturhenvisning); de er fjernet med kode og flagget. Søket fanger bare vanlige fornavn – sjeldne navn kan fortsatt finnes og må fanges i kvalitetssjekken.
- **Totaler uten sitat:** Omtrent 430 vedtak er flagget fordi krevd eller tilkjent totalbeløp ikke har eget sitat og ikke er lik summen av siterte delbeløp. Ofte oppgir vedtaket bare én samlet sum; en justert prompt kan redusere dette.
