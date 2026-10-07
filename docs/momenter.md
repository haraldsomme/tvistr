# Momentkatalogen: det Forbrukerklageutvalget la vekt på

Avklaringsrunden spør kjøperen om forhold utvalget har lagt vekt på i forhandlersaker. Katalogen står i `src/lib/brev/momenter.ts` (`MOMENTER`), med belegg i `scripts/momenter-belegg.json`. `npm run sjekk-momenter` sjekker katalogen mot belegget og databasen og må gi 0 feil. Katalogen er ikke lest av jurist.

## Slik ble den laget (oktober 2026)

1. **Telling og utvalg** (`npm run moment-kandidater`): alle forhandlersaker (personbil og varebil, ikke merket for kontroll, 1 980 vedtak) telt per feilgruppe, tidsrom og utfall (`data/explore/momenter/telling.md`, ikke i git). Utvalget: per feilgruppe og tidsrom de 4 nyeste vunne og 3 nyeste tapte, 199 vedtak (111 vunnet, 88 tapt). Planen sa 200; vurderingen ga 199 fordi små grupper har få saker.
2. **Uttrekk** (`npm run moment-les -- --trinn uttrekk`, Sonnet 5.5): hvert vedtak lest i sin helhet; forholdene utvalget la vekt på, med retning og ordrett sitat. 27 sitater som ikke sto ordrett, ble forkastet. 4,51 USD.
3. **Syntese**: en agent samlet uttrekket til 23 momenter (`scripts/momenter-katalog.json`) og utelot det skjemaet alt spør om eller utleder (se under).
4. **Klassifisering** (`npm run moment-les -- --trinn klassifiser`): hvert vedtak lest av Sonnet 5.5 og Opus 5.5 hver for seg mot katalogen. Et moment teller bare når begge sier at det er til stede, med et sitat som står ordrett i teksten; uenighet (5,6 % av 4 577 vurderinger) teller som uklart. En tredje lesing ved uenighet (`--tredje`) ble droppet: den trengtes i nesten hvert vedtak og ville doblet kostnaden. 15,23 USD.
5. **Skiller**: et moment skiller vunne fra tapte saker når det er til stede i minst 8 vedtak, og andelen vunne med momentet er minst 15 prosentpoeng høyere (for «for») eller lavere (for «mot») enn uten. Bare slike momenter spørres om (`momenterFor`).
6. **Kontroll**: `npm run sjekk-momenter` (id, utfall, saksnummer og sitat mot databasen, og tellingene mot belegget) og en uavhengig agent som leste belegget for de skillende momentene.

## Katalogen

Tallene er antall vedtak der momentet var til stede (vunnet/tapt), av 199.

| id | Navn | Retning | Til stede (v/t) | Skiller | Gjelder |
|---|---|---|---|---|---|
| `rapport_arsak` | Rapporten angir årsaken | for | 41 (25/16) | nei | alle |
| `rapport_upaaregnelig` | Feilen er uvanlig for alder og kilometerstand | for | 30 (23/7) | ja | alle |
| `forhandler_annen_arsak` | Forhandleren påstår en annen årsak uten belegg | for | 86 (44/42) | nei | alle |
| `dokument_for_salg` | Dokument fra før salget viser feilen | for | 15 (12/3) | ja | alle |
| `udokumenterte_tilleggsfeil` | Tilleggsfeil uten dokumentasjon | mot | 69 (40/29) | nei | alle |
| `slitedel` | Feilen gjelder en slitedel | mot | 44 (25/19) | nei | grupper: motor/elektrisk/understell/bremser/girkasse/klimaanlegg/batteri |
| `skjult_feil` | Feilen kunne ikke ses ved visning | for | 22 (16/6) | ja | alle |
| `positiv_beskrivelse` | Bilen ble beskrevet som i god stand | for | 66 (44/22) | ja | grunnlag: forventning/opplysning |
| `uriktig_service_arbeid_utstyr` | Uriktig om service, utført arbeid eller utstyr | for | 27 (27/0) | ja | grunnlag: opplysning |
| `tidligere_skade_ikke_opplyst` | Tidligere skade eller bruk ikke opplyst | for | 17 (16/1) | ja | alle |
| `bruktimport_ikke_opplyst` | Bruktimport ikke opplyst | for | 9 (7/2) | ja | alle |
| `garanti_uklar` | Garantien var feil eller uklart beskrevet | for | 11 (11/0) | ja | alle |
| `rettet_for_kjop` | Opplysningen ble rettet før kjøpet | mot | 2 (1/1) | nei | grunnlag: opplysning |
| `tidlige_tegn` | Tidlige tegn er dokumentert | for | 18 (13/5) | ja | botter: middels/sen |
| `km_etter_kjop` | Bilen er kjørt langt før feilen viste seg | mot | 83 (35/48) | ja | botter: middels/sen |
| `egen_bruk` | Bruken etter kjøpet kan forklare feilen | mot | 7 (3/4) | nei | alle |
| `forhandler_erkjente` | Forhandleren har tatt ansvar | for | 21 (16/5) | ja | alle |
| `avslo_tilbud` | Kjøperen avslo et tilbud om retting | mot | 5 (3/2) | nei | alle |
| `kravet_bare_mangelen` | Kravet tar med kostnader som ikke gjelder feilen | mot | 44 (36/8) | nei | alle |
| `verditap_dokumentert` | Verditapet er dokumentert | for | 4 (3/1) | nei | grunnlag: opplysning |
| `rimelig_reparasjon` | Rimelig reparasjon uten standardheving | for | 7 (7/0) | nei | alle |
| `bruksstans_sikkerhet` | Bilen kan ikke brukes eller er farlig | for | 62 (38/24) | nei | alle |
| `rust_baerende` | Rust i bærende deler | for | 6 (3/3) | nei | grupper: rust/understell/bremser/skade |

**Forbehold.** Utvalget omtaler beløp og kravposter mest når kjøperen vinner, så momenter om kravet (`kravet_bare_mangelen`, `rimelig_reparasjon`, `verditap_dokumentert`) har skjeve tall og brukes ikke til å spørre. Bare saker som endte med vedtak er med.

## Forkastede kandidater (fra syntesen)

- **Gammel bil, høy km og lav pris** (≈60 vedtak, nesten bare tapte): det sterkeste mønsteret, men det følger av årsmodell, kjøpesum og kilometerstand, som appen alt har.
- **Feilen viste seg innen seks måneder (formodningen)** og **lang tid fra kjøp til feil**: skjemaet spør om dette, og datoen i «Feilen» gir det.
- **Reklamert innen rimelig tid** (≈25): utledes av datoene i «Feilen» og «Kontakt» (`sjekkBrev`).
- **Muntlig mot skriftlig reklamasjon** (2012, 1200, 3011, 1632, 2235): «Hvordan tok du kontakt?» spør om dette.
- **Gjentatte mislykkede rettingsforsøk** (908, 1690, 2440, 3023, 3256): «Kontakt» spør om antall forsøk.
- **Forhandleren fikk ikke rette før reparasjon hos andre** (2235, 2263, 3117, 3366, 1594): dekket av grunnen «Forhandleren fikk ikke sjansen først» i «Kontakt».
- **Rapporten tidfester feilen til før levering**: skjemaet spør om dette («Tilstandsrapport»). Det som ligger utenpå, er tatt med i `rapport_arsak` og `rapport_upaaregnelig`.
- **Forhandleren ga ikke tilsvar til utvalget** (≈11, alle vunnet): skjer i utvalget og er ikke kjent når brevet skrives.
- **Kjøperen fulgte ikke oppfordringen om en sakkyndig uttalelse** (≈12, nesten alle tapt): skjer i saksbehandlingen. Om rapporten finnes, spør skjemaet om.
- **Muntlig avtale eller lovnad som ikke er bevist** (49, 1572, 3017, 3128, 3359): utledes av hvor opplysningen ble gitt.
- **Utbedringen koster mye i forhold til kjøpesummen, så heving er mulig** (1598, 1600, 1758, 3086, 2316): regnes ut av kravbeløpet og kjøpesummen.
- **Kostnaden er dokumentert med faktura eller tilbud** og **følgeutgifter med kvitteringer**: dekket av «Kravet» (beløp og utgifter) og «Vedlegg» (faktura, tilbud, kvitteringer). Utgifter uten sammenheng med feilen er tatt med i `kravet_bare_mangelen`.
- **«Som den er» eller annet generelt forbehold i kontrakten**: «Kjøpet» spør om dette.
- **Varsellampen lyste ved overtakelsen, eller kjøperen visste om feilen**: «Før kjøpet» spør om det. Synlige feil er tatt med i `skjult_feil`.
- **Selgeren er profesjonell og «burde kjenne til» feilen**: en rettslig vurdering, ikke et faktum kjøperen kan svare på. Den brukes i argumentet til `dokument_for_salg` og `tidligere_skade_ikke_opplyst`.
- **Feil kilometerstand** (729, 297, 382, 2365, 3141): for få vedtak (5). Dekkes av «Sa annonsen eller selgeren noe som ikke stemte?».
- **Garantien dekker ikke feilen** (vilkår om service, unntak for slitasje eller rust; 1549, 2019, 3060, 3181, 2430): gjelder garantikrav, mens brevet bygger på forbrukerkjøpsloven. Uklar garanti er tatt med i `garanti_uklar`.
- **Forlik eller minnelig avtale** (1528, 2137, 2695) og **frister, formkrav og næringskjøp** i avviste saker (1627, 1736, 2617, 1659): for få vedtak, eller saksbehandling og harde stopp som skjemaet alt fanger.
- **Kjent svakhet ved modellen** og **sakkyndig undersøkte bilen fysisk**: slått sammen med `rapport_upaaregnelig` og `rapport_arsak`.
- **Annonsert utstyr mangler eller virker ikke**: slått sammen med `uriktig_service_arbeid_utstyr`. At opplysningen ikke ble rettet, er eget moment (`rettet_for_kjop`).
- **Kjøperen spurte konkret før kjøpet** (bare ≈4): slått sammen med `positiv_beskrivelse`.

