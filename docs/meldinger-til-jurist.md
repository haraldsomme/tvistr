# Meldingene i skjemaet: oversikt til juridisk gjennomgang

Skjemaet på `/sak` viser brukeren meldinger når svarene er umulige, strider mot hverandre eller svekker saken. Her står alle, med hvorfor de vises og hva de bygger på. Teksten er ordrett slik brukeren ser den.

**Tre slag.** Alle ser like ut i skjemaet (boks med ikon først), men betyr ulikt:
- **Stopp** (rød): svaret er umulig eller i strid med seg selv. Brukeren kommer ikke videre, og serveren avviser det samme om nettleseren skulle slippe det gjennom.
- **Advarsel** (gul): svaret er mulig, men svekker saken eller bør sjekkes. Brukeren kan gå videre. Alle advarsler samles øverst i steg 5 før betaling.
- **Info** (grå): en påminnelse uten vilkår.

**Lovversjon.** Loven regnes etter kjøpsdato: kjøp før 1.1.2024 følger forbrukerkjøpsloven (fkjl.) slik den lød da, kjøp fra 1.1.2024 den nye. Det gir ulike frister og ulik tekst enkelte steder (merket under).

**Tidsregning.** Frister regnes i kalendermåneder (31. august + 6 måneder = 28./29. februar).

**Hva jeg ber juristen se på.** Er teksten riktig juss, er den ikke for kategorisk eller villedende, og er grensen for stopp og advarsel satt riktig? Punkter jeg selv er usikker på står i siste del.

---

## 1. Datoer og frister

| # | Vises når | Nivå | Melding |
|---|---|---|---|
| 1.1 | Kjøpsdatoen ligger i fremtiden | stopp | Kjøpsdatoen kan ikke være i fremtiden. |
| 1.2 | Det er mer enn fem år siden kjøpsdatoen. «Fortsett» går til siden «Fristen er ute», der teksten står (ikke rødt ved datofeltet, se `skjema.md`, steg 2). | stopp | Det er mer enn fem år siden du overtok bilen. Den lengste fristen for å reklamere er fem år (forbrukerkjøpsloven § 27 annet ledd annet punktum), og dette brevet kan ikke brukes etter det. Mener du selger har holdt noe skjult, eller har du en garanti som gjelder lenger, bør du kontakte Forbrukerrådet eller en advokat. |
| 1.3 | (utgått: over fem år vises bare stoppen 1.2) | | |
| 1.4 | Det er mer enn to, men under fem år siden kjøpsdatoen | advarsel | **Fet:** Det er mer enn to år siden du overtok bilen. For biler gjelder som regel en frist på fem år, men for slitedeler kan fristen være to år. Selger kan bruke det. <br>+ fast tekst, se 1.5 |
| 1.5 | Alltid under 1.4 og 1.6 | (del av dem) | Fristen for å reklamere er fem år for deler som er ment å vare vesentlig lenger enn to år, ellers to år, regnet fra overtakelsen (forbrukerkjøpsloven § 27 annet ledd). Reklamasjonen må i tillegg fremsettes innen rimelig tid etter at feilen ble oppdaget (forbrukerkjøpsloven § 27 første ledd). |
| 1.6 | Minst én feil er oppdaget mer enn to år etter kjøpet (steg 3) | advarsel | **Fet:** En eller flere feil viste seg mer enn to år etter at du overtok bilen. For biler gjelder som regel en frist på fem år, men for slitedeler kan fristen være to år. Selger kan bruke det. <br>+ 1.5 |
| 1.7 | Feilen er datert samme dag som eller før kjøpet | stopp | Feilen kan ikke ha vist seg før du overtok bilen. |
| 1.8 | Feilen er datert i fremtiden | stopp | Datoen kan ikke være i fremtiden. |
| 1.9 | Verkstedrapporten er datert før feilen ble oppdaget | stopp | Rapporten kan ikke være datert før du oppdaget feilen. |
| 1.10 | Verkstedrapporten er datert i fremtiden | stopp | Datoen kan ikke være i fremtiden. |
| 1.11 | Rapport- eller reklamasjonsdato er før kjøpet eller i fremtiden (valgt i feltet) | stopp | Datoen må ligge etter kjøpsdatoen og ikke i fremtiden. |
| 1.12 | Reklamasjonen er datert før første feil ble oppdaget, eller samme dag som kjøpet eller før | stopp | Du kan ikke ha reklamert før den første feilen viste seg. Sjekk datoene. |
| 1.13 | Reklamasjonen er datert i fremtiden | stopp | Datoen kan ikke være i fremtiden. |
| 1.14 | Mer enn to måneder fra feilen ble oppdaget til reklamasjonen. Har brukeren ikke reklamert før (eller feilen kom etter den tidligere reklamasjonen), regnes det til brevets dato. | advarsel | Reklamasjon innen to måneder etter at feilen ble oppdaget er alltid i tide. Etter det vurderes det om du reklamerte innen rimelig tid. Du reklamerer mer enn to måneder etter at feilen ble oppdaget. Selger kan hevde at reklamasjonen er for sen (forbrukerkjøpsloven § 27 første ledd). Du kan likevel lage brevet. |
| 1.15 | Feilen er oppdaget innenfor 14 dager fra en frist: 6 måneder (bare kjøp før 2024), 2 år eller 5 år etter kjøpet. Må bekreftes av brukeren hvis datoen er markert «omtrentlig». | advarsel | Datoen ligger nær en frist i loven ({seks måneder / to år / fem år}). Sjekk at den stemmer; den avgjør {hvem som må bevise når feilen oppsto / om reklamasjonen er i tide}. <br>Første variant gjelder 6 måneder (før 2024) og 2 år (fra 2024). Siste variant gjelder 2 år (før 2024) og 5 år (begge versjoner). |
| 1.16 | Verkstedet undersøkte feilen mer enn seks måneder etter at den ble oppdaget | advarsel | Det gikk lang tid fra feilen ble oppdaget til verkstedet undersøkte den. Selger kan bruke det. |

**Paragrafene i meldingene** hentes fra `paragrafer.ts` for kjøpets lovversjon, slik brevet gjør. En test sjekker at ingen melding har en paragraf som ikke står der. Unntaket for grov uaktsomhet, uredelighet og avtalt lengre frist er nevnt i 1.2 uten ledd, fordi leddet ikke er kontrollert mot lovteksten for begge versjoner.

**Hvorfor.** Brevet hevder tidsnivå og om formodningsregelen (fkjl. § 18 annet ledd: 6 måneder før 2024, 2 år fra 2024) gjelder. Det regnes av koden fra datoene brukeren oppgir, så melding og påstand ikke kan stride mot hverandre. Meldingene 1.14 og 1.2–1.6 bygger på § 27 (reklamasjon innen rimelig tid, aldri kortere enn to måneder; to år, men fem år for deler ment å vare vesentlig lenger enn to år, som utvalget gjennomgående legger til grunn for bil). Meldingene om rekkefølge (1.7–1.13) er logikk: en feil kan ikke ha vist seg før overtakelsen, og brevet må ikke si noe som ikke kan ha skjedd.

## 2. Svar som strider mot hverandre eller kravet

| # | Vises når | Nivå | Melding |
|---|---|---|---|
| 2.1 | «Garanti» er valgt som feil, og brukeren svarer at selger ikke lovet noe om garanti | stopp | En garanti må være lovet. Velg hva selger sa om garantien. |
| 2.2 | Bare «Vet ikke ennå» er valgt, og kravet er heving eller prisavslag | stopp | Før årsaken er kjent, kan brevet bare kreve at feilen undersøkes og rettes. Velg retting, eller velg en feilkategori. |
| 2.3 | «Vet ikke ennå» sammen med en kjent feil, og krav om prisavslag | advarsel | Du har valgt både en kjent feil og «vet ikke». Brevet krever retting av den ukjente og prisavslag for den kjente. |
| 2.4 | «Vet ikke ennå» sammen med en kjent feil, og krav om heving | advarsel | Du har valgt både en kjent feil og «vet ikke». Brevet hever kjøpet på grunn av den kjente feilen; den ukjente er bare beskrevet. |
| 2.5 | Samme feil valgt to ganger (skjemaet kan ikke gi dette; serveren sjekker likevel) | stopp | Samme feil er valgt to ganger. |
| 2.6 | Prisavslag uten kostnadsoverslag fra verkstedet | advarsel | Uten et kostnadsoverslag fra verkstedet kan brevet ikke oppgi beløp. Brevet krever prisavslag uten å nevne et beløp. |
| 2.7 | Heving, ingen rettingsforsøk, og selger har verken avvist eller latt være å svare | advarsel | Selger kan ha rett til å forsøke retting først. Brevet tar høyde for det, men selger kan bruke det mot hevingen. |
| 2.8 | Heving, én feil, og overslaget er under 10 % av kjøpesummen | advarsel | Heving krever at mangelen ikke er uvesentlig. Når utbedringen koster lite i forhold til kjøpesummen, blir heving sjelden godtatt. Vurder prisavslag. |
| 2.9 | Verkstedet fraråder bruk, og kravet er prisavslag | advarsel | Verkstedet fraråder bruk. Retting eller heving passer ofte bedre når bilen ikke kan brukes. |
| 2.10 | Selger sa noe (skriftlig eller muntlig) om en teknisk feil før kjøpet. Gjelder alle kjøp, uansett «som den er» og lovversjon. | advarsel | Hvis selger opplyste om akkurat denne feilen før kjøpet, kan du som regel ikke reklamere på den. Sjekk hva som ble sagt, og om det gjaldt denne feilen eller noe annet. |
| 2.11 | Utleggene til sammen er høyere enn kjøpesummen | advarsel | Utleggene er høyere enn kjøpesummen. Sjekk beløpene. |
| 2.12 | Kjøpesum under 20 000 kr og krav om heving | advarsel | Ved så lav kjøpesum legger utvalget til grunn at mye må påregnes. |

**Hvorfor.** Brevet bygges av svarene og skal aldri kreve noe som ikke henger sammen. 2.2–2.4: uten kjent årsak er det bare undersøkelse og retting som kan kreves. 2.6: brevet oppgir aldri et beløp som ikke kommer fra en rapport. 2.7, 2.9 og 2.12 er skjønnsmessige og bygger på hvordan Forbrukerklageutvalget i praksis har avgjort lignende saker, ikke på lovtekst. 2.8 gjengir lovens vilkår at mangelen ikke er uvesentlig, mens grensen på 10 % er vårt skjønn (fkjl. §§ 29–32 om retting/omlevering, prisavslag og heving). 2.10: kjøperen kan ikke gjøre gjeldende det han kjente til ved kjøpet. Meldingen nevner ingen paragraf; den står i brevet.

## 3. Kjøretøy og selger

| # | Vises når | Nivå | Melding |
|---|---|---|---|
| 3.1 | Kjøpesum under 5 000 eller over 3 000 000 kr | stopp | Kjøpesummen må være mellom 5 000 og 3 000 000 kr. Sjekk beløpet. |
| 3.2 | Bilen ble første gang registrert i et senere år enn kjøpsåret | stopp | Bilen ble første gang registrert etter kjøpsdatoen. Sjekk kjøpsdatoen. |
| 3.3 | Organisasjonsnummeret har feil kontrollsiffer | stopp | Organisasjonsnummeret er ikke gyldig. Velg selgeren på nytt. |
| 3.4 | Selgeren er registrert som konkurs eller under avvikling (vises også som rød etikett på selgerkortet: «Registrert som konkurs» / «Under avvikling») | advarsel | Foretaket er registrert {som konkurs / under avvikling}. Du kan likevel lage brevet, men kravet kan være vanskelig å inndrive. |
| 3.5 | Ingen av foretakets tre næringskoder er salg av kjøretøy (45.1 og 45.4 i SN2007; 47.81, 46.71 og 47.83 i SN2025, som Brreg bruker fra 2025). Store forhandlere har ofte reparasjon (95.31) som hovedkode og salget som annen kode | advarsel | Foretaket er ikke registrert som bilforhandler. Er dette riktig selger? |
| 3.6 | Søket i Enhetsregisteret gir ingen treff | info (ren tekst) | Ingen treff. Prøv navnet slik det står i kontrakten, eller organisasjonsnummeret. Vi søker ikke etter enkeltpersonforetak, fordi navnet på dem er et personnavn. |

**Hvorfor.** 3.1–3.3 fanger tastefeil og feil registrering, så brevet ikke går til feil selger eller med feil beløp. 3.4 er praktisk informasjon om innkreving, ikke en rettslig vurdering. 3.6: søket tar bare AS, ASA, ANS, DA og NUF. Enkeltpersonforetak er holdt utenfor med vilje, fordi navnet på dem er et personnavn. Det betyr at en kjøper som har kjøpt av et enkeltpersonforetak ikke kan lage brev i dag. Å ta dem med er et eget valg.

## 4. Brukerens egen tekst (beskrivelse av feilen og rapportens konklusjon)

Brevet gjengir disse to feltene som sitat i «», aldri som sin egen setning.

| # | Vises når | Nivå | Melding |
|---|---|---|---|
| 4.1 | Teksten inneholder en lenke (http, www eller domene) | stopp | Legg ved dokumentet i stedet for lenken. |
| 4.2 | Teksten har ingen bokstaver | stopp | Skriv med ord, ikke bare tall eller tegn. |

## 5. Påminnelse og steg 5

| # | Vises når | Nivå | Tekst |
|---|---|---|---|
| 5.1 | Brukeren krever erstatning for utlegg (steg 4) | info | Husk å legge ved kopi av fakturaer og kvitteringer. Vedleggene listes opp i brevet. |
| 5.2 | Det finnes minst én advarsel før betaling | advarsel (samleboks) | Brevet har {n} advarsel/advarsler{, k av dem om datoer | om datoer, når alle er det}. Se over før du betaler. Så hver advarsel (1.x–3.x) med «Endre». |
| 5.3 | Alltid i steg 5 | ingress | Brevet bygges av svarene dine. Sjekk at alt stemmer før du betaler. Et feil registreringsnummer eller feil selger kan ikke vi se. |
| 5.5 | Alltid i steg 5, under oppsummeringen | info | Tjenesten gir ikke juridisk rådgivning. Brevet bygges av dine svar, og du er ansvarlig for at de stemmer. |
| 5.4 | Uten betaling | ingress | Dette er sakens bakgrunn og avsnittet som viser til en lignende sak der kjøperen fikk medhold. Resten av brevet er skjult til du har betalt. |

## 6. Feil fra oppslag og server

Disse vises som røde meldinger. Stopp-meldingene i del 1–4 kan også komme fra serveren, som kjører de samme reglene på nytt og viser den første.

| # | Vises når | Melding |
|---|---|---|
| 6.1 | Ugyldig registreringsnummer | Skriv registreringsnummeret slik det står på skiltet, for eksempel AB 12345. |
| 6.2 | Vegvesenet har ikke bilen | Vi fant ingen kjøretøy med dette registreringsnummeret. |
| 6.3 | Vegvesenet svarer ikke | Vi fikk ikke kontakt med Statens vegvesen. Prøv igjen om litt. |
| 6.4 | For mange oppslag (bil) | Du har gjort mange oppslag på kort tid. Vent et minutt og prøv igjen. |
| 6.5 | Enhetsregisteret svarer ikke eller for mange søk | Vi fikk ikke kontakt med Enhetsregisteret. Prøv igjen om litt. |
| 6.6 | For mange brevforsøk | For mange forsøk. Vent et minutt og prøv igjen. |
| 6.7 | Ingen feil valgt | Velg minst én feil. |
| 6.8 | Kjøpsdato mangler | Velg kjøpsdatoen. |
| 6.9 | Dato for oppdagelse mangler | Velg når du oppdaget hver feil. |
| 6.10 | Kontakten med selger er ufullstendig | Fyll ut kontakten med selger: dato etter kjøpet, hvordan, og hva selger har gjort (med antall forsøk hvis selger har forsøkt å rette). |
| 6.11 | Kjøp, km, kjøpesum, «som den er» eller krav mangler | Fyll ut kjøpet og kravet før du lager brevet. |
| 6.12 | Spørsmål om en feil er ubesvart | Svar på alle spørsmålene om hver feil. |
| 6.13 | Verkstedet har undersøkt skriftlig, men rapporten mangler | Fyll ut rapporten fra verkstedet for hver feil som er undersøkt skriftlig. |
| 6.14 | Bilen mangler | Bilen mangler. Gå tilbake til første steg. |
| 6.15 | Selger er ikke valgt | Velg selgeren i steg 1. |
| 6.16 | Et utlegg mangler beskrivelse eller beløp | Fyll ut beskrivelse og beløp for hvert utlegg. |
| 6.17 | Selgeren kan ikke hentes på nytt fra Enhetsregisteret | Vi fikk ikke hentet selgeren fra Enhetsregisteret. Prøv igjen, eller velg selgeren på nytt. |
| 6.18 | Vedtaket brevet viser til kan ikke bekreftes | Vi kunne ikke bekrefte vedtaket brevet viser til. Lag brevet på nytt. |
| 6.19 | Annen feil | Noe gikk galt. Prøv igjen. |

Tittelen over disse i steg 5 er «Vi fikk ikke laget brevet».

---

## Svar fra gjennomgangen og hva som er gjort

1. Stopp ved fem år beholdes som produktvalg, men teksten er ikke lenger en kategorisk påstand (1.2). Advarselen 1.3 er fjernet.
2. To måneder er en minstefrist, ikke en grense (1.14).
3. Formodningsregelen snur bevisbyrden i begge versjoner, så 1.15 står.
4. 2.7, 2.8 (terskelen 10 %) og 2.12 (20 000 kr) er skjønn og dokumentert som det i `docs/riktighet.md`.
5. Opplysning før kjøpet gjelder alle kjøp og alle forbehold (2.10).
6. 3.4 og 3.5 er praktiske råd.
7. Ansvarsfraskrivelsen står i steg 5 (5.5). Vilkår finnes ikke ennå, så der er den ikke tatt inn.

**Åpent:** enkeltpersonforetak (3.6), og leddet for unntaket i 1.2.

Alle meldingene står i koden i `src/lib/brev/tidslinje.ts`, `src/lib/brev/riktighet.ts`, `src/app/sak/rens.ts`, `src/app/sak/actions.ts`, `src/app/api/kjoretoy/route.ts` og `src/app/sak/skjema.tsx`. Reglene er også beskrevet i `docs/riktighet.md`.
