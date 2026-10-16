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
Kravene ble målt på 100 tilfeldige kjøpersaker (`ferdig:brevlop`, fast frø; skriptet er fjernet med det gamle brevet):
- nivå A i minst 80 av 100
- lovsetning i høyst 2 av 100
- kostnad under $0,03 og median under 10 sekunder per brev
- stikkprøven på 50 vedtak fra kriterium 1 står: minst 98 % riktige felt

Er alle grønne, er denne delen ferdig. Er ett rødt, rapporteres tallet, og arbeidet stopper. Instrukser, mal og rangering endres ikke for å få kravene grønne.

---

Kriteriene for det gamle brevet, skjemaet, tidslinjen, riktighetsreglene og forhåndsvisningen er fjernet sammen med koden 2026-10-16. De står i git-historikken (commit `1c881fe`). Den nye appen er beskrevet i `docs/app.md`.
