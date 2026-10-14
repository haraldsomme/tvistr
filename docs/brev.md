# Brevet

Steg 7 viser forhåndsvisningen og steg 8 det ferdige reklamasjonsbrevet (rekkefølgen i skjemaet står i `docs/skjema.md`, vurderingen før betaling i `docs/vurdering.md`). Alt er ren kode: maler fylt med felt fra skjemaet, Vipps-profilen (en stub foreløpig), Enhetsregisteret, motorvognregisteret og lovteksten. Ingen modell skriver noe i brevet. Modellen brukes bare til å velge hvilket vedtak avsnittet om praksis viser til (`docs/vedtaksvalg.md`).

**Prinsippet:** hver setning kan spores til et felt, et svar i skjemaet eller en lovtekst. Fins ikke feltet, fins ikke setningen. Hver setning har derfor en `kilde` (`skjema:feil[0].tid`, `lov:etter_2024:avvik`, `brreg:navn`, `vipps:epost`, `vedtak:22/2868`, `fast`), og en test sjekker at ingen setning har tom kilde.

Koden ligger i `src/lib/brev/`, én fil per avsnitt. Malfunksjonene er rene og tar en `Brevsak` (`typer.ts`).

## Flyt

1. Steg 7 kaller `finnVedtak` (`src/app/sak/actions.ts`). Den renser og vurderer hele saken (en sak som stopper, koster ikke et modellkall), finner vedtaksavsnittet og forsegler det (AES-256-GCM, `signatur.ts`). Nettleseren får bare nivå, saksnummer og dato i klartekst; avsnittet, sitatene og lenken kan ikke leses før betaling.
2. Deretter kaller den `byggBrevet` med svarene og det forseglede avsnittet. Serveren:
   - renser svarene og kjører alle stopp-regler på nytt (`src/app/sak/rens.ts`, `docs/riktighet.md`),
   - godtar bare et avsnitt serveren selv har forseglet,
   - henter selgerens navn og adresse fra Enhetsregisteret på nytt (nettleseren oppgir bare org.nr.),
   - henter kjøperen fra Vipps-profilen (`src/lib/vipps/profil.ts`), som bare finnes etter betaling (en ordre-id),
   - bygger brevet (`byggBrev`).
3. **Uten betaling** (ingen profil) får nettleseren `forhandsvisning(brev)`: tittel og mottaker, avsnitt 1 og første setning av vedtaksavsnittet («Det vises til … vedtak i sak … av …», `forsteSetning` i `mal.ts`), uten lenke. Resten er byttet ut med lengden på teksten, så den skjulte teksten aldri sendes.
4. **Etter betaling** (steg 8) kaller skjemaet `byggBrevet` på nytt med ordre-id og det samme forseglede avsnittet, så brevet bygger på vedtaket forhåndsvisningen viste. Nettleseren får hele brevet, med «Kopier tekst» og «Last ned Word».
5. I utvikling simulerer «Betal med Vipps» betalingen når `TVISTR_HELT_BREV_UTEN_BETALING=1` står i `.env.local` (aldri i produksjon): skjemaet lager en ordre-id, og stuben gir profilen.

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
| 1. Bakgrunn | «Som den er» ja / nei / vet ikke. Kontakt med selger: reklamasjon skriftlig / muntlig, hvilke feil den gjaldt, og selgers svar (se under). Selger sa noe om en opplysningsfeil (skriftlig / muntlig), eller sa at en teknisk feil var i orden eller nylig utbedret: «Før kjøpet opplyste dere {skriftlig / muntlig} at {feil} var i orden eller nylig utbedret.» Første registreringsår kjent eller ikke. |
| 2. Mangelen | Uten tidligere reklamasjon først «Jeg reklamerer herved på følgende mangel / mangler.» («feil» når alle er «vet ikke ennå»). Per feil: når feilen viste seg (dato, «Feilen viste seg den 12. mai 2026» eller «i mai 2026» når datoen er omtrentlig), beskrivelse (kjøperens egne ord, uendret), verksted (muntlig gir én setning, skriftlig gir rapportavsnittet, se under), «vet ikke ennå», og for tekniske feil «selger sa ingenting». For feil med dokumenter som hører til kategorien (kilometerstand, service, skade, EU-kontroll) til slutt dokumentet med navn: «Utskrift fra Statens vegvesen vedlegges.», samme tekst som i vedleggslisten. Feil oppdaget etter en tidligere reklamasjon: «{Feil} reklameres herved.» Til slutt rettingsforsøk (1, 2, 3 eller flere) på feilene den tidligere reklamasjonen gjaldt. |
| 3. Mangel | Per type feil: teknisk, opplysning der selger sa noe, opplysning der selger ikke sa noe, garanti, vet ikke. En teknisk feil selger sa var i orden eller nylig utbedret, får i tillegg § 16 første ledd bokstav c, i samme setning som opplysningsfeilene. Garanti er avvik fra avtalen (§ 15 første ledd, jf. § 16 første ledd bokstav a) og uriktig opplysning om garantien (§ 16 første ledd bokstav c); § 18 a brukes ikke. Like typer slås sammen til én setning. «Som den er» etter lovversjon (se under). |
| 3. Tidspunkt | Tidsnivået regnes fra datoen feilen ble oppdaget (`tidslinje.ts`). Formodningen (§ 18 annet ledd; to år fra 2024, ellers seks måneder) og bevisene fra rapporten gjelder bare tekniske feil. Fristsetningen (§ 27: to år eller fem år, regnet fra tidligere reklamasjon om den finnes, ellers fra brevets dato) gjelder tekniske feil utenfor formodningen og alle andre feil, også garanti, opplysning og «vet ikke ennå», som viste seg mer enn to år etter kjøpet. Er feilene delt mellom de to, sier hver setning hvilke feil den gjelder. Rapporten legges til som bevis (se under). Rimelig tid (§ 27 første ledd): ble feilen reklamert innen to måneder etter at den ble oppdaget, står «Reklamasjonen er fremsatt innen to måneder etter at feilen ble oppdaget, og dermed innen rimelig tid, jf. § 27 første ledd.» (med «For {feil}:» når ikke alle er det). Reklamasjonsdatoen er den tidligere reklamasjonen for feilene den gjaldt, ellers brevets dato. En omtrentlig dato regnes fra den første i måneden. Ellers ingen setning; skjemaet advarer. |
| 3. Praksis | Vedtaksavsnittet uendret. Uten kandidat (lovsetningen) utelates underavsnittet. |
| 4. Krav | Retting (med hast når verkstedet fraråder bruk), prisavslag (med verkstedenes overslag, summert; se under ved overslag for bare noen feil) eller heving (med rettingsforsøk på feilene som var reklamert, og at retting ikke vil bli tilbudt når selger avviste eller ikke svarte). Erstatning for utlegg. Selgerens rett til å rette, når kravet er prisavslag eller heving uten rettingsforsøk (etter rettingsforsøk bare for feilene brevet reklamerer på for første gang, med navn), men ikke ved heving etter at selger avviste eller ikke svarte, og ikke når alle feilene gjelder det selgeren sa eller bilens historikk, som ikke kan rettes (service, kilometerstand, tidligere bruk, import, skade, pant). Garanti, utstyr, ombygging, EU-kontroll og tekniske feil beholder tilbudet, og det står også i en sak der bare noen av feilene er av den første typen. |
| 5. Frist | E-post om Vipps har den, ellers telefon. |
| Vedlegg | Én linje per rapport («Rapport fra {verksted} av {dato}»; samme verksted og dato er én linje), dokumentene som hører til kategorien (kilometerstand: «Utskrift fra Statens vegvesen»; service ikke utført: «Servicehefte», men ikke når serviceheftet mangler; skade: «Utskrift fra Statens vegvesen eller skaderapport»; EU-kontroll: «EU-kontrollseddel»; samme tekst bare én gang), annonse/kjøpekontrakt (selger sa noe skriftlig om en opplysningsfeil eller garanti, eller skrev at en teknisk feil var i orden; ikke når selger skrev om selve feilen), kvitteringer, tidligere reklamasjon (skriftlig). Utelates når listen er tom. |

### Kontakt med selger

Har ikke kjøperen reklamert, er brevet reklamasjonen: ingen setning om tidligere kontakt, rettingsforsøk 0, og «Jeg reklamerer herved på følgende mangler.» først i avsnitt 2. Har kjøperen reklamert (`kontakt` på `Brevsak`), står «Jeg reklamerte {skriftlig / muntlig} til dere den {dato}.» og svarene under.

Reklamasjonen gjelder bare feilene som var oppdaget på reklamasjonsdatoen (`reklamasjonFor` i `tidslinje.ts`, `reklamerte` i `rapport.ts`). Skjemaet spør ikke om det; det følger av datoene. Er en feil oppdaget senere:
- avsnitt 1 navngir feilene reklamasjonen gjaldt: «Jeg reklamerte skriftlig til dere den {dato} på {feil}.»
- avsnitt 2 reklamerer på resten: «{Feil} reklameres herved.»
- rettingsforsøkene og hevingsgrunnen gjelder bare de reklamerte feilene, med navn: «Dere har forsøkt å rette {feil} to ganger …», «og dere har ikke lykkes med å rette {feil} etter to forsøk».
- selgerens rett til å rette står for de nye feilene, også etter rettingsforsøk.

Reklamasjon før alle feilene stopper som før (`reklamert_for_oppdaget`).

| Hva selger har gjort | Brevet |
|---|---|
| Ikke svart | Avsnitt 1: «Jeg har ikke fått svar.» Avsnitt 4 ved heving: «Dere har ikke besvart reklamasjonen, og jeg legger til grunn at retting ikke vil bli tilbudt.» Selgerens rett til å rette utelates. |
| Avvist kravet | Avsnitt 1: «Dere avviste reklamasjonen.» Avsnitt 4 ved heving: «Dere har avvist reklamasjonen, og …» som over. |
| Tilbudt retting, ikke gjennomført | Avsnitt 1: «Dere tilbød retting, men den er ikke gjennomført.» |
| Forsøkt å rette (1, 2 eller 3 eller flere ganger) | Avsnitt 2: «Dere har forsøkt å rette feilen … uten at det har lykkes.» Avsnitt 4 ved heving: «og dere har ikke lykkes med å rette den etter {antall} forsøk». Selgerens rett til å rette utelates, unntatt for feil oppdaget etter reklamasjonen. |
| Annet | Ingen setning |

Forsøk telles bare under «Forsøkt å rette», så svar og forsøk kan ikke stride mot hverandre. En selger som først forsøkte å rette og så avviste videre krav, registreres som «Forsøkt å rette». Reklamasjonsdatoen brukes også til å regne ut om reklamasjonen er i tide (§ 27).

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
- **Avsnitt 4, prisavslag:** overslagene fra rapportene med avkrysningen «inneholder kostnadsoverslag» summeres: «… tilsvarende utbedringskostnaden på kr {sum} ifølge verkstedets overslag.» (verkstedenes ved flere rapporter). Et tall uten avkrysningen brukes ikke, fordi det da ikke er verkstedets tall. Har bare noen av de kjente feilene overslag («vet ikke ennå» regnes ikke med), står: «På dette grunnlaget krever jeg prisavslag, jf. § 31. Prisavslaget skal minst tilsvare utbedringskostnaden for {feil med overslag}, kr {sum} ifølge verkstedets overslag. For {øvrige feil} fastsettes prisavslaget når utbedringskostnaden er dokumentert.» Skjemaet advarer (`prisavslag_delvis_overslag`).
- **Avsnitt 4, retting:** fraråder rapporten bruk: «Bilen kan etter verkstedets vurdering ikke brukes før feilen er rettet, og jeg ber om at rettingen prioriteres.»
- **Vedtaksvalget:** avkrysningene går til modellen som `rapport_sier`, og kandidatene viser `bevisgrunnlag`, så den kan foretrekke et vedtak der utvalget la vekt på sakkyndig dokumentasjon.

### «Som den er»

- **Kjøpt før 1.1.2024:** den gamle § 17 første ledd bokstav a gjelder. Teknisk feil på en bil solgt «som den er» gir: «Selv om bilen ble solgt «som den er», har den en mangel, fordi den er i dårligere stand enn jeg med rimelighet hadde grunn til å forvente på bakgrunn av forbeholdet, kjøpesummens størrelse og forholdene ellers, jf. forbrukerkjøpsloven § 17 første ledd bokstav a.»
- **Kjøpt fra 1.1.2024:** § 17 er opphevet (ny § 17 gjelder uriktig installering), og et alminnelig forbehold er ikke et avtalt unntak etter § 15 annet ledd. Brevet sier det med lovens egne ord når bilen er solgt «som den er», for de tekniske feilene selger ikke opplyste om (selger sa ingenting, eller sa at feilen var i orden). Opplyste selger om noen av feilene, står «For {de andre feilene}:» først. For en feil selger opplyste om kan kjøperen ha vært «spesielt opplyst», og brevet argumenterer ikke rundt det. Er «som den er» nei eller vet ikke, står ingen forbeholdssetning.
- **Kjøpt før 1.1.2024** vurderes «som den er» etter § 17 uansett hva selger sa; setningen over står for alle tekniske feil.

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
| avtalen (garanti som ikke er levert) | § 15 første ledd | § 15 første ledd |
| garanti | § 18 a, men brukes ikke som mangelsgrunnlag | § 18 a, men brukes ikke som mangelsgrunnlag |
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
- **Vedtaket må følge betalingen.** Innenfor økten gjør det det: steg 8 bygger brevet med det forseglede avsnittet fra steg 7. Ved en omlasting etter betaling (ny økt) må det forseglede avsnittet lagres sammen med ordre-id.
- Ordre-id lagres i `sessionStorage` (`tvistr:ordre`), og serveren svarer «betalt» på oppslag mot ordre-id. Stuben `hentProfil` gir profilen bare når det finnes en ordre-id (og bare i utvikling).

## Avvik fra planen

Gjort der planteksten ville påstått mer enn feltene vet, eller ikke fulgte loven:
- «{år}-modell» er blitt «første gang registrert i {år}» (vegvesenet har ikke årsmodell), og utelates når året er ukjent.
- «Verkstedets vurdering vedlegges som dokumentasjon på at mangelen forelå ved leveringen» er blitt «Til dokumentasjon av forholdet viser jeg til verkstedets skriftlige vurdering, som følger vedlagt.» Vi vet ikke hva verkstedet konkluderte.
- «Reklamasjonen er fremsatt innen fristen i § 27» regnes ut fra datoene: «innen to år etter at bilen ble levert» eller «innen fristen på fem år».
- Formodningen skrives med lovens ord («formodes») og lovens periode (to år fra 2024, ellers seks måneder).
- «Unnlatt å opplyse» er blitt «forsømt å opplyse» (§ 16 første ledd bokstav b).
- Selgerens rett til å rette har lovens ord fra § 30: «uten kostnad og uten vesentlig ulempe for meg og innen rimelig tid, jf. §§ 29 og 30».
- Avsnitt 5 nevner **Forbrukertilsynet**, som mekler. Forbrukerklageutvalget behandler saken etterpå, og vedtakene brevet viser til er utvalgets. Ordet står i `INSTANS` i `frist.ts`.
- **§ 18 a** (garantier) finnes med samme innhold i første til tredje ledd både før og etter 2024, og fjerde ledd er nytt (kontrollert på Lovdata 2026-10-14). Paragrafen står i tabellen, men brukes ikke som mangelsgrunnlag: en garanti som ikke er levert er avvik fra avtalen (§ 15 første ledd) og uriktig opplysning (§ 16 første ledd bokstav c).
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

- **§ 27 for feil som viste seg etter to år.** Brevet sier «innen fristen på fem år», men ikke at delen er ment å vare vesentlig lenger enn to år (§ 27 annet ledd annet punktum). Skjemaet spør ikke om det.
- **Rimelig tid etter mer enn to måneder.** Brevet sier «innen rimelig tid» bare når reklamasjonen kom innen to måneder etter at feilen ble oppdaget. Kom den senere, sier brevet ingenting om det, og skjemaet advarer (`reklamasjon_sen`).
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
- `npx playwright test` (`e2e/flyt.spec.ts`): går gjennom hele flyten fra landingssiden til steg 7 (og 8 med dev-flagget) ved desktop- og mobilbredde mot en kjørende dev-server. Erstatter `scripts/ferdig-brevskjema.mjs`, som gikk gjennom det gamle skjemaet.
