# Veiviser etter kjøpet – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (valgt: gjennomføres i økten, én samlet kontroll av hele branchen til slutt). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Etter kjøpet går kjøperen gjennom alle utfyllingsstegene i en veiviser (`/brev/[id]/veiviser`). Den har intro, ett tema per skjerm i full bredde, og «Neste», «Hopp over» og «Tilbake». Til slutt kommer kjøperen til brevsiden som i dag.

**Architecture:**
- Stegene defineres ett sted (`src/app/brev/steg/liste.tsx`), og både brevsiden og veiviseren bruker definisjonen.
- Veiviseren gir knappene sine til eksisterende `Skjema` gjennom `VeiviserKontekst`.
- Intervjuet om feilen bygges inn som steg 3.
- `utfylling.gjennomgatt` styrer om `/brev/[id]` viser brevet eller sender til veiviseren.

**Tech Stack:** Next.js 16.3 App Router, React, TypeScript, Tailwind, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-veiviser-etter-kjop-design.md`

## Global Constraints

- **Tester:** ingen nye tester. `e2e/registreringsflyt.spec.ts` og `e2e/fixtures.ts` oppdateres fordi flyten er endret med vilje. Forventninger skal aldri svekkes.
- **Commits:** ingen commits uten at brukeren ber om det.
- **Stegkomponentene** (`KjopetFelt`, `ForKjopetFelt`, `KontaktFelt`, `BevisFelt`, `KravFelt`, `AvsenderFelt`) endres ikke, bortsett fra at `KjopetFelt` får et valgfritt forslag til kjøpsdato.
- **Kode:** norske navn, engelske kommentarer, stilen i filene rundt.
- **Personvern og tilgang:** id er eneste nøkkel. Sider har noindex og no-referrer.
- **Introteksten** står ordrett i spec-en (§1 Intro).

## Review Focus

Disse sjekkes manuelt i oppgave 6:
1. Kjøperen hopper over alt. Forventet: brevsiden med gule felt, og åpne steg til venstre.
2. Kjøperen avbryter midt i og åpner `/brev/[id]`. Forventet: veiviseren fortsetter på første steg som ikke er ferdig, uten intro.
3. «Endre» på feilen fra brevet. Forventet: veiviseren åpner bare steget «Feilen» og går tilbake til brevet etter lagring.
4. Forhandler-steget. Forventet: «Endre» (som tømmer verdien) i veiviseren hopper ikke videre av seg selv.
5. Steget «Kravet» etter at kontakt-steget ble hoppet over. Forventet: virker som på brevsiden (kontakt «nei» betyr retting).

---

### Task 1: `gjennomgatt` i utfyllingen
**Files:** `src/lib/brev/utfylling.ts`
- [ ] Legg til `gjennomgatt?: true` i `Utfylling` med kommentaren «The buyer has been through the wizard once; the link then opens the letter.».
- [ ] Legg til `const lesGjennomgatt = (v: unknown): true | null => (v === true ? true : null);` og `gjennomgatt: lesGjennomgatt` i `LESERE`. `Felt` tar med feltet automatisk.
- [ ] `npm run typecheck` skal være ren.

### Task 2: Én definisjon av stegene
**Files:** opprett `src/app/brev/steg/forhandler.tsx` og `src/app/brev/steg/liste.tsx`, endre `src/app/brev/brevside.tsx`
- [ ] Flytt `ForhandlerFelt` og `gruppertOrgnr` uendret fra brevside.tsx til `steg/forhandler.tsx` (eksportert, `"use client"`).
- [ ] `steg/liste.tsx`:
  ```ts
  export type StegId = "kjopet" | "forhandler" | "feilen" | "for-kjopet" | "kontakt" | "bevis" | "krav" | "avsender";
  export type StegKontekst = { sakId: string; input: KlageInput; svar: Innsending; utfylling: Utfylling; idag: string; idBase: string; forslagKjopsdato?: string | null; lagre: (l: Lagring) => Promise<boolean> };
  export type Steg = { id: StegId; tittel: string; sporsmal: string; ferdig: boolean; innhold: (f: { aktiv: boolean; avbryt?: () => void }) => ReactNode };
  export function lagSteg(k: StegKontekst): Steg[]
  ```
  `ferdig`- og `innhold`-logikken flyttes uendret fra brevside.tsx (`kjopetFerdig`, `kontaktFerdig`, `kanVelgeKrav`, `gyldigRetting`). Titlene i veiviseren (`sporsmal`) står i spec-tabellen.
- [ ] I brevside.tsx erstattes den lokale `steg`-lista med `lagSteg({...})`. `felles(stegId)` blir `{ aktiv, avbryt }`. Rendringen av `Steg` er uendret.
- [ ] `npm run typecheck` og `npm run test:e2e` (gammel flyt) skal være grønne. Brevsiden skal oppføre seg likt.

### Task 3: Knappene i veiviseren og forslag til kjøpsdato
**Files:** `src/app/brev/felt.tsx`, `src/app/brev/steg/kjopet.tsx`
- [ ] I felt.tsx:
  ```ts
  // Set by the wizard: the form's main button moves on after a save, and «Tilbake» and «Hopp over» show beside it.
  export const VeiviserKontekst = createContext<{ neste: () => void; tilbake: () => void; hoppOver: () => void } | null>(null);
  ```
  `Skjema` leser konteksten:
  - etter `const ok = await send()` kalles `veiviser.neste()` når `ok` er sann
  - knappeteksten er `veiviser && knapp === "Lagre" ? "Neste" : knapp`
  - i veiviseren vises «Tilbake» og «Hopp over» (type="button") i stedet for «Avbryt»
- [ ] `KjopetFelt` får `forslagKjopsdato?: string | null`. Startverdien blir `svar.kjopsdato || forslagKjopsdato || ""`. Feltet får hjelpeteksten «Foreslått fra Statens vegvesen: datoen bilen ble registrert på deg. Rett den hvis den ikke stemmer med kjøpekontrakten.» så lenge verdien er forslaget.

### Task 4: Intervjuet som steg
**Files:** `src/app/brev/feilen/intervju.tsx`
- [ ] Fjern siderammen (logo, `main`, h1, «Gjør dette senere») og `useRouter`. Komponenten returnerer innholdet: hjelpeteksten med feiltypene, «Trinn x av 3», skjemaboksen og feilmeldingen.
- [ ] Nye props: `lagret: (svar: Innsending | undefined, utfylling: Utfylling) => void` (kalles med PATCH-svaret, så veiviseren oppdaterer tilstanden) og `ferdig: () => void` (kalles etter lagring). Erstatter `router.push`.

### Task 5: Veiviseren og rutene
**Files:**
- opprett `src/app/brev/[id]/veiviser/page.tsx` og `src/app/brev/veiviser/veiviser.tsx`
- endre `src/app/brev/[id]/page.tsx`, `src/app/brev/[id]/feilen/page.tsx`, `src/app/brev/brevside.tsx`, `src/app/brev/steg/feilen.tsx` og `src/app/vurdering/skjema.tsx`
- [ ] **`veiviser/page.tsx`:**
  - `hentSak`, `notFound`, og videresending til `/brev/[id]` når `tilKlageInput` feiler
  - `kjopsdatoFraRegisteret` flyttes hit fra `feilen/page.tsx`
  - `searchParams` (Promise) leser `steg` og `tilbake`
  - metadata uten indeksering og uten referrer
- [ ] **`veiviser.tsx`:**
  - tilstand: `svar`, `utfylling` og `skjerm: "intro" | StegId`
  - start: `?steg=` hvis gyldig; ellers introen hvis ingen steg er ferdig; ellers første steg som ikke er ferdig; ellers siste steg
  - `lagre` sender PATCH og oppdaterer tilstanden, som brevsiden gjør
  - `neste`: neste steg, eller `slutt()` etter det siste. `slutt()` lagrer `{ gjennomgatt: true }` hvis feltet mangler og går til `/brev/[id]`. I modus `tilbake=brev` gjør `neste` det samme.
  - `tilbake`: forrige steg, eller introen. I modus `tilbake=brev` går den til brevet.
  - `hoppOver` er det samme som `neste`.
  - skjermen har ramme med logo, «Steg n av 8», h1 = `sporsmal` og innholdet i full bredde inni `VeiviserKontekst`
  - «feilen» rendres som `Intervju`
  - «forhandler» får egen navigasjon: «Neste» (aktiv når forhandler er satt), «Hopp over» og «Tilbake»
  - introen har teksten fra spec-en og «Start»
- [ ] **`[id]/page.tsx`:** `if (!sak.utfylling.gjennomgatt) redirect(\`/brev/${sak.id}/veiviser\`)`.
- [ ] **`[id]/feilen/page.tsx`:** blir bare `redirect(\`/brev/${id}/veiviser?steg=feilen&tilbake=brev\`)`.
- [ ] **brevside.tsx:** lenkene til feilen (`apneSteg`, «Endre») går til `/brev/${id}/veiviser?steg=feilen&tilbake=brev`. `steg/feilen.tsx` bruker samme adresse.
- [ ] **skjema.tsx:701:** `router.push(\`/brev/${json.id}/veiviser\`)`.
- [ ] `npm run typecheck` og `npm run lint` på filene som er endret.

### Task 6: E2E, dokumentasjon og kontroll
**Files:** `e2e/registreringsflyt.spec.ts`, `e2e/fixtures.ts`, `CLAUDE.md`
- [ ] **E2E:** etter «Betal med vipps» forventes `/brev/[id]/veiviser`, så h1 «Takk! Nå lager vi brevet ditt.», «Start», og de åtte skjermene i rekkefølge med samme verdier som før:
  - Kjøpet: dato 2024-03-12, pris 250000 og «som den er»
  - forhandler: «Testbil AS» som skrevet, deretter «Neste»
  - feilen: dato 2024-06-01, tekst, «Bruk teksten min som den er»
  - før kjøpet: Nei/Nei
  - kontakt: 2024-06-10, E-post, «vil forsøke»
  - bevis: Nei, «Bekreft vedlegg»
  - kravet: «Neste»
  - deg: navn og adresse

  Deretter forventes `/brev/[id]` og de samme kontrollene av brevet som før. Hjelperen `fixtures.ts` får `neste()`, som klikker «Neste» i veiviseren.
- [ ] **CLAUDE.md:** i avsnittet om `brevsak` beskrives veiviseren (`/brev/[id]/veiviser`, `gjennomgatt`, `steg/liste.tsx`, `VeiviserKontekst`), og punktet om feilbeskrivelsen oppdateres (steg 3 i veiviseren, `/feilen` sender videre).
- [ ] **Kjør:** `npm run typecheck && npm test && npm run test:e2e`.
- [ ] **Manuelt med Playwright MCP:** Review Focus 1–5 og mobilbredde 390 px.
- [ ] **Samlet kontroll av hele branchen** med en egen agent (den mest kapable modellen). Funnene rettes i én runde.
