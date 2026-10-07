# Bytte til det skrevne brevet (fase 4) – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (valgt: gjennomføres i økten). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Brevsiden, filene og motsvaret bruker brevet som er skrevet av AI. Det skrives etter Gjennomgang, med en venteskjerm, og lagres med saken. Når saken endres etter at brevet er skrevet, viser siden et banner med knappen «Skriv brevet på nytt». Malen `byggBrev`, intervjuet og ruten for feilbeskrivelsen fjernes.

**Architecture:**
- **Lagring:** `utfylling.brev` (`LagretBrev`) holder `utkast`, `avvik`, `funn`, `grunnlag`, `versjon`, `skrevet` og `modell`. Feltet settes bare av serveren, som `sprakvask`, og er ikke med i `Felt`.
- **Skriving:** `POST /api/sak/[id]/skriv` strømmer fremdriften som NDJSON og avslutter med den lagrede utfyllingen.
- **Visning:** siden bygger det synlige brevet med `skrevetBrev(utkast, planlegg(m), m, idag)`. Når `grunnlagFor(m, plan) !== brev.grunnlag`, er brevet utdatert.

**Tech Stack:** Next.js 16 route handlers (strømmende `Response` på Node; les `node_modules/next/dist/docs/` om streaming og `maxDuration` før oppgave 2), React og Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-samlet-brevskriving-design.md` (Brevsiden, fase 4).

## Global Constraints

- **Ruling – lagring:** spec-en sier «ny kolonne `brevsak.brev`». Brevet lagres i stedet i `utfylling.brev` (jsonb), som allerede inneholder serverfeltet `sprakvask`.
  - Det gir ingen databasemigrering mot Neon, og ingen endring i `db:backup`, `rydd` eller sletting.
  - Siden kan ikke sette feltet, fordi `Felt` utelater det.
  - Hvis feil: brevet kan flyttes til en egen kolonne senere med en migrering som leser feltet ut av utfyllingen.
- **Personvern:**
  - Modellen får det samme som i fase 2. Avsender, regnr., kontonummer og e-post settes inn av koden.
  - Ingenting logges.
- **Grenser:**
  - `MAKS_SPRAKVASK` økes til 40 og teller alle modellkall: avklaringen teller 1, og skrivingen teller `kall`, høyst 5 per brev.
  - Per IP: `lagGrense({ antall: 3, vinduMs: 60_000 })` for `/skriv`.
  - `export const maxDuration = 300`.
- **Ingen reserve:** `byggBrev` fjernes. Før brevet er skrevet, viser siden «Brevet er ikke skrevet ennå» med en knapp, ikke malen.
- **Tester:**
  - `brev.test.ts` og `brev-krav.test.ts` tester ordlyden i malen og forsvinner med den. Scenarioene som ikke alt er dekket av `planlegg`, flyttes inn i `brevplan.test.ts`: forbehold før og etter 2024, slitasje, valg av vedlegg og uriktig opplysning uten tekst.
  - Playwright mocker `/avklaring` og `/skriv`.
- **Kode:** stilen rundt. Commit når en oppgave er ferdig.

## Review Focus

1. **Skrivingen feiler midt i** (API-feil, avvist, tidsavbrudd). Siden viser feilmeldingen og beholder forrige brev, og «Prøv igjen» virker (oppgave 2 og 3).
2. **Kjøperen endrer et faktum etter at brevet er skrevet.** Banneret vises. Nedlasting av det gamle brevet må bekreftes. Etter ny skriving forsvinner banneret (oppgave 3).
3. **Skrivingen startes to ganger** (dobbeltklikk, eller dobbel effekt i utvikling). Bare ett kall skal gå. Det sikres med `useRef`-vakt og en lås per sak på serveren via `sprakvask`-tellingen (oppgave 3).
4. **Brev med `[MANGLER: …]`.** Den gule markeringen åpner riktig steg via `plan.mangler`, og filen beholder hakeparentesene (oppgave 3 og 4).
5. **Gamle saker uten skrevet brev og uten `avklart`.** Siden viser knappen «Skriv brevet» og en lenke til Gjennomgang. Ingenting krasjer (oppgave 3).

---

### Task 1: Datamodell og hjelpere
**Files:** `src/lib/brev/utfylling.ts`, `src/lib/brev/sak.ts`, `src/lib/brev/skriving/kjede.ts`, `src/lib/ai/klient.ts`
- [ ] **`utfylling.ts`:**
  - `export type LagretBrev = { utkast: Utkast; avvik: Avvik[]; funn: Funn[]; grunnlag: string; versjon: string; skrevet: string }`. Typene importeres fra `./skriving/typer` med `import type`.
  - `brev?: LagretBrev` i `Utfylling`.
  - `Felt` utelater også `"brev"`.
  - `MAKS_SPRAKVASK = 40`.
- [ ] **`sak.ts`:**
  - `tellSprakvask(sak, antall = 1)`.
  - `lagreBrev(id, brev: LagretBrev): Promise<Utfylling>` setter `utfylling.brev` med `jsonb_set` (eller `||`) og oppdaterer `endret` og `utloper`.
- [ ] **`brev.ts`:** `brevFraSak(sak, idag): Brev | null`, som bygger `lagSaksmodell`, så `planlegg`, så `skrevetBrev` fra `utfylling.brev`. Den gir null uten brev eller ved ugyldige svar. Den er ren, slik at siden og filene bruker samme kode. Legg den i `src/lib/brev/skriving/render.ts`.
- [ ] `npm run typecheck`. Commit.

### Task 2: Ruten `POST /api/sak/[id]/skriv`
**Files:** `src/app/api/sak/[id]/skriv/route.ts`
- [ ] Les først om strømmende svar og `maxDuration` i `node_modules/next/dist/docs/`.
- [ ] **Flyten:**
  1. Grense per IP.
  2. `hentSak`, og 404 hvis saken ikke finnes.
  3. `sprakvask + 5 > MAKS_SPRAKVASK` gir 429.
  4. `lagSaksmodell`, og 400 hvis den ikke er ok.
  5. Svaret er en `ReadableStream` med NDJSON. For hver `fremdrift` fra `skrivBrevFor(m, f => skriv({ fremdrift: f }))` sendes én linje.
  6. Etterpå: `tellSprakvask(sak, s.kall)`, så `lagreBrev(id, {…})`, så `skriv({ ferdig: true, utfylling })`.
  7. Ved feil: `skriv({ feil: "…" })`, uten innhold fra saken i loggen.
- [ ] `export const maxDuration = 300`.
- [ ] Sjekk med `curl -N` mot dev-serveren på en sak laget i nettleseren, én gang (rundt 0,1 USD). Commit.

### Task 3: Brevsiden
**Files:** `src/app/brev/brevside.tsx`, `src/app/brev/brevark.tsx`, ny `src/app/brev/skriving.tsx` (venteskjerm og hook)
- [ ] **`useSkriving(id)`:** `{ skriv(): Promise<Utfylling | null>, fremdrift, feil, skriver }`. Den leser NDJSON-strømmen og har en `useRef`-vakt mot dobbel start.
- [ ] **I `BrevSide`:**
  - `m` lages med `lagSaksmodell` fra svarene og utfyllingen, deretter `plan = planlegg(m)` og `brev = utfylling.brev ? skrevetBrev(utfylling.brev.utkast, plan, m, idag) : null`.
  - `utdatert = !!utfylling.brev && grunnlagFor(m, plan) !== utfylling.brev.grunnlag`.
  - **Uten brev:** et kort med «Brevet er ikke skrevet ennå» og knappen «Skriv brevet». Er ikke `avklart` satt, vises også «Gå gjennom spørsmålene først» med lenke til `?steg=gjennomgang&tilbake=brev`. Når `avklart` er satt og det ikke finnes noe brev, starter skrivingen av seg selv, én gang (useRef).
  - **Under skrivingen:** venteskjerm i brevkolonnen med «Skriver brevet …», «Kontrollerer …», «Leser gjennom …» og «Retter …», og at det tar 1–2 minutter.
  - **Utdatert brev:** banner med «Du har endret opplysninger etter at brevet ble skrevet.» og knappen «Skriv brevet på nytt».
  - **Advarsler:**
    - `plan.advarsler` (fra `sjekkBrev`)
    - `brev.avvik` som harde, med teksten «Brevet har en feil vi ikke klarte å rette: …»
    - `brev.funn` som myke merknader
  - **Nedlasting må bekreftes** når brevet har `[MANGLER`, har harde advarsler eller avvik, eller er utdatert.
  - **Gule felt:** `Brevark` får `stegFor(tekst)` fra `plan.mangler`, slik at `[MANGLER: x]` åpner riktig steg.
  - **«Feilen»:** åpnes som de andre stegene, ikke i veiviseren lenger. `feilenAdresse` fjernes.
  - **Overskriften** på listen blir «Dette bygger brevet på».
- [ ] **Gamle saker:** `alleredeFerdig` regnes ut fra om brevet finnes, ikke fra `byggBrev`.
- [ ] Sjekk i nettleseren (Playwright MCP) med en ekte sak: veiviseren, Gjennomgang, skrivingen og brevet. Endre så et faktum, se banneret, og skriv på nytt. Kostnaden er rundt 0,3 USD. Commit.

### Task 4: Filer, purring og motsvar
**Files:** `src/lib/brev/dokument.ts`, `src/lib/brev/purring.ts`, `src/lib/brev/motsvar.ts`, `src/app/api/sak/[id]/dokument/[fil]/route.ts`
- [ ] **`brevForSak(sak)`** bruker `brevFraSak`. Uten brev svarer ruten 409 med «Brevet er ikke skrevet ennå.»
- [ ] **`byggPurring`** bruker `brevhode` i stedet for `byggBrev`, slik at purringen virker også før brevet er skrevet.
- [ ] **`motsvar(f, u)`:** rapporten siteres med sitatet forfatteren valgte (`u.brev?.utkast.sitater.find(s => s.kilde === "rapport")`). Er det ingen slik, siteres `u.rapport?.sitat`, og ellers ingenting.
- [ ] `npm run typecheck`. Commit.

### Task 5: Fjerne malen og intervjuet
**Files:** `src/lib/brev/brev.ts`, `src/lib/brev/sjekk.ts`, `src/lib/brev/brev.test.ts`, `src/lib/brev/brev-krav.test.ts`, `src/lib/brev/skriving/brevplan.ts`, `src/lib/brev/feilbeskrivelse.ts`, `src/app/brev/feilen/intervju.tsx`, `src/app/api/sak/[id]/feilen/route.ts`, `src/lib/ai/prompter.ts`
- [ ] **`brev.ts`:** behold `JURIDISK`, `brevhode`, `harFatt`, `kreverPenger`, `vedleggFor`, `vedleggBrevetByggerPa`, `VEDLEGG_NAVN`, `norskDato`, `plussDager`, `kroner`, `liste`, `MANEDER`, `UTGIFT`, `utenSluttegn`, `harPlassholder` og konstantene. Fjern `byggBrev` og hjelperne for avsnittene (`kjopetOgFeilen`, `mangelOgBevisbyrde`, `innvendinger`, `historikk`, `krav`, `erstatningOgForbehold`, `henvisningFor` hvis den ikke brukes) og plassholderne for malen.
- [ ] **`sjekk.ts`:** fjern tekstreglene (`feil_kort`, `feil_med_belop`, `feil_motsier_kontakt`, `rapport_uten_sitat`, `rapport_sitat_uten_tid`, `tone`, `langt_brev`) og importen av `byggBrev`. `TEKSTREGLER` i `brevplan.ts` fjernes.
- [ ] **Tester:** flytt scenarioene som ikke alt er dekket, til `brevplan.test.ts`, som tester for føringene og forbudene, med test først mot den eksisterende `planlegg`. Det gjelder `forbehold` for som_den_er før og etter 2024 og for garanti, at `slitasje` gjelder rust og ikke km_service, at `vedlegg` gir kjøpekontrakt, verkstedrapport og faktura ved reparasjon andre steder, og at en uriktig opplysning uten tekst gir en plassholder. Slett `brev.test.ts` og `brev-krav.test.ts`.
- [ ] **Slett:** `feilbeskrivelse.ts`, `feilen/intervju.tsx`, `api/sak/[id]/feilen/route.ts`, og `FEILEN_SPORSMAL_SYSTEM`, `FEILEN_SKRIV_SYSTEM` og `feilenBruker` fra `prompter.ts`. `FEILEN_SJEKKLISTE` blir, fordi avklaringen bruker den. `/brev/[id]/feilen/page.tsx` sender fortsatt videre.
- [ ] `npm run typecheck`, `npm test` og `npx eslint src`, uten nye feil. Commit.

### Task 6: Playwright, dokumentasjon og eval
**Files:** `e2e/registreringsflyt.spec.ts`, `CLAUDE.md`, `README.md` (hvis den beskriver brevet)
- [ ] **Playwright:** etter «Se brevet» skal testen mocke `/skriv` med NDJSON. Det gir fremdriftslinjer og til slutt `{ferdig, utfylling}`, der `brev.utkast` er et kort, oppdiktet brev som inneholder «selges «som den er», har ingen virkning». Testen sjekker at brevet vises med avsender, forhandler og emne fra koden.
- [ ] **`CLAUDE.md`:** nytt avsnitt «Brevskriving» om kjeden (plan, forfatter, kontroll og gjennomsyn), lagringen i `utfylling.brev`, utdatert brev og «Skriv på nytt», merkene, `brev-eval` og at promptversjonen økes. Avsnittene om brevet, «Sjekk før sending», «Henvisning i brevet» (form i brevet) og «Tester» oppdateres. Tekster som nevner `byggBrev`, «gule felt» fra malen og intervjuet fjernes.
- [ ] **Avsluttende `npm run brev-eval`** én gang, rundt 1,5 USD, og les rapporten.
- [ ] `npm run typecheck`, `npm test` og `npm run test:e2e` skal være grønne. Commit.
