# Reklamasjonsbrevet

Side: `/brev/[id]`, der id er en sak i databasen (`brevsak`). Seed: `e2e/seed.spec.ts`. Fil: `e2e/brev.spec.ts`.
Testene åpner en ekte sak med oppdiktede svar og et oppdiktet kjøretøy gjennom fixturen `sak` (`POST /api/sak`), som sletter saken etterpå. Oppslag mot Statens vegvesen og Brreg mockes. En sak finnes først når brevet er kjøpt, så brevsiden er alltid etter kjøp. Kjøpsår er relative til i dag. Testdata er oppdiktede tall og navn på firma som ikke finnes.

## 1. Hovedløp: brevet etter skisse 11a
Seed: kjøpt i mars i fjor for 250 000 kr, motor, feilen innen 6 måneder, ikke opplyst før kjøpet, ikke kontaktet forhandleren, ingen rapport eller bilder.
1. Åpne `/brev` med svarene.
2. Forventet: overskrift «Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999» (bilen følger med saken). Brevet nevner § 16, § 18, § 27, «jf. § 29 og § 30», «250 000 kr», «Jeg ble heller ikke opplyst om feilen før kjøpet.» og en svarfrist («innen 14 dager … innen <dato>»). Plassholderne `[Ditt navn]`, `[Forhandlerens navn]` og `[Beskriv feilen …]` er synlige.

## 2. Krav når forhandleren har avvist
1. Åpne `/brev` med `kontakt=avvist`.
2. Forventet: brevet krever `[prisavslag / heving av kjøpet]`, jf. § 31 og § 32, og nevner ikke § 29.

## 3. Ingen bevisbyrderegel utenfor presumsjonsperioden
1. Åpne `/brev` med kjøp for tre år siden og `oppdaget=over_2_ar`.
2. Forventet: brevet nevner ikke § 18.

## 4. Vedlegg følger beviset
1. Uten rapport og bilder: «Vedlagt følger kjøpekontrakt.» (ikke «verkstedrapport»).
2. Med verkstedrapport: «Vedlagt følger kjøpekontrakt og verkstedrapport.»

## 5. Feiltilstander og sletting
1. `/brev` uten id fører til `/vurdering` steg 1.
2. En gammel lenke `/brev?<svar>` fører til `/vurdering` med svarene i behold, og vurderingen vises.
3. `POST /api/sak` med ufullstendige svar gir 400 og ingen sak.
4. En id som ikke finnes viser «Vi finner ikke dette brevet» med lenken «Start vurderingen».
5. En utløpt sak viser det samme, og raden er borte fra databasen etterpå.
6. «Slett saken» spør først. «Avbryt» lar saken stå. «Ja, slett» sender brukeren til forsiden, raden er borte, og adressen viser «Vi finner ikke dette brevet».

## 6. Fra vurderingen til brevet
`/api/vurder` og `/api/kjoretoy` mockes (Testmerke Modell X, 2019, ZZ 99999).
1. Åpne `/vurdering?<svar>&steg=1`, hent bilen og gå gjennom de fire stegene. Vurderingen vises.
2. Forventet i kjøpspanelet: kortet «Brevet skrives for» viser `ZZ 99999`, «Testmerke Modell X», «Første gang registrert 2019» og «Bilen kan ikke byttes etter kjøpet». Panelet har ikke noe felt for registreringsnummer og ingen «Endre». (Registeret har ikke årsmodell, bare året bilen først ble registrert.)
3. Klikk «Betal med vipps». Forventet: adressen er `/brev/<id>` uten svar i adressen, og overskriften i brevet er «Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999» uten `[reg.nr.]`.
4. Forventet på brevsiden: ingen lenke «← Tilbake til vurderingen», ingen steg «Registreringsnummer», og kortet «Svarene fra vurderingen» viser «Testmerke Modell X (2019), ZZ 99999 (kan ikke endres)».

## 6b. Vurdering uten bil
En delt lenke har svarene, men ikke bilen.
1. Åpne `/vurdering?<svar>`. Vurderingen vises, kjøpspanelet viser «Brevet skrives for én bil. Legg inn registreringsnummeret først.» uten felt for nummeret, og begge kjøpsknappene er deaktivert.
2. Klikk «Legg inn registreringsnummer». Forventet: steg 1 åpnes med svarene i behold (kjøpesum «250 000»).
3. Hent bilen og gå gjennom stegene. Forventet: kortet «Brevet skrives for» vises, meldingen om manglende bil er borte, og kjøpsknappene er aktive.

## 7. Svarene fra vurderingen rettes på brevsiden
Kjøpt 12. mars i fjor for 250 000 kr, forhandleren ikke kontaktet. Forhandler og feilen er fylt inn, og «Kravet» er lagret uten valg.
1. Kortet «Svarene fra vurderingen» viser «Kjøpt 12. mars <år> for 250 000 kr», «Feil: motor» og «Kontakt med forhandleren: ingen ennå». Skjemaet er lukket.
2. Klikk «Endre svar». Skriv 260000 i «Hva kostet bilen?» (vises som «260 000»), velg «Ja, forhandleren avviste» på «Har du tatt opp feilen med forhandleren?» og klikk «Lagre».
3. Forventet: kortet og brevet viser 260 000 kr, brevet krever «jf. § 31 og § 32» og nevner ikke § 29. «Kontakt med forhandleren» er det aktive steget, og «Kravet» har ikke lenger hake, fordi svaret nå krever et valg.
4. Etter en reload står de nye svarene der.

## 8. Rettelsene på brevsiden
8a. **Rapport.** Uten rapport spør kortet om bilder. Velg «Ja» på rapport: spørsmålet om hva rapporten sier kommer, bildespørsmålet forsvinner, og «Lagre» er deaktivert til det er besvart. Etter lagring står det «Vedlagt følger kjøpekontrakt og verkstedrapport.» i brevet.
8b. **Avbryt.** Skriv 999999 som kjøpesum og klikk «Avbryt». Skjemaet lukkes, og kortet og brevet viser fortsatt 250 000 kr.
8c. **Kjøpsdato.** Flytt kjøpet til 1. oktober (avvist, med feildato 2. september og første reklamasjon 3. september fylt inn). Forventet: feildatoen og reklamasjonsdatoen er forkastet, «Feilen» er aktivt med «Tidligst 1. oktober <år>», forhandleren er beholdt, og det står etter en reload.
8d. **Fristen ute.** Flytt kjøpet seks år tilbake. Forventet: svaret lagres, brevet blir stående, og et varsel «Med disse svarene er fristen for å klage ute …» vises over det, også etter en reload. Siden sender ikke brukeren bort.
8e. **Svar som ikke lenger er fullstendige.** En sak der kjøpet nå er over fem år gammelt og forhandleren er kontaktet, men første reklamasjon ikke er datert (satt direkte i databasen). Forventet: overskriften «Svarene dine må rettes», kortet er åpent uten «Avbryt», meldingen «Velg når du første gang tok opp feilen med forhandleren.» vises, og brevet vises ikke. Velg år og måned og lagre: brevet og stegene vises.
8f. **Serveren.** `PUT /api/sak/[id]/svar` svarer 400 på ufullstendige svar, kjøp i fremtiden og tom kropp, 404 på en sak som ikke finnes, og 200 med de nye svarene, `fristUte: false` og kjøretøyet i behold ved gyldige svar.

## 9. Forhandler søkes opp i Brreg
`/api/firma` mockes (Testbil AS, org.nr. 999 888 777). «Forhandler» er første steg og er aktivt når siden åpnes.
1. Skriv «testbil» i «Forhandler». Listen viser «Testbil AS» med «Oslo · org.nr 999 888 777» under (ikke bransje). Velg den.
2. Forventet: mottakeren i brevet er «Testbil AS» med linjen «Org.nr. 999 888 777», postadressen fra Brreg («Industriveien 3», «0184 Oslo»), og plassholderne for navn og adresse er borte. Steg 1 viser hake og «Koblet til Enhetsregisteret · org.nr 999 888 777», og alt står der etter en reload.
3. Klikk «Endre» i steg 1. Forventet: steg 1 er aktivt igjen, plassholderne for navn og adresse er tilbake i brevet.

## 10. Forhandler på organisasjonsnummer
1. Skriv «999 888 777» i «Forhandler». Forventet: søket sendes med nummeret slik det er skrevet, og «Testbil AS» kan velges.

## 11. Forhandler utenfor registeret
`/api/firma` svarer uten forslag.
1. «Bruk som skrevet» er deaktivert til navnet har to tegn.
2. Skriv «Bilsalget» og klikk «Bruk «Bilsalget» som skrevet». Forventet: mottakeren er «Bilsalget» uten org.nr. og adresse (plassholderen står), og steg 1 viser «Ikke koblet til Enhetsregisteret».
3. Last siden på nytt. Forventet: forhandleren er beholdt.

## 12. Feilen, krav, vedlegg og avsender i rekkefølge
Saken åpnes med forhandleren ferdig (bilen følger med saken). Kjøpt 12. mars i fjor, forhandleren ikke kontaktet, ingen uriktige opplysninger.
1. Stegene «Kjøpsdato» (datoen kommer fra vurderingen), «Kontakt med forhandleren» og «Opplysninger før kjøpet» finnes ikke. Brevet sier «fra dere 12. mars <år>».
3. «Feilen»: «Bruk min egen tekst» er deaktivert til dato og beskrivelse er fylt inn. Fyll inn og bruk egen tekst. Forventet: «Feilen viste seg første gang 2. september <år>.» fulgt av teksten, og plassholderen er borte.
4. «Kravet»: ingen valg (forhandleren kan fortsatt rette). Lagre. Forventet: sammendraget «Retting uten kostnad for deg».
5. «Vedlegg»: kjøpekontrakt er forhåndsavkrysset. Kryss av annonsen og bekreft. Forventet: «Vedlagt følger kjøpekontrakt og annonsen.»
6. «Deg»: «Lagre» er deaktivert til navn, adresse, postnummer og sted er fylt inn. Forventet: navnet står som avsender og underskrift, stedet i datolinjen, ingen «Mangler» igjen, og brevet har ingen hakeparenteser.
7. Reload beholder alt.
8. «Endre» på «Deg», skriv noe annet, «Avbryt»: verdien er uendret.

## 13. Kontakt med forhandleren
Kontakt = forsøkt rettet.
1. Steget «Kontakt med forhandleren» er aktivt. «Lagre» er deaktivert til dato, måte og antall forsøk er valgt.
2. Forventet: «Jeg tok opp feilen med dere første gang 3. september <år> på e-post. Dere har forsøkt å rette feilen to ganger uten å lykkes.»

## 14. Kravet når forhandleren har avvist
1. Brevet har plassholderen `[prisavslag / heving av kjøpet]`. «Lagre» er deaktivert til et krav er valgt.
2. Velg prisavslag og skriv 38000 (vises som «38 000»). Legg til en utgift: «Lagre» er deaktivert til beløpet er fylt inn. Legg til verksted 4500 og tauing 2000.
3. Forventet: «krever prisavslag på 38 000 kr … jf. § 31» og «verksted og feilsøking 4 500 kr og tauing 2 000 kr, til sammen 6 500 kr».
4. «Endre», velg heving, fjern utgift 2. Forventet: «hever kjøpet, jf. § 32, og krever kjøpesummen på 250 000 kr tilbakebetalt …» og bare én utgift uten sum.

## 15. Språkvask av beskrivelsen
`/api/sak/*/sprakvask` mockes. Språkmodellen kalles aldri i testene.
1. Steget sier at teksten sendes til en språkmodell. «Lag forslag» er deaktivert til beskrivelsen er lang nok.
2. Klikk «Lag forslag». Forventet: bare beskrivelsen er sendt, forslaget vises i et eget felt, og brevet har fortsatt plassholderen.
3. Rett i forslaget og klikk «Bruk forslaget». Forventet: den rettede teksten står i brevet, ikke brukerens egne ord.
4. «Endre» viser begge tekstene. «Bruk min egen tekst» setter brukerens tekst i brevet.
5. Når ruten svarer med feil: meldingen vises, det kommer ikke noe forslagsfelt, og «Bruk min egen tekst» virker.
6. Ruten svarer 400 på for kort eller manglende beskrivelse, og 404 for en sak som ikke finnes.

## 16. Uriktige opplysninger før kjøpet
Svaret fra vurderingen er «ja, dokumentert».
1. Brevet har plassholderen `[Skriv hva annonsen eller selgeren opplyste som ikke stemte.]`, og steget «Opplysninger før kjøpet» er aktivt.
2. Velg «Annonsen» og skriv «Ny clutch i fjor». Forventet: «I annonsen ble det opplyst følgende om bilen: «Ny clutch i fjor». Dette stemmer ikke … jf. § 16.»

## 17. Serveren validerer utfyllingen
`PATCH /api/sak/[id]` svarer 400 på reklamasjon eller feildato før kjøpsdagen, negativt beløp, ugyldig postnummer og ukjente felt (også `kjopsdato`, som rettes i kortet med svarene), kjøretøy (også `null`: bilen er låst til saken), og 200 på en gyldig reklamasjon.

Påvirker ikke `registreringsflyt.spec.ts`: overskriften «Få reklamasjonsbrevet» og knappenes tekst er uendret.

## 18. Kjøpsdato i vurderingsskjemaet
Fil: `e2e/registreringsflyt.spec.ts`.
1. Steg 1 har en datovelger «Når kjøpte du bilen?», ikke år og måned. «Neste» er deaktivert til bil, dato, kjøpesum og kilometerstand er fylt inn.
2. En dato i morgen godtas ikke. En dag i fjor godtas.
3. En gammel lenke med `kjopAr` og `kjopManed` åpner skjemaet med siste dag i måneden.
4. Gjennom hele flyten: datoen står i adressen som `kjopsdato=<dato>` (registreringsnummeret står der aldri), og skjemaet viser datoen og bilen igjen etter «Endre svar».

## 19. Registreringsnummer i første steg
Fil: `e2e/bil.spec.ts`. `/api/kjoretoy` mockes. Nytt felt «Registreringsnummer» øverst i steg 1 med knappen «Hent bilen».
1. Dato, kjøpesum og kilometerstand er fylt inn, men «Neste» er deaktivert til bilen er hentet. «Hent bilen» er deaktivert til feltet har innhold.
2. Skriv `zz 99999`: feltet viser store bokstaver. Hent. Forventet: «Testmerke Modell X · 2019 · hentet fra Statens vegvesen», «Neste» er aktiv, og registreringsnummeret står ikke i adressen.
3. «Endre» tømmer bilen og deaktiverer «Neste», men beholder de andre svarene.
4. Enter i feltet henter bilen i stedet for å gå videre.
5. Bilen står etter en reload (lagres i fanen, aldri i adressen).
6. Nummer som ikke finnes (404) og Vegvesenet som ikke svarer (502): feilmeldingen vises ved feltet, og «Neste» er deaktivert.
7. Kjøpsdato fra registeret: svaret har `eierFra` (dagen bilen ble registrert på nåværende eier). Er «Når kjøpte du bilen?» tom, fylles den inn og får hjelpeteksten «Hentet fra Statens vegvesen: dagen bilen ble registrert på deg. Rett datoen hvis den ikke stemmer.» Skriver brukeren en annen dato, forsvinner teksten. En dato brukeren alt har skrevet byttes ikke ut. «Endre» på bilen tømmer et forslag som ikke er rettet. Uten `eierFra`, med en dato i fremtiden eller før 1990, står feltet tomt.

## 20. Sak uten bil
`POST /api/sak` med komplette svar men uten kjøretøy, eller med et ugyldig kjøretøy, gir 400 og ingen sak.
