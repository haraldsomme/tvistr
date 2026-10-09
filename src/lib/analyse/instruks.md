# Pass 2: instruks for uttrekk (pass2-v3)

Du leser ett vedtak fra Forbrukerklageutvalget (FKU) eller Forbrukertvistutvalget om kjøp av brukt bil, og skriver ett JSON-svar med **fakta fra vedtaket**. Svarene brukes til å sammenligne nye klager med tidligere vedtak, og sitatene kan bli vist til forbrukere. Et feil svar kan gi en forbruker feil råd.

## Grunnregler
1. **Bare det som står i vedtaket.** Står det ikke der: `null` eller tom liste. Aldri gjett, regn ut eller fordel.
2. **Skill partene fra utvalget.** Del I–II gjengir hva klageren og innklagede *anførte*. Del III («Utvalget ser slik på saken») og selve vedtaket til slutt er hva utvalget *kom til*. `vurdering`, `grunn`, `grunnlag`, `bevisgrunnlag`, `status`, `vekt` og `utvalgets_vurdering` er alltid **utvalgets** syn.
3. **Alle nøkler skal være med**, også når verdien er `null`. Ingen ekstra nøkler.
4. **Bare verdiene i listene nedenfor**, stavet nøyaktig likt.
5. **Ingen personnavn.** Teksten er renset. Plassholdere som `[KLAGER]`, `[PERSON]` og `[REGNR]` skal stå slik de er.
6. **Datoer** skrives `ÅÅÅÅ-MM-DD`. Er bare måned eller år oppgitt: `dato: null`, og velg riktig `presisjon`.
7. **Beløp** skrives i hele kroner som heltall (kr 18 535,- → `18535`).

## Sitatregel
- `sitat`, `alvor_sitat`, `ordlyd` og `begrunnelse_sitater[].tekst` kopieres **tegn for tegn** fra vedtaket. Ikke rett skrivefeil, ikke bytt ord, og ikke sett sammen setninger fra ulike steder.
- Utelater du ord, skriv `…`. Hver bit mellom `…` må være minst 20 tegn. Det gjelder ikke `ordlyd`.
- Skriv sitatet på én linje uten linjeskift.
- Sitater som ikke finnes i teksten, slettes automatisk. Et kort, ordrett sitat er bedre enn et langt som ikke er det.

## Arbeidsrekkefølge for hvert vedtak
1. Les hele vedtaket.
2. Lag `feil[]` fra det **klageren gjør gjeldende** (del I–II), delt opp slik utvalget tar stilling til dem (se `feil[]`). Gi feilene id `f1`, `f2` … i den rekkefølgen de nevnes.
3. Les utvalgets vurdering, og fyll inn utfallet for hver feil.
4. Fyll inn `opplysninger[]` og `bevis[]`, og knytt dem til feilene med `gjelder_feil`.
5. Fyll inn de øvrige feltene og `begrunnelse_sitater[]`.
6. Kontroller at hver id i `gjelder_feil` finnes i `feil[]`, og at alle nøkler er med.
7. Skriv fila før du leser neste vedtak.

## Svarformat
```json
{
  "vedtak_id": 0,
  "ikke_mangelssak": null,
  "feil": [
    {
      "id": "f1", "kategori": "", "komponenter": [], "vurdering": "", "samlet_utfall": null,
      "grunn": null, "grunnlag": null, "bevisgrunnlag": null,
      "viste_seg": { "dato": null, "presisjon": "ukjent", "dager_etter_levering": null },
      "formodning": "ikke_nevnt", "belop_tilkjent_nok": null,
      "alvor": [], "alvor_sitat": null, "sitat": null
    }
  ],
  "opplysninger": [
    {
      "type": "", "form": null, "ordlyd": null, "rekkevidde": null, "gjelder": null, "svar_pa_direkte_sporsmal": false,
      "status": "", "vekt": "", "gjelder_feil": [], "sitat": null
    }
  ],
  "bevis": [
    {
      "type": "", "avsender": null, "fremlagt_av": "", "dato": null, "km_ved_undersokelse": null,
      "arsak": "", "ved_levering": "", "paregnelig": "", "kostnad_nok": null,
      "utvalgets_vurdering": "", "avslagsgrunn": null, "gjelder_feil": [], "sitat": null
    }
  ],
  "forste_henvendelse": { "dato": null, "form": "ukjent", "sitat": null },
  "paragrafer_med_ledd": [],
  "begrunnelse_sitater": [ { "tema": "", "tekst": "", "gjelder_feil": [] } ],
  "usikkerhet": null
}
```
`vedtak_id` hentes fra `VEDTAK_ID` i inn-fila. Tomme lister er lov.

## ikke_mangelssak
Settes bare når utvalget avgjør saken **uten å vurdere om bilen hadde en mangel**: `{ "grunn": …, "sitat": … }`. Ellers `null`.

| grunn | Når |
|---|---|
| `ikke_levert` | Bilen ble aldri levert, uten at kjøper avbestilte |
| `avbestilling_angrerett` | Saken gjelder avbestilling, angrerett eller om det ble inngått en avtale |
| `innbytte_restgjeld` | Saken gjelder innbytte, restgjeld eller pant i innbyttebilen, ikke den kjøpte bilen |
| `partsforhold` | Innklagede frifinnes fordi de ikke var selger (for eksempel formidling) |
| `foreldet_eller_for_sen_reklamasjon` | Hele kravet faller fordi det er foreldet eller reklamert for sent, og utvalget tar ikke stilling til om det var en mangel. 23/16484: «Som følge av at kravet er foreldet, tar ikke utvalget stilling til klagerens anførsel om at bilen er mangelfull.» |
| `forlik_eller_avtale` | Partene hadde inngått en avtale eller et forlik om feilene, og utvalget avgjør saken etter den |
| `annet` | Annen sak uten mangelsvurdering (for eksempel en parkeringsbot) |

Gjelder for sen reklamasjon bare **noen** av feilene, er saken ikke `ikke_mangelssak`. Da får de feilene `vurdering: "ikke_mangel"` og `grunn: "reklamert_for_sent"`.

Heftelse på den kjøpte bilen hører **ikke** hit. Det er en feil med kategori `heftelse_pant`.

## feil[]
**Én post per enhet utvalget tar stilling til.** Behandler utvalget «rust på kanal og dør» i én setning med ett utfall, er det **én** feil med `komponenter: ["kanal", "dør"]`. Del bare opp når utvalget gir ulikt utfall eller ulik begrunnelse for delene, for eksempel rust på to steder der bare det ene er mangel.

- **Feil utvalget ikke tar stilling til** (`ikke_vurdert`): følg klagerens egen punktliste, én post per punkt.
- **NAF-punkter og verkstedanmerkninger er ikke feil før klageren påberoper dem.** En NAF-test med 15 anmerkninger gir ikke 15 feil. Anmerkninger klageren ikke selv har løftet frem, hører til testens post i `bevis[]`, ikke i `feil[]`.
- **Vurderer utvalget hele testen samlet** («feilene NAF påviste»), er det én feil med `vurdering: "samlet_vurdering"`, der `komponenter` lister det testen fant.

**kategori** (velg den mest konkrete):
`motor`, `girkasse`, `clutch`, `elektrisk`, `batteri_elbil`, `bremser`, `understell_hjuloppheng`, `rust`, `klimaanlegg`, `kollisjonsskade`, `km_avvik`, `servicehistorikk`, `bruktimport_opplysning`, `fukt_lekkasje`, `ramme_chassis`, `karosseri_lakk_glass`, `dekk_felger`, `utstyr_mangler`, `eksos_utslipp`, `eu_kontroll_registrering`, `interior_lukt`, `drivlinje`, `garanti_vilkar`, `ombygging_tuning`, `arsmodell_identitet`, `heftelse_pant`, `annet`.

Plasseringsregler:
- **`motor`:** turbo, registerreim, kjølesystem, vannpumpe og oljeforbruk.
- **`understell_hjuloppheng`:** servo og styring.
- **`elektrisk`:** infotainment, navigasjon, sensorer, parkeringsvarmer (Webasto), lys og låser.
- **`batteri_elbil`:** rekkevidde på elbil.
- **`eksos_utslipp`:** partikkelfilter, EGR, katalysator, AdBlue og utslippsprogramvare.
- **`drivlinje`:** firehjulstrekk, differensial, drivaksel, kardang og fordelerkasse.
- **`utstyr_mangler`:** utstyr eller tilbehør som manglet eller ikke var som avtalt eller annonsert, også nøkler, reservehjul og programvarepakker.
- **`karosseri_lakk_glass`:** lakk, bulker, riper, frontrute, støtfanger og speil. Er det en tidligere kollisjonsskade, bruk `kollisjonsskade`.
- **`eu_kontroll_registrering`:** bilen var ikke EU-godkjent, eller det gjelder registrering, vognkort, omregistrering eller avgift.
- **`interior_lukt`:** seter, skinn, lukt, røyk og vann i dørken.
- **`annet`** bare når ingenting annet passer.

Eksempler på feil som ikke skal stå under `annet`:
- «bulk på kanal» (21/3566) → `karosseri_lakk_glass`
- «dekkdimensjon ikke er godkjent» (24/1043) → `dekk_felger`
- «knekt antenne» (23/9931) → `utstyr_mangler`

**komponenter:** liste med korte fritekster for det klageren nevnte innenfor denne feilen, for eksempel `["registerreim", "strammehjul"]` eller `["venstre bakskjerm"]`.

**vurdering:**

| Verdi | Når | Eksempel (ordrett) |
|---|---|---|
| `mangel` | Utvalget fant at **denne** feilen er en mangel, også om kravet ble redusert | 23/9931: «Etter dette utgjør bruksmerkene/småskadene og den knekte antennen kjøpsrettslige mangler ved bilen.» |
| `ikke_mangel` | Utvalget fant at denne feilen ikke er en mangel | 23/9931: «Bremser er å betegne som slitedeler som vanligvis vil kreve flere utskiftinger i løpet av bilens levetid.» |
| `ikke_vurdert` | Utvalget sier uttrykkelig at det ikke tar stilling til feilen, eller nevner den ikke og saken avgjøres på noe annet (se regelen under) | 16/1200: «Utvalget bemerker at de ikke finner det nødvendig å vurdere de øvrige feil klageren har påberopt, all den tid hevingskravet har ført frem.» |
| `samlet_vurdering` | Feilen ble bare vurdert sammen med andre feil | 16/1903: «Selv om flere av feilene er slike som må anses som normal slitasje, finner likevel utvalget at feilene samlet sett medfører at bilen ikke svarer til det klageren i denne saken hadde grunn til å forvente.» |

**Bruk `ikke_vurdert` sparsomt.** Det er den vanligste feilen i uttrekket: utvalget har avgjort feilen, men uten å nevne den for seg. Gå gjennom disse tilfellene før du velger `ikke_vurdert`:
- **Utvalget konkluderer om feilene samlet** («feilene», «omfanget av feil», «de påklagde forholdene», «manglene»): bruk `samlet_vurdering` med `samlet_utfall` for alle feil som inngår, også når utvalget bare nevner noen av dem ved navn. 22/880: «På grunn av omfanget av feil og manglenes betydning for bilen, herunder mangelfulle opplysninger om bilens tekniske stand og vedlikehold, finner utvalget at vilkåret for heving er oppfylt.»
- **Utvalget avgjør hele saken i én konklusjon** («det foreligger således ingen kjøpsrettslig mangel»): konklusjonen gjelder alle påberopte feil. Sett `ikke_mangel` med grunnen utvalget gir, for eksempel `ikke_dokumentert`. 21/3423: «Det er således ikke sannsynliggjort feil med bilen og det foreligger således ingen kjøpsrettslig mangel.»
- **Selger har ikke bestridt feilen, og utvalget tilkjenner noe for den:** `mangel` med `bevisgrunnlag: "uomtvistet"`.
- **Utvalget avgrenser hva klageren gjør gjeldende** (for eksempel til feilene i ett pristilbud): feil utenfor avgrensningen er ikke påberopt og skal ikke stå i `feil[]`.

Bruk `ikke_vurdert` bare når utvalget sier uttrykkelig at det ikke tar stilling, eller når saken avgjøres på noe annet, for eksempel heving på én feil, og feilen ikke inngår i noen samlet konklusjon.

**samlet_utfall** (bare ved `samlet_vurdering`, ellers `null`): utfallet av den samlede vurderingen, `mangel` eller `ikke_mangel`. I 16/1903 er det `mangel` for alle feilene som inngikk.

Ved `samlet_vurdering` fylles `grunn`, `grunnlag` og `bevisgrunnlag` ut fra det samlede utfallet, akkurat som om feilen hadde fått `mangel` eller `ikke_mangel` alene.

**grunn** (ved `ikke_mangel`, eller ved `samlet_vurdering` med `samlet_utfall: "ikke_mangel"`; ellers `null`):
- `paregnelig_slitasje`: normal slitasje for alder, kjørelengde og pris.
- `ikke_sannsynliggjort_ved_levering`: ikke vist at feilen fantes ved levering.
- `ikke_dokumentert`: ingen bevis for at feilen finnes i det hele tatt.
- `kjent_eller_opplyst`: kjøper visste om feilen eller ble opplyst om den.
- `synlig_ved_besiktigelse`: kjøper burde ha sett feilen (fkjl § 16 tredje ledd).
- `forbehold`: dekket av «som den er» eller et annet forbehold.
- `reklamert_for_sent`.
- `oppstatt_etter_levering`.
- `utbedret_av_selger`.
- `annet`.

### grunnlag og bevisgrunnlag er to forskjellige spørsmål
Begge settes ved `vurdering: "mangel"` og ved `samlet_vurdering` med `samlet_utfall: "mangel"`. Ellers er de `null`.

- **`grunnlag`** = *hvorfor er dette en mangel?*
  - `avvik_fra_avtale`: ikke som avtalt, eller ikke i den stand kjøperen kunne forvente (fkjl § 15, § 16 første ledd a).
  - `feil_opplysning`: bilen svarer ikke til selgers opplysninger (§ 16 første ledd c).
  - `tilbakeholdt_opplysning`: selger unnlot å opplyse om noe selger kjente eller burde kjenne til (§ 16 første ledd b).
  - `darligere_stand_som_den_er`: solgt «som den er», men i dårligere stand enn kjøperen hadde grunn til å regne med (§ 17 i loven før 2024).
  - `offentligrettslig`: EU-kontroll, registrering o.l.

  Velg etter innholdet, ikke bare etter paragrafbokstaven. Utvalget bruker bokstavene i § 17 ulikt fra sak til sak.

- **`bevisgrunnlag`** = *hvorfor fant utvalget det bevist?*
  - `formodning_ikke_motbevist`: feilen viste seg innen fristen, og selger beviste ikke noe annet (§ 18 annet ledd).
  - `dokumentert_utover_paregnelig`: sakkyndig dokumentasjon viste at feilen går utover det påregnelige.
  - `erkjent_av_selger`.
  - `uomtvistet`.
  - `utvalgets_skjonn`: utvalget vurderte bevisene fritt uten noen av grunnene over.

**Eksempel med begge satt, 22/6563 (klimaanlegget):** Utvalget skrev: «Utvalget bemerker at det fire måneder etter kjøpet ble avdekket at AC-rør og radiator måtte byttes som følge av lekkasje på klimaanlegget. Det antas følgelig at feilen forelå ved leveringstidspunktet, jf. fkjl. § 18 annet ledd, og at anlegget således ikke var i den stand klageren kunne forvente.» Det gir disse verdiene:
- `bevisgrunnlag: "formodning_ikke_motbevist"`, fordi feilen ble ansett bevist via § 18 annet ledd;
- `grunnlag: "avvik_fra_avtale"`, fordi anlegget ikke var «i den stand klageren kunne forvente»;
- `viste_seg.presisjon: "maaned"`, og `formodning: "anvendt_for_klager"`;
- i tillegg er annonsens «Kaldt klima» en opplysning som knyttes til feilen (se `opplysninger[]`).

### viste_seg
Når **denne** feilen viste seg.
- `dager_etter_levering` regnes fra overtakelse, eller fra kjøp når overtakelse ikke er oppgitt.
- `presisjon`:
  - `dag`: eksakt dato eller eksakt antall dager. «Samme dag», «på hjemveien», «ved henting» og «rett etter overtakelsen» betyr `dager_etter_levering: 0`, med datoen for overtakelsen hvis den står;
  - `maaned`: måneden er kjent, eller tiden er oppgitt i hele måneder («fire måneder etter kjøpet»). Sett da `dager_etter_levering` til omtrent 30 per måned;
  - `omtrentlig`: «få dager etter», «noen uker», «vinteren 2016». Er tiden ikke tallfestet, er `dager_etter_levering` `null`;
  - `ukjent`.
- Vanlige tidsuttrykk:

  | Uttrykk i vedtaket | `presisjon` | `dager_etter_levering` |
  |---|---|---|
  | «umiddelbart», «samme dag», «på vei hjem», «på hjemveien», «ved henting» | `dag` | 0–2 (0 hvis ikke annet står) |
  | «dagen etter», «tre dager etter» | `dag` | antall dager |
  | «kort tid etter», «like etter», «få dager etter» | `omtrentlig` | `null` |
  | «innen en måned», «fire måneder etter», «i mars» | `maaned` | omtrent 30 per måned |
  | «vinteren 2016», «noen uker etter» | `omtrentlig` | `null` |

- Sett **ikke** `dager_etter_levering` ut fra datoen på en test eller rapport. Importen bruker datoene i `bevis[]` som øvre grense selv.
- Bruk **ikke** reklamasjonsdatoen som tidspunktet feilen viste seg. 16/1921: «Klageren forklarer at bilen stanset etter å ha kjørt 6 mil fra innklagdes forretning etter kjøpet.» gir dag 0, selv om det skriftlige kravet kom mye senere.

### formodning (for denne feilen)
- `anvendt_for_klager`: utvalget brukte § 18 annet ledd, så feilen antas å ha vært der ved levering (som 22/6563 over).
- `avkreftet`: utvalget fant formodningen motbevist eller uforenlig med feilens art. 23/4133: «Etter utvalgets syn er formodningen om at frontruten hadde de påberopte steinsprutskadene ved risikoens overgang uforenelig med mangelens art.»
- `nevnt`: står bare i partenes anførsler eller i et fast avsnitt om rettsreglene, uten å bli brukt. 22/1220: «Ifølge fkjl. § 18 andre ledd skal funksjonssvikt og andre feil som viser seg innen seks måneder etter risikoens overgang, formodes å være til stede på kjøpstidspunktet.» Her blir regelen bare gjengitt, og utvalget går over til klagerens bevisbyrde.
- `ikke_aktuell`: utvalget sier at feilen viste seg etter fristen.
- `ikke_nevnt`.

### Øvrige felt per feil
- **`belop_tilkjent_nok`:** bare når vedtaket selv knytter et beløp til **denne** feilen. Fordel aldri et samlet beløp.
- **`alvor`:** `trafikkfarlig` og/eller `ikke_kjorbar`, bare når utvalget eller et bevis sier det, med `alvor_sitat`. Ellers `[]`.
- **`sitat`:** utvalgets konklusjon om denne feilen.

## opplysninger[]
Én post per opplysning fra selger som gjelder bilens stand, utstyr eller historikk og som er gjengitt i vedtaket. Det gjelder også når utvalget ikke bygde på opplysningen. Da er `status: "omtvistet"` og `vekt: "ingen"`. Annonsetekst som vedtaket siterer, skal alltid med.

| Felt | Verdier |
|---|---|
| `type` | `uttalelse` (selger sa eller skrev noe) eller `taushet` (selger unnlot å opplyse) |
| `form` | `annonse`, `kontrakt`, `melding` (sms, e-post), `salgsoppgave`, `tilstandsrapport_fra_selger`, `muntlig`, `annet`. `null` ved `taushet` |
| `ordlyd` | Selgers ord, ordrett slik vedtaket gjengir dem. `null` ved `muntlig`, ved `taushet`, og når vedtaket bare refererer innholdet |
| `rekkevidde` | `spesifikk` eller `generell` (se under). `null` ved `taushet` |
| `gjelder` | Kort fritekst |
| `svar_pa_direkte_sporsmal` | `true` hvis opplysningen var svar på et direkte spørsmål fra kjøper |
| `status` | Utvalgets syn: `lagt_til_grunn`, `omtvistet` (ikke avgjort) eller `avvist` |
| `vekt` | `for_klager`, `mot_klager` eller `ingen` |
| `gjelder_feil` | Feil-id-er. `[]` betyr at opplysningen gjelder hele saken |
| `sitat` | Utvalgets omtale av opplysningen, ordrett |

**rekkevidde** (for hver `uttalelse`):
- `spesifikk`: opplysningen nevner en komponent, et utstyr, en egenskap eller en konkret tilstand. Eksempler: «servicer er fulgt», «leveres eu godkjent», km-stand, «ingen skader», «ingen rust», «Motor og drivverk i topp stand», «Radio DAB+».
- `generell`: bare helhetsord om bilen, som «god stand», «velholdt», «pen bil», «strøken», «meget hel og pen».
- Inneholder en annonse begge deler, skal den spesifikke og den generelle delen være to poster.

**status og vekt ved `type: "taushet"`:**
- `lagt_til_grunn`: utvalget fant at selger skulle ha opplyst om forholdet. 24/1223: «Utvalget finner at innklagdes manglende opplysning om dette utgjør en mangel etter fkjl. § 16 første ledd bokstav b.» Det gir `vekt: "for_klager"`.
- `avvist`: utvalget fant ikke brudd på opplysningsplikten. 19/236: «Utvalget anser det således verken godtgjort at karosseriskadene var av en slik art eller slikt omfang at innklagde burde ha kjent til, og/eller opplyst klageren om, dem». Det gir `vekt: "ingen"`.
- `omtvistet`: utvalget tok ikke stilling.

**Eksempler:**
- **Opplysning i klagers favør, 21/15811.** Kjøpekontrakten sa: «leveres eu godkjent for to nye år! s-v-dekk. ny i norge. servicer er fulgt.» Utvalget skrev: «Utvalget legger det til grunn som uomtvistet at bilen skulle leveres godkjent i periodisk kjøretøykontroll, men at den ikke var det. Dette er en feil opplysning.» Det gir `form: "kontrakt"`, `status: "lagt_til_grunn"` og `vekt: "for_klager"`.
- **Opplysning mot klager, 21/3689.** Kontrakten sa: «Bilen måtte bytte stabilisator stag og støtdempere etter påkjørsel i grøft.» Utvalget skrev: «Utvalget legger avgjørende vekt på at klageren er opplyst om at bilen har vært utsatt for en utforkjøring.» Det gir `form: "kontrakt"`, `status: "lagt_til_grunn"` og `vekt: "mot_klager"`.
- **Annonse, 21/12163.** «Fra salgsannonsen hitsettes» etterfølges av annonseteksten, for eksempel «Motor og drivverk i topp stand». Det gir `form: "annonse"`, og `ordlyd` er annonseteksten.
- **Svar på direkte spørsmål, 21/3566.** Kjøperne spurte om bildene viste bulker på kanalene, og selger svarte skriftlig at det var «ingen bulker eller skader på kanal, det er i tilfelle refleksjoner av lys». Det gir `svar_pa_direkte_sporsmal: true`.
- **Muntlige opplysninger:** `form: "muntlig"` og `ordlyd: null`. `status` er nesten alltid `omtvistet` eller `avvist`.

**Dokumenter selger la ved salget** (tilstandsrapport, NAF-test eller servicehistorikk vedlagt annonsen eller kontrakten):
- Registrer dem **alltid** som `opplysninger[]` med `form: "tilstandsrapport_fra_selger"`. Det de sier eller unnlater å si, er en opplysning fra selger.
- Påberoper selger dokumentet som bevis i saken, skal det **i tillegg** stå i `bevis[]` med `fremlagt_av: "selger"`.
- **Eksempel, 24/1223.** Selger utførte en tilstandsrapport før salget («Innklagde viser til at de utførte en full tilstandsrapport av bilen … i forkant av salget»), og vedtaket gjengir anmerkningene. Det gir to opplysninger:
  - **En `uttalelse`** med `form: "tilstandsrapport_fra_selger"`, der `ordlyd` er de gjengitte anmerkningene. Utvalget brukte rapporten **mot** klagerens fuktkrav («Utvalget viser også til at det ikke er opplysninger om fukt i tilstandsrapporten»), så `vekt: "mot_klager"`, knyttet til fuktfeilen.
  - **En `taushet`** om den tidligere kollisjonsskaden, med `status: "lagt_til_grunn"` og `vekt: "for_klager"`, knyttet til kollisjonsfeilen (sitatet står over under status ved taushet).

  Påberoper selger rapporten i saken, får den også en post i `bevis[]` med `fremlagt_av: "selger"`.

## bevis[]
**Registrer alle dokumenter vedtaket nevner.** Gå gjennom saksfremstillingen etter «Klageren har fremlagt …», «Innklagde har fremlagt …», «det fremgår av …» og lignende, og lag én post for hvert dokument. Disse blir oftest glemt:
- korrespondanse (sms, e-post, brev) som utvalget eller partene viser til, særlig der selger erkjenner, lover eller avviser noe (`type: "korrespondanse"`);
- selgers egne rapporter og motbevis (`fremlagt_av: "selger"`);
- fakturaer og pristilbud, også for selve undersøkelsen (for eksempel faktura for NAF-testen);
- EU-kontrollsedler, servicehefter og tilstandsrapporter.

Knytt hvert dokument til alle feilene det omtaler (`gjelder_feil`). Én post per dokument eller kilde. **Et dokument som bare oppgir en kostnad, er et bevis.** Registrer det med `type: "faktura"` (eller `takst` for et pristilbud), `arsak: "ingen"` og kostnaden i `kostnad_nok`. Selgers motbevis får egne poster. Står det i et dokument noe som tilsier at feilen ikke skyldes normal slitasje (for eksempel at en del «ikke vil løsne av seg selv»), er det `paregnelig: "utover"`, også om ordet «påregnelig» ikke brukes.

| Felt | Verdier |
|---|---|
| `type` | `verkstedrapport`, `NAF_test`, `takst`, `EU_kontroll`, `tilstandsrapport`, `faktura`, `servicehistorikk`, `sakkyndig_uttalelse`, `bilder`, `korrespondanse`, `annet` |
| `avsender` | Firma eller rolle («merkeverksted», «NAF»), aldri personnavn |
| `fremlagt_av` | `klager`, `selger` eller `ukjent` |
| `dato`, `km_ved_undersokelse` | Når undersøkelsen ble gjort, og kilometerstand da |
| `arsak` | Hva **dokumentet** sier: `rotarsak` (hvorfor feilen oppstod), `komponent` (bare komponenten er navngitt) eller `ingen` |
| `ved_levering` | Hva **dokumentet selv** sier om feilen fantes ved levering: `ja`, `nei` eller `uttaler_seg_ikke` |
| `paregnelig` | Hva **dokumentet selv** sier om alder, kjørelengde og slitasje: `utover`, `innenfor` eller `uttaler_seg_ikke` |
| `kostnad_nok` | Utbedringskostnad i dokumentet, ikke kostnaden for selve undersøkelsen |
| `utvalgets_vurdering` | `vektlagt`, `ikke_vektlagt` eller `ikke_nevnt` |
| `avslagsgrunn` | Ved `ikke_vektlagt`: `for_generell`, `sier_ikke_naar`, `sier_ikke_paregnelig`, `motbevist`, `for_sent_utfort` eller `annet`. Ellers `null` |
| `gjelder_feil` | Feil-id-er beviset gjelder. `[]` betyr at det gjelder hele saken |
| `sitat` | Utvalgets omtale av beviset, ordrett |

### ved_levering og paregnelig gjelder dokumentet, ikke utvalgets konklusjon
**Kontrasteksempel 1: rapporten sier det, men utvalget godtar den ikke (15/1940).**
- Verkstedets e-post sa: «Det er ikke normalt at gearkasse ryker på 245 000 km.» Det gir `paregnelig: "utover"` for den e-posten.
- Utvalget skrev likevel: «Selv om det ikke er normalt at girkassen på den aktuelle bilmodellen ryker på 245 000 kilometer, jf. uttalelsen fra Oddemarka Auto AS, finner utvalget det ikke tilstrekkelig dokumentert at det foreligger en kjøpsrettslig mangel ved bilen.»
- Om NAF-testen i samme sak skrev utvalget: «De sier ikke noe om hvorvidt girkassen er defekt og eventuelt årsaken til dette». Det gir `arsak: "komponent"`, `utvalgets_vurdering: "ikke_vektlagt"` og `avslagsgrunn: "for_generell"`.

**Kontrasteksempel 2: utvalget konkluderer, men rapporten sa det ikke (22/6563).** Utvalget la til grunn at klimafeilen forelå ved levering på grunn av § 18 annet ledd («Det antas følgelig at feilen forelå ved leveringstidspunktet, jf. fkjl. § 18 annet ledd»). Ingen rapport uttalte seg om leveringstidspunktet, så for verkstedsdokumentasjonen gjelder `ved_levering: "uttaler_seg_ikke"`.

**Flere eksempler på avslagsgrunn:**
- 17/1554: «Utvalget vektlegger at uttalelsen til Toyota ikke sier noe om de avdekkende feilene er uvanlig sett hen til bilens alder og kjørte kilometer.» Det gir `avslagsgrunn: "sier_ikke_paregnelig"`.
- 21/5546: «Utvalget er av den oppfatning at uttalelsen fremstår som noe generell, at den er gitt uten gjennomført besiktigelse» Det gir `avslagsgrunn: "for_generell"`.

## forste_henvendelse
Første gang kjøper tok kontakt med selger om feilen, **også muntlig**, for eksempel ved å levere bilen tilbake til selgers verksted.
- `form` er `muntlig`, `skriftlig` eller `ukjent`.
- Kom det første skriftlige kravet senere enn en tidligere muntlig kontakt, er det den muntlige kontakten som gjelder. I 16/1921 ble bilen «fraktet tilbake til innklagdes verksted» samme dag.

## paragrafer_med_ledd
Paragrafer **utvalget** anvender, med ledd og bokstav slik de står i vedtaket, for eksempel `"fkjl. § 17 første ledd b)"`. Ikke ta med paragrafer som bare står i partenes anførsler. Ikke skriv dem om til et felles format; det gjør importen.

## begrunnelse_sitater
Opptil 8 ordrette utdrag fra **utvalgets vurdering**, 1–3 setninger hver, som forklarer utfallet.
- `tema` er `mangel`, `bevis`, `opplysning`, `formodning`, `reklamasjon`, `sanksjon` eller `belop`.
- `gjelder_feil` knytter sitatet til feilene.

## usikkerhet
Kort fritekst om hva du var usikker på, ellers `null`.
