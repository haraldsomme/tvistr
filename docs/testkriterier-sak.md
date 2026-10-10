# Kriterier for fiktive testsaker gjennom `/sak`

*2026-10-10, revidert samme dag etter piloten: motoren er et filter, og praksisdelen skrives av en modell med belegg (`docs/praksis.md`). Gjelder testsaker som fylles ut i skjemaet på `/sak` (skjema 1.2): vurderingen per feil og brevets praksisdel. Reglene som testes, står i `docs/sammenligningsmotor.md`, `docs/praksis.md` og `docs/spor.md`. Kriteriene C2, D4, D5, E1 og E2 er gjort presise fordi to kontrollører var uenige om dem i piloten.*

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
| B2 | Styrken følger regelen: uten spor er svak; spor uten vedtak, eller reklamasjon mer enn to måneder etter oppdagelsen, er middels; ellers sterk | 100 % |
| B5 | Høyst to feil til brevet, høyst fem kandidater per feil, og bare på spor feilen har | 100 % |

*B3, B4 og B6 utgikk 2026-10-10 da motoren ble et filter (`docs/sammenligningsmotor.md`). Regler for praksisavsnittet kommer i `docs/praksis.md`.*

## P. Praksisdelen (maskinelt, med `--praksis`)

| # | Kriterium | Krav |
|---|---|---|
| P1 | Andel feil med spesifikt avsnitt, generelt avsnitt og fast blokk | rapporteres, ingen terskel |
| P2 | Kostnad per skjema | rapporteres |
| P3 | Høyst to avsnitt og høyst ett generelt eller fast, ingen vedtak sitert to ganger, ingen avsnitt for feil uten spor, og samme avsnitt når lagrede modellsvar verifiseres på nytt | 100 % |
| P4 | Et generelt avsnitt eller en fast blokk sammenligner aldri og har ingen beløp fra et eksempelvedtak | 100 % |

## C. Valg av vedtak (lest av kontrollagent, bare spesifikke avsnitt)

| # | Kriterium | Krav |
|---|---|---|
| C1 | **Analogi:** vedtaket gjelder samme type feil, og det utvalget bygde på, finnes også i kjøperens sak. Kontrolløren siterer setningen i vedtaket som bar resultatet og feltet i skjemaet som svarer til den. Mangler kjøperen det utvalget bygde på, er C1 ikke oppfylt. | ≥ 90 % |
| C2 | **«Sterkere» er sant:** hvert moment avsnittet *uttrykkelig* sier at kjøperen er sterkere på, stemmer med vedtakets tekst og med skjemaet. Momenter avsnittet ikke nevner, vurderes ikke her. | 100 % |
| C3 | **Ingen skjult svakhet:** utvalget bygde uttrykkelig på et moment (sitér), kjøperen er svakere på det ifølge skjemaet, og avsnittet nevner det ikke. | ≥ 95 % |
| C4 | **Ikke en klart bedre kandidat:** blant de andre kandidatene filteret ga (`resultat.feil[].kandidater`), er ingen en klart bedre analogi etter C1. Hele korpuset vurderes ikke. | ≥ 85 % |
| C5 | **Sporet:** vedtaket er vunnet på det grunnlaget avsnittet beskriver (uriktig opplysning, taushet, formodning eller sakkyndig dokumentasjon). | 100 % |
| C6 | **Når modellen valgte ingen** (`grunn` i `praksis.forsok`): var det riktig? Rapporteres, ingen terskel. | – |

## D. Teksten i brevet (lest av kontrollagent)

| # | Kriterium | Krav |
|---|---|---|
| F1 | **Belegget bærer setningen:** for hver setning om et vedtak sier belegget (`forsok[].raa.setninger[].belegg` i `data/testkjoring/praksis/<id>.json`) det setningen påstår, ikke bare noe som ligner. Gjelder spesifikke og generelle avsnitt. | 100 %, blokkerende |
| D1 | **Fakta om vedtaket** i det ferdige avsnittet stemmer med fulltekst: hva utvalget fant (uriktig opplysning er ikke taushet), saksnummer og dato, beløp og hva det dekket, alder, km og tid. | 100 % |
| D2 | **Sitatet** handler om det avsnittet bruker det til. (At det er ordrett og en hel setning, sjekker koden.) | 100 % |
| D3 | **Fakta om kjøperens sak** kommer fra skjemaet. Ingenting er lagt til, og en avtalt feil (forlik) er ikke med. | 100 % |
| D4 | **Ingenting kan snus mot kjøperen.** Kontrolløren siterer setningen og sier hvilken av disse den gir motparten: (a) kjøperen burde ha oppdaget feilen, (b) feilen er slitasje, (c) kjøperen reklamerte sent, (d) en svakhet nevnt uten svar. Uten en av (a)–(d) er D4 oppfylt. | ≥ 95 % |
| D5 | **Fast blokk:** slotene stemmer med skjemaet, og ingen tall kommer fra korpuset. | 100 % |
| F2 | **Et generelt avsnitt eller en fast blokk påstår ikke likhet:** ingen sammenligning med et eksempel, og ingenting om hva kjøperen i eksemplet fikk. | 100 %, blokkerende |
| D6 | **Norsk:** en grammatisk feil, en setning som må leses to ganger for å forstås, eller samme opplysning to ganger, er ikke oppfylt. Ordvalg er «mindre». | ≥ 95 % |
| D7 | **Tonen** passer for et brev en forbruker sender selv til en forhandler | ≥ 90 % |

## E. Vurderingen kjøperen ser (lest av kontrollagent)

| # | Kriterium | Krav |
|---|---|---|
| E1 | **Styrken er ikke villedende.** At styrken følger regelen, sjekker B2. E1 er ikke oppfylt bare når kontrolløren navngir et konkret forhold i skjemaet som regelen ikke fanger, og som gjør styrken villedende i akkurat denne saken. | ≥ 85 % |
| E2 | **Forklaringen** kjøperen ser for feilen (`Brukerresultat` i `src/app/sak/skjema.tsx`) er sann ut fra resultatet og forståelig for en forbruker. | ≥ 90 % |

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
- **Ingen uriktige faktapåstander** (F1, D1 og F2 fullt oppfylt).
- **Under 5 % alvorlige merknader** i C, D og E samlet.
- **Alle maskinelle krav i A, B og P** er oppfylt.
- Andelen brev med praksisavsnitt rapporteres, men har ingen terskel.
- **Hver alvorlig merknad** er enten rettet i reglene, eller ført opp som kjent svakhet i `docs/sammenligningsmotor.md`.
