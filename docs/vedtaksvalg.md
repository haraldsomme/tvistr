# Vedtaksvalget: avsnittet som viser til et vedtak

Hvert klagebrev viser til ett vedtak fra Forbrukerklageutvalget (eller Forbrukertvistutvalget) der kjøperen fikk medhold. Avsnittet bygges av en mal. Alt som står om vedtaket, er enten et felt fra databasen eller et ordrett sitat fra utvalgets egen vurdering. Det finnes ingen fri prosa om vedtaket, så det er ingenting å ta feil av utover feltene.

Brevløpet har tre ledd:
1. rangering i kode
2. ett Sonnet-kall som velger
3. malen

Det har ingen kontroll per brev og ingen reserve. Finnes det ingen kandidat, brukes lovsetningen. Kvaliteten sikres i dataene, ved datavasker kjørt én gang (se under). Kravene og målingene står i `docs/ferdigkriterier.md`.

## 1. Rangering (`src/lib/matching/`, kode)

**Grunnsettet** (`grunnfilter.ts`) er vedtak med:
- medhold eller delvis medhold
- personbil eller varebil
- forbrukerkjøpsloven
- forhandler som selger
- en sanksjon tilkjent

I tillegg gjelder:
- Seire på garanti telles bare når kjøperen klager på garantien.
- Samme sak publisert to ganger telles én gang.
- Er det mer enn fem år siden kjøpet, gis ingen kandidater (§ 27).

**To nivåer:**
- **A, samme feil.** Feilen har samme underkategori som kjøperens. Har kjøperen bare valgt hovedkategori, eller har kategorien ingen underkategorier, holder samme hovedkategori. I tillegg må alle disse vilkårene være oppfylt:
  - utvalgets vurdering nevner feilen og fant at den alene var en mangel: ikke `samlet`, `samlet_med` tom, `nevnt_i_vurderingen` og `vurdert_for_seg` ikke nei
  - minst to verifiserte sitater om feilen
  - bilen i vedtaket er ikke mildere enn kjøperens på km, alder eller «som den er» (intervaller i `vekter.ts`); for feil i det selgeren sa eller lovet, teller ikke bilprofilen
- **B, rettslig poeng.** Vedtaket avgjorde et av kjøperens rettslige poeng (`rett.ts`), og utvalgets egen setning om akkurat det poenget finnes i `rettslige_sitater`. Poengene og når de er aktuelle:

  | Poeng | Aktuelt når |
  |---|---|
  | formodningsregelen | feilen viste seg innen fristen |
  | «som den er» fritar ikke | bilen ble solgt «som den er» |
  | feil etter to år, § 27 | feilen viste seg etter to år |
  | uriktig eller tilbakeholdt opplysning | etter kjøperens svar om hva selgeren sa |
  | tapt eller pålagt retting | etter antall rettingsforsøk eller kravet |
  | heving | kravet er heving |
  | prisavslag | kravet er prisavslag |

**Sortering:** nivå A kommer foran B. Innenfor et nivå sorteres det på poeng (`vekter.ts`):
- underkategori
- tidsnivå
- km og alder
- «som den er»
- krav
- om utvalget vurderte feilen selv
- grunnlaget utvalget bygde på

Strengere for kjøperen gir delpoeng, mildere gir 0. På nivå B sorteres det først etter hvor mange av kjøperens poeng vedtaket treffer. De ti beste går videre.

## 2. Valget (`src/lib/vedtaksvalg/valg.ts`, ett Sonnet-kall)

**Modellen får:**
- **Kjøperens svar** fra `kjoper.ts`:
  - kategori og beskrivelse
  - når feilen viste seg, og lovversjonen
  - km, alder, «som den er», kravet og antall rettingsforsøk
- **Hver kandidat:**
  - nivå
  - feilen (A) eller de rettslige poengene (B)
  - bil, km, alder og «som den er»
  - sanksjonen for feilen alene (A)
  - de verifiserte sitatene med id

**Modellen svarer bare** med `vedtak_id` og id-ene til 1–2 sitater (A) eller 1 sitat (B). Den skriver ingen tekst.

**Hvis svaret ikke holder** (ukjent vedtak, eller sitat-id-er vedtaket ikke har), brukes rangeringens førstevalg med de første sitatene. Det samme skjer om kallet feiler. Ingenting prøves på nytt.

## 3. Malen (`src/lib/vedtaksvalg/mal.ts`, kode)

**Nivå A:**
> Det vises til {utvalg}s vedtak i sak {nr} av {dato}. Saken gjaldt {komponent} på {bil} som hadde gått {km} km ved kjøpet[, solgt «som den er»]. Utvalget uttalte: «{sitat 1}» [Utvalget uttalte videre: «{sitat 2}»] [Kjøperen fikk medhold i krav om {sanksjon for feilen alene}.] [{sammenligning}]

**Nivå B:**
> Det vises til {utvalg}s vedtak i sak {nr} av {dato}, som gjaldt {komponent}. Utvalget uttalte: «{sitat}»

**Lovsetningen**, når det ikke finnes noen kandidat:
> Kravet bygger på lovens vilkår.

**Regler i malen:**
- **Utvalget:** navnet slik vedtaket selv bruker det, på bokmål.
- **Saksnummer:** slik vedtaket skriver det («sak 117158», ikke arkivets «FKU-2026-117158»).
- **Dato:** står bare når møtedatoen i databasen og datoen i signaturen er like (`signaturdato`). Ellers utelates den.
- **Bil:** slik vedtaket selv skriver den (`avgjorende.bil`, kontrollert mot teksten), ellers merke, modell og årsmodell fra databasen.
- **Km:** utelates når saken gjaldt kilometerstanden, fordi tallet da er det omstridte.
- **Sammenligningssetningen:** regnes ut av koden og tar bare med det som går i kjøperens favør:
  - yngre med minst 2 år
  - minst 10 % kortere kjørt
  - ikke solgt «som den er» når vedtakets bil var det

  Går ingen akse i kjøperens favør, utelates setningen.

## Datagrunnlaget og datavaskene

Avsnittet bygger på `vedtak.avgjorende` (`src/lib/avgjorende/`). Claude Code-agenter (Opus) har lest hvert vedtak i grunnsettet med saksfremstilling og utvalgets vurdering adskilt. Importen gjør dette:
- forkaster sitater som ikke står ordrett i utvalgets vurdering, eller som har utelatelser
- setter «vurdert for seg» til nei når feilen er vurdert samlet med andre
- leser signaturdatoen

**Datavasker kjørt én gang**, hver med pilot og dommer først:

| Vask | Hva | Resultat |
|---|---|---|
| `avgjorende-v5` | hele uttrekket: per feil nevnt, vurdert for seg, sanksjon og sitater; per vedtak bil, forbehold og rettslige sitater | 1 268 vedtak |
| standpunkt (`standpunkt.md`) | er hvert sitat utvalgets eget standpunkt? | 1 402 av 7 514 forkastet |
| rettslig (`rettslig.md`) | uttrykker hvert rettslige sitat akkurat sitt poeng? | 299 av 1 976 forkastet; piloten 95 av 95 enig med dommer |

Svarene ligger i `data/avgjorende/` og brukes ved hver import. Funn som logges i `kontrollfunn`, kan gjennomgås og angres med `angret`; importene legger inn de funnene som ikke er angret. Ingenting i brevløpet skriver til databasen.

**Rekkefølge ved ny kjøring:**
1. `npm run avgjorende:hent`
2. arbeidsflyten `scripts/workflows/avgjorende.js`
3. `npm run standpunkt:hent` og `scripts/workflows/standpunkt.js`
4. `npm run rettslig:hent` og `scripts/workflows/rettslig.js`
5. `npm run avgjorende:importer`

## Hvorfor det ikke er kontroll per brev

En kontroll per brev ble prøvd: et Sonnet-kall med fulltekst etter at avsnittet var bygget, med tilbakeskriving av funnene. Målt mot en dommer med fulltekst var 64 % av stoppene falske. Kontrollen stilte de samme spørsmålene som datavasken allerede hadde svart på, men med en svakere modell, og den gjorde dataene dårligere. Det eneste spørsmålet den svarte riktig på hver gang, om et rettslig sitat gjaldt riktig poeng, ble gjort om til datavasken «rettslig».

## Målt (oktober 2026)

| Måling | Resultat |
|---|---|
| Stikkprøve, 50 vedtak med to dommere | 98,7 % riktige felt; 0 sitater utenfor utvalgets vurdering |
| Dekning, 2 232 kombinasjoner | 100 % (A 1 932, B 300) |
| De 12 simulerte sakene | alle felt i avsnittene stemmer |
| 100 tilfeldige kjøpersaker | A 86, B 14, lovsetning 0; $0,011 per brev, median 5 s |

## Kjente gap

- **Garanti:** nivå B har ikke noe poeng for § 18 a (garanti). En garantisak uten vedtak på nivå A kan få et B-vedtak om et annet spørsmål.
- **Dato:** 93 vedtak har ulik møtedato og signaturdato og vises uten dato.
- **Alder ved kjøpet** er regnet fra årsmodell og kan avvike ett år fra det vedtaket sier. Derfor krever sammenligningssetningen minst to års forskjell.
- **Vedtak uten uttrekk:** 90 vedtak i grunnsettet har ingen feil med medhold i feilvurderingen og har derfor ikke noe uttrekk.
- **Resten av brevet** står i `docs/brev.md`. Avsnittet om praksis er det siste underavsnittet i avsnitt 3 («Rettslig vurdering»), etter mangel og tidspunkt, og settes inn uendret. Utelates når det ikke er noen kandidat (lovsetningen).
