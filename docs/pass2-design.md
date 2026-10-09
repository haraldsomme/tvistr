# Pass 2: Uttrekk av vurderingsgrunnlag fra vedtakene

*Design godkjent 2026-10-09. Ingenting er bygget ennå.*
Bakgrunn: [vedtakssammenligning-datasjekk.md](vedtakssammenligning-datasjekk.md) · Spordefinisjon: [spor.md](spor.md)

## 1. Formål og avgrensning

Pass 2 skal gi brevmotoren det datasjekken viste at mangler: **utfall per feil**, **hvilket spor (A/B/C) hver feil ble prøvd på**, **hva selger skrev**, **hva bevisene sa**, **når feilen viste seg** og **ordrette sitater fra begrunnelsen**. Praksisavsnittet i brevet slås ikke på før piloten er godkjent (avsnitt 9).

| | |
|---|---|
| Omfang | Grunnutvalget: personbil eller varebil, `lov = forbrukerkjøpsloven`, utfall ≠ avvist. 2 359 vedtak. |
| Kjøring | Agenter i Claude Code (ikke Claude API). Bruker abonnementskvoten, ikke API-kreditt. |
| Kilde | `vedtak.fulltekst_renset`, som allerede er anonymisert. Agentene leser aldri `data/raw/`. |
| Uendret | Tabellen `vedtak` og tolk-v4-feltene. Pass 2 skriver bare til nye tabeller. |

**Ikke en del av pass 2:** brevmotoren, skjemaet for brukeren, rendering av praksisavsnittet, nye kjøretøytyper og saker etter kjøpsloven.

## 2. Hovedprinsipp

**Agenten henter ut fakta, og importskriptet trekker konklusjoner.** Agenten svarer på hva som står i vedtaket. Spor, lovversjon, frister, sammendrag og filterkolonner regnes ut i kode fra agentens fakta. Endres en definisjon (for eksempel i [spor.md](spor.md)), kjøres importen på nytt uten nye agentkjøringer.

## 3. Arkitektur

```
vedtak (DB) ─► pass2:hent ─► data/pass2/inn/<vedtak_id>.txt ─► agenter (Workflow) ─► data/pass2/ut/<vedtak_id>.<instruks_versjon>.json
                                                                                                 │
          vedtak_analyse + vedtak_feil (DB) ◄── pass2:importer ◄─────────────────────────────────┘
                                                     └─► data/pass2/avvist/<vedtak_id>.<instruks_versjon>.json (med begrunnelse)
```

| Del | Fil | Ansvar |
|---|---|---|
| Uttak | `scripts/pass2-hent.ts` (`npm run pass2:hent -- --pilot \| --id 1,2 \| --alle \| --mangler`) | Skriver én tekstfil per vedtak: metadata (vedtak_id, saksnummer, kjøpsdato, overtakelsesdato, vedtaksdato, utfall, kravtyper, prinsipalt krav) og `fulltekst_renset`. Med `--mangler` tas bare vedtak uten gyldig analyse for gjeldende instruksversjon. |
| Instruks | `src/lib/analyse/instruks.md` | Det agenten følger: felt, verdilister, definisjoner, sitatregel og eksempler. Har en versjon (`pass2-v1`). |
| Skjema | `src/lib/analyse/skjema.ts` | JSON-skjema og TypeScript-typer for agentsvaret, og alle verdilister. |
| Agentkjøring | Workflow i Claude Code | 5 vedtak per agent i piloten, 10 deretter (avsnitt 8). Modell: Sonnet 5.5, satt eksplisitt. Agenten leser instruksen og inn-filene og skriver ut-filer. Ingen databasetilgang og ingen nettverk. |
| Verifisering | `src/lib/analyse/verifiser.ts` | Sitatkontroll og konsistenssjekker (avsnitt 6). Rene funksjoner. |
| Avledning | `src/lib/analyse/avled.ts` | Spor, lovversjon, frister, sammendrag og filterkolonner (avsnitt 7). Rene funksjoner. |
| Import | `scripts/pass2-importer.ts` (`npm run pass2:importer`) | Leser ut-filer, validerer, verifiserer, avleder og lagrer ved upsert. Brudd på skjemaet går til `avvist/`. |
| Database | `src/db/schema.ts` + Drizzle-migrasjon | `vedtak_analyse`, `vedtak_feil` og viewet `vedtak_feil_sok` (avsnitt 5). |

`data/` er allerede git-ignorert.

## 4. Agentens svar (JSON per vedtak)

Alle feltene er fakta fra vedtaket. Står noe ikke der, er feltet `null` eller en tom liste; agenten skal aldri gjette eller regne. Alle `sitat`-felt følger sitatregelen i 4.6.

### 4.1 Toppnivå
| Felt | Type | Beskrivelse |
|---|---|---|
| `vedtak_id` | heltall | Fra inn-filen. |
| `ikke_mangelssak` | `null` eller `{grunn, sitat}` | Saken avgjøres uten mangelsvurdering. `grunn` er en av: `ikke_levert`, `innbytte_restgjeld`, `partsforhold` (innklagde frifunnet fordi de var feil part, for eksempel ved formidling), `annet`. Heftelser er ikke her; de er en feil med kategori `heftelse_pant`. |
| `feil` | liste (4.2) | Én post per påberopt feil. Kan være tom når `ikke_mangelssak` er satt. |
| `opplysninger` | liste (4.3) | |
| `bevis` | liste (4.4) | |
| `forste_henvendelse` | `{dato, form, sitat}` | Første kontakt med selger om feilen, også muntlig. `form` er `muntlig`, `skriftlig` eller `ukjent`. `dato` er ÅÅÅÅ-MM-DD eller `null`. |
| `paragrafer_med_ledd` | liste av tekst | Slik utvalget anvender dem, for eksempel «fkjl § 16 første ledd bokstav c». Ikke paragrafer som bare står i partenes anførsler. |
| `begrunnelse_sitater` | liste (4.5) | |
| `usikkerhet` | tekst eller `null` | Hva agenten var i tvil om. |

### 4.2 `feil[]`
| Felt | Verdier |
|---|---|
| `id` | `f1`, `f2` … (unik innen vedtaket) |
| `kategori` | Dagens 15 (unntatt `annet`), de 11 nye (`karosseri_lakk_glass`, `dekk_felger`, `utstyr_mangler`, `eksos_utslipp`, `eu_kontroll_registrering`, `interior_lukt`, `drivlinje`, `garanti_vilkar`, `ombygging_tuning`, `arsmodell_identitet`, `heftelse_pant`) og `annet` som siste utvei. Plasseringsreglene står i instruksen (turbo og kjøling → motor, servo og styring → understell, infotainment og sensorer → elektrisk, rekkevidde → batteri_elbil). |
| `komponent` | fritekst, kort («registerreim», «venstre bakskjerm») |
| `vurdering` | `mangel`, `ikke_mangel`, `ikke_vurdert` (utvalget tok ikke stilling) eller `samlet_vurdering` (vurdert bare sammen med andre feil) |
| `grunn` | Ved `ikke_mangel`: `paregnelig_slitasje`, `ikke_sannsynliggjort_ved_levering`, `ikke_dokumentert` (ingen bevis for at feilen finnes), `kjent_eller_opplyst`, `synlig_ved_besiktigelse` (fkjl § 16 tredje ledd), `forbehold`, `reklamert_for_sent`, `oppstatt_etter_levering`, `utbedret_av_selger`, `annet`. Ellers `null`. |
| `grunnlag` | Ved `mangel`, juridisk grunnlag: `avvik_fra_avtale`, `feil_opplysning`, `tilbakeholdt_opplysning`, `darligere_stand_som_den_er`, `offentligrettslig`. Ellers `null`. |
| `bevisgrunnlag` | Ved `mangel`, hvorfor utvalget fant det bevist: `formodning_ikke_motbevist`, `dokumentert_utover_paregnelig`, `erkjent_av_selger`, `uomtvistet`, `utvalgets_skjonn`. Ellers `null`. |
| `viste_seg` | `{dato, presisjon, dager_etter_levering}`. `presisjon` er `dag`, `maaned`, `omtrentlig` eller `ukjent`. `dager_etter_levering` fylles bare når vedtaket oppgir tid («to uker etter») eller dato. |
| `formodning` | `anvendt_for_klager`, `avkreftet`, `nevnt`, `ikke_aktuell` eller `ikke_nevnt`. Gjelder denne feilen. |
| `belop_tilkjent_nok` | heltall eller `null`. Bare når vedtaket selv knytter et beløp til denne feilen. Aldri fordelt eller utregnet. |
| `alvor` | Liste: `trafikkfarlig` og/eller `ikke_kjorbar`, med `alvor_sitat`. Settes bare når utvalget eller et bevis uttaler det. Tom liste betyr at det ikke er omtalt. |
| `sitat` | Utvalgets konklusjon om denne feilen. |

### 4.3 `opplysninger[]`
| Felt | Verdier |
|---|---|
| `type` | `uttalelse` (selger sa eller skrev noe) eller `taushet` (selger unnlot å opplyse) |
| `form` | `annonse`, `kontrakt`, `melding` (sms, e-post), `salgsoppgave`, `tilstandsrapport_fra_selger`, `muntlig`, `annet`, eller `null` ved taushet |
| `ordlyd` | Ordrett tekst fra selger, slik den er gjengitt i vedtaket. `null` ved muntlig, taushet eller når vedtaket bare refererer. |
| `gjelder` | Kort fritekst om hva opplysningen gjaldt |
| `svar_pa_direkte_sporsmal` | `true` hvis opplysningen var svar på et direkte spørsmål fra kjøper, ellers `false` |
| `status` | `lagt_til_grunn`, `omtvistet` eller `avvist` |
| `vekt` | `for_klager`, `mot_klager` eller `ingen` |
| `gjelder_feil` | Liste av feil-id-er. En tom liste betyr at opplysningen gjelder saken generelt. |
| `sitat` | Utvalgets omtale av opplysningen |

**Dokumenter selger la ved salget** (for eksempel en NAF-test eller tilstandsrapport vedlagt annonsen) registreres alltid som en opplysning med `form = tilstandsrapport_fra_selger`. Påberoper selger dokumentet i saken, registreres det *i tillegg* som `bevis[]` med `fremlagt_av = selger`. Instruksen må si dette eksplisitt, ellers velger agentene én av de to tilfeldig.

### 4.4 `bevis[]`
Én post per dokument eller kilde. Selgers motbevis får egne poster.

| Felt | Verdier |
|---|---|
| `type` | `verkstedrapport`, `NAF_test`, `takst`, `EU_kontroll`, `tilstandsrapport`, `faktura`, `servicehistorikk`, `sakkyndig_uttalelse`, `bilder`, `korrespondanse`, `annet` |
| `avsender` | Firma eller rolle (for eksempel «merkeverksted», «NAF»), aldri personnavn |
| `fremlagt_av` | `klager`, `selger` eller `ukjent` |
| `dato`, `km_ved_undersokelse` | Når undersøkelsen ble gjort og kilometerstand på det tidspunktet. `null` hvis ikke oppgitt. |
| `arsak` | `rotarsak`, `komponent` (bare komponenten er navngitt) eller `ingen` |
| `ved_levering` | Hva *dokumentet selv* sier: `ja`, `nei` eller `uttaler_seg_ikke`. Ikke utvalgets slutning. |
| `paregnelig` | Hva *dokumentet selv* sier: `utover`, `innenfor` eller `uttaler_seg_ikke` |
| `kostnad_nok` | Utbedringskostnad i dokumentet (ikke kostnaden for selve undersøkelsen) |
| `utvalgets_vurdering` | `vektlagt`, `ikke_vektlagt` eller `ikke_nevnt` |
| `avslagsgrunn` | Ved `ikke_vektlagt`: `for_generell`, `sier_ikke_naar`, `sier_ikke_paregnelig`, `motbevist`, `for_sent_utfort` eller `annet`. Ellers `null`. |
| `gjelder_feil` | Liste av feil-id-er |
| `sitat` | Utvalgets omtale av dokumentet |

### 4.5 `begrunnelse_sitater[]`
`{tema, tekst, gjelder_feil}`. `tema` er `mangel`, `bevis`, `opplysning`, `formodning`, `reklamasjon`, `sanksjon` eller `belop`. `tekst` er ordrett fra utvalgets vurdering (del III eller etter «Utvalget ser slik på saken»), 1–3 setninger. Høyst 8 per vedtak.

### 4.6 Sitatregel
- Sitatet kopieres tegn for tegn fra fulltekst. Agenten skal ikke omformulere eller sette sammen tekst fra ulike steder.
- «…» markerer at ord er utelatt. Hver bit mellom «…» må finnes i fulltekst, i samme rekkefølge.
- Hver bit skal være minst 20 tegn.
- Plassholdere som [KLAGER] og [PERSON] står slik de er.
- Importen er tolerant for linjebrudd i PDF-teksten (avsnitt 6), så agenten skal skrive sitatet som sammenhengende tekst.

## 5. Datamodell

### 5.1 `vedtak_analyse`
Ett rad per vedtak. Kjøres pass 2 på nytt, erstattes raden; tidligere svar ligger som filer.

| Kolonne | Type | Kilde |
|---|---|---|
| `vedtak_id` | int, PK, FK → vedtak (cascade) | |
| `instruks_versjon`, `ai_modell`, `analysert_tidspunkt` | tekst, tekst, timestamptz | import |
| `fulltekst_sha256` | tekst | Sha256 av `fulltekst_renset` som sitatene er sjekket mot |
| `raasvar_sha256` | tekst | Sha256 av ut-filen |
| `ikke_mangelssak` | bool | Agentens felt, eller `vedtak.klager_er_forbruker = false` |
| `ikke_mangelssak_grunn` | tekst | |
| `lovversjon` | tekst (`før_2024`, `etter_2024`, `ukjent`) | Avledet (7.1) |
| `spor` | tekst[] | Union av spor per feil |
| `formodning_anvendt` | bool | Minst én feil har `anvendt_for_klager` |
| `dager_til_feil` | int | Laveste `dager_etter_levering` blant feilene |
| `forste_henvendelse_dato`, `forste_henvendelse_form` | date, tekst | Agentens felt |
| `grunnlag` | tekst[] | Union av `feil[].grunnlag` |
| `opplysning_skriftlig_for_klager` | bool | Avledet (7.3) |
| `selger_bevis_finnes` | bool | Minst én post med `fremlagt_av = selger` |
| `bevis_utover_paregnelig` | bool | Minst én post fra klager med `paregnelig = utover` |
| `paragrafer_med_ledd` | tekst[] | Agentens felt |
| `feil`, `opplysninger`, `bevis`, `begrunnelse_sitater` | jsonb | Agentens lister, med `sitat_verifisert` lagt på hvert sitat |
| `kontroll_arsaker` | tekst[] | Fra verifiseringen (avsnitt 6) |
| `qa_status`, `qa_kommentar`, `qa_tidspunkt` | som i `vedtak` | Manuell kontroll |

Indekser: GIN på `spor` og `grunnlag`, og vanlig indeks på `lovversjon` og `ikke_mangelssak`.

### 5.2 `vedtak_feil`
Én rad per feilpunkt. Det er denne motoren matcher mot.

| Kolonne | Type |
|---|---|
| `vedtak_id`, `feil_id` | int, tekst. Samlet primærnøkkel; FK → vedtak_analyse (cascade). |
| `kategori`, `komponent`, `vurdering`, `grunn`, `grunnlag`, `bevisgrunnlag` | tekst |
| `spor` | tekst[]: spor feilen ble prøvd på (7.2) |
| `spor_vunnet` | tekst[]: spor feilen vant på (7.2). Tom ved `ikke_mangel`. |
| `alvor` | tekst[] |
| `dager_etter_levering`, `viste_seg_presisjon` | int, tekst |
| `innen_formodningsfrist` | bool eller null (7.1) |
| `formodning` | tekst |
| `belop_tilkjent_nok` | int |
| `har_skriftlig_opplysning`, `har_sakkyndig_bevis` | bool (7.3) |

Indekser: `kategori`, `vurdering`, og GIN på `spor` og `spor_vunnet`.

`spor_vunnet` er avledet, ikke duplisert: det regnes ut i `avled.ts` fra de samme faktaene hver gang importen kjøres. Kolonnen finnes fordi matchingen filtrerer på «vunnet på spor X» i hver spørring.

### 5.3 Viewet `vedtak_feil_sok`
Viewet er `vedtak_feil` join `vedtak_analyse` join `vedtak`. Det legger til `saksnummer`, `vedtaksdato`, `kilde_url`, `selger_type`, `alder_ved_kjop`, `km_ved_kjop`, `kjopesum_nok`, `utfall`, `lovversjon` og `ikke_mangelssak`.

Vedtaksfeltene kopieres ikke inn i tabellen, så de kan ikke komme ut av takt. Saker med `ikke_mangelssak = true` er med i viewet, og motoren filtrerer dem bort.

## 6. Verifisering i importen

**Harde feil.** Svaret flyttes til `avvist/`, og ingenting lagres:
- svaret er ikke gyldig JSON, eller bryter skjemaet (bruker `sjekkSkjema` fra `src/lib/ai/skjemasjekk.ts`);
- `vedtak_id` mangler eller er ukjent;
- to feil har samme `id`.

**Myke feil.** Feltet rettes eller nulles, og årsaken skrives i `kontroll_arsaker`:

| Sjekk | Tiltak |
|---|---|
| Sitatet finnes ikke i fulltekst. Begge sider normaliseres først: «» og "" behandles likt, alle mellomrom og linjeskift slås sammen til ett mellomrom, og bindestrek ved linjeskift («rust-⏎skader») prøves både fjernet («rustskader») og beholdt («rust-skader»), så ekte bindestreker som «EU-kontroll» også treffer. | Sitatet settes til `null`, `sitat_verifisert = false`. |
| `ordlyd` finnes ikke i fulltekst | `ordlyd` settes til `null` og flagges |
| `gjelder_feil` peker på en id som ikke finnes | Referansen fjernes |
| `vurdering = mangel` uten `grunnlag`, eller `ikke_mangel` uten `grunn` | Flagges |
| `viste_seg.dato` og `dager_etter_levering` avviker mer enn 3 dager fra hverandre (regnet fra overtakelse eller kjøp) | Flagges; datoen brukes |
| `vedtak.utfall = medhold` men ingen feil er `mangel`, eller `ikke_medhold` men en feil er `mangel` uten `grunn = reklamert_for_sent` | Flagges |
| Summen av `belop_tilkjent_nok` er større enn `tilkjent_totalt_nok` | Flagges |
| Personnavn i fritekst. Samme mønstre som `src/lib/personvern` bruker for gjenværende funn. | Feltet settes til `null` og flagges |

## 7. Avledning (`avled.ts`)

### 7.1 Lovversjon og formodningsfrist
- **Lovversjon:** `kjopsdato` gir svaret (før 2024-01-01 → `før_2024`, ellers `etter_2024`). Mangler kjøpsdato, brukes `overtakelsesdato`. Mangler begge, gir `vedtaksdato < 2024-06-01` → `før_2024`. Ellers `ukjent`.
- **Frist:** 183 dager for `før_2024`, 730 dager for `etter_2024`.
- **`innen_formodningsfrist`:** `dager_etter_levering ≤ frist`. `null` når tiden er ukjent.

### 7.2 Spor per feil
Spor betyr hvilket spor feilen ble **prøvd** på, uansett utfall. Utfallet står i `vurdering`. Matchingen kan da finne både saker som vant og saker som tapte på samme spor.

| Spor | Settes når |
|---|---|
| **A** | Feilen er knyttet (via `gjelder_feil`) til en opplysning med `type = uttalelse` og skriftlig form (`annonse`, `kontrakt`, `melding`, `salgsoppgave` eller `tilstandsrapport_fra_selger`). Det gjelder også når `grunnlag = feil_opplysning` og opplysningen er skriftlig. |
| **B** | `innen_formodningsfrist = true`, eller `formodning` er `anvendt_for_klager` eller `avkreftet`. |
| **C** | Feilen er knyttet til et bevis fra klager av typen `verkstedrapport`, `NAF_test`, `takst`, `sakkyndig_uttalelse` eller `tilstandsrapport`, der dokumentet uttaler seg om `paregnelig` eller `ved_levering`. |

**`spor_vunnet`** settes bare når `vurdering = mangel`:
- A: en knyttet skriftlig opplysning har `status = lagt_til_grunn` og `vekt = for_klager`;
- B: `bevisgrunnlag = formodning_ikke_motbevist`;
- C: `bevisgrunnlag = dokumentert_utover_paregnelig`.

`alvor` påvirker ikke sporene. Det lagres som fakta per feil og kan brukes i matching og i vurderingen av heving. Skal trafikkfarlige feil telle som spor C, må [spor.md](spor.md) endres først (se avsnitt 12).

Dette er de konkrete reglene bak [spor.md](spor.md). Endres definisjonen, endres bare denne funksjonen.

### 7.3 Boolske felt
- **`har_skriftlig_opplysning`** (per feil): spor A er satt.
- **`opplysning_skriftlig_for_klager`** (per vedtak): minst én skriftlig opplysning med `status = lagt_til_grunn` og `vekt = for_klager`.
- **`har_sakkyndig_bevis`** (per feil): spor C er satt.

## 8. Agentkjøringen

- **Workflow:** listen av vedtak-id-er deles i bolker. Hver bolk går til én agent (modell `sonnet`), med en fast prompt: les instruksen, les inn-filene, skriv én ut-fil per vedtak og rapporter hvilke som ble skrevet.
- **Ett vedtak om gangen:** agenten skal skrive ut-filen ferdig før den leser neste inn-fil. Det hindrer at kvaliteten faller mot slutten av bolken, og gjør avbrudd ufarlige.
- **Bolkstørrelse:** 5 vedtak per agent i piloten. Holder kvaliteten seg like god i siste som i første vedtak i bolkene, økes det til 10 for fullkjøringen.
- **Volum:** Piloten er 24 agenter (100 vedtak + 20 til stabilitetstesten, à 5). Fullkjøringen er 236–472 agenter, avhengig av bolkstørrelse, kjørt i porsjoner over flere økter.
- **Gjenopptak:** `pass2:hent --mangler` lager bare filer for vedtak uten gyldig analyse. Kjøringen kan stoppes og fortsettes uten tap.
- **Omkjøring:** vedtak i `avvist/` kjøres på nytt én gang. Avvises de igjen, gjennomgås de i hovedøkten. Brukeren gjør ikke dette.
- **Kvote:** omtrent 10–15 millioner tokens for hele grunnutvalget. Det belaster abonnementet og kan treffe bruksgrenser. Derfor kjøres det i porsjoner.
- **Personvern:** agentene ser bare renset tekst. Ut-filene ligger under `data/`, som er git-ignorert. Importen kjører en egen sjekk for personnavn i fritekstfeltene (avsnitt 6).

## 9. Pilot og godkjenning

### 9.1 Utvalg
- **100 nye vedtak** fra grunnutvalget. De trekkes med `md5(id || 'pass2-pilot')`, så de kan trekkes på nytt.
- Vedtak som er lest i datasjekken holdes utenfor, fordi de brukes som eksempler i instruksen. Testen må gjøres på saker instruksen ikke er skrevet ut fra.
- Utvalget er stratifisert:
  - 50 med delvis medhold og minst to feiltyper;
  - 25 med medhold, eller delvis medhold med én feil;
  - 25 uten medhold, hvorav minst 15 med verkstedrapport eller NAF-test.

**Stabilitetstest:** 20 av de 100 vedtakene kjøres en gang til med samme instruks, i nye agenter. Råsvarene fra andre kjøring lagres separat og importeres ikke.

### 9.2 Måling
Datasjekkens lesesjekker gjentas på pilotens resultat.

- **Kontrollagentene** bruker Opus. De får fulltekst, agentsvar og instruksen, men ikke resultatene fra datasjekken.
- **Hver uenighet må dokumenteres med sitat** fra fulltekst. Det gjør det mulig å kontrollere kontrollagenten.
- **Kalibrering av kontrollen:** en andre, uavhengig kontrollagent (Opus) kontrollerer de 20 sakene i stabilitetstesten på nytt, uten å se den første dommen. Den får beskjed om aktivt å lete etter feil. Enigheten mellom de to måles per felt og feil. Uenighetene gjennomgås i hovedøkten, og konklusjonen står i pilotrapporten. Brukeren fyller ikke ut noe selv.

| Sjekk | Hva måles | Krav før praksisavsnittet slås på |
|---|---|---|
| 3 – utfall per feil | Andel feil med riktig `vurdering` (≥ 50 saker) | **> 90 %** |
| 4 – grunnlag | Andel feil med riktig `grunnlag` og `bevisgrunnlag` | **> 90 %** |
| 5c – opplysninger | Ordlyd, form og vekt riktig | Rapporteres |
| 6c – bevis | De fire ja/nei-spørsmålene riktige per dokument | Rapporteres |
| 7 – formodning | Presisjon og dekning for `anvendt_for_klager` | Rapporteres |
| 8 – tid | `viste_seg` stemmer med fulltekst | Rapporteres |
| 11 – sitater | Andel sitater som finnes i fulltekst før nulling | **100 % av lagrede sitater** (sikres av importen). Andelen som ble nullet rapporteres. |
| Spor | Spor og vunnet spor per feil stemmer med lesingen etter [spor.md](spor.md) | **> 90 %** |
| Kalibrering | Enighet mellom de to kontrollagentene, per felt og feil, på de 20 sakene | **≥ 90 %**. Under det er kontrolltallene ikke til å stole på, og kontrollinstruksen må strammes inn før pilotresultatet brukes. |
| Stabilitet | Andel feil med identisk `vurdering`, `grunnlag`, `bevisgrunnlag`, `spor` og `spor_vunnet` mellom de to kjøringene av de 20 vedtakene. Feilene pares på `kategori` og `komponent`. | **≥ 90 %**. Under det er instruksen for åpen, uansett treffandel. |

Treffandelen beregnes med Wilson-intervall (`src/lib/data/statistikk.ts`). Kravet gjelder den nedre grensen hvis utvalget er under 100 feilpunkter.

### 9.3 Utfall
- **Godkjent:** fullkjøring med `--alle`, i porsjoner.
- **Ikke godkjent:** juster instruksen, øk `instruks_versjon` og kjør piloten på nytt på nye 100 vedtak.

## 10. Krav til instruksen

Instruksen gjennomgås mot disse kravene før prøvekjøringen på 5 vedtak:

1. **Hva dokumentet sier, ikke hva utvalget konkluderte.** `bevis[].ved_levering` og `paregnelig` gjelder hva dokumentet selv sier. Instruksen skal ha to kontrasteksempler:
   - et der rapporten sier at feilen går utover det påregnelige, men utvalget avviser rapporten;
   - et der utvalget konkluderer med mangel uten at rapporten sa noe om det.
2. **`grunnlag` og `bevisgrunnlag` er to forskjellige spørsmål.** `grunnlag` er hvorfor det er en mangel; `bevisgrunnlag` er hvorfor det er bevist. Instruksen skal ha et eksempel med begge satt, for eksempel `tilbakeholdt_opplysning` sammen med `formodning_ikke_motbevist`.
3. **Selgers dokumenter registreres to steder.** Regelen i 4.3 skal stå med et eksempel.
4. **Plasseringsregler for kategorier** (4.2), med eksempler på «annet» som skal flyttes til en av de nye kategoriene.
5. **Eksemplene hentes fra sakene i datasjekken.** De er ikke med i piloten (9.1).

## 11. Rekkefølge

1. Skjema og typer i `src/lib/analyse/skjema.ts`.
2. `verifiser.ts` og `avled.ts`.
3. Migrasjon for `vedtak_analyse`, `vedtak_feil` og viewet. Ta `npm run db:backup` før migrasjonen.
4. `pass2-hent.ts` og `pass2-importer.ts`.
5. Instruksen i `src/lib/analyse/instruks.md`, gjennomgått mot avsnitt 10 før prøvekjøringen.
6. Prøvekjøring på 5 vedtak og import, med gjennomgang av råsvarene.
7. Piloten på 100 vedtak, stabilitetstest og måling (avsnitt 9).
8. Beslutning om fullkjøring.

## 12. Beslutninger og åpne spørsmål

**Besluttet:**
- `spor_vunnet[]` lagres som en avledet og indeksert kolonne i `vedtak_feil`.
- `vedtak.feiltyper` beholdes uendret. Fra nå er `vedtak_feil` fasiten for feil, og vi oppdaterer ikke tolk-v4-feltet, for da får vi to sannheter.
- Kontrollagentene bruker Opus, uten tilgang til datasjekkens svar, og dokumenterer hver uenighet med sitat.

**Åpent:**
- **Alvor og spor C:** skal en trafikkfarlig feil eller en bil som ikke er kjørbar telle som spor C uten sakkyndig dokumentasjon? I dag sier [spor.md](spor.md) nei. Velger vi ja, endres `spor.md` og `avled.ts`, og importen kjøres på nytt. Agentsvarene trenger ikke kjøres på nytt.
