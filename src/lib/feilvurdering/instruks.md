# Instruks: feilvurdering (feilvurdering-v6)

Du leser ett vedtak fra Forbrukerklageutvalget (FKU) eller Forbrukertvistutvalget om kjøp av et brukt kjøretøy. Du skriver ett JSON-svar med **fakta fra vedtaket**: hvilke feil kjøperen klaget på, hvordan utvalget vurderte hver av dem, og hva kjøperen fikk. Svarene brukes til å finne lignende saker for nye klager, og sitatene kan bli vist til forbrukere og selgere. Et feil svar kan gi en forbruker feil råd.

## Grunnregler
1. **Bare det som står i vedtaket.** Står det ikke der: `null` eller tom liste. Aldri gjett, regn ut eller fordel.
2. **Skill partene fra utvalget.** Del I–II gjengir hva partene *anførte*. Del III («Utvalget ser slik på saken») og vedtaket til slutt er hva utvalget *kom til*. `utfall`, `avslagsgrunn`, `bevisgrunnlag` og `sanksjoner` er alltid **utvalgets** syn.
3. **Alle nøkler skal være med**, også når verdien er `null`. Ingen ekstra nøkler.
4. **Bare verdiene i listene nedenfor**, stavet nøyaktig likt.
5. **Ingen personnavn.** Teksten er renset. Plassholdere som `[KLAGER]`, `[PERSON]` og `[REGNR]` skal stå slik de er.

## Svarformat
```json
{
  "vedtak_id": 0,
  "feil": [
    {
      "id": "f1",
      "hovedkategori": "",
      "underkategori": null,
      "komponent": null,
      "utfall": "",
      "samlet": false,
      "avslagsgrunn": null,
      "bevisgrunnlag": null,
      "dager_etter_levering": null,
      "viste_seg": "ukjent",
      "formodning": "ikke_nevnt",
      "sitat": null
    }
  ],
  "sanksjoner": [],
  "rettingsforsok": null,
  "som_den_er": false,
  "usikkerhet": null
}
```
`vedtak_id` hentes fra `VEDTAK_ID` i inn-fila. `feil` kan være tom når saken ikke gjelder feil ved kjøretøyet (for eksempel bare avbestilling eller partsforhold). `usikkerhet` er en kort setning om hva du var i tvil om, ellers `null`.

## Arbeidsrekkefølge for hvert vedtak
1. Les hele vedtaket.
2. Lag `feil[]` fra det **klageren gjør gjeldende**, delt opp slik utvalget tar stilling til dem. Gi feilene id `f1`, `f2` … i den rekkefølgen de nevnes.
3. Les utvalgets vurdering, og fyll inn utfallet for hver feil.
4. Fyll inn `sanksjoner` fra vedtakets slutning, og `rettingsforsok`.
5. Kontroller at alle nøkler er med, og skriv fila før du leser neste vedtak.

## feil[]
**Én post per enhet utvalget tar stilling til.** Behandler utvalget «rust på kanal og dør» i én setning med ett utfall, er det **én** feil. Del bare opp når utvalget gir ulikt utfall eller ulik begrunnelse for delene, for eksempel rust på to steder der bare det ene er mangel.

- **Feil utvalget ikke tar stilling til:** følg klagerens egen punktliste, én post per punkt.
- **NAF-punkter og verkstedanmerkninger er ikke feil før klageren påberoper dem.** En NAF-test med 15 anmerkninger gir ikke 15 feil. En feilkode eller anmerkning i en faktura eller rapport blir ikke en feil i `feil[]` bare fordi den står der. Den må være noe klageren selv klager på i del I–II.
- **Vurderer utvalget feilene samlet** («feilene samlet sett», «omfanget av feil»), får hver feil som inngår `samlet: true` og det samlede utfallet.
- **Én post per hovedkategori.** Inneholder en påberopt feil deler fra ulike hovedkategorier (for eksempel én reparasjon med haldexpumpe, multireim og fjærbein), lag én post per hovedkategori. Slå aldri sammen feil fra ulike hovedkategorier i én post. FKU-2025-61654: utvalget tilkjente «kostnader til reparasjon av scv ventil … og kjøp av ny starter» for samme startproblem. Det gir to poster med medhold: SCV-ventilen (`motor`/`drivstoff`) og starteren (`elektrisk`/`startbatteri`).

### hovedkategori og underkategori
Velg den mest konkrete. `underkategori` er en id fra samme hovedkategori, eller `null` når ingen passer. Dekker feilen flere underkategorier, velg den som veier tyngst.

| hovedkategori | underkategori |
|---|---|
| `motor` (Motor og eksos) | `turbo`, `registerreim` (registerreim eller kjede), `olje` (oljeforbruk og oljelekkasje), `kjoling` (kjøling, vannpumpe, topplokk), `drivstoff` (drivstoff og injektorer), `eksos` (eksosanlegg og katalysator), `utslipp` (EGR, partikkelfilter, AdBlue), `annet_motor` |
| `drivlinje` (Girkasse, clutch og drivlinje) | `girkasse`, `clutch`, `firehjul` (firehjulstrekk, drivaksler, differensial, kardang, fordelerkasse) |
| `understell` (Bremser, understell og styring) | `bremser`, `demping` (støtdempere og hjuloppheng), `styring` (også servo), `hjullager` |
| `karosseri` (Rust, lakk og karosseri) | `rust` (også ramme og chassis), `lakk` (lakk og bulker), `ruter` (ruter og speil) |
| `fukt` (Fukt og interiør) | `fukt` (fukt og vannlekkasje), `lukt`, `interior` (seter og interiør) |
| `elektrisk` (Elektrisk og elektronikk) | `infotainment` (infotainment, navigasjon, kamera), `sikkerhet` (airbag, setebelter, ABS, sensorer, førerassistent), `lys`, `startbatteri` (startbatteri, dynamo, startmotor), `annet_el` (også låser) |
| `klima` (Klimaanlegg og varme) | `ac`, `varme` (varmepumpe og varmeapparat), `parkeringsvarmer` (også Webasto) |
| `hoyvolt` (Høyvoltbatteri og lading, elbil og hybrid) | `kapasitet` (kapasitet og rekkevidde), `lading` (lading og ladeutstyr), `hybrid` (hybridsystem) |
| `utstyr` (Utstyr ikke som lovet) | `utstyr` (utstyr mangler eller virker ikke), `dekk` (dekk og felger), `nokler` (nøkler og tilbehør, også reservehjul), `utstyrsniva` (feil utstyrsnivå eller programvarepakke) |
| `service` (Service ikke utført som opplyst) | `service` (service ikke utført), `servicehefte` (servicehefte mangler) |
| `historikk` (Bilens historikk) | `skade` (tidligere skade og kollisjon), `km` (kilometerstand), `bruk` (tidligere bruk som taxi, leiebil, kjøreskole, og antall eiere), `import` (import, årsmodell, identitet), `ombygging` (ombygging og tuning), `eu` (EU-kontroll, registrering, vognkort, avgift), `pant` (pant og heftelse) |
| `garanti` (Garanti ikke som lovet) | ingen; `underkategori` er alltid `null` |
| `vet_ikke` (årsaken ble aldri klarlagt) | `varsellampe`, `nodmodus`, `lyd`, `vibrasjon` |
| `utenfor` | ingen; kravet gjelder ikke en feil ved kjøretøyet (skitten bil, verdifall, forsinket levering, innbytte, restgjeld) |

Plasseringsregler:
- En **tidligere kollisjonsskade** er `historikk`/`skade`, også når den viser seg som lakk- eller karosseriskader. Finner utvalget ikke kollisjon dokumentert, plasseres hver skade etter delen (radiator → `motor`/`kjoling`, AC-radiator → `klima`/`ac`).
- **Noe som mangler på bilen** (deksel, beskyttelsesplate, motorplate, reservehjul, nøkkel) er `utstyr`. Noe som er defekt, plasseres etter delen. Det gjelder også deler som har egen underkategori et annet sted: en Webasto som ikke er montert, er `utstyr`/`utstyr`. En Webasto som er montert, men ikke virker, er `klima`/`parkeringsvarmer`.
- **Utstyr som er reklamert fordi det ikke virker**, men som var nevnt i annonsen (for eksempel ryggekamera), plasseres etter hva feilen er: virker ikke → `elektrisk`/`infotainment`; finnes ikke på bilen → `utstyr`/`utstyr`.
- **`garanti`** brukes når kjøperen ikke fikk garantien som var lovet (nybilgaranti, bruktbilgaranti, garanti ikke registrert). Et krav om at garantien skal dekke en reparasjon plasseres etter feilen som skal repareres.
- **`vet_ikke`** bare når utvalget sier at årsaken ikke er klarlagt.

**komponent:** kort fritekst for delen klageren nevner, høyst noen få ord, for eksempel `"turbo"` eller `"venstre bakskjerm"`. `null` når ingen del er nevnt.

### utfall
| Verdi | Når | Eksempel (ordrett) |
|---|---|---|
| `medhold` | Utvalget fant at **denne** feilen er en mangel, også om kravet ble redusert, og også når kjøperen ikke får penger fordi selger har tilbudt å rette den | 23/9931: «Etter dette utgjør bruksmerkene/småskadene og den knekte antennen kjøpsrettslige mangler ved bilen.» |
| `avvist` | Utvalget fant at denne feilen ikke gir kjøperen noe, enten fordi den ikke er en mangel eller fordi kravet falt av andre grunner (for eksempel for sen reklamasjon) | 23/9931: «Bremser er å betegne som slitedeler som vanligvis vil kreve flere utskiftinger i løpet av bilens levetid.» |
| `ikke_vurdert` | Utvalget sier uttrykkelig at det ikke tar stilling til feilen, eller saken avgjøres på noe annet uten at feilen inngår i noen konklusjon | 16/1200: «Utvalget bemerker at de ikke finner det nødvendig å vurdere de øvrige feil klageren har påberopt, all den tid hevingskravet har ført frem.» |

**Bruk `ikke_vurdert` sparsomt.** Det er den vanligste feilen. Gå gjennom disse før du velger det:
- **Utvalget konkluderer om feilene samlet:** `samlet: true` og det samlede utfallet for alle feil som inngår, også når utvalget bare nevner noen av dem ved navn. **Ta med alle feil som inngår i grunnlaget for konklusjonen:** feil utvalget lister som sannsynliggjort, og feil i en faktura, et pristilbud eller en rapport som utvalget legger til grunn eller tilkjenner erstatning for. Gå gjennom listen og fakturaene én gang til før du skriver svaret, og sjekk at hver påberopt feil der har en post. 21/5117: «finner utvalget det sannsynliggjort at det er brudd på begge bak fjær, defekter på reflekterer på høyre og venstre hovedlykter, en defekt bærekule …» gir medhold for både fjærene (`understell`), reflektorene (`elektrisk`/`lys`) og bærekulen. 16/1903: «Selv om flere av feilene er slike som må anses som normal slitasje, finner likevel utvalget at feilene samlet sett medfører at bilen ikke svarer til det klageren i denne saken hadde grunn til å forvente.»
- **Utvalget avgjør hele saken i én konklusjon** («det foreligger således ingen kjøpsrettslig mangel»): konklusjonen gjelder alle påberopte feil.
- **Selger har ikke bestridt feilen, og utvalget tilkjenner noe for den:** `medhold` med `bevisgrunnlag: "uomtvistet"`.

### avslagsgrunn (bare ved `avvist`, ellers `null`)
- `paregnelig_slitasje`: normal slitasje for alder, kjørelengde og pris.
- `ikke_sannsynliggjort_ved_levering`: ikke vist at feilen fantes ved levering.
- `ikke_dokumentert`: ingen bevis for at feilen finnes i det hele tatt.
- `kjent_eller_opplyst`: kjøper visste om feilen eller ble opplyst om den.
- `synlig_ved_besiktigelse`: kjøper burde ha sett feilen ved visning eller prøvekjøring.
- `forbehold`: dekket av «som den er» eller et annet forbehold.
- `reklamert_for_sent`: feilen kan ha vært en mangel, men kravet falt fordi det ble reklamert for sent.
- `oppstatt_etter_levering`: feilen oppsto etter at kjøperen overtok.
- `utbedret_av_selger`: selger har rettet feilen, så det er ingenting igjen å kreve.
- `avgjort_etter_avtale`: kjøperen fikk dekning fordi selger hadde avtalt eller lovet å betale eller reparere, og utvalget avgjør kravet etter avtalen uten å finne at feilen er en mangel. Dette er ikke `medhold`. 21/14214: «Utvalget legger imidlertid til grunn som sannsynliggjort at det etter kjøpet ble avtalt at innklagde skulle betale for bytte av bremsecalipere.»
- `dekket_av_garanti`: utvalget fant at feilen **ikke** er en mangel, men kjøperen fikk dekning etter selgers garanti (fkjl. § 18 a eller en garantiavtale). Dette er ikke `medhold`. 22/54: «Utvalget finner ikke at klager har dokumentert at motorhavariet skyldes en mangel etter fkjl. §§ 15-16. … Spørsmålet er derfor om skaden omfattes av selgers garanti, jf. fkjl. § 18.»
- `annet`.

### bevisgrunnlag (bare ved `medhold`, ellers `null`)
*Hvorfor fant utvalget at kjøperen hadde rett?* Velg det utvalget legger mest vekt på.
- `formodning_ikke_motbevist`: feilen viste seg innen fristen i fkjl. § 18 annet ledd, og selger beviste ikke noe annet.
- `sakkyndig_dokumentasjon`: verkstedrapport, NAF-test, takst eller annen sakkyndig uttalelse viste feilen og at den går utover det påregnelige eller fantes ved levering.
- `selgers_opplysning`: feilen er et avvik fra noe selger skrev eller sa (annonse, kontrakt, melding), eller noe selger holdt tilbake, og det var avgjørende.
- `erkjent_av_selger`: selger har erkjent feilen.
- `uomtvistet`: selger bestred ikke feilen, eller svarte ikke i saken.
- `utvalgets_skjonn`: utvalget vurderte bevisene fritt uten noen av grunnene over.

Eksempel, 22/6563 (klimaanlegget): «Utvalget bemerker at det fire måneder etter kjøpet ble avdekket at AC-rør og radiator måtte byttes som følge av lekkasje på klimaanlegget. Det antas følgelig at feilen forelå ved leveringstidspunktet, jf. fkjl. § 18 annet ledd …» gir `utfall: "medhold"`, `bevisgrunnlag: "formodning_ikke_motbevist"` og `dager_etter_levering: 120`.

### dager_etter_levering
Når **denne** feilen viste seg, regnet fra overtakelse, eller fra kjøp når overtakelse ikke er oppgitt. Bare når vedtaket tallfester tiden eller oppgir en dato.

| Uttrykk i vedtaket | `dager_etter_levering` |
|---|---|
| «umiddelbart», «samme dag», «på hjemveien», «ved henting», «rett etter overtakelsen» | 0 |
| «dagen etter», «tre dager etter» | antall dager |
| «fire måneder etter», «innen en måned» | omtrent 30 per måned (120, 30) |
| «kort tid etter», «få dager etter», «noen uker», «vinteren 2016» | `null` |

Står det en dato for når feilen viste seg, regn ut dagene fra overtakelse (eller kjøp) i inn-fila.

Bruk **ikke** reklamasjonsdatoen eller datoen på en test eller rapport som tidspunktet feilen viste seg. 16/1921: «Klageren forklarer at bilen stanset etter å ha kjørt 6 mil fra innklagdes forretning etter kjøpet.» gir 0, selv om det skriftlige kravet kom mye senere.

### viste_seg (fylles alltid)
Omtrent når **denne** feilen viste seg etter levering. Velg perioden også når tiden ikke er tallfestet. Det er dette feltet som oftest mangler, så les etter tidsuttrykk i hele vedtaket, også i partenes forklaring.

| Verdi | Når | Eksempler på uttrykk |
|---|---|---|
| `innen_6_mnd` | Innen seks måneder | «samme dag», «ved henting», «på hjemveien», «dagen etter», «kort tid etter», «like etter», «få dager», «noen uker», «etter en måned», «etter 3 000 km» rett etter kjøpet |
| `6_til_22_mnd` | Fra seks måneder til 22 måneder | «etter ti måneder», «et år etter kjøpet», «høsten etter» (når kjøpet var på våren) |
| `22_til_24_mnd` | Fra 22 måneder til to år | «nesten to år etter», «23 måneder etter» |
| `over_24_mnd` | Mer enn to år | «tre år etter kjøpet» |
| `ukjent` | Vedtaket sier ingenting om når, eller det er helt uklart | |

Sier vedtaket bare når kjøperen **reklamerte** (ikke når feilen viste seg), og reklamasjonen kom innen seks måneder, er feilen vist innen seks måneder: `innen_6_mnd`. Ellers `ukjent`.

### formodning (for denne feilen)
Om utvalget brukte regelen i fkjl. § 18 annet ledd om at feil som viser seg innen fristen, antas å ha vært der ved levering.
- `anvendt`: utvalget brukte regelen for kjøperen. 22/6563: «Det antas følgelig at feilen forelå ved leveringstidspunktet, jf. fkjl. § 18 annet ledd …»
- `avkreftet`: utvalget fant at selger hadde motbevist formodningen, eller at den er uforenlig med feilens art. 23/4133: «Etter utvalgets syn er formodningen om at frontruten hadde de påberopte steinsprutskadene ved risikoens overgang uforenelig med mangelens art.»
- `etter_fristen`: utvalget sier at feilen viste seg etter fristen, så regelen gjelder ikke.
- `ikke_nevnt`: regelen nevnes ikke for denne feilen, eller bare i partenes anførsler eller et fast avsnitt om rettsreglene.

### sitat
Utvalgets konklusjon om **denne** feilen, fra utvalgets vurdering (del III). `null` når utvalget ikke sier noe om feilen for seg.

**Sitatregel:**
- Kopier **tegn for tegn** fra vedtaket. Ikke rett skrivefeil, ikke bytt ord, og ikke sett sammen setninger fra ulike steder.
- Utelater du ord, skriv `…`. Hver bit mellom `…` må være minst 20 tegn.
- Skriv sitatet på én linje uten linjeskift.
- 1–2 hele setninger er nok. Sitater som ikke finnes ordrett, slettes automatisk. Et kort, ordrett sitat er bedre enn et langt som ikke er det.

## sanksjoner
Hva utvalget ga kjøperen, fra vedtakets slutning (siste avsnitt, «Vedtak:»), som en liste av: `heving`, `prisavslag`, `erstatning`, `retting`, `omlevering`. Tom liste når kjøperen ikke fikk noe.
- Tilbakebetaling av kjøpesummen mot at bilen leveres tilbake er `heving`.
- Et beløp utvalget kaller prisavslag er `prisavslag`. Dekning av utgifter (verksted, tauing, leiebil) er `erstatning`. Begge kan stå.
- Selger pålegges å reparere: `retting`.

## rettingsforsok
Hvor mange ganger selger, eller et verksted på selgers vegne, forsøkte å reparere den samme feilen **uten å lykkes** før saken kom til utvalget. Bare når vedtaket sier det eller lister forsøkene. «Bilen var inne til reparasjon tre ganger uten at feilen ble rettet» gir `3`. Sier vedtaket at selger ikke fikk mulighet til å rette, er det `0`. Ellers `null`.

## som_den_er
`true` når vedtaket viser at kjøpekontrakten eller annonsen hadde forbeholdet «som den er» eller et lignende **alminnelig** forbehold. Det gjelder også når bare partene nevner det og utvalget ikke omtaler det. 21/15812: kontrakten sier at bilen «selges som besiktiget og prøvekjørt», og utvalget omtaler ikke forbeholdet, så svaret er `true`. Lignende forbehold er for eksempel «som forevist», «som besiktiget», «som vist og prøvekjørt», «selges som den står» og «reparasjonsobjekt» eller «delebil» når utvalget behandler det som et forbehold. Ellers `false`.
- `false` når utvalget sier at bilen **ikke** ble solgt «som den er». 21/3789: «Bilen ble ikke solgt med «som den er» forbehold …»
- `false` når utvalget finner at forbeholdet ikke ble avtalt eller ikke gjelder.
- Garantivilkår, «uten garanti» alene og opplysninger om bestemte, kjente feil er **ikke** et alminnelig forbehold.
- Ikke la deg lure av at utvalget gjengir regelen i fkjl. § 17 om ting som er solgt «som den er». Det sier ingenting om denne bilen.

