# Skjemaet på `/sak`

Beskriver skjemaet slik det er nå: hva det spør om, hva som valideres og hva som skjer med svarene. Koden ligger i `src/app/sak/` (`skjema.tsx`, `actions.ts`) og `src/lib/feil/kategorier.ts`. Det gamle skjemaet står i `gammelt-skjema.md`.

Skjemaet har fem steg: **Kjøretøy → Feilen → Detaljer → Krav → Brev**. «Lag brev» i steg 4 kaller `finnVedtak` og går til steg 5, som viser vedtaket brevet skal vise til og avsnittet i brevet.

## Steg 1: Kjøretøy

| Felt | Type | Kilde | Krav |
|---|---|---|---|
| Registreringsnummer | tekst, maks 8 tegn | Brukeren | Gyldig etter `normaliserRegnr` |
| Merke, modell, første registreringsår, bruktimportert | Vises som kortfakta | Statens vegvesen (`/api/kjoretoy`), hentes fra regnr | Oppslaget må lykkes |
| Kjøpsdato | dato | Foreslås fra «sist registrert» hos vegvesenet. Brukeren kan endre den. | Gyldig dato, ikke i fremtiden |
| Kilometerstand ved kjøp | tall, maks 7 sifre | Brukeren | > 0 |
| Kjøpesum | tall, maks 8 sifre (kr) | Brukeren | > 0 |
| Selges bilen «som den er»? | Ja / Nei / Vet ikke | Brukeren | Må besvares |

Fristvarsel (forbrukerkjøpsloven § 27) vises når kjøpsdatoen er mer enn to år tilbake, og et strengere varsel ved mer enn fem år. Serveren avviser kjøp eldre enn fem år.

## Steg 2: Feilen

Brukeren velger én eller flere av 13 hovedkategorier og kan i tillegg krysse av underkategorier per hovedkategori. Underkategoriene er valgfrie. Minst én hovedkategori må velges.

| Kode | Hovedkategori | Underkategorier |
|---|---|---|
| 01 | Motor og eksos | turbo, registerreim/kjede, olje, kjøling/topplokk, drivstoff/injektorer, eksos/katalysator, EGR/partikkelfilter/AdBlue, annet |
| 02 | Girkasse, clutch og drivlinje | girkasse, clutch, firehjulstrekk/drivaksler/differensial |
| 03 | Bremser, understell og styring | bremser, støtdempere/hjuloppheng, styring, hjullager |
| 04 | Rust, lakk og karosseri | rust, lakk/bulker, ruter/speil |
| 05 | Fukt og interiør | fukt/vannlekkasje, lukt, seter/interiør |
| 06 | Elektrisk og elektronikk | infotainment/navigasjon/kamera, airbag/belter/ABS/sensorer, lys, startbatteri/dynamo/startmotor, annet |
| 07 | Klimaanlegg og varme | AC, varmepumpe/varmeapparat, parkeringsvarmer |
| 08 | Høyvoltbatteri og lading | kapasitet/rekkevidde, lading/ladeutstyr, hybridsystem |
| 09 | Utstyr ikke som lovet | utstyr mangler, dekk/felger, nøkler/tilbehør, feil utstyrsnivå |
| 10 | Service ikke utført som opplyst | service ikke utført, servicehefte mangler |
| 11 | Bilens historikk | skade/kollisjon, km-stand, tidligere bruk/antall eiere, import/årsmodell, ombygging, EU-kontroll, pant |
| 12 | Garanti ikke som lovet | (ingen) |
| 13 | Vet ikke ennå | varsellampe, nødmodus, lyd, vibrasjon |

Hver underkategori har en komponenttype (`KOMPONENTTYPER`). Typen «opplysning» gjelder det selgeren sa eller lovet (historikk, service, utstyr, garanti). «Vet ikke ennå» er symptomer og sammenlignes på symptomet.

## Steg 3: Detaljer

Ett kort per valgt hovedkategori. Et kort er besvart når de tre spørsmålene har svar. Neste ubesvarte kort åpnes automatisk.

| Spørsmål | Svar | Krav |
|---|---|---|
| Når viste feilen seg? | Innen 6 måneder / Mellom 6 måneder og 2 år / Mer enn 2 år (regnet fra overtakelsen) | Må besvares |
| Har et verksted undersøkt feilen? | Ja, skriftlig / Ja, muntlig / Nei | Må besvares |
| Skrev eller sa selger noe om dette før kjøpet (annonse, kontrakt, melding)? | Ja, skriftlig / Ja, muntlig / Nei | Må besvares |
| Beskrivelse | Fritekst, maks 200 tegn | Valgfri |

Hvis en feil viste seg mer enn to år etter overtakelsen, vises fristvarsel.

## Steg 4: Krav

| Felt | Svar | Krav |
|---|---|---|
| Hva krever du? | Retting / Prisavslag / Heving | Må velges |
| Har selger forsøkt å reparere feilene? | Nei / 1 gang / 2 ganger / 3 eller flere | Må besvares |
| Erstatning for utlegg | På/av. Når på: linjer med beskrivelse (maks 100 tegn) og beløp (kr). Forslag: tauing, feilsøking, leiebil, verkstedregning. | Når på: minst én linje, og hver linje må ha både beskrivelse og beløp > 0 |

Under utlegg vises en påminnelse om å legge ved fakturaer og kvitteringer.

## Steg 5: Brev

Ingen input. Siden venter mens `finnVedtak` kjører, og viser deretter vedtaket (saksnummer, dato, lenke til kilden) og avsnittet. Hvis ingen kandidater passer, brukes lovsetningen «Kravet bygger på lovens vilkår.». Ved feil vises «Vi fikk ikke laget brevet».

## Hva som skjer med svarene

`finnVedtak` får: feilvalg, tidsvalg per feil, kjøpsdato, km, første registreringsår, «som den er», krav, rettingsforsøk og detaljer per feil (beskrivelse, verksted, selgers opplysning). Svarene renses mot de kjente id-ene før bruk.

| Svar | Rangering (`src/lib/matching/`) | Sonnet-kallet (`kjoper.ts`) |
|---|---|---|
| Hovedkategori og underkategori | Ja, hovedkriterium | Ja |
| Når feilen viste seg | Ja, som tidsnivå 1–3 etter lovversjon fra kjøpsdato | Ja, med om formodningsregelen gjelder |
| Km | Ja, i intervaller | Ja |
| Bil-alder (kjøpsår minus første registreringsår) | Ja, i intervaller | Ja |
| Som den er | Ja | Ja |
| Krav | Ja, mot sanksjonene i vedtaket | Ja |
| Verksted undersøkt | Ja, når utvalget la vekt på sakkyndig dokumentasjon | Ja |
| Selger sa noe | Ja, når utvalget la vekt på selgers opplysning | Ja |
| Rettingsforsøk | Ja, i vurderingen av rettslige poeng (to eller flere forsøk) | Ja |
| Beskrivelse (fritekst) | Nei | Ja |
| **Kjøpesum** | **Nei, sendes ikke til serveren** | **Nei** |
| **Utlegg** | **Nei, sendes ikke til serveren** | **Nei** |
| **Regnr, merke, modell** | **Nei, bare registreringsåret sendes** | **Nei** |

Kommentaren øverst i `skjema.tsx` om at verkstedsvar og rettingsforsøk «ikke sammenlignes ennå» stemmer ikke lenger. Begge brukes, som tabellen viser.

## Lagring

- Ingenting lagres i databasen. Det finnes ingen saksrad eller bruker, og vegvesen-oppslaget lagres ikke.
- Svarene ligger i `sessionStorage` (nøkkel `tvistr:sak`), så en reload eller tilbake-knappen beholder dem. Resultatet lagres ikke, og siden åpner aldri på steg 5.
- Serveren begrenser antall forsøk per IP: 20 per minutt for «Lag brev», 10 per minutt for vegvesen-oppslag.

## Ikke dekket av skjemaet ennå

- Kjøpers navn, adresse og kontaktinfo.
- Selger: navn, orgnr og adresse.
- Tidslinje: dato for første reklamasjon og selgers svar.
- Beløp i kravet: kjøpesum og utlegg samles inn, men brukes ikke i vedtaksvalget.
- Vedlegg og bevis utover ja/nei per kilde.
