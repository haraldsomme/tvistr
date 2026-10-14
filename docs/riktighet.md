# Riktighet: reglene som hindrer at brevet sier noe usant

Brevet bygges av kjøperens svar (`docs/brev.md`). Det kan bare bli så riktig som svarene, så svarene vurderes før brevet bygges. Vurderingen skjer i to rene funksjoner, og de samme to brukes overalt:
- `src/lib/brev/tidslinje.ts`: datoene og rekkefølgen mellom dem
- `src/lib/brev/riktighet.ts`: alt annet

**Hvor reglene brukes:**
- **Skjemaet** kaller begge ved hver endring og viser meldingen ved feltet. Stopp er rødt og hindrer «Fortsett». Advarsler er gule og hindrer ikke.
- **Serveren** (`src/app/sak/rens.ts`) kjører begge på nytt og avviser ved stopp. Klienten kan ikke omgå dem.
- **Steg 7** (forhåndsvisningen) viser alle advarslene samlet før betaling, med «Endre» tilbake til feltet.
- **Testene** krever ingen stopp på de 12 gylne sakene, og de kjører invariantene på hvert brev.

**Stopp** betyr at svaret er umulig eller i strid med seg selv. **Advarsel** betyr at svaret er mulig, men svekker saken eller bør sjekkes.

Lese sammen med brevene i `jurist-gjennomgang.md`.

## Tidslinjen

Kjøperen oppgir datoer; koden regner all inndeling fra dem. «Når viste feilen seg?» er en dato per feil (dagen kjøperen først merket feilen), med «Datoen er omtrentlig» som valg. Tidsnivå, formodning og frister regnes fra datoen etter lovversjonen (seks måneder før 2024, to år fra 2024, to og fem år for reklamasjonen), med kalendermåneder.

| Regel | Nivå | Melding |
|---|---|---|
| Kjøpsdato i fremtiden | stopp | Kjøpsdatoen kan ikke være i fremtiden. |
| Kjøpsdato mer enn fem år tilbake | stopp | Det er mer enn fem år siden du overtok bilen. Den lengste fristen for å reklamere er fem år (forbrukerkjøpsloven § 27 annet ledd annet punktum), og dette brevet kan ikke brukes etter det. Mener du selger har holdt noe skjult, eller har du en garanti som gjelder lenger, bør du kontakte Forbrukerrådet eller en advokat. |
| Feilen oppdaget samme dag som eller før kjøpet | stopp | Feilen kan ikke ha vist seg før du overtok bilen. |
| Feilen oppdaget i fremtiden | stopp | Datoen kan ikke være i fremtiden. |
| Rapporten datert før feilen ble oppdaget | stopp | Rapporten kan ikke være datert før du oppdaget feilen. |
| Rapporten datert i fremtiden | stopp | Datoen kan ikke være i fremtiden. |
| Reklamasjonen før den første feilen ble oppdaget (eller samme dag som kjøpet) | stopp | Du kan ikke ha reklamert før den første feilen viste seg. Sjekk datoene. |
| (Ingen melding.) Reklamasjonen før en senere feil ble oppdaget | – | Ikke en feil: den tidligere reklamasjonen gjaldt bare feilene som var oppdaget, og brevet reklamerer på resten (`reklamasjonFor`, se `brev.md`, «Kontakt med selger»). |
| Reklamasjonen i fremtiden | stopp | Datoen kan ikke være i fremtiden. |
| Reklamasjonen mer enn to måneder etter at en feil ble oppdaget. Har kjøperen ikke reklamert før, eller kom feilen etter den tidligere reklamasjonen, regnes det fra brevets dato. | advarsel | Reklamasjon innen to måneder etter at feilen ble oppdaget er alltid i tide. Etter det vurderes det om du reklamerte innen rimelig tid. Du reklamerer mer enn to måneder etter at feilen ble oppdaget. Selger kan hevde at reklamasjonen er for sen (forbrukerkjøpsloven § 27 første ledd). Du kan likevel lage brevet. |
| Feilen oppdaget innenfor 14 dager fra en frist: seks måneder (bare før 2024), to år eller fem år etter kjøpet | advarsel, som må bekreftes når datoen er omtrentlig | Datoen ligger nær en frist i loven ({frist}). Sjekk at den stemmer; den avgjør hvem som må bevise når feilen oppsto. Før 2024 er to og fem år frister for reklamasjonen, og da står det i stedet «den avgjør om reklamasjonen er i tide». |
| Rapporten mer enn seks måneder etter at feilen ble oppdaget | advarsel | Det gikk lang tid fra feilen ble oppdaget til verkstedet undersøkte den. Selger kan bruke det. |

Datovelgerne hindrer det meste før det skjer: oppdaget, rapport og reklamasjon kan bare velges fra dagen etter kjøpet til i dag.

**Fristvarslene ved datofeltene** (ikke regler, bare tekst): kjøp mer enn to år tilbake og en feil oppdaget mer enn to år etter overtakelsen viser hver sin gule boks med `§`, og under den teksten `fristTekst` i `tidslinje.ts`. Over fem år vises bare stoppen. Paragrafene i meldingene hentes fra `paragrafer.ts` for kjøpets lovversjon; en test i `tidslinje.test.ts` sjekker det. Fullstendig oversikt over alle meldinger: `docs/meldinger-til-jurist.md`.

## Svar som strider mot hverandre

| Regel | Nivå | Melding |
|---|---|---|
| «Garanti ikke som lovet» uten at selger sa noe | stopp | En garanti må være lovet. Velg hva selger sa om garantien. |
| Bare «Vet ikke ennå» og krav om heving eller prisavslag | stopp | Før årsaken er kjent, kan brevet bare kreve at feilen undersøkes og rettes. Velg retting, eller velg en feilkategori. |
| «Vet ikke ennå» sammen med en kjent feil, og krav om prisavslag | advarsel | Du har valgt både en kjent feil og «vet ikke». Brevet krever retting av den ukjente og prisavslag for den kjente. |
| «Vet ikke ennå» sammen med en kjent feil, og krav om heving | advarsel | Du har valgt både en kjent feil og «vet ikke». Brevet hever kjøpet på grunn av den kjente feilen; den ukjente er bare beskrevet. |
| Samme feil valgt to ganger | stopp | Samme feil er valgt to ganger. (Skjemaet kan ikke gi dette; serveren sjekker likevel.) |
| Erstatning for utlegg uten linjer, eller en linje uten beløp | stopp | Fyll ut beskrivelse og beløp for hvert utlegg. |
| Prisavslag uten rapport med kostnadsoverslag | advarsel | Uten et kostnadsoverslag fra verkstedet kan brevet ikke oppgi beløp. Brevet krever prisavslag uten å nevne et beløp. |
| Prisavslag, og overslag for noen, men ikke alle, kjente feil («vet ikke ennå» regnes ikke med) | advarsel | Kostnadsoverslag mangler for {feil}. Brevet krever prisavslag for {den / dem} uten beløp. |
| Heving uten rettingsforsøk, og selger har ikke avvist eller latt være å svare | advarsel | Selger kan ha rett til å forsøke retting først. Brevet tar høyde for det, men heving står svakere. |
| Heving, ett feil, og overslaget under 10 % av kjøpesummen (terskelen er skjønn, ikke lov) | advarsel | Heving krever at mangelen ikke er uvesentlig. Når utbedringen koster lite i forhold til kjøpesummen, blir heving sjelden godtatt. Vurder prisavslag. |
| Rapporten fraråder bruk, og krav om prisavslag | advarsel | Verkstedet fraråder bruk. Retting eller heving passer ofte bedre når bilen ikke kan brukes. |
| Selger opplyste om en teknisk feil før kjøpet (alle kjøp, uansett «som den er»). For en side med bare tekniske feil svarer kjøperen Ingenting / Selger sa det var i orden eller nylig utbedret / Selger opplyste om feilen; bare det siste advarer. På sider med blandede typer advarer «skriftlig» og «muntlig» som før. | advarsel | Hvis selger opplyste om akkurat denne feilen før kjøpet, kan du som regel ikke reklamere på den. Sjekk hva som ble sagt, og om det gjaldt denne feilen eller noe annet. |
| Utleggene til sammen over kjøpesummen | advarsel | Utleggene er høyere enn kjøpesummen. Sjekk beløpene. |
| Rapport fra selgers eget verksted med «til stede ved levering» | ingen | Gyldig. Brevet kaller verkstedet «deres eget verksted», aldri uavhengig. |
| Rettingsforsøk uten reklamasjon, eller sammen med «ikke svart» eller «tilbudt retting» | umulig | Antall forsøk spørres bare under «Hva har selger gjort? → Forsøkt å rette», og serveren setter forsøkene til 0 for alle andre svar og uten reklamasjon. |

## Kjøretøy og tall

| Regel | Nivå | Melding |
|---|---|---|
| Kjøpesum under 5 000 eller over 3 000 000 kr | stopp | Kjøpesummen må være mellom 5 000 og 3 000 000 kr. Sjekk beløpet. |
| Kjøpesum under 20 000 kr og krav om heving (grensen er skjønn, ikke lov) | advarsel | Ved så lav kjøpesum legger utvalget til grunn at mye må påregnes. |
| Første registrering etter kjøpsåret | stopp | Bilen ble første gang registrert etter kjøpsdatoen. Sjekk kjøpsdatoen. |
| Registreringsnummeret finnes ikke hos vegvesenet | stopp | Som før: bilen kan ikke velges uten et treff. |
| Bruktimportert | ingen regel | Brevet sier aldri «norsk bil» (sjekket av invariantene). |

## Selger

| Regel | Nivå | Melding |
|---|---|---|
| Organisasjonsnummeret har feil kontrollsiffer (modulus 11) | stopp | Organisasjonsnummeret er ikke gyldig. Velg selgeren på nytt. |
| Foretaket er registrert som konkurs eller under avvikling | advarsel | Foretaket er registrert {som konkurs / under avvikling}. Du kan likevel lage brevet, men kravet kan være vanskelig å inndrive. |
| Næringskoden er ikke bilhandel (45.1) | advarsel | Foretaket er ikke registrert som bilforhandler. Er dette riktig selger? |
| Forretningsadressen mangler | ingen | Brevet utelater adresselinjene. |

## Kjøperens egen tekst (beskrivelse og rapportens konklusjon)

Dette er de eneste stedene kjøperen kan skrive noe brevet gjengir ordrett.

**Rensingen** (`rensFritekst`):
- trim
- maks lengde: 200 tegn for beskrivelsen og 300 for konklusjonen
- linjeskift blir mellomrom, og doble mellomrom blir enkle
- doble anførselstegn fjernes (" “ ” „ « »), fordi brevet setter «» rundt teksten

| Regel | Nivå | Melding |
|---|---|---|
| Lenke (http, www eller et domene) | stopp | Legg ved dokumentet i stedet for lenken. |
| Bare tall eller tegn, ingen bokstaver | stopp | Skriv med ord, ikke bare tall eller tegn. |

I brevet står teksten alltid som sitat i «», aldri som brevets egen setning. En feil der er derfor synlig som kjøperens ord.

## Vedtaket i sammenheng med resten

- **Tidsnivået** vedtaksvalget får, er regnet fra datoene (`tidsnivaFor`). Modellen leser fortsatt intervallordene («Innen 6 måneder» osv.), regnet fra datoen.
- **Lovversjonen** regnes ett sted, `lovversjon(kjopsdato)` i `paragrafer.ts`. En test sjekker at grensen «2024-01-01» ikke står i noen annen kildefil.
- **Annen lovversjon i vedtaket:** gjaldt vedtaket den andre lovversjonen enn kjøperens (`vedtak.lovversjon_avledet`), står det etter vedtaksavsnittet:
  - «Vedtaket ble avgjort etter loven slik den lød før 1.1.2024.»
  - eller «… slik den lyder fra 1.1.2024.»
  
  Er versjonen ukjent, står ingenting.
- **Sammenligningen** i vedtaksavsnittet bruker samme alder og km som avsnitt 1. Det testes på de gylne brevene.
- **Vedtaksavsnittet signeres** av serveren når det lages (`signatur.ts`), og `byggBrevet` bygger bare brev med et avsnitt serveren selv har signert. Ingen tekst fra nettleseren kommer inn i brevet.

## Invariantene (testet på hvert brev)

`src/lib/brev/brev.invarianter.test.ts` kjøres på de 12 gylne brevene og på 200 genererte saker. Generatoren lager bare saker uten stopp, og testen sjekker at den gjør det. For hvert brev gjelder:
- Ingen `undefined`, `null`, `NaN`, tomme «» eller doble mellomrom.
- Ingen setning uten kilde.
- Alle paragrafer finnes i tabellen for kjøperens lovversjon.
- Alle datoer finnes i tidslinjen eller er brevets dato.
- Alle tall finnes i svarene (kjøpesum, km, overslag, utlegg, sum, første registreringsår) eller i navnet på bilen, regnr eller org.nr.
- Avsender og signatur kommer fra Vipps, mottakeren fra Enhetsregisteret, bilen fra vegvesenet og verkstedet fra kjøperens rapport.
- Kravet nevner ett av retting, prisavslag og heving, og det er kjøperens.
- Vedleggene følger av svarene, og alt brevet sier «vedlegges» eller «følger vedlagt» om, står i listen. Et dokument som vedlegges, står med navn, aldri «Dokumentasjon vedlegges». «Annonse/kjøpekontrakt» står når, og bare når, selger skrev noe som hjelper kjøperen.
- Uten tidligere reklamasjon står «Jeg reklamerer herved». Med tidligere reklamasjon nevner rettingsforsøkene aldri en feil oppdaget etter den, og hver slik feil står i en «… reklameres herved.»-setning.
- Ingen forbudte ord («klart», «åpenbart», «utvilsomt», «garantert», «jeg er klar over», «jeg mener»), og aldri «norsk bil».
- Høyst to A4-sider ved tre feil. Dette er et anslag (88 tegn per linje, 54 linjer per side), ikke en side i Word.

En egen test planter et brudd av hvert slag og ser at invariantene fanger det.

Testsakene i `src/lib/brev/testsak.ts` går gjennom de samme reglene: `lagSak` nekter en sak som tidslinjen eller riktighetsreglene stopper (`stoppFor`), og kombinasjons-snapshotene utelater slike kombinasjoner og sier hvor mange i overskriften. Den gylne testen sjekker det samme for de tolv sakene. Slik kan ingen snapshot vise et brev skjemaet aldri ville laget (en reklamasjon datert før feilen slapp tidligere gjennom på denne måten).

## Oppsummeringen før betaling

Steg 7 (forhåndsvisningen) viser advarslene øverst med antall: «Brevet har {n} advarsler, {k} av dem om datoer. Se over før du betaler.», hver med «Endre», som fører tilbake til feltet (steg 2, 3, 5 eller 6). Under forhåndsvisningen står oppsummeringen i tabellform under «Se over opplysningene i brevet»: bil, kjøpsdato, km, kjøpesum, «som den er», hver feil med dato og rapport, reklamasjon, krav, utlegg og selger, med «Endre» per rad. «Lås opp hele brevet» viser skiltet og bilen, siden bilen ikke kan byttes etter kjøpet.

Dette er stedet som fanger det som er mulig, men galt, som feil regnr eller feil selger valgt i søket.

Vurderingen i steg 4 bruker de samme advarseltekstene som grunner når saken står svakt (`docs/vurdering.md`): `OVER_TO_AAR_FEIL`, og de nye `SOM_DEN_ER_GAMMEL` (steg 2) og slitedel etter seks måneder (steg 3). De to nye er bare advarsler i skjemaet og vurderingen; de er ikke regler i `riktighet.ts` og stopper ingenting.

## Logg per brev

`byggBrevet` logger én linje per brev, uten persondata:
- lovversjon
- tidsnivå per feil
- nivå A eller B, og vedtakets saksnummer
- antall advarsler, og hvilke regler som slo til
- om brevet var helt

Loggen viser hvilke regler som slår til ofte, og om noen er for strenge.

## Kjente gap

- **Kilometerstand.** Vegvesenets API for tekniske kjøretøyopplysninger gir ikke kilometerstand («Du får ikke kjøretøyets kilometerstand i tjenesten»). Reglene om km mot siste EU-kontroll kan derfor ikke bygges.
- **Slettede foretak** kan ikke velges, fordi Brreg svarer 410 for slettede enheter. Regelen om «slettet» kan aldri slå til.
- **To sider** er et anslag, ikke en sidetelling fra Word.
- **Forskjellen fra de gamle intervallene:** skjemaet spør om dagen feilen ble oppdaget. Brevet sier «Feilen viste seg den 12. mai 2026» (med «den», som ellers i brevet) eller «i mai 2026».
- **Advarselen om frist nær seks måneder** gis bare for kjøp før 2024. Etter 2024 er seks måneder ingen frist i loven.
