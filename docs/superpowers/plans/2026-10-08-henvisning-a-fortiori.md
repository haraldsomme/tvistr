# Henvisning etter det utvalget la vekt på — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brevet viser til vedtaket der kjøperen står minst like sterkt på det utvalget faktisk la vekt på, sier det slik en jurist ville, gir råd om hva som må innhentes, og viser en score for hvor godt brevet er underbygget.

**Architecture:** Biblioteket `HENVISNINGER` får strukturerte felt per vedtak (rettsspørsmål, avgjørende momenter som id-er i `MOMENTER`, fakta, utfall). `velgHenvisning` blir en ren funksjon av `Faktorer` og kjøperens momenter (`Kjoper`), og velges bare på brevsiden. `planlegg` bygger henvisningsføringen fra vedtaket og kjøperen; forfatteren formulerer. `sjekkBrev` får nye advarsler, og en ny `scoreFor` gjør advarslene, gule felt og manglende momenter om til en score i en egen fane.

**Tech Stack:** Next.js (App Router, les `node_modules/next/dist/docs/` før Next-spesifikk kode), TypeScript, Drizzle/Neon, Vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-10-08-henvisning-a-fortiori-design.md` (les hele før du starter).

## Global Constraints

- Ingen merke, modell, navn eller tilkjente beløp i brevteksten. Kjøpesummen kan stå.
- Aldri et vedtak vunnet på formodningsregelen for en kjøper uten den, aldri ny lov for kjøp før 2024, aldri et vedtak nyere enn brevets dato (`h.dato <= idag`).
- «De samme momentene trekker minst like sterkt i min sak» bare når `mangler` er tom.
- Vurderingen lover «minst like sterkt», aldri «enda bedre».
- Scoren teller bare det som kan forbedres, kan alltid nå 100 %, er aldri under 0, og fanen sier at den ikke er en vinnersjanse.
- Vitest bare i `src/lib/vurdering/` og `src/lib/brev/skriving/` (CLAUDE.md). Ingen nye testfiler.
- `npm run sjekk-henvisninger` og `npm run sjekk-momenter` må gi 0 feil.
- Endres prompt, plan eller kontroll: øk `BREVSKRIV_VERSJON`. Brev-eval koster penger: spør brukeren før den kjøres.
- Commit bare når brukeren har bedt om det (CLAUDE.md og systeminstruks). Commit-stegene under er «når godkjent».
- En annen økt kan redigere `brevplan.ts`, `kontroll.ts` og `render.ts` samtidig. Les filen rett før hver endring, og rør ikke endringer du ikke har gjort.
- Norsk bokmål i alt brukeren ser; kommentarer i koden på engelsk som i resten av kodebasen.

## Review Focus

1. **Kjøper med ukjent alder, km eller pris:** faktaet telles ikke, og saken får likevel en henvisning (Task 4 tester det).
2. **Ingen vedtak med kjøperens hovedspørsmål:** reserven brukes, og føringen påstår da ikke «det samme spørsmålet» (Task 4 og Task 5 tester det).
3. **Moment besvart med «Egen beskrivelse»:** teller ikke som dekket (Task 5 tester det på `kjoperFor`).
4. **Scoren:** samme handling trekkes én gang, aldri under 0, 100 % uten funn (Task 10, sjekkes i nettleseren med de tre tilfellene listet der).
5. **Brevets dato før nyere vedtak:** `h.dato <= idag` filtreres fortsatt i `planlegg` (Task 5 beholder testen i `brevplan.test.ts` linje ~175).

---

### Task 1: Spør om `rapport_arsak` og `forhandler_annen_arsak`

**Files:**
- Modify: `src/lib/brev/momenter.ts` (postene `rapport_arsak` og `forhandler_annen_arsak`, `momenterFor`)
- Modify: `src/app/brev/steg/rapport.tsx:64-102`
- Modify: `src/app/brev/steg/kontakt.tsx:89-154`

**Interfaces:**
- Produces: `MOMENTER` der `rapport_arsak.steg === "rapport"` og `forhandler_annen_arsak.steg === "kontakt"`; `momenterFor(f)` inkluderer begge alltid (som `bruksstans_sikkerhet`). `export const ALLTID_SPURT = ["bruksstans_sikkerhet", "rapport_arsak", "forhandler_annen_arsak"] as const;`

- [ ] **Step 1:** I `src/lib/brev/momenter.ts`, legg `steg: "rapport",` i posten `rapport_arsak` og `steg: "kontakt",` i `forhandler_annen_arsak` (rett etter `gjelder`, som i `rapport_upaaregnelig`).
- [ ] **Step 2:** Erstatt unntaket i `momenterFor`:

```ts
// Asked although they do not separate won from lost cases: the description and a claim to cancel need
// `bruksstans_sikkerhet`, and the cited decision is compared on the other two (docs/superpowers/specs/2026-10-08-henvisning-a-fortiori-design.md).
export const ALLTID_SPURT: readonly string[] = ["bruksstans_sikkerhet", "rapport_arsak", "forhandler_annen_arsak"];
export function momenterFor(f: Faktorer, katalog: readonly Moment[] = MOMENTER): Moment[] {
  const grupper = grupperFor(f);
  const grunnlag = regelgrunnlag(f);
  return katalog.filter(
    (m) =>
      (m.forekomst.skiller || ALLTID_SPURT.includes(m.id)) &&
      (!m.gjelder.grupper?.length || m.gjelder.grupper.some((g) => grupper.includes(g))) &&
      (!m.gjelder.botter?.length || m.gjelder.botter.includes(f.reklamasjonsbotte)) &&
      (!m.gjelder.grunnlag?.length || m.gjelder.grunnlag.includes(grunnlag)),
  );
}
```

- [ ] **Step 3:** I `rapport.tsx`: vis `rapport_arsak` når kjøperen har en rapport, og lagre den med:

```tsx
const arsak = m.gjelder("rapport_arsak") && rapport === "ja";
// in send():
momenter: m.lagring("rapport", [...(vanlig ? ["rapport_upaaregnelig"] : []), ...(arsak ? ["rapport_arsak"] : [])]),
// in the JSX, before the rapport_upaaregnelig field:
{arsak && <MomentFelt id="rapport_arsak" svar={m.svar} sett={m.sett} />}
```

- [ ] **Step 4:** I `kontakt.tsx`: vis `forhandler_annen_arsak` når forhandleren har avvist:

```tsx
const annenArsak = m.gjelder("forhandler_annen_arsak") && valgtRetting === "avvist";
// in send():
...(momenter && { momenter: m.lagring("kontakt", [...(godtatt ? ["forhandler_erkjente"] : []), ...(annenArsak ? ["forhandler_annen_arsak"] : [])]) }),
// JSX, after the forhandler_erkjente field:
{annenArsak && <MomentFelt id="forhandler_annen_arsak" svar={m.svar} sett={m.sett} />}
```

- [ ] **Step 5:** Kjør `npm run sjekk-momenter` (forventet: 0 feil), `npx tsc --noEmit -p .` og `npx vitest run src/lib/brev/skriving` (forventet: grønt; `brevplan.test.ts` kan få nye momenter i planen, les feilen før noe endres).
- [ ] **Step 6:** Sjekk i nettleseren (`npm run dev`, Playwright MCP): en sak med rapport viser spørsmålet om årsak i «Tilstandsrapport»; «Forhandleren nekter å rette feilen» viser spørsmålet om annen årsak i «Kontakt med forhandleren»; svarene lagres og står der etter omlasting.
- [ ] **Step 7 (når godkjent):** `git add src/lib/brev/momenter.ts src/app/brev/steg/rapport.tsx src/app/brev/steg/kontakt.tsx && git commit -m "Spør om årsak i rapporten og forhandlerens årsak"`

---

### Task 2: Kurér de 54 vedtakene på nytt

Agentarbeid etter metoden i `docs/henvisninger.md`. Ingen produktkode endres; resultatet er én JSON-fil.

**Files:**
- Create: `scripts/henvisninger-kurering.json`
- Modify: `scripts/henvisninger-belegg.json` (nye nøkler)

**Interfaces:**
- Produces: `scripts/henvisninger-kurering.json` med formen

```json
{ "poster": { "<vedtakId>": {
    "sporsmal": ["forventning", "levering"],
    "vekt": ["rapport_upaaregnelig", "rapport_arsak"],
    "begrunnelse": "Utvalget la vekt på at en sakkyndig hadde uttalt at …",
    "opplyst": "ingenting",
    "tid": "nær tre år etter kjøpet",
    "feil": "rust i dører, panser og tak",
    "utfall": "prisavslag satt lik utbedringskostnadene"
} } }
```
  og belegg-nøklene `sporsmal`, `vekt:<id>` (én per id), `opplyst`, `utfall` i `henvisninger-belegg.json`.

- [ ] **Step 1:** Start én kuratoragent (Agent-verktøyet, i bakgrunnen) med denne briefen, og vent på svaret:
  «Les CLAUDE.md, spec-en `docs/superpowers/specs/2026-10-08-henvisning-a-fortiori-design.md` (avsnitt 1, 2 og 6) og `src/lib/brev/momenter.ts`. For hvert av de 54 vedtakene i `HENVISNINGER` (`src/lib/vurdering/henvisninger.ts`): les vedtaket (`npm run henvisning-kandidater -- --tekst <id>`), særlig «Utvalget ser slik på saken», og sett feltene over. `vekt`: bare momenter fra `MOMENTER` utvalget faktisk la vekt på i begrunnelsen (ikke det partene anførte); er det et avgjørende moment som ikke finnes i katalogen, skriv det i `nyeMomenter` med sitat i stedet for å finne på en id. `sporsmal`: det utvalget tok stilling til (forventning, opplysning, levering). `begrunnelse`: én til to setninger «Utvalget la vekt på at …», uten navn, merke, modell og beløp. `utfall`: type og beregning, uten beløp («prisavslag satt lik utbedringskostnadene», «erstatning for reparasjonen uten fradrag for standardheving», «heving av kjøpet»). `tid`: når feilen viste seg etter kjøpet, som teksten sier det. `feil`: kort, uten merke og modell. Ordrett belegg (kan skjøtes med « … ») for `sporsmal`, hver id i `vekt`, `opplyst` og `utfall`. Rediger ingen filer i `src/`. Skriv resultatet til `/private/tmp/…/scratchpad/kurering.json` som `{ poster, belegg, nyeMomenter }`.»
- [ ] **Step 2:** Start en uavhengig kontrollagent som leser hver post og hvert belegg mot vedtaksteksten (som kontrollen i forrige runde), med beskjed om å svare OK eller problem + rettet verdi per vedtak, uten å redigere filer.
- [ ] **Step 3:** Rett postene etter kontrollen. Gjelder `nyeMomenter`: legg momentet til i `scripts/momenter-katalog.json`, `scripts/momenter-belegg.json` og `src/lib/brev/momenter.ts` etter `docs/momenter.md`, og kjør `npm run sjekk-momenter` (0 feil). Spør brukeren først hvis det er mer enn to nye momenter.
- [ ] **Step 4:** Skriv `scripts/henvisninger-kurering.json` (bare `poster`) og flett belegget inn i `scripts/henvisninger-belegg.json` (2 mellomrom, avsluttende linjeskift).
- [ ] **Step 5:** Dekningssjekk: tell for hvert hovedspørsmål (`forventning`, `opplysning`) × `presumsjon` (true/false) hvor mange poster som har det spørsmålet, og hvilke `vekt`-id-er som forekommer. Mangler en kombinasjon, eller har alle poster uten presumsjon `rapport_upaaregnelig`/`rapport_arsak` i `vekt`: kurér nye vedtak vunnet på andre momenter (`forhandler_erkjente`, `bruksstans_sikkerhet`, `positiv_beskrivelse`, `dokument_for_salg`) med samme to agenter og samme format (inkludert de gamle feltene `gruppe`, `botte`, `alder`, `km`, `lov`, `presumsjon`, `ref`, `organ`, `dato`, `kildeUrl`, og belegget `feil`, `tid`, `bil`, `utfall`).
- [ ] **Step 6 (når godkjent):** commit `scripts/henvisninger-kurering.json scripts/henvisninger-belegg.json` (og katalogfilene hvis endret): «Kurering: rettsspørsmål, momenter og utfall for vedtakene».

---

### Task 3: Ny `Henvisning`-type og biblioteket på ny form

**Files:**
- Modify: `src/lib/vurdering/henvisninger.ts` (typer og alle poster)
- Create (midlertidig, slettes i samme task): `scripts/_flett-henvisninger.ts`
- Modify: `scripts/sjekk-henvisninger.ts`
- Modify: `docs/henvisninger.md`

**Interfaces:**
- Consumes: `scripts/henvisninger-kurering.json` (Task 2)
- Produces:

```ts
export const SPORSMAL = ["forventning", "opplysning", "levering"] as const;
export type Sporsmal = (typeof SPORSMAL)[number];
export const OPPLYST = ["ingenting", "som_den_er", "feilen_opplyst"] as const; // weakest buyer position last
export type Opplyst = (typeof OPPLYST)[number];
export type Henvisning = {
  vedtakId: number; ref: string; organ: Organ; dato: string; kildeUrl: string;
  lov: "før_2024" | "etter_2024";
  presumsjon: boolean;
  sporsmal: Sporsmal[];
  vekt: string[];            // ids in MOMENTER
  begrunnelse: string;
  alder: number; km: number | null; pris: number;
  opplyst: Opplyst;
  botte: Reklamasjonsbotte;
  tid: string;
  gruppe: Gruppe;
  feil: string;
  utfall: string;
};
```
  `GRUPPER`, `Gruppe`, `Organ`, `HENVISNINGER` beholdes. `REGELGRUNNLAG`, `Regelgrunnlag` og `regelgrunnlag()` beholdes (brukes av `momenter.ts`). Fjernes: `likhet`, `konklusjon`, `regel`, `grunnlag`, `setning`, `Likhet`, `LIK_ALDER_AR`, `VEKT`, `vurderLikhet`.

- [ ] **Step 1:** Skriv `scripts/_flett-henvisninger.ts` som leser `HENVISNINGER`, `scripts/henvisninger-kurering.json` og `kjopesum_nok` fra databasen, og skriver hver post på ny form til stdout som TypeScript-literaler i feltrekkefølgen over (samme stil som i dag: ett felt per linje, `JSON.stringify` for strenger). Kjør `npx tsx --env-file=.env.local scripts/_flett-henvisninger.ts > /tmp/poster.ts`, kontroller utdata, og erstatt innholdet i `HENVISNINGER` med det. Slett skriptet.
- [ ] **Step 2:** Erstatt typene øverst i `henvisninger.ts` med «Produces» over, og kommentaren øverst med: `// The decisions the letter can cite, read for what the committee decided and what it relied on (docs/henvisninger.md, scripts/sjekk-henvisninger.ts). The letter cites the one where the buyer stands at least as strong on that (velgHenvisning).`
- [ ] **Step 3:** Oppdater `scripts/sjekk-henvisninger.ts`:

```ts
const BELEGG_KREVES = ["feil", "tid", "bil", "utfall", "sporsmal", "opplyst"];
// per post, in addition to the checks that stay (id, dealer, outcome, link, date, ref, organ, law, age, km, presumption):
if (h.sporsmal.length === 0) ut("sporsmal er tom");
for (const id of h.vekt) {
  if (!MOMENTER.some((m) => m.id === id)) ut(`vekt: ${id} finnes ikke i MOMENTER`);
  if (!b?.[`vekt:${id}`]) ut(`mangler belegg for vekt:${id}`);
}
if (!kjerne(tekst).includes(String(h.pris))) ut(`pris ${h.pris} står ikke i vedtaket`);
if (Number(r.kjopesum_nok) !== h.pris) ut(`pris ${h.pris}, databasen har ${r.kjopesum_nok}`);
const merkeModell = [r.merke, r.modell].filter(Boolean).map((x) => kjerne(String(x))).filter((x) => x.length >= 3);
for (const [navn, s] of [["begrunnelse", h.begrunnelse], ["feil", h.feil], ["utfall", h.utfall]] as const) {
  if (merkeModell.some((x) => kjerne(s).includes(x))) ut(`${navn} nevner merke eller modell`);
  if (/\d[\d  ]*\s?kr\b|kroner/.test(s)) ut(`${navn} har et beløp`);
  if (/[[\]]/.test(s)) ut(`hakeparentes i ${navn}`);
}
```
  Legg `merke, modell, kjopesum_nok` til i SQL-en. Fjern sjekkene for `setning`, `likhet`, `konklusjon`, `regel` og «hvert grunnlag har en regel-post»; legg i stedet til: hvert hovedspørsmål (`forventning`, `opplysning`) har minst én post med og én uten presumsjon.
- [ ] **Step 4:** Kjør `npm run sjekk-henvisninger`. Forventet: `N poster, 0 feil.` Rett data (ikke sjekken) til det er grønt.
- [ ] **Step 5:** `npx tsc --noEmit -p .` feiler nå i forbrukerne (`brev.ts`, `brevplan.ts`, `kort.tsx`, `vurder.ts`, testene). Det rettes i Task 4–8; ikke rett dem her.
- [ ] **Step 6:** `docs/henvisninger.md`: skriv om «Valget» til avsnitt 3 i spec-en, oppdater «Slik ble de valgt» med kureringen fra Task 2, og vis hver post med `sporsmal`, `vekt`, `begrunnelse`, `utfall` i stedet for `likhet`/`konklusjon`/`setning`.
- [ ] **Step 7 (når godkjent):** commit `src/lib/vurdering/henvisninger.ts scripts/sjekk-henvisninger.ts docs/henvisninger.md`: «Henvisninger: rettsspørsmål, momenter og fakta per vedtak».

---

### Task 4: Valget — `velgHenvisning(f, kjoper)`

**Files:**
- Modify: `src/lib/vurdering/henvisninger.ts` (funksjonene nederst)
- Modify: `src/lib/vurdering/faktorer.ts` (`kjopesumNok`)
- Test: `src/lib/vurdering/henvisninger.test.ts` (skrives om)

**Interfaces:**
- Consumes: `Henvisning`, `Opplyst`, `Sporsmal` (Task 3)
- Produces:

```ts
export type Faktum = "alder" | "km" | "pris" | "opplyst" | "tid";
// What the letter knows about the buyer beyond Faktorer: the moments with a favourable answer, and what they were told.
export type Kjoper = { dekket: ReadonlySet<string>; opplyst: Opplyst };
export type ValgtHenvisning = {
  henvisning: Henvisning;
  // The buyer's question is the one the decision decided; false for the fallback.
  sammeSporsmal: boolean;
  sporsmal: Sporsmal[];        // shared with the buyer, main question first
  dekket: string[]; mangler: string[];
  sterkere: Faktum[]; likt: Faktum[]; svakere: Faktum[];
  annenFeil: boolean;
};
export function hovedsporsmal(f: Faktorer): "forventning" | "opplysning";
export function trengerLevering(f: Faktorer): boolean;
export function velgHenvisning(f: Faktorer, k: Kjoper, bibliotek?: readonly Henvisning[]): ValgtHenvisning | null;
```
  `Faktorer` får `kjopesumNok: number | null`.

- [ ] **Step 1: Skriv de feilende testene.** Erstatt `describe("velgHenvisning", …)` og hjelperen `post` i `henvisninger.test.ts` med:

```ts
const kjoper = (o: Partial<Kjoper> = {}): Kjoper => ({ dekket: new Set(), opplyst: "ingenting", ...o });
const velg = (o: Valg, bibliotek: Henvisning[], k: Kjoper = kjoper()) => velgHenvisning(beregnFaktorer(klage(o), IDAG), k, bibliotek);

let neste = 1;
const post = (o: Partial<Henvisning> = {}): Henvisning => ({
  vedtakId: neste++, ref: "FKU-2024-1", organ: "Forbrukerklageutvalget", dato: "2024-01-31", kildeUrl: "https://example.test/v.pdf",
  lov: "før_2024", presumsjon: false, sporsmal: ["forventning", "levering"], vekt: [], begrunnelse: "Utvalget la vekt på at feilen var uvanlig.",
  alder: 10, km: 150000, pris: 100000, opplyst: "ingenting", botte: "middels", tid: "ett år etter kjøpet", gruppe: "motor",
  feil: "motorhavari", utfall: "heving av kjøpet", ...o,
});
// klage() gets kmVedKjop and kjopesumNok: extend Valg with `km?: number; pris?: number` and pass them into bilOgKjop.

describe("velgHenvisning", () => {
  it("samme rettsspørsmål først", () => {
    const bibliotek = [post({ vedtakId: 1, sporsmal: ["opplysning"], alder: 20 }), post({ vedtakId: 2, sporsmal: ["forventning"], alder: 3 })];
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek);
    expect(v?.henvisning.vedtakId).toBe(2);
    expect(v?.sammeSporsmal).toBe(true);
  });

  it("uten vedtak med kjøperens spørsmål brukes reserven, og den sier det", () => {
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ sporsmal: ["opplysning"] })]);
    expect(v?.sammeSporsmal).toBe(false);
  });

  it("færrest manglende momenter går foran fakta", () => {
    const bibliotek = [post({ vedtakId: 10, vekt: ["rapport_upaaregnelig"], alder: 20, km: 300000, pris: 20000 }), post({ vedtakId: 11, vekt: ["bruksstans_sikkerhet"], alder: 1 })];
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013, km: 150000, pris: 100000 }, bibliotek, kjoper({ dekket: new Set(["bruksstans_sikkerhet"]) }));
    expect(v?.henvisning.vedtakId).toBe(11);
    expect(v?.mangler).toEqual([]);
  });

  it("a fortiori: vedtaket der kjøperen står sterkere på flest fakta", () => {
    // The buyer: 2 years, 22 000 km, 520 000 kr, nothing disclosed.
    const svak = post({ vedtakId: 20, alder: 16, km: 191397, pris: 80000, opplyst: "feilen_opplyst" });
    const lik = post({ vedtakId: 21, alder: 2, km: 22000, pris: 520000 });
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2021, km: 22000, pris: 520000 }, [lik, svak]);
    expect(v?.henvisning.vedtakId).toBe(20);
    expect(v?.sterkere).toEqual(["alder", "km", "pris", "opplyst"]);
    expect(v?.likt).toEqual(["tid"]);
  });

  it("ukjente fakta hos kjøperen telles ikke, og saken får likevel en henvisning", () => {
    // No car year and no mileage: only price (150 000 kr in klage(), the post has 100 000), disclosure and timing compare.
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ km: null })]);
    expect(v?.henvisning).toBeDefined();
    expect(v?.sterkere).toEqual(["pris"]);
    expect(v?.likt).toEqual(["opplyst", "tid"]);
  });

  it("aldri formodningsregelen eller ny lov kjøperen ikke har", () => {
    const bibliotek = [post({ vedtakId: 30, presumsjon: true, botte: "rask" }), post({ vedtakId: 31, lov: "etter_2024" }), post({ vedtakId: 32, alder: 30 })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(32);
  });

  it("nærmeste alder ved likt, så nyeste vedtak", () => {
    const bibliotek = [post({ vedtakId: 40, alder: 14 }), post({ vedtakId: 41, alder: 11 }), post({ vedtakId: 42, alder: 11, dato: "2025-01-01" })];
    expect(velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01", bilAr: 2013 }, bibliotek)?.henvisning.vedtakId).toBe(42);
  });

  it("annen feiltype merkes", () => {
    const v = velg({ typer: ["bremser"], oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [post({ gruppe: "rust" })]);
    expect(v?.annenFeil).toBe(true);
  });

  it("når loven stopper kravet, er det ingen henvisning", () => {
    expect(velg({ kjopsform: "privatperson" }, [post()])).toBeNull();
  });
});
```
  Skriv om `describe("biblioteket", …)`: behold «alle saker loven ikke stopper får en henvisning, og den er aldri vunnet på en fordel kjøperen mangler» (kall `velgHenvisning(f, kjoper())`, fjern alderssjekken og `MAKS_ALDERSFORSKJELL`/`DEKKET_UTEN_FORMODNING_AR`); erstatt testen om regel-poster med «hvert hovedspørsmål har vedtak med og uten formodning»; i «alle poster er fullstendige» sjekk `sporsmal.length > 0`, `vekt` finnes i `MOMENTER`, og at `begrunnelse` starter med «Utvalget» og slutter med punktum. Fjern `MAL`.
- [ ] **Step 2:** Kjør `npx vitest run src/lib/vurdering/henvisninger.test.ts`. Forventet: FAIL (`Kjoper` finnes ikke).
- [ ] **Step 3: Implementer.** I `faktorer.ts`: `kjopesumNok: number | null;` i typen (med kommentar «The purchase price. null when not given.») og `kjopesumNok: b.kjopesumNok ?? null,` i `beregnFaktorer`. Erstatt funksjonene nederst i `henvisninger.ts` (fra `const GRUPPE_FOR` til slutten) med:

```ts
const GRUPPE_FOR = Object.fromEntries(GRUPPER.map((g) => [KNAPP_TIL_FEILTYPE[g][0], g])) as Partial<Record<Feiltype, Gruppe>>;
export const grupperFor = (f: Faktorer): Gruppe[] => GRUPPER.filter((g) => f.feilgrupper.some((fg) => GRUPPE_FOR[fg[0]] === g));

export function regelgrunnlag(f: Faktorer): Regelgrunnlag {
  if (f.presumsjon) return "formodning";
  if (f.rapportSierForKjop === true) return "rapport";
  if (f.feilOpplysninger) return "opplysning";
  return "forventning";
}

// The question the letter rests on: wrong information when the buyer says so, or when the defect is not
// one wear can explain (wrong mileage or history, an earlier damage); otherwise what the buyer could expect.
export const hovedsporsmal = (f: Faktorer): "forventning" | "opplysning" => (f.feilOpplysninger || !f.slitasjeAktuelt ? "opplysning" : "forventning");
// Whether the defect was there at delivery is also in question: outside the presumption, or with a report on it.
export const trengerLevering = (f: Faktorer) => !f.presumsjon || f.rapportSierForKjop === true;

// Never a decision won on something the buyer does not have: the presumption, or the 2024 rules.
const forenlig = (h: Henvisning, f: Faktorer) => (!h.presumsjon || f.presumsjon) && (h.lov === "før_2024" || f.presumsjonManeder === 24);

const TIDSROM: Record<Reklamasjonsbotte, number> = { rask: 0, middels: 1, sen: 2 };
const FAKTA: Faktum[] = ["alder", "km", "pris", "opplyst", "tid"];
// How the buyer compares on one fact: 1 stronger, 0 the same, -1 weaker, null unknown. Stronger means a
// newer car, fewer km, a dearer car, less disclosed, the defect showing earlier.
function sammenlign(fakt: Faktum, h: Henvisning, f: Faktorer, k: Kjoper): number | null {
  const tegn = (a: number, b: number) => Math.sign(a - b);
  switch (fakt) {
    case "alder": return f.bilAlder === null ? null : tegn(h.alder, f.bilAlder);
    case "km": return f.kmVedKjop === null || h.km === null ? null : tegn(h.km, f.kmVedKjop);
    case "pris": return f.kjopesumNok === null ? null : tegn(f.kjopesumNok, h.pris);
    case "opplyst": return tegn(OPPLYST.indexOf(h.opplyst), OPPLYST.indexOf(k.opplyst));
    case "tid": return tegn(TIDSROM[h.botte], TIDSROM[f.reklamasjonsbotte]);
  }
}

export function velgHenvisning(f: Faktorer, k: Kjoper, bibliotek: readonly Henvisning[] = HENVISNINGER): ValgtHenvisning | null {
  // A claim the law stops gets no letter, and a won decision would mislead.
  if (f.stopp) return null;
  const hoved = hovedsporsmal(f);
  const levering = trengerLevering(f);
  const grupper = grupperFor(f);
  const kandidater = bibliotek.filter((h) => forenlig(h, f));
  const samme = kandidater.filter((h) => h.sporsmal.includes(hoved));
  const pool = samme.length ? samme : kandidater;
  const vurdert = pool.map((h) => {
    const dekket = h.vekt.filter((id) => k.dekket.has(id));
    const mangler = h.vekt.filter((id) => !k.dekket.has(id));
    const sterkere: Faktum[] = [], likt: Faktum[] = [], svakere: Faktum[] = [];
    for (const fakt of FAKTA) {
      const s = sammenlign(fakt, h, f, k);
      if (s === null) continue;
      (s > 0 ? sterkere : s < 0 ? svakere : likt).push(fakt);
    }
    const sporsmal = [hoved, ...(levering ? (["levering"] as const) : [])].filter((s) => h.sporsmal.includes(s));
    return { henvisning: h, sammeSporsmal: samme.length > 0, sporsmal, dekket, mangler, sterkere, likt, svakere, annenFeil: grupper.length > 0 && !grupper.includes(h.gruppe) };
  });
  const aldersforskjell = (h: Henvisning) => (f.bilAlder === null ? 0 : Math.abs(h.alder - f.bilAlder));
  vurdert.sort(
    (a, b) =>
      a.mangler.length - b.mangler.length ||
      b.sterkere.length - b.svakere.length - (a.sterkere.length - a.svakere.length) ||
      Number(b.sporsmal.includes("levering")) - Number(a.sporsmal.includes("levering")) ||
      aldersforskjell(a.henvisning) - aldersforskjell(b.henvisning) ||
      b.henvisning.dato.localeCompare(a.henvisning.dato),
  );
  return vurdert[0] ?? null;
}
```
  `momenter.ts` importerer i dag `regelgrunnlag` og har egen `grupperFor`; behold dens import, og bytt dens lokale `grupperFor` til `grupperFor` herfra hvis den er lik (sjekk først; er den ulik, la den stå).
- [ ] **Step 4:** Kjør `npx vitest run src/lib/vurdering/henvisninger.test.ts`. Forventet: PASS.
- [ ] **Step 5 (når godkjent):** commit `src/lib/vurdering/henvisninger.ts src/lib/vurdering/faktorer.ts src/lib/vurdering/henvisninger.test.ts`: «Valget: rettsspørsmål, momenter og a fortiori».

---

### Task 5: Kjøperen fra saken, og føringen i brevplanen

**Files:**
- Modify: `src/lib/brev/brev.ts` (`JURIDISK.henvisning`, `henvisningFor`, ny `GRUPPE_NAVN`)
- Modify: `src/lib/brev/skriving/brevplan.ts` (henvisningsdelen, ~linje 240–250; les filen først)
- Modify: `src/lib/brev/skriving/saksmodell.ts` (ny `kjoperFor`)
- Create: `src/lib/brev/skriving/henvisning.ts` (`henvisningFor`); fjern den gamle `henvisningFor` og `medBilAr` fra `brev.ts` når ingen bruker dem
- Test: `src/lib/brev/skriving/brevplan.test.ts`

**Interfaces:**
- Consumes: `velgHenvisning`, `Kjoper`, `ValgtHenvisning`, `Faktum`, `Sporsmal` (Task 4); `besvarteMomenter` (`src/lib/brev/momenter.ts`)
- Produces:

```ts
// saksmodell.ts
export function kjoperFor(m: Pick<Saksmodell, "faktorer" | "utfylling" | "avklaringer" | "input">): Kjoper;
// src/lib/brev/skriving/henvisning.ts (new file, avoids a cycle between brev.ts and saksmodell.ts)
export function henvisningFor(m: Saksmodell): ValgtHenvisning | null; // filters h.dato <= m.idag
JURIDISK.henvisning(v: ValgtHenvisning, f: Faktorer, kjoperTid: string | null): string;
```

- [ ] **Step 1: Skriv de feilende testene** i `brevplan.test.ts` (hjelperne `modell`, `svar`, `feilen` finnes i `./testdata`, `plan` i filen):

```ts
import { henvisningFor } from "./henvisning";

describe("henvisningen", () => {
  const foring = (m: Saksmodell) => planlegg(m).argumenter.find((a) => a.id === "henvisning")?.foring ?? "";
  // Bought 2023, the defect showed after more than two years: outside the presumption.
  const utenfor = (momenter?: Utfylling["momenter"]) => modell({ svar: svar({ kjopsdato: "2023-03-01", oppdaget: "over_2_ar" }), utfylling: { feilen, ...(momenter && { momenter }) } });

  it("sier rettsspørsmålet og at kjøpet var fra en næringsdrivende forhandler", () => {
    const t = foring(utenfor());
    expect(t).toMatch(/tok Forbrukerklageutvalget stilling til/);
    expect(t).toMatch(/næringsdrivende forhandler/);
  });

  it("«minst like sterkt» bare når kjøperen har alle momentene vedtaket ble vunnet på", () => {
    for (const m of [utenfor(), utenfor({ rapport_upaaregnelig: { svar: "Ja, at det er en konstruksjons- eller produksjonsfeil ved modellen" }, rapport_arsak: { svar: "Den angir en konkret årsak etter å ha undersøkt bilen" } })]) {
      const v = henvisningFor(m)!;
      expect(foring(m).includes("minst like sterkt")).toBe(v.mangler.length === 0);
    }
  });

  it("et moment besvart med egne ord teller ikke som dekket", () => {
    expect(kjoperFor(utenfor({ rapport_upaaregnelig: { egen: "Verkstedet sa at det var rart" } })).dekket.has("rapport_upaaregnelig")).toBe(false);
  });

  it("gjengir det utvalget la vekt på, uten merke og modell", () => {
    const m = utenfor();
    const v = henvisningFor(m)!;
    expect(foring(m)).toContain(v.henvisning.begrunnelse);
    expect(foring(m)).not.toMatch(/Volkswagen|Toyota|Mercedes|BMW|Volvo|Audi|Nissan|Ford|Mitsubishi|Tesla|Peugeot|Subaru/);
  });
});
```
  Importer `kjoperFor` og `Saksmodell` fra `./saksmodell` og `Utfylling` fra `../utfylling`.
- [ ] **Step 2:** `npx vitest run src/lib/brev/skriving/brevplan.test.ts`. Forventet: FAIL.
- [ ] **Step 3: `kjoperFor`** i `saksmodell.ts`:

```ts
// What the cited decision is compared with besides the answers: the moments the buyer has a favourable
// answer to (own words do not count), and what the buyer was told before buying.
export function kjoperFor(m: Pick<Saksmodell, "faktorer" | "utfylling" | "avklaringer" | "input">): Kjoper {
  const u = m.utfylling;
  const besvart = besvarteMomenter(u.momenter, { vedKjop: m.input.bilOgKjop.kmVedKjop, vedFeil: u.kmVedFeil }, m.avklaringer);
  const dekket = new Set(besvart.filter((b) => b.gunstig).map((b) => b.moment.id));
  // A report that says the defect was there before the purchase names a cause the committee can rely on.
  if (u.rapport) dekket.add("rapport_arsak");
  const opplyst = m.input.feilen.opplystForKjop === "ja" ? "feilen_opplyst" : u.forbehold === "som_den_er" ? "som_den_er" : "ingenting";
  return { dekket, opplyst };
}
```
- [ ] **Step 4: `henvisningFor`** i den nye filen `src/lib/brev/skriving/henvisning.ts`. Sjekk først at `lagSaksmodell` setter `faktorer.bilAlder` fra `utfylling.kjoretoy.ar`; gjør den ikke det, flytt `medBilAr` fra `brev.ts` inn i `lagSaksmodell` (begge brukerne skal ha bilens årstall):

```ts
// The decision the letter cites, from the buyer's moments as well as the answers; never one newer than the letter.
export function henvisningFor(m: Saksmodell): ValgtHenvisning | null {
  return velgHenvisning(m.faktorer, kjoperFor(m), HENVISNINGER.filter((h) => h.dato <= m.idag));
}
```
- [ ] **Step 5: Føringen.** Erstatt `JURIDISK.henvisning` i `brev.ts`:

```ts
const SPORSMAL_TEKST: Record<string, string> = {
  forventning: "om bilen var i dårligere stand enn kjøperen hadde grunn til å forvente ut fra alder, kilometerstand og pris, eller om feilen var normal slitasje",
  opplysning: "om forhandleren hadde gitt uriktige eller mangelfulle opplysninger om bilen",
  "forventning+levering": "om en feil som viser seg lenge etter kjøpet, likevel skyldes forhold som var der ved leveringen, slik at bilen ikke svarer til det kjøperen hadde grunn til å forvente",
  "opplysning+levering": "om forhandleren hadde gitt uriktige eller mangelfulle opplysninger om bilen, og om feilen var der ved leveringen",
};
const KORT_SPORSMAL: Record<string, string> = { forventning: "hva kjøperen kunne forvente av bilen", opplysning: "hva forhandleren opplyste om bilen", levering: "om feilen var der ved leveringen" };
export const GRUPPE_NAVN: Record<Gruppe, string> = {
  motor: "motoren", elektrisk: "det elektriske anlegget", understell: "understellet", km_service: "kilometerstand og servicehistorikk",
  rust: "rust", bremser: "bremsene", girkasse: "girkassen", fukt: "fukt og lekkasje", klimaanlegg: "klimaanlegget", skade: "en tidligere skade", batteri: "batteriet",
};
const OPPLYST_VEDTAK: Record<Opplyst, string> = { ingenting: "Forhandleren hadde ikke opplyst om feilen.", som_den_er: "Bilen var solgt «som den er».", feilen_opplyst: "Forhandleren hadde opplyst om forholdet før kjøpet." };
const STERKERE: Record<Faktum, string> = { alder: "en nyere bil", km: "kortere kjørelengde", pris: "en dyrere bil", opplyst: "mindre opplyst om feilen før kjøpet", tid: "feilen viste seg tidligere etter kjøpet" };
const SVAKERE: Record<Faktum, string> = { alder: "Min bil var eldre enn bilen i vedtaket.", km: "Min bil hadde gått lenger enn bilen i vedtaket.", pris: "Min bil kostet mindre enn bilen i vedtaket.", opplyst: "I min sak var mer opplyst før kjøpet enn i vedtaket.", tid: "Feilen viste seg senere etter kjøpet i min sak enn i vedtaket." };

// Law first, then the decision, as a lawyer would cite it (spec 2026-10-08): the same legal question and a
// consumer buying from a dealer; the facts of the decision, what the committee relied on and the outcome;
// the buyer's case where it holds, from the stronger case to the weaker; and briefly what differs against
// the buyer. No make, model or amounts awarded.
henvisning: (v: ValgtHenvisning, f: Faktorer, kjoperTid: string | null) => {
  const h = v.henvisning;
  const kilde = `${h.ref} av ${norskDato(h.dato)}`;
  const nokkel = v.sporsmal.join("+");
  const del1 = v.sammeSporsmal && SPORSMAL_TEKST[nokkel]
    ? `I vedtak ${kilde} tok ${h.organ} stilling til det samme spørsmålet som denne saken gjelder, i et kjøp der en forbruker kjøpte bil av en næringsdrivende forhandler: ${SPORSMAL_TEKST[nokkel]}.`
    : `I vedtak ${kilde} tok ${h.organ} stilling til om en bil som en forbruker hadde kjøpt av en næringsdrivende forhandler, hadde en mangel.`;
  const pris = [...v.sterkere, ...v.svakere].includes("pris") ? `, for ${kroner(h.pris)}` : "";
  const del2 = `Bilen var ${h.alder} år gammel${h.km !== null ? ` og hadde gått ${kroner(h.km).replace(/ kr$/, "")} km` : ""} da den ble kjøpt${pris}. ${OPPLYST_VEDTAK[h.opplyst]} ${medPunktum(`${h.feil.charAt(0).toUpperCase()}${h.feil.slice(1)} viste seg ${h.tid}`)} ${medPunktum(h.begrunnelse)} Kjøperen fikk ${utenPunktum(h.utfall)}.`;
  const fakta = [
    f.bilAlder !== null && `bilen var ${f.bilAlder} år gammel`,
    f.kmVedKjop !== null && `hadde gått ${kroner(f.kmVedKjop).replace(/ kr$/, "")} km`,
    f.kjopesumNok !== null && `kostet ${kroner(f.kjopesumNok)}`,
    kjoperTid && `feilen viste seg ${kjoperTid}`,
  ].filter(Boolean).join(", ");
  const sammenligning = v.sterkere.length ? ` Sammenlignet med vedtaket: ${v.sterkere.map((x) => STERKERE[x]).join(", ")}.` : "";
  const likt = v.likt.includes("opplyst") ? " Feilen var heller ikke opplyst før kjøpet." : "";
  const del3 = v.mangler.length === 0
    ? `De samme momentene trekker minst like sterkt i min sak.${v.dekket.length ? ` Vis kort til det i saken som svarer til: ${v.dekket.map((id) => moment(id)?.navn.toLowerCase()).join(", ")}.` : ""} Min sak: ${fakta}.${sammenligning}${likt}`
    : `Min sak: ${fakta}.${sammenligning}${likt} Skriv ikke at momentene trekker like sterkt.`;
  const lov = f.presumsjonManeder === 24 && f.oppdaget !== "innen_6_mnd" && h.lov === "før_2024"
    ? ` Vedtaket gjelder et kjøp før lovendringen 1. januar 2024${h.presumsjon ? ", da formodningsperioden i § 18 var seks måneder; den er nå to år" : ""}. Reglene vedtaket bygger på, er ikke endret til kjøperens ugunst.`
    : "";
  const grupper = grupperFor(f);
  const annen = v.annenFeil && grupper[0] ? ` Vedtaket gjaldt ${GRUPPE_NAVN[h.gruppe]} og ikke ${GRUPPE_NAVN[grupper[0]]}, men spørsmålet er det samme: ${KORT_SPORSMAL[v.sporsmal.at(-1) ?? "forventning"]}.` : "";
  const del4 = `${v.svakere.map((x) => ` ${SVAKERE[x]}`).join("")}${annen}${lov}`.trim();
  return [del1, del2, del3, del4 && `Kort, uten motargument: ${del4}`].filter(Boolean).join("\n\n");
},
```
  Importer `moment` fra `./momenter` og `grupperFor`, `Faktum`, `Opplyst`, `Gruppe`, `ValgtHenvisning` fra `@/lib/vurdering/henvisninger`. `henvisning.ts` importerer `kjoperFor` fra `./saksmodell`; `brevside.tsx`, `brevplan.ts` og mappen importerer `henvisningFor` fra `@/lib/brev/skriving/henvisning`.
- [ ] **Step 6:** I `brevplan.ts`, erstatt henvisningsdelen (søk etter `velgHenvisning(f, HENVISNINGER.filter`):

```ts
// The decision the letter cites (spec 2026-10-08); its source is a mark, the numbers of both cases are data.
const valgt = henvisningFor(m);
let henvisning: Kildehenvisning | null = null;
if (valgt) {
  const h = valgt.henvisning;
  henvisning = { ref: h.ref, organ: h.organ, dato: h.dato, kildeUrl: h.kildeUrl };
  merker.push("henvisning");
  const kjoperTid = u.feilen?.dato ? `${maneder(kjopsdato, u.feilen.dato)} måneder etter kjøpet` : null;
  legg("henvisning", JURIDISK.henvisning(valgt, f, kjoperTid).replace(`${h.ref} av ${norskDato(h.dato)}`, "{{henvisning}}"), {
    vedtak: { alder: h.alder, km: h.km, pris: h.pris },
    kjoper: { alder: f.bilAlder, km: f.kmVedKjop, pris: f.kjopesumNok },
    dekket: valgt.dekket, mangler: valgt.mangler, sterkere: valgt.sterkere, svakere: valgt.svakere,
  });
}
```
  `maneder` finnes i `sjekk.ts`; flytt den til `src/lib/vurdering/faktorer.ts` (eksportert, ved siden av `leggTilManeder`) og importer den begge steder.
- [ ] **Step 7:** `npx vitest run src/lib/brev/skriving`. Forventet: PASS (også `kontroll.test.ts` og `render.test.ts`; feiler de, les feilen — en annen økt kan ha endret dem).
- [ ] **Step 8:** Skriv ut føringen for saken `Aa1wun3jAQA6REHjCglH-A` med et midlertidig skript (`lagSaksmodell` + `planlegg`, skriv bare `foring` for `henvisning`; ingen personopplysninger) og les den mot kvalitetsmålet i spec-en avsnitt 4. Slett skriptet.
- [ ] **Step 9 (når godkjent):** commit: «Brevet: henvisning etter rettsspørsmål og momenter».

---

### Task 6: Promptene

**Files:**
- Modify: `src/lib/ai/prompter.ts` (`BREV_FORFATTER_SYSTEM`, eksempelbrevene, `RUBRIKK`, `BREVSKRIV_VERSJON`)

- [ ] **Step 1:** I `BREV_FORFATTER_SYSTEM`, erstatt «Avsnittet om vedtaket står for seg selv.» med: «Avsnittet om vedtaket følger føringen: rettsspørsmålet og partene, vedtakets fakta, det utvalget la vekt på og utfallet, kjøperens sak der den står minst like sterkt, og kort det som skiller. Sammenligningen der («trekker minst like sterkt», «på en nyere bil med kortere kjørelengde») er ikke gradsord eller egen vurdering; den står fordi føringen har den. Skriv ikke at momentene trekker like sterkt når føringen ikke sier det.»
- [ ] **Step 2:** I regelen om `{{henvisning}}` (≈linje 173): «I vedtak {{henvisning}} behandlet …» → «I vedtak {{henvisning}} tok Forbrukerklageutvalget stilling til …».
- [ ] **Step 3:** Skriv om henvisningsavsnittet i de to eksempelbrevene (≈linje 102 og 132) til den nye formen, med eksempelet i spec-en avsnitt 4 som mal (uten merke og modell, med begrunnelse og utfall, kjøperens sak og én kort setning om annen feiltype).
- [ ] **Step 4:** I `RUBRIKK`: `tone` får tillegget «Sammenligningen med vedtaket i henvisningsavsnittet er ikke appell eller gradsord.»; `svakheter` får tillegget «Unntak: forskjellene mellom vedtaket og forbrukerens sak som står i henvisningsavsnittet, skal stå, kort og uten motargument.»
- [ ] **Step 5:** Øk `BREVSKRIV_VERSJON` med én (les gjeldende verdi først).
- [ ] **Step 6:** `npx vitest run src/lib/brev/skriving` (PASS). Spør brukeren om brev-eval skal kjøres (`npm run brev-eval`, ca. 0,2–0,4 USD per brev). Kjøres den: les dommerens setninger om henvisningsavsnittet, ikke bare poengene.
- [ ] **Step 7 (når godkjent):** commit: «Prompter: henvisningsavsnittet etter juristens råd».

---

### Task 7: Vurderingen uten eksempelvedtak

> Kjøres som skrevet. `docs/superpowers/specs/2026-10-08-tynnere-vurdering-design.md` bygger videre på den (tynnere skjema, ingen god/svak) i en egen plan etterpå.

**Files:**
- Modify: `src/lib/vurdering/vurder.ts:17,111,136`
- Modify: `src/app/api/vurder/route.ts:44-50`
- Modify: `src/app/vurdering/skjema.tsx` (`Resultat.eksempel`, `sammenligningTekst`, `BREV_MED_LIGNENDE`, `NESTE_PUNKTER`)
- Test: `src/lib/vurdering/vurder.test.ts`, `src/lib/vurdering/kombinasjoner.test.ts`

- [ ] **Step 1:** Fjern `eksempel` fra typen og begge returverdiene i `vurder.ts`, og importen av `velgHenvisning`.
- [ ] **Step 2:** Fjern `eksempel` fra svaret i `route.ts`.
- [ ] **Step 3:** I `skjema.tsx`: fjern `eksempel` fra `Resultat`; `sammenligningTekst(utvalg)` returnerer `{ ramme: \`Vi har sjekket saken din opp mot ${utvalg.vunnet} ${gruppe} fra Forbrukerklageutvalget som fikk medhold. I brevet viser vi til den av dem som passer best, og går gjennom det utvalget la vekt på, punkt for punkt mot din sak, så forhandleren ser hvorfor din sak står minst like sterkt.\`, setning: null }` (fjern `setning` helt hvis den da ikke brukes); `BREV_MED_LIGNENDE = "Vi finner en lignende sak som fikk medhold, og argumenterer for hvorfor din sak står minst like sterkt"`; legg «Mangler du noe utvalget la vekt på, for eksempel en vurdering fra verksted, sier vi fra før du sender» først i `NESTE_PUNKTER`.
- [ ] **Step 4:** Tester (bevisst endring): i `vurder.test.ts` fjern `expect(v.eksempel…)`-linjene (44, 106, 143) og testen «også en svak sak får en henvisning…» (252–256); i `kombinasjoner.test.ts` fjern `eksempel`-sjekkene (196, 200–209, 241–242), `sammeFeil`-telleren, og endre nøkkelsjekken til `"begrunnelse,niva,styrker,svakheter,tiltak,tittel,utvalg"`. Kjør `npx vitest run src/lib/vurdering` (PASS) og `npm run test:e2e` (PASS; e2e sjekker «Vi har sjekket saken din opp mot \d+ … vedtak»).
- [ ] **Step 5 (når godkjent):** commit: «Vurderingen: hva brevet gjør i stedet for eksempelvedtak».

---

### Task 8: Saksmappen viser sammenligningen

**Files:**
- Modify: `src/app/brev/mappe/kort.tsx` (`Henvisningsblokk`, fjern `LIKHET_TEKST`, `hvorfor`, `ogListe`)
- Modify: `src/app/brev/mappe/saksmappe.tsx`, `src/app/brev/brevside.tsx` (send `ValgtHenvisning` og kjøperens fakta inn)

- [ ] **Step 1:** `Henvisningsblokk({ v, f })`, der `f: Pick<Faktorer, "bilAlder" | "kmVedKjop" | "kjopesumNok">`: vis ref og dato, `begrunnelse`, «Kjøperen fikk {utfall}.», og en tabell:

```tsx
const RADER: [Faktum, string, (h: Henvisning) => string, string | null][] = [
  ["alder", "Bilens alder ved kjøpet", (h) => `${h.alder} år`, f.bilAlder !== null ? `${f.bilAlder} år` : null],
  ["km", "Kilometerstand", (h) => (h.km !== null ? `${h.km.toLocaleString("nb-NO")} km` : "–"), f.kmVedKjop !== null ? `${f.kmVedKjop.toLocaleString("nb-NO")} km` : null],
  ["pris", "Kjøpesum", (h) => kroner(h.pris), f.kjopesumNok !== null ? kroner(f.kjopesumNok) : null],
  ["tid", "Feilen viste seg", (h) => h.tid, null],
];
// one <tr> per row: label | I vedtaket | Din sak | «Sterkere» / «Svakere» / «Likt» from v.sterkere/svakere/likt
```
  og under tabellen momentene i `vekt`: «✓ {navn}» for `v.dekket`, «Mangler: {navn}» for `v.mangler`. Bruk tokenklasser (`text-muted-foreground` o.l.), ikke nye hex-farger.
- [ ] **Step 2:** `brevside.tsx`: `const henvisning = lest.ok ? henvisningFor(lest.modell) : null;` (erstatter `henvisningFor(input, idag, utfylling)`), og send `lest.modell.faktorer` med til `Saksmappe`.
- [ ] **Step 3:** `npx tsc --noEmit -p .` (0 feil). Sjekk i nettleseren: Saksmappe → «Brevet ditt viser til» viser tabellen og momentene for saken `Aa1wun3jAQA6REHjCglH-A`.
- [ ] **Step 4 (når godkjent):** commit: «Saksmappen: vedtaket mot din sak».

---

### Task 9: Råd i sjekken og i «Tilstandsrapport»

**Files:**
- Modify: `src/lib/brev/sjekk.ts` (`Advarsel.fast`, `uten_bevis`, ny `slitasje_uten_vurdering`, nye `moment_mangler`)
- Modify: `src/lib/vurdering/tiltak.ts` (eksporter verkstedteksten)
- Modify: `src/app/brev/steg/rapport.tsx` (råd når kjøperen svarer nei)

**Interfaces:**
- Produces: `export type Advarsel = { id: string; tekst: string; steg: string | null; alvor: "hard" | "myk"; fast?: true; handling?: string };` `handling` er nøkkelen trekk slås sammen på i Task 10. `export const VERKSTED_RAD: string` i `tiltak.ts`. `sjekkBrev(input, u, idag, valgt?: ValgtHenvisning | null)`.

- [ ] **Step 1:** I `tiltak.ts`: `export const VERKSTED_RAD = "Be et uavhengig verksted undersøke feilen og skrive hva den er, hva som er årsaken, om den sannsynligvis var til stede da du kjøpte bilen, og om den er mer enn normal slitasje for bilens alder og kilometerstand. De to siste er ofte avgjørende for resultatet. Ta vare på fakturaen.";` og bruk den i det første tiltaket.
- [ ] **Step 2:** I `sjekk.ts`: legg `fast: true` på advarslene `reklamert_sent`, `venter_lenge`, `foreldet`, `ikke_rettet_for_tidlig`, `reparert_uten_kontakt`, `ett_forsok` og `visste_om_feilen` (les hver først; er en av dem noe kjøperen kan rette, la den være uten). Sett `handling: "verksted"` på `uten_bevis`, `rapport_for_feilen` og `rapport_fra_privat`.
- [ ] **Step 3:** `uten_bevis`-teksten: `Feilen viste seg mer enn … etter kjøpet. Da er det du som må vise at feilen var der da du kjøpte bilen. ${VERKSTED_RAD}${valgt?.mangler.some((id) => id.startsWith("rapport_")) ? " I vedtaket brevet viser til, la utvalget vekt på en slik vurdering." : ""} Fyll inn det verkstedet skriver under «Tilstandsrapport».`
- [ ] **Step 4:** Ny advarsel etter `uten_bevis`:

```ts
// Brakes, clutch and the like wear out; the dealer will call it normal wear unless a workshop says otherwise.
const slitedel = moment("slitedel")?.gjelder.grupper ?? [];
const upaaregnelig = u.momenter?.rapport_upaaregnelig?.svar && moment("rapport_upaaregnelig")!.gunstig.includes(u.momenter.rapport_upaaregnelig.svar);
if (f.slitasjeAktuelt && grupperFor(f).some((g) => slitedel.includes(g)) && !upaaregnelig)
  legg({ id: "slitasje_uten_vurdering", alvor: "myk", steg: "rapport", handling: "verksted", tekst: "Forhandleren vil trolig si at dette er normal slitasje. Be verkstedet skrive om feilen er mer enn det som er vanlig for en bil med denne alderen og kilometerstanden." });
```
- [ ] **Step 5:** Ny advarsel per manglende moment, når `valgt` er gitt:

```ts
for (const id of valgt?.mangler ?? []) {
  const mo = moment(id);
  if (!mo) continue;
  legg({ id: `moment_mangler_${id}`, alvor: "myk", steg: mo.steg ?? null, handling: id.startsWith("rapport_") ? "verksted" : `moment:${id}`,
    tekst: `Vedtaket brevet viser til, og de andre som ligner din sak, ble vunnet blant annet fordi: ${mo.navn.toLowerCase()}. Det har du ikke ennå.${id.startsWith("rapport_") ? ` ${VERKSTED_RAD}` : ""}` });
}
```
  Valget tar alltid vedtaket med færrest manglende momenter, så et moment som mangler i det valgte, mangler i alle like gode kandidater; derfor «og de andre som ligner din sak» (spec avsnitt 5). Kallstedene (`brevside.tsx`, `konsekvenserAv` i `src/lib/brev/konsekvenser.ts`, `PATCH /api/sak/[id]`, nedlastingsruten) sender `valgt` når de har `lest.modell` (`henvisningFor(lest.modell)`); ellers `undefined`.
- [ ] **Step 6:** `rapport.tsx`: når `rapport === "nei"`, vis under spørsmålet `<p className={HJELP}>{VERKSTED_RAD}</p>`.
- [ ] **Step 7:** `npx tsc --noEmit -p .` og `npx vitest run` (PASS). Sjekk i nettleseren at saken `Aa1wun3jAQA6REHjCglH-A` får `uten_bevis` med verkstedrådet og `slitasje_uten_vurdering` (bremser).
- [ ] **Step 8 (når godkjent):** commit: «Sjekken: hva som må innhentes før brevet sendes».

---

### Task 10: Score-fanen

**Files:**
- Create: `src/lib/brev/score.ts`
- Create: `src/app/brev/score.tsx`
- Modify: `src/app/brev/brevside.tsx` (`Fane`, `FANER`, `FANE_TEKST`, `FANE_IKON`, `SjekkFoerSending` → `ScoreLinje`)

**Interfaces:**
- Consumes: `Advarsel` med `fast`/`handling` (Task 9), `ValgtHenvisning` (Task 4), `plan.mangler`, `utdatert`, `brev`
- Produces:

```ts
export type Trekk = { id: string; poeng: number; tekst: string; steg: string | null; ma: boolean };
export type Score = { prosent: number; trekk: Trekk[]; faste: Advarsel[] };
export function scoreFor(a: { advarsler: Advarsel[]; gule: { tekst: string; steg: string | null }[]; skrevet: boolean; utdatert: boolean; ubesvarte: { id: string; steg: string | null }[] }): Score;
```

- [ ] **Step 1:** `src/lib/brev/score.ts`:

```ts
import type { Advarsel } from "./sjekk";

// How well the letter is supported by what the committee has relied on in similar cases (spec 2026-10-08,
// section 8). Only what the buyer can improve counts; what cannot be changed is listed without a deduction.
// Not the chance of winning.
export type Trekk = { id: string; poeng: number; tekst: string; steg: string | null; ma: boolean };
export type Score = { prosent: number; trekk: Trekk[]; faste: Advarsel[] };

const POENG = { hard: 20, gult: 10, skriv: 10, myk: 5, ubesvart: 3 } as const;

export function scoreFor(a: { advarsler: Advarsel[]; gule: { tekst: string; steg: string | null }[]; skrevet: boolean; utdatert: boolean; ubesvarte: { id: string; steg: string | null }[] }): Score {
  const faste = a.advarsler.filter((x) => x.fast);
  const alle: (Trekk & { handling: string })[] = [
    ...a.advarsler.filter((x) => !x.fast).map((x) => ({
      id: x.id, handling: x.handling ?? x.id, tekst: x.tekst, steg: x.steg,
      // A decisive moment the cited decision was won on counts as much as a hard warning.
      poeng: x.alvor === "hard" || x.id.startsWith("moment_mangler_") ? POENG.hard : POENG.myk,
      ma: x.alvor === "hard" || x.id.startsWith("moment_mangler_"),
    })),
    ...a.gule.map((g, n) => ({ id: `gult-${n}`, handling: `gult-${n}`, tekst: `Fyll ut: ${g.tekst}.`, steg: g.steg, poeng: POENG.gult, ma: false })),
    ...(!a.skrevet || a.utdatert ? [{ id: "skriv", handling: "skriv", tekst: a.skrevet ? "Skriv brevet på nytt, så endringene kommer med." : "Skriv brevet.", steg: null, poeng: POENG.skriv, ma: false }] : []),
    ...a.ubesvarte.map((u) => ({ id: `ubesvart-${u.id}`, handling: `moment:${u.id}`, tekst: "Svar på spørsmålet i steget.", steg: u.steg, poeng: POENG.ubesvart, ma: false })),
  ];
  // One action, one deduction: the largest of those it would fix.
  const per = new Map<string, Trekk & { handling: string }>();
  for (const t of alle) {
    const f = per.get(t.handling);
    if (!f || t.poeng > f.poeng) per.set(t.handling, { ...t, ma: t.ma || Boolean(f?.ma) });
  }
  const trekk = [...per.values()].map(({ handling: _, ...t }) => t).sort((x, y) => y.poeng - x.poeng);
  const prosent = Math.max(0, 100 - trekk.reduce((s, t) => s + t.poeng, 0));
  return { prosent, trekk, faste };
}
```
  «Få en vurdering fra verksted» som felles tekst: når `handling === "verksted"` vinner, bruk `"Få en vurdering fra verksted av når feilen oppsto og om den er mer enn normal slitasje."` som `tekst` (sett det i løkken: `tekst: t.handling === "verksted" ? VERKSTED_TITTEL : t.tekst`, med `const VERKSTED_TITTEL = "…"` øverst).
- [ ] **Step 2:** `src/app/brev/score.tsx`: `ScorePanel({ score, apne })` med tallet stort (`text-[40px] font-semibold`), setningen «Scoren viser hvor godt brevet er underbygget med det Forbrukerklageutvalget har lagt vekt på i lignende saker. Den sier ikke hvor stor sjanse du har for å vinne.», en liste «Gjør dette» (`−{poeng}` · tekst · «Må» merket når `ma` · «Rett dette»-knapp til `steg`, samme knappestil som i dag i `SjekkFoerSending`), og «Forhold du ikke kan endre» (tekstene i `faste`, uten knapp). Og `ScoreLinje({ score, vis })`: ved `prosent === 100` «Score 100 % · Brevet har det utvalget la vekt på i lignende saker.», ellers «Score {prosent} % · {trekk.length} ting kan gjøre brevet sterkere» med knappen «Se Score» som kaller `vis()`.
- [ ] **Step 3:** `brevside.tsx`: `type Fane = "brev" | "score" | "fyll" | "motsvar" | "mappe"`; `FANER = ["brev", "score", "fyll"]`; `FANE_TEKST.score = "Score"`; ikon `GaugeIcon` fra `lucide-react`. Regn ut scoren der `advarsler` regnes ut:

```ts
// The moments the steps ask in this case and the buyer has not answered.
const ubesvarte = lest.ok
  ? momenterFor(lest.modell.faktorer).filter((mo) => mo.steg && !utfylling.momenter?.[mo.id]).map((mo) => ({ id: mo.id, steg: mo.steg ?? null }))
  : [];
const score = scoreFor({ advarsler, gule: (plan?.mangler ?? []).map((g) => ({ tekst: g.tekst, steg: g.steg ?? null })), skrevet: !!brev, utdatert, ubesvarte });
```
  Les typen til `plan.mangler` (i `src/lib/brev/skriving/typer.ts`) og bruk de feltnavnene den har for tekst og steg. Steg-id-ene i `MOMENTER` (`kjopet`, `feilen`, `for-kjopet`, `kontakt`, `rapport`) er de samme som i `lagSteg`, så `apneSteg` kan brukes direkte. `valgt` (Task 9) regnes ut én gang her og sendes til `sjekkBrev`. Erstatt `<SjekkFoerSending …/>` med `<ScoreLinje score={score} vis={() => setFane("score")} />`. Når `fane === "score"`: vis `fyllKolonne` som i dag (ved siden av på bred skjerm) og `ScorePanel` i stedet for `brevKolonne`. Gule felt i brevet og bekreftelsen før nedlasting er uendret. Fjern `SjekkFoerSending` når den ikke brukes.
- [ ] **Step 4:** `npx tsc --noEmit -p .` og `npx eslint src/app/brev/score.tsx src/lib/brev/score.ts src/app/brev/brevside.tsx` (0 nye feil).
- [ ] **Step 5:** Sjekk i nettleseren (Playwright MCP), tre tilfeller:
  1. Saken `Aa1wun3jAQA6REHjCglH-A`: Score-fanen viser «Få en vurdering fra verksted …» med −20 én gang (ikke også −5 for `slitasje_uten_vurdering` eller momentet), og «Rett dette» åpner «Tilstandsrapport».
  2. En sak med to gule felt og ett ubesvart moment: trekkene er −10, −10, −3, og linjen over brevet viser riktig prosent og antall.
  3. En sak der alt er fylt ut og brevet er skrevet: «Score 100 %».
  Ingen tall under 0 (lag en sak med mange funn og se at den stopper på 0 %).
- [ ] **Step 6 (når godkjent):** commit: «Score-fanen».

---

### Task 11: Dokumentasjon og opprydding

**Files:**
- Modify: `CLAUDE.md` («Nivåer», «Henvisning i brevet», «Saksmappe», «Sjekk før sending», «Momentkatalog»)
- Modify: `docs/momenter.md` (de to momentene som nå spørres)

- [ ] **Step 1:** `CLAUDE.md`: «Nivåer» — fjern at vedtaket i vurderingen er det brevet viser til; vurderingen viser ingen henvisning. «Henvisning i brevet» — erstatt valget med spec-ens avsnitt 3 og formen med avsnitt 4 (kort), og at valget bare skjer på brevsiden (`henvisningFor(m: Saksmodell)`). «Sjekk før sending» — nevn Score-fanen (`scoreFor`, `src/lib/brev/score.ts`), `fast` og `handling`. «Momentkatalog» — `ALLTID_SPURT`.
- [ ] **Step 2:** `docs/momenter.md`: under metoden, at `rapport_arsak` og `forhandler_annen_arsak` spørres fordi henvisningen sammenlignes på dem, selv om de ikke skiller.
- [ ] **Step 3:** Kjør alt: `npx tsc --noEmit -p .`, `npx vitest run`, `npm run sjekk-henvisninger`, `npm run sjekk-momenter`, `npm run test:e2e`. Alle grønne (eller: les feilen, og rapporter feil som skyldes en annen økt i stedet for å rette dem).
- [ ] **Step 4 (når godkjent):** commit: «Dokumentasjon: henvisning, råd og score».
