# Skjemaet på `/sak`

Beskriver skjemaet slik det er nå: hva det spør om, hva som valideres og hva som skjer med svarene. Koden ligger i `src/app/sak/` (`skjema.tsx`, `actions.ts`) og `src/lib/feil/kategorier.ts`. Det gamle skjemaet står i `gammelt-skjema.md`.

Skjemaet har åtte steg: **Bilen → Kjøpet → Feilen → Vurdering → Detaljer → Krav og selger → Forhåndsvisning → Brevet**. Landingssiden (`src/app/page.tsx`) tar registreringsnummeret og sender det til `/sak?regnr=`, som slår opp bilen med en gang. Steg 4 er den gratis vurderingen (`docs/vurdering.md`): kode og database, ingen modell. «Se brevet» i steg 6 går til steg 7, som kaller `finnVedtak` (vedtaket brevet viser til, det eneste modellkallet) og `byggBrevet` (forhåndsvisningen, se `brev.md`). Betalingen fører til steg 8, hele brevet.

Rekkefølgen følger det vurderingen trenger: alt den bruker (bil, kjøp, feil og datoen hver feil ble oppdaget) kommer før steg 4, alt brevet trenger i tillegg kommer etter. Ingen spørsmål stilles to ganger.

Alle svar vurderes ved hver endring av de samme to funksjonene som serveren bruker: `tidslinje.ts` (datoene) og `riktighet.ts` (resten). Reglene og meldingene står i `riktighet.md`. Stopp vises i rødt ved feltet og hindrer «Fortsett»; advarsler vises i gult og hindrer ikke.

## Steg 1: Bilen

| Felt | Type | Kilde | Krav |
|---|---|---|---|
| Registreringsnummer | tekst, maks 8 tegn | Landingssiden eller feltet her | Gyldig etter `normaliserRegnr` |
| Merke, modell, første registreringsår, sist registrert, bruktimportert | Kortfakta under skiltet | Statens vegvesen (`/api/kjoretoy`) | Oppslaget må lykkes |
| Stemmer dette? | Ja, det stemmer / Nei, søk på nytt | Brukeren | «Ja» kreves. «Nei» tømmer bilen og viser feltet igjen. |

Et nytt nummer fra landingssiden starter en ny sak; samme nummer som den lagrede saken fortsetter den.

## Steg 2: Kjøpet

| Felt | Type | Kilde | Krav |
|---|---|---|---|
| Når overtok du bilen? | dato | Foreslått fra «sist registrert» hos vegvesenet. Hjelpetekst: «Fristene regnes fra denne datoen.» | Gyldig dato, ikke i fremtiden |
| Km ved kjøp | tall, maks 7 sifre | Brukeren | > 0 |
| Kjøpesum | tall, maks 8 sifre (kr) | Brukeren | > 0, 5 000–3 000 000 (`riktighet.ts`) |
| Står det «som den er» eller lignende i kontrakten eller annonsen? | Ja / Nei / Vet ikke | Brukeren | Må besvares |

Fristvarsel (§ 27) vises når kjøpet er mer enn to år tilbake. Er det mer enn fem år, går «Fortsett» rett til vurderingen med status «Fristen er ute» (ingen røde stopp ved datoen lenger). «Som den er» før 2024 på en bil over 10 år eller 200 000 km gir advarselen `SOM_DEN_ER_GAMMEL`, den samme som grunnen i vurderingen.

## Steg 3: Feilen

Brukeren velger én eller flere av 13 hovedkategorier og kan krysse av underkategorier for hver av dem («– hva gjelder feilen?», valgfritt). Minst én hovedkategori må velges. Deretter spør «Når oppdaget du hver feil?» om én dato per valgt hovedkategori, med «Datoen er omtrentlig», teksten «{n} måneder og {n} uker etter at du overtok bilen», advarslene fra tidslinjen og, for en slitedel oppdaget etter seks måneder, samme tekst som grunnen `slitedel_sen` i vurderingen. Datoen er flyttet hit fra «Detaljer» fordi vurderingen trenger den.

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

## Steg 4: Vurdering

Ingen spørsmål; skjermen viser resultatet av `vurderSaken`. Se `docs/vurdering.md`. «Fortsett til brevet» står i «Dette får du»; ved «Fristen er ute» stopper flyten.

## Steg 5: Detaljer

Én side per valgt hovedkategori («Feil 1 av 2» ved flere). «Fortsett» går til neste feil, og til steg 6 etter den siste; «Tilbake» går en side tilbake. En side er ferdig når begge spørsmålene har svar, en skriftlig rapport er fylt ut, og ingenting på siden stopper.

| Spørsmål | Svar | Krav |
|---|---|---|
| Er feilen undersøkt av et verksted? | Ja, og jeg har en rapport (skriftlig) / Ja, men uten rapport (muntlig) / Nei | Må besvares |
| Sa selger noe om denne feilen før kjøpet? | Nei / Skriftlig / Muntlig | Må besvares. Ved skriftlig eller muntlig om en teknisk feil vises advarselen om at en feil selger opplyste om, som regel ikke kan reklameres på. |
| Beskriv feilen med egne ord | Fritekst, maks 200 tegn. Linjeskift og doble anførselstegn fjernes; lenker og tekst med bare tall stopper. | Valgfri |

Tidsnivå, formodning og frister regnes fra datoen i steg 3 (`tidslinje.ts`); datoen gir samme tidsnivå som de gamle intervallene. En rapport datert før feilen ble oppdaget stopper her.

### Rapport fra verkstedet

Svarer kjøperen «Ja, og jeg har en rapport» på verkstedspørsmålet, utvides siden med rapporten. Den er kjøperens sitat fra et dokument, på samme måte som vedtakssitatene er sitater fra vedtaket.

| Felt | Svar | Krav |
|---|---|---|
| Hvem undersøkte bilen? | Uavhengig verksted / Selgers eget verksted / Merkeverksted | Påkrevd |
| Verkstedets navn | Tekst, maks 60 tegn | Påkrevd |
| Dato for rapporten | Dato | Påkrevd, etter kjøpsdatoen og ikke i fremtiden |
| Hva sier rapporten? | Avkrysning, flere mulig (se under) | Minst én |
| Kostnadsoverslag for utbedring | Tall i kr. Vises bare når «inneholder kostnadsoverslag» er krysset av. | Valgfritt |
| Rapportens konklusjon, ordrett | Tekst, maks 300 tegn | Valgfritt |

Avkrysningene (teksten i skjemaet, og setningen i brevet, `src/lib/brev/rapport.ts`): rapporten bekrefter feilen, angir årsaken, sier at feilen har utviklet seg over tid og var til stede ved levering, sier at feilen ikke er normal slitasje, fraråder bruk av bilen, og inneholder kostnadsoverslag. Det som ikke er krysset av, gir ingen setning. Hjelpetekst: «Kryss bare av det rapporten faktisk sier. Forhandleren kan be om å få se den.»

«Samme rapport som forrige feil» står på siden når en tidligere feil har en utfylt rapport. Den kopierer hvem, navn og dato, og nullstiller avkrysningene, konklusjonen og overslaget, så kjøperen krysser av på nytt for denne feilen. Samme verksted og dato er én rapport i vedleggslisten.

Konklusjonen renses bare for trim, lengde (300 tegn) og doble anførselstegn; linjeskift blir mellomrom. Brevet setter «» rundt den.

## Steg 6: Krav og selger

| Felt | Svar | Krav |
|---|---|---|
| Hva krever du? | Retting / Prisavslag / Heving | Må velges |
| Hvem solgte bilen? | Søk på navn eller org.nr. i Enhetsregisteret (`/api/firma`). Brukeren velger ett treff. | Må velges. Org.nr. kontrolleres med modulus 11; konkurs, avvikling og annen næring enn bilhandel gir advarsel. |
| Erstatning for utlegg | På/av. Når på: linjer med beskrivelse (maks 100 tegn) og beløp (kr). Forslag: tauing, feilsøking, leiebil, verkstedregning. | Når på: minst én linje, og hver linje må ha både beskrivelse og beløp > 0 |

### Kontakt med selger

Én blokk, slik at svarene ikke kan stride mot hverandre. Har selger forsøkt å rette, har kjøperen nødvendigvis reklamert, og selger har verken latt være å svare eller bare tilbudt retting. Derfor er det ett spørsmål om hva selger har gjort, og antall forsøk spørres bare under «Forsøkt å rette».

| Spørsmål | Svar | Vises når |
|---|---|---|
| Har du reklamert til selger? | Ja / Nei | Alltid |
| Når reklamerte du første gang? | Dato, etter kjøpsdatoen og ikke i fremtiden | Ja |
| Hvordan? | Skriftlig / Muntlig | Ja |
| Hva har selger gjort? | Ikke svart / Avvist kravet / Tilbudt retting, ikke gjennomført / Forsøkt å rette / Annet | Ja |
| Hvor mange ganger? | 1 gang / 2 ganger / 3 eller flere | «Forsøkt å rette» |

Svarer kjøperen «Nei», er brevet selve reklamasjonen: de andre svarene tømmes, rettingsforsøk er 0 og selgers svar er ingen. Rettingsforsøk er 0 for alle svar unntatt «Forsøkt å rette», som krever 1 til 3. Serveren gjør det samme uansett hva nettleseren sender (`rensKontakt` i `rens.ts`), så rettingsforsøk uten reklamasjon, eller sammen med «ikke svart» eller «tilbudt retting», er umulig. Svarene brukes i brevet (avsnitt 1, 3 og 4, se `brev.md`).

Under utlegg vises en påminnelse om å legge ved fakturaer og kvitteringer.

## Steg 7: Forhåndsvisning

Steget kaller `finnVedtak` og `byggBrevet` med en gang og viser:
- advarslene øverst med antall («Brevet har {n} advarsler, {k} av dem om datoer. Se over før du betaler.»), hver med «Endre», som går til feltet (steg 2, 3, 5 eller 6),
- forhåndsvisningen: hode, avsnitt 1 og første setning av vedtaksavsnittet; resten er grå felt, og teksten sendes aldri til nettleseren,
- «Lås opp hele brevet»: skiltet og bilen («Bilen kan ikke byttes etter kjøpet»), hva hele brevet har (med saksnummeret til vedtaket), 249 kr og betalingsknappene,
- «Se over opplysningene i brevet»: oppsummeringen i tabellform med «Endre» per rad.

Betalingsknappene er grå til Vipps er koblet på. Med `TVISTR_HELT_BREV_UTEN_BETALING=1` (bare i utvikling) simulerer «Betal med Vipps» betalingen. Hvis ingen kandidat passer, brukes ingen praksis i brevet. Ved feil vises «Vi fikk ikke laget brevet» med «Prøv igjen».

## Steg 8: Brevet

Hele brevet, bygget med samme vedtak som forhåndsvisningen (avsnittet er forseglet, se `brev.md`), med «Last ned Word» og «Kopier tekst», og «Send det selv til {selger}». Appen sender ingenting.

## Hva som skjer med svarene

`vurderSaken` (steg 4) får feilvalg, datoene, kjøpsdato, km, første registreringsår og «som den er». `finnVedtak` (steg 7) får: feilvalg, tidsvalg per feil, kjøpsdato, km, første registreringsår, «som den er», krav, kontakten med selger (rettingsforsøk, og 0 uten reklamasjon) og detaljer per feil (beskrivelse, verksted, selgers opplysning, og hva en skriftlig verkstedrapport sier). Svarene renses mot de kjente id-ene før bruk (`src/app/sak/rens.ts`).

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
- Svarene, inkludert valgt selger, kontakten med selger og rapportene, ligger i `sessionStorage` (nøkkel `tvistr:sak:v3`; svar lagret under `v2` hadde andre stegnummer og brukes ikke), så en reload eller tilbake-knappen beholder dem. Vurderingen, vedtaket og brevet lagres ikke: vurderingen hentes på nytt når steg 4 vises, og siden åpner aldri på steg 7 eller 8.
- Ordre-id fra Vipps skal lagres i `sessionStorage` (`tvistr:ordre`) slik at en omlasting etter betaling finner brevet igjen. Det gjør Vipps-oppgaven; skjemaet leser nøkkelen og sender den med.
- Serveren lagrer ingenting om brevet. Selgerens navn og adresse hentes fra Enhetsregisteret ved hvert brev, og kjøperen hentes fra Vipps-profilen.
- Målingen (`docs/vurdering.md`, «Måling») lagrer hendelser per økt uten persondata.
- Serveren begrenser antall forsøk per IP: 30 per minutt for vurderingen, 20 per minutt for brevet (både `finnVedtak` og `byggBrevet`), 10 per minutt for vegvesen-oppslag og 60 for selgersøket. Grensene er slått av mens vi tester (`src/lib/rategrense.ts`).

## Ikke dekket av skjemaet ennå

- Kjøpers navn, adresse og kontaktinfo: kommer fra Vipps-profilen (stub), ikke fra skjemaet.
- Selgers svar på reklamasjonen.
- Overtakelsesdato: kjøpsdatoen brukes i stedet.
- Enkeltpersonforetak og privat selger.
- Vedlegg og bevis utover ja/nei per kilde. Vedleggslisten i brevet følger av svarene.
