# Brevet

Steg 5 viser et ferdig reklamasjonsbrev. Alt er ren kode: maler fylt med felt fra skjemaet, Vipps-profilen (en stub foreløpig), Enhetsregisteret, motorvognregisteret og lovteksten. Ingen modell skriver noe i brevet. Modellen brukes bare til å velge hvilket vedtak avsnittet om praksis viser til (`docs/vedtaksvalg.md`).

**Prinsippet:** hver setning kan spores til et felt, et svar i skjemaet eller en lovtekst. Fins ikke feltet, fins ikke setningen. Hver setning har derfor en `kilde` (`skjema:feil[0].tid`, `lov:etter_2024:avvik`, `brreg:navn`, `vipps:epost`, `vedtak:22/2868`, `fast`), og en test sjekker at ingen setning har tom kilde.

Koden ligger i `src/lib/brev/`, én fil per avsnitt. Malfunksjonene er rene og tar en `Brevsak` (`typer.ts`).

## Flyt

1. «Opplysningene stemmer, gå til betaling» i steg 5 kaller `finnVedtak` (`src/app/sak/actions.ts`). Den renser og vurderer hele saken (en sak som stopper, koster ikke et modellkall), finner vedtaksavsnittet og signerer det (`signatur.ts`).
2. Deretter kaller den `byggBrevet` med svarene og avsnittet. Serveren:
   - renser svarene og kjører alle stopp-regler på nytt (`src/app/sak/rens.ts`, `docs/riktighet.md`),
   - godtar bare et vedtaksavsnitt med serverens egen signatur,
   - henter selgerens navn og adresse fra Enhetsregisteret på nytt (nettleseren oppgir bare org.nr.),
   - henter kjøperen fra Vipps-profilen (`src/lib/vipps/profil.ts`),
   - bygger brevet (`byggBrev`).
3. **Uten betaling** (ingen profil) får nettleseren `forhandsvisning(brev)`: tittel og mottaker, avsnitt 1 og vedtaksavsnittet. Resten er byttet ut med lengden på teksten, så den skjulte teksten aldri sendes. Avsnitt 1 og avsnittet om praksis er alt som vises, med resten som grå felt.
4. **Etter betaling** får nettleseren hele brevet, med «Kopier tekst» og «Last ned som Word».
5. I utvikling vises hele brevet uten betaling når `TVISTR_HELT_BREV_UTEN_BETALING=1` står i `.env.local` (aldri i produksjon).

Skjermen, den kopierte teksten og Word-filen bygges av samme linjeliste (`tilDokument` i `brev.ts`), så teksten er den samme i alle tre. Lenken til vedtaket er en lenke på skjermen og en fotnote i Word (`docx.ts`).

Ingenting lagres på serveren.

## Strukturen

```
{Kjøpers navn}                                  {Poststed, dato}
{Kjøpers adresse}

{Selgers navn}
{Selgers adresse}

REKLAMASJON – {merke} {modell}, reg.nr. {regnr}, kjøpt {kjøpsdato}

1. Sakens bakgrunn
2. Mangelen
3. Rettslig vurdering   (mangel · tidspunkt · praksis)
4. Krav
5. Frist for tilbakemelding

Med vennlig hilsen
{Kjøpers navn}

Vedlegg: ...
```

Brevet er i første person og formelt, uten forsterkere («klart», «åpenbart», «utvilsomt», «jeg er klar over», «jeg mener») og uten innrømmelser til selgeren. Tall skrives med tusenskille og datoer som «12. mai 2026» (`format.ts`).

## Grenene

| Avsnitt | Hva som avgjør teksten |
|---|---|
| Hode | Kjøper og selger har adresse eller ikke. Mangler kjøperens poststed, står bare datoen til høyre. Før betaling er avsenderen tom. |
| 1. Bakgrunn | «Som den er» ja / nei / vet ikke. Kontakt med selger: reklamasjon skriftlig / muntlig, og selgers svar (se under). Selger sa noe om en opplysningsfeil (skriftlig / muntlig). Første registreringsår kjent eller ikke. |
| 2. Mangelen | Per feil: når feilen viste seg (dato, «Feilen viste seg den 12. mai 2026» eller «i mai 2026» når datoen er omtrentlig), beskrivelse (kjøperens egne ord, uendret), verksted (muntlig gir én setning, skriftlig gir rapportavsnittet, se under), «vet ikke ennå», og for tekniske feil «selger sa ingenting». Til slutt rettingsforsøk (1, 2, 3 eller flere). |
| 3. Mangel | Per type feil: teknisk, opplysning der selger sa noe, opplysning der selger ikke sa noe, garanti, vet ikke. Like typer slås sammen til én setning. «Som den er» etter lovversjon (se under). |
| 3. Tidspunkt | Bare tekniske feil. Tidsnivået regnes fra datoen feilen ble oppdaget (`tidslinje.ts`). Formodningen gjelder (§ 18 annet ledd; to år fra 2024, ellers seks måneder), eller reklamasjonen er i tide (§ 27: to år eller fem år, regnet fra tidligere reklamasjon om den finnes, ellers fra brevets dato). Er feilene delt mellom de to, sier hver setning hvilke feil den gjelder. Rapporten legges til som bevis (se under). |
| 3. Praksis | Vedtaksavsnittet uendret. Uten kandidat (lovsetningen) utelates underavsnittet. |
| 4. Krav | Retting (med hast når verkstedet fraråder bruk), prisavslag (med verkstedenes overslag, summert) eller heving (med rettingsforsøk, og at retting ikke vil bli tilbudt når selger avviste eller ikke svarte). Erstatning for utlegg. Selgerens rett til å rette, når kravet er prisavslag eller heving uten rettingsforsøk, men ikke ved heving etter at selger avviste eller ikke svarte. |
| 5. Frist | E-post om Vipps har den, ellers telefon. |
| Vedlegg | Én linje per rapport («Rapport fra {verksted} av {dato}»; samme verksted og dato er én linje), annonse/kjøpekontrakt (selger sa noe skriftlig), kvitteringer, tidligere reklamasjon (skriftlig). Utelates når listen er tom. |

### Kontakt med selger

Har ikke kjøperen reklamert, er brevet reklamasjonen: ingen setning om tidligere kontakt, rettingsforsøk 0, og «reklamerer herved» for symptomer uten kjent årsak. Har kjøperen reklamert (`kontakt` på `Brevsak`), står «Jeg reklamerte {skriftlig / muntlig} til dere den {dato}.» og:

| Selgers svar | Avsnitt 1 | Avsnitt 4 |
|---|---|---|
| Avviste kravet | «Dere avviste reklamasjonen.» | Ved heving: «Dere har avvist reklamasjonen, og jeg legger til grunn at retting ikke vil bli tilbudt.» Selgerens rett til å rette utelates. |
| Har ikke svart | «Jeg har ikke fått svar.» | Ved heving: «Dere har ikke besvart reklamasjonen, og …» som over. |
| Tilbød retting | «Dere tilbød retting, men den er ikke gjennomført.» Bare når selger ikke har forsøkt å rette. | – |
| Annet | Ingen setning | – |

Selger har forsøkt å rette (1, 2 eller 3 eller flere ganger) gir «Dere har forsøkt å rette feilen … uten at det har lykkes.» under «Mangelen», og i kravet om heving «og dere har ikke lykkes med å rette den etter {antall} forsøk». Reklamasjonsdatoen brukes også til å regne ut om reklamasjonen er i tide (§ 27).

### Verkstedrapport

Når verkstedet har undersøkt en feil skriftlig, har feilen en `rapport` (`src/lib/brev/rapport.ts`). Hver avkrysning gir én fast setning, i denne rekkefølgen, og det som ikke er krysset av, gir ingen setning:

| Avkrysning | Setning |
|---|---|
| Bekrefter feilen | Verkstedet bekrefter feilen. |
| Angir årsaken | Verkstedet har fastslått årsaken. |
| Til stede ved levering | Verkstedet legger til grunn at feilen har utviklet seg over tid og forelå ved leveringen. |
| Ikke normal slitasje | Verkstedet vurderer feilen som unormal for bilens alder og kjørelengde. |
| Fraråder bruk | Verkstedet fraråder bruk av bilen før feilen er utbedret. |
| Kostnadsoverslag | Ingen setning, tallet brukes i avsnitt 4. |

I avsnitt 2: «Feilen er undersøkt av {navn} ({uavhengig verksted / merkeverksted / deres eget verksted}) den {dato}.», setningene over, «Rapporten konkluderer: «{konklusjon}».» (ordrett, uten ekstra punktum når konklusjonen slutter på tegnsetting) og «Rapporten følger vedlagt.»

Rapporten brukes også i andre avsnitt:
- **Avsnitt 3, formodningen gjelder:** er «ikke normal slitasje» krysset av, legges til «Verkstedets vurdering av at feilen ikke skyldes normal slitasje, taler i samme retning.»
- **Avsnitt 3, formodningen gjelder ikke:** er «til stede ved levering» krysset av, står «Verkstedet legger til grunn at feilen forelå ved leveringen, jf. rapporten av {dato}.» (flertall med flere rapporter). Ellers «Til dokumentasjon av forholdet viser jeg til verkstedets skriftlige vurdering, som følger vedlagt.» Uten rapport står ingen bevissetning.
- **Avsnitt 4, prisavslag:** overslagene fra rapportene med avkrysningen «inneholder kostnadsoverslag» summeres: «… tilsvarende utbedringskostnaden på kr {sum} ifølge verkstedets overslag.» (verkstedenes ved flere rapporter). Et tall uten avkrysningen brukes ikke, fordi det da ikke er verkstedets tall.
- **Avsnitt 4, retting:** fraråder rapporten bruk: «Bilen kan etter verkstedets vurdering ikke brukes før feilen er rettet, og jeg ber om at rettingen prioriteres.»
- **Vedtaksvalget:** avkrysningene går til modellen som `rapport_sier`, og kandidatene viser `bevisgrunnlag`, så den kan foretrekke et vedtak der utvalget la vekt på sakkyndig dokumentasjon.

### «Som den er»

- **Kjøpt før 1.1.2024:** den gamle § 17 første ledd bokstav a gjelder. Teknisk feil på en bil solgt «som den er» gir: «Selv om bilen ble solgt «som den er», har den en mangel, fordi den er i dårligere stand enn jeg med rimelighet hadde grunn til å forvente på bakgrunn av forbeholdet, kjøpesummens størrelse og forholdene ellers, jf. forbrukerkjøpsloven § 17 første ledd bokstav a.»
- **Kjøpt fra 1.1.2024:** § 17 er opphevet (ny § 17 gjelder uriktig installering), og et alminnelig forbehold er ikke et avtalt unntak etter § 15 annet ledd. Brevet sier det med lovens egne ord, men bare når bilen er solgt «som den er» og selgeren ikke sa noe om noen av de tekniske feilene. Har selgeren sagt noe (skriftlig eller muntlig), eller er «som den er» nei eller vet ikke, står ingen forbeholdssetning. Da kan kjøperen ha vært «spesielt opplyst», og brevet argumenterer ikke rundt det.

## Paragrafene

`src/lib/brev/paragrafer.ts` har én tabell per lovversjon, og malene ber om et poeng («mangel, uriktig opplysning») i stedet for å skrive et nummer. En test sikrer at begge tabellene har alle poengene.

Kontrollert 2026-10-13 mot primærkilder, ikke fra hukommelsen:
- **etter 2024:** Stortingets lovvedtak 97 (2022–2023) for ordlyden i §§ 15–18 og 27–33, og forbrukerkjøpsloven på [Lovdata](https://lovdata.no/lov/2002-06-21-34) (siste endring i kraft: LOV-2024-06-14-32).
- **før 2024:** Prop. 49 LS (2022–2023), som beskriver loven slik den var. Lovdata viser bare gjeldende tekst.

| Poeng | Før 2024 | Etter 2024 |
|---|---|---|
| krav til tingen | § 15 | § 15 |
| mangel, avvik fra kravene | § 16 første ledd bokstav a | § 16 første ledd bokstav a |
| mangel, tilbakeholdt opplysning | § 16 første ledd bokstav b | § 16 første ledd bokstav b |
| mangel, uriktig opplysning | § 16 første ledd bokstav c | § 16 første ledd bokstav c |
| «som den er» | § 17 første ledd bokstav a | **§ 15 annet ledd** (§ 17 er omskrevet) |
| formodning | § 18 annet ledd (seks måneder) | § 18 annet ledd (to år) |
| garanti | § 18 a | § 18 a |
| reklamasjon | § 27 første ledd | § 27 første ledd |
| to år / fem år | § 27 annet ledd første / annet punktum | § 27 annet ledd første / annet punktum |
| retting | §§ 29 og 30 | §§ 29 og 30 |
| prisavslag | § 31 | § 31 |
| heving | § 32 | § 32 |
| erstatning | § 33 | § 33 |

Ingen poeng er et gap. Er et nummer usikkert en gang, settes poenget til `null`, og brevet nevner da bare «forbrukerkjøpsloven» for det poenget (se `lovRef` og `jf`). Legg poenget til listen her.

Ordlyden i vilkårene hentes fra `LOVORD`, med kilde ved hver frase.

## Hvor feltene kommer fra

| Felt | Kilde |
|---|---|
| Kjøpers navn, adresse, telefon, e-post | Vipps-profilen (stub: `STUB_PROFIL`) |
| Selgers navn, org.nr., postadresse | Enhetsregisteret, hentet på nytt på serveren fra org.nr. |
| Merke, modell, regnr, første registreringsår | Statens vegvesen, via skjemaet |
| Kjøpsdato, km, kjøpesum, «som den er», feil, tid, verksted, selger sa noe, beskrivelse, krav, utlegg | Skjemaet |
| Rapporten (hvem, navn, dato, avkrysninger, konklusjon, overslag) | Skjemaet, steg 3, kjøperens sitat fra rapporten |
| Kontakt med selger (dato, hvordan, rettingsforsøk, selgers svar) | Skjemaet, steg 4 |
| Dato for brevet | Serveren, norsk tid |
| Vedtaksavsnittet | `finnVedtak` |

Kjøpsdatoen brukes som overtakelsesdato overalt der brevet sier «overtakelsen» (skjemaet spør ikke om overtakelsen).

## Vipps

Integrasjonen er en egen oppgave. Brevet bygges mot en stub (`src/lib/vipps/profil.ts`). Det som er kontrollert i [Vipps MobilePay-dokumentasjonen](https://developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/features/profile-sharing/) (2026-10-13):

- Profilen bestilles i opprettelsen av betalingen (`POST /epayment/v1/payments`) med `profile.scope`, for eksempel `name email phoneNumber address`.
- Brukeren godtar delingen på en samtykkeskjerm i Vipps-appen før betalingen. Samtykket gjelder alle scopene samlet, og brukeren kan ikke velge bort ett av dem.
- Profilen hentes med `GET /epayment/v1/payments/{reference}` eller fra webhooken `epayments.payment.authorized.v1`. Samtykket varer i sju dager, og dokumentasjonen anbefaler å hente profilen med en gang.
- Feltene kommer som `userDetails`: `email`, `firstName`, `lastName`, `mobileNumber`, `dateOfBirth` og `addresses` (`addressLine1`, `addressLine2`, `city`, `country`, `postCode`). Det kan være flere adresser.
- Bruk så få scopes som mulig, siden brukeren kan avbryte betalingen på samtykkeskjermen.

**Må avklares i Vipps-oppgaven:**
- Hva som skjer når brukeren ikke har registrert e-post eller adresse. Dokumentasjonen sier det ikke, så brevet er skrevet slik at begge kan mangle.
- Hvilken adresse som brukes når det er flere.
- Betalingen må bekreftes på serveren (webhook eller GET), ikke bare med en redirect.
- **Vedtaket må følge betalingen.** Valget av vedtak er ikke deterministisk (modellkallet), så et nytt «Lag brev» etter betaling kan gi et annet vedtak enn forhåndsvisningen viste. Lagre vedtaket eller avsnittet sammen med ordre-id, eller la forhåndsvisningen og det betalte brevet bruke samme valg.
- Ordre-id lagres i `sessionStorage` (`tvistr:ordre`), og serveren svarer «betalt» på oppslag mot ordre-id. Stuben `hentProfil` tar imot ordre-id, men bruker den ikke ennå.

## Avvik fra planen

Gjort der planteksten ville påstått mer enn feltene vet, eller ikke fulgte loven:
- «{år}-modell» er blitt «første gang registrert i {år}» (vegvesenet har ikke årsmodell), og utelates når året er ukjent.
- «Verkstedets vurdering vedlegges som dokumentasjon på at mangelen forelå ved leveringen» er blitt «Til dokumentasjon av forholdet viser jeg til verkstedets skriftlige vurdering, som følger vedlagt.» Vi vet ikke hva verkstedet konkluderte.
- «Reklamasjonen er fremsatt innen fristen i § 27» regnes ut fra datoene: «innen to år etter at bilen ble levert» eller «innen fristen på fem år».
- Formodningen skrives med lovens ord («formodes») og lovens periode (to år fra 2024, ellers seks måneder).
- «Unnlatt å opplyse» er blitt «forsømt å opplyse» (§ 16 første ledd bokstav b).
- Selgerens rett til å rette har lovens ord fra § 30: «uten kostnad og uten vesentlig ulempe for meg og innen rimelig tid, jf. §§ 29 og 30».
- Avsnitt 5 nevner **Forbrukerklageutvalget**, ikke Forbrukertilsynet. Utvalget avgjør sakene vedtakene kommer fra, og er administrert av Forbrukertilsynet. Ordet står i `INSTANS` i `frist.ts`.
- Feilene står i den rekkefølgen kjøperen valgte dem. Etter en omlasting av siden er det kategorirekkefølgen.
- Flere underkategorier under én feil skrives «Turbo og kjøling og topplokk», eller med semikolon når et navn selv har «og» i seg («Dekk og felger; nøkler og tilbehør»).
- «Utstyr», «service» og «historikk» uten underkategori regnes som opplysning om hva selgeren sa (ikke som en teknisk feil), og «garanti» som garanti.
- Kopiert tekst og Word-fil er laget fra samme linjeliste som skjermen, med «–» foran hvert vedlegg.
- Rapporten har bare avkrysningene i listen over; ingen tekst om hva en rapport «vanligvis» sier. Konklusjonen er kjøperens ord og er unntatt fra ordlisten mot forsterkere, på samme måte som beskrivelsen.
- Rapport og kontakt er gyldige bare hvis datoen ligger etter kjøpsdatoen (strengt) og ikke i fremtiden. Skjemaet og serveren sjekker begge.
- Overslaget hører til avkrysningen: uten «inneholder kostnadsoverslag» forkastes tallet.
- Ved to feil i samme rapport legger kjøperen inn overslaget per feil. Brevet summerer tallene feil for feil, så oppgir kjøperen rapportens totalbeløp på begge, telles det to ganger.

## Tidslinjen og riktighet

Datoene og rekkefølgen mellom dem vurderes av `tidslinje.ts`, resten av `riktighet.ts`. Reglene, meldingene og invariantene som testes på hvert brev står i `docs/riktighet.md`. For brevets tekst betyr det:
- Avsnitt 2 sier når hver feil viste seg som en dato, og avsnitt 3 bruker tidsnivået regnet fra den.
- **Kjent feil og «vet ikke» sammen:**
  - Ved prisavslag gjelder kravet den kjente feilen, og for symptomet står: «For {symptom} krever jeg at årsaken undersøkes og at feilen rettes uten kostnad for meg, jf. §§ 29 og 30.»
  - Ved heving gjelder kravet den kjente feilen, og symptomet er bare beskrevet. Hevingen omfatter hele bilen, så et krav om retting ved siden av ville stride mot den.
- Gjaldt vedtaket den andre lovversjonen, står det etter vedtaksavsnittet: «Vedtaket ble avgjort etter loven slik den lød før 1.1.2024.» (eller «… lyder fra 1.1.2024»).

## Kjente gap

- **§ 27 for feil som viste seg etter to år.** Brevet sier «innen fristen på fem år», men ikke at delen er ment å vare vesentlig lenger enn to år (§ 27 annet ledd annet punktum), og ikke noe om «innen rimelig tid» etter at feilen ble oppdaget (§ 27 første ledd). Skjemaet spør ikke om noen av dem.
- **«Vet ikke ennå» uten fristsetning.** Setningen om at reklamasjonen er i tide lages bare for tekniske feil. Et symptom som viste seg mer enn to år etter overtakelsen får ingen setning om § 27 annet ledd.
- **Prisavslag «tilsvarende utbedringskostnaden».** Etter § 31 settes prisavslaget ut fra forholdet mellom verdien med og uten mangelen, ikke utbedringskostnaden. Setningen er slik planen ba om, men bør vurderes av jurist.
- **Flere feil i én setning.** En mangelsetning som slår sammen flere feil av samme type nevner ikke hvilke (avsnitt 2 gjør det).
- **Gammel § 17.** Ordlyden før 2024 står slik Prop. 49 LS gjengir den, siden Lovdata bare viser gjeldende lov.
- **Vedtaksavsnittet går via nettleseren** fra `finnVedtak` til `byggBrevet`, men er signert av serveren (`signatur.ts`), så en endret tekst avvises. I produksjon må `TVISTR_SIGNATURNOKKEL` være satt; uten den lager hver serverinstans sin egen nøkkel.
- **Enkeltpersonforetak finnes ikke i selgersøket** (`src/lib/brreg.ts` utelater dem med vilje). Privat selger støttes ikke.
- **Beskrivelsen** (kjøperens egne ord) renses bare for blanke og lengde (200 tegn).
- **Rapporten er kjøperens påstand.** Brevet gjengir avkrysningene og konklusjonen som kjøperen har oppgitt, og kontrollerer ikke at rapporten sier det. Skjemaet ber kjøperen krysse av bare for det rapporten sier. Konklusjonen kan inneholde hva som helst (opp til 300 tegn), og er unntatt forsterkerlisten.
- **Selger tilbød retting og har forsøkt å rette** gir ingen egen setning om tilbudet (forsøkene står under «Mangelen»).
- **Ingen kontroll mot selgers svar:** «annet» gir ingen setning, og brevet sier ikke hva selger svarte utover de tre valgene.
- **Rategrensene er slått av** (`GRENSER_PA` i `src/lib/rategrense.ts`) til nettstedet er offentlig.

## Måling

- `npm test`: paragrafer, kombinasjoner (`src/lib/brev/__snapshots__/*.txt`), de tolv gylne brevene (`__snapshots__/gylne/`), forhåndsvisningen, Word-filen og renseren.
- `npm run brev:praksis`: finner vedtaksavsnittet for de tolv sakene på nytt (databasen og modellen, om lag $0,14). Kjør bare når rangeringen, valget eller avsnittsmalen endres.
- `npm run brev:jurist`: skriver hele brevet inn under hver av de 15 sakene i `docs/jurist-gjennomgang.md`.
- `node scripts/ferdig-brevskjema.mjs <mappe>`: går gjennom steg 4 og 5 ved 1280 og 390 piksler mot en kjørende dev-server.
