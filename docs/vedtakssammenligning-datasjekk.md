# Kan `vedtak` brukes til vedtakssammenligning i reklamasjonsbrev?

*Datasjekk 2026-10-09. Data er ikke endret; alle spørringer kjørte i skrivebeskyttede transaksjoner. Stikkprøvene er trukket med `md5(id)` og kan trekkes på nytt.*

**Grunnutvalget er 2 359 vedtak:** personbil eller varebil, utfall ≠ avvist og `lov = forbrukerkjøpsloven`.

**Kort svar:** Grunnfeltene (utfall, beløp, selger, datoer, lovversjon) holder. Det brevet trenger mest – hvilken feil som vant, hvilket grunnlag utvalget bygde på, hva selger skrev og hva bevisene sa – finnes ikke strukturert. Det krever en ny runde med uttrekk fra fulltekst (pass 2). Feltbeskrivelsen for `mangelsgrunnlag` i prompten har dessuten feil paragrafkobling og bør rettes før det.

## Sjekk 1 – Datakvalitet og volum
- **(a) Felt:** `utfall`, `selger_type`, `lovversjon`, `konfidens`, `trenger_kontroll`, `qa_status`, `vedtaksdato`.
- **(b) Dekning:**
  - Utfall: delvis medhold 45,3 %, ikke medhold 35,6 %, medhold 19,1 %.
  - Selger: forhandler 91,0 %, formidling 8,3 %, privat 0,7 % (17 saker; privatkjøp går etter kjøpsloven og faller utenfor grunnutvalget).
  - Lovversjon er `ukjent` i 92 %.
  - Konfidens: 0,8–0,9 i 83 %, ≥ 0,9 i 13 %, under 0,7 i 1,3 %.
  - `trenger_kontroll` er satt i 11 %. Mesteparten er bare merknader om personvernrensing og beløpssitater.
  - Manuell kontroll: `qa_status = 'riktig'` i 23 saker (1 %), `'feil'` i 0, resten er ukontrollert.
  - Vedtak per år: 2013: 60 · 2014: 99 · 2015: 165 · 2016: 337 · 2017: 334 · 2018: 131 · 2019: 188 · 2020: 102 · 2021: 152 · 2022: 276 · 2023: 292 · 2024: 111 · 2025: 60 · 2026: 49 (3 mangler dato).
- **(c) Pålitelighet: middels.** Ingen saker er manuelt markert som feil, men bare 1 % er kontrollert. Konfidens skiller nesten ikke mellom sakene.
- **(d) KLART**
- **(e) Eksempler:**
  - 15/568: medhold, men tilkjent 22 447 av 240 000 kr krevd. Saken er flagget.
  - 14/1753: konfidens 0,5, «vedtaket er avbrutt midt i begrunnelsen».
  - 18/1439: QA riktig.

## Sjekk 2 – Lovversjon
- **(a) Felt:** `kjopsdato`, `overtakelsesdato`, `lovversjon`, `vedtaksdato`.
- **(b) Dekning:**
  - `kjopsdato` er satt i 2 316 saker (98,2 %). 2 311 av dem er kjøpt før 2024-01-01, og bare **5 etter**.
  - Lovversjon-feltet motsier aldri kjøpsdatoen: alle 181 med «før_2024» og alle 2 med «etter_2024» stemmer.
  - De 43 sakene uten kjøpsdato: 40 har vedtaksdato før juni 2024 og er dermed sikre kjøp før 2024. Bare 3 er usikre.
- **(c) Pålitelighet: høy.**
- **(d) AVLEDBART:** `kjopsdato < 2024-01-01` gir før 2024, og manglende kjøpsdato kan fylles fra vedtaksdato. Det gir verdi i 99,9 %. Feltet bør regnes ut slik, ikke tolkes av AI.
- **(e) Eksempler:**
  - FKU-2026-20340: kjøpt 2024-02-15, satt til etter_2024.
  - FKU-2026-9194: kjøpt 2024-01-11, men satt til `ukjent`.
  - 21/3775: kjøpsdato mangler, vedtatt 2022.

**Merk:** Grunnlaget er i praksis bare gammel lov. Brev om kjøp etter 2024 vil ha 5 sammenlignbare vedtak etter ny lov.

## Sjekk 3 – Utfall per feil (det viktigste)
- **(a) Felt:** `feiltyper`, `sammendrag`, `utvalgets_nokkelmomenter`, `bevis_vektlagt`, `sitater`, deretter `fulltekst_renset`.
- **(b) Dekning:** 822 saker (35 %) har delvis medhold og minst to feiltyper. Ingen strukturert verdi for utfall per feil finnes i dag (0 %).
- **Stikkprøve på 25 saker:**
  - Fra kortfeltene alene: **JA 16, DELVIS 6, NEI 3.**
  - Med fulltekst for de 9 uavklarte: ja 4, delvis 3, nei 2.
  - Totalt avklart feil for feil i **20 av 25 (80 %)**. I 2 saker vurderte utvalget feilene bare samlet («feilene samlet sett medfører …», 16/1903).
- **(c) Pålitelighet: lav til middels.**
  - `feiltyper` er påberopt, ikke godkjent, og kodingen er ujevn.
  - «annet» blander mangel og ikke-mangel i samme sak (24/1043: dekkdimensjon er mangel, felger ikke).
  - Hovedmangelen ligger ofte under «annet».
  - Det er tagger som aldri ble påberopt (`km_avvik` i 21/5099) og feil som mangler (bremser i 17/1561).
  - Omtrent 7 av 25 saker har minst én tydelig feil-tagg.
- **Hvorfor delvis medhold:** bare noen av feilene godtatt i 10, riktig feil men redusert beløp eller sanksjon i 9, begge deler i 6.
- **(d) KREVER PASS 2:** en liste per sak med `{feil, komponent, mangel: ja/nei/ikke vurdert, begrunnelse_sitat}`, og «annet» må deles opp.
- **(e) Eksempler:**
  - 23/9931: «Bremser er å betegne som slitedeler … utgjør følgelig ikke en kjøpsrettslig mangel … bruksmerkene/småskadene og den knekte antennen [utgjør] kjøpsrettslige mangler».
  - 16/1200: «ikke nødvendig å vurdere de øvrige feil … all den tid hevingskravet har ført frem».
  - 21/5099: `km_avvik` er tagget, men aldri påberopt.

## Sjekk 4 – Mangelsgrunnlag: påberopt eller lagt til grunn?
- **(a) Felt:** `mangelsgrunnlag`, `utvalgets_nokkelmomenter`, `paragrafer`, `fulltekst_renset` (del III).
- **(b) Dekning:** feltet er fylt ut i 99,7 % (bare 8 tomme).
  - Fordeling: avvik fra avtale 1 348, feil opplysninger 851, tilbakeholdt opplysning 713, vesentlig dårligere stand 701.
  - Feltbeskrivelsen i `src/lib/ai/skjema.ts` lyder *«Grunnlaget klageren bygger mangelen på»*, altså det klager anførte. Promptteksten lagres ikke i databasen, bare `prompt_versjon = tolk-v3`.
- **Stikkprøve på 25 saker med medhold eller delvis medhold:**
  - **Samme grunnlag som utvalget brukte i 18 (72 %).** Bare klagers anførsel i 6, delvis i 1, helt ulikt i 0.
  - Feilene går én vei: grunnlaget utvalget brukte er alltid med, men feltet har for mange verdier, oftest `tilbakeholdt_opplysning`.
- **Feil i prompten:** Prompten kobler «§ 16 b = feil opplysninger, § 16 a = tilbakeholdt, § 16 c = som den er». I fkjl før 2024 er det motsatt: § 16 (1) a er avtale eller forventning, b er forsømt opplysning, c er uriktig opplysning, og «som den er» hører til § 17. Dette bør rettes før pass 2.
- **`paragrafer` hjelper ikke.** Det står aldri ledd eller bokstav (0 av 3 608). Fulltekst har dem nesten alltid.
- **(c) Pålitelighet: middels.**
- **(d) KREVER PASS 2.** En smal klassifisering av bare vurderingsdelen (3–5 000 tegn) holder. Nøkkelmomentene gir grunnlaget i omtrent 20 av 25 saker, men villeder i noen.
- **(e) Eksempler:**
  - FKU-2025-137654: tilbakeholdt kollisjonsskade ble anført, men utvalget bygde på «fkjl. § 15 andre ledd bokstav b, jf. § 16 første ledd bokstav a».
  - 19/236: opplysningsplikten ble avvist, men taggen står likevel.
  - 19/508: «§ 17 første ledd b), jf. § 16 første ledd b)».

## Sjekk 5 – Selgers opplysninger
- **(a) Felt:** `forbehold_tekst`, `bevis_vektlagt`, `utvalgets_nokkelmomenter`, `sammendrag`, `mangelsgrunnlag`, `fulltekst_renset`.
- **(b) Dekning:**
  - **a) Søkeord i kortfeltene:** annonse 26,4 %, kontrakt 25,2 %, opplyst 20,0 %, uriktig 15,2 %, e-post 13,3 %, sms 2,8 %, melding 2,2 %, markedsføring 0,6 %, finn.no 0,3 %. Minst ett av dem i 1 477 saker (62,6 %).
  - **b) Feil eller tilbakeholdt opplysning i `mangelsgrunnlag`:** medhold 199 av 451 (44 %), delvis 642 av 1 068 (60 %), ikke medhold 397 av 840 (47 %).
  - **c) 15 saker lest:**
    - 11 har en positiv opplysning fra selger; 4 er rene taushetssaker.
    - **Ordrett ordlyd i kortfeltene: 0 av 15.** I fulltekst står ordlyden ordrett med anførselstegn i **9 av 11**.
    - Formen fremgår av kortfeltene i 7 (+3 delvis). Skriftlig og muntlig skilles aldri.
    - Muntlige opplysninger (6) er alltid bare referert, omtvistet, og aldri lagt vekt på i klagers favør.
    - Utvalget la vekt på opplysningen i 11, delvis i 3, nei i 1.
- **(c) Pålitelighet: lav for ordlyd (finnes ikke), middels for form.** `mangelsgrunnlag` er et støyete filter (3 av 15 saker var feil).
- **(d) KREVER PASS 2:** en liste `{form, ordlyd, kontrollert som delstreng av fulltekst, status, vekt: for/mot/ingen}`. Fallgruve: verkstedrapporter og forbehold er også sitert ordrett og kan forveksles med selgers opplysning.
- **(e) Eksempler:**
  - 21/15811: kontrakten «leveres eu godkjent for to nye år!», utvalget: «Dette er en feil opplysning.»
  - 21/12163: annonsen «Motor og drivverk i topp stand», mens kortfeltet bare sier «mer alvorlig enn forventet etter annonsen».
  - 21/3689: opplysningen talte *mot* klager: «avgjørende vekt på at klageren er opplyst om … utforkjøring».

## Sjekk 6 – Bevisenes innhold
- **(a) Felt:** `bevis_vektlagt`, `utvalgets_nokkelmomenter`, `bevistyper`, `fulltekst_renset`.
- **(b) Dekning:**
  - **a) Søkeord** (alle / medhold / delvis / ikke medhold):

    | Uttrykk | Alle | Medhold | Delvis | Ikke |
    |---|---|---|---|---|
    | påregnelig | 509 | 27 | 167 | 315 |
    | årsak | 504 | 33 | 132 | 339 |
    | forvente | 415 | 97 | 205 | 113 |
    | slitasje | 381 | 30 | 180 | 171 |
    | ved levering | 301 | 37 | 108 | 156 |
    | forelå | 272 | 36 | 82 | 154 |
    | omfang | 106 | 23 | 34 | 49 |
    | leveringstidspunkt | 39 | 6 | 3 | 30 |
    | generell karakter | 1 | 0 | 0 | 1 |

    «Påregnelig» og «årsak» er sterkt overrepresentert i saker uten medhold.
  - **b) Selgers bevis:** «Innklagde har fremlagt / lagt frem» i 251 saker (10,6 %), 287 med et bredere mønster.
  - **c) 15 saker uten medhold, med verkstedrapport eller NAF-test:**
    - Hovedgrunn: **sier ikke om feilen er påregnelig 7**, for generell 3, sier ikke når feilen oppsto 3, annet 2 (forbehold, foreldelse), motbevist av selger 0. Påregnelighet er nevnt i 13 av 15.
    - Hva rapportene inneholdt: årsak ja 6 (bare komponent nevnt 6), ved levering ja 2, påregnelig ja 3, kostnad ja 13.
    - Kjøper la frem beviset i 15 av 15. Selger la frem motbevis i 3.
    - Kortfeltene gir kategorien (9 ja, 6 delvis), men systematisk for få ja på de fire spørsmålene.
- **(c) Pålitelighet:** høy for kategorien, lav for de fire ja/nei-spørsmålene fra kortfelt. En modell vil lett blande hva *rapporten* sier med hva *utvalget* konkluderte.
- **(d) KREVER PASS 2,** per dokument: `bevis[] {type, avsender, fremlagt_av, årsak: rot/komponent/ingen, ved_levering, påregnelig, kostnad_nok, utvalgets_vurdering_sitat}`.
- **(e) Eksempler:**
  - 17/1554: «uttalelsen … ikke sier noe om de avdekkende feilene er uvanlig sett hen til bilens alder og kjørte kilometer».
  - 21/5546: «noe generell … gitt uten gjennomført besiktigelse».
  - 15/1940: «De sier ikke noe om hvorvidt girkassen er defekt og eventuelt årsaken».

## Sjekk 7 – Formodningsregelen
- **(a) Felt:** `fulltekst_renset`, `paragrafer`.
- **(b) Dekning:**
  - Søket gir treff i 518 saker: ikke medhold 172 (20,5 %), delvis 250 (23,4 %), medhold 96 (21,3 %).
  - Per uttrykk: formodning 434, § 18 annet/andre ledd 410, seks måneder etter 283, presum 51.
- **Lest 10 med treff og 10 uten:**
  - **Presisjon 40–50 %:** 4–5 av 10 der regelen faktisk ble anvendt. De falske treffene skyldes et fast avsnitt om rettsgrunnlaget (3), partsanførsler (1) og «seks måneder etter» brukt om noe annet (1).
  - Blant de 10 uten treff ble regelen anvendt i 0.
  - **Estimat: cirka 230 saker (≈10 %), usikkerhetsspenn 100–360.**
  - Når regelen ble anvendt, gikk den klager i favør i 4 av 5, men bare 2 av 5 fikk medhold. Saken stopper på om feilen var påregnelig.
- **(c) Pålitelighet: lav med søkeord.**
- **(d) KREVER PASS 2:** et felt `formodning: anvendt_for_klager | avkreftet | nevnt | ikke`.
- **(e) Eksempler:**
  - 22/6563: «Det antas følgelig at feilen forelå ved leveringstidspunktet, jf. fkjl. § 18 annet ledd».
  - 23/4133: formodningen avkreftet, «uforenelig med mangelens art».
  - 22/1220: fast avsnitt om regelen, men den ble ikke brukt.
- **Avklart (Lovdata):** fristen i § 18 annet ledd er «to år etter leveringen» fra 1. januar 2024 (lov 16. juni 2023 nr. 60). Før det var den seks måneder. Nesten alle vedtakene i grunnlaget gjelder seksmånedersfristen.

## Sjekk 8 – Tid fra kjøp til feil
- **(a) Felt:** `dager_til_reklamasjon`, `forste_reklamasjon_dato`, `kjopsdato`, `overtakelsesdato`, `fulltekst_renset`.
- **(b) Dekning:** `dager_til_reklamasjon` er satt i 1 517 saker (64,3 %); 6 har negativ verdi. Feltet er regnet fra overtakelse hvis den er satt, ellers fra kjøp. Kvartiler: 12, 49 og 181 dager.

  | Dager til reklamasjon | Saker | Medhold eller delvis |
  |---|---|---|
  | under 30 | 605 | 73,2 % |
  | 30–90 | 364 | 62,4 % |
  | 90–180 | 168 | 69,0 % |
  | 180–365 | 159 | 66,0 % |
  | over 365 | 221 | 57,0 % |
  | mangler | 842 | 59,6 % |

- **Lest 10 saker:**
  - Feltet stemmer med fulltekst i 9 av 10.
  - Fra oppdagelse til reklamasjon gikk det typisk ≈6 dager, med spenn 0–334.
  - Oppdagelsesdatoen kan fastslås presist i 3 av 10, omtrentlig i 6 av 10 («få dager», «januar», «vinteren 2016»).
- **(c) Pålitelighet: middels.** Feltet er en *øvre grense*: verdier ≤ 183 dager betyr sikkert innenfor seks måneder. Høyere verdier kan være feil. I 16/1921 tok modellen første skriftlige krav (334 dager), mens feilen viste seg på dag 0.
- **(d) AVLEDBART** som øvre grense. Et ordentlig felt for når feilen viste seg krever **pass 2** (`feil_viste_seg_dato` med presisjon, og `forste_reklamasjon` = første henvendelse, også muntlig).
- **(e) Eksempler:**
  - 16/1921: «bilen stanset etter å ha kjørt 6 mil».
  - 13/1299: «servopumpen røk … en måned etter kjøpet», men reklamert 97 dager senere.
  - 15/1240: «Få dager etter kjøpet».

## Sjekk 9 – Sanksjon tilkjent
- **(a) Felt:** `kravtyper`, `prinsipalt_krav`, `utfall` og konklusjonen i `fulltekst_renset`.
- **(b) Dekning:**
  - **Det oppgitte mønsteret** («mot at» + «stilles til disposisjon»/«tilbakeleveres») gir 151 saker (medhold 89, delvis 62).
  - Mønsteret **mangler den aktive formen** «mot at [KLAGER] *stiller* bilen til disposisjon».
  - **Bredere mønster** – `mot at[^.]{0,250}(disposisjon|tilbakelever|leverer tilbake|returnerer)` i de siste 2 000 tegnene – gir **351**: medhold 197, delvis 154, ikke medhold 0. Alle unntatt 2 har heving som hovedkrav.
  - **Hevingskrav: 1 198 saker (hovedkrav i 1 107), som ga heving i 349 (29 %, 31,5 % av hovedkravene).**
- **(c) Pålitelighet: høy** for det brede mønsteret: 0 treff i saker uten medhold, og treffene ligger i vedtaksslutningen.
  - Det gjenstår 23 saker med medhold og heving som hovedkrav, men uten hevingsmønster. Der fikk klager bare et beløp, så `utfall = medhold` er tvilsomt, for eksempel 14/1204 (18 535 kr).
- **(d) AVLEDBART:** hevingsmønsteret i slutningen gir heving. Ellers gir `tilkjent_prisavslag_nok` prisavslag og `tilkjent_erstatning_nok` erstatning. Retting og omlevering er ikke testet.
- **(e) Eksempler:**
  - 18/1154: aktiv form, som det oppgitte mønsteret mangler.
  - 16/84: passiv form («stilles til disposisjon»).
  - 14/1204: heving krevd, «medhold», men bare et beløp tilkjent.

## Sjekk 10 – Beløp
- **(a) Felt:** `krevd_totalt_nok`, `tilkjent_totalt_nok`, `utfall`.
- **(b) Dekning:** 1 492 av 1 519 saker med medhold eller delvis medhold har krevd beløp > 0 (98 %). 40 har ikke tilkjent beløp; de regnes som 0.

  | Utfall | Saker | Q1 | Median | Q3 | under 25 % | 25–50 % | 50–90 % | over 90 % |
  |---|---|---|---|---|---|---|---|---|
  | Medhold | 437 | 1,00 | 1,00 | 1,00 | 5,7 % | 0,9 % | 4,6 % | 88,8 % |
  | Delvis | 1 055 | 0,12 | 0,37 | 0,73 | 41,1 % | 17,7 % | 29,9 % | 11,3 % |

- **(c) Pålitelighet: middels til høy.**
  - Beløpene er dokumentert med sitater.
  - Ved heving kan «tilkjent» være et nettooppgjør (17/1629: 11 535 av 209 000 kr fordi klager «frifinnes for kjøpesummen»).
  - Feltet flagger «medhold, men tilkjent < krevd» i 65 saker.
- **(d) KLART.** Heving bør tas ut av beløpsbrøken eller regnes for seg.
- **(e) Eksempler:**
  - 22/520: 0,06 (delvis).
  - 21/12654: 0,37 (delvis).
  - 17/1629: nettooppgjør ved heving.

## Sjekk 11 – Ordrette sitater fra begrunnelsen
- **(a) Felt:** `sitater`, `utvalgets_nokkelmomenter`, `fulltekst_renset`.
- **(b) Dekning:**
  - Nøklene i `sitater`: utfall 2 353, selger_type 2 350, kjopesum 2 341, krevd_totalt 1 761, krevd_erstatning 1 741, krevd_prisavslag 1 557, forbehold 1 535, utbedringskostnad 1 484, tilkjent_totalt 1 304, tilkjent_erstatning 960, tilkjent_prisavslag 616, lovversjon 168.
  - **Ingen nøkkel gjelder begrunnelsen.**
  - Nøkkelmomenter: **0 av 151 strenger** i 30 saker finnes som delstreng av fulltekst, heller ikke etter normalisering. I hele grunnutvalget er det 10 av 11 931. Bare 5 av 151 har de første 40 tegnene ordrett.
- **(c) Pålitelighet:** høy for at nøkkelmomentene er **parafrase**.
- **(d) KREVER PASS 2:** et felt `begrunnelse_sitater[]`, kontrollert som delstreng av fulltekst slik `sitater` kontrolleres i dag.
- **(e) Eksempler:**
  - 14/328: «Dekk med for liten mønsterdybde ansett som mangel som forelå ved kjøpet» er en parafrase.
  - 16/743: «Trimming ble sannsynliggjort ved undersøkelse og effektmåling» er også en parafrase.

## Sjekk 12 – Feilkategorier

| Feiltype | Saker | Medhold eller delvis |
|---|---|---|
| annet | 1 096 | 70,8 % |
| motor | 1 083 | 61,3 % |
| elektrisk | 894 | 66,2 % |
| understell/hjuloppheng | 670 | 63,6 % |
| bremser | 500 | 62,4 % |
| rust | 492 | 64,0 % |
| servicehistorikk | 346 | 77,7 % |
| girkasse | 331 | 58,9 % |
| klimaanlegg | 244 | 66,0 % |
| fukt/lekkasje | 209 | 63,2 % |
| kollisjonsskade | 168 | 70,2 % |
| clutch | 122 | 51,6 % |
| km-avvik | 112 | 77,7 % |
| bruktimport-opplysning | 98 | 77,6 % |
| elbilbatteri | 79 | 49,4 % |
| ramme/chassis | 44 | 75,0 % |

- **Ingen kategori har under 30 saker,** men ramme/chassis (44) og elbilbatteri (79) er tynne. Kombinert med selgertype eller forbehold blir mange grupper under 30.
- **(a) Felt:** `feiltyper`, `utfall`.
- **(b) Dekning:** 99,5 %. 68 % av sakene har flere feil.
- **(c) Pålitelighet: lav til middels.** Medhold per kategori gjelder *saken*, ikke feilen (se sjekk 3). «annet» er den største kategorien og en sekkepost.
- **(d) KREVER PASS 2** for statistikk per feil. Kategorisatsene er bare brukbare som en grov sats per sak.
- **(e) Eksempler:**
  - 24/1043: «annet» dekker både mangel og ikke-mangel.
  - 21/3566: hovedmangelen (bulk på kanal) ligger under «annet».
  - 21/5099: `klimaanlegg` er brukt om ladevifter på Tesla.

## Samlet oversikt

**Spor A/B/C er bevismessige, ikke paragrafspor:**
- **A** = skriftlig opplysning fra selgeren.
- **B** = feilen viste seg innen formodningsfristen, og selgeren har ikke motbevist den.
- **C** = sakkyndig dokumentasjon av at feilen går utover det påregnelige.

Raden «Spor» i tabellen bygger på en paragraftolkning (§ 15 / § 16 / § 17) og må vurderes på nytt. Dataene som trengs per spor står i radene «Selgers opplysning» (A), «Formodning» og «Tid kjøp → feil» (B), og «Bevisinnhold» (C).

| Behov | Finnes i dag | Avledbart fra eksisterende felt | Krever ny ekstraksjon fra fulltekst |
|---|---|---|---|
| Utfall per feil | Nei (feiltyper er påberopt) | Delvis fra nøkkelmomenter, ca. 64 % | **Ja, ca. 80 % får verdi** (8 % bare samlet vurdering) |
| Spor (A/B/C), bevismessig definisjon | Nei | Nei (`mangelsgrunnlag` er feil akse og har feil paragrafkobling) | **Ja**, satt sammen av opplysninger[], formodning og bevis[] fra pass 2 |
| Mangelsgrunnlag lagt til grunn (§ 15 / § 16 / § 17) | Som anført (99,7 %), 72 % riktig | Grovt, men med for mange verdier | **Ja, ca. 95 %** (smal klassifisering av del III) |
| Selgers opplysning (form, innhold, vekt) | Nei (0 % ordrett) | Form i ca. 60 % via søkeord | **Ja:** ordrett ordlyd i ca. 25–30 % av alle saker (der det finnes en skriftlig opplysning), form og vekt i ca. 35 % |
| Bevisinnhold (4 ja/nei) | Nei | Bare avslagsgrunn (kategori) | **Ja, ca. 65–70 %** (saker med teknisk bevis) |
| Selgers bevis | Nei | Søkeord gir 11–12 % | **Ja, ca. 15 %** (anslag) |
| Formodning anvendt | Nei | Søkeord, presisjon 40–50 % | **Ja,** treffer ca. 10 % av sakene, alle får en verdi |
| Tid kjøp → feil | Øvre grense i 64 % | ≤ 183 dager er sikkert | **Ja, ca. 90 %** (30 % presist, 60 % omtrentlig) |
| Sanksjon tilkjent | Beløp per type (98 %) | **Ja:** heving via mønster i slutningen + tilkjent-feltene, ca. 100 % | Bare for retting og omlevering |
| Ordrette sitater fra begrunnelsen | Nei (nøkkelmomenter er parafrase) | Nei | **Ja, ca. 95 %**, kontrollert som delstreng av fulltekst |
| Lovversjon | Ukjent i 92 % | **Ja, 99,9 %** fra kjøpsdato eller vedtaksdato | Nei |

## Plan

**Beslutning:** Vi bygger nå, men praksisavsnittet i brevet slås ikke på før pass 2 er godkjent. Til da skrives brevene på lov og faktum, uten henvisning til vedtak.

### Spor 1 – Kan bygges nå, uten pass 2
1. **Regelmotoren uten praksisavsnitt:** lovversjon, frister, sanksjonsvalg, rentestart og beløpsfesting.
   - Alt dette styres av skjemaet og trenger ikke vedtaksdata.
   - Formodningsfristen er **to år** for kjøp fra 1. januar 2024, og seks måneder før.
2. **Steg 2 (harde filtre) og steg 5 (rangering).** Feltene er pålitelige i dag:
   - saksnummer, dato, utfall, selgertype og beløp;
   - sanksjonstype via det brede hevingsmønsteret (sjekk 9);
   - lovversjon regnet ut fra kjøpsdato eller vedtaksdato, ikke fra AI-feltet.
3. **Forventningsstyring i appen:**
   - fullt medhold 19 %, delvis 45 %;
   - delvis medhold gir median 37 % av kravet;
   - heving fører frem i 29 % av hevingskravene.
   - Tallene må stå som andel *av sakene som endte med vedtak* (forlik og trukne saker er ikke med), og «medhold» må skilles fra «delvis medhold».
4. **Grov styrkevurdering per sak:** kategorisats, reklamasjonstid og selgertype.
   - Reklamasjonstid: 73 % fikk medhold eller delvis medhold under 30 dager, mot 57 % over ett år.
   - Kategorisatsen gjelder saken, ikke feilen. Teksten må si at den er grov.
5. **Rydding i data:** gå gjennom de 23 sakene der heving var krevd, utfallet er «medhold», men bare et beløp ble tilkjent (sjekk 9).

### Spor 2 – Venter på pass 2
Steg 1, 3, 4 og 6 (sporvalg, matching, «sterkere enn» og rendering) bygger på data som ikke finnes i dag:
- utfall per feil (0 %);
- ordlyden i selgers opplysning (0 av 15 i kortfeltene);
- ordrette sitater fra begrunnelsen (0 av 151 i nøkkelmomentene);
- de fire bevisspørsmålene.

Nøkkelmomentene kan brukes til matching, aldri som sitat i brevet.

### Før pass 2
1. ~~**Rett paragrafkoblingen** i prompten~~ – **gjort** (`src/lib/ai/skjema.ts`, `tolk-v4`): fkjl § 16 (1) a = avtale/forventning, b = forsømt opplysning, c = uriktig opplysning. «Som den er» lå i § 17 i loven før 2024; i dagens lov er § 17 installasjon. Bokstavene er sjekket mot sitert lovtekst i vedtakene (21/14041, 21/4399, 19/558, FKU-2025-55355).
2. ~~**Definer spor A/B/C i repoet**~~ – **gjort:** `docs/spor.md`, lenket fra `CLAUDE.md`. Pass 2 skal klassifisere etter denne definisjonen.
3. **Ekstraher `mangelsgrunnlag` på nytt** i pass 2. Feltet skal ikke flikkes på.
4. **Definer `forste_reklamasjon`** som første henvendelse til selger, også muntlig.
5. **Øk promptversjonen** i `src/lib/ai/prompter.ts` og ta sikkerhetskopi (`npm run db:backup`) før kjøringen.

### Pass 2
- **Felt:** én ekstraksjon per vedtak med `feil[]`, `opplysninger[]`, `bevis[]` (ett element per dokument), `formodning`, `feil_viste_seg` og `begrunnelse_sitater[]`.
- **Sitatkontroll:** alle sitatfelt kontrolleres som delstreng av fulltekst. Et sitat som ikke finnes, forkastes.
- **Inndata:** del III (vurderingen) holder for utfall per feil og grunnlag. Ordlyden i annonser og kontrakter og innholdet i rapporter står ofte i saksfremstillingen (del I/II). `opplysninger[]` og `bevis[]` trenger derfor hele teksten (snitt 11 000 tegn), ikke bare 3–5 000 tegn.
- **Muntlige opplysninger:** registreres med form «muntlig» og status, men uten ordlyd.
- **Pilot:** 100 saker, deretter sjekk 3, 4, 5c, 6c, 7 og 11 på nytt.

### Terskel for å slå på praksisavsnittet
- Over 90 % treff på utfall per feil og spor (sjekk 3 og 4).
- 100 % sitatverifisering (sjekk 11). Dette sikres mekanisk ved at sitater som ikke kan verifiseres, forkastes.
- Mål treffandelen på minst 50 saker per sjekk. Med 25 saker kan 23 av 25 riktige (92 %) like gjerne bety 75 %.

### Hva funnene betyr for modellen
- **Spor B må bruke fristen som gjaldt i vedtaket.** Vedtakene gjelder seksmånedersfristen; kjøpere i dag har to år. Feil som viser seg etter 6–24 måneder har ingen sammenlignbare B-vedtak. Gamle saker der klager tapte i den perioden, tapte under en regel som ikke gjelder lenger, og må ikke brukes som motbevis.
- **Lovendringssetningen må være standard** i praksisavsnittet. Bare 5 vedtak i grunnlaget gjelder kjøp etter 2024.
- **Spor B er lite:** formodningsregelen ble anvendt i ca. 10 % av sakene, og kjøper vant bare 2 av 5 av dem.
- **Størrelsen på spor A er ukjent.** Tallene 851 og 713 for `mangelsgrunnlag` overlapper (1 238 saker til sammen). De er det klager anførte, og `tilbakeholdt_opplysning` er taushet, ikke en skriftlig opplysning. A er antakelig største spor, men det vet vi først etter pass 2.
- **Muntlige opplysninger:** ingen av 6 ble lagt vekt på i kjøpers favør. Det støtter regel F6, men 6 saker er for få til å kalle det en regel. Muntlige opplysninger bør derfor fortsatt registreres, slik at tallet kan sjekkes på hele korpuset etter pass 2.
- **Paragrafhenvisninger fra gamle vedtak må oversettes** til dagens lov ved rendering. Paragrafene er stokket om (dagens § 17 er installasjon).
