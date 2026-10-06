# Samlet brevskriving: design

Dato: 2026-10-06. Status: godkjent i brainstorming.


## Kontekst

Brevet bygges i dag av maler i `src/lib/brev/brev.ts` (`byggBrev`, `JURIDISK`), med AI bare i feilavsnittene (`feilen.avsnitt`). Hver bit er riktig for seg, men ingen ser helheten. Det gir feil som:
- `${konto}` står to ganger ([brev.ts:351](src/lib/brev/brev.ts#L351)).
- «hvis det sendes i dag» står fast i `JURIDISK.rente` (:109).
- «Feilen viste seg …» står både i avsnitt 1 og i avsnittet om formodningsregelen.
- Rapportsitatet er kjøperens omtale av rapporten, satt i «» uten å være et ordrett sitat (:215).
- «blitt verre over tid» kommer fra intervjuets sjekkliste ([prompter.ts:70](src/lib/ai/prompter.ts#L70)).

Målet er et brev som leser som om én person skrev det, der hvert faktum står én gang, datoer og sitater stemmer, og argumentasjonen speiler vedtak der kjøperen fikk medhold.

## Beslutninger (fra brainstorming 2026-10-06)

- **AI formulerer hele brevteksten,** også den juridiske. `JURIDISK` blir referanseformuleringer i prompten.
- **Brevhodet bygges i kode:** avsender, mottaker, emne med regnr., dato og underskrift.
- **Brevet skrives etter veiviseren.** En senere endring i saken merker brevet som utdatert og gir knappen «Skriv brevet på nytt».
- **Stegene samler bare inn.** Til slutt kommer en avklaringsrunde der AI ser hele saken, spør om det som mangler, og **foreslår rettelser i felt som kjøperen godtar**.
- **Spørsmålene i avklaringsrunden bygger på en momentkatalog fra vedtakene:** det utvalget la vekt på i saker kjøperen vant. Analysen bruker hele vedtaksteksten og flere modeller.
- **Kildetekster limes inn:** rapport, annonse/kontrakt/melding og forhandlerens svar. Alle er valgfrie. Sitater kontrolleres ordrett mot kilden. Uten kildetekst står det ingen sitater.
- **Fremgangsmåte 1, én sporbar forfatter:** hver setning merkes med argument-id-er, sitater og avledede datoer er merker som koden fyller inn, og en mekanisk kontroll følges av et separat AI-gjennomsyn.
- **Kjøperen redigerer aldri brevteksten.** Brevet endres bare gjennom fakta.
- **Gullsaker kjøres som eval-skript,** ikke som en del av `npm test`.
- **Rubrikken bygges av** `sjekkBrev`-reglene, utredningens punkter og momentkatalogen.

## Arkitektur (`src/lib/brev/`)

1. **`sak.ts` → `lagSak(svar, utfylling, idag): Sak`** (ren funksjon). Den samler:
   - partene som roller, ikke navn
   - kjøpet
   - `tidslinje[{type, dato, kilde}]` med kjøpet, når feilen viste seg, reklamasjon, forhandlerens svar, reparasjon og rapporten
   - feilene (fritekst og titler)
   - opplysningen før kjøpet
   - `kilder{rapport?, opplysning?, svar?}`
   - krav og utgifter, vedlegg, `avklaringer[]`

   Den gjenbruker `avledSvar`, `gyldigRetting` og `kjopsdatoFor`.
2. **`brevplan.ts` → `planlegg(sak, idag): Brevplan`** (regelmotor). Den gjenbruker:
   - `beregnFaktorer` (`src/lib/vurdering/faktorer.ts`)
   - `harFatt` og `kreverPenger`
   - `velgHenvisning` (`src/lib/vurdering/henvisninger.ts`)
   - de faglige reglene i `sjekkBrev`

   Den lager:
   - `argumenter[{id, ma, data}]`. Id-ene er `formodning`, `rapport_bevis`, `opplysning`, `kjente_ikke`, `forbehold`, `slitasje`, `femarsfrist`, `historikk`, `reklamasjon`, `krav_*`, `subsidiaert`, `vesentlig`, `avviser_nytt_forsok`, `rente`, `rente_heving`, `erstatning`, `forbehold_tap`, `henvisning`, `svarfrist`, `vedlegg` og `moment:<id>`.
   - `forbudt[]`, `verdier` (beløp, summer og datoer), `disposisjon` og `mangler[{felt, steg}]`.

   `JURIDISK` flyttes hit som referanseformuleringer.
3. **Avklaring** (`avklaring.ts` og ruten `POST /api/sak/[id]/avklaring`), med Sonnet 5.5 og verktøyet `avklar`. Svaret er `{status, sporsmal[{id, moment?, tema, tekst, alternativer, flervalg}], rettelser[{felt, verdi, begrunnelse}], feiltitler[]}`.
   - Koden velger hvilke momenter fra katalogen som gjelder, og tar bort dem saken allerede besvarer.
   - Høyst 8 spørsmål per runde og 3 runder. Alle spørsmål kan hoppes over.
   - `rettelser` kan bare gjelde en lukket liste med felt. De går gjennom `rettSvar` → `tilpassTilSvar` → `avledSvar` → `kontrollerRettelse`, og en rettelse som svekker brevet går gjennom `konsekvenserAv` / `useBekreftLagring`.
   - Svarene lagres i `utfylling.avklaringer[{moment?, tema, sporsmal, svar}]`.
4. **Forfatter** (`forfatter.ts`), med Opus 5.5 og verktøyet `skriv_brev`. Svaret er `{avsnitt[{setninger[{tekst, argumenter[]}]}], sitater[{id, kilde, tekst}]}`.
   - Merkene er `{{sitat:id}}`, `{{henvisning}}`, `{{dato:svarfrist}}` og `{{dato:rente}}`. Datoene regnes fra brevdatoen når brevet vises.
   - Bare fakta fra saken, `[MANGLER: …]` bare for det i `plan.mangler`, og bare absolutte datoer.
5. **`kontroll.ts`** (kode) sjekker:
   - at hvert argument som må med, er dekket, og at det ikke er forbudte eller ukjente id-er
   - at hvert tall og beløp finnes i saken eller i planen
   - at datoer finnes i tidslinjen eller i planen
   - at sitater er ordrette delstrenger av kilden (normalisert), og at det ikke står «» utenfor merkene
   - at ingen setning står to ganger eller nesten likt
   - at `[MANGLER]` bare brukes for planens mangler, og at det ikke finnes andre hakeparenteser
   - at det ikke er relative tidsuttrykk
   - at brevet er under ordgrensen

   Ved avvik får forfatteren én ny runde med avvikene. Står de fortsatt, lagres brevet med avvikene som harde advarsler.
6. **Gjennomsyn** (`gjennomsyn.ts`), med Sonnet 5.5 og egen prompt uten forfatterens instruksjoner. Den vurderer brevet mot rubrikken per punkt (`oppfylt/hvorfor/setning`). Ved funn får forfatteren én runde, og så kontrolleres det på nytt. Det som står igjen, blir myke advarsler.
7. **`render.ts`** fyller inn merkene og bygger brevhodet. Den gjenbruker hodedelen fra dagens `byggBrev`. `eksport.ts` og `brevark.tsx` bruker denne.
8. **Lagring:** ny kolonne `brevsak.brev` (jsonb, Drizzle-migrering) med `{avsnitt, sitater, grunnlag (hash av sak og plan), promptversjon, skrevet, kontroll, gjennomsyn}`. Brevet er utdatert når hashen ikke stemmer med saken. Ny `BREV_VERSJON` i `prompter.ts`.
9. **Rute `POST /api/sak/[id]/skriv`** strømmer fremdrift (NDJSON) til venteskjermen. Den deler tak med dagens grenser: `MAKS_SPRAKVASK` utvides til alle AI-kall, og IP-grensen gjelder også her.

**Personvern:** modellen får aldri avsender, adresse eller regnr. Fra kildetekstene fjernes kjøperens kjente navn, adresse og regnr., i tillegg til telefon og e-post, før de sendes. Ingenting logges.

## Momentkatalog (fase 1, samme mønster som `docs/henvisninger.md`)

1. Telle `utvalgets_nokkelmomenter`, `bevistyper`, `tvistetema` og `mangelsgrunnlag` etter utfall, per feilgruppe og tidsrom, med SQL over alle vedtak.
2. `scripts/moment-kandidater.ts` (`npm run moment-kandidater`): stratifisert utvalg, cirka 250–300 forhandlersaker (vunne og tapte) per feilgruppe × tidsrom, pluss sakene per regelgrunnlag.
3. To uavhengige lesere per vedtak, én Opus og én Sonnet, leser `fulltekst_renset`. De trekker ut fakta utvalget la vekt på (for eller mot kjøperen, med sitat), argumenter som virket og hva som manglet i tapte saker. Er de uenige, avgjør en tredje. **Spør brukeren om dette skal kjøres som workflow, og hvor stort, før start.**
4. Syntesen samles i `src/lib/brev/momenter.ts` (`MOMENTER`): id, hva det gjelder, hvor ofte i vunne og tapte saker, nøytralt spørsmål med alternativer, argumentmønster og belegg i `scripts/momenter-belegg.json`.
5. En uavhengig agent kontrollerer belegget. `scripts/sjekk-momenter.ts` (`npm run sjekk-momenter`) må gi 0 feil. Metoden står i `docs/momenter.md`.
6. Brukeren går gjennom katalogen.

## Skjema og steg (fase 3)

- **Uendret:** Kjøpet, Forhandler, Vedlegg, Kravet og Om deg. Vurderingen før kjøp er også uendret.
- **Feilen:** dato og fri beskrivelse, uten AI. `src/app/brev/feilen/intervju.tsx` og `src/lib/brev/feilbeskrivelse.ts` fjernes i fase 4.
- **Før kjøpet:** egne ord (påkrevd) og «Lim inn teksten» (valgfri, ikke ved muntlig).
- **Kontakt:** valgfritt felt for å lime inn forhandlerens skriftlige svar.
- **Tilstandsrapport:** `rapport.sitat` (500 tegn) erstattes av innlimt rapporttekst (valgfri, cirka 5000 tegn).
- **Nytt siste steg «Gjennomgang»** i `lagSteg` (`src/app/brev/steg/liste.tsx`): avklaringsrunden, så venteskjermen.
- **Tekstregler som går ut av `sjekkBrev`:** `feil_kort`, `feil_med_belop`, `rapport_uten_sitat`, `rapport_sitat_uten_tid`, `tone` og `langt_brev`. De dekkes av avklaringsrunden, kontrollen og gjennomsynet. De faglige reglene blir.
- **Validering** i `utfylling.ts` (`LESERE`). **Migrering:** `feilen.avsnitt` og `fakta` blir fritekst, og `rapport.sitat` blir kildetekst.

## Brevsiden (fase 4)

- Lagret brev med brevhodet fra kode.
- `[MANGLER]` vises gult og åpner steget fra `plan.mangler`.
- Banner når brevet er utdatert, med «Skriv brevet på nytt».
- Panelet «Dette bygger brevet på» viser fakta per tema med «Endre».
- Advarsler fra `sjekkBrev`, kontrollen og gjennomsynet vises over brevet. Nedlasting med harde avvik eller utdatert brev må bekreftes.
- Motsvaret siterer rapportsitatet forfatteren valgte. Purringen er uendret.
- `byggBrev` fjernes, uten reserve.
- CLAUDE.md oppdateres:
  - «Ingen språkmodell andre steder i brevet» erstattes.
  - Avsnittene om feilbeskrivelsen og «Sjekk før sending» skrives om.
  - Nye avsnitt: Brevskriving og Momentkatalog.

## Faser (hver får egen implementeringsplan via writing-plans)

| Fase | Innhold | Avhengig av |
|---|---|---|
| 0 | Rask retting i dagens mal: `${konto}` to ganger, «hvis det sendes i dag» og «blitt verre» i `FEILEN_SJEKKLISTE`. Oppdater `brev.test.ts:376`. | Ingenting |
| 1 | Momentkatalogen | Ingenting |
| 2 | Motoren: `lagSak`, `planlegg`, forfatter, kontroll, gjennomsyn, render, gullsaker og `npm run brev-eval`. Kjøres bare fra skript. | Ingenting |
| 3 | Innsamling: kildetekster, Feilen uten AI, Gjennomgang med avklaringsrunden, migrering | 2 (og 1 for katalogen) |
| 4 | Bytte: brevsiden, eksport, motsvar, fjerning av gammel kode, CLAUDE.md | 2 og 3 |

## Tester og eval

- **Gullsaker:** `scripts/brev-eval/saker/*.json`, 15–25 oppdiktede, fullstendige saker. Hver har `{id, tittel, feller[], svar, utfylling (med kildetekster), avklaringssvar, forventet{ma[], ikke[], momenter[]}}`.
  - **Utgangspunkt:** `src/lib/vurdering/testdata/klager.json` (8 saker).
  - **Feller:**
    - feilen viste seg etter 2 år
    - forhandleren har allerede forsøkt
    - reklamert for sent
    - elbil med symptomer fra forbrenningsmotor
    - reparert før forhandleren fikk prøve
    - rapport uten tidspunkt, og parafrasert rapport
    - muntlig opplysning uten tekst
    - heving med utgifter og konto
    - kjøp før og etter 2024
    - flere feil
    - sint tekst
    - mye som mangler
- **`npm run brev-eval [-- ids] [--ganger N]`** (`scripts/brev-eval.ts`) kjører hele kjeden med ferdige avklaringssvar og skriver `docs/brev-eval/<dato>.md` med sammenligning mot forrige kjøring. Den kjøres ved hver endring i en prompt.
- **Vitest:** `brev.test.ts` og `brev-krav.test.ts` skrives om til å teste `planlegg` (samme scenarioer: må, forbudt og verdier), `kontroll` (hver type avvik) og `render` (merkene). Det er en bevisst erstatning og godkjent med denne planen. Vurderingstestene er uendret.
- **Playwright:** `e2e/registreringsflyt.spec.ts` mocker `/api/sak/[id]/avklaring` og `/skriv`.

## Verifisering

- **Fase 0:** `npm test`, deretter et brev i nettleseren (Playwright MCP) med heving, utgifter og konto. Der skal kontosetningen stå én gang og ikke «hvis det sendes i dag».
- **Fase 1:** `npm run sjekk-momenter` gir 0 feil, og brukeren har gått gjennom katalogen.
- **Fase 2:**
  - `npm test` (plan, kontroll og render).
  - `npm run brev-eval` på alle gullsaker 3 ganger. Kravene er null mekaniske avvik etter de nye rundene, alle `ma` dekket, ingen `ikke`, og ingen av de fem kjente feiltypene.
  - Les 5 brev manuelt.
- **Fase 3–4:**
  - `npm run typecheck`, `npm test` og `npm run test:e2e`.
  - Hele flyten i nettleseren: veiviser → Gjennomgang → venteskjerm → brev.
  - Endre et faktum, se banneret og skriv på nytt.
  - Last ned PDF og Word og kontroller datoene i merkene.
  - En gammel sak åpnes og migreres.

## Etter godkjenning

Designet skrives til `docs/superpowers/specs/2026-10-06-samlet-brevskriving-design.md` og committes. Deretter lages en implementeringsplan med writing-plans for fase 0 og 2 først (fase 1 kan gå parallelt).
