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
