# Skjemaet på `/sak`

Beskriver skjemaet slik det er nå: hva det spør om, hva som valideres og hva som skjer med svarene. Koden ligger i `src/app/sak/` (`skjema.tsx`, `actions.ts`) og `src/lib/feil/kategorier.ts`. Det gamle skjemaet står i `gammelt-skjema.md`.

Skjemaet har fem steg: **Kjøretøy → Feilen → Detaljer → Krav → Brev**. «Lag brev» i steg 4 kaller `finnVedtak` (vedtaket brevet viser til) og deretter `byggBrevet` (hele brevet, se `brev.md`), og går til steg 5, som viser brevet.

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

Ett kort per valgt hovedkategori. Et kort er besvart når de tre spørsmålene har svar, og når verkstedet har undersøkt feilen skriftlig, når rapporten også er fylt ut. Neste ubesvarte kort åpnes automatisk, men ikke mens kjøperen skriver i rapporten.

| Spørsmål | Svar | Krav |
|---|---|---|
| Når viste feilen seg? | Innen 6 måneder / Mellom 6 måneder og 2 år / Mer enn 2 år (regnet fra overtakelsen) | Må besvares |
| Har et verksted undersøkt feilen? | Ja, skriftlig / Ja, muntlig / Nei | Må besvares |
| Skrev eller sa selger noe om dette før kjøpet (annonse, kontrakt, melding)? | Ja, skriftlig / Ja, muntlig / Nei | Må besvares |
| Beskrivelse | Fritekst, maks 200 tegn | Valgfri |

Hvis en feil viste seg mer enn to år etter overtakelsen, vises fristvarsel.

### Rapport fra verkstedet

Svarer kjøperen «Ja, skriftlig» på verkstedspørsmålet, utvides kortet med rapporten. Den er kjøperens sitat fra et dokument, på samme måte som vedtakssitatene er sitater fra vedtaket.

| Felt | Svar | Krav |
|---|---|---|
| Hvem undersøkte bilen? | Uavhengig verksted / Selgers eget verksted / Merkeverksted | Påkrevd |
| Verkstedets navn | Tekst, maks 60 tegn | Påkrevd |
| Dato for rapporten | Dato | Påkrevd, etter kjøpsdatoen og ikke i fremtiden |
| Hva sier rapporten? | Avkrysning, flere mulig (se under) | Minst én |
| Kostnadsoverslag for utbedring | Tall i kr. Vises bare når «inneholder kostnadsoverslag» er krysset av. | Valgfritt |
| Rapportens konklusjon, ordrett | Tekst, maks 300 tegn | Valgfritt |

Avkrysningene (teksten i skjemaet, og setningen i brevet, `src/lib/brev/rapport.ts`): rapporten bekrefter feilen, angir årsaken, sier at feilen har utviklet seg over tid og var til stede ved levering, sier at feilen ikke er normal slitasje, fraråder bruk av bilen, og inneholder kostnadsoverslag. Det som ikke er krysset av, gir ingen setning. Hjelpetekst: «Kryss bare av det rapporten faktisk sier. Forhandleren kan be om å få se den.»

«Samme rapport som forrige feil» står på kortet når en tidligere feil har en utfylt rapport. Den kopierer hvem, navn og dato, og nullstiller avkrysningene, konklusjonen og overslaget, så kjøperen krysser av på nytt for denne feilen. Samme verksted og dato er én rapport i vedleggslisten.

Konklusjonen renses bare for trim, lengde (300 tegn) og doble anførselstegn; linjeskift blir mellomrom. Brevet setter «» rundt den.

## Steg 4: Krav

| Felt | Svar | Krav |
|---|---|---|
| Hva krever du? | Retting / Prisavslag / Heving | Må velges |
| Erstatning for utlegg | På/av. Når på: linjer med beskrivelse (maks 100 tegn) og beløp (kr). Forslag: tauing, feilsøking, leiebil, verkstedregning. | Når på: minst én linje, og hver linje må ha både beskrivelse og beløp > 0 |
| Hvem kjøpte du bilen av? | Søk på navn eller org.nr. i Enhetsregisteret (`/api/firma`, åpent oppslag uten nøkkel). Brukeren velger ett treff. | Må velges |

### Kontakt med selger

Én blokk i stedet for to spørsmål, slik at svarene ikke kan stride mot hverandre: har selger forsøkt å rette, har kjøperen nødvendigvis reklamert.

| Spørsmål | Svar | Vises når |
|---|---|---|
| Har du reklamert til selger? | Ja / Nei | Alltid |
| Når reklamerte du første gang? | Dato, etter kjøpsdatoen og ikke i fremtiden | Ja |
| Hvordan? | Skriftlig / Muntlig | Ja |
| Har selger forsøkt å rette feilen? | Nei / 1 gang / 2 ganger / 3 eller flere | Ja |
| Hva svarte selger? | Avviste kravet / Har ikke svart / Tilbød retting / Annet | Ja |

Svarer kjøperen «Nei», er brevet selve reklamasjonen: de andre svarene tømmes, rettingsforsøk er 0 og selgers svar er ingen. Serveren gjør det samme uansett hva nettleseren sender (`rensKontakt` i `rens.ts`), så rettingsforsøk uten reklamasjon er umulig. Svarene brukes i brevet (avsnitt 1, 3 og 4, se `brev.md`).

Under utlegg vises en påminnelse om å legge ved fakturaer og kvitteringer. Selgersøket finner aksjeselskaper og lignende, ikke enkeltpersonforetak (`src/lib/brreg.ts`). Bare det valgte treffet (navn, org.nr., kommune, status) beholdes i skjemaet; brevet adresseres fra registeret på nytt på serveren.

## Steg 5: Brev

Ingen input. Siden venter mens `finnVedtak` og `byggBrevet` kjører, og viser deretter brevet slik det vil se ut på papir (`Brevvisning` i `skjema.tsx`).
- **Før betaling:** forhåndsvisning med hode, avsnitt 1 og vedtaksavsnittet. Resten er grå felt, og teksten under dem sendes aldri til nettleseren. Under står en Vipps-knapp som ikke virker ennå.
- **Etter betaling** (i utvikling: `TVISTR_HELT_BREV_UTEN_BETALING=1`): hele brevet, med «Kopier tekst» og «Last ned som Word».
- Hvis ingen kandidat passer, brukes ingen praksis i brevet. Ved feil vises «Vi fikk ikke laget brevet» med «Prøv igjen».

## Hva som skjer med svarene

`finnVedtak` får: feilvalg, tidsvalg per feil, kjøpsdato, km, første registreringsår, «som den er», krav, kontakten med selger (rettingsforsøk, og 0 uten reklamasjon) og detaljer per feil (beskrivelse, verksted, selgers opplysning, og hva en skriftlig verkstedrapport sier). Svarene renses mot de kjente id-ene før bruk (`src/app/sak/rens.ts`).

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
| Hva verkstedrapporten sier (avkrysningene) | Nei | Ja, som `rapport_sier` per feil, så modellen kan foretrekke et vedtak der utvalget la vekt på sakkyndig dokumentasjon |
| Beskrivelse (fritekst) | Nei | Ja |
| **Kjøpesum** | **Nei** | **Nei** |
| **Utlegg** | **Nei** | **Nei** |
| **Rapportens navn, dato, hvem og konklusjon, og overslaget** | **Nei** | **Nei** |
| **Regnr, merke, modell** | **Nei, bare registreringsåret** | **Nei** |
| **Selger, når kjøperen reklamerte og hva selger svarte** | **Nei** | **Nei** |

`byggBrevet` får i tillegg til dette det som bare brevet bruker: kjøpesum, utlegg, hele rapporten per feil, regnr, merke, modell, selgerens org.nr., hele kontakten med selger, og vedtaksavsnittet fra `finnVedtak`. Hvilke setninger hvert svar gir, står i `brev.md`. Vedtaksvalget ser fortsatt ikke kjøpesum, utlegg, rapportens navn, dato eller konklusjon, overslag, selger eller kontakten utover antall rettingsforsøk.

## Lagring

- Ingenting lagres i databasen. Det finnes ingen saksrad eller bruker, og vegvesen-oppslaget lagres ikke.
- Svarene, inkludert valgt selger, kontakten med selger og rapportene, ligger i `sessionStorage` (nøkkel `tvistr:sak`), så en reload eller tilbake-knappen beholder dem. Brevet og vedtaket lagres ikke, og siden åpner aldri på steg 5.
- Ordre-id fra Vipps skal lagres i `sessionStorage` (`tvistr:ordre`) slik at en omlasting etter betaling finner brevet igjen. Det gjør Vipps-oppgaven; skjemaet leser nøkkelen og sender den med.
- Serveren lagrer ingenting om brevet. Selgerens navn og adresse hentes fra Enhetsregisteret ved hvert brev, og kjøperen hentes fra Vipps-profilen.
- Serveren begrenser antall forsøk per IP: 20 per minutt for «Lag brev» (både `finnVedtak` og `byggBrevet`), 10 per minutt for vegvesen-oppslag og 60 for selgersøket. Grensene er slått av mens vi tester (`src/lib/rategrense.ts`).

## Ikke dekket av skjemaet ennå

- Kjøpers navn, adresse og kontaktinfo: kommer fra Vipps-profilen (stub), ikke fra skjemaet.
- Selgers svar på reklamasjonen.
- Overtakelsesdato: kjøpsdatoen brukes i stedet.
- Enkeltpersonforetak og privat selger.
- Vedlegg og bevis utover ja/nei per kilde. Vedleggslisten i brevet følger av svarene.
