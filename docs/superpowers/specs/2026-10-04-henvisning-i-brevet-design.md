# Henvisning til lignende vedtak i reklamasjonsbrevet – design

Status: godkjent 2026-10-04.

## Kontekst

Brevet skal være verdt å betale for, og det sterkeste beviset er et vedtak der en kjøper i samme situasjon vant mot en forhandler. I dag kommer en henvisning bare inn i brevet hvis kjøperen selv velger vedtak og nøkkelpunkt i saksmappen. Da står det «Sak X (år, utfall): {nøkkelpunkt}», uten dato og uten lenke. Nøkkelpunktet er modellens omskrivning: bare 0,7 % av nøkkelpunktene står ordrett i vedtaket. Salgskortet i vurderingen lover likevel «argumentasjon vi vet har vunnet lignende saker».

**Mål:**
- Alle brev har et vedtak innbakt fra første utkast. Unntaket er saker der loven stopper kravet (avsnitt 2).
- Det er samme vedtak som vurderingen viste før kjøpet.
- Henvisningen er aldri feil eller misvisende.
- Kjøperens valg i saksmappen fjernes.
- Motsvar er utenfor denne omgangen.

**Beslutninger (brainstorming 2026-10-04):**
- Vedtaket hentes fra et kuratert bibliotek, ikke fra en automatisk rangering i databasen.
- Biblioteket har to aldersgrupper: bilen var 0–7 år ved kjøpet, eller 8 år eller mer.
- Vurderingen sier at brevet viser til saken.
- Kontrollen gjøres av agenter og et skript, uten manuell godkjenning. Kontrollen må derfor være streng.
- **Det skal alltid finnes et vedtak som er godt nok.** Utredningens «ingen henvisning hvis ingen god match» erstattes med en stige. Vi viser til en lignende sak når biblioteket har en. Ellers viser vi til en sak der utvalget la samme regel til grunn som brevet bygger på. Det er slik utvalget selv viser til egen praksis: «Forbrukerklageutvalget har i flere avgjørelser lagt til grunn at …, se eksempelvis FKU-2019-759».

**Fra utredningen (beholdes):**
- Høyst én henvisning i det første brevet.
- Først loven, så vedtaket.
- Saksnummer, dato, én setning om likheten og én om konklusjonen, og lenke til vedtaket.
- Ingen lange sitater og ingen navn.
- Hver henvisning kontrolleres mot kilden.
- Nøktern tone.

## Funn som styrer designet

1. **Lovversjon.** Lovendringen (LOV-2023-06-16-60) «gjelder ikke avtaler som er inngått før lovens ikrafttredelse» (1.1.2024).
   - Bare 7 forhandlervedtak i basen gjelder kjøp etter den datoen. 4 av dem ble vunnet, men ingen er gode henvisninger for vanlige feil: ett ble avgjort uten tilsvar, og i de andre vant kjøperen på noe annet (radio, sommerdekk, kjøreskolebruk).
   - #3010 og #3023 siterer likevel den nye toårsregelen i § 18.
   - Krever vi «samme lovversjon», får nesten alle som har kjøpt bil siden 2024 ingen henvisning.
   - Alle endringene i 2024 styrket kjøperen: formodningsregelen gikk fra 6 måneder til 2 år, og «som den er» virker ikke lenger (§ 15 annet ledd). En sak vunnet etter gammel lov holder derfor også etter ny lov, med ett unntak: når kjøperen vant *fordi* formodningsregelen gjaldt, og brukeren ikke har den.
   - **Regel:** Vis aldri til en sak som ble vunnet på en fordel brukeren mangler.
2. **Påberopte feil.** `feiltyper` er feilene kjøperen påberopte. Revisjonen fant at 61 % er riktige.
   - Eksempel: #3005 står som motorfeil med delvis medhold. Utvalget avviste motorfeilen og ga medhold for en DAB-radio.
   - Derfor må en agent lese vedtaket før det kan brukes, ikke bare et filter.
3. **Henvisningsform.** Utvalget viser til egne vedtak som «FKU-2019-759» (= sak 19/759).
   - Vedtak fra før våren 2017 er truffet av Forbrukertvistutvalget. Brevet og vurderingen kaller i dag alle «Forbrukerklageutvalget».
   - Datoen står i vedtaket som «Porsgrunn, den 31.01.2024» og er lik `vedtaksdato`.
4. **Det finnes mange kandidater på regelnivå** (vunne forhandlersaker, personbil og varebil):
   - 139 der teksten drøfter formodningsregelen og feilen viste seg innen 180 dager, hvorav 41 med biler som var 12 år eller eldre.
   - 123 som ble vunnet uten formodningsregelen ved hjelp av verkstedrapport, takst eller NAF-test.
   - 468 som ble vunnet på uriktige opplysninger.
   - 295 med biler som var 12 år eller eldre, hvorav 115 drøfter slitasje.
5. **Eksempelvedtakene i vurderingen** (`src/lib/vurdering/eksempler.ts`, 29 vedtak) passer godt som utgangspunkt. Noen av dem holder likevel ikke mot en forhandler:
   - Forhandleren svarte aldri i #3154 (motor), #1598 (batteri) og #1936 (generell).
   - #1684 og #2454 ble avgjort «under noe tvil».
   - Utvalget av dem tar ikke hensyn til bilens alder.

## Design

### 1. Biblioteket

`src/lib/vurdering/eksempler.ts` erstattes av `src/lib/vurdering/henvisninger.ts`, en liste med kontrollerte vedtak av to slag.

**Felles felt:**

| Felt | Innhold |
|---|---|
| `vedtakId`, `kildeUrl` | som i dag |
| `ref` | «FKU-2023-13923», i samme form som utvalget selv bruker; «FTU-…» for Forbrukertvistutvalget |
| `organ` | «Forbrukerklageutvalget» eller «Forbrukertvistutvalget», lest fra vedtaket |
| `dato` | vedtaksdato (ISO) |
| `alder`, `km` | bilens alder ved kjøpet og km, fra vedtaket |
| `lov` | `før_2024` eller `etter_2024`, ut fra kjøpsdatoen i vedtaket |
| `presumsjon` | om kjøperen i saken hadde formodningsregelen, det vil si at feilen viste seg innen 6 måneder (gammel lov) eller 2 år (ny lov) |
| `setning` | til kjøperen i vurderingen; dagens mal beholdes |

**Postene:**
- **`lignende`**: `gruppe` (motor … batteri), `botte` (rask, middels eller sen, ut fra når feilen viste seg ifølge vedtaksteksten), `likhet` (én setning om fakta i saken) og `konklusjon` (én setning om hva utvalget kom til og hva kjøperen fikk, uten beløp). Én post per gruppe, tidsrom og aldersgruppe der dataene har en sak som holder.
- **`regel`**: `grunnlag` og `regel`, som er én setning om saken og hva utvalget la til grunn. Det er én post per grunnlag med `før_2024`, og hvert grunnlag hører til setningen i brevet som det støtter:
  - `formodning`: utvalget la formodningsregelen i § 18 til grunn. Gjelder når brevet påberoper seg formodningsregelen. Den siterte bilen er gammel. Holder #3010, kommer den i tillegg som post etter ny lov, og den foretrekkes for kjøp fra 2024.
  - `rapport`: en verkstedrapport viste at feilen var der ved overtakelsen, og kjøperen vant uten formodningsregelen. Gjelder når brevet viser til en rapport.
  - `opplysning`: bilen svarte ikke til opplysningene i annonsen eller fra forhandleren (§ 16). Gjelder når brevet påberoper seg uriktige opplysninger.
  - `forventning`: bilen var i dårligere stand enn kjøperen hadde grunn til å regne med ut fra alder, km og pris. Saken er vunnet uten formodningsregelen, og bilen er gammel. Gjelder ellers.

Sitatene som underbygger hver påstand (`belegg`) ligger i `scripts/henvisninger-belegg.json` (nøkkel `vedtakId`), slik at de ikke havner i nettleserkoden. De brukes bare av kontrollskriptet.

### 2. Valg av vedtak: én ren funksjon, stige som alltid gir svar

`velgHenvisning(input, f, bilAr)` gir `{ henvisning, treff }`, der treff er `lignende`, `tilnaermet` eller `regel`. Den gir `null` bare når loven stopper kravet (`fristUte`, eller kjøpt av privatperson eller firma). Da selges ikke brevet. Får en kjøper en slik sak etter en rettelse på brevsiden, viser brevet allerede et varsel, og en vunnet sak ville da villede.

`bilAr` er førstegangsregistreringen fra Vegvesen-oppslaget. Bilens alder er kjøpsåret (`kjopsdatoFor`) minus `bilAr`.

**Stigen. Den første posten som er forenlig med saken, brukes:**
1. **Lignende sak:** samme feilgruppe og samme tidsrom. Gruppene prøves i dagens rekkefølge (`GRUPPER`).
2. **Nærmeste lignende sak:** samme feilgruppe og nabotidsrom (rask↔middels, middels↔sen).
3. **Samme regel:** posten for brevets grunnlag. Det er formodning når `f.presumsjon`. Ellers er det rapport når `rapportSierForKjop`, deretter opplysning når `feilOpplysning !== "nei"`, og ellers forventning. Dette trinnet finnes alltid, også for «Annet» og når kjøperen visste om feilen.

**Forenlig betyr dette:**
- **Formodningsregelen (alle trinn):** Hadde kjøperen i saken formodningsregelen, må brukeren også ha den.
- **Lov (alle trinn):** En post med `etter_2024` brukes bare for kjøp fra 1.1.2024 (`PRESUMSJON_TO_AR_FRA`).
- **Alder (trinn 1–2):** Den siterte bilen er ikke mer enn 4 år nyere enn brukerens. Er alderen ukjent, foretrekkes den eldre aldersgruppen. Regel-postene velges med så gammel bil som mulig, men alder utelukker dem ikke, fordi det ville brutt garantien for svært gamle biler.

Innen samme trinn foretrekkes samme lovversjon som brukeren, deretter minst forskjell i alder (er det likt, vinner den eldste siterte bilen), og til slutt det nyeste vedtaket.

**Garanti:** Hvert grunnlag har en regel-post med `før_2024`. Bare `formodning` har `presumsjon: true`, og den brukes bare når brevet påberoper seg formodningsregelen. Da er regel-trinnet alltid forenlig. Derfor får alle saker som ikke er stoppet av loven, en henvisning. Dette sikres ved at den eksisterende testen «alle vurderte saker får et eksempel» blir en uttømmende sjekk av alle kombinasjoner av feil, tidsrom, kjøp før og etter 2024, bilens alder, rapport og opplysning.

**Samme vedtak i vurderingen og brevet:** Vurderingen og brevet bruker samme vedtak, fordi samme funksjon får de samme opplysningene. Vedtaket kan bare skifte når brukeren retter eller legger til et svar på brevsiden slik at et annet passer bedre, eller når biblioteket oppdateres. Eksempler er kjøpsdato, når feilen viste seg, og uriktig opplysning, som først spørres om på brevsiden. Ingenting lagres i `brevsak`.

### 3. Avsnittet i brevet

Juridisk ordlyd står i `JURIDISK.henvisning` i `src/lib/brev/brev.ts` (ikke lest av jurist). Avsnittet står rett etter `mangelOgBevisbyrde`, altså etter § 16 og § 18, rapporten og opplysningen, og før innvendingene: først loven, så vedtaket.

- **Lignende og nærmeste lignende:**
  > {organ} har behandlet en lignende sak. {likhet} {konklusjon} ({ref}, {norskDato(dato)}, {kildeUrl}). Jeg ber dere ta hensyn til at utvalget har vurdert en tilsvarende sak slik.
- **Samme regel:**
  > {organ} har lagt det samme til grunn i tidligere saker. {regel} ({ref}, {norskDato(dato)}, {kildeUrl}). Jeg ber dere ta hensyn til at utvalget har vurdert tilsvarende saker slik.

Eksempel på form (endelig tekst kommer fra kurateringen):

> Forbrukerklageutvalget har behandlet en lignende sak. En BMW X5 med 125 300 km, kjøpt hos forhandler, fikk feil på registerkjeden i motoren om lag 14 måneder etter kjøpet. Utvalget kom til at bilen hadde en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning (FKU-2023-13923, 31. januar 2024, https://…). Jeg ber dere ta hensyn til at utvalget har vurdert en tilsvarende sak slik.

- Brevet oppgir ikke beløp, fordi det kan dra forhandlerens forventning ned og er ett tall til som kan bli feil.
- Lenken er klikkbar på siden, i Word (`ExternalHyperlink`) og i PDF (lenke over hver linje). I PDF brytes den på `/ ? & =` i stedet for midt i et ord, slik `brytLinjer` gjør i dag.
- `byggBrev` regner ut henvisningen selv med `velgHenvisning`, så fjerde parameter (`lignende`) fjernes. Purringen siterer fortsatt ingenting.

### 4. Vurderingen

- Skjemaet sender `bilAr` (bare årstallet, ikke regnr) fra kjøretøyet som er hentet i steg 1 til `/api/vurder`.
- `/api/vurder` returnerer i tillegg `ref` og `organ`. Lenketeksten blir «{organ}, {ref}».
- Under eksemplet står det «Brevet ditt viser til denne saken.».
- Innledningen avhenger av trinnet:

| Trinn | Innledning |
|---|---|
| `lignende` | «Her er en lignende sak:» |
| `tilnaermet` | «Her er den nærmeste lignende saken:» |
| `regel` | «Her er en sak der utvalget la samme regel til grunn:» |

- Salgskortet lover `BREV_MED_LIGNENDE` for alle saker som kan kjøpes. `BREV_UTEN_LIGNENDE` og `GENERELLE` fjernes. «Annet» får en regel-sak i stedet for et generelt eksempel.

### 5. Saksmappen

- Valgene fjernes fra «Hva avgjorde lignende saker?» (`AvgjordeInnhold` i `src/app/brev/mappe/kort.tsx`): «Siter i brevet», «Fjern fra brevet», hint og feiltilstand.
- Eksempellisten med 3 vunne og 2 tapte vedtak blir stående.
- Øverst i kortet kommer en ny blokk som bare viser: «Brevet ditt viser til» med ref og dato, setningene som står i brevet, «Les vedtaket» og hvorfor vedtaket ble valgt, ut fra trinnet:
  - «samme type feil, omtrent like lang tid etter kjøpet, og bilen var omtrent like gammel»
  - eller: «utvalget brukte den samme regelen som brevet ditt bygger på»
- Blokken regnes ut i nettleseren med samme funksjon, uten ny API.

### 6. Kuratering og kontroll (bare agenter og skript)

1. **Kandidater.** `scripts/henvisning-kandidater.ts` leser bare. Det henter de ca. 10 nyeste vunne forhandlersakene (personbil/varebil, ikke `trenger_kontroll`):
   - per gruppe, tidsrom og aldersgruppe, for `lignende`
   - per grunnlag, for `regel`, med filtrene fra funn 4
   - Dagens 26 valg og #3010 tas med.
2. **Utvelgelse.** Tre uavhengige agenter leser sammendrag og nøkkelpunkter og deretter hele vedtaket for de beste. Kriteriene er, i rekkefølge:
   1. Kjøperen vant på akkurat denne feilen eller regelen. For `lignende` holder det at feilen var én av flere.
   2. Forhandleren svarte, så saken var omstridt.
   3. Saken ble avgjort på vanlige mangelsregler i fkjl, ikke på garanti.
   4. Tid, alder og formodningsregel stemmer med teksten.
   5. Vedtaket er enstemmig, uten dissens og ikke «under tvil».
   6. Vedtaket er så nytt som mulig (eldre bare når ingen nyere holder), og den eldste bilen i aldersgruppen velges.
   7. Bilen og feilen er gjenkjennelige.
   8. Utfallet er klart.
   - Passer ingen kandidat, får gruppen ingen post, og regel-trinnet dekker den.
3. **Avgjørelse.** Er agentene uenige, avgjør en fjerde agent etter teksten.
4. **Tekst.** En agent skriver `setning`, `likhet` og `konklusjon`, eller `regel`, og finner et ordrett sitat (`belegg`) for hver påstand: feil, tid, alder/km, utfall, type krav, regelen, organ og dato.
5. **Kontroll.** En uavhengig agent, som ikke skrev teksten, sjekker hver påstand mot vedtaket. Er noe uten dekning, skrives posten om og kontrolleres på nytt, eller den forkastes.
6. **Skript.** `npm run sjekk-henvisninger` (`scripts/sjekk-henvisninger.ts`) leser bare og avslutter med feil når noe ikke stemmer. Det sjekker:
   - at id-en finnes, at saken er en forhandlersak og at utfallet er medhold eller delvis medhold
   - at `kildeUrl` og `dato` er like databasen, og at datoen står i teksten
   - at `ref` stemmer med `saksnummer`, og at `organ` stemmer med toppteksten («FTU-sak»)
   - at `lov` stemmer med kjøpsdatoen, og at `presumsjon` stemmer med tidsrom og lov
   - at hvert grunnlag har en regel-post med `før_2024`, og at `rapport`, `opplysning` og `forventning` har `presumsjon: false`
   - at alle sitater i `belegg` består `sitatFinnes` (`src/lib/validering.ts`)
   - at alle tall i setningene står i teksten
   - at setningene ikke har hakeparenteser eller forhandlerens navn, og at ingen id er brukt to ganger
7. **Dokumentasjon.** `docs/eksempelsaker.md` blir til `docs/henvisninger.md`: kriterier, hver post med merknader, og hva som ble forkastet. Det utdaterte avsnittet om tapte saker fjernes.

### 7. Fjernes

`utfylling.lignende` forsvinner helt:
- `Lignende`, `MAKS_LIGNENDE` og `lesLignende` i `utfylling.ts`
- `hentLignende` i `mappe/hent.ts`
- `lignendeFor` i `brev/dokument.ts`
- `LignendeRef`, `lignendeAvsnitt` og `JURIDISK.lignende` i `brev.ts`
- `startLignende` i `brev/[id]/page.tsx` og `brevside.tsx`
- `lignende` i PATCH-svaret (`api/sak/[id]/route.ts`)

Gamle saker med nøkkelen i JSON går ikke i stykker, fordi `hentSak` ikke validerer ved lesing. Nøkkelen forsvinner når saken utløper. Kommentaren i `sak.ts` (37–38) oppdateres.

## Kritiske filer

- Nye: `src/lib/vurdering/henvisninger.ts` (bibliotek og `velgHenvisning`), `scripts/henvisning-kandidater.ts`, `scripts/sjekk-henvisninger.ts`, `scripts/henvisninger-belegg.json`, `docs/henvisninger.md`, og `package.json` (to skript).
- Endres:
  - `src/lib/vurdering/vurder.ts` (bruker `velgHenvisning`)
  - `src/lib/vurdering/innsending.ts` / `typer.ts` (`bilAr`)
  - `src/app/api/vurder/route.ts`
  - `src/app/vurdering/skjema.tsx`
  - `src/lib/brev/brev.ts`
  - `src/lib/brev/eksport.ts` og `src/app/brev/brevark.tsx` (lenker)
  - `src/app/brev/mappe/kort.tsx` og `saksmappe.tsx`
  - filene i avsnitt 7
  - `CLAUDE.md` (punktet «Sitert i brevet», punktet om eksempelvedtaket og et nytt avsnitt om henvisningen) og `README.md` (vedlikehold)
- Gjenbrukes:
  - `sitatFinnes` (`src/lib/validering.ts`)
  - `kjopsdatoFor`, `PRESUMSJON_TO_AR_FRA`, `beregnFaktorer` (`src/lib/vurdering/faktorer.ts`)
  - `norskDato` (`src/lib/brev/brev.ts`)
  - mønsteret `GRUPPER`, `GRUPPE_FOR` og `NAERMEST` fra `eksempler.ts`
  - `db` (`@/db`) i skriptene

## Rekkefølge

1. Typen og `velgHenvisning` med stigen, med dagens poster midlertidig konvertert. Testene i `eksempler.test.ts` (nytt navn `henvisninger.test.ts`) oppdateres, også garantitesten.
2. Kurateringen (avsnitt 6) fyller biblioteket: først regel-postene, som gir garantien, deretter de lignende sakene. Den kan kjøres parallelt med steg 3–6.
3. Avsnittet i brevet, og `utfylling.lignende` fjernes. Testene `brev-krav.test.ts` (60–88) og `brev.test.ts` (antall avsnitt) oppdateres fordi endringen er bevisst.
4. Lenker i Word, PDF og på siden.
5. Vurderingen (`bilAr`, tekster, salgskort) og regex-en for lenketeksten i `e2e/registreringsflyt.spec.ts` (linje 53).
6. Saksmappen.
7. `CLAUDE.md`, `README.md` og dokumentasjonen.

Ingen nye testfiler. Eksisterende tester endres bare der oppførselen er endret med vilje.

## Verifisering

- `npm test`, med garantitesten over alle kombinasjoner.
- `npm run typecheck`, `npm run lint`.
- `npm run sjekk-henvisninger` gir 0 feil.
- `npm run test:e2e`.
- I nettleseren (Playwright MCP):
  - **Motor, innen 6 måneder, kjøp 2025, bil fra 2016:** Vurderingen viser «Her er en lignende sak» og «Brevet ditt viser til denne saken». Brevet har avsnittet rett etter § 18 med samme `ref`. Saksmappen viser blokken uten valgknapper. Word- og PDF-filen har klikkbar lenke, og PDF-en bryter lenken pent.
  - **Bremser, 6–24 måneder, kjøp 2023, med verkstedrapport:** Brevet har aldri et «rask»-vedtak. Det har en lignende sak hvis biblioteket har en, ellers regel-saken `rapport`.
  - **Bare «Annet», eller «visste om feilen»:** Brevet har en regel-sak, og vurderingen viser den samme.
  - **Kjøpt av privatperson, eller frist ute etter en rettelse:** Ingen henvisning.
  - **Retting av kjøpsdato på brevsiden** slik at formodningsregelen faller bort: Henvisningen skifter i samme lagring og blir aldri borte.

## Utenfor omfang og senere

- **Motsvar:** vedtak som svarer på forhandlerens argument («normal slitasje», «som den er», «for sent»). Biblioteket kan få flere `grunnlag` for dette.
- **Nye vedtak:** Når det kommer vedtak om kjøp fra 2024, kjøres kandidatskriptet og kurateringen for de berørte gruppene, og regel-postene etter ny lov foretrekkes (står i `README.md`).
- **Kjøretøytype:** Bobil og MC får vedtak om personbil eller varebil, fordi oppslaget ikke gir type.
- **Bør rettes, men utenfor denne oppgaven:**
  - `FORBEHOLD_AVSNITT.som_den_er` sier at forbeholdet ikke kan innskrenke rettighetene «jf. § 3». Det er riktig for kjøp fra 2024, men ikke før: gamle § 17 ga forbeholdet virkning, og terskelen var «vesentlig dårligere stand».
  - Redaksjonen har gjort noen saksnumre i vedtakstekstene om til «[TELEFON]».

## Neste steg

Implementasjonsplan: `docs/superpowers/plans/2026-10-04-henvisning-i-brevet.md`.
