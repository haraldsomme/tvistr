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

## Vurderingen (2026-10-23)

Vurderingen før betaling (`evaluate` i `src/lib/app/vurdering.ts`) er ferdig når kravene under er grønne. Kravene er skrevet før målingen og endres ikke mens den pågår.

- **Medhold** (én definisjon overalt): enheten er vedtaket. Et vedtak teller for en gruppe (alle, en kategori, en celle) når utvalget vurderte en feil i den (`medhold` eller `avvist`, ikke `utenfor`). Det er medhold når `utfall` er `medhold` eller `delvis_medhold` **og** en slik feil fikk medhold.
- **Måling:** `npm run vurdering:kalibrer`. Hvert vedtak i tellesettet (`TELLEFILTER` i `src/lib/vurdering/statistikk-db.ts`) med minst én vurdert feil oversettes til kjøperens svar og kjøres gjennom `evaluate`. Vedtak der fristen på fem år er ute, telles for seg og ikke i nivåene.
- **Vektene** settes én gang, fra grunnlinjen (dagens kode målt med samme skript), før målingen. De justeres ikke etterpå for å få kravene grønne.
- **Krav:**
  - Medhold faller med nivået: Sterk sak > God sak > Krever mer, med minst 10 prosentpoeng mellom naboene.
  - Hvert nivå har minst 15 % av vedtakene.
  - Ordet «trolig» står bare i teksten til et nivå med over 50 % medhold. Ingen nivåtekst har prosenttall eller lover et utfall.

Er alle grønne, er vurderingen ferdig. Er ett rødt, rapporteres tallene, og arbeidet stopper.

**Målt 2026-10-23** (2 103 vedtak; 26 uten datoer og 16 med fristen ute er holdt utenfor):
- Grunnlinjen (sterk, mulig, svak, før endringen) var rød: sterk 66,1 % mot mulig 56,4 %, og svak hadde bare 35 vedtak.
- Etter endringen: Sterk sak 505 av 675 (74,8 %), God sak 564 av 980 (57,6 %), Krever mer 174 av 406 (42,9 %). Alle krav er grønne.
- Vektene er satt fra de samme vedtakene som de er målt på, så målingen viser at nivåene skiller, ikke hvor godt de treffer nye saker.

---

Kriteriene for det gamle brevet, skjemaet, tidslinjen, riktighetsreglene og forhåndsvisningen er fjernet sammen med koden 2026-10-16. De står i git-historikken (commit `1c881fe`). Den nye appen er beskrevet i `docs/app.md`.
