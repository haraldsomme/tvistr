# Saksmappe og sterkere brev – design

Status: utkast til gjennomlesing. Dato: 2026-10-02.

## Mål

Brevsiden (`/brev/[id]`) skal være verdt 249 kr. I dag er brevet en fast mal uten bruk av de ca. 3 600 vedtakene, og salgskortet lover mer enn siden leverer (lignende saker, hva man gjør ved avvisning, PDF/Word). Vi bygger:

1. et sterkere brev (juss og krav styrt av svarene),
2. eksport til PDF og Word,
3. en **saksmappe** som bruker vedtakene til å hjelpe kjøperen å forstå, styrke og følge opp saken sin,
4. lignende vedtak som kjøperen selv velger inn i brevet (valg B: mappen forbereder kjøperen, og brevet siterer 1–3 vedtak mot forhandleren).

Utenfor omfang: betaling, e-postsending, klage til Forbrukerklageutvalget som ferdig dokument (kan senere bygges på samme data), ny tolking av vedtak (`tolk-v4`).

Suksess: en kjøper som åpner saken vet hva hun kan kreve, hva hun sannsynligvis får, hva som avgjorde lignende saker, hva forhandleren pleier å gjøre og hva hun gjør etter at brevet er sendt. Brevet er sterkere enn en gratis mal.

## Prinsipper for bruk av vedtakene

- Alle tall er *gitt vedtak* (saker som endte uten forlik eller tilbaketrekking mangler) og står alltid med antall saker.
- Små utvalg vises ikke som tall. Under en grense (n < 10 for andeler, n < 5 for forhandler og modell) står det «for få saker». Intervall er Wilson (`wilson()` i `src/lib/data/statistikk.ts`).
- `feiltyper` er feil klageren påberopte, ikke godtatte. Treff på feiltype merkes slik i grensesnittet til `godtatte_feiltyper` finnes.
- Eksempelvedtak må ha `trenger_kontroll = false`, `konfidens ≥ 0.85`, `qa_status <> 'feil'` og et sitat for utfallet. Nøkkelmomentene er modellens oppsummering av vedtaket og ikke ordrett tekst; hvert eksempel lenker til kilden (`kilde_url`) og sier «les vedtaket før du bruker det».
- Ingen rå PDF-tekst, ingen navn. `fulltekst_renset` brukes ikke i mappen.
- Mappen er avledet fra `vedtak` og saken. Navn, adresse og regnr fra `brevsak` sendes aldri til en språkmodell. Bare feilbeskrivelsen og svarene om feilen sendes, uten navn (se `2026-10-04-feilbeskrivelse-intervju-design.md`), og mappen bruker ingen modellkall.
- Juridiske formuleringer er regler i kode og skal leses av en jurist før lansering. Spec-en og sluttrapporten sier dette.

## 1. Sterkere brev

Rene regler i `src/lib/brev/brev.ts`. Nye felt i `Utfylling` (validert i `utfylling.ts`, ellers urørt):

- `bilstand?: { km: number; forbehold: "som_den_er" | "garanti" | "ingen" | "vet_ikke" }` – nytt trinn «Bilen da du kjøpte den».
- `lignende?: number[]` – vedtak-id-er (maks 3) kjøperen har valgt inn i brevet.
- `sjekket?: string[]` – avkryssede punkter i sjekklisten i mappen (maks 20, kjente nøkler).

Endringer i brevteksten:

- **Heving:** subsidiært krav om prisavslag («Dersom dere ikke godtar heving, krever jeg subsidiært prisavslag, jf. § 31»). Begrunnelse: kun 20 % av hevingskrav gir full heving, og rundt halvparten av de delvise får prisavslag.
- **Rente:** krav om forsinkelsesrente etter forsinkelsesrenteloven §§ 2–3 på beløpet fra reklamasjonsdato. Forekommer i 760 av 1 602 vunne forhandlersaker.
- **Forbehold og slitasje:** et avsnitt som møter «solgt som den er» (forbeholdet fritar ikke for plikten til å levere en bil som svarer til det som er avtalt, jf. § 3) og et avsnitt om at feilen ikke er normal slitasje for alder og km, når `lavForventning` eller `slitasjeAktuelt` gjelder. Teksten er regelbasert; ordlyden står i en egen tabell øverst i `brev.ts` for gjennomlesing.
- **Lignende vedtak:** når `lignende` er satt, ett avsnitt: «Forbrukerklageutvalget har behandlet lignende saker, blant annet [saksnr], hvor [nøkkelmoment]. Jeg viser til disse og ber om at saken løses i samsvar med dem.» Tekst hentes fra databasen på serveren ved bygging; klienten sender bare id-er. Id-ene valideres mot samme utvalgskrav som over.
- **Vedlegg:** uendret; listen inneholder bare kjøperens egne dokumenter, ikke vedtakene det vises til.

Eksisterende regler (§ 16, § 18, § 27, § 29–33, 14 dagers frist) beholdes.

## 2. Eksport

- `GET /api/sak/[id]/brev.docx` og `/brev.pdf`, generert på serveren fra `byggBrev(...)` (samme `Brev`-struktur som siden). Kun id i adressen, ingen logging av innhold.
- Word: biblioteket `docx`. PDF: `pdf-lib` med innebygd font som dekker æøå (WinAnsi), eller `pdfkit` hvis `pdf-lib` ikke holder; valget gjøres i planen etter en liten prøve.
- Plassholdere ( `[ … ]` ) gjenstår synlige i filen. Siden viser en advarsel over nedlastingsknappene så lenge noen gjenstår, men blokkerer ikke.
- Purrebrevet (steg 6, kort 6) eksporteres på samme måte: `/purring.pdf` og `/purring.docx`.

## 3. Saksmappen

Fane «Saksmappe» ved siden av «Brev» på `/brev/[id]`. Data kommer fra `GET /api/sak/[id]/mappe`, som leser saken (`hentSak`), kjører byggeren og returnerer en `Mappe`. Siden henter på nytt etter lagring av svar eller utfylling (debounce). Id er eneste adgangskontroll, som i resten av `/api/sak`.

### Struktur

```
src/lib/mappe/
  typer.ts        Mappe, Kort-typene, grenser (MIN_N)
  utvalg.ts       stige av utvalg for lignende saker (SQL-betingelser fra Faktorer + bilstand)
  hent.ts         HentMappeData-grensesnitt + ekte SQL (Drizzle mot vedtak)
  bygg.ts         byggMappe(sak, dep, idag) – ren, tar HentMappeData injisert
  kort/*.ts       ett kort per fil: styrke, belop, avgjorde, forhandler, styrk, videre
  eksempler.ts    kvalifisering og utvalg av vedtak (tester kvalitetskravene over)
src/app/brev/mappe/   UI for fanen
```

`bygg.ts` følger mønsteret til `vurder()`: avhengigheten er et grensesnitt, så enhetstester bruker faste tall og slipper databasen.

### Kortene

1. **Sakens styrke.** Antall lignende saker, andel medhold/delvis/avslag med Wilson-intervall, og en setning om hvilket trinn i stigen som ga utvalget (feiltype + tid, feiltype, alle forhandlersaker). Under `MIN_N` på spesifikt trinn faller det til neste trinn; «for få saker» bare hvis også det siste er tynt.
2. **Hva kan du få?** Median og kvartiler for tilkjent beløp i utvalget; prisavslag som andel av utbedringskostnaden (median 71 %, kvartiler 38–100 %) brukt på kjøperens oppgitte kostnad; ved hevingskrav: andel full heving mot delvis; erstatning per utgiftstype (andel tilkjent, median). En kort anbefaling om hvordan kravet bør settes opp (for eksempel «krev heving, men ta med subsidiært prisavslag») utledet av reglene i punkt 1.
3. **Hva avgjorde lignende saker?** Temaene (`tvistetema`, `bevistyper`, `mangelsgrunnlag`) som oftest følger medhold og avslag i utvalget; og 3–5 eksempelvedtak (tilsvarende `eksempler.ts`, men valgt dynamisk): saksnummer, år, utfall, tilkjent beløp, sammendrag, nøkkelmomenter, kilde-lenke. Hvert har «Ta med i brevet» som setter `lignende`.
4. **Forhandleren og bilen.** Forhandler: slått opp med `selger_orgnr` hvis kjent, ellers `selger_navn_norm` fra Brreg-navnet i saken. Vises: antall vedtak, andel medhold, siste vedtaksår, vanligste feiltyper, og en advarsel om at historikken kan være gammel. Bil: samme merke og modell (fra registeroppslaget): antall og andel. Begge skjules bak «for få saker» under `MIN_N_FORHANDLER = 3` og `MIN_N_MODELL = 5`.
5. **Styrk saken.** Sjekkliste fra `tiltak.ts` utvidet (verkstedrapport som tar stilling til tidspunkt og påregnelighet, bilder, annonse, meldinger, kontrakt, kvitteringer), hver med «x % av vunne saker hadde dette» fra `bevistyper`, rangert etter betydning. Avkryssing lagres i `sjekket`.
6. **Veien videre.** Datoer fra brevets dato: svarfrist (14 dager), tidspunkt for å gå videre til Forbrukerklageutvalget, og forventet saksbehandlingstid (konstanten `TID_TIL_VEDTAK` i `skjema.tsx` flyttes til felles kode). En svarmal for de vanligste motargumentene (slitasje, forbehold, for sen reklamasjon, «feilen oppstod etter kjøpet»), med et kort tilsvar for hvert, og et purrebrev.

### Persistens

Ingen ny tabell. `bilstand`, `lignende` og `sjekket` lagres i `brevsak.utfylling` og følger sakens levetid og slettingsregler. Mappen selv beregnes og lagres ikke.

## 4. Test

Vitest (`npm test`):
- `bygg.ts` og hvert kort med faste data: grensene (`MIN_N`), trinn i stigen, regning av beløp, ingen tall når utvalget er tynt.
- `eksempler.ts`: kvalifisering (avviser `trenger_kontroll`, lav konfidens, mangler sitat).
- `brev.ts`: nye avsnitt, subsidiært krav, rente, forbehold, `lignende`.
- `utfylling.ts`: nye felt, avvisning av ugyldig input (for mange id-er, ukjente nøkler).

Playwright (`npm run test:e2e`), nye scenarier i `specs/saksmappe.md` og tester i `e2e/saksmappe.spec.ts` og `e2e/eksport.spec.ts`:
- Hovedløp: åpne sak → fanen Saksmappe viser de seks kortene med struktur og antall (ikke bestemte tall, siden testen går mot ekte database).
- Nytt trinn «Bilen da du kjøpte den» og at det endrer brevteksten.
- «Ta med i brevet» på et eksempel gir et avsnitt i brevet med saksnummer; fjerning tar det bort.
- Avkryssing i sjekklisten overlever en reload.
- «For få saker» når utvalget er tynt (utvalget mockes via `page.route()` på `/api/sak/*/mappe`).
- Nedlasting av PDF og Word: filen finnes, ikke tom, riktig innholdstype, og advarsel ved gjenstående plassholdere.
- Mobil- og desktopbredde; ingen horisontal scrolling.
- Eksisterende `brev.spec.ts`, `bil.spec.ts`, `registreringsflyt.spec.ts` oppdateres for de nye trinnene uten å svekke forventninger.

Til slutt: `npm test`, `npm run typecheck`, `npm run test:e2e` grønne.

## 5. Rekkefølge

(a) Brev og nye trinn. (b) Eksport. (c) Saksmappen. (d) Lignende saker i brevet og purrebrev. Hvert steg testes og verifiseres i nettleseren før neste.

## Åpne risikoer

- Juridisk ordlyd må leses av jurist (se over).
- Tynne utvalg for mange biler og forhandlere; mappen sier ifra i stedet for å vise tall.
- Nøkkelmomentene er AI-utledede; kilde-lenke og advarsel følger hvert eksempel.
- `feiltyper`-treff er skjeve oppover til `godtatte_feiltyper` er laget.
