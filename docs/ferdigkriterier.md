# Ferdigkriterier for datagrunnlaget og avsnittet om vedtaket

Avsnittet i brevet som viser til et vedtak (`src/lib/vedtaksvalg/`), og datagrunnlaget det bygger på (`vedtak.avgjorende`, `src/lib/avgjorende/`), er ferdige når alle tre kriteriene under er grønne. Ingen datavask starter før denne fila er skrevet, og kriteriene endres ikke mens de måles.

## Kriteriene

### 1. Stikkprøve av datagrunnlaget
- **Utvalg:** 50 tilfeldige vedtak fra grunnsettet (`src/lib/matching/grunnfilter.ts`) som har uttrekk, trukket blant vedtak som ikke er brukt i noen pilot eller simulering.
- **Kontroll:** to uavhengige dommere (Opus og Sonnet) leser fullteksten og svarer «stemmer» eller «stemmer ikke» for hvert felt malen bruker:
  - per feil med medhold:
    - komponent (en feil utvalget godtok)
    - vurdert for seg
    - sanksjon for feilen alene
    - hvert sitat: ordrett i utvalgets vurdering
  - per vedtak:
    - bil
    - forbehold
    - utvalgsnavn
- **Telling:**
  - Et felt er feil når begge dommerne sier «stemmer ikke».
  - Er dommerne uenige, avgjør en tredje agent med fulltekst om feltet stemmer.
- **Krav:**
  - minst 98 % riktige felt
  - null sitater som ikke står i utvalgets vurdering

### 2. Dekning
- **Testbenken:**
  - alle underkategorier, og hver hovedkategori uten valgt underkategori
  - fire tidspunkter: innen 6 måneder, 6–24 måneder før og etter 2024, og over 24 måneder
  - tre bilprofiler: ny, middels og gammel med «som den er»
  - tre krav: retting, prisavslag og heving
- **Måling:** `ranger` over hele grunnsettet for hver kombinasjon.
- **Krav:** minst 90 % av kombinasjonene får et vedtak på nivå A eller B. Resten får lovsetningen («Kravet bygger på lovens vilkår.»).

### 3. De tolv simulerte sakene
- **Kjøring:** `npm run simuler` med de tolv sakene i `scripts/simuler.ts`, med sikkerhetsnettet på.
- **Kontroll:** hvert felt i hvert avsnitt mot fullteksten til det valgte vedtaket:
  - utvalg, saksnummer og dato
  - bil og km
  - «som den er»
  - komponent
  - sitater
  - sanksjon
  - tallene i sammenligningssetningen

  Dommerne og avgjørelsen er de samme som i kriterium 1.
- **Krav:** alle felt i alle tolv avsnitt stemmer. Et avsnitt som er erstattet av lovsetningen, teller som riktig.

## Når et kriterium er rødt
Bare feltet som feiler, kjøres på nytt, ikke hele passet. Instruksen endres ikke underveis.

## Frosset til kriteriene er grønne
- feilvurderingen
- rangeringen utover de to nivåene
- malen
- instruksen til velgeren

Det kommer ingen nye kriterier og ingen ny prosa i avsnittet. Målingen er felt mot fulltekst, ikke prosa.

## Brevløpet
Rangering i kode, deretter ett Sonnet-kall for valget, deretter malen. Brevløpet har ingen kontroll per brev og ingen reserve. Uten kandidater bruker brevet lovsetningen.

Sitater kontrolleres i datavasker, ikke per brev. Funn fra datavasker logges i `kontrollfunn`, der de kan gjennomgås og angres. Importene legger inn funn som ikke er angret.

## Sluttkrav for brevløpet
Kravene måles på de samme 100 tilfeldige kjøpersakene som før (`npm run ferdig:brevlop`, fast frø):
- nivå A i minst 80 av 100
- lovsetning i høyst 2 av 100
- kostnad under $0,03 og median under 10 sekunder per brev
- stikkprøven på 50 vedtak fra kriterium 1 står: minst 98 % riktige felt

Er alle grønne, er denne delen ferdig. Er ett rødt, rapporteres tallet, og arbeidet stopper. Instrukser, mal og rangering endres ikke for å få kravene grønne.

---

# Ferdigkriterier for hele brevet

Brevet rundt vedtaksavsnittet (`src/lib/brev/`) er ferdig når alle fem kriteriene under er grønne. Kriteriene endres ikke mens de måles. Er ett rødt, rapporteres tallet, og arbeidet stopper.

Brevet er ren kode: maler fylt med felt fra skjemaet, Vipps-profilen (stub i denne runden), Brreg og lovteksten. Ingen modell skriver noe. Hver setning har en kilde, og fins ikke feltet, fins ikke setningen.

## Kriteriene

### 1. Komplette brev
- **Måling:** de 12 simulerte sakene (`scripts/simulerte-saker.ts`), utvidet med selger, tidligere reklamasjon, overslag, kjøpesum, utlegg og en Vipps-stub, bygges uten nett mot `src/lib/brev/__fixtures__/praksis.json`. Tolv gyldne filer ligger i `src/lib/brev/__snapshots__/gylne/`.
- **Krav:** 12 av 12 brev inneholder ingen `undefined`, `null`, `NaN`, tomme klammer eller tomme felt. Alle tolv er lest.

### 2. Sporbarhet
- **Måling:** `kombinasjoner.test.ts` bygger brev for hver kombinasjon som gir ulik tekst.
- **Krav:** ingen setning i noe bygget brev har tom kilde.

### 3. Paragrafer
- **Måling:** `paragrafer.test.ts`.
- **Krav:** hvert poeng malene bruker finnes i begge lovversjonstabellene (`før_2024`, `etter_2024`), fylt fra Lovdata med kilde og kontrolldato i fila. Et poeng uten sikkert nummer står som `null` (bare «forbrukerkjøpsloven») og er ført som kjent gap i `docs/brev.md`.

### 4. Skjema og visning
- **Måling:** Playwright ved 390 px og 1280 px gjennom alle fem stegene.
- **Krav:**
  - selgersøk, tidligere reklamasjon og kostnadsoverslag virker
  - forhåndsvisningen viser hode, avsnitt 1 og vedtaksavsnittet, resten tilslørt
  - hele brevet vises med `TVISTR_HELT_BREV_UTEN_BETALING=1`, og bygges med Vipps-stuben
  - ingen horisontal scroll

### 5. Word-eksport
- **Måling:** `docx.test.ts` pakker ut `word/document.xml`. Brukeren åpner én fil i Word.
- **Krav:** teksten i docx er lik `somTekst(brev)` (fotnoter holdt utenfor), og filen åpner i Word.

## Språkregler som testes
- Første person, formelt, uten forsterkere og uten innrømmelser til motparten.
- Ingen setning inneholder «klart», «åpenbart», «utvilsomt», «jeg er klar over» eller «jeg mener».
- Vipps-profil uten adresse og uten e-post gir fortsatt et gyldig brev.

## Frosset mens kriteriene måles
- malene i `src/lib/brev/`
- paragraftabellen
- vedtaksavsnittet (`src/lib/vedtaksvalg/`)

## Resultat for hele brevet (2026-10-13)

| # | Kriterium | Resultat |
|---|---|---|
| 1 | Komplette brev | **Grønt.** 12 av 12 gylne brev bygges uten tomme felt, og alle tolv er lest (`src/lib/brev/__snapshots__/gylne/`). To brev hadde en tidligere reklamasjon datert før feilen viste seg; det var feil i testsakene, ikke i malene, og er rettet. |
| 2 | Sporbarhet | **Grønt.** Over 15 000 brev (alle kombinasjoner av lovversjon, «som den er», åtte feilsett, tid, selger sa noe, verksted, krav, rettingsforsøk og tillegg) har en kilde på hver setning, ingen tomme felt og ingen forsterkere. |
| 3 | Paragrafer | **Grønt.** Begge tabellene er fylt og kontrollert mot Lovdata, lovvedtaket og Prop. 49 LS. Ingen poeng er et gap (se `brev.md`). |
| 4 | Skjema og visning | **Grønt.** `scripts/ferdig-brevskjema.mjs` ved 1280 og 390 piksler: selgersøk mot Enhetsregisteret, tidligere reklamasjon, overslag, forhåndsvisning (skjult tekst finnes ikke i DOM-en) og hele brevet, «Kopier tekst» og Word-nedlasting. Ingen konsollfeil og ingen horisontal scroll. |
| 5 | Word-eksport | **Delvis.** Teksten i `word/document.xml` er lik `somTekst` i tre tester, og `textutil` leser filen nettleseren lastet ned. At filen åpner i Word er ikke målt av meg: åpne `~/Downloads/tvistr-brev-eksempel.docx`. |

Kjent og ikke kriterium: Vipps-integrasjonen, og funnene som er ført som gap i `brev.md`.

---

# Ferdigkriterier: kontakt med selger og verkstedrapport

Utvidelsen av steg 3 og 4 og brevet (`docs/skjema.md`, `docs/brev.md`) er ferdig når disse er grønne. De ble satt før bygging.

1. **De 12 simulerte sakene** gir komplette brev. Minst fire har rapport med ulike avkrysninger, og minst to har reklamert = ja med avvist eller ikke svart (testet i `gylne.test.ts`). De gylne filene er oppdatert og lest.
2. **Sporbarhet:** hver ny setning har en kilde (avkrysningen eller feltet), over 31 000 brev.
3. **Skjemaet kan ikke lagre motstridende svar:** rettingsforsøk uten reklamasjon og rapportdato før kjøp avvises både i skjemaet og på serveren (`rens.test.ts`).
4. **Desktop og mobil**, inkludert «Samme rapport som forrige feil» (`scripts/ferdig-brevskjema.mjs`).

## Resultat (2026-10-13)

| # | Resultat |
|---|---|
| 1 | **Grønt.** Sju av tolv saker har rapport (alle seks avkrysninger, alle tre verkstedtyper, med og uten konklusjon og overslag). Seks har reklamert = ja: avviste (to), ikke svart (én), tilbød retting (to) og annet (én), og tre av dem med rettingsforsøk (1, 2 og 2). Alle tolv er lest. |
| 2 | **Grønt.** Kombinasjonstestene over avkrysninger, verkstedtype, konklusjon, kontakt og krav, og over 31 000 brev, har kilde på hver setning, ingen tomme felt og ingen forsterkere (konklusjonen og beskrivelsen unntatt). |
| 3 | **Grønt.** Serveren setter rettingsforsøk til 0 uten reklamasjon, avviser rapporter uten hvem, navn, dato etter kjøp eller minst én avkrysning, og droppet overslag uten avkrysning. Skjemaet viser ikke forsøksspørsmålet ved «Nei». |
| 4 | **Grønt** ved 1280 og 390 piksler: rapporten kreves før «Fortsett», kopien nullstiller avkrysningene, «Lag brev» er grått til alle svar er gitt, brevet har overslaget og én vedleggslinje for rapporten. Ingen konsollfeil, ingen horisontal scroll. Kjøringen avslørte at overslaget gikk som tekst og ble forkastet av serveren; rettet. |

---

# Ferdigkriterier: tidslinjen

«Når viste feilen seg?» blir en dato per feil, og all inndeling (tidsnivå, formodning, frister) regnes av koden fra datoene i én ren funksjon (`src/lib/brev/tidslinje.ts`). Skjemaet, serveren, brevmalene og testene bruker den samme. Umulige rekkefølger stopper, usannsynlige advarer.

1. Intervallspørsmålet er borte; tidsnivå regnes bare fra datoer.
2. Alle stopp-regler er umulige å omgå i skjemaet og avvises på serveren (`rens.test.ts`).
3. De 12 gylne brevene har samme tidsnivå per feil som før, og ingen stopp og ingen advarsler.
4. Dekningsmålingen gir samme fordeling som før: `ferdig:dekning` (ren rangering) helt lik, og `ferdig:brevlop` (100 saker) samme fordeling på nivå A/B som før (±2).

# Ferdigkriterier: riktighet utover datoene

Én ren funksjon (`src/lib/brev/riktighet.ts`) vurderer hele saken og gir `stopp` og `advarsler`; skjemaet, serveren og testene bruker den samme, og serveren kjører alle stopp-regler på nytt.

1. Tabelltest per regel (stopp og advar), begge lovversjoner.
2. `rens.test.ts` avviser hvert stopp-tilfelle.
3. Invariant-testen (`brev.invarianter.test.ts`) er grønn på de 12 gylne brevene og 200 genererte gyldige saker.
4. Playwright: oppsummeringen i steg 5 viser advarslene, og «Endre» fører tilbake til feltet.
5. Ingen regel gir stopp på de 12 gylne sakene.

Kjent før bygging, og ikke et kriterium:
- Kilometerstand fra vegvesenet finnes ikke i API-et for tekniske kjøretøyopplysninger («Du får ikke kjøretøyets kilometerstand i tjenesten»). Reglene om km mot siste EU-kontroll kan ikke bygges.
- Slettede foretak kan ikke velges (Brreg svarer 410), så regelen om «slettet» kan ikke slå til; «konkurs» og «under avvikling» kan.

## Resultat for tidslinjen og riktighet (2026-10-13)

| Kriterium | Resultat |
|---|---|
| Tidslinje 1: intervallet borte | **Grønt.** Steg 3 spør om datoen feilen ble oppdaget (Playwright: spørsmålet «Når viste feilen seg?» finnes ikke). Tidsnivå regnes bare fra datoer (`tidsnivaFor`); intervallordene brukes bare som tekst til modellen. |
| Tidslinje 2: stopp kan ikke omgås | **Grønt.** Datovelgerne går fra dagen etter kjøpet til i dag; rapport før oppdaget stopper i skjemaet («Fortsett» grå i Playwright); serveren avviser alle åtte stopp-tilfellene i `rens.test.ts`. |
| Tidslinje 3: de 12 gylne | **Grønt.** Ingen stopp, ingen advarsler, og samme tidsnivå per feil som med intervallet (`gylne.test.ts`). En test sjekker også at datoen gir samme nivå som det gamle intervallet for hver tredje dag over fem år, fra seks kjøpsdatoer. |
| Tidslinje 4: dekningen | **Grønt.** `ferdig:dekning`: A 1 932, B 300, lovsetning 0 (likt). `ferdig:brevlop` (100 saker): A 86, B 14 (likt). |
| Riktighet 1: tabelltest per regel | **Grønt.** 28 tester i `riktighet.test.ts` (stopp, advarsler, grenser, begge lovversjoner). |
| Riktighet 2: serveren avviser | **Grønt.** Åtte stopp-tilfeller i `rens.test.ts`; `finnVedtak` avviser før modellkallet. |
| Riktighet 3: invariantene | **Grønt** på 12 gylne og 200 genererte saker, og en test viser at de fanger plantede brudd. Sidetallet er et anslag. |
| Riktighet 4: oppsummeringen | **Grønt** ved 1280 og 390 piksler: advarslene står øverst med antall (også i steg 3 og 4), og «Endre» går til riktig steg med feltet i syne. |
| Riktighet 5: ingen stopp på de 12 | **Grønt.** |

Ikke bygget, se `riktighet.md`: reglene om kilometerstand (vegvesenets API har ikke km), og «slettet» foretak (kan ikke velges).

---

# Ferdigkriterier: før betalingsmuren (landingsside, vurdering, forhåndsvisning)

Den nye flyten (landingsside → 1 Bilen → 2 Kjøpet → 3 Feilen → 4 Vurdering → 5 Detaljer → 6 Krav og selger → 7 Forhåndsvisning → 8 Brevet) er ferdig når alle fem er grønne. Kriteriene er satt før bygging og endres ikke mens de måles. Er ett rødt, rapporteres tallet, og arbeidet stopper.

Alt før muren er kode og oppslag i databasen: ingen modellkall før steg 7, ingen tekst skrevet av en modell, ingen sannsynlighet for utfall.

1. **Fra regnr til vurdering** tar under 2 minutter i Playwright (desktop og mobil) og gjør null modellkall. Måles i `e2e/flyt.spec.ts`; at `velgVedtak` ikke kalles i steg 4 testes i `vurdering.test.ts`.
2. **De 12 simulerte sakene** får riktig status og riktige lovlinjer. Forventet status per sak står i en gylden fil, satt ut fra reglene i `docs/vurdering.md` før vurderingen ble kjørt.
3. **Statistikk-tabellen** (`statistikk_kategori`) bygges ved import, ikke per forespørsel, og steg 4 leser den. Tellingene stemmer mot en fersk telling i databasen for tre underkategorier, og tall under 5 vises ikke.
4. **Steg 7** viser ikke sitater eller lenke før betaling: vedtaksavsnittet har bare første setning i klartekst, og verken forhåndsvisningen eller svaret fra serveren inneholder sitatene eller `kilde_url`.
5. **Måling** er på plass for alle hendelsene: landing, regnr ok, steg 2 ferdig, steg 3 ferdig, vurdering vist (med status), fortsett klikket, steg 7 vist, betaling startet, betaling fullført, brev lastet ned. Bare status og kategori lagres, aldri regnr eller navn.

I tillegg, som tester og ikke egne kriterier: status per gren (tabelltest, «fristen er ute» gir ingen betalingsknapp), lovlinjene per lovversjon, formodning og forbehold (snapshot), kortene er de tre øverste fra `ranger()` uten sitater og lenker, og ingen tekst før muren inneholder «vinne», «sannsynlig», «garanter» eller forsterkerne fra brevet.

## Resultat for før betalingsmuren (2026-10-14)

| # | Kriterium | Resultat |
|---|---|---|
| 1 | Regnr til vurdering under 2 minutter, null modellkall | **Grønt.** `e2e/flyt.spec.ts` ved desktop og mobil: 5 sekunder fra landingssiden til vurderingen, for alle tre statusene. Før steg 7 går det nøyaktig ett serverkall (`vurderSaken`), og «fristen er ute» ingen. `vurdering.test.ts` viser at `velgVedtak` ikke kalles, og at serverhandlingen for steg 4 ikke importerer modellen. |
| 2 | De 12 simulerte sakene | **Grønt.** Forventet status, grunner og lovlinjer ble satt i `src/lib/vurdering/__fixtures__/forventet.json` før kjøringen. Alle 12 stemmer (`gylne.test.ts`): 9 «du kan ha en sak», 3 «står svakt» (girkasse og rust med «som den er» på gammel bil før 2024, rust og nødmodus oppdaget etter to år, rust som slitedel, nødmodus uten vedtak på nivå A). Skjermene står i `docs/jurist-gjennomgang.md`. |
| 3 | Statistikk-tabellen | **Grønt.** `statistikk_kategori` (63 rader, 2 145 vedtak) bygges av importene og `npm run statistikk:bygg`, og steg 4 og landingssiden leser den. `npm run ferdig:vurdering`: turbo, bremser og rust er like en fersk SQL-telling. Tall under 5 vises ikke (tabelltest). |
| 4 | Ingen sitater eller lenke før betaling | **Grønt.** Forhåndsvisningen har bare første setning av vedtaksavsnittet (`brev.test.ts`); avsnittet er forseglet i svaret fra serveren (`signatur.test.ts`). Playwright: ingen «» utenom «som den er», ingen lenker og ingen vedtaks-URL i siden i steg 4 og 7; i steg 8 (dev-flagget) er lenken og sitatene der. |
| 5 | Måling | **Grønt.** Alle ti hendelsene lagres i `hendelse` med status og kategorier, sett i databasen etter en gjennomgang i nettleseren; serveren forkaster regnr og navn (`maling.test.ts`). |

Kjent og ikke kriterium: Vipps (betalingen simuleres bare i utvikling), og at `next build` stopper på en lokal, git-ignorert fil (`data/explore/pilot.mts`) som ikke er en del av appen; med den utenfor bygges alle sider, og landingssiden prerendres med antallet.
