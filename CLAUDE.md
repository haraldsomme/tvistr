@AGENTS.md

## Hva Tvistr er

Tvistr skal la en bruker fylle ut et fire-stegs skjema om et bruktbilkjøp som gikk galt, og få en vurdering av hvor god klagesak de har før de bestemmer seg for å kjøpe et profesjonelt klagebrev. Vurderingen skal bygge på de cirka 3 600 vedtakene i tabellen `vedtak` (Forbrukerklageutvalget, bruktkjøretøy). Vurderingen trenger bare et utvalg av feltene, men alle feltene i `vedtak` skal beholdes: de er grunnlag for det endelige klagebrevet.

## Tabellen `vedtak`

Inneholder ett rad per vedtak fra Forbrukertvistutvalget/Forbrukerklageutvalget (2013 →) om **kjøp av brukt kjøretøy** (personbil, varebil, bobil, campingvogn, MC/moped; ikke båt og nybil). Cirka 3 600 rader, tolket av `claude-sonnet-5-5` (`prompt_versjon`, `ai_modell` står på hver rad). Skjema: `src/db/schema.ts`. Tilgang: `import { db } from "@/db"` (Drizzle mot Neon, `DATABASE_URL` i `.env.local`). Koblet til `kildedokument` via `kildedokument_id` (kilde-URL, år, arkiv).

**Felt i grove trekk:** selger (`selger_type`, `selger_navn`, `selger_navn_norm`, `selger_orgnr`, `verksted_navn`), kjøretøy (`kjoretoytype`, `merke` normalisert, `modell`, `arsmodell`, `drivstoff`, `km_ved_kjop`, `kjopesum_nok`, `alder_ved_kjop`), tidslinje (`kjopsdato`, `forste_reklamasjon_dato`, `dager_til_reklamasjon`), avtale (`forbehold[]`), feil (`feiltyper[]`, `utbedringskostnad_nok`), bevis (`bevistyper[]`), krav (`kravtyper[]`, `prinsipalt_krav`, `krevd_*_nok`), sakens art (`mangelsgrunnlag[]`, `tvistetema[]`), utfall (`utfall`, `tilkjent_*_nok`, `enstemmig`, `dissens`), jus (`lov`, `paragrafer[]` som `fkjl § 16` / `kjl § 17` / `forsinkelsesrentelov § 2`), innhold (`sammendrag`, `utvalgets_nokkelmomenter[]`, `fulltekst_renset`), sporbarhet (`sitater` JSON, `konfidens`, `trenger_kontroll`, `kontroll_arsaker[]`, `qa_status`).

**Bruk**
- Statistikk og «lignende saker»: filtrer på `kjoretoytype`, `feiltyper`, `selger_type`, `forbehold`, `bevistyper`, `krevd_totalt_nok`. Medhold = `utfall in ('medhold','delvis_medhold')`. Se `src/lib/data/statistikk.ts` (inkl. Wilson-intervall for små grupper); `npm run rapport` skriver `docs/datagrunnlag.md`.
- Forhandleroppslag: `selger_orgnr` hvis satt, ellers `selger_navn_norm` (org.nr. står sjelden i vedtakene).
- Hvilke lover/paragrafer som brukes i lignende saker: tell `paragrafer` og `lov` for samme feiltype.
- Vis sitater fra `sitater` og lenke til `kilde_url` når tall eller utfall presenteres for en bruker.

**Begrensninger man må ta hensyn til**
- Bare saker som endte med vedtak er med (ingen forlik/trukne saker): «vinnersjanse» er sjanse *gitt vedtak*.
- `feiltyper` er feil klageren *påberopte*, ikke det utvalget godtok; vinnersjanse per feiltype er skjev oppover. `lovversjon` er nesten alltid `ukjent`.
- `trenger_kontroll = true` (cirka 10 %) betyr at et felt bør dobbeltsjekkes; se `kontroll_arsaker`. Få rader er manuelt kontrollert (`qa_status`); automatisk revisjon står i `docs/datagrunnlag.md`.
- Tekstfeltene er renset: klager = `[KLAGER]`, alle andre personer = `[PERSON]`, plassholdere for adresse/regnr/telefon. **Ikke lagre eller vis rå PDF-tekst, navn, adresser eller regnummer**; rå PDF-er ligger bare i `data/raw/` (git-ignorert).

**Vedlikehold:** `README.md` beskriver kjøringsrekkefølge (`hent` → `klassifiser` → `tolk` → `rapport`) og sikkerhetskopi (`npm run db:backup`). Ta kopi før `tolk --på-nytt`. Endres prompt eller skjema i `src/lib/ai/`, øk versjonen i `src/lib/ai/prompter.ts`.

## Tabellen `brevsak`

Én rad per reklamasjonsbrev en bruker jobber med: svarene fra vurderingsskjemaet (`svar`) og det som er fylt inn på brevsiden (`utfylling`). Skjema: `src/db/schema.ts`. All tilgang går gjennom `src/lib/brev/sak.ts`, og alt som lagres valideres i `src/lib/brev/utfylling.ts`.

- **Inneholder personopplysninger** (navn, adresse, registreringsnummer), i motsetning til `vedtak`. Derfor: tabellen er ikke med i `npm run db:backup`, ingenting fra en sak skal logges, og fritekst og navn sendes aldri til en språkmodell sammen.
- **Tilgang:** `id` er 128 tilfeldige bit og er eneste adgangskontroll (`/brev/[id]`). Ikke lag lister over saker eller ruter som slår opp på noe annet enn id.
- **Sletting:** en sak utløper 30 dager etter siste endring. Den slettes når den åpnes etter utløp, av `npm run rydd`, eller når brukeren trykker «Slett saken».

## E2E-testing med Playwright

`npm run test:e2e` kjører flytene i `e2e/` i en ekte nettleser, i desktop- og mobilbredde. `npm test` (Vitest) tester reglene i `src/lib/`; Playwright tester at siden virker for en bruker. Testene er vanlig kode og kjører uten AI.

**Hver plan for en feature som endrer noe brukeren ser, skal ha en seksjon «E2E-tester»** med scenariene som skal dekkes: hovedløpet, betingede spørsmål, feiltilstander, og hvilke eksisterende tester endringen påvirker. Scenariene godkjennes sammen med planen.

**Arbeidsgang**
1. *Plan:* scenariene skrives i planen. For større flyter utforsker `playwright-test-planner` den kjørende appen og lagrer en testplan i `specs/<feature>.md`.
2. *Underveis:* etter hver del av UI-et som er ferdig, sjekk den i nettleseren (Playwright MCP) og kjør `npm run test:e2e`. Skriv eller generer testen når UI-et finnes (`playwright-test-generator` verifiserer hvert steg mot kjørende app).
3. *Til slutt:* en feature er ikke ferdig før `npm run test:e2e`, `npm test` og `npm run typecheck` er grønne. Lim inn resultatet i oppsummeringen.
4. *Rød test:* les feilmeldingen og `test-results/` (skjermbilde, trace) før noe endres. Skyldes feilen en bevisst UI-endring, oppdateres testen (`playwright-test-healer`). Skyldes den en feil i appen, rettes appen. Forventninger skal aldri svekkes og tester aldri settes til `test.fixme`/`skip` for å få grønt; meld fra i stedet.

**Regler for testene**
- Importer `test` og `expect` fra `e2e/fixtures.ts`, og bruk sideobjektet `skjema`. Utvid det når skjemaet får nye felt.
- Finn elementer på rolle og synlig tekst (`getByRole`, `getByLabel`). `data-testid` bare når elementet ikke har rolle eller tekst.
- Bare web-first assertions (`await expect(locator)…`). Aldri `waitForTimeout` eller `networkidle`.
- Brevtestene åpner ekte saker med fixturen `sak`, som sletter dem etterpå. Oppslag mot Statens vegvesen (`/api/kjoretoy`), Brreg (`/api/firma`) og språkvasken (`/api/sak/*/sprakvask`) mockes med `page.route()`.
- Mock `/api/vurder` med `page.route()`, unntatt i flyttestene (`registreringsflyt.spec.ts`), som går mot ekte database og derfor sjekker struktur, ikke antall vedtak. Kall mot språkmodeller mockes alltid.
- `/api/vurder` tillater 10 kall per minutt per adresse. Fixturen sender en egen `x-forwarded-for` per test; behold den.
- Datoavhengige valg: bruk relative år (for eksempel i fjor) eller `page.clock.setFixedTime`.
- Testdata er oppdiktede tall. Ingen navn, adresser eller regnummer, heller ikke i `specs/`.
