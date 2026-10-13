# Instruks: hva som avgjorde vedtaket (avgjorende-v5)

Du leser ett vedtak fra Forbrukerklageutvalget eller Forbrukertvistutvalget om kjøp av et brukt kjøretøy. Feilene utvalget godtok som mangel, er allerede funnet; de står øverst i inn-fila. For hver av dem skriver du **hva utvalget bygde konklusjonen på**.

Svarene brukes når et klagebrev viser til vedtaket. Den som skriver brevet, ser ikke vedtaket, bare svaret ditt. Brevet sendes til en forhandler, ofte med advokat. Det som står i svaret ditt, vil bli lagt utvalget i munnen. Utelater du noe utvalget la vekt på, eller tar du med noe utvalget ikke bygde på, kan brevet bli avvist som misvisende.

## Inn-fila
Vedtaket er delt i to:
- `<saksfremstilling>`: sakens bakgrunn og hva partene anførte. Dette er ikke utvalgets syn.
- `<utvalgets_vurdering>`: det utvalget selv mente og kom til.

**Alt du skriver om hva som avgjorde, skal bygge på `<utvalgets_vurdering>`.** Et faktum fra saksfremstillingen hører med bare når utvalget viser til det i vurderingen. Et dokument, en annonse eller en takst som bare står i saksfremstillingen, avgjorde ikke saken. En anførsel utvalget avviste, skal aldri stå som grunnlag.

## Grunnregler
1. **Bare det som står i vedtaket.** Står det ikke der: tom liste. Aldri gjett.
2. **Ingen utregning.** Regn ikke ut tidsrom, alder eller beløp selv. Skriv tidspunkter og beløp slik utvalget oppgir dem.
3. **Alle nøkler skal være med.** Ingen ekstra nøkler. Bare verdiene i listene nedenfor, stavet nøyaktig likt.
4. **Ingen personnavn.** Teksten er renset. Plassholdere som `[KLAGER]` og `[PERSON]` skal stå slik de er.
5. **Bare feilene i lista** øverst i inn-fila, med de samme id-ene. Ingen andre.

## Svarformat
```json
{
  "vedtak_id": 0,
  "selger_svarte": true,
  "bil": null,
  "forbehold": "ingen",
  "lovversjon_brukt": "ukjent",
  "rettslige_sitater": [],
  "feil": [
    {
      "id": "f1",
      "nevnt_i_vurderingen": true,
      "vurdert_for_seg": true,
      "sitater": [],
      "avgjorende": "",
      "hjemmel": [],
      "bevis": [],
      "samlet_med": [],
      "under_tvil": false,
      "sanksjoner": []
    }
  ]
}
```
`vedtak_id` hentes fra `VEDTAK_ID` i inn-fila. `selger_svarte` er `false` når innklagde ikke svarte på klagen til utvalget og saken ble avgjort på klagerens fremstilling, `true` når innklagde svarte, `null` når det ikke går fram.

## Feltene for hele vedtaket

### bil
Bilen slik vedtaket selv skriver den, med merke, modell og årsmodell når de står der, kopiert ordrett fra ett sted i teksten, for eksempel `"Range Rover Sport 2014-modell"`. `null` når vedtaket ikke nevner bilen.

### forbehold
Hva utvalgets vurdering sier om forbehold og garanti for bilen: `som_den_er` (solgt «som den er» eller med lignende generelt forbehold), `garanti` (solgt med en garanti som gjaldt; var garantien lovet, men ugyldig eller aldri tegnet, er det ikke garanti), `begge`, `ingen` (vurderingen sier at det ikke var noe forbehold), `ukjent` (vurderingen sier ikke noe om det).

### lovversjon_brukt
Hvilken forbrukerkjøpslov utvalget brukte: `for_2024` (loven slik den lød før 1.1.2024, for eksempel seks måneders formodningsregel), `etter_2024` (loven fra 1.1.2024, for eksempel to års formodningsregel), `ukjent` når vedtaket ikke sier det.

### rettslige_sitater
For hvert rettslig spørsmål under som utvalget avgjorde **i kjøperens favør**: én hel setning fra `<utvalgets_vurdering>` der utvalget sier det. Sitatregelen under gjelder. Ta bare med spørsmål utvalget faktisk tok stilling til; tom liste når det ikke tok stilling til noen av dem.
```json
[{ "poeng": "formodning", "sitat": "…" }]
```
- `formodning`: utvalget brukte formodningsregelen (fkjl. § 18 annet ledd): en feil som viser seg innen fristen, antas å ha vært der ved levering.
- `som_den_er`: «som den er» eller et lignende forbehold fritok ikke selgeren (fkjl. § 17).
- `sen_feil`: en feil som viste seg mer enn to år etter levering, var likevel en mangel (fkjl. § 27, fem års frist).
- `uriktig_opplysning`: selgerens uriktige opplysning gjorde at bilen hadde en mangel (fkjl. § 16 første ledd bokstav c).
- `tilbakeholdt_opplysning`: selgeren holdt tilbake opplysninger den kjente til (fkjl. § 16 første ledd bokstav b).
- `tapt_retting`: selgeren hadde mistet retten til å rette, for eksempel etter mislykkede forsøk (fkjl. § 30).
- `palagt_retting`: selgeren ble pålagt å rette mangelen (fkjl. § 29).
- `heving`: mangelen var ikke uvesentlig, så kjøperen fikk heve kjøpet (fkjl. § 32).
- `prisavslag`: utvalget fastsatte et prisavslag (fkjl. § 31). Velg setningen der beløpet eller utmålingen fastsettes.

Velg setningen der utvalget selv konkluderer om poenget, og som sier hva den gjelder når den står alene. Ikke en setning som bare gjengir faktum, som viser til annen praksis, eller som taler mot kjøperen.

## Feltene, for hver feil
Fyll ut feltene i denne rekkefølgen.

### nevnt_i_vurderingen
`true` når `<utvalgets_vurdering>` nevner denne feilen eller delen. `false` når den bare står i saksfremstillingen, også når utvalget godtok «en rekke mindre feil» uten å nevne denne.

### vurdert_for_seg
`true` når utvalget fant at denne feilen var en mangel i seg selv. `false` når utvalget bare fant at feilene samlet var en mangel, når feilen inngikk i en samlet vurdering uten at utvalget tok stilling til den alene, og når utvalget sier at forholdet faller utenfor klagen eller er gjort opp.

### sitater
1–3 hele setninger fra `<utvalgets_vurdering>` der utvalget sier hvorfor denne feilen er en mangel, eller hva det la vekt på. Ikke setninger som gjengir hva en part har forklart eller anført («Klageren har forklart at …»). Foretrekk setningen der utvalget konkluderer eller begrunner, ikke en som bare gjengir faktum. Tom liste når utvalget ikke begrunner feilen for seg.

**Sitatregel:**
- Kopier hele setninger **tegn for tegn**. Ikke rett skrivefeil, ikke bytt ord, ikke sett sammen setninger fra ulike steder.
- **Ingen utelatelser**: aldri `…` eller `...`. Er setningen for lang, velg en annen.
- Skriv hvert sitat på én linje uten linjeskift.
- Sitater som ikke står ordrett i utvalgets vurdering, slettes automatisk.

### avgjorende
1–2 setninger med dine egne ord: det utvalget bygde konklusjonen om **denne** feilen på, slik sitatene og resten av vurderingen sier det. Ta med alt utvalget selv la vekt på, også det som var særegent for saken: en annonse eller kontrakt som lovet noe, en garanti, en sakkyndig uttalelse, at feilen viste seg kort tid etter kjøpet, at utbedringen kostet mye, at selgeren ikke bestred mangelen, at selgeren ikke svarte. Viser utvalget til et forbehold («som den er»), skal det stå. Var feilen noe annet enn kategorien antyder (for eksempel et erstatningsbatteri, ikke det opprinnelige), skriv det. Skriv konkret, ikke «utvalget fant at bilen hadde en mangel».

Les `avgjorende` mot vurderingen før du går videre: står hver påstand der?

### hjemmel
Lovbestemmelsene utvalget konkluderte med for denne feilen, kopiert slik de står i vurderingen, for eksempel `"fkjl. § 17 første ledd bokstav a"`. Bare bestemmelser om at feilen er en mangel, ikke om reklamasjon eller sanksjoner. Tom liste når utvalget ikke nevner noen for feilen.

### bevis
Det utvalget i vurderingen viste til for å finne at feilen var en mangel og fantes ved levering. Liste av:
`sakkyndig` (uttalelse fra takstmann, NAF eller annen sakkyndig), `verksted` (verkstedrapport, faktura eller verkstedets vurdering), `eu_kontroll`, `annonse_kontrakt`, `forhistorie_for_salget` (dokumentasjon av denne feilen datert før salget, som et verkstedbesøk hos tidligere eier; ikke noe som skjedde etter kjøpet), `formodning` (fkjl. § 18 annet ledd), `selgers_erkjennelse` (selgeren erkjente eller bestred ikke akkurat denne feilen), `klagers_forklaring` (utvalget bygde på klagerens forklaring), `utvalgets_skjonn` (utvalgets egen vurdering uten særskilt bevis).

### samlet_med
Id-ene til andre feil i lista som utvalget vurderte sammen med denne («feilene samlet sett», «samlet utgjør»). Tom liste når feilene ble vurdert hver for seg, også når de står i samme avsnitt.

### under_tvil
`true` når utvalget skriver at det kom til konklusjonen om denne feilen «under tvil» eller «under noe tvil».

### sanksjoner
Det utvalget ga kjøperen for **denne feilen alene**, som en liste av `heving`, `prisavslag`, `erstatning`, `retting`, `omlevering`. Bygde hevingen på en annen feil, står den ikke her. Ga utvalget noe bare for feilene samlet (ett samlet prisavslag, én samlet erstatning), står det ikke her; da er lista tom.

## Arbeidsrekkefølge for hvert vedtak
1. Les hele vedtaket, særlig `<utvalgets_vurdering>`.
2. For hver feil i lista øverst: finn hvor utvalget tar stilling til den, velg sitatene, og fyll inn resten.
3. Fyll inn `selger_svarte`, `bil`, `forbehold`, `lovversjon_brukt` og `rettslige_sitater`.
4. Kontroller at alle nøkler er med, og skriv fila før du leser neste vedtak.
