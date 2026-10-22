# Tvistr – datagrunnlag

Henter, klassifiserer og tolker vedtak fra Forbrukertvistutvalget og Forbrukerklageutvalget om kjøp av brukte kjøretøy (bil, varebil, bobil, campingvogn, MC), og lagrer resultatet i Postgres (tabellen `vedtak`).

## Oppsett

```bash
npm install
cp .env.example .env.local   # fyll inn verdiene under
npm run db:migrate
```

| Variabel | Brukes til |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (pooled). `DATABASE_URL_UNPOOLED` brukes av `drizzle-kit` hvis satt. |
| `ANTHROPIC_API_KEY` | Klassifisering og tolking med `claude-sonnet-5-5`. |
| `VEGVESEN_API_KEY` | Kjøretøyoppslag på regnr (`/api/kjoretoy`). |
| `CONTACT_EMAIL` | Valgfri. Legges i User-Agent (`TvistrBot/0.1 (+https://tvistr.no; e-post)`). |

## Kjøring, i denne rekkefølgen

```bash
npm run hent                     # last ned vedtak (alle arkiv) til data/raw/
npm run klassifiser              # gjelder saken kjøp av brukt kjøretøy?
npm run tolk                     # strukturert uttrekk til tabellen vedtak
npm run feilvurdering:hent -- --mangler   # inn-filer for agentene (data/feilvurdering/inn/)
# kjør workflowen scripts/workflows/uttrekk.js i Claude Code med oppgave feilvurdering og id-listen fra data/feilvurdering/lister/
npm run feilvurdering:importer   # kontroller svarene og skriv feilvurdering + søkekolonner til vedtak
```

Nyttige valg:

- `hent -- --arkiv hist|prod|wp|alle --grense N` – begrens arkiv og antall nye nedlastinger. `--uten-liste` hopper over gjennomgang av listesider, `--bare-liste` registrerer saker uten å laste ned.
- `klassifiser -- --grense N --spredt` – `--spredt` velger dokumenter jevnt fordelt over årene (brukt i piloten).
- `tolk -- --grense N --spredt --på-nytt --id 12,34` – `--på-nytt` tolker også vedtak som allerede er tolket (f.eks. etter ny promptversjon), `--id` tolker bestemte `kildedokument`-id-er.
- `--samtidig N` (klassifiser/tolk) – antall parallelle API-kall, standard 6.

## Gjenoppta en kjøring

Alle skript tåler avbrudd (Ctrl-C) og kan kjøres på nytt uten duplikater:

- **hent** lagrer status per sak i `kildesak` (`ny`, `hentet`, `feilet`, …). En ny kjøring hopper over ferdige saker og prøver feilede opptil 3 ganger. Dokumenter er unike på URL og sha256.
- **klassifiser** tar bare dokumenter med status `hentet`; **tolk** bare `klassifisert` bruktbilvedtak. Feil lagres i `kildedokument.feilmelding` og prøves igjen ved neste kjøring.
- **tolk** skriver med upsert på `kildedokument_id`, så en ny tolking erstatter den gamle.

## Sikkerhetskopi

Tolkingen koster penger å gjenta, så ta en kopi før alt som skriver over data (`tolk --på-nytt`, ny promptversjon, migreringer):

```bash
npm run db:backup                                   # → backup/tvistr-<UTC-tid>.json.gz, kontrollert mot databasen
npm run db:restore -- backup/<fil>.json.gz          # inn i tomme tabeller med samme migreringer
npm run db:restore -- backup/<fil>.json.gz --overskriv   # tømmer tabellene først
```

`backup/` ligger i `.gitignore`. Filene er renset for personnavn, men bør likevel lagres privat (f.eks. kryptert disk eller privat skylagring). Rå PDF-er i `data/raw/` kan lastes ned på nytt med `hent`, men det tar flere timer.

## Høflighet mot kildene

Maks én forespørsel annethvert sekund (hele prosessen), stadig lengre pauser ved feil/429/5xx, og stopp ved innlogging eller captcha. robots.txt følges, med ett dokumentert unntak: `innsyn.onacos.no` forbyr alt, men prosjekteier har valgt å hente derfra (se `src/lib/crawler/http.ts`). Kjør aldri to `hent` samtidig.

## Personvern

- Rå PDF-er ligger bare i `data/raw/` (i `.gitignore`), aldri i git eller databasen.
- Tekst som lagres, er renset: klageren blir `[KLAGER]`, alle andre personnavn `[PERSON]`, og adresser, regnummer, VIN, telefon og e-post byttes ut. Bare firmanavn beholdes.
- Rensingen skjer i to trinn: modellen lister personopplysningene og koden bytter dem ut (`src/lib/personvern/rens.ts`), deretter leter et uavhengig kontrollkall etter rester. Rester av personnavn gir `trenger_kontroll`.
- Skriptene skriver aldri titler, navn eller vedtakstekst til terminalen.

## Struktur

| Sti | Innhold |
| --- | --- |
| `src/db/schema.ts`, `drizzle/` | Tabellene `kildesak`, `kildedokument`, `vedtak` og migreringer |
| `src/lib/crawler/`, `src/lib/kilder/` | HTTP-klient (robots, tempo, backoff) og parsere for arkivene |
| `src/lib/ai/` | Prompter (versjonert), JSON-skjema og API-klient |
| `src/lib/personvern/rens.ts` | Rensing av personopplysninger |
| `src/lib/validering.ts` | Kontroller etter tolking (beløp, datoer, sitater) → `trenger_kontroll` |
| `src/lib/normalisering.ts` | Merke, firmanavn, org.nr. og paragrafer på fast form |
| `src/lib/brreg.ts`, `src/lib/kjoretoy/vegvesen.ts`, `src/app/api/{firma,kjoretoy}` | Oppslag mot Brreg og Statens vegvesen |
| `scripts/` | `hent`, `klassifiser`, `tolk`, `feilvurdering-*`, `migrer`, `backup`, `restore`; `workflows/uttrekk.js` (agentene for feilvurdering, avgjorende, standpunkt og rettslig) |
| `src/lib/feilvurdering/` | Instruks, kontroll og utledning for feilvurderingen (agentene leser fulltekst) |
| `src/app/sak/`, `src/lib/feil/kategorier.ts` | Skjemaet: bilen fra regnr, feilvalg (hoved- og underkategori) og telling av vedtak med medhold |

Typesjekk: `npm run typecheck`. Tester: `npm test`.
