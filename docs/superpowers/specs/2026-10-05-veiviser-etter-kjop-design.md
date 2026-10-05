# Veiviser etter kjøpet – design

Status: til gjennomgang 2026-10-05.

## Kontekst

Etter betaling kommer kjøperen i dag først til siden for feilen (`/brev/[id]/feilen`, se `2026-10-04-feilbeskrivelse-intervju-design.md`). Deretter kommer kjøperen til brevsiden, med åtte utfyllingssteg i en smal venstrekolonne ved siden av et brev fullt av gule felt. Stegene er: Kjøpet, Forhandler, Feilen, Før kjøpet, Kontakt med forhandleren, Bevis og vedlegg, Kravet, Deg. Dette blir rotete. Kjøperen ser et halvferdig brev mens opplysningene fortsatt samles inn, og skjemaene har dårlig plass.

**Mål:**
- Rett etter kjøpet går kjøperen gjennom alle stegene i en veiviser, med ett tema per skjerm i full bredde.
- Veiviseren starter med en takk og en forklaring.
- Brevet vises først når veiviseren er ferdig.
- Deretter står stegene til venstre for brevet som i dag, så svarene kan endres.

**Beslutninger (brainstorming 2026-10-05):**
- Alle steg kan hoppes over. Det som mangler, står gult i brevet og som åpne steg på brevsiden. Ingen blir sittende fast fordi de mangler for eksempel kjøpekontrakten.
- Brevet vises først til slutt, ikke ved siden av eller som forhåndsvisning underveis.
- Veiviseren får en egen rute, `/brev/[id]/veiviser` (løsning A), ikke en modus på brevsiden (B) eller bare en intro på dagens side (C).
- Introteksten lover ikke bedre sjanse for medhold. Det kan vi ikke dokumentere (markedsføringsloven).

## 1. Flyt

```
vurdering → «Kjøp brevet» → POST /api/sak → /brev/[id]/veiviser (intro → 8 skjermer) → /brev/[id]
```

- `src/app/vurdering/skjema.tsx` sender til `/brev/[id]/veiviser` når saken er opprettet.

### Intro
> **Takk! Nå lager vi brevet ditt.**
> Vi stiller deg noen spørsmål om kjøpet, feilen og hva som har skjedd siden. Svarene blir til brevet, så ta deg god tid og svar så presist du kan. Har du kjøpekontrakten, annonsen og meldingene med forhandleren for hånden, går det raskere. Det tar omtrent 10–15 minutter. Det du ikke vet nå, kan du hoppe over og fylle ut senere.
> [Start]

### Skjermene
Hver skjerm bruker full bredde og har en stor tittel i samme stil som vurderingen, en fremdriftslinje («Steg 3 av 8») og stegkomponenten fra brevsiden.

| # | id | Tittel i veiviseren | Tittel på brevsiden |
|---|---|---|---|
| 1 | `kjopet` | Om kjøpet | Kjøpet |
| 2 | `forhandler` | Hvem kjøpte du bilen av? | Forhandler |
| 3 | `feilen` | Beskriv feilen | Feilen |
| 4 | `for-kjopet` | Hva visste du før kjøpet? | Før kjøpet |
| 5 | `kontakt` | Har du tatt opp feilen med forhandleren? | Kontakt med forhandleren |
| 6 | `bevis` | Hva har du av dokumentasjon? | Bevis og vedlegg |
| 7 | `krav` | Hva krever du? | Kravet |
| 8 | `avsender` | Hvem sender brevet? | Deg |

**Knapper:**
- **«Neste»** lagrer steget med eksisterende `PATCH /api/sak/[id]` og går videre. Har et steg et eget navn på knappen, beholdes det (for eksempel «Bekreft vedlegg»).
- **«Hopp over»** går videre uten å lagre.
- **«Tilbake»** går til forrige skjerm, eller til introen fra steg 1.

**Andre regler:**
- **Steg som allerede er besvart,** for eksempel fra vurderingen eller fra et tidligere besøk, vises med svarene fylt inn.
- **Steget «Feilen»** er intervjuet med sine tre trinn som i dag: skriv, oppfølgingsspørsmål, utkast. «Sett inn i brevet» og «Bruk teksten min som den er» lagrer og går videre. Kjøpsdatoen spørres om i dette steget bare når den mangler, med forslag fra Statens vegvesen som i dag. Steg 1 vil vanligvis allerede ha den.
- **Steget «Kravet»** avhenger av svaret i «Kontakt med forhandleren» (`retting`) som på brevsiden. Rekkefølgen sikrer at kontakt kommer først.
- **Feil ved lagring** vises på skjermen, og kjøperen blir stående på steget.

### Slutt
- Etter steg 8, også når det hoppes over, lagres `utfylling.gjennomgatt = true`, og kjøperen sendes til `/brev/[id]`.
- Brevsiden er som i dag: stegene til venstre og brevet til høyre. Det som ble hoppet over, står gult i brevet og som åpne steg.

### Senere besøk
- `/brev/[id]` uten `gjennomgatt` sender til `/brev/[id]/veiviser`. Veiviseren åpner da på første steg som ikke er ferdig, og hopper over introen når minst ett steg er ferdig.
- `/brev/[id]` med `gjennomgatt` viser brevsiden som i dag.

### Endre etterpå
- På brevsiden endres stegene i venstrekolonnen som i dag.
- **Unntak, «Feilen»:** «Endre» og et klikk på det gule feltet åpner `/brev/[id]/veiviser?steg=feilen&tilbake=brev`. Veiviseren viser da bare det steget og går tilbake til brevet etter lagring, eller med «Tilbake til brevet».
- `/brev/[id]/feilen` sender til samme adresse, så eldre lenker fortsatt virker.

### Når svarene må rettes
Gir svarene ikke lenger et brev (`tilKlageInput` feiler, typisk femårsfristen), sender veiviseren til `/brev/[id]`, som allerede viser «Svarene dine må rettes».

## 2. Kodestruktur

- **`src/app/brev/steg/liste.tsx` (ny):** én definisjon av stegene for både brevsiden og veiviseren. Per steg: `id`, `tittel` (brevsiden), `sporsmal` (veiviseren), `ferdig` og `innhold`. `innhold` får de felles egenskapene (`aktiv`, `lagre`, `avbryt`) og konteksten (`input`, `svar`, `utfylling`, `idag`, `sakId`). Logikken flyttes uendret ut av `brevside.tsx`, inkludert `kjopetFerdig`, `kontaktFerdig` og `kanVelgeKrav`.
- **`src/app/brev/steg/forhandler.tsx` (ny):** `ForhandlerFelt` flyttes ut av `brevside.tsx` uten endringer.
- **`VeiviserKontekst` (i `felt.tsx`):** når konteksten finnes, viser `Skjema` «Neste» i stedet for standardknappen «Lagre», og i tillegg «Tilbake» og «Hopp over». «Avbryt» vises ikke i veiviseren.
  - Forhandler-steget lagrer når kjøperen velger, uten `Skjema`. Veiviseren går da videre etter lagring og viser «Tilbake» og «Hopp over» selv.
  - Stegkomponentene ellers endres ikke.
- **Feilen:** `src/app/brev/feilen/intervju.tsx` deles i to.
  - **`Intervju`** er selve innholdet med de tre trinnene. Det får `ferdig: () => void` i stedet for `router.push`, og ingen sideramme.
  - **Rammen** (logo, h1, «Gjør dette senere») flyttes til veiviseren. «Gjør dette senere» blir veiviserens «Hopp over».
- **`src/app/brev/[id]/veiviser/page.tsx` (ny):** serverkomponent.
  - `hentSak`, `notFound`, og videresending til `/brev/[id]` når `tilKlageInput` feiler.
  - Forslag til kjøpsdato fra Vegvesen (flyttes fra `feilen/page.tsx`).
  - Metadata uten indeksering og uten referrer.
- **`src/app/brev/veiviser/veiviser.tsx` (ny):** klientkomponent med intro, skjerm per steg, fremdrift, «Neste», «Hopp over», «Tilbake» og slutt. Den holder `svar` og `utfylling` i state og oppdaterer dem fra PATCH-svaret som brevsiden gjør. `?steg=` og `?tilbake=brev` leses fra adressen.
- **`src/app/brev/[id]/feilen/page.tsx`** blir en videresending.
- **`src/app/brev/[id]/page.tsx`** sender til veiviseren når `gjennomgatt` mangler.
- **`src/app/brev/brevside.tsx`** bruker `steg/liste.tsx`. «Endre» og plassholderen for feilen åpner veiviseren på steget «Feilen» (avsnitt 1).

## 3. Data

- `Utfylling` får `gjennomgatt?: true`. Feltet tas med i `Felt` og i `LESERE` (`lesGjennomgatt`: bare `true` godtas).
- Ingen migrering. Saker uten feltet går én gang gjennom veiviseren, og kjøperen kan hoppe over alt.

## 4. Testing og verifisering

- **Tester:** ingen nye tester (CLAUDE.md).
- **E2E:** `e2e/registreringsflyt.spec.ts` skrives om til den nye flyten, siden flyten er endret med vilje: intro, «Start», de åtte skjermene med «Neste» (Feilen med «Bruk teksten min som den er», ingen modellkall), og så brevsiden uten `[Beskriv feilen`. `e2e/fixtures.ts` får hjelpere for veiviseren i stedet for `brev.steg(...)` der det trengs.
- **Vitest:** brevtestene påvirkes ikke.
- **Manuelt med Playwright MCP:**
  - hopp over alt, og se at brevet har gule felt og åpne steg
  - «Tilbake» viser lagrede svar
  - avbryt midt i, åpne `/brev/[id]` og fortsett på første steg som ikke er ferdig
  - «Endre» på feilen fra brevet går tilbake til brevet
  - en sak med `gjennomgatt` åpner brevet direkte
  - mobilbredde 390 px uten vannrett rulling

## 5. Utenfor denne omgangen

- Forhåndsvisning av brevet under veiviseren.
- Lagring av hvilke steg som er hoppet over. Første steg som ikke er ferdig, er godt nok for å fortsette.
- Endringer i spørsmålene i hvert steg.
