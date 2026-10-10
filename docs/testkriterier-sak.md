# Kriterier for fiktive testsaker gjennom `/sak`

*Utkast 2026-10-10. Gjelder testsaker som fylles ut i skjemaet på `/sak` (skjema 1.2) og vurderes på det motoren svarer: vurderingen per feil og brevets praksisdel. Reglene som testes, står i `docs/sammenligningsmotor.md` og `docs/spor.md`.*

## Alvorlighetsgrad

| Grad | Betyr | Eksempel |
|---|---|---|
| **Blokkerende** | Brevet sier noe som ikke er sant, eller saken krasjer | Sitatet finnes ikke i vedtaket. Beløpet gjelder noe annet enn avsnittet sier. Serverfeil. |
| **Alvorlig** | Brevet eller vurderingen kan skade kjøperen | Vedtaket er en analogi motparten lett avviser. Feil spor eller feil styrke. En påstand kjøperen ikke kan forsvare. |
| **Moderat** | Det er riktig, men svakt | Klønete norsk. Et dårligere vedtak er valgt når et bedre fantes. Et uklart forklaringsfelt. |
| **Mindre** | Kosmetisk | Tegnsetting, ordvalg. |

**Hver merknad skal dokumenteres** med kilden: et sitat fra vedtakets fulltekst (`vedtak.fulltekst_renset`), feltet i skjemaet eller regelen i dokumentasjonen. En merknad uten kilde teller ikke.

## A. Flyt og robusthet (maskinelt)

| # | Kriterium | Krav |
|---|---|---|
| A1 | Saken går gjennom uten serverfeil eller unntak | 100 % |
| A2 | Gyldige saker passerer valideringen, og ugyldige stoppes med en melding brukeren forstår (delnavn + melding) | 100 % |
| A3 | Samme skjema gir samme svar ved ny kjøring | 100 % |
| A4 | Svartid fra innsending til vurdering | under 10 s |
| A5 | Privatkjøp stopper, og et forlik holder den avtalte feilen utenfor brevet | 100 % |

## B. Regler (maskinelt, fasit fra skjemaet)

| # | Kriterium | Krav |
|---|---|---|
| B1 | Sporene stemmer med reglene: skriftlig og konkret opplysning gir A, full rapport gir C, rapport innen fristen gir B. Fristen er seks måneder før 2024 og to år etter. Muntlige løfter gir aldri A. | 100 % |
| B2 | Styrken følger regelen: uten spor er svak, vedtak uten motstrid er sterk, tilbakefall er høyst middels, spor uten vedtak er middels (svak ved lignende tap) | 100 % |
| B3 | `praksis` stemmer med innholdet: `vedtak` når saken har et vedtak, `generell` når den har et generelt avsnitt, ellers `ingen` | 100 % |
| B4 | Tilbakefall bare innenfor regelen: A i opplysningsgruppen, B til nærmeste kategori, C aldri | 100 % |
| B5 | Flere feil: aldri samme vedtak på to feil, høyst to praksisavsnitt og lovendringssetningen én gang | 100 % |
| B6 | En kostnad over kjøpesummen gjengis aldri uten bekreftelse | 100 % |

## C. Valg av vedtak (lest av kontrollagent)

| # | Kriterium | Krav |
|---|---|---|
| C1 | **Analogi:** en jurist ville akseptert vedtaket som sammenlignbart for denne feilen og dette sporet. Ved tilbakefall: holder analogien når motparten innvender at det gjaldt en annen type feil? | ≥ 90 % |
| C2 | **«Sterkere» er sant:** hvert moment avsnittet bruker som sterkere, stemmer mot vedtakets tekst | 100 % |
| C3 | **Ingen skjult svakhet:** kjøperen er ikke reelt svakere på et moment vedtaket bygde på, men som ikke ble sammenlignet | ≥ 95 % |
| C4 | **Ikke et åpenbart bedre vedtak:** kontrollagenten sjekker tre andre vunne vedtak i samme kategori og spor | ≥ 85 % |
| C5 | **Sporet vedtaket vant på:** vedtaket er faktisk vunnet på det sporet avsnittet bygger på | ≥ 95 % |

## D. Teksten i brevet (lest av kontrollagent)

| # | Kriterium | Krav |
|---|---|---|
| D1 | **Fakta om vedtaket** stemmer med fulltekst: saksnummer og dato, ordlyd, forbehold («som den er» eller «som den står»), «påvist senest», hvor gammel bilen var og km. Beløpet og hva det dekker (denne mangelen eller manglene i saken). | 100 % |
| D2 | **Sitatet** er ordrett, en hel setning og handler om det avsnittet bruker det til | 100 % |
| D3 | **Fakta om kjøperens sak** kommer fra skjemaet. Ingenting er lagt til. | 100 % |
| D4 | **Ingenting kan snus mot kjøperen:** «synlig», «burde», innrømmet slitasje, svakheter som ikke er adressert | ≥ 95 % |
| D5 | **Generelt avsnitt:** ingen sammenligning og ingen tall fra indeksen. To forskjellige eksempler som faktisk viser regelen slik den er formulert, og svar på tapsgrunnen bare når skjemaet gir svaret. | 100 % |
| D6 | **Norsk:** grammatisk og idiomatisk bokmål. Ingen tomme ledd, gjentakelser, plassholdere ([KLAGER]) eller tall i feil bøyning. | ≥ 95 % |
| D7 | **Tonen** passer for et brev en forbruker sender selv til en forhandler | ≥ 90 % |

## E. Vurderingen kjøperen ser (lest av kontrollagent)

| # | Kriterium | Krav |
|---|---|---|
| E1 | **Styrken er forsvarlig** når kontrollagenten ser på saken som helhet. Uenighet skal begrunnes. | ≥ 85 % |
| E2 | **Forklaringen** (vedtak, uten praksis, grunnen til at saken mangler spor) er riktig og forståelig for en forbruker | ≥ 90 % |

## Testsakene selv

- **Realistiske og indre konsistente:** datoer i riktig rekkefølge, en pris som passer bilen, km som stemmer, og avskrifter som ligner ekte annonser og rapporter.
- **Dekning:** alle 23 kategoriene, alle tre spor og saker uten spor, kjøp før og etter 2024, privatkjøp, forlik, en til tre feil, kostnad over kjøpesummen, selgers motbevis, muntlige løfter, slitedeler, og «som den er» besvart med ja, nei og vet ikke.
- **Et bevisst innslag av vanskelige saker:** grensetilfeller rundt fristen, generelle utsagn som ligner konkrete, og samme ordlyd som et kjent vedtak.
- **Ingen ekte personer:** fiktive navn og firma, og ingen ekte registreringsnumre.

## Kontroll og kalibrering

- **Kontrollagentene** bruker Opus og får skjemaet, motorens svar og fulltekst for vedtakene. De får ikke en fasit for hva svaret burde være.
- **Kalibrering:** en andre, uavhengig kontrollagent vurderer 20 % av sakene på nytt. Enigheten måles per kriterium og skal være minst 90 %. Under det er kriteriet for vagt, og det strammes inn før resultatene brukes.
- **Rapport per sak:** `{saks_id, kriterium, grad, merknad, kilde}`, med «ok» for hvert kriterium som er sjekket.
- **Samlet rapport:** andel per kriterium med Wilson-intervall og liste over blokkerende og alvorlige merknader, med regelen eller koden som er årsaken.

## Når er vi ferdige?

- **Ingen blokkerende merknader.**
- **Under 5 % alvorlige merknader** i C, D og E samlet.
- **Alle maskinelle krav i A og B** er oppfylt.
- **Hver alvorlig merknad** er enten rettet i reglene, eller ført opp som kjent svakhet i `docs/sammenligningsmotor.md`.
