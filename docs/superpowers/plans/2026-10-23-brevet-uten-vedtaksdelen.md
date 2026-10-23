# Rettinger etter brukertesten (utenom vedtaksdelen) – gjennomføringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjerne de feilene fra brukertesten 2026-10-23 som gjør at et betalt brev sier noe usant eller mangler noe en jurist ville sagt, uten å røre rangeringen, valget og sammenligningen med vedtaket (egen runde).

**Architecture:** Alt skjer i den rene logikken (`src/lib/app/`), skjemaet (`src/app/sak/skjema/`) og betalingen (`src/lib/vipps/`). Brevet bygges fortsatt bare av felt og tabellen `PARAGRAFER`; nye setninger får nye nøkler der. Feilene får én datapost per feil (`feilposter`) som brevet, vurderingen og rangeringens svar leser i stedet for å lese `f_area` hver for seg.

**Tech Stack:** Next 16 (app router, server actions), React 19, TypeScript, Vitest (`npm test`), Playwright (`npx playwright test`), Drizzle mot Neon.

**Spec:** `tmp-ux/RAPPORT.md` (samlerapporten) med `tmp-ux/<tester>/rapport.md` som belegg. Funnene det vises til under heter «Blocker 1», «Major 5» osv. som der.

## Global Constraints

- Ingenting i `src/lib/matching/`, `src/lib/vedtaksvalg/`, `slutning()` i `brev.ts` eller `vekter.ts` endres: det er neste runde.
- Brevet skriver aldri en setning som ikke følger av et felt eller av lovteksten (CLAUDE.md, «aldri si noe usant»). Paragrafer hentes bare fra `PARAGRAFER` i `src/lib/brev/paragrafer.ts`; en ny nøkkel må ha kilde (lovdata.no med dato) i kommentaren, og `null` når teksten ikke er kontrollert.
- Nye norske setninger i brevet og vurderingen er forslag: eieren godkjenner ordlyden før de merges (språkvask med godkjenning). Skriv dem slik planen sier, og merk commit-meldingen med «ordlyd til godkjenning».
- Vektene i vurderingen er satt fra vedtakene (`docs/ferdigkriterier.md`). Endres en vekt (oppgave 1), kjøres `npm run vurdering:kalibrer` etterpå, og tallene føres inn i `docs/ferdigkriterier.md` under «Vurderingen». Er et krav rødt, rapporteres det og arbeidet stopper; vekten justeres ikke for å få det grønt.
- Ingen persondata i logger eller i tabellen `hendelse`. Testdata i tester er fiktive.
- Hver oppgave avsluttes med `npm test` grønt og `npm run typecheck` rent. Snapshotet `src/lib/app/__snapshots__/brev.test.ts.snap` oppdateres bare når eksempelbrevet skal endres, og diffen leses.
- `docs/app.md` oppdateres i samme commit som en endring i flyt eller brev (seksjonene «Sjekken», «Vurderingen», «Brevet», «Betaling»).

## Review Focus

- En sak uten tidligere varsel der oppdagelsen er over to måneder før brevdatoen: vurderingen må ikke si «God sak» uten en rad som sier at reklamasjonen er sen, og brevet må si noe om fristen (oppgave 1, test «sen første reklamasjon»).
- En kjøper som svarte «Vet ikke» om «som den er» og så betaler: ingen tekst noe sted må påstå at bilen ikke ble solgt «som den er» (oppgave 2, test «vet ikke blir null etter betaling»).
- To underkategorier i samme område med ulike datoer, der den ene er innenfor formodningen og den andre utenfor: brevet må bruke hver sin dato (oppgave 3, test «to feil i samme område på ulike datoer»).
- Bare opplysningsfeil (km-stand): brevet må ikke si at feilen «merkes under kjøring», og må ikke tilby retting (oppgave 4).
- Lagring som feiler med Drizzle-feil: loggen må ikke inneholde skjemaet (oppgave 7, test «params logges ikke»).

---

### Oppgave 1: Ærlig om en sen reklamasjon og om unntaket fra fristene

Funn: Blocker 1 (b-toyota), Blocker 4 (e-focus pass 2), Major 11 delvis.

**Files:**
- Create: `src/lib/app/feil.ts` (hjelperen `feilposter`, som oppgave 3 bygger ut)
- Modify: `src/lib/brev/paragrafer.ts` (`POENG`, `PARAGRAFER`)
- Modify: `src/lib/app/vurdering.ts:174-182` (raden om to måneder), `src/lib/app/vurdering.ts:138-146` (fristen ute med unntak)
- Modify: `src/lib/app/brev.ts:275-317` (tidsavsnittet)
- Test: `src/lib/app/vurdering.test.ts`, `src/lib/app/brev.test.ts`, `src/lib/brev/paragrafer.test.ts` (finnes den ikke: lag den)
- Modify: `docs/app.md` («Vurderingen», «Brevet»), `docs/ferdigkriterier.md` («Vurderingen», ny måling)

**Interfaces:**
- Produces: `export type Feilpost = { nokkel: string; hoved: string; under: string[]; found: string; desc: string; felt: string }` og `export function feilposter(s: Skjema): Feilpost[]` i `src/lib/app/feil.ts`. I denne oppgaven én post per `f_cats`-element: `nokkel = hoved`, `under = s.f_parts[hoved] ?? []`, `found = s.f_area[hoved]?.found ?? ""`, `desc = (s.f_catdesc[hoved] ?? "").trim()`, `felt = \`f_area.${hoved}.found\`` (merket brevet bruker på datoen).
- Produces: ny nøkkel `"reklamasjon_unntak"` i `POENG` (unntaket fra fristene: garanti for lengre tid, eller selger grovt uaktsom eller i strid med redelighet og god tro).

- [ ] **Steg 1: Skriv testene for vurderingen**

I `src/lib/app/vurdering.test.ts`:

```ts
it("sen første reklamasjon: rad med vekt", () => {
  // Oppdaget 2023-02-10, ikke sagt fra, i dag 2026-10-16: 44 måneder.
  const r = evaluate({ ...base, delivery: "2022-05-14", found: "2023-02-10" }, idag);
  const rad = r.factors.find((f) => f.t === "Reklamasjonen kommer sent");
  expect(rad?.s).toBe("bad");
  expect(rad?.w).toBe(-2);
  expect(rad?.law).toBe("forbrkjl. § 27 fjerde ledd");
});
it("mellom to og seks måneder: advarsel med vekt", () => {
  const r = evaluate({ ...base, delivery: "2026-01-10", found: "2026-06-01" }, idag);
  const rad = r.factors.find((f) => f.t === "Det har gått mer enn to måneder");
  expect(rad?.w).toBe(-1);
});
it("innen to måneder: ingen av radene", () => {
  const r = evaluate({ ...base, delivery: "2026-01-10", found: "2026-09-01" }, idag);
  expect(r.factors.some((f) => f.t === "Reklamasjonen kommer sent" || f.t === "Det har gått mer enn to måneder")).toBe(false);
});
```

- [ ] **Steg 2: Kjør testene og se at de feiler**

Run: `npx vitest run src/lib/app/vurdering.test.ts`
Expected: FAIL (ingen rad «Reklamasjonen kommer sent», og raden om to måneder har ingen `w`).

- [ ] **Steg 3: Legg nøkkelen til i paragraftabellen**

I `src/lib/brev/paragrafer.ts`: legg `"reklamasjon_unntak"` til i `POENG` med kommentaren `// the deadlines do not apply when the seller gave a longer warranty, or acted grossly negligently or in bad faith`. I begge versjonene av `PARAGRAFER`: `reklamasjon_unntak: "§ 27 fjerde ledd"`. Kontroller mot lovdata.no (gjeldende tekst og teksten før 1.1.2024, som konstanten `UNNTAK_FEM_AR` i `vurdering.ts` alt bygger på) og skriv datoen i kommentaren; stemmer ikke leddnummeret for en versjon, sett `null` der.

- [ ] **Steg 4: Raden i vurderingen**

I `evaluate` (`vurdering.ts:174-182`), i grenen uten tidligere varsel (`q.notified !== "ja"`): regn `mndSiden = ` antall kalendermåneder fra `fd` til `today` (bruk `plussManeder(q.found!, n)` mot `idag` som ellers i fila). Erstatt den siste `else`-raden med:
- `today <= lim`: uendret («Du er i tide»).
- ellers, `idag <= plussManeder(q.found!, 6)`: `{ s: "warn", t: "Det har gått mer enn to måneder", d: "Du må reklamere innen rimelig tid etter at du oppdaget feilen. Send reklamasjonen nå, og forklar i brevet hvorfor den kommer først nå.", law: L.ref("reklamasjon"), w: -1 }`.
- ellers: `{ s: "bad", t: "Reklamasjonen kommer sent", d: \`Du oppdaget feilen for ${dur(fd, today)} siden uten å si fra. Forhandleren vil trolig si at reklamasjonen kommer for sent. Da hjelper det bare om forhandleren ga uriktige opplysninger eller holdt noe tilbake, eller en garanti gir lengre frist.\`, law: L.ref("reklamasjon_unntak"), w: -2 }`.

Grenen med varsel (`nd > lim`, «Du sa fra etter mer enn to måneder») beholder teksten og får `w: -1`.

- [ ] **Steg 5: Kjør testene for vurderingen**

Run: `npx vitest run src/lib/app/vurdering.test.ts`
Expected: PASS. Retter en eksisterende test seg på en sak som nå faller et nivå, les hvorfor før forventningen endres.

- [ ] **Steg 6: Skriv testene for brevet**

I `src/lib/app/brev.test.ts`:

```ts
it("sen første reklamasjon: brevet nevner fristen og unntaket", () => {
  const s = { ...eksempel(idag), c_purchase: "2022-05-14", c_delivery: "2022-05-14", f_prior: false, seller_said: "lovet" };
  s.f_area = { hoyvolt: { found: "2023-02-10" } };
  const t = tekst(s);
  expect(t).toContain("Reklamasjonsfristen etter § 27 første ledd er «innen rimelig tid», og fristen gjelder ikke dersom selgeren har opptrådt grovt uaktsomt eller i strid med redelighet og god tro, jf. § 27 fjerde ledd.");
  expect(t).toContain("Opplysningen dere ga før kjøpet, var uriktig, og jeg gjør gjeldende at fristen av den grunn ikke er til hinder for kravet.");
  expect(t).not.toContain("er dermed rettidig");
});
it("sen reklamasjon uten løfte fra selger: bare lovens regel", () => {
  const s = { ...eksempel(idag), c_purchase: "2022-05-14", c_delivery: "2022-05-14", f_prior: false, seller_said: "nei" };
  s.f_area = { hoyvolt: { found: "2023-02-10" } };
  const t = tekst(s);
  expect(t).toContain("jf. § 27 fjerde ledd.");
  expect(t).not.toContain("gjør gjeldende at fristen");
});
it("over fem år med unntaket: brevet argumenterer unntaket", () => {
  const s = { ...eksempel(idag), c_purchase: "2021-03-01", c_delivery: "2021-03-01", c_unntak: true, f_prior: false };
  s.f_area = { hoyvolt: { found: "2026-09-01" } };
  const t = tekst(s);
  expect(t).toContain("Det er mer enn fem år siden jeg overtok bilen. Fristen på fem år gjelder likevel ikke når selgeren har påtatt seg ansvar for lengre tid ved garanti, eller har opptrådt grovt uaktsomt eller i strid med redelighet og god tro, jf. § 27 fjerde ledd. Jeg gjør gjeldende at det er tilfellet her.");
});
```

Ordlyden i de tre setningene er forslag (se Global Constraints).

- [ ] **Steg 7: Kjør testene og se at de feiler**

Run: `npx vitest run src/lib/app/brev.test.ts`
Expected: FAIL på de tre nye.

- [ ] **Steg 8: Skriv `feilposter` og bruk den i tidsavsnittet**

Lag `src/lib/app/feil.ts` etter Interfaces. I `byggBrev` (`brev.ts:275-317`): bygg `datert` fra `feilposter(s)` i stedet for fra `s.f_cats`/`s.f_area` (samme filter: dato satt, ikke før overtakelsen, ikke `opplysningsfeil(p.hoved, p.under)`), og `fe(p.felt, …)` der datoen merkes. Så, etter `rettidig`-blokken:
- `sen = found && !rettidig && nr > addMonths(found, 2)` (første feil oppdaget, reklamert med dette brevet eller det tidligere varselet).
- Når `sen` og ikke `etterFemAr`: `tid.push([…])` med setningen om § 27 første ledd og fjerde ledd (`L.par("reklamasjon")`, `L.par("reklamasjon_unntak")`), og setningen «Opplysningen dere ga …» bare når `s.seller_said === "lovet"`. Er `L.par("reklamasjon_unntak")` tom (null), skrives setningen uten «, jf. …».
- Når `etterFemAr && s.c_unntak`: `tid.push([…])` med setningen om fem år og unntaket. Uten `c_unntak` skrives som før ingenting.

Flytt hjelperen `addMonths`-sammenligningen inn i en lokal `const reklamert = nr` så begge grener bruker samme dato.

- [ ] **Steg 9: Kjør alle testene**

Run: `npm test`
Expected: PASS. Endres snapshotet, skal det bare være fordi eksempelbrevet nå har en av de nye setningene; eksempelet (`eksempel()`) reklamerer innen to måneder, så snapshotet skal være uendret.

- [ ] **Steg 10: Kalibrer og dokumenter**

Run: `npm run vurdering:kalibrer`
Expected: utskrift med andel medhold per nivå. Før tallene inn i `docs/ferdigkriterier.md` under «Vurderingen» med dato, og kravene (fallende medhold, minst 10 prosentpoeng, minst 15 % per nivå). Er et krav rødt: skriv det i rapporten til eieren og stopp denne oppgaven uten å endre vektene.

Oppdater `docs/app.md`: under «Vurderingen» de to radene og vektene; under «Brevet» at tidsavsnittet nevner § 27 fjerde ledd når reklamasjonen er sen eller fristen på fem år er ute med unntaket.

- [ ] **Steg 11: Commit**

```bash
git add src/lib/app/feil.ts src/lib/app/vurdering.ts src/lib/app/vurdering.test.ts src/lib/app/brev.ts src/lib/app/brev.test.ts src/lib/brev/paragrafer.ts docs/app.md docs/ferdigkriterier.md
git commit -m "feat: sen reklamasjon veier, og brevet nevner § 27 fjerde ledd (ordlyd til godkjenning)"
```

---

### Oppgave 2: «Vet ikke» om «som den er» overlever betalingen

Funn: Blocker 2, tredje årsak (e-focus). Bare inndata: `slutning()` og rangeringen røres ikke.

**Files:**
- Modify: `src/app/sak/[id]/actions.ts:69-71` (`finnVedtak`)
- Modify: `src/app/sak/[id]/skriver.tsx:39`, `src/app/sak/[id]/page.tsx` (send `sak.sjekk` til `Skriver`)
- Modify: `src/lib/app/vurdering.ts` (`writerQ` tar valgfri `asis`)
- Test: `src/app/sak/[id]/actions.test.ts` (finnes; se `finnVedtak`-testene), `src/lib/app/vurdering.test.ts`

**Interfaces:**
- Consumes: `hentEgenSak(id)` returnerer `Sak` med `sjekk: Sjekksvar` (`src/lib/sak/db.ts`); `Svar.somDenEr: "ja" | "nei" | null` (`src/lib/vedtaksvalg/kjoper.ts`).
- Produces: `writerQ(s: Skjema, sjekk?: Pick<Sjekksvar, "asis">): Sjekksvar` og `skriverResultat(s, idag, q?)` uendret signatur; `Skriver` får prop `sjekk: Sjekksvar`.

- [ ] **Steg 1: Skriv testene**

I `src/app/sak/[id]/actions.test.ts`, ved siden av de eksisterende `finnVedtak`-testene (bruk samme mock av `hentEgenSak`, med `sjekk: { asis: "vetikke" }` på saken):

```ts
it("vet ikke blir null etter betaling", async () => {
  // Saken ble kjøpt med asis «vetikke»; svaret fra nettleseren sier «nei» fordi skjemaet ikke kjenner «vet ikke».
  // byggSaken skal få somDenEr null, så ingen tekst sammenligner på «som den er».
  const spion = vi.spyOn(kjoper, "byggSaken");
  await finnVedtak({ id: "…", svar: { ...svarFraSkjema, somDenEr: "nei" } });
  expect(spion.mock.calls[0][0].somDenEr).toBeNull();
});
```

I `src/lib/app/vurdering.test.ts`:

```ts
it("writerQ tar asis fra sjekken", () => expect(writerQ(eksempel(idag), { asis: "vetikke" }).asis).toBe("vetikke"));
it("writerQ uten sjekk: fra skjemaet", () => expect(writerQ({ ...eksempel(idag), c_asis: true }).asis).toBe("ja"));
```

- [ ] **Steg 2: Kjør testene og se at de feiler**

Run: `npx vitest run src/app/sak/\[id\]/actions.test.ts src/lib/app/vurdering.test.ts`
Expected: FAIL.

- [ ] **Steg 3: Implementer**

I `finnVedtak`, etter `rensSvar`: `const svaret = lagret.sjekk?.asis === "vetikke" ? { ...svar, somDenEr: null } : svar;` og bruk `svaret` i `gjelderSaken` og `byggSaken`. I `writerQ`: `asis: sjekk?.asis ?? (s.c_asis ? "ja" : "nei")`. I `page.tsx`: send `sjekk={sak.sjekk}` til `Skriver`; i `Skriver`: `skriverResultat(s, idag(), writerQ(s, sjekk))`.

- [ ] **Steg 4: Kjør testene**

Run: `npm test`
Expected: PASS.

- [ ] **Steg 5: Commit**

```bash
git add src/app/sak/\[id\]/actions.ts src/app/sak/\[id\]/actions.test.ts src/app/sak/\[id\]/skriver.tsx src/app/sak/\[id\]/page.tsx src/lib/app/vurdering.ts src/lib/app/vurdering.test.ts
git commit -m "fix: «vet ikke» om som den er følger saken etter betaling"
```

---

### Oppgave 3: Én dato per feil, også i samme område

Funn: Blocker 3 og Major 11 (f-bmw-mobil).

**Files:**
- Modify: `src/lib/app/skjema.ts` (`Skjema`, `standard`, `syncAreas`)
- Modify: `src/lib/app/feil.ts` (`feilposter` deles per underkategori)
- Modify: `src/app/sak/skjema/mangelen.tsx` (`Omradekort`, `Omrader`)
- Modify: `src/lib/app/brev.ts` (Mangelen-avsnittene, `datert`, rettidighet per feil), `src/lib/app/saken.ts` (`tilSvar`, `rensSkjema`), `src/lib/app/vurdering.ts` (`writerQ`: `found`/`sist`), `src/lib/app/datoer.ts`, `src/app/sak/[id]/svarene.tsx:51`, `src/app/sak/sporsmal.ts` (`omrader.ferdig`)
- Test: `src/lib/app/feil.test.ts` (ny), `src/lib/app/brev.test.ts`, `src/lib/app/saken.test.ts`, `src/lib/app/datoer.test.ts`, `e2e/flyt.spec.ts`
- Modify: `docs/app.md` («Sjekken», «Brevet»)

**Interfaces:**
- Produces: nytt felt `f_under: Record<string, { found: string; desc: string }>` på `Skjema`, nøkkel `"hoved.under"` (for eksempel `"motor.turbo"`), standard `{}`. En underkategori med nøkkel i `f_under` er sin egen post; området beholder de andre.
- `feilposter(s)` gir postene i rekkefølgen `f_cats`, og innenfor området først de delte underkategoriene (i `HOVEDKATEGORIER`-rekkefølge), så resten av området som én post. Delt post: `nokkel = "hoved.under"`, `under = [under]`, `felt = \`f_under.${hoved}.${under}.found\``. Område uten gjenværende underkategorier etter deling gir ingen post.
- `Svar.feil` (rangeringen) får én rad per post, som i dag per område.

- [ ] **Steg 1: Skriv testene for `feilposter`**

`src/lib/app/feil.test.ts`:

```ts
const s = { ...standard(idag), f_cats: ["motor", "understell"], f_parts: { motor: ["utslipp", "turbo"], understell: ["bremser"] },
  f_area: { motor: { found: "2024-04-02" }, understell: { found: "2026-10-10" } }, f_catdesc: { motor: "Partikkelfilteret tettet seg." },
  f_under: { "motor.turbo": { found: "2025-02-18", desc: "Turboen hviner." } } };
it("deler turboen ut av motor", () => expect(feilposter(s).map((p) => [p.nokkel, p.found])).toEqual([["motor.turbo", "2025-02-18"], ["motor", "2024-04-02"], ["understell", "2026-10-10"]]));
it("området beholder resten", () => expect(feilposter(s)[1].under).toEqual(["utslipp"]));
it("uten deling: én post per område", () => expect(feilposter({ ...s, f_under: {} }).map((p) => p.nokkel)).toEqual(["motor", "understell"]));
it("alt delt: området gir ingen post", () => expect(feilposter({ ...s, f_parts: { ...s.f_parts, motor: ["turbo"] } }).map((p) => p.nokkel)).toEqual(["motor.turbo", "understell"]));
```

- [ ] **Steg 2: Kjør og se at de feiler**

Run: `npx vitest run src/lib/app/feil.test.ts`
Expected: FAIL (`f_under` finnes ikke på `Skjema`).

- [ ] **Steg 3: Feltet og hjelperen**

Legg `f_under` til i `Skjema` og `standard`. Skriv `feilposter` etter Interfaces. I `syncAreas`: `f_found` = tidligste `found` over `feilposter(s)`. I `rensSkjema` (`saken.ts`): behold bare nøkler i `f_under` der `hoved` står i `f_cats` og `under` i `f_parts[hoved]` (slettet underkategori fjerner posten).

- [ ] **Steg 4: Kjør testene**

Run: `npx vitest run src/lib/app/feil.test.ts src/lib/app/saken.test.ts`
Expected: PASS.

- [ ] **Steg 5: Skriv testene for brevet og svarene**

I `src/lib/app/brev.test.ts`:

```ts
it("to feil i samme område på ulike datoer", () => {
  const s = { ...eksempel(idag), c_purchase: "2024-01-15", c_delivery: "2024-01-15", f_cats: ["motor"], f_parts: { motor: ["utslipp", "turbo"] },
    f_area: { motor: { found: "2024-04-02" } }, f_catdesc: { motor: "Partikkelfilteret tettet seg." },
    f_under: { "motor.turbo": { found: "2025-02-18", desc: "Turboen hviner." } }, f_prior: true, f_prior_date: "2024-04-10" };
  const t = tekst(s);
  expect(t).toContain("Den 2. april 2024 oppdaget jeg feil ved utslippssystemet. Partikkelfilteret tettet seg.");
  expect(t).toContain("Den 18. februar 2025 oppdaget jeg også feil ved turboen. Turboen hviner.");
  expect(t).not.toContain("2. april 2024 oppdaget jeg feil ved turboen");
});
it("rettidig bare for feilene som ble varslet i tide", () => {
  // Samme sak: varslet 2024-04-10, åtte dager etter den første feilen, men turboen kom ti måneder senere og brevet er datert i dag.
  const t = tekst(/* saken over */);
  expect(t).toContain("Reklamasjonen på feilen ved utslippssystemet er fremsatt innen to måneder etter at jeg oppdaget den, og er dermed rettidig etter § 27 første ledd.");
  expect(t).not.toContain("Reklamasjonen er fremsatt innen to måneder etter at jeg oppdaget feilen");
});
```

I `src/lib/app/saken.test.ts`:

```ts
it("tilSvar gir én rad per feilpost", () => expect(tilSvar(saken)!.feil.map((f) => [f.hoved, f.under, f.oppdaget])).toEqual([["motor", ["turbo"], "2025-02-18"], ["motor", ["utslipp"], "2024-04-02"]]));
```

I `src/lib/app/datoer.test.ts`: en delt post med dato før overtakelsen gir «Feilen (motor og eksos: turbo) er oppdaget før du overtok bilen.».

- [ ] **Steg 6: Kjør og se at de feiler**

Run: `npx vitest run src/lib/app/brev.test.ts src/lib/app/saken.test.ts src/lib/app/datoer.test.ts`
Expected: FAIL.

- [ ] **Steg 7: Brevet, svarene, vurderingen, datoavvik**

- `brev.ts`, Mangelen: iterer over `feilposter(s)` i stedet for `s.f_cats`; `dag(p) = p.found`, `desc(p) = p.desc`, gruppering som før (samme dag, ingen beskrivelse), `funn()` får `(p.hoved, p.under)`-par i stedet for kategorier (endre signaturen til `funn(poster: Feilpost[], s)`; `feilord(p.hoved, p.under)`), og datoen merkes `fe(p.felt, …)`.
- `brev.ts`, tid: `datert` fra postene (oppgave 1 gjorde det alt). Rettidighet per post: `rettidige = datert.filter(p => nr >= p.found && nr <= addMonths(p.found, 2))`. Alle rettidige → setningen som i dag. Noen → `Reklamasjonen på ${kortNavn-ledd for postene} er fremsatt innen to måneder etter at jeg oppdaget ${én: "den" : "dem"}, og er dermed rettidig etter § 27 første ledd.` (for en delt post brukes brevformen fra `feilord(p.hoved, p.under)` med «feilen ved …»). Ingen → ingenting, og oppgave 1s sen-setning tar over bare når *ingen* post er rettidig. `svarPaInnvendinger` får `rettidig = alle rettidige`.
- Innledningen: «Jeg tok opp mangelen med dere …» uendret når minst én post ble varslet i tide; ellers «Jeg har tidligere tatt opp en mangel med dere …, og dette brevet utvider reklamasjonen til feilene under» (forslag, til godkjenning).
- `saken.ts` `tilSvar`: `feil` fra `feilposter(s)` (`hoved`, `under`, `oppdaget: p.found`, `beskrivelse: p.desc || null`); filteret «dato satt» som i dag.
- `vurdering.ts` `writerQ`: `found`/`sist` fra postene; `fysiske` uendret (per område).
- `datoer.ts`: `funnet` fra postene; navnet `navn(p)` = områdenavn, og for en delt post `"${område}: ${underkategori}"` med små bokstaver.
- `svarene.tsx:51`: «Oppdaget …» viser tidligste dato og antall poster når det er flere («3 feil, første oppdaget 2.4.2024»).
- `sporsmal.ts` `omrader.ferdig`: alle poster har dato.
- `gjelderSaken` (`saken.ts:81`) sammenligner fortsatt `f_cats`/`f_parts`; `f_under` er ikke låst.

- [ ] **Steg 8: Kjør testene**

Run: `npm test`
Expected: PASS. Snapshotet er uendret (eksempelet har én feil).

- [ ] **Steg 9: Skjermen**

I `mangelen.tsx`: når et område har minst to underkategorier, viser `Omradekort` under datoen en lenkeknapp «Oppdaget på ulike datoer? Del opp» som setter `f_under[hoved.under] = { found: a.found, desc: "" }` for hver underkategori i området (og tømmer områdets beskrivelse inn i den første). `Omrader` rendrer én `Feilkort` per post fra `feilposter(s)` (samme felter: dato og beskrivelse; overskrift «Motor og eksos · Turbo» for en delt post, «Feil i av n» teller poster) og en lenkeknapp «Slå sammen» på de delte postene som sletter nøklene for området. Behold `id`-ene `ar${i}f`/`ar${i}d` per post (e2e bruker `getByLabel("Når oppdaget du feilen?")`, som da treffer flere: se steg 10).

- [ ] **Steg 10: e2e**

I `e2e/flyt.spec.ts` legg til en test «to feil i samme område» på desktop-prosjektet: velg «Motor og eksos» med «Turbo» og «EGR, partikkelfilter, AdBlue», trykk «Del opp», fyll to datoer, og sjekk at det sladdede brevet har to «Den … oppdaget jeg»-avsnitt (`.fl-ark` inneholder begge datoene). Ingen betaling i denne testen.

Run: `npx playwright test --project=desktop`
Expected: 3 passed.

- [ ] **Steg 11: Dokumenter og commit**

`docs/app.md` «Sjekken» (kortet per område kan deles per underkategori) og «Brevet» (ett avsnitt per feilpost, rettidighet per feil).

```bash
git add src/lib/app/skjema.ts src/lib/app/feil.ts src/lib/app/feil.test.ts src/lib/app/brev.ts src/lib/app/brev.test.ts src/lib/app/saken.ts src/lib/app/saken.test.ts src/lib/app/vurdering.ts src/lib/app/datoer.ts src/lib/app/datoer.test.ts src/app/sak/skjema/mangelen.tsx src/app/sak/\[id\]/svarene.tsx src/app/sak/sporsmal.ts e2e/flyt.spec.ts docs/app.md
git commit -m "feat: én dato per feil, også i samme område; rettidighet per feil (ordlyd til godkjenning)"
```

---

### Oppgave 4: Opplysningsfeil: virkning, retting og § 17 første ledd bokstav b

Funn: Major 5 (c-passat), Major 10 (b-toyota).

**Files:**
- Modify: `src/lib/app/skjema.ts` (`IMPACT`), `src/app/sak/skjema/mangelen.tsx` (`VIRKNING_IKON`)
- Modify: `src/lib/brev/paragrafer.ts` (`POENG`: `"forbehold_uriktig"`), `src/lib/app/brev.ts` (forbeholdsavsnittet, `tilbud`, `rad`)
- Test: `src/lib/app/brev.test.ts`, `src/lib/app/skjema.test.ts` (finnes den: `impactToggle`-testene)

**Interfaces:**
- Produces: `IMPACT`-rad `["verdi", "Bilen er mindre verdt", "Du betalte for noe bilen ikke er, for eksempel km-stand eller service", 2, "gjør at bilen er mindre verdt enn det jeg betalte for"]`, plassert etter «plagsom». `FLERTALL` trenger ingen rad (leddet starter med «gjør at»).
- Produces: `PARAGRAFER.før_2024.forbehold_uriktig = "§ 17 første ledd bokstav b"`, `etter_2024.forbehold_uriktig = null` (kilde i kommentar: Prop. 49 LS kap. 10.1.1 / lovdata, dato).
- Produces: `export const bareOpplysningsfeil = (s: Skjema) => s.f_cats.length > 0 && s.f_cats.every((c) => opplysningsfeil(c, s.f_parts[c] ?? []))` i `src/lib/app/feil.ts`.

- [ ] **Steg 1: Skriv testene**

```ts
it("opplysningsfeil: verdi som virkning, ingen rettingstilbud", () => {
  const s = { ...eksempel(idag), f_cats: ["historikk"], f_parts: { historikk: ["km"] }, f_area: { historikk: { found: "2026-09-01" } }, f_catdesc: {}, f_impact: ["verdi"], k_main: "prisavslag", k_amount: "45 000", ws: "nei" };
  const t = tekst(s);
  expect(t).toContain("Feilen gjør at bilen er mindre verdt enn det jeg betalte for.");
  expect(t).not.toContain("kan tilby å rette mangelen");
  expect(t).not.toContain("stilles til rådighet for undersøkelse og retting");
});
it("som den er før 2024 med løfte: også bokstav b", () => {
  const s = { ...eksempel(idag), c_purchase: "2022-05-14", c_delivery: "2022-05-14", c_asis: true, seller_said: "lovet" };
  s.f_area = { hoyvolt: { found: "2022-08-01" } };
  expect(tekst(s)).toContain("Bilen har også en mangel når den ikke svarer til opplysninger dere ga før kjøpet, jf. § 17 første ledd bokstav b.");
});
it("som den er før 2024 uten løfte: ikke bokstav b", () => { /* samme sak med seller_said "nei" */ expect(t).not.toContain("bokstav b"); });
```

- [ ] **Steg 2: Kjør og se at de feiler**

Run: `npx vitest run src/lib/app/brev.test.ts`
Expected: FAIL.

- [ ] **Steg 3: Implementer**

- `IMPACT`: ny rad etter Interfaces; ikon i `VIRKNING_IKON.verdi` (en enkel prislapp-sti). Hintet på skjermen («Er feilen bare kosmetisk, velger du bare det») uendret.
- `brev.ts`: i forbeholdsavsnittet for `før_2024`, etter setningen med `LOVORD.dårligereStand`: når `s.seller_said === "lovet" && L.par("forbehold_uriktig")` legg til setningen fra testen med `L.par("forbehold_uriktig")`.
- `brev.ts`: `const uttrykkelig = bareOpplysningsfeil(s)`; i `case "prisavslag"` og `case "heving"` skrives `tilbud(…)` bare når `!uttrykkelig`, og `rad(…)`-setningen utelates når `uttrykkelig` (for heving skrives da `rad("undersøkelse")` fortsatt ikke: bilen leveres tilbake uansett). Retting som hovedkrav for en ren opplysningsfeil er fortsatt lov (service kan utføres); der endres ingenting.

- [ ] **Steg 4: Kjør testene**

Run: `npm test`
Expected: PASS.

- [ ] **Steg 5: Dokumenter og commit**

`docs/app.md` «Sjekken» (virkningen «Bilen er mindre verdt») og «Brevet» (tilbud om retting og rådighet utelates når alle feilene er opplysningsfeil; § 17 første ledd bokstav b).

```bash
git add src/lib/app/skjema.ts src/app/sak/skjema/mangelen.tsx src/lib/brev/paragrafer.ts src/lib/app/brev.ts src/lib/app/brev.test.ts src/lib/app/feil.ts docs/app.md
git commit -m "feat: opplysningsfeil får egen virkning, intet rettingstilbud og § 17 første ledd bokstav b (ordlyd til godkjenning)"
```

---

### Oppgave 5: Logger uten persondata

Funn: Major 12 (g-golive).

**Files:**
- Create: `src/lib/logg.ts`, `src/lib/logg.test.ts`
- Modify: `src/app/sak/[id]/actions.ts:200,207,224`, `src/app/api/vipps/route.ts:28`, `src/app/betaling/[ref]/actions.ts:84`, `src/app/api/slett-saker/route.ts:17`, `src/lib/vipps/uavklart.ts:21`, `src/lib/epost/kvittering.ts:119`, `src/app/sak/vurdering.ts:26`, `src/app/api/hendelse/route.ts:17`

**Interfaces:**
- Produces: `export function feiltekst(e: unknown): string` – `e.message` uten alt fra og med `"\nparams:"`, pluss `" ← " + cause.message` (samme kutt) når `e.cause` er en `Error`; for ikke-`Error`: `String(e)`.

- [ ] **Steg 1: Skriv testen**

```ts
it("params logges ikke", () => {
  const e = new Error("Failed query: update sak set skjema = $1\nparams: {\"b_name\":\"Kari Testesen\"}", { cause: new Error("connection reset") });
  expect(feiltekst(e)).toBe("Failed query: update sak set skjema = $1 ← connection reset");
  expect(feiltekst(e)).not.toContain("Testesen");
});
it("annet enn Error", () => expect(feiltekst("x")).toBe("x"));
```

- [ ] **Steg 2: Kjør og se at den feiler** — `npx vitest run src/lib/logg.test.ts` → FAIL (modulen finnes ikke).

- [ ] **Steg 3: Skriv `feiltekst` og bytt ut de ni loggstedene** til `console.error("<samme tekst>", feiltekst(e))` (`uavklart.ts` og `kvittering.ts` beholder `ref`/`r.id` foran).

- [ ] **Steg 4: Sjekk at ingen `console.error(…, e)` er igjen**

Run: `grep -rn "console\.\(error\|warn\)(.*, e)" src | grep -v test`
Expected: ingen treff.

- [ ] **Steg 5: `npm test` → PASS. Commit**

```bash
git add src/lib/logg.ts src/lib/logg.test.ts src/app src/lib/vipps/uavklart.ts src/lib/epost/kvittering.ts
git commit -m "fix: feil logges uten spørringens parametere"
```

---

### Oppgave 6: Capture bare når betalingen har en eier

Funn: Major 13 (g-golive).

**Files:**
- Modify: `src/lib/vipps/avstem.ts:41-53`, `src/lib/vipps/klient.ts` (ny `kanseller`)
- Test: `src/lib/vipps/avstem.test.ts`

**Interfaces:**
- Produces: `export async function kanseller(ref: string): Promise<void>` i `klient.ts`: `POST /epayment/v1/payments/${ref}/cancel` med `Idempotency-Key ${ref}-cancel` (samme mønster som `capture`).
- `avstem`: uten `b.profile?.sub` kanselleres autorisasjonen, ordren settes «avbrutt», loggen `console.warn("vipps: avbrutt uten sub", JSON.stringify({ ref }))`, og svaret er `{ status: "avbrutt" }`. Ingen capture, ingen `betalt`.

- [ ] **Steg 1: Endre testen «gir saken ingen eier når betalingen ikke har en, og varsler uten persondata»** (`avstem.test.ts:72`) til «kansellerer en betaling uten eier og åpner ikke saken»: forvent `kanseller` kalt med `ref`, `capture` ikke kalt, ordre «avbrutt», `sak.betalt` null, svar `{ status: "avbrutt" }`, og at `console.warn`-teksten ikke inneholder annet enn `ref`. Fjern eller tilpass «varsler ikke når betalingen har en eier» (:83) om den tester det gamle varselet.

- [ ] **Steg 2: Kjør og se at den feiler** — `npx vitest run src/lib/vipps/avstem.test.ts` → FAIL.

- [ ] **Steg 3: Implementer** (`kanseller` i klienten; i `avstem` flytt `sub`-oppslaget foran capture-blokken og legg inn grenen).

- [ ] **Steg 4: `npm test` → PASS.** Oppdater «Betaling» i `docs/app.md` (en betaling uten profil kanselleres). Commit:

```bash
git add src/lib/vipps/avstem.ts src/lib/vipps/avstem.test.ts src/lib/vipps/klient.ts docs/app.md
git commit -m "fix: capture bare når Vipps gir en eier; ellers kanselleres betalingen"
```

---

### Oppgave 7: Produksjonen nekter å starte med feil oppsett

Funn: Major 14 (g-golive).

**Files:**
- Create: `src/lib/oppsett.ts`, `src/lib/oppsett.test.ts`, `src/instrumentation.ts`
- Modify: `.env.example` (kommentar om sjekken)

**Interfaces:**
- Produces: `export function oppsettsfeil(env: Record<string, string | undefined>): string[]` – tom liste når alt er i orden. Når `env.NODE_ENV === "production"` og `env.VERCEL_ENV !== "preview"`: en melding per manglende `DATABASE_URL`, `ANTHROPIC_API_KEY`, `VEGVESEN_API_KEY`, `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MERCHANT_SERIAL_NUMBER`, `VIPPS_WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `TVISTR_URL`; `"VIPPS_BASE_URL må være https://api.vipps.no"` når den ikke er det; `"TVISTR_HELT_BREV_UTEN_BETALING må ikke være satt"` og `"EPOST_TEST_TIL må ikke være satt"` når satt. I preview: samme liste, men bare for `DATABASE_URL`, `ANTHROPIC_API_KEY` og de to «må ikke være satt».
- `src/instrumentation.ts` `register()`: `const f = oppsettsfeil(process.env); if (f.length) { console.error("oppsett:", f.join("; ")); if (process.env.NODE_ENV === "production") throw new Error("Produksjonen er ikke satt opp: " + f.join("; ")); }`.

- [ ] **Steg 1: Skriv testene** (`oppsett.test.ts`): full produksjon uten feil → `[]`; produksjon uten `CRON_SECRET` og med `VIPPS_BASE_URL=https://apitest.vipps.no` → to meldinger; produksjon med `TVISTR_HELT_BREV_UTEN_BETALING=1` → én melding; `NODE_ENV=development` → `[]`; preview uten `VIPPS_WEBHOOK_SECRET` → `[]`.

- [ ] **Steg 2: Kjør og se at de feiler.** — `npx vitest run src/lib/oppsett.test.ts`

- [ ] **Steg 3: Implementer** `oppsett.ts` og `instrumentation.ts` (Next 16: `export async function register()`, se `node_modules/next/dist/docs/` om `instrumentation`).

- [ ] **Steg 4: Bekreft at utviklingsserveren og bygget går**

Run: `npm test && npm run build`
Expected: PASS, bygget uten feil (bygget kjører med `NODE_ENV=production` men `register()` kjører først ved oppstart; `next start` lokalt uten produksjonsnøkler skal nå feile med «Produksjonen er ikke satt opp» — prøv `npx next start -p 3001` én gang og les meldingen, stopp den igjen).

- [ ] **Steg 5: Commit**

```bash
git add src/lib/oppsett.ts src/lib/oppsett.test.ts src/instrumentation.ts .env.example
git commit -m "feat: produksjonen stopper ved manglende eller farlig oppsett"
```

---

### Oppgave 8: Ordlyd som er feil i brevet og vurderingen

Funn: Minor (a-volvo 4, 9; e-focus 5; c-passat 8, 9; b-toyota 7).

**Files:**
- Modify: `src/lib/app/brev.ts` (`hevingsgrunner` `folge`, `belop`, `unquote` → `sitat`, verkstedets ord uten rapport), `src/lib/app/vurdering.ts:298` og `evaluate`s «Foreløpig»
- Test: `src/lib/app/brev.test.ts`, `src/lib/app/vurdering.test.ts`

- [ ] **Steg 1: Skriv testene**

```ts
it("ett forsøk etter 2024: entall", () => expect(tekst({ ...eksempel(idag), k_main: "heving", k_forsok: "1" })).toContain("Etter det mislykkede rettingsforsøket kan jeg avvise videre retting"));
it("beløpet navngis", () => {
  expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "25 000", k_exp: false })).toContain("Prisavslaget bes utbetalt innen fristen.");
  expect(tekst({ ...eksempel(idag), k_main: "heving" })).toContain("Erstatningen for utgiftene bes utbetalt innen fristen.");
  expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "25 000" })).toContain("Prisavslaget og erstatningen for utgiftene bes utbetalt innen fristen.");
  expect(tekst({ ...eksempel(idag), k_main: "retting", k_exp: false })).not.toContain("bes utbetalt");
});
it("anførselstegn inni sitatet", () => expect(tekst({ ...eksempel(idag), seller_txt: "Annonsen sa «141 000 km, full servicehistorikk»" })).toContain("Før kjøpet opplyste dere: «Annonsen sa ‘141 000 km, full servicehistorikk’»."));
it("verkstedets ord uten rapport er ikke et sitat", () => expect(tekst({ ...eksempel(idag), ws: "uten", ws_quote: "Rusten må ha vært der ved salget" })).toContain("Slik jeg oppfattet verkstedet: Rusten må ha vært der ved salget."));
```

I `vurdering.test.ts`:

```ts
it("foreløpig til begge datoene er inne", () => {
  expect(evaluate({ ...base, delivery: "2026-06-01" }, idag).tier).toBe("ukjent");
  expect(evaluate({ ...base, found: "2026-06-01" }, idag).tier).toBe("ukjent");
});
it("ett forsøk etter 2024: entall i raden", () => expect(evaluate({ ...base, delivery: "2025-01-10", found: "2025-03-01", k_forsok: "1" }, idag).factors.find((f) => f.t === "Forhandleren har ikke klart å rette feilen")?.d).toContain("Etter det mislykkede forsøket"));
```

- [ ] **Steg 2: Kjør og se at de feiler.**

- [ ] **Steg 3: Implementer**

- `hevingsgrunner`: `folge` bruker «det mislykkede rettingsforsøket» når `n === 1`, ellers «de mislykkede rettingsforsøkene». `forsokFaktor`: tilsvarende «Etter det mislykkede forsøket»/«Etter de mislykkede forsøkene».
- `belop`: `hva = [prisavslag ? "prisavslaget" : "", utgifter ? "erstatningen for utgiftene" : ""]`; tom → ingen setning; ellers `${cap(liste(hva))} bes utbetalt innen fristen. Ved forsinket betaling …`.
- `unquote` → `sitat(s)`: fjern ytre «»/"" som i dag, og bytt gjenværende `«` → `‘` og `»` → `’`.
- Uten rapport: erstatt `["Verkstedet forklarte det slik: «", …, "»."]` med `["Slik jeg oppfattet verkstedet: ", fe("ws_quote", sentence(sitat(s.ws_quote)))]`.
- `evaluate`: «Foreløpig» når `!q.delivery || !q.found` (ikke `&&`); raden «Datoene mangler» beholdes i `factors`.

- [ ] **Steg 4: `npm test` → PASS** (snapshotet endres for «Beløpet»-setningen og verkstedsetningen: les diffen). Oppdater `docs/app.md` («Brevet»: beløpet navngis; verkstedets ord uten rapport). Commit:

```bash
git add src/lib/app/brev.ts src/lib/app/brev.test.ts src/lib/app/__snapshots__ src/lib/app/vurdering.ts src/lib/app/vurdering.test.ts docs/app.md
git commit -m "fix: entall ved ett forsøk, beløpet navngis, sitat i sitat, verkstedets ord, foreløpig til begge datoer (ordlyd til godkjenning)"
```

---

### Oppgave 9: Sjekklisten og lagringsstatusen sier det som er sant

Funn: Minor (ugyldig org.nr. hos alle testerne; d-leaf 4; d-leaf 10/e-focus 6 om lenken).

**Files:**
- Create: `src/lib/app/avvik.ts`, `src/lib/app/avvik.test.ts`
- Modify: `src/app/sak/[id]/skriver.tsx:97` (bruk `avvik`), `src/app/sak/[id]/autolagring.ts` (ny status), `src/app/sak/flyt/brevrute.tsx:23` (lenken)
- Test: `src/app/sak/[id]/autolagring.test.ts` (finnes den ikke: hopp over enhetstest, dekkes av e2e-forventningen «Lagret på kontoen din»)

**Interfaces:**
- Produces: `export const avvik = (s: Skjema, idag: string): string[] => [...datoavvik(s, idag), ...(orgValid(s.d_org) === false ? ["Organisasjonsnummeret til forhandleren er ikke gyldig. Sjekk det mot Enhetsregisteret."] : [])]`.
- `Lagring` får verdien `"endret"` (vist som «Ikke lagret ennå»), satt i effekten på `[skjema]` når innholdet avviker fra `lagret.current`, før pausen.
- `brevrute.tsx`: i `prec`-blokken rendres en `https?://\S+`-streng i slutningsavsnittet som `<a href target="_blank" rel="noopener">` med teksten lik adressen uten avsluttende `&`, `.` eller `)`.

- [ ] **Steg 1: Skriv testene** (`avvik.test.ts`: gyldig org.nr. → bare datoavvik; `d_org: "965 432 109"` → meldingen med; tom `d_org` → ingen melding).

- [ ] **Steg 2: Kjør og se at de feiler.**

- [ ] **Steg 3: Implementer** de tre delene. I `skriver.tsx` vises «Ikke lagret ennå» med samme stil som «Lagrer …».

- [ ] **Steg 4: `npm test` → PASS; `npx playwright test --project=desktop` → PASS** (testen venter alt på «Lagret på kontoen din» etter 1,5 s, som fortsatt stemmer).

- [ ] **Steg 5: Commit**

```bash
git add src/lib/app/avvik.ts src/lib/app/avvik.test.ts src/app/sak/\[id\]/skriver.tsx src/app/sak/\[id\]/autolagring.ts src/app/sak/flyt/brevrute.tsx
git commit -m "fix: ugyldig org.nr. i sjekklisten, «Ikke lagret ennå», vedtakslenken kan klikkes"
```

---

### Oppgave 10: Tilbake-knappen i nettleseren går til forrige spørsmål

Funn: Minor hos fire testere (a, b, d, e).

**Files:**
- Modify: `src/app/sak/sjekk.tsx:72-120`
- Test: `e2e/flyt.spec.ts`

**Interfaces:**
- Hver skjerm (`her = \`${skjerm}-${i}\``) er ett historikkinnslag: når `her` endrer seg av et klikk, `history.pushState({ her: { _screen, _i } }, "")`. På `popstate` med `e.state?.her` settes `_screen`/`_i` fra det (uten nytt `pushState`). Første innlasting erstatter innslaget (`replaceState`) så «Tilbake» fra spørsmål 1 forlater `/sak` som før.

- [ ] **Steg 1: Skriv e2e-testen** i `flyt.spec.ts` (desktop): etter `velg(page, /En bilforhandler/, 2)` og neste til spørsmål 3: `await page.goBack()` → `sporsmal(page, 2)`; `await page.goForward()` → `sporsmal(page, 3)`; svarene står (reg.nr. i `#c_reg`).

- [ ] **Steg 2: Kjør og se at den feiler** — `npx playwright test --project=desktop -g "tilbake"` → FAIL (`goBack` forlater `/sak`).

- [ ] **Steg 3: Implementer** med en `useRef<boolean>` «fraHistorikk» som `popstate` setter før `endre(...)`, så effekten på `her` ikke pusher i det tilfellet.

- [ ] **Steg 4: Kjør e2e** — `npx playwright test` → PASS (begge prosjektene).

- [ ] **Steg 5: Dokumenter («Sjekken» i `docs/app.md`) og commit**

```bash
git add src/app/sak/sjekk.tsx e2e/flyt.spec.ts docs/app.md
git commit -m "feat: nettleserens tilbake og frem går mellom spørsmålene"
```

---

## Ikke med i denne planen (bevisst)

- Alt om hvilket vedtak som velges, sammenligningen «ikke i et svakere utgangspunkt», `som_den_er`-datavasken, sanksjoner per feil, modellkall-telling og likhetsprosenten: egen runde.
- Virkning per feil (b-toyota 6), rapportens omfang per feil (d-leaf 5), sladd som skjuler ett ord (d-leaf 7), statistikklegenden (d-leaf 8), vinduets overskrift FTU/FKU (d-leaf 11), mottakerblokken på mobil (f 5), prisavslag etter 2+ forsøk (f 6), dato før kjøp som advarsel før betaling (a 2): polish, tas når det over er inne.
