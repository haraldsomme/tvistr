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
