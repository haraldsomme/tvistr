# Reklamasjonsbrevet

Side: `/brev/[id]`, der id er en sak i databasen (`brevsak`). Seed: `e2e/seed.spec.ts`. Fil: `e2e/brev.spec.ts`.
Testene åpner en ekte sak med oppdiktede svar gjennom fixturen `sak` (`POST /api/sak`), som sletter saken etterpå. Oppslag mot Statens vegvesen og Brreg mockes. Kjøpsår er relative til i dag. Testdata er oppdiktede tall og navn på firma som ikke finnes.

## 1. Hovedløp: brevet etter skisse 11a
Seed: kjøpt i mars i fjor for 250 000 kr, motor, feilen innen 6 måneder, ikke opplyst før kjøpet, ikke kontaktet forhandleren, ingen rapport eller bilder.
1. Åpne `/brev` med svarene.
2. Forventet: overskrift «Reklamasjon på mangel – …». Brevet nevner § 16, § 18, § 27, «jf. § 29 og § 30», «250 000 kr», «Jeg ble heller ikke opplyst om feilen før kjøpet.» og en svarfrist («innen 14 dager … innen <dato>»). Plassholderne `[Ditt navn]`, `[Forhandlerens navn]` og `[Beskriv feilen …]` er synlige.

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

## 6. Fra vurderingen til brevet og tilbake
`/api/vurder` og `/api/kjoretoy` mockes.
1. Åpne `/vurdering` med komplette svar. Vurderingen vises.
2. Klikk «Betal med vipps». Forventet: adressen er `/brev/<id>` uten svar i adressen, og brevet er synlig. Fyll inn registreringsnummer.
3. Klikk «← Tilbake til vurderingen». Forventet: `/vurdering` med de samme svarene, og vurderingen synlig.
4. Klikk «Betal med kort». Forventet: samme `/brev/<id>` som i steg 2, med kjøretøyet i behold.

## 7. Registreringsnummer henter kjøretøyet inn i brevet
`/api/kjoretoy` mockes med et oppdiktet kjøretøy (Testmerke Modell X, 2019, ZZ 99999).
1. Åpne `/brev`. Panelet «Fyll inn det som mangler» er en nummerert liste. Steg 1, «Registreringsnummer», er aktivt (markert med «1» og «Mangler»), og «Hent kjøretøy» er deaktivert.
2. Skriv `zz 99999`. Feltet viser store bokstaver. Klikk «Hent kjøretøy».
3. Forventet: overskriften i brevet er «Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999», plassholderen `[reg.nr.]` er borte, steg 1 er ikke lenger aktivt og viser en hake i stedet for «1» (ingen «Mangler»), panelet viser «Testmerke Modell X · 2019 · hentet fra Statens vegvesen», adressen har ingen parametre, og kjøretøyet står der etter en reload.
4. Klikk «Endre». Forventet: steg 1 er aktivt igjen, feltet er tilbake med nummeret i, brevet har plassholderne igjen, også etter en reload.

## 8. Registreringsnummer som ikke finnes
`/api/kjoretoy` mockes med 404 og feilmelding.
1. Skriv et nummer og klikk «Hent kjøretøy».
2. Forventet: feilmeldingen «Vi fant ingen kjøretøy med dette registreringsnummeret.» vises ved feltet, feltet står igjen, og brevet har fortsatt `[reg.nr.]`.

Steg 2, «Forhandler», er nummerert men lukket (ingen felt) til steg 1 er ferdig; da blir det aktivt og viser «Mangler».

## 9. Forhandler søkes opp i Brreg
`/api/kjoretoy` og `/api/firma` mockes (Testbil AS, org.nr. 999 888 777). Steg 1 gjøres først.
1. Skriv «testbil» i «Forhandler». Listen viser «Testbil AS» med «Oslo · org.nr 999 888 777» under (ikke bransje). Velg den.
2. Forventet: mottakeren i brevet er «Testbil AS» med linjen «Org.nr. 999 888 777», postadressen fra Brreg («Industriveien 3», «0184 Oslo»), og plassholderne for navn og adresse er borte. Steg 2 viser hake og «Koblet til Enhetsregisteret · org.nr 999 888 777», og alt står der etter en reload.
3. Klikk «Endre» i steg 2. Forventet: steg 2 er aktivt igjen, plassholderne for navn og adresse er tilbake i brevet.

## 10. Forhandler på organisasjonsnummer
1. Skriv «999 888 777» i «Forhandler». Forventet: søket sendes med nummeret slik det er skrevet, og «Testbil AS» kan velges.

## 11. Forhandler utenfor registeret
`/api/firma` svarer uten forslag.
1. «Bruk som skrevet» er deaktivert til navnet har to tegn.
2. Skriv «Bilsalget» og klikk «Bruk «Bilsalget» som skrevet». Forventet: mottakeren er «Bilsalget» uten org.nr. og adresse (plassholderen står), og steg 2 viser «Ikke koblet til Enhetsregisteret».
3. Last siden på nytt. Forventet: forhandleren er beholdt.

## 12. Feilen, krav, vedlegg og avsender i rekkefølge
Saken åpnes med steg 1 og 2 ferdige. Kjøpt 12. mars i fjor, forhandleren ikke kontaktet, ingen uriktige opplysninger.
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
`PATCH /api/sak/[id]` svarer 400 på reklamasjon eller feildato før kjøpsdagen, negativt beløp, ugyldig postnummer og ukjente felt (også `kjopsdato`, som ikke kan lagres på brevsiden), og 200 på en gyldig reklamasjon.

Påvirker ikke `registreringsflyt.spec.ts`: overskriften «Få reklamasjonsbrevet» og knappenes tekst er uendret.

## 18. Kjøpsdato i vurderingsskjemaet
Fil: `e2e/registreringsflyt.spec.ts`.
1. Steg 1 har en datovelger «Når kjøpte du bilen?», ikke år og måned. «Neste» er deaktivert til dato, kjøpesum og kilometerstand er fylt inn.
2. En dato i morgen godtas ikke. En dag i fjor godtas.
3. En gammel lenke med `kjopAr` og `kjopManed` åpner skjemaet med siste dag i måneden.
4. Gjennom hele flyten: datoen står i adressen som `kjopsdato=<dato>`, og skjemaet viser den igjen etter «Endre svar».
