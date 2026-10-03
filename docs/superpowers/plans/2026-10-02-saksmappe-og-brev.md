# Saksmappe og sterkere brev – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the letter page worth 249 kr: a stronger letter, PDF/Word export, and a «saksmappe» (case file) that uses the ~3 600 decisions in `vedtak` to help the buyer understand, strengthen and follow up the case.

**Architecture:** The letter stays a pure function of the case (`byggBrev`). The saksmappe is computed per request by a pure builder (`byggMappe`) that takes its data from an injected interface (`MappeData`), with a SQL implementation (`lagMappeData`) over `vedtak` — the same pattern as `vurder()` / `HentStatistikk`. Nothing new is stored except three small fields in `brevsak.utfylling`. Export is generated on the server from the same `Brev` shape.

**Tech Stack:** Next.js 16 (App Router; read `node_modules/next/dist/docs/` for route-handler conventions before writing routes — this is not the Next.js you know), Drizzle + Neon, Vitest, Playwright, `docx` and `pdf-lib` (new), `jszip` (new, dev only).

**Spec:** `docs/superpowers/specs/2026-10-02-saksmappe-og-brev-design.md`

**Deviations from the spec (decided while planning, all small):**
- `bilstand.km` is not collected again: km is already answered in the assessment (`svar.kmVedKjop`, required). Only `forbehold` is new.
- `lignende` is `{ id, moment }[]` (the buyer also picks *which* key point of the decision to cite), not `number[]`, because the key points are model summaries and the first one is often procedural.
- New field `sendt?: string` (the day the buyer sent the letter) so the reminder letter and deadlines have a real date.
- Download paths are `/api/sak/[id]/dokument/brev.pdf` etc. (one dynamic route) instead of four routes.
- The sample for the saksmappe uses the same ladder and `MIN_UTVALG = 30` as the assessment, so the two never disagree; `MIN_N = 10` only guards sub-breakdowns inside the sample.

## Global Constraints

- All user-facing text is Norwegian bokmål; code, identifiers' domain words and comments follow the surrounding code (English comments, Norwegian domain names).
- «Alle tall er *gitt vedtak*» and the sample size always appear next to a number. Below the threshold the UI says «for få saker» and shows no number.
- Thresholds: `MIN_N = 10` (shares inside a sample), `MIN_N_FORHANDLER = 3`, `MIN_N_MODELL = 5`, `MIN_UTVALG = 30` (choice of ladder step, exported from `src/lib/vurdering/statistikk.ts`).
- Example decisions must satisfy: `trenger_kontroll = false`, `konfidens >= 0.85`, `qa_status <> 'feil'`, a quote for `utfall` (`sitater ? 'utfall'`), `saksnummer` and `vedtaksdato` present, at least one key point. Dealer decisions only (`selger_type = 'forhandler'`).
- Key points are model summaries, not verbatim: every place they are shown carries «Les vedtaket før du bruker det» and links to `kilde_url`.
- `feiltyper` matches are «påberopt, ikke godtatt» until `godtatte_feiltyper` exists; the UI says so.
- Never store or show raw PDF text, names, addresses or plates from `vedtak`; never use `fulltekst_renset`. Nothing from `brevsak` (name, address, plate, free text) goes to a language model; the saksmappe uses no model calls. Nothing from a case is logged.
- Access to a case is only by its id (`erSakId`); no lists, no lookups by anything else. Every route rate-limits with `lagGrense`.
- Legal wording lives in one table (`JURIDISK` in `src/lib/brev/brev.ts`) so a lawyer can read it; the final report says it has not been reviewed by a lawyer.
- Playwright rules from CLAUDE.md: import `test`/`expect` from `e2e/fixtures.ts`; roles and labels, not test ids; web-first assertions; never `waitForTimeout`/`networkidle`; made-up test data only; mock language-model calls and the Vegvesen/Brreg lookups; the saksmappe tests run against the real database and assert structure, not counts.
- Done = `npm test`, `npm run typecheck` and `npm run test:e2e` green, output pasted in the final summary. Never weaken an expectation or skip a test to get green.
- Commit only when the user asks. Steps below say «Checkpoint» where a commit would go; do not run `git commit` unless the user has asked for commits.

## Review Focus

- A car/dealer with zero or one matching decision (unknown make, empty dealer name, Brreg name that normalises to «null»): the card says «for få saker», nothing throws, no `NaN` or `Infinity` (a percentage of 0 cases) appears. Test in Task 5 (`aktorer`) and Task 6 (route returns 200 with a thin sample).
- Characters outside the PDF font's range (æøå are fine; «Ł», emoji, zero-width characters in a pasted name): PDF export substitutes `?` and still produces a valid file. Test in Task 4.
- A very long dealer name or address line, and a paragraph longer than a page: PDF wraps and paginates. Test in Task 4.
- Two quick saves of different fields (ticking a checklist item while «Ta med i brevet» is saved) must not lose either: `PATCH` merges by field, and the client sends only the changed field. Test in Task 7 (e2e: tick, add example, reload, both present).
- Tampered `lignende` ids (a decision that is not an eligible example, or an id that does not exist): the letter simply omits it; the case still opens. Test in Task 6 (`hentLignende`) and Task 8.
- Case whose answers now give `fristUte` or an invalid assessment: the saksmappe endpoint answers 409 with a readable message and the tab shows it; the download endpoint answers 409; the letter page is unaffected. Test in Task 6 and Task 7.
- Expired or deleted case on download or on the mappe route: 404, no file. Test in Task 4 and Task 6.

---

## File structure

Create:
- `src/lib/wilson.ts` — `wilson()` moved out of the DB-importing module so pure code and unit tests can use it.
- `src/lib/brev/eksport.ts` — `harPlassholder`, `tilDocx`, `tilPdf`.
- `src/lib/brev/dokument.ts` — `brevForSak`, `purringForSak`: build the `Brev` for a stored case (resolves cited decisions).
- `src/lib/brev/purring.ts` — `byggPurring`.
- `src/lib/mappe/typer.ts` — thresholds, `Andel`, `MappeData` and all card types.
- `src/lib/mappe/tekster.ts` — Norwegian labels for the database's enum values.
- `src/lib/mappe/kort/styrke.ts`, `belop.ts`, `avgjorde.ts`, `aktorer.ts`, `styrk.ts`, `videre.ts` — one pure builder per card (+ `*.test.ts` each).
- `src/lib/mappe/bygg.ts` (+ `bygg.test.ts`) — `byggMappe`.
- `src/lib/mappe/hent.ts` — `lagMappeData`, `hentLignende` (SQL).
- `src/lib/mappe/hent.test.ts` — integration test against the real database (skips without `DATABASE_URL`).
- `src/lib/vurdering/tid.ts` — `TID_TIL_VEDTAK` moved from `skjema.tsx`.
- `src/app/api/sak/[id]/mappe/route.ts`, `src/app/api/sak/[id]/dokument/[fil]/route.ts`.
- `src/app/brev/mappe/saksmappe.tsx` (+ `kort.tsx`) — the tab.
- `e2e/saksmappe.spec.ts`, `e2e/eksport.spec.ts`, `specs/saksmappe.md`.

Modify: `src/lib/brev/utfylling.ts`, `src/lib/brev/brev.ts`, `src/lib/brev/sak.ts` (nothing structural), `src/lib/data/statistikk.ts` (re-export `wilson`), `src/lib/vurdering/statistikk.ts` (export `MIN_UTVALG`), `src/app/brev/felt.tsx`, `src/app/brev/brevside.tsx`, `src/app/brev/[id]/page.tsx`, `src/app/api/sak/[id]/route.ts` and `src/app/api/sak/[id]/svar/route.ts` (return resolved `lignende`), `src/app/vurdering/skjema.tsx` (import `TID_TIL_VEDTAK`), `e2e/brev.spec.ts`, `e2e/fixtures.ts`, `CLAUDE.md`.

---

### Task 1: New fields in the fill-in (`forbehold`, `lignende`, `sjekket`, `sendt`)

**Files:**
- Modify: `src/lib/brev/utfylling.ts`
- Test: `src/lib/brev/utfylling.test.ts`

**Interfaces:**
- Produces (used by every later task):
  ```ts
  export const FORBEHOLD_VALG = ["som_den_er", "garanti", "ingen", "vet_ikke"] as const;
  export type Forbehold = (typeof FORBEHOLD_VALG)[number];
  export const MAKS_LIGNENDE = 3;
  export type Lignende = { id: number; moment: number };       // decision id, index of the cited key point
  export const SJEKK_NOKLER = ["rapport_tidspunkt", "bilder", "annonse", "meldinger", "kontrakt", "kvitteringer"] as const;
  export type SjekkNokkel = (typeof SJEKK_NOKLER)[number];
  // Utfylling gains: forbehold?: Forbehold; lignende?: Lignende[]; sjekket?: SjekkNokkel[]; sendt?: string;
  ```

- [ ] **Step 1: Write the failing tests** — append to `src/lib/brev/utfylling.test.ts`:

```ts
describe("lesEndring: forbehold, lignende, sjekket, sendt", () => {
  it("godtar et forbehold fra listen og avviser andre", () => {
    expect(lest({ forbehold: "som_den_er" })).toEqual({ forbehold: "som_den_er" });
    expect(ok({ forbehold: "noe_annet" })).toBe(false);
  });

  it("godtar opptil tre ulike vedtak med valgt nøkkelmoment", () => {
    expect(lest({ lignende: [{ id: 12, moment: 0 }, { id: 40, moment: 2 }] })).toEqual({ lignende: [{ id: 12, moment: 0 }, { id: 40, moment: 2 }] });
    expect(lest({ lignende: [] })).toEqual({ lignende: [] });
  });

  it("avviser fire vedtak, samme vedtak to ganger, ugyldig id og ugyldig moment", () => {
    const v = (id: number) => ({ id, moment: 0 });
    expect(ok({ lignende: [v(1), v(2), v(3), v(4)] })).toBe(false);
    expect(ok({ lignende: [v(1), v(1)] })).toBe(false);
    expect(ok({ lignende: [{ id: 0, moment: 0 }] })).toBe(false);
    expect(ok({ lignende: [{ id: 1.5, moment: 0 }] })).toBe(false);
    expect(ok({ lignende: [{ id: 1, moment: 10 }] })).toBe(false);
    expect(ok({ lignende: ["1"] })).toBe(false);
  });

  it("godtar kjente sjekkpunkter, i fast rekkefølge og uten dubletter, og avviser ukjente", () => {
    expect(lest({ sjekket: ["bilder", "annonse", "bilder"] })).toEqual({ sjekket: ["bilder", "annonse"] });
    expect(ok({ sjekket: ["finnes_ikke"] })).toBe(false);
  });

  it("godtar en sendt-dato fra kjøpet og til i dag, ikke før eller etter", () => {
    expect(lest({ sendt: "2026-09-20" })).toEqual({ sendt: "2026-09-20" });
    expect(ok({ sendt: "2026-03-11" })).toBe(false);
    expect(ok({ sendt: "2026-10-03" })).toBe(false);
    expect(ok({ sendt: "ikke en dato" })).toBe(false);
  });

  it("null fjerner feltet", () => {
    expect(medEndring({ forbehold: "ingen", sjekket: ["bilder"] }, { forbehold: null })).toEqual({ sjekket: ["bilder"] });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/brev/utfylling.test.ts`
Expected: FAIL (new fields are «Ugyldig forespørsel», so `lest(...)` returns null).

- [ ] **Step 3: Implement** — in `src/lib/brev/utfylling.ts`:

After `export type Vedlegg = (typeof VEDLEGG)[number];` add:

```ts
// What the contract or the ad said about the car being sold as it is, or about a warranty.
export const FORBEHOLD_VALG = ["som_den_er", "garanti", "ingen", "vet_ikke"] as const;
export type Forbehold = (typeof FORBEHOLD_VALG)[number];

// Earlier decisions the buyer cites in the letter: the decision and which of its key points.
export const MAKS_LIGNENDE = 3;
export type Lignende = { id: number; moment: number };

// The points of the checklist in the saksmappe the buyer has ticked off.
export const SJEKK_NOKLER = ["rapport_tidspunkt", "bilder", "annonse", "meldinger", "kontrakt", "kvitteringer"] as const;
export type SjekkNokkel = (typeof SJEKK_NOKLER)[number];
```

In `Utfylling` add (before `sprakvask`):

```ts
  forbehold?: Forbehold;
  lignende?: Lignende[];
  sjekket?: SjekkNokkel[];
  // The day the letter was sent, for the reminder and the deadlines.
  sendt?: string;
```

Add readers above `LESERE` (after `lesAvsender`):

```ts
const lesForbehold = (v: unknown): Forbehold | null => (blant(FORBEHOLD_VALG, v) ? v : null);

function lesLignende(v: unknown): Lignende[] | null {
  if (!Array.isArray(v) || v.length > MAKS_LIGNENDE) return null;
  const ut: Lignende[] = [];
  for (const x of v) {
    if (!erObjekt(x) || !heltall(x.id, 1, 100_000_000) || !heltall(x.moment, 0, 9) || ut.some((y) => y.id === x.id)) return null;
    ut.push({ id: x.id, moment: x.moment });
  }
  return ut;
}

function lesSjekket(v: unknown): SjekkNokkel[] | null {
  if (!Array.isArray(v) || v.some((x) => !blant(SJEKK_NOKLER, x))) return null;
  return SJEKK_NOKLER.filter((x) => v.includes(x));
}

const lesSendt = (v: unknown, k: Kontekst): string | null => (etterKjop(v, k) ? v : null);
```

Extend `LESERE`:

```ts
  forbehold: lesForbehold,
  lignende: lesLignende,
  sjekket: lesSjekket,
  sendt: lesSendt,
```

In `tilpassTilSvar`, include `sendt` in the date loop: change `for (const felt of ["feilen", "reklamasjon"] as const)` body to also handle `sendt`:

```ts
  if (ny.sendt !== undefined && !(ny.sendt >= svar.kjopsdato && ny.sendt <= idag)) delete ny.sendt;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/brev/utfylling.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Checkpoint** — files: `src/lib/brev/utfylling.ts`, `src/lib/brev/utfylling.test.ts`.

---

### Task 2: Stronger letter text (`brev.ts`)

**Files:**
- Modify: `src/lib/brev/brev.ts`
- Create: `src/lib/brev/brev-krav.test.ts`
- Modify (only where output intentionally changed): `src/lib/brev/brev.test.ts`

**Interfaces:**
- Consumes: `Utfylling` (Task 1), `Faktorer` from `@/lib/vurdering/faktorer`.
- Produces:
  ```ts
  export type LignendeRef = { saksnummer: string; ar: number; utfall: "medhold" | "delvis_medhold"; moment: string; kildeUrl: string };
  export const JURIDISK: { ... };            // all legal wording, for a lawyer
  export function byggBrev(input: KlageInput, idag?: string, u?: Utfylling, lignende?: LignendeRef[]): Brev;
  ```

- [ ] **Step 1: Write the failing tests** — create `src/lib/brev/brev-krav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KlageInput } from "@/lib/vurdering/typer";
import { byggBrev, type LignendeRef } from "./brev";

const IDAG = "2026-10-02";
const klage = (feilen: Partial<KlageInput["feilen"]> = {}, bil: Partial<KlageInput["bilOgKjop"]> = {}): KlageInput => ({
  kvalifisering: { selgerType: "forhandler", privatBruk: true },
  bilOgKjop: { kjopsdato: "2026-03-12", kjopesumNok: 250000, kmVedKjop: 80000, ...bil },
  feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "avvist", ...feilen },
  bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: true },
});
const tekst = (...args: Parameters<typeof byggBrev>) => byggBrev(...args).avsnitt.join("\n");

describe("heving og prisavslag", () => {
  it("heving har subsidiært krav om prisavslag og krav om rente", () => {
    const t = tekst(klage(), IDAG, { krav: { type: "heving", utgifter: [] } });
    expect(t).toContain("hever kjøpet, jf. § 32");
    expect(t).toContain("subsidiært prisavslag");
    expect(t).toContain("forsinkelsesrenteloven §§ 2 og 3");
  });

  it("subsidiært prisavslag bruker utbedringskostnaden når den er oppgitt", () => {
    const t = tekst(klage(), IDAG, { krav: { type: "heving", utbedringNok: 42000, utgifter: [] } });
    expect(t).toContain("subsidiært prisavslag på 42 000 kr");
  });

  it("prisavslag har rentekrav, men et krav som ikke er valgt ennå har det ikke", () => {
    expect(tekst(klage(), IDAG, { krav: { type: "prisavslag", utgifter: [] } })).toContain("forsinkelsesrenteloven");
    expect(tekst(klage(), IDAG, {})).not.toContain("forsinkelsesrenteloven");
  });

  it("retting (forhandleren ikke kontaktet) har verken subsidiært krav eller rente", () => {
    const t = tekst(klage({ kontakt: "nei" }), IDAG, {});
    expect(t).not.toContain("subsidiært");
    expect(t).not.toContain("forsinkelsesrenteloven");
  });
});

describe("forbehold og slitasje", () => {
  it("«solgt som den er» gir et avsnitt som møter forbeholdet", () => {
    expect(tekst(klage(), IDAG, { forbehold: "som_den_er" })).toContain("«som den er»");
  });

  it("uten forbehold eller «vet ikke» kommer det ikke noe avsnitt om forbehold", () => {
    expect(tekst(klage(), IDAG, { forbehold: "ingen" })).not.toContain("«som den er»");
    expect(tekst(klage(), IDAG, { forbehold: "vet_ikke" })).not.toContain("«som den er»");
    expect(tekst(klage(), IDAG, {})).not.toContain("«som den er»");
  });

  it("slitasjeavsnittet nevner kilometerstanden", () => {
    expect(tekst(klage(), IDAG, {})).toContain("80 000 km");
  });

  it("feil som slitasje ikke kan forklare (kilometerstand) får ikke slitasjeavsnitt", () => {
    expect(tekst(klage({ typer: ["km_service"] }), IDAG, {})).not.toContain("normal slitasje");
  });
});

describe("lignende vedtak", () => {
  const ref = (o: Partial<LignendeRef> = {}): LignendeRef => ({
    saksnummer: "23/13923",
    ar: 2024,
    utfall: "delvis_medhold",
    moment: "Formodningsregelen gjaldt, og feilene ble anses å foreligge ved levering",
    kildeUrl: "https://example.test/v.pdf",
    ...o,
  });

  it("uten vedtak er det ikke noe avsnitt", () => {
    expect(tekst(klage(), IDAG, {}, [])).not.toContain("Forbrukerklageutvalgets behandling");
  });

  it("hvert vedtak står med saksnummer, år, utfall og nøkkelmoment som en egen setning", () => {
    const t = tekst(klage(), IDAG, {}, [ref(), ref({ saksnummer: "FKU-2025-140302", ar: 2025, utfall: "medhold", moment: "Feilen var dokumentert av verksted." })]);
    expect(t).toContain("Sak 23/13923 (2024, delvis medhold): Formodningsregelen gjaldt, og feilene ble anses å foreligge ved levering.");
    expect(t).toContain("Sak FKU-2025-140302 (2025, medhold): Feilen var dokumentert av verksted.");
  });

  it("vedtakene kommer før kravet, og vedlegg-linjen nevner ikke vedtakene", () => {
    const b = byggBrev(klage(), IDAG, {}, [ref()]);
    const iLignende = b.avsnitt.findIndex((a) => a.includes("Forbrukerklageutvalgets behandling"));
    const iKrav = b.avsnitt.findIndex((a) => a.includes("Jeg reklamerer herved"));
    expect(iLignende).toBeGreaterThan(-1);
    expect(iLignende).toBeLessThan(iKrav);
    expect(b.avsnitt.at(-1)).not.toContain("23/13923");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/brev/brev-krav.test.ts`
Expected: FAIL (no subsidiary claim, no interest, no 4th parameter).

- [ ] **Step 3: Implement** — in `src/lib/brev/brev.ts`:

1. Imports: change the first import to `import { beregnFaktorer, iDag, type Faktorer } from "@/lib/vurdering/faktorer";` and the utfylling import to add `Forbehold`.

2. After `OPPLYSNING_PLASSHOLDER` add the legal table (every sentence that states a legal position, in one place):

```ts
// Legal wording that goes beyond restating a rule in the form: in one place so a lawyer can read it.
// Not reviewed by a lawyer yet.
const FORBEHOLD_AVSNITT: Record<Forbehold, string | null> = {
  som_den_er:
    "Selv om bilen ble solgt «som den er», fritar ikke det dere for ansvar overfor meg som forbruker. Et slikt forbehold kan ikke innskrenke rettighetene mine etter forbrukerkjøpsloven, jf. § 3.",
  garanti: "Garantien dere ga kommer i tillegg til rettighetene mine etter forbrukerkjøpsloven, og innskrenker dem ikke, jf. § 3.",
  ingen: null,
  vet_ikke: null,
};

export const JURIDISK = {
  hevingSubsidiart: (utbedringNok?: number) =>
    utbedringNok ? `Dersom dere ikke godtar heving, krever jeg subsidiært prisavslag på ${kroner(utbedringNok)}, jf. § 31.` : "Dersom dere ikke godtar heving, krever jeg subsidiært et forholdsmessig prisavslag, jf. § 31.",
  rente: "Jeg krever også forsinkelsesrente etter forsinkelsesrenteloven §§ 2 og 3 av det beløpet dere skylder meg, fra forfall til betaling skjer.",
  forbehold: FORBEHOLD_AVSNITT,
  slitasje: (km?: number) =>
    `Jeg bestrider at feilen er normal slitasje. ${km !== undefined ? `Bilen hadde gått ${km.toLocaleString("nb-NO").replace(/ /g, " ")} km da jeg kjøpte den, og ` : ""}feilen er mer omfattende enn jeg med rimelighet kunne vente ut fra bilens alder, kilometerstand og pris, jf. § 15.`,
  lignende: "Jeg viser til Forbrukerklageutvalgets behandling av lignende saker.",
} as const;
```

(`kroner` is defined below this line in the file; move `JURIDISK` after the `kroner` helper, or turn `kroner` into a function declaration — pick the former.)

3. Add the cited-decision type and helpers before `byggBrev`:

```ts
// A decision the buyer cites, resolved from the database (see mappe/hent.ts).
export type LignendeRef = { saksnummer: string; ar: number; utfall: "medhold" | "delvis_medhold"; moment: string; kildeUrl: string };

const UTFALL_TEKST = { medhold: "medhold", delvis_medhold: "delvis medhold" } as const;

function lignendeAvsnitt(refs: LignendeRef[]): string[] {
  if (refs.length === 0) return [];
  return [`${JURIDISK.lignende} ${refs.map((r) => `Sak ${r.saksnummer} (${r.ar}, ${UTFALL_TEKST[r.utfall]}): ${medPunktum(r.moment)}`).join(" ")}`];
}

function innvendinger(input: KlageInput, f: Faktorer, u: Utfylling): string[] {
  const ledd: string[] = [];
  const forbehold = u.forbehold && JURIDISK.forbehold[u.forbehold];
  if (forbehold) ledd.push(forbehold);
  if (f.slitasjeAktuelt) ledd.push(JURIDISK.slitasje(input.bilOgKjop.kmVedKjop));
  return ledd.length ? [ledd.join(" ")] : [];
}
```

4. In `krav()` change the two money branches:

```ts
  if (u.krav?.type === "heving") {
    const sum = input.bilOgKjop.kjopesumNok != null ? kroner(input.bilOgKjop.kjopesumNok) : "[kjøpesum]";
    return `${start} hever kjøpet, jf. § 32, og krever kjøpesummen på ${sum} tilbakebetalt mot at bilen leveres tilbake. ${JURIDISK.hevingSubsidiart(u.krav.utbedringNok)} ${JURIDISK.rente}`;
  }
  if (u.krav?.type === "prisavslag") {
    const avslag = u.krav.utbedringNok
      ? `${start} krever prisavslag på ${kroner(u.krav.utbedringNok)}, som tilsvarer kostnaden ved å få mangelen rettet, jf. § 31.`
      : `${start} krever et forholdsmessig prisavslag, jf. § 31.`;
    return `${avslag} ${JURIDISK.rente}`;
  }
```

5. In `byggBrev` add the 4th parameter and the new paragraphs:

```ts
export function byggBrev(input: KlageInput, idag = iDag(), u: Utfylling = {}, lignende: LignendeRef[] = []): Brev {
  const f = beregnFaktorer(input, idag);
  ...
    avsnitt: [
      kjopetOgFeilen(input, u),
      mangelOgBevisbyrde(input, idag, u),
      ...innvendinger(input, f, u),
      ...lignendeAvsnitt(lignende),
      krav(input, u),
      ...
```

(`mangelOgBevisbyrde` already computes its own `f`; leave it.)

- [ ] **Step 4: Run all letter tests**

Run: `npx vitest run src/lib/brev && npm run typecheck`
Expected: new tests PASS. If an older assertion in `brev.test.ts` fails because a paragraph legitimately gained a sentence (exact `toEqual` on a paragraph, or an index into `avsnitt`), update that assertion to the new text — do not delete it. Re-run until green.

- [ ] **Step 5: Checkpoint** — files: `src/lib/brev/brev.ts`, `brev-krav.test.ts`, `brev.test.ts`.

---

### Task 3: «Forbehold i kjøpet» step on the letter page

**Files:**
- Modify: `src/app/brev/felt.tsx`, `src/app/brev/brevside.tsx`
- Modify: `e2e/brev.spec.ts` (append a test)

**Interfaces:**
- Consumes: `Forbehold`, `FORBEHOLD_VALG` (Task 1); `Felles`, `Skjema`, `Sammendrag`, `LABEL` already in `felt.tsx`.
- Produces: `ForbeholdFelt` component; step id `"forbehold"`, title «Forbehold i kjøpet».

- [ ] **Step 1: Write the failing e2e test** — append to `e2e/brev.spec.ts` (uses the file's existing `svar()` and `AR`):

```ts
test("forbehold i kjøpet: valget lagres og gir et avsnitt i brevet", async ({ page, brev, sak }) => {
  await page.goto(
    await sak.apne(svar(), {
      forhandler: { type: "fritekst", navn: "Testbil AS" },
      feilen: { dato: `${AR - 1}-04-01`, egen: "Motoren mister kraft i motbakker og lampen lyser.", tekst: "Motoren mister kraft i motbakker og lampen lyser." },
      krav: { utgifter: [] },
    }),
  );
  const steg = brev.steg("Forbehold i kjøpet");
  await expect(brev.ark).not.toContainText("«som den er»");
  await steg.getByRole("radio", { name: "Ja, bilen ble solgt «som den er»" }).check();
  await brev.lagreKnapp("Forbehold i kjøpet").click();
  await expect(brev.ark).toContainText("fritar ikke det dere for ansvar");
  await expect(steg.getByRole("img", { name: "Ferdig" })).toBeVisible();

  await page.reload();
  await expect(brev.ark).toContainText("fritar ikke det dere for ansvar");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/brev.spec.ts -g "forbehold i kjøpet" --project=desktop`
Expected: FAIL (no such step).

- [ ] **Step 3: Implement.** In `felt.tsx` add `FORBEHOLD_VALG` and `type Forbehold` to the `@/lib/brev/utfylling` import, then:

```tsx
const FORBEHOLD_TEKST: Record<Forbehold, string> = {
  som_den_er: "Ja, bilen ble solgt «som den er»",
  garanti: "Nei, men bilen hadde garanti fra forhandleren",
  ingen: "Nei, ingen forbehold eller garanti",
  vet_ikke: "Jeg vet ikke",
};

// Did the contract or the ad say «som den er», or promise a warranty? Decides whether the letter
// meets a disclaimer. «Vet ikke» leaves it out.
export function ForbeholdFelt({ verdi, aktiv, lagre, avbryt }: Felles & { verdi: Forbehold | undefined }) {
  const [valg, setValg] = useState<Forbehold | null>(verdi ?? null);
  if (!aktiv) return verdi ? <Sammendrag linjer={[FORBEHOLD_TEKST[verdi]]} /> : null;
  return (
    <Skjema klar={valg !== null} send={() => lagre({ forbehold: valg! })} avbryt={avbryt}>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className={`${LABEL} mb-1`}>Sto det «solgt som den er» eller noe om garanti i kontrakten eller annonsen?</legend>
        {FORBEHOLD_VALG.map((v) => (
          <label key={v} className="flex items-start gap-2.5 text-[14px] leading-[1.45]">
            <input type="radio" name="forbehold" value={v} checked={valg === v} onChange={() => setValg(v)} className="mt-1" />
            {FORBEHOLD_TEKST[v]}
          </label>
        ))}
      </fieldset>
    </Skjema>
  );
}
```

In `brevside.tsx` import `ForbeholdFelt` and add this step to the `steg` array, directly **before** the `krav` step:

```tsx
    {
      id: "forbehold",
      tittel: "Forbehold i kjøpet",
      ferdig: utfylling.forbehold !== undefined,
      kanEndres: true,
      innhold: () => <ForbeholdFelt verdi={utfylling.forbehold} {...felles("forbehold")} />,
    },
```

- [ ] **Step 4: Run to verify pass, then the whole letter suite**

Run: `npx playwright test e2e/brev.spec.ts e2e/bil.spec.ts --project=desktop --project=mobil`
Expected: PASS. Existing tests that walk the steps in order now meet one extra step before «Kravet»: update them to fill it (choose «Nei, ingen forbehold eller garanti» and save) — never loosen what they assert.

- [ ] **Step 5: Look at it** — open the letter page with Playwright MCP at desktop and mobile width and confirm the new step reads well and the radios are tappable.

- [ ] **Step 6: Checkpoint** — `felt.tsx`, `brevside.tsx`, `e2e/brev.spec.ts`.

---

### Task 4: PDF and Word export

**Files:**
- Create: `src/lib/brev/eksport.ts`, `src/lib/brev/eksport.test.ts`, `src/lib/brev/dokument.ts`, `src/app/api/sak/[id]/dokument/[fil]/route.ts`, `e2e/eksport.spec.ts`
- Modify: `src/app/brev/brevside.tsx`, `package.json`

**Interfaces:**
- Consumes: `Brev`, `byggBrev` (Task 2), `hentSak`, `Sak`.
- Produces:
  ```ts
  export const harPlassholder: (b: Brev) => boolean;
  export function tilDocx(b: Brev): Promise<Uint8Array>;
  export function tilPdf(b: Brev): Promise<Uint8Array>;
  // dokument.ts
  export function brevForSak(sak: Sak, idag?: string): Promise<Brev | null>;   // null when the answers give no letter
  ```

- [ ] **Step 1: Install**

Run: `npm install docx pdf-lib && npm install -D jszip`
Expected: added to `package.json`; no peer-dependency errors. Read each package's README quickly for the version's API if `typecheck` complains in the next steps.

- [ ] **Step 2: Write the failing unit tests** — `src/lib/brev/eksport.test.ts`:

```ts
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { Brev } from "./brev";
import { harPlassholder, tilDocx, tilPdf } from "./eksport";

const brev = (o: Partial<Brev> = {}): Brev => ({
  avsender: ["Test Testesen", "Testveien 1", "0123 Oslo"],
  mottaker: ["Testbil AS", "Org.nr. 999 888 777", "Industriveien 3", "0184 Oslo"],
  stedDato: "Oslo, 2. oktober 2026",
  emne: "Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999",
  avsnitt: ["Jeg viser til kjøp av ovennevnte bil.", "Bilen har feil ved motoren."],
  hilsen: "Med vennlig hilsen",
  underskrift: "Test Testesen",
  ...o,
});
const tekstIn = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("harPlassholder", () => {
  it("ser hakeparenteser i hvilken som helst del av brevet", () => {
    expect(harPlassholder(brev())).toBe(false);
    expect(harPlassholder(brev({ underskrift: "[Ditt navn]" }))).toBe(true);
    expect(harPlassholder(brev({ avsnitt: ["Se [dato]."] }))).toBe(true);
  });
});

describe("tilPdf", () => {
  it("gir en gyldig PDF", async () => {
    const bytes = await tilPdf(brev());
    expect(tekstIn(bytes).startsWith("%PDF-")).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("tåler tegn utenfor fontens område uten å feile", async () => {
    const bytes = await tilPdf(brev({ avsender: ["Łukasz 😀 Kowalski​", "Testveien 1", "0123 Oslo"] }));
    expect(tekstIn(bytes).startsWith("%PDF-")).toBe(true);
  });

  it("bryter lange ord og avsnitt over flere sider", async () => {
    const lang = Array.from({ length: 60 }, () => "Dette er en lang setning om feilen som gjentas for å fylle flere sider.").join(" ");
    const bytes = await tilPdf(brev({ mottaker: ["A".repeat(200)], avsnitt: [lang, lang, lang, lang] }));
    expect(tekstIn(bytes).match(/\/Type\s*\/Page[^s]/g)?.length ?? 0).toBeGreaterThan(1);
  });
});

describe("tilDocx", () => {
  it("er en zip med brevteksten i word/document.xml", async () => {
    const bytes = await tilDocx(brev());
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Reklamasjon på mangel");
    expect(xml).toContain("Bilen har feil ved motoren.");
    expect(xml).toContain("Med vennlig hilsen");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/brev/eksport.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 4: Implement `src/lib/brev/eksport.ts`**

```ts
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import type { Brev } from "./brev";

// The letter as a file. Both formats are built from the same blocks as the page shows. Placeholders
// in square brackets stay in the file; the page warns about them (`harPlassholder`).

export const harPlassholder = (b: Brev) => [...b.avsender, ...b.mottaker, b.stedDato, b.emne, ...b.avsnitt, b.underskrift].some((t) => /\[[^\]]+\]/.test(t));

type Blokk = { linjer: string[]; fet?: boolean };

function blokker(b: Brev): Blokk[] {
  return [
    { linjer: b.avsender },
    { linjer: b.mottaker },
    { linjer: [b.stedDato] },
    { linjer: [b.emne], fet: true },
    ...b.avsnitt.map((a) => ({ linjer: [a] })),
    { linjer: [b.hilsen, b.underskrift] },
  ];
}

export async function tilDocx(b: Brev): Promise<Uint8Array> {
  const children = blokker(b).map(
    (bl) =>
      new Paragraph({
        spacing: { after: 240 },
        children: bl.linjer.map((l, n) => new TextRun({ text: l, bold: bl.fet, break: n > 0 ? 1 : 0 })),
      }),
  );
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 23 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1304, right: 1304 } } }, children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

// The standard PDF fonts cover Latin-1 and a few typographic marks; anything else becomes «?».
const UTENFOR_FONT = /[^ -~ -ÿ–—‘’“”•…]/g;
const trygg = (t: string) => t.replace(UTENFOR_FONT, "?");

function brytLinjer(tekst: string, font: PDFFont, storrelse: number, bredde: number): string[] {
  const ut: string[] = [];
  let linje = "";
  const legg = (ord: string) => {
    const prov = linje ? `${linje} ${ord}` : ord;
    if (linje && font.widthOfTextAtSize(prov, storrelse) > bredde) {
      ut.push(linje);
      linje = ord;
    } else linje = prov;
  };
  for (const ord of trygg(tekst).split(/\s+/).filter(Boolean)) {
    // A word wider than the line is cut at the line's width.
    let rest = ord;
    while (font.widthOfTextAtSize(rest, storrelse) > bredde) {
      let n = rest.length - 1;
      while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), storrelse) > bredde) n--;
      legg(rest.slice(0, n));
      ut.push(linje);
      linje = "";
      rest = rest.slice(n);
    }
    legg(rest);
  }
  if (linje) ut.push(linje);
  return ut;
}

export async function tilPdf(b: Brev): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [BREDDE_SIDE, HOYDE_SIDE, MARG, STR, HOYDE] = [595.28, 841.89, 64, 11, 15.5];
  const bredde = BREDDE_SIDE - 2 * MARG;
  let side = pdf.addPage([BREDDE_SIDE, HOYDE_SIDE]);
  let y = HOYDE_SIDE - MARG;
  const skriv = (linje: string, font: PDFFont) => {
    if (y < MARG) {
      side = pdf.addPage([BREDDE_SIDE, HOYDE_SIDE]);
      y = HOYDE_SIDE - MARG;
    }
    side.drawText(linje, { x: MARG, y, size: STR, font, color: rgb(0.09, 0.15, 0.24) });
    y -= HOYDE;
  };
  for (const bl of blokker(b)) {
    const font = bl.fet ? fet : normal;
    for (const l of bl.linjer) for (const del of brytLinjer(l, font, STR, bredde)) skriv(del, font);
    y -= HOYDE * 0.6;
  }
  return pdf.save();
}
```

`src/lib/brev/dokument.ts`:

```ts
import { iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { byggBrev, type Brev } from "./brev";
import type { Sak } from "./sak";

// The letter for a stored case, or null when its answers no longer give one.
export async function brevForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  const lest = tilKlageInput(sak.svar, idag);
  if (!lest.ok) return null;
  return byggBrev(lest.input, idag, sak.utfylling);
}
```

Route `src/app/api/sak/[id]/dokument/[fil]/route.ts` (read the Next 16 route-handler docs in `node_modules/next/dist/docs/` first and follow the `params` convention used by the sibling routes):

```ts
import { brevForSak } from "@/lib/brev/dokument";
import { tilDocx, tilPdf } from "@/lib/brev/eksport";
import { hentSak } from "@/lib/brev/sak";
import { erSakId } from "@/lib/brev/utfylling";
import { ipFra, lagGrense } from "@/lib/rategrense";

const forMange = lagGrense({ antall: 30, vinduMs: 60_000 });

const FILER = {
  "brev.pdf": { type: "application/pdf", navn: "reklamasjonsbrev.pdf" },
  "brev.docx": { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", navn: "reklamasjonsbrev.docx" },
} as const;

const FINNES_IKKE = { feil: "Vi finner ikke denne saken. Den kan være slettet." };

// The letter as a file. Only the id of the case is needed; nothing from the case is logged.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; fil: string }> }) {
  const { id, fil } = await params;
  if (!erSakId(id) || !Object.hasOwn(FILER, fil)) return Response.json(FINNES_IKKE, { status: 404 });
  if (forMange(ipFra(request))) return Response.json({ feil: "Vent et minutt og prøv igjen." }, { status: 429 });
  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json(FINNES_IKKE, { status: 404 });
    const brev = await brevForSak(sak);
    if (!brev) return Response.json({ feil: "Svarene i saken gir ikke et brev. Rett svarene først." }, { status: 409 });
    const f = FILER[fil as keyof typeof FILER];
    const bytes = fil.endsWith(".pdf") ? await tilPdf(brev) : await tilDocx(brev);
    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": f.type, "Content-Disposition": `attachment; filename="${f.navn}"`, "Cache-Control": "no-store" },
    });
  } catch {
    console.error("eksport av brev feilet");
    return Response.json({ feil: "Vi fikk ikke laget filen. Prøv igjen om litt." }, { status: 500 });
  }
}
```

In `brevside.tsx`, above `<Brevark …/>` (inside the right column), add the download row. `harPlassholder` and `byggBrev` are already imported/available:

```tsx
        {(() => {
          const brev = byggBrev(input, idag, utfylling);
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href={`/api/sak/${id}/dokument/brev.pdf`} download className="rounded-[6px] bg-[#17263d] px-[18px] py-[11px] text-[14px] font-semibold text-[#f6f4ef]">
                Last ned PDF
              </a>
              <a href={`/api/sak/${id}/dokument/brev.docx`} download className="rounded-[6px] border border-[#bfbab0] bg-white px-[18px] py-[11px] text-[14px] font-semibold text-[#17263d]">
                Last ned Word
              </a>
              {harPlassholder(brev) && (
                <p role="status" className="m-0 text-[13px] leading-[1.5] text-[#6b5618]">
                  Brevet har felt som mangler (markert gult). Du kan laste det ned nå og fylle ut for hånd.
                </p>
              )}
            </div>
          );
        })()}
```

(Prefer hoisting `const brev = byggBrev(...)` above the `return` and reusing it for both the row and `<Brevark brev={brev} />`.) Import `harPlassholder` from `@/lib/brev/eksport` — it imports `docx` and `pdf-lib`; to keep them out of the client bundle, move `harPlassholder` into `src/lib/brev/brev.ts` and re-export it from `eksport.ts`; the unit test imports it from `./eksport` and still passes.

- [ ] **Step 5: Run unit tests and typecheck**

Run: `npx vitest run src/lib/brev/eksport.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Write and run the e2e test** — `e2e/eksport.spec.ts`:

```ts
import { readFile } from "node:fs/promises";
import { expect, KJORETOY, test } from "./fixtures";
import { TOM_INNSENDING, type Innsending } from "../src/lib/vurdering/innsending";

const AR = new Date().getFullYear();
const svar: Innsending = {
  ...TOM_INNSENDING,
  kjopsdato: `${AR - 1}-03-12`,
  kjopesum: "250000",
  kmVedKjop: "80000",
  feiltyper: ["motor"],
  oppdaget: "innen_6_mnd",
  opplystForKjop: "nei",
  feilOpplysning: "nei",
  kontakt: "nei",
  verkstedrapport: "nei",
  bilder: "nei",
};

test("PDF og Word lastes ned, og siden advarer om felt som mangler", async ({ page, sak }) => {
  await page.goto(await sak.apne(svar));
  await expect(page.getByRole("status").filter({ hasText: "felt som mangler" })).toBeVisible();

  const pdf = page.waitForEvent("download");
  await page.getByRole("link", { name: "Last ned PDF" }).click();
  const fil = await pdf;
  expect(fil.suggestedFilename()).toBe("reklamasjonsbrev.pdf");
  expect((await readFile(await fil.path())).subarray(0, 5).toString()).toBe("%PDF-");

  const word = page.waitForEvent("download");
  await page.getByRole("link", { name: "Last ned Word" }).click();
  const docx = await word;
  expect(docx.suggestedFilename()).toBe("reklamasjonsbrev.docx");
  expect((await readFile(await docx.path())).subarray(0, 2).toString()).toBe("PK");
});

test("en utløpt eller slettet sak gir ingen fil", async ({ request }) => {
  const res = await request.get("/api/sak/AAAAAAAAAAAAAAAAAAAAAA/dokument/brev.pdf");
  expect(res.status()).toBe(404);
});

test("ukjent filnavn gir 404", async ({ request, sak }) => {
  const url = await sak.apne(svar);
  const res = await request.get(`/api/sak${url.replace("/brev", "")}/dokument/brev.exe`);
  expect(res.status()).toBe(404);
});
```

(Remove the unused `KJORETOY` import if the linter complains.)

Run: `npx playwright test e2e/eksport.spec.ts --project=desktop --project=mobil`
Expected: PASS.

- [ ] **Step 7: Open one downloaded PDF and read it** (Read tool on the saved file) to check line breaks, æøå and the `§` sign. Fix `eksport.ts` if anything is cut off.

- [ ] **Step 8: Checkpoint.**

---

### Task 5: Saksmappe core — types, thresholds and the six card builders (pure)

**Files:**
- Create: `src/lib/wilson.ts`, `src/lib/mappe/typer.ts`, `src/lib/mappe/tekster.ts`, `src/lib/mappe/kort/{styrke,belop,avgjorde,aktorer,styrk,videre}.ts` and a `*.test.ts` for each, `src/lib/mappe/bygg.ts`, `src/lib/mappe/bygg.test.ts`, `src/lib/vurdering/tid.ts`
- Modify: `src/lib/data/statistikk.ts` (re-export `wilson`), `src/lib/vurdering/statistikk.ts` (`export const MIN_UTVALG`), `src/app/vurdering/skjema.tsx` (import `TID_TIL_VEDTAK` from `tid.ts`)

**Interfaces — Produces (Tasks 6–9 rely on these exactly):**

```ts
// typer.ts
export const MIN_N = 10, MIN_N_FORHANDLER = 3, MIN_N_MODELL = 5;
export type Andel = { n: number; vunnet: number; andel: number; lav: number; hoy: number };
export type ForFa = { forFa: true; n: number };
export const erForFa: (x: unknown) => x is ForFa;
export function andel(vunnet: number, n: number, minN: number): Andel | ForFa;

export type UtvalgTall = { n: number; fullt: number; delvis: number; avslag: number; trinn: number; beskrivelse: string; spesifikk: boolean };
export type Kvartiler = { n: number; p25: number; median: number; p75: number };
export type BelopTall = {
  tilkjent: Kvartiler | null;                 // total awarded, decisions where something was awarded
  prisavslagAvUtbedring: Kvartiler | null;    // awarded price reduction / repair cost, as a ratio
  heving: { n: number; fullt: number; delvis: number; ikke: number } | null;   // decisions where cancelling was the main claim
  erstatning: { nKrevd: number; nTilkjent: number; median: number | null };
};
export type TemaRad = { kilde: "tvistetema" | "bevistyper" | "mangelsgrunnlag"; verdi: string; nMedhold: number; nAvslag: number };
export type TemaTall = { medhold: number; avslag: number; rader: TemaRad[] };
export type EksempelVedtak = { id: number; saksnummer: string; ar: number; utfall: "medhold" | "delvis_medhold" | "ikke_medhold"; tilkjentNok: number | null; sammendrag: string | null; momenter: string[]; kildeUrl: string; merke: string | null; modell: string | null; dagerTilReklamasjon: number | null };
export type ForhandlerTall = { n: number; vunnet: number; sisteAr: number | null; feiltyper: { verdi: string; n: number }[] };
export type ModellTall = { n: number; vunnet: number };
export type BevisTall = { nMedhold: number; verkstedrapport: number; bilder: number; takst: number; naf: number; kvittering: number };
export type MappeData = {
  utvalg(): Promise<UtvalgTall>;
  belop(): Promise<BelopTall>;
  temaer(): Promise<TemaTall>;
  eksempler(): Promise<EksempelVedtak[]>;
  forhandler(navn: string | null, orgnr: string | null): Promise<ForhandlerTall | null>;
  modell(merke: string, modell: string): Promise<ModellTall>;
  bevis(): Promise<BevisTall>;
};
```

Card types (also in `typer.ts`) are defined by the builders in the steps below; `Mappe` is:

```ts
export type Mappe = { styrke: StyrkeKort; belop: BelopKort; avgjorde: AvgjordeKort; aktorer: AktorKort; styrk: Sjekkpunkt[]; videre: VidereKort; idag: string };
```

- [ ] **Step 1: Make `wilson` importable without a database.** Create `src/lib/wilson.ts` containing the `wilson` function currently in `src/lib/data/statistikk.ts` (move the body verbatim, `export function wilson(vunnet: number, n: number): [number, number]`). In `src/lib/data/statistikk.ts` replace the function with `import { wilson } from "@/lib/wilson"; export { wilson };`. In `src/lib/vurdering/statistikk.ts` change `const MIN_UTVALG = 30;` to `export const MIN_UTVALG = 30;` and make `trinnFor`'s return element type exported: `export type Trinn = …` (rename the local `type Trinn` to exported). Create `src/lib/vurdering/tid.ts` with the `TID_TIL_VEDTAK` constant and its comment from `skjema.tsx`, export it, and import it in `skjema.tsx`.

Run: `npx vitest run && npm run typecheck`
Expected: PASS (nothing else changed).

- [ ] **Step 2: Write failing tests for `typer.ts` helpers** — `src/lib/mappe/typer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { andel, erForFa, MIN_N } from "./typer";

describe("andel", () => {
  it("gir «for få saker» under grensen, aldri et tall", () => {
    const a = andel(3, MIN_N - 1, MIN_N);
    expect(erForFa(a)).toBe(true);
    expect(a).toEqual({ forFa: true, n: MIN_N - 1 });
  });
  it("regner andel og Wilson-intervall fra grensen og opp", () => {
    const a = andel(7, 10, MIN_N);
    if (erForFa(a)) throw new Error("forventet tall");
    expect(a.andel).toBeCloseTo(0.7);
    expect(a.lav).toBeLessThan(0.7);
    expect(a.hoy).toBeGreaterThan(0.7);
    expect(a.lav).toBeGreaterThanOrEqual(0);
    expect(a.hoy).toBeLessThanOrEqual(1);
  });
  it("0 saker er «for få», ikke NaN", () => {
    expect(andel(0, 0, MIN_N)).toEqual({ forFa: true, n: 0 });
  });
});
```

Run: `npx vitest run src/lib/mappe/typer.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/mappe/typer.ts`** with the exact exports listed under Interfaces, plus:

```ts
import { wilson } from "@/lib/wilson";

export const MIN_N = 10;
export const MIN_N_FORHANDLER = 3;
export const MIN_N_MODELL = 5;

export type Andel = { n: number; vunnet: number; andel: number; lav: number; hoy: number };
export type ForFa = { forFa: true; n: number };
export const erForFa = (x: unknown): x is ForFa => typeof x === "object" && x !== null && "forFa" in x;

export function andel(vunnet: number, n: number, minN: number): Andel | ForFa {
  if (n < minN || n === 0) return { forFa: true, n };
  const [lav, hoy] = wilson(vunnet, n);
  return { n, vunnet, andel: vunnet / n, lav, hoy };
}
```

(Append the data types from Interfaces, then the card types as each card is written in Steps 4–9; the `Mappe` type last.) Run the test → PASS.

- [ ] **Step 4: Card 1 «Sakens styrke»** — test `src/lib/mappe/kort/styrke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { erForFa } from "../typer";
import { styrkeKort } from "./styrke";

const u = (o = {}) => ({ n: 120, fullt: 30, delvis: 50, avslag: 40, trinn: 1, beskrivelse: "motor og reklamasjonstid", spesifikk: true, ...o });

describe("styrkeKort", () => {
  it("medhold er fullt pluss delvis, med intervall og utfallsfordeling", () => {
    const k = styrkeKort(u());
    if (erForFa(k.medhold)) throw new Error("forventet tall");
    expect(k.medhold.vunnet).toBe(80);
    expect(k.medhold.n).toBe(120);
    expect(k.fordeling).toEqual({ fullt: 30, delvis: 50, avslag: 40 });
  });
  it("uten spesifikt trinn sier kortet det: alle forhandlersaker", () => {
    expect(styrkeKort(u({ spesifikk: false, trinn: 4, beskrivelse: "alle forhandlersaker" })).spesifikk).toBe(false);
  });
  it("et tomt utvalg gir «for få saker», ikke NaN", () => {
    const k = styrkeKort(u({ n: 0, fullt: 0, delvis: 0, avslag: 0 }));
    expect(erForFa(k.medhold)).toBe(true);
  });
});
```

Implementation `src/lib/mappe/kort/styrke.ts`:

```ts
import { andel, MIN_N, type Andel, type ForFa, type UtvalgTall } from "../typer";

export type StyrkeKort = {
  medhold: Andel | ForFa;
  fordeling: { fullt: number; delvis: number; avslag: number };
  beskrivelse: string;
  spesifikk: boolean;
  n: number;
};

export function styrkeKort(u: UtvalgTall): StyrkeKort {
  return {
    medhold: andel(u.fullt + u.delvis, u.n, MIN_N),
    fordeling: { fullt: u.fullt, delvis: u.delvis, avslag: u.avslag },
    beskrivelse: u.beskrivelse,
    spesifikk: u.spesifikk,
    n: u.n,
  };
}
```

Run → PASS.

- [ ] **Step 5: Card 2 «Hva kan du få?»** — test `kort/belop.test.ts` (key cases: rounding, thresholds, prefers `krav.utbedringNok`, falls back to `input.feilen.utbedringskostnadNok`, null when below `MIN_N`):

```ts
import { describe, expect, it } from "vitest";
import { belopKort } from "./belop";

const tall = (o = {}) => ({
  tilkjent: { n: 80, p25: 8000, median: 22000, p75: 55000 },
  prisavslagAvUtbedring: { n: 40, p25: 0.38, median: 0.71, p75: 1 },
  heving: { n: 60, fullt: 12, delvis: 26, ikke: 22 },
  erstatning: { nKrevd: 50, nTilkjent: 25, median: 6858 },
  ...o,
});

describe("belopKort", () => {
  it("regner prisavslag av oppgitt utbedringskostnad, rundet til nærmeste hundre", () => {
    const k = belopKort(tall(), { utbedringNok: 30000 });
    expect(k.prisavslag).toEqual({ utbedringNok: 30000, n: 40, fra: 11400, median: 21300, til: 30000 });
  });
  it("ingen prisavslagsberegning uten kostnad, eller med for få saker", () => {
    expect(belopKort(tall(), {}).prisavslag).toBeNull();
    expect(belopKort(tall({ prisavslagAvUtbedring: { n: 4, p25: 0.5, median: 0.5, p75: 0.5 } }), { utbedringNok: 30000 }).prisavslag).toBeNull();
  });
  it("heving: andel fullt og delvis, og anbefaling om subsidiært prisavslag", () => {
    const k = belopKort(tall(), {});
    expect(k.heving).toEqual({ n: 60, fullt: 12, delvis: 26, ikke: 22 });
    expect(k.anbefaling.join(" ")).toContain("subsidiært");
  });
  it("tynt utvalg gir null i stedet for tall", () => {
    const k = belopKort(tall({ tilkjent: { n: 3, p25: 1, median: 2, p75: 3 }, heving: { n: 2, fullt: 1, delvis: 1, ikke: 0 }, erstatning: { nKrevd: 4, nTilkjent: 2, median: 100 } }), {});
    expect(k.tilkjent).toBeNull();
    expect(k.heving).toBeNull();
    expect(k.erstatning).toBeNull();
  });
  it("tall som mangler helt gir null og tom anbefaling", () => {
    const k = belopKort({ tilkjent: null, prisavslagAvUtbedring: null, heving: null, erstatning: { nKrevd: 0, nTilkjent: 0, median: null } }, {});
    expect(k.tilkjent).toBeNull();
    expect(k.anbefaling).toEqual([]);
  });
});
```

Implementation `kort/belop.ts`:

```ts
import { MIN_N, type BelopTall, type Kvartiler } from "../typer";

const rund100 = (x: number) => Math.round(x / 100) * 100;
const pct = (x: number) => `${Math.round(x * 100)} %`;

export type BelopKort = {
  tilkjent: Kvartiler | null;
  prisavslag: { utbedringNok: number; n: number; fra: number; median: number; til: number } | null;
  heving: { n: number; fullt: number; delvis: number; ikke: number } | null;
  erstatning: { n: number; andelTilkjent: number; median: number | null } | null;
  anbefaling: string[];
};

// What the buyer can expect to be awarded, from the decisions in the sample. `krav` carries the
// repair cost the buyer gave on the letter page; the assessment may have one too.
export function belopKort(t: BelopTall, krav: { utbedringNok?: number }, utbedringFraVurdering?: number | null): BelopKort {
  const utb = krav.utbedringNok ?? utbedringFraVurdering ?? null;
  const pa = t.prisavslagAvUtbedring;
  const heving = t.heving && t.heving.n >= MIN_N ? t.heving : null;
  const anbefaling: string[] = [];
  if (heving) {
    anbefaling.push(
      `Av ${heving.n} lignende saker der heving var hovedkravet fikk ${pct(heving.fullt / heving.n)} full heving og ${pct(heving.delvis / heving.n)} delvis medhold, ofte som prisavslag. Brevet krever derfor prisavslag subsidiært hvis du velger heving.`,
    );
  }
  if (pa && pa.n >= MIN_N) {
    anbefaling.push(`Tilkjent prisavslag var typisk ${pct(pa.median)} av utbedringskostnaden (midtre halvdel ${pct(pa.p25)}–${pct(pa.p75)}). Dokumenter kostnaden med et prisoverslag eller en faktura.`);
  }
  return {
    tilkjent: t.tilkjent && t.tilkjent.n >= MIN_N ? t.tilkjent : null,
    prisavslag: utb && pa && pa.n >= MIN_N ? { utbedringNok: utb, n: pa.n, fra: rund100(utb * pa.p25), median: rund100(utb * pa.median), til: rund100(utb * pa.p75) } : null,
    heving,
    erstatning: t.erstatning.nKrevd >= MIN_N ? { n: t.erstatning.nKrevd, andelTilkjent: t.erstatning.nTilkjent / t.erstatning.nKrevd, median: t.erstatning.median } : null,
    anbefaling,
  };
}
```

(Adjust the test's calls to pass `(tall(), { utbedringNok: 30000 })` — the third argument is optional.) Run → PASS.

- [ ] **Step 6: Card 3 «Hva avgjorde lignende saker?»** — two parts. Labels in `src/lib/mappe/tekster.ts`:

```ts
// Only themes that say something about the case. Themes that exist only once the committee has found
// a defect (heving_vesentlig, prisavslag_storrelse, erstatning_tap) and the catch-all «annet» are left out:
// they follow the outcome instead of explaining it.
export const TEMA_TEKST: Record<string, string> = {
  "tvistetema:reklamasjon_for_sent": "Om du reklamerte for sent",
  "tvistetema:retting_forsok": "Forsøk på retting",
  "tvistetema:km_eller_historikk": "Kilometerstand eller historikk",
  "tvistetema:utbedringskostnad": "Hva utbedringen koster",
  "bevistyper:verkstedrapport": "Verkstedrapport",
  "bevistyper:NAF_test": "NAF-test",
  "bevistyper:bilder": "Bilder",
  "bevistyper:takst": "Takst",
  "bevistyper:kvittering": "Kvitteringer",
  "bevistyper:EU_kontroll": "EU-kontroll",
  "mangelsgrunnlag:avvik_fra_avtale": "Bilen avvek fra avtalen",
  "mangelsgrunnlag:feil_opplysninger": "Feil opplysninger fra selger",
  "mangelsgrunnlag:vesentlig_darligere_stand": "Vesentlig dårligere stand enn forventet",
  "mangelsgrunnlag:tilbakeholdt_opplysning": "Tilbakeholdt opplysning",
};

export const FEILTYPE_TEKST: Record<string, string> = {
  motor: "motor", girkasse: "girkasse", clutch: "clutch", elektrisk: "elektrisk", understell_hjuloppheng: "understell og hjuloppheng",
  rust: "rust", bremser: "bremser", fukt_lekkasje: "fukt og lekkasje", klimaanlegg: "klimaanlegg", kollisjonsskade: "kollisjonsskade",
  batteri_elbil: "batteri (elbil)", servicehistorikk: "servicehistorikk", km_avvik: "kilometerstand", ramme_chassis: "ramme", bruktimport_opplysning: "bruktimport",
};
```

Test `kort/avgjorde.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avgjordeKort } from "./avgjorde";

const rad = (verdi: string, nMedhold: number, nAvslag: number, kilde = "tvistetema" as const) => ({ kilde, verdi, nMedhold, nAvslag });

describe("avgjordeKort", () => {
  it("rangerer temaer etter forskjell i andel mellom vunne og tapte saker, og bare kjente temaer", () => {
    const k = avgjordeKort({ medhold: 100, avslag: 100, rader: [rad("reklamasjon_for_sent", 5, 40), rad("retting_forsok", 40, 10), rad("annet", 90, 10), rad("heving_vesentlig", 99, 1)] }, []);
    expect(k.temaer.map((t) => t.tekst)).toEqual(["Om du reklamerte for sent", "Forsøk på retting"]);
    expect(k.temaer[0]).toMatchObject({ andelMedhold: 0.05, andelAvslag: 0.4, retning: "avslag" });
    expect(k.temaer[1]).toMatchObject({ retning: "medhold" });
  });
  it("tomt grunnlag gir ingen temaer og ingen NaN", () => {
    const k = avgjordeKort({ medhold: 0, avslag: 0, rader: [rad("retting_forsok", 0, 0)] }, []);
    expect(k.temaer).toEqual([]);
  });
  it("tar bare med temaer som forekommer i minst 10 saker", () => {
    const k = avgjordeKort({ medhold: 100, avslag: 100, rader: [rad("retting_forsok", 3, 2)] }, []);
    expect(k.temaer).toEqual([]);
  });
  it("eksempler: opptil tre vunne og to tapte, vunne først", () => {
    const e = (id: number, utfall: "medhold" | "delvis_medhold" | "ikke_medhold") => ({ id, saksnummer: `${id}/1`, ar: 2024, utfall, tilkjentNok: null, sammendrag: "s", momenter: ["a"], kildeUrl: "https://x.test", merke: null, modell: null, dagerTilReklamasjon: null });
    const k = avgjordeKort({ medhold: 0, avslag: 0, rader: [] }, [e(1, "ikke_medhold"), e(2, "medhold"), e(3, "delvis_medhold"), e(4, "medhold"), e(5, "medhold"), e(6, "ikke_medhold"), e(7, "ikke_medhold")]);
    expect(k.eksempler.map((x) => x.id)).toEqual([2, 3, 4, 1, 6]);
  });
});
```

Implementation `kort/avgjorde.ts`:

```ts
import { TEMA_TEKST } from "../tekster";
import type { EksempelVedtak, TemaTall } from "../typer";

export type Tema = { tekst: string; andelMedhold: number; andelAvslag: number; retning: "medhold" | "avslag"; n: number };
export type AvgjordeKort = { temaer: Tema[]; eksempler: EksempelVedtak[]; nMedhold: number; nAvslag: number };

const MIN_FOREKOMST = 10;

// The themes that most separate won from lost decisions in the sample, by the difference in the share
// of decisions where the theme was an issue.
export function avgjordeKort(t: TemaTall, eksempler: EksempelVedtak[]): AvgjordeKort {
  const temaer: Tema[] = [];
  if (t.medhold > 0 && t.avslag > 0) {
    for (const r of t.rader) {
      const tekst = TEMA_TEKST[`${r.kilde}:${r.verdi}`];
      if (!tekst || r.nMedhold + r.nAvslag < MIN_FOREKOMST) continue;
      const andelMedhold = r.nMedhold / t.medhold;
      const andelAvslag = r.nAvslag / t.avslag;
      temaer.push({ tekst, andelMedhold, andelAvslag, retning: andelMedhold >= andelAvslag ? "medhold" : "avslag", n: r.nMedhold + r.nAvslag });
    }
    temaer.sort((a, b) => Math.abs(b.andelMedhold - b.andelAvslag) - Math.abs(a.andelMedhold - a.andelAvslag));
  }
  const vunne = eksempler.filter((e) => e.utfall !== "ikke_medhold").slice(0, 3);
  const tapte = eksempler.filter((e) => e.utfall === "ikke_medhold").slice(0, 2);
  return { temaer: temaer.slice(0, 5), eksempler: [...vunne, ...tapte], nMedhold: t.medhold, nAvslag: t.avslag };
}
```

Run → PASS. (Note: the lost-decision card is sorted by whichever side is larger; the UI words it as «Kommer opp i X % av tapte saker mot Y % av vunne».)

- [ ] **Step 7: Card 4 «Forhandleren og bilen»** — test `kort/aktorer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { erForFa } from "../typer";
import { aktorKort } from "./aktorer";

describe("aktorKort", () => {
  it("forhandler under grensen: «for få saker» uten tall", () => {
    const k = aktorKort({ n: 2, vunnet: 2, sisteAr: 2023, feiltyper: [] }, { n: 40, vunnet: 25 });
    expect(erForFa(k.forhandler!.medhold)).toBe(true);
  });
  it("forhandler uten treff og ukjent forhandler gir null, ikke feil", () => {
    expect(aktorKort(null, { n: 0, vunnet: 0 }).forhandler).toBeNull();
    expect(aktorKort({ n: 0, vunnet: 0, sisteAr: null, feiltyper: [] }, { n: 0, vunnet: 0 }).forhandler).toBeNull();
  });
  it("forhandler med nok saker: andel, siste år og vanligste feil med norske navn", () => {
    const k = aktorKort({ n: 8, vunnet: 6, sisteAr: 2022, feiltyper: [{ verdi: "motor", n: 4 }, { verdi: "understell_hjuloppheng", n: 2 }] }, { n: 0, vunnet: 0 });
    expect(k.forhandler!.sisteAr).toBe(2022);
    expect(k.forhandler!.feiltyper).toEqual(["motor", "understell og hjuloppheng"]);
    expect(k.forhandler!.gammel).toBe(true);
  });
  it("modell: fem saker eller flere gir tall, færre gir «for få»", () => {
    expect(erForFa(aktorKort(null, { n: 4, vunnet: 2 }).modell!.medhold)).toBe(true);
    expect(erForFa(aktorKort(null, { n: 5, vunnet: 3 }).modell!.medhold)).toBe(false);
    expect(aktorKort(null, { n: 0, vunnet: 0 }).modell).toBeNull();
  });
});
```

Implementation `kort/aktorer.ts`:

```ts
import { FEILTYPE_TEKST } from "../tekster";
import { andel, MIN_N_FORHANDLER, MIN_N_MODELL, type Andel, type ForFa, type ForhandlerTall, type ModellTall } from "../typer";

export type AktorKort = {
  forhandler: { n: number; medhold: Andel | ForFa; sisteAr: number | null; feiltyper: string[]; gammel: boolean } | null;
  modell: { n: number; medhold: Andel | ForFa } | null;
};

// A decision from before this year counts as old: dealers change owners and practice.
const GAMMEL_FOR = 2024;

export function aktorKort(f: ForhandlerTall | null, m: ModellTall): AktorKort {
  return {
    forhandler:
      f && f.n > 0
        ? {
            n: f.n,
            medhold: andel(f.vunnet, f.n, MIN_N_FORHANDLER),
            sisteAr: f.sisteAr,
            feiltyper: f.feiltyper.slice(0, 3).map((x) => FEILTYPE_TEKST[x.verdi] ?? x.verdi),
            gammel: f.sisteAr !== null && f.sisteAr < GAMMEL_FOR,
          }
        : null,
    modell: m.n > 0 ? { n: m.n, medhold: andel(m.vunnet, m.n, MIN_N_MODELL) } : null,
  };
}
```

Run → PASS.

- [ ] **Step 8: Card 5 «Styrk saken» (checklist)** — test `kort/styrk.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { erForFa } from "../typer";
import { styrkPunkter } from "./styrk";

const bevis = { nMedhold: 100, verkstedrapport: 70, bilder: 30, takst: 10, naf: 40, kvittering: 55 };
const faktorer = (o = {}) => ({ verkstedrapport: false, bilder: false, rapportSierForKjop: null as boolean | null, feilOpplysninger: false, feilOpplysningerDokumentert: false, ...o });

describe("styrkPunkter", () => {
  it("uten rapport kommer rapporten først, med andelen vunne saker som hadde den", () => {
    const p = styrkPunkter(faktorer(), bevis, []);
    expect(p[0].nokkel).toBe("rapport_tidspunkt");
    const a = p[0].andel!;
    if (erForFa(a)) throw new Error("forventet tall");
    expect(a.andel).toBeCloseTo(0.7);
  });
  it("rapport som ikke tar stilling til tidspunkt gir samme punkt med annen tekst", () => {
    const p = styrkPunkter(faktorer({ verkstedrapport: true, rapportSierForKjop: false }), bevis, []);
    expect(p.find((x) => x.nokkel === "rapport_tidspunkt")!.tittel).toContain("når feilen oppsto");
  });
  it("rapport som sier at feilen fantes før kjøpet gir ikke noe rapportpunkt", () => {
    const p = styrkPunkter(faktorer({ verkstedrapport: true, rapportSierForKjop: true }), bevis, []);
    expect(p.find((x) => x.nokkel === "rapport_tidspunkt")).toBeUndefined();
  });
  it("avkryssede punkter er merket, og rekkefølgen er stabil", () => {
    const p = styrkPunkter(faktorer(), bevis, ["bilder"]);
    expect(p.find((x) => x.nokkel === "bilder")!.sjekket).toBe(true);
    expect(p.find((x) => x.nokkel === "kontrakt")!.sjekket).toBe(false);
  });
  it("uten vunne saker i utvalget er det ingen andel, ikke NaN", () => {
    const p = styrkPunkter(faktorer(), { ...bevis, nMedhold: 0 }, []);
    expect(p.every((x) => x.andel === undefined || erForFa(x.andel))).toBe(true);
  });
});
```

Implementation `kort/styrk.ts`:

```ts
import { andel, MIN_N, type Andel, type BevisTall, type ForFa } from "../typer";
import type { SjekkNokkel } from "@/lib/brev/utfylling";
import type { Faktorer } from "@/lib/vurdering/faktorer";

export type Sjekkpunkt = { nokkel: SjekkNokkel; tittel: string; tekst: string; andel?: Andel | ForFa; sjekket: boolean };

type Mal = { nokkel: SjekkNokkel; tittel: string; tekst: string; bevis?: keyof Omit<BevisTall, "nMedhold"> };

// The two most common reasons for losing: the defect was not shown to have been there at delivery, and
// it was seen as wear the buyer had to expect (see tiltak.ts). The first points answer those.
export function styrkPunkter(f: Pick<Faktorer, "verkstedrapport" | "bilder" | "rapportSierForKjop" | "feilOpplysninger" | "feilOpplysningerDokumentert">, b: BevisTall, sjekket: SjekkNokkel[]): Sjekkpunkt[] {
  const mal: Mal[] = [];
  if (!f.verkstedrapport) {
    mal.push({
      nokkel: "rapport_tidspunkt",
      tittel: "Få en verksted- eller tilstandsrapport",
      tekst: "Be et uavhengig verksted skrive hva feilen er, årsaken, om den sannsynligvis var der da du kjøpte bilen, og om den er mer enn normal slitasje for alder og kilometerstand. Ta vare på fakturaen.",
      bevis: "verkstedrapport",
    });
  } else if (f.rapportSierForKjop === false) {
    mal.push({
      nokkel: "rapport_tidspunkt",
      tittel: "Be verkstedet vurdere når feilen oppsto",
      tekst: "Rapporten din sier ikke om feilen var der før kjøpet. Be om en kort vurdering av årsaken og om feilen er mer enn normal slitasje, gjerne som tillegg til rapporten.",
      bevis: "verkstedrapport",
    });
  }
  if (!f.verkstedrapport && !f.bilder) mal.push({ nokkel: "bilder", tittel: "Dokumenter feilen med bilder eller film", tekst: "Ta bilder eller film av feilen slik den er nå. Vent med å utbedre noe til feilen er dokumentert.", bevis: "bilder" });
  else mal.push({ nokkel: "bilder", tittel: "Samle bilder og film av feilen", tekst: "Legg dem ved brevet, med dato der det går an.", bevis: "bilder" });
  mal.push(
    { nokkel: "annonse", tittel: "Lagre annonsen", tekst: "Ta skjermbilder eller lagre annonsen bilen ble solgt med. Annonser blir ofte fjernet etter salget." },
    { nokkel: "meldinger", tittel: "Samle meldingene med forhandleren", tekst: "E-post, SMS og chat om bilen og om feilen, med datoer." },
    { nokkel: "kontrakt", tittel: "Finn kjøpekontrakten", tekst: "Se etter «som den er», garanti og hva som ble avtalt om tilstand." },
    { nokkel: "kvitteringer", tittel: "Samle kvitteringer for utgifter", tekst: "Verksted, tauing, leiebil og andre utgifter feilen har gitt deg. De kan kreves som erstatning.", bevis: "kvittering" },
  );
  return mal.map((m) => ({
    nokkel: m.nokkel,
    tittel: m.tittel,
    tekst: m.tekst,
    ...(m.bevis && { andel: andel(b[m.bevis], b.nMedhold, MIN_N) }),
    sjekket: sjekket.includes(m.nokkel),
  }));
}
```

Run → PASS. (The test's «uten vunne saker» case relies on `andel(…, 0, …)` returning «for få».)

- [ ] **Step 9: Card 6 «Veien videre» + objection answers** — test `kort/videre.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KlageInput } from "@/lib/vurdering/typer";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { videreKort } from "./videre";

const IDAG = "2026-10-02";
const klage = (feilen: Partial<KlageInput["feilen"]> = {}): KlageInput => ({
  kvalifisering: { selgerType: "forhandler", privatBruk: true },
  bilOgKjop: { kjopsdato: "2026-03-12", kjopesumNok: 250000, kmVedKjop: 80000 },
  feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "avvist", ...feilen },
  bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: true },
});
const kort = (feilen = {}, u = {}) => {
  const input = klage(feilen);
  return videreKort(input, beregnFaktorer(input, IDAG), u, IDAG);
};

describe("videreKort", () => {
  it("svarfristen er 14 dager etter sendt-dato, ellers fra i dag", () => {
    expect(kort().frist).toBe("2026-10-16");
    expect(kort({}, { sendt: "2026-09-20" }).frist).toBe("2026-10-04");
  });
  it("tidslinjen har brev, frist, purring og Forbrukerklageutvalget i rekkefølge", () => {
    expect(kort().steg.map((s) => s.tittel)).toEqual(["Send brevet", "Svarfrist for forhandleren", "Ingen svar eller avvist", "Forbrukerklageutvalget"]);
  });
  it("motargumentene som passer saken kommer først", () => {
    const k = kort({ opplystForKjop: "ja", feilOpplysning: "ja_dokumentert" }, { forbehold: "som_den_er" });
    const relevante = k.motargumenter.filter((m) => m.relevant).map((m) => m.nokkel);
    expect(relevante).toContain("forbehold");
    expect(relevante).toContain("kjent_feil");
    expect(k.motargumenter.findIndex((m) => !m.relevant)).toBeGreaterThanOrEqual(relevante.length);
  });
  it("bevisbyrdesvaret følger om presumsjonen gjelder", () => {
    const innen = kort().motargumenter.find((m) => m.nokkel === "oppsto_etter")!;
    expect(innen.svar).toContain("§ 18");
    const utenfor = kort({ oppdaget: "over_2_ar" }).motargumenter.find((m) => m.nokkel === "oppsto_etter")!;
    expect(utenfor.svar).not.toContain("antas å ha eksistert");
  });
  it("ventetiden hentes fra felles konstant", () => {
    expect(kort().ventetid.length).toBeGreaterThan(10);
  });
});
```

Implementation `kort/videre.ts`:

```ts
import { norskDato } from "@/lib/brev/brev";
import type { Utfylling } from "@/lib/brev/utfylling";
import { type Faktorer } from "@/lib/vurdering/faktorer";
import { TID_TIL_VEDTAK } from "@/lib/vurdering/tid";
import type { KlageInput } from "@/lib/vurdering/typer";

export type Steg = { dato: string | null; tittel: string; tekst: string };
export type Motargument = { nokkel: "slitasje" | "forbehold" | "for_sent" | "oppsto_etter" | "kjent_feil"; tittel: string; svar: string; relevant: boolean };
export type VidereKort = { frist: string; steg: Steg[]; motargumenter: Motargument[]; ventetid: string };

export function leggTilDager(iso: string, dager: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

export const SVARFRIST_DAGER = 14;
export const PURRING_DAGER = 7;

export function videreKort(input: KlageInput, f: Faktorer, u: Utfylling, idag: string): VidereKort {
  const brevdato = u.sendt ?? idag;
  const frist = leggTilDager(brevdato, SVARFRIST_DAGER);
  const steg: Steg[] = [
    { dato: u.sendt ?? null, tittel: "Send brevet", tekst: "Send det skriftlig og behold dokumentasjon på at det er sendt (e-post med lesebekreftelse, eller rekommandert brev). Fyll inn datoen du sendte det under, så får du en purring med riktige datoer." },
    { dato: frist, tittel: "Svarfrist for forhandleren", tekst: `Brevet gir forhandleren ${SVARFRIST_DAGER} dager til å svare.` },
    { dato: null, tittel: "Ingen svar eller avvist", tekst: `Send purringen, med ${PURRING_DAGER} dager til ny frist. Svarer forhandleren fortsatt ikke, eller avviser kravet, kan du bringe saken inn for Forbrukerklageutvalget.` },
    { dato: null, tittel: "Forbrukerklageutvalget", tekst: "Se forbrukertilsynet.no for hvordan du klager. Ta med brevet, svaret fra forhandleren og dokumentasjonen." },
  ];
  const mal: (Omit<Motargument, "relevant"> & { relevant: boolean })[] = [
    {
      nokkel: "forbehold",
      tittel: "«Bilen er solgt som den er»",
      svar: "Et forbehold om at bilen selges «som den er» kan ikke innskrenke rettighetene til en forbruker etter forbrukerkjøpsloven, jf. § 3. Bilen skal svare til det som er avtalt og det jeg kunne forvente.",
      relevant: u.forbehold === "som_den_er",
    },
    {
      nokkel: "slitasje",
      tittel: "«Dette er normal slitasje»",
      svar: "Jeg bestrider at feilen er normal slitasje for en bil av denne alderen og kilometerstanden. Be forhandleren dokumentere påstanden, og vis til verkstedets vurdering av årsaken hvis du har en.",
      relevant: f.slitasjeAktuelt && f.lavForventning !== null,
    },
    {
      nokkel: "for_sent",
      tittel: "«Du har reklamert for sent»",
      svar: "Jeg reklamerte innen rimelig tid etter at jeg oppdaget feilen, jf. § 27. En reklamasjon innen to måneder fra jeg oppdaget feilen er alltid i tide.",
      relevant: f.reklamertForSent,
    },
    {
      nokkel: "oppsto_etter",
      tittel: "«Feilen oppsto etter kjøpet»",
      svar: f.presumsjon
        ? `Feilen viste seg innen ${f.presumsjonManeder === 24 ? "to år" : "seks måneder"} etter levering. Etter § 18 antas den da å ha eksistert ved leveringen, og det er forhandleren som må bevise noe annet.`
        : "Jeg har dokumentasjon på at feilen har en årsak som var til stede ved levering. Be forhandleren legge fram sin dokumentasjon for at feilen oppsto senere.",
      relevant: !f.presumsjon || f.rapportSierForKjop === false,
    },
    {
      nokkel: "kjent_feil",
      tittel: "«Du visste om feilen»",
      svar: "Det som ble opplyst før kjøpet, svarte ikke til det jeg faktisk fikk. Jeg viser til annonsen og meldingene som viser hva som ble sagt.",
      relevant: f.opplystForKjop === "ja",
    },
  ];
  const motargumenter = [...mal.filter((m) => m.relevant), ...mal.filter((m) => !m.relevant)];
  return { frist, steg, motargumenter, ventetid: TID_TIL_VEDTAK };
}
```

(`norskDato` import is not needed here — remove it; dates are formatted in the UI.) Run → PASS.

- [ ] **Step 10: The builder `byggMappe`** — test `src/lib/mappe/bygg.test.ts` with a fake `MappeData`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Sak } from "@/lib/brev/sak";
import { byggMappe } from "./bygg";
import type { MappeData } from "./typer";
import { TOM_INNSENDING } from "@/lib/vurdering/innsending";

const IDAG = "2026-10-02";
const svar = { ...TOM_INNSENDING, kjopsdato: "2026-03-12", kjopesum: "250000", kmVedKjop: "80000", feiltyper: ["motor" as const], oppdaget: "innen_6_mnd" as const, opplystForKjop: "nei" as const, feilOpplysning: "nei" as const, kontakt: "avvist" as const, verkstedrapport: "nei" as const, bilder: "ja" as const };
const sak = (utfylling = {}): Pick<Sak, "svar" | "utfylling"> => ({ svar, utfylling: { kjoretoy: { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2019 }, ...utfylling } });

const data = (o: Partial<MappeData> = {}): MappeData => ({
  utvalg: async () => ({ n: 120, fullt: 30, delvis: 50, avslag: 40, trinn: 1, beskrivelse: "motor og reklamasjonstid", spesifikk: true }),
  belop: async () => ({ tilkjent: null, prisavslagAvUtbedring: null, heving: null, erstatning: { nKrevd: 0, nTilkjent: 0, median: null } }),
  temaer: async () => ({ medhold: 0, avslag: 0, rader: [] }),
  eksempler: async () => [],
  forhandler: async () => null,
  modell: async () => ({ n: 0, vunnet: 0 }),
  bevis: async () => ({ nMedhold: 0, verkstedrapport: 0, bilder: 0, takst: 0, naf: 0, kvittering: 0 }),
  ...o,
});

describe("byggMappe", () => {
  it("setter sammen alle seks kortene", async () => {
    const m = await byggMappe(sak(), data(), IDAG);
    expect(Object.keys(m).sort()).toEqual(["aktorer", "avgjorde", "belop", "idag", "styrk", "styrke", "videre"]);
    expect(m.styrke.n).toBe(120);
  });
  it("slår opp forhandleren på orgnr fra Brreg-forhandleren, ellers på navn", async () => {
    const forhandler = vi.fn(async () => null);
    await byggMappe(sak({ forhandler: { type: "brreg", orgnr: "999888777", navn: "Testbil AS" } }), data({ forhandler }), IDAG);
    expect(forhandler).toHaveBeenCalledWith("Testbil AS", "999888777");
    await byggMappe(sak({ forhandler: { type: "fritekst", navn: "Bilsalget" } }), data({ forhandler }), IDAG);
    expect(forhandler).toHaveBeenLastCalledWith("Bilsalget", null);
    await byggMappe(sak(), data({ forhandler }), IDAG);
    expect(forhandler).toHaveBeenLastCalledWith(null, null);
  });
  it("slår opp modellen fra registeroppslaget, og hopper over den uten bil", async () => {
    const modell = vi.fn(async () => ({ n: 7, vunnet: 4 }));
    await byggMappe(sak(), data({ modell }), IDAG);
    expect(modell).toHaveBeenCalledWith("Testmerke", "Modell X");
  });
  it("en feil fra ett oppslag gir ikke tomt resultat for de andre: kortet feiler, mappen svarer", async () => {
    const m = await byggMappe(sak(), data({ temaer: async () => { throw new Error("db"); } }), IDAG);
    expect(m.avgjorde.temaer).toEqual([]);
    expect(m.styrke.n).toBe(120);
  });
});
```

Implementation `src/lib/mappe/bygg.ts`:

```ts
import type { Sak } from "@/lib/brev/sak";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { aktorKort } from "./kort/aktorer";
import { avgjordeKort } from "./kort/avgjorde";
import { belopKort } from "./kort/belop";
import { styrkeKort } from "./kort/styrke";
import { styrkPunkter } from "./kort/styrk";
import { videreKort } from "./kort/videre";
import type { Mappe, MappeData } from "./typer";

// A lookup that fails must not take the whole file with it: that card gets an empty answer, the
// others are shown. Nothing from the case is logged.
async function eller<T>(lop: Promise<T>, reserve: T): Promise<T> {
  try {
    return await lop;
  } catch {
    console.error("oppslag i saksmappen feilet");
    return reserve;
  }
}

// The file for a case. `tilKlageInput` has already been checked by the caller (the route answers 409
// when the answers give no letter); here it is checked again so the builder cannot be called wrongly.
export async function byggMappe(sak: Pick<Sak, "svar" | "utfylling">, dep: MappeData, idag: string): Promise<Mappe> {
  const lest = tilKlageInput(sak.svar, idag);
  if (!lest.ok) throw new Error("svarene gir ikke en sak");
  const input = lest.input;
  const f = beregnFaktorer(input, idag);
  const u = sak.utfylling;
  const forhandler = u.forhandler;
  const orgnr = forhandler?.type === "brreg" ? forhandler.orgnr : null;

  const [utvalg, belop, temaer, eksempler, forhandlerTall, modell, bevis] = await Promise.all([
    eller(dep.utvalg(), { n: 0, fullt: 0, delvis: 0, avslag: 0, trinn: 0, beskrivelse: "", spesifikk: false }),
    eller(dep.belop(), { tilkjent: null, prisavslagAvUtbedring: null, heving: null, erstatning: { nKrevd: 0, nTilkjent: 0, median: null } }),
    eller(dep.temaer(), { medhold: 0, avslag: 0, rader: [] }),
    eller(dep.eksempler(), []),
    eller(dep.forhandler(forhandler?.navn ?? null, orgnr), null),
    u.kjoretoy ? eller(dep.modell(u.kjoretoy.merke, u.kjoretoy.modell), { n: 0, vunnet: 0 }) : Promise.resolve({ n: 0, vunnet: 0 }),
    eller(dep.bevis(), { nMedhold: 0, verkstedrapport: 0, bilder: 0, takst: 0, naf: 0, kvittering: 0 }),
  ]);

  return {
    idag,
    styrke: styrkeKort(utvalg),
    belop: belopKort(belop, { utbedringNok: u.krav?.utbedringNok }, input.feilen.utbedringskostnadNok),
    avgjorde: avgjordeKort(temaer, eksempler),
    aktorer: aktorKort(forhandlerTall, modell),
    styrk: styrkPunkter(f, bevis, u.sjekket ?? []),
    videre: videreKort(input, f, u, idag),
  };
}
```

Finally add to `typer.ts`: `export type Mappe = { idag: string; styrke: StyrkeKort; belop: BelopKort; avgjorde: AvgjordeKort; aktorer: AktorKort; styrk: Sjekkpunkt[]; videre: VidereKort };` (type-only imports from `./kort/*`; to avoid an import cycle, declare the card types in `typer.ts` and have the card files `import type` them from there instead — pick that, and move the `export type …Kort` declarations accordingly).

- [ ] **Step 11: Run everything pure**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 12: Checkpoint.**

---

### Task 6: Saksmappe data (SQL) and the `GET /api/sak/[id]/mappe` route

**Files:**
- Create: `src/lib/mappe/hent.ts`, `src/lib/mappe/hent.test.ts`, `src/app/api/sak/[id]/mappe/route.ts`

**Interfaces:**
- Consumes: `trinnFor`, `MIN_UTVALG`, `Trinn` (`@/lib/vurdering/statistikk`), `Faktorer`, `normaliserFirmanavn` and `normaliserMerke` (`@/lib/normalisering`), the types from Task 5, `LignendeRef` (Task 2), `Lignende` (Task 1).
- Produces:
  ```ts
  export function lagMappeData(f: Faktorer): MappeData;
  export function hentLignende(valg: Lignende[]): Promise<LignendeRef[]>;   // only decisions that qualify; others are dropped
  export const KVALIFISERT: SQL;                                           // the example-quality condition
  ```

- [ ] **Step 1: Write the integration test** — `src/lib/mappe/hent.test.ts` (runs against the real database, read-only; skipped when `DATABASE_URL` is missing):

```ts
import { describe, expect, it } from "vitest";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import type { KlageInput } from "@/lib/vurdering/typer";
import { hentLignende, lagMappeData } from "./hent";

const harDb = !!process.env.DATABASE_URL;
const klage: KlageInput = {
  kvalifisering: { selgerType: "forhandler", privatBruk: true },
  bilOgKjop: { kjopsdato: "2026-03-12", kjopesumNok: 250000, kmVedKjop: 80000 },
  feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "avvist" },
  bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: true },
};

describe.skipIf(!harDb)("lagMappeData (ekte database)", () => {
  const data = lagMappeData(beregnFaktorer(klage, "2026-10-02"));

  it("utvalget har tall som henger sammen", async () => {
    const u = await data.utvalg();
    expect(u.n).toBeGreaterThan(0);
    expect(u.fullt + u.delvis + u.avslag).toBeLessThanOrEqual(u.n);
    expect(u.beskrivelse.length).toBeGreaterThan(0);
  });

  it("eksempler oppfyller kvalitetskravene og har kilde-lenke", async () => {
    const e = await data.eksempler();
    expect(e.length).toBeLessThanOrEqual(5);
    for (const x of e) {
      expect(x.saksnummer).toBeTruthy();
      expect(x.kildeUrl).toMatch(/^https:\/\//);
      expect(x.momenter.length).toBeGreaterThan(0);
    }
  });

  it("forhandler uten navn og uten orgnr gir null, og navnet «null» regnes ikke som en forhandler", async () => {
    expect(await data.forhandler(null, null)).toBeNull();
    expect(await data.forhandler("null", null)).toBeNull();
  });

  it("en modell som ikke finnes gir 0 saker", async () => {
    expect(await data.modell("Finnesikke", "Heller ikke")).toEqual({ n: 0, vunnet: 0 });
  });

  it("temaer og bevis har ikke negative tall", async () => {
    const t = await data.temaer();
    expect(t.rader.every((r) => r.nMedhold >= 0 && r.nAvslag >= 0)).toBe(true);
    const b = await data.bevis();
    expect(b.verkstedrapport).toBeLessThanOrEqual(b.nMedhold);
  });

  it("hentLignende slipper ukjente og urimelige id-er og bruker valgt nøkkelmoment", async () => {
    const e = (await data.eksempler()).find((x) => x.utfall !== "ikke_medhold");
    const ut = await hentLignende([{ id: 2_000_000_000, moment: 0 }, ...(e ? [{ id: e.id, moment: 0 }] : [])]);
    expect(ut.length).toBe(e ? 1 : 0);
    if (e) expect(ut[0]).toMatchObject({ saksnummer: e.saksnummer, moment: e.momenter[0], kildeUrl: e.kildeUrl });
  });

  it("et moment som ikke finnes gir ikke noe vedtak i brevet", async () => {
    const e = (await data.eksempler()).find((x) => x.utfall !== "ikke_medhold");
    if (!e) return;
    expect(await hentLignende([{ id: e.id, moment: 9 }])).toEqual([]);
  });
});
```

Run: `npx vitest run src/lib/mappe/hent.test.ts` → FAIL (module missing). (Vitest must see `DATABASE_URL`: check `vitest.config.*`; if the env is not loaded, add `process.loadEnvFile(".env.local")` in a `try` at the top of the test file as `e2e/db.ts` does.)

- [ ] **Step 2: Implement `src/lib/mappe/hent.ts`.**

```ts
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { LignendeRef } from "@/lib/brev/brev";
import type { Lignende } from "@/lib/brev/utfylling";
import { normaliserFirmanavn, normaliserMerke } from "@/lib/normalisering";
import type { Faktorer } from "@/lib/vurdering/faktorer";
import { MIN_UTVALG, trinnFor } from "@/lib/vurdering/statistikk";
import type { BelopTall, BevisTall, EksempelVedtak, ForhandlerTall, Kvartiler, MappeData, ModellTall, TemaTall, UtvalgTall } from "./typer";

// The saksmappe's numbers, all from `vedtak` (redacted text only). The sample is the first step of
// the assessment's ladder with at least MIN_UTVALG decisions, so the file and the assessment agree.

const rader = async <T>(q: SQL) => (await db.execute(q)).rows as T[];
const FORHANDLER = sql`v.selger_type = 'forhandler'`;
const VUNNET = sql`v.utfall in ('medhold','delvis_medhold')`;
const TAPT = sql`v.utfall in ('ikke_medhold','avvist')`;

// What an example decision must satisfy to be shown or cited.
export const KVALIFISERT = sql`not v.trenger_kontroll and v.konfidens >= 0.85 and v.qa_status <> 'feil' and v.sitater ? 'utfall'
  and v.saksnummer is not null and v.vedtaksdato is not null and v.kilde_url is not null and cardinality(v.utvalgets_nokkelmomenter) > 0`;

const tall = (x: unknown) => (x === null || x === undefined ? null : Number(x));
const kvartiler = (n: unknown, p25: unknown, median: unknown, p75: unknown): Kvartiler | null =>
  Number(n) > 0 && median !== null ? { n: Number(n), p25: Number(p25), median: Number(median), p75: Number(p75) } : null;

export function lagMappeData(f: Faktorer): MappeData {
  let valgt: Promise<{ nr: number; beskrivelse: string; spesifikk: boolean; betingelse: SQL }> | null = null;
  const trinn = () =>
    (valgt ??= (async () => {
      const alle = trinnFor(f);
      const kolonner = alle.map((t, i) => sql`count(*) filter (where ${t.betingelse})::int as ${sql.identifier(`n${i}`)}`);
      const [rad] = await rader<Record<string, number>>(sql`select ${sql.join(kolonner, sql`, `)} from vedtak v where ${FORHANDLER}`);
      let i = alle.length - 1;
      for (let k = 0; k < alle.length; k++) {
        if (Number(rad[`n${k}`]) >= MIN_UTVALG) {
          i = k;
          break;
        }
      }
      return { nr: i + 1, beskrivelse: alle[i].beskrivelse, spesifikk: alle[i].spesifikk, betingelse: alle[i].betingelse };
    })());
  const utvalgSql = async () => sql`${FORHANDLER} and (${(await trinn()).betingelse})`;

  return {
    async utvalg(): Promise<UtvalgTall> {
      const t = await trinn();
      const [r] = await rader<Record<string, number>>(sql`select count(*)::int n,
          count(*) filter (where v.utfall = 'medhold')::int fullt,
          count(*) filter (where v.utfall = 'delvis_medhold')::int delvis,
          count(*) filter (where ${TAPT})::int avslag
        from vedtak v where ${await utvalgSql()}`);
      return { n: Number(r.n), fullt: Number(r.fullt), delvis: Number(r.delvis), avslag: Number(r.avslag), trinn: t.nr, beskrivelse: t.beskrivelse, spesifikk: t.spesifikk };
    },

    async belop(): Promise<BelopTall> {
      const [r] = await rader<Record<string, unknown>>(sql`select
          count(*) filter (where v.tilkjent_totalt_nok > 0)::int t_n,
          percentile_cont(0.25) within group (order by v.tilkjent_totalt_nok) filter (where v.tilkjent_totalt_nok > 0) t_p25,
          percentile_cont(0.5) within group (order by v.tilkjent_totalt_nok) filter (where v.tilkjent_totalt_nok > 0) t_med,
          percentile_cont(0.75) within group (order by v.tilkjent_totalt_nok) filter (where v.tilkjent_totalt_nok > 0) t_p75,
          count(*) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0)::int p_n,
          percentile_cont(0.25) within group (order by v.tilkjent_prisavslag_nok::float / nullif(v.utbedringskostnad_nok, 0)) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0) p_p25,
          percentile_cont(0.5) within group (order by v.tilkjent_prisavslag_nok::float / nullif(v.utbedringskostnad_nok, 0)) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0) p_med,
          percentile_cont(0.75) within group (order by v.tilkjent_prisavslag_nok::float / nullif(v.utbedringskostnad_nok, 0)) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0) p_p75,
          count(*) filter (where v.prinsipalt_krav = 'heving')::int h_n,
          count(*) filter (where v.prinsipalt_krav = 'heving' and v.utfall = 'medhold')::int h_fullt,
          count(*) filter (where v.prinsipalt_krav = 'heving' and v.utfall = 'delvis_medhold')::int h_delvis,
          count(*) filter (where v.krevd_erstatning_nok > 0)::int e_krevd,
          count(*) filter (where v.tilkjent_erstatning_nok > 0)::int e_tilkjent,
          percentile_cont(0.5) within group (order by v.tilkjent_erstatning_nok) filter (where v.tilkjent_erstatning_nok > 0) e_med
        from vedtak v where ${await utvalgSql()}`);
      const hn = Number(r.h_n);
      return {
        tilkjent: kvartiler(r.t_n, r.t_p25, r.t_med, r.t_p75),
        prisavslagAvUtbedring: kvartiler(r.p_n, r.p_p25, r.p_med, r.p_p75),
        heving: hn > 0 ? { n: hn, fullt: Number(r.h_fullt), delvis: Number(r.h_delvis), ikke: hn - Number(r.h_fullt) - Number(r.h_delvis) } : null,
        erstatning: { nKrevd: Number(r.e_krevd), nTilkjent: Number(r.e_tilkjent), median: tall(r.e_med) },
      };
    },

    async temaer(): Promise<TemaTall> {
      const betingelse = await utvalgSql();
      const [sum] = await rader<{ medhold: number; avslag: number }>(sql`select count(*) filter (where ${VUNNET})::int medhold, count(*) filter (where ${TAPT})::int avslag from vedtak v where ${betingelse}`);
      const kilde = (navn: "tvistetema" | "bevistyper" | "mangelsgrunnlag") =>
        sql`select ${navn}::text kilde, t verdi, count(*) filter (where ${VUNNET})::int n_medhold, count(*) filter (where ${TAPT})::int n_avslag
            from vedtak v, unnest(v.${sql.identifier(navn)}) t where ${betingelse} group by t`;
      const alle = await rader<{ kilde: TemaTall["rader"][number]["kilde"]; verdi: string; n_medhold: number; n_avslag: number }>(
        sql`${kilde("tvistetema")} union all ${kilde("bevistyper")} union all ${kilde("mangelsgrunnlag")}`,
      );
      return { medhold: Number(sum.medhold), avslag: Number(sum.avslag), rader: alle.map((a) => ({ kilde: a.kilde, verdi: a.verdi, nMedhold: Number(a.n_medhold), nAvslag: Number(a.n_avslag) })) };
    },

    async eksempler(): Promise<EksempelVedtak[]> {
      const betingelse = await utvalgSql();
      const velg = (utfall: SQL, grense: number) => sql`select v.id, v.saksnummer, extract(year from v.vedtaksdato)::int ar, v.utfall, v.tilkjent_totalt_nok, v.sammendrag,
          v.utvalgets_nokkelmomenter momenter, v.kilde_url, v.merke, v.modell, v.dager_til_reklamasjon
        from vedtak v where ${betingelse} and ${KVALIFISERT} and ${utfall} order by v.vedtaksdato desc limit ${grense}`;
      const [vunne, tapte] = await Promise.all([rader<Record<string, unknown>>(velg(VUNNET, 3)), rader<Record<string, unknown>>(velg(sql`v.utfall = 'ikke_medhold'`, 2))]);
      return [...vunne, ...tapte].map(tilEksempel);
    },

    async forhandler(navn, orgnr): Promise<ForhandlerTall | null> {
      const norm = navn ? normaliserFirmanavn(navn) : null;
      const brukNorm = norm !== null && norm !== "null" && norm.length >= 3;
      if (!orgnr && !brukNorm) return null;
      const treff = orgnr && brukNorm ? sql`(v.selger_orgnr = ${orgnr} or v.selger_navn_norm = ${norm})` : orgnr ? sql`v.selger_orgnr = ${orgnr}` : sql`v.selger_navn_norm = ${norm}`;
      const [r] = await rader<{ n: number; vunnet: number; siste_ar: number | null }>(sql`select count(*)::int n, count(*) filter (where ${VUNNET})::int vunnet, max(extract(year from v.vedtaksdato))::int siste_ar from vedtak v where ${treff}`);
      const ft = await rader<{ verdi: string; n: number }>(sql`select ft verdi, count(*)::int n from vedtak v, unnest(v.feiltyper) ft where ${treff} group by ft order by n desc limit 3`);
      return { n: Number(r.n), vunnet: Number(r.vunnet), sisteAr: tall(r.siste_ar), feiltyper: ft.map((x) => ({ verdi: x.verdi, n: Number(x.n) })) };
    },

    async modell(merke, modell): Promise<ModellTall> {
      const m = normaliserMerke(merke);
      if (!m) return { n: 0, vunnet: 0 };
      const [r] = await rader<{ n: number; vunnet: number }>(sql`select count(*)::int n, count(*) filter (where ${VUNNET})::int vunnet from vedtak v where ${FORHANDLER} and v.merke = ${m} and lower(v.modell) = lower(${modell})`);
      return { n: Number(r.n), vunnet: Number(r.vunnet) };
    },

    async bevis(): Promise<BevisTall> {
      const [r] = await rader<Record<string, number>>(sql`select count(*) filter (where ${VUNNET})::int n_medhold,
          count(*) filter (where ${VUNNET} and 'verkstedrapport' = any(v.bevistyper))::int verkstedrapport,
          count(*) filter (where ${VUNNET} and 'bilder' = any(v.bevistyper))::int bilder,
          count(*) filter (where ${VUNNET} and 'takst' = any(v.bevistyper))::int takst,
          count(*) filter (where ${VUNNET} and 'NAF_test' = any(v.bevistyper))::int naf,
          count(*) filter (where ${VUNNET} and 'kvittering' = any(v.bevistyper))::int kvittering
        from vedtak v where ${await utvalgSql()}`);
      return { nMedhold: Number(r.n_medhold), verkstedrapport: Number(r.verkstedrapport), bilder: Number(r.bilder), takst: Number(r.takst), naf: Number(r.naf), kvittering: Number(r.kvittering) };
    },
  };
}

function tilEksempel(r: Record<string, unknown>): EksempelVedtak {
  return {
    id: Number(r.id),
    saksnummer: String(r.saksnummer),
    ar: Number(r.ar),
    utfall: r.utfall as EksempelVedtak["utfall"],
    tilkjentNok: tall(r.tilkjent_totalt_nok),
    sammendrag: (r.sammendrag as string | null) ?? null,
    momenter: ((r.momenter as string[] | null) ?? []).slice(0, 10),
    kildeUrl: String(r.kilde_url),
    merke: (r.merke as string | null) ?? null,
    modell: (r.modell as string | null) ?? null,
    dagerTilReklamasjon: tall(r.dager_til_reklamasjon),
  };
}

// The decisions the buyer has chosen to cite, read from the database so the letter never quotes text
// the client sent. A decision that no longer qualifies, does not exist or was a loss is dropped.
export async function hentLignende(valg: Lignende[]): Promise<LignendeRef[]> {
  if (valg.length === 0) return [];
  const ider = valg.map((v) => v.id);
  const funnet = await rader<Record<string, unknown>>(sql`select v.id, v.saksnummer, extract(year from v.vedtaksdato)::int ar, v.utfall, v.utvalgets_nokkelmomenter momenter, v.kilde_url
    from vedtak v where v.id = any(${ider}::int[]) and ${FORHANDLER} and ${VUNNET} and ${KVALIFISERT}`);
  const ut: LignendeRef[] = [];
  for (const v of valg) {
    const r = funnet.find((x) => Number(x.id) === v.id);
    const moment = r ? ((r.momenter as string[]) ?? [])[v.moment] : undefined;
    if (!r || !moment) continue;
    ut.push({ saksnummer: String(r.saksnummer), ar: Number(r.ar), utfall: r.utfall as LignendeRef["utfall"], moment, kildeUrl: String(r.kilde_url) });
  }
  return ut;
}
```

Check while running: (a) `trinnFor` returns `{beskrivelse, betingelse, spesifikk, medBotte}`; (b) `normaliserFirmanavn`/`normaliserMerke` signatures in `src/lib/normalisering.ts` — read the file first and adapt the null handling; (c) the `?` operator inside a Drizzle `sql` template (`sitater ? 'utfall'`) works as in `src/lib/data/statistikk.ts`; (d) `= any(${ider}::int[])` — if the neon driver rejects an array parameter, use `sql.join(ider.map((i) => sql`${i}`), sql`, `)` inside `in (...)`.

- [ ] **Step 3: Run the integration test and fix the SQL**

Run: `npx vitest run src/lib/mappe/hent.test.ts`
Expected: PASS. Read the actual output of `data.utvalg()`, `data.belop()`, `data.eksempler()` once (a throwaway `tsx --env-file=.env.local` script in the scratchpad printing them) and sanity-check against the earlier survey: median prisavslag ≈ 0.71 of repair cost; ≈ 20 % full heving among heving claims in the full dealer sample.

- [ ] **Step 4: Write the route test (e2e API-level), then the route.** Add to `e2e/saksmappe.spec.ts` (created fully in Task 7; for now only these two):

```ts
import { expect, test } from "./fixtures";
import { TOM_INNSENDING, type Innsending } from "../src/lib/vurdering/innsending";

const AR = new Date().getFullYear();
export const svar = (o: Partial<Innsending> = {}): Innsending => ({
  ...TOM_INNSENDING,
  kjopsdato: `${AR - 1}-03-12`,
  kjopesum: "250000",
  kmVedKjop: "80000",
  feiltyper: ["motor"],
  oppdaget: "innen_6_mnd",
  opplystForKjop: "nei",
  feilOpplysning: "nei",
  kontakt: "avvist",
  verkstedrapport: "nei",
  bilder: "ja",
  ...o,
});

test("mappe-API: gir de seks kortene for en sak, og 404 for en som ikke finnes", async ({ request, sak }) => {
  const url = await sak.apne(svar());
  const res = await request.get(`/api/sak${url.replace("/brev", "")}/mappe`);
  expect(res.status()).toBe(200);
  const mappe = await res.json();
  expect(Object.keys(mappe).sort()).toEqual(["aktorer", "avgjorde", "belop", "idag", "styrk", "styrke", "videre"]);
  expect(mappe.styrke.n).toBeGreaterThan(0);

  const ingen = await request.get("/api/sak/AAAAAAAAAAAAAAAAAAAAAA/mappe");
  expect(ingen.status()).toBe(404);
});
```

Route `src/app/api/sak/[id]/mappe/route.ts`:

```ts
import { hentSak } from "@/lib/brev/sak";
import { erSakId } from "@/lib/brev/utfylling";
import { byggMappe } from "@/lib/mappe/bygg";
import { lagMappeData } from "@/lib/mappe/hent";
import { ipFra, lagGrense } from "@/lib/rategrense";
import { beregnFaktorer, iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";

const forMange = lagGrense({ antall: 60, vinduMs: 60_000 });
const FINNES_IKKE = { feil: "Vi finner ikke denne saken. Den kan være slettet." };

// The saksmappe of a case: numbers from earlier decisions, computed now. Nothing is stored or logged.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!erSakId(id)) return Response.json(FINNES_IKKE, { status: 404 });
  if (forMange(ipFra(request))) return Response.json({ feil: "Vent et minutt og prøv igjen." }, { status: 429 });
  try {
    const sak = await hentSak(id);
    if (!sak) return Response.json(FINNES_IKKE, { status: 404 });
    const idag = iDag();
    const lest = tilKlageInput(sak.svar, idag);
    if (!lest.ok) return Response.json({ feil: "Svarene i saken gir ikke en sak. Rett svarene først." }, { status: 409 });
    const mappe = await byggMappe(sak, lagMappeData(beregnFaktorer(lest.input, idag)), idag);
    return Response.json(mappe, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("bygging av saksmappe feilet");
    return Response.json({ feil: "Vi fikk ikke laget saksmappen. Prøv igjen om litt." }, { status: 500 });
  }
}
```

Run: `npx playwright test e2e/saksmappe.spec.ts --project=desktop`
Expected: PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 7: Saksmappe tab (UI)

**Files:**
- Create: `src/app/brev/mappe/saksmappe.tsx`, `src/app/brev/mappe/kort.tsx`
- Modify: `src/app/brev/brevside.tsx`, `src/app/api/sak/[id]/route.ts`, `src/app/api/sak/[id]/svar/route.ts`, `src/app/brev/[id]/page.tsx`
- Modify: `e2e/saksmappe.spec.ts`, `e2e/fixtures.ts` (add a `Mappe` page object), create `specs/saksmappe.md`

**Interfaces:**
- Consumes: `Mappe` (Task 5), `Endring`/`Utfylling` (Task 1), `GET /api/sak/[id]/mappe` (Task 6), `hentLignende` (Task 6), `LignendeRef` (Task 2).
- Produces: `Saksmappe` component; PATCH and PUT responses now also contain `lignende: LignendeRef[]` (the resolved citations for the saved `utfylling.lignende`); `BrevSide` gets a `startLignende: LignendeRef[]` prop and a «Brev | Saksmappe» tab bar.

- [ ] **Step 1: Plan the scenarios** — write `specs/saksmappe.md` (made-up data only) listing: (1) the six cards render with headings and sample size; (2) thin sample → «for få saker» (mocked); (3) «Ta med i brevet» adds a paragraph with the case number and «Fjern» removes it; (4) checklist tick survives reload; (5) date sent → deadlines and reminder appear; (6) 409 message when answers give no letter; (7) tab bar keyboard behaviour; (8) mobile width has no horizontal scroll.

- [ ] **Step 2: Return resolved citations from the saves.** In `src/app/api/sak/[id]/route.ts` PATCH, replace `return Response.json({ utfylling: await endreSak(id, lest.endring, sak) });` with:

```ts
    const utfylling = await endreSak(id, lest.endring, sak);
    return Response.json({ utfylling, lignende: await hentLignende(utfylling.lignende ?? []) });
```

and the same in `svar/route.ts` PUT (`lignende: await hentLignende(utfylling.lignende ?? [])` next to `svar`/`utfylling`). In `page.tsx` compute `const lignende = await hentLignende(sak.utfylling.lignende ?? [])` and pass `startLignende={lignende}`. Update `brevForSak` (Task 4) to `byggBrev(lest.input, idag, sak.utfylling, await hentLignende(sak.utfylling.lignende ?? []))` so downloads include the citations. If `hentLignende` throws, `brevForSak` and the page fall back to `[]` (wrap in try/catch — the letter must open without the database being able to answer).

- [ ] **Step 3: Write the failing e2e tests** — extend `e2e/fixtures.ts` with a page object and register it:

```ts
// The saksmappe tab on the letter page.
export class Mappe {
  constructor(private readonly page: Page) {}
  get fane() { return this.page.getByRole("tab", { name: "Saksmappe" }); }
  get brevFane() { return this.page.getByRole("tab", { name: "Brev" }); }
  kort(navn: string) { return this.page.getByRole("region", { name: navn }); }
}
```

(add `mappe: Mappe` to the `test.extend` generic and a fixture entry like `brev`). Then in `e2e/saksmappe.spec.ts`:

```ts
const KORT = ["Sakens styrke", "Hva kan du få?", "Hva avgjorde lignende saker?", "Forhandleren og bilen", "Styrk saken", "Veien videre"];

test("saksmappen viser de seks kortene med utvalgsstørrelse", async ({ page, mappe, sak }) => {
  await page.goto(await sak.apne(svar()));
  await mappe.fane.click();
  for (const navn of KORT) await expect(mappe.kort(navn)).toBeVisible();
  await expect(mappe.kort("Sakens styrke")).toContainText(/\d+ lignende saker/);
  await expect(mappe.kort("Sakens styrke")).toContainText("gitt at saken gikk til vedtak");
});

test("tynt utvalg: «for få saker» og ingen tall", async ({ page, mappe, sak }) => {
  await page.route("**/api/sak/*/mappe", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.styrke.n = 4;
    json.styrke.medhold = { forFa: true, n: 4 };
    await route.fulfill({ response: res, json });
  });
  await page.goto(await sak.apne(svar()));
  await mappe.fane.click();
  await expect(mappe.kort("Sakens styrke")).toContainText("for få saker");
  await expect(mappe.kort("Sakens styrke")).not.toContainText("%");
});

test("«Ta med i brevet» legger saksnummeret i brevet, og «Fjern» tar det bort igjen", async ({ page, mappe, brev, sak }) => {
  await page.goto(await sak.apne(svar()));
  await mappe.fane.click();
  const eksempel = mappe.kort("Hva avgjorde lignende saker?").getByRole("listitem").first();
  test.skip((await eksempel.count()) === 0, "ingen kvalifiserte eksempler for dette utvalget");
  const saksnummer = (await eksempel.getByRole("link", { name: /Forbrukerklageutvalget, sak / }).innerText()).replace(/^.*sak /, "");
  await eksempel.getByRole("button", { name: "Siter i brevet" }).first().click();
  await expect(eksempel.getByRole("button", { name: "Fjern fra brevet" })).toBeVisible();
  await mappe.brevFane.click();
  await expect(brev.ark).toContainText(`Sak ${saksnummer}`);
  await page.reload();
  await expect(brev.ark).toContainText(`Sak ${saksnummer}`);
  await mappe.fane.click();
  await eksempel.getByRole("button", { name: "Fjern fra brevet" }).click();
  await mappe.brevFane.click();
  await expect(brev.ark).not.toContainText(`Sak ${saksnummer}`);
});

test("avkryssing i sjekklisten overlever en omlasting", async ({ page, mappe, sak }) => {
  await page.goto(await sak.apne(svar()));
  await mappe.fane.click();
  const boks = mappe.kort("Styrk saken").getByRole("checkbox", { name: /Lagre annonsen/ });
  await boks.check();
  await expect(boks).toBeChecked();
  await page.reload();
  await mappe.fane.click();
  await expect(mappe.kort("Styrk saken").getByRole("checkbox", { name: /Lagre annonsen/ })).toBeChecked();
});

test("datoen brevet ble sendt gir frister og purring", async ({ page, mappe, sak }) => {
  await page.goto(await sak.apne(svar()));
  await mappe.fane.click();
  const videre = mappe.kort("Veien videre");
  await videre.getByLabel("Dato brevet ble sendt").fill(`${AR}-01-05`);
  await videre.getByRole("button", { name: "Lagre dato" }).click();
  await expect(videre).toContainText("19. januar");
  await expect(videre.getByRole("link", { name: "Last ned purring (PDF)" })).toBeVisible();
});

test("svar som ikke gir et brev: mappen sier fra i stedet for å vise noe feil", async ({ page, mappe, sak }) => {
  await page.route("**/api/sak/*/mappe", (route) => route.fulfill({ status: 409, json: { feil: "Svarene i saken gir ikke en sak. Rett svarene først." } }));
  await page.goto(await sak.apne(svar()));
  await mappe.fane.click();
  await expect(page.getByRole("alert")).toContainText("Rett svarene først");
});

test("ingen horisontal scrolling på mappen", async ({ page, mappe, sak }) => {
  await page.goto(await sak.apne(svar()));
  await mappe.fane.click();
  await expect(mappe.kort("Veien videre")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
```

(The fixed date `${AR}-01-05` requires today to be after 5 January; if the suite may run in the first days of January use `page.clock.setFixedTime` as CLAUDE.md allows. The purring link appears in Task 9; keep that assertion out of Task 7's run by writing the test body up to the date check now and extending it in Task 9.)

Run: `npx playwright test e2e/saksmappe.spec.ts --project=desktop`
Expected: FAIL (no tab).

- [ ] **Step 4: Implement the tab bar.** In `brevside.tsx`:

```tsx
type Fane = "brev" | "mappe";
// inside BrevSide: const [fane, setFane] = useState<Fane>("brev"); const [lignende, setLignende] = useState(startLignende);
// lagre()/lagreSvar(): setLignende(json.lignende ?? []) next to setUtfylling.
const faner = (
  <div role="tablist" aria-label="Sakens deler" className="flex gap-1 border-b border-[#d3cec3] lg:col-span-2">
    {(["brev", "mappe"] as const).map((f) => (
      <button key={f} role="tab" id={`fane-${f}`} aria-selected={fane === f} aria-controls={`panel-${f}`} tabIndex={fane === f ? 0 : -1}
        onClick={() => setFane(f)}
        onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { setFane(f === "brev" ? "mappe" : "brev"); document.getElementById(`fane-${f === "brev" ? "mappe" : "brev"}`)?.focus(); } }}
        className={`-mb-px border-b-2 px-4 py-3 text-[15px] font-semibold ${fane === f ? "border-[#17263d] text-[#17263d]" : "border-transparent text-[#5b6472]"}`}>
        {f === "brev" ? "Brev" : "Saksmappe"}
      </button>
    ))}
  </div>
);
```

Render `faner` as the first child of `<Ramme>` in the normal return; when `fane === "mappe"` render `<div role="tabpanel" id="panel-mappe" aria-labelledby="fane-mappe" className="lg:col-span-2 …"><Saksmappe … /></div>` **instead of** the two existing sections; otherwise render the existing two sections inside `<div role="tabpanel" id="panel-brev" aria-labelledby="fane-brev" className="contents">`. The early-return branch (`!input`) keeps no tabs.

- [ ] **Step 5: Implement `saksmappe.tsx`.**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Endring, Utfylling } from "@/lib/brev/utfylling";
import type { Mappe } from "@/lib/mappe/typer";
import { Kort, StyrkeInnhold, BelopInnhold, AvgjordeInnhold, AktorInnhold, StyrkInnhold, VidereInnhold } from "./kort";

type Tilstand = { type: "laster" } | { type: "feil"; melding: string } | { type: "ok"; mappe: Mappe };

// The saksmappe: fetched when the tab opens and again when what it depends on changes (the answers,
// the claim, the dealer, the choices below). `lagre` saves one field of the case and says whether it worked.
export function Saksmappe({ sakId, avhengighet, utfylling, lagre }: { sakId: string; avhengighet: string; utfylling: Utfylling; lagre: (e: Endring) => Promise<boolean> }) {
  const [t, setT] = useState<Tilstand>({ type: "laster" });
  useEffect(() => {
    const avbryt = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/sak/${sakId}/mappe`, { signal: avbryt.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.feil ?? "");
        setT({ type: "ok", mappe: json as Mappe });
      } catch (e) {
        if (avbryt.signal.aborted) return;
        setT({ type: "feil", melding: (e instanceof Error && !(e instanceof TypeError) && e.message) || "Vi fikk ikke hentet saksmappen. Prøv igjen om litt." });
      }
    })();
    return () => avbryt.abort();
  }, [sakId, avhengighet]);

  if (t.type === "laster") return <p role="status" className="m-0 text-[14px] text-[#5b6472]">Henter saksmappen …</p>;
  if (t.type === "feil") return <p role="alert" className="m-0 text-[14px] text-[#a23b2a]">{t.melding}</p>;
  const m = t.mappe;
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-5">
      <p className="m-0 max-w-[720px] text-[14px] leading-[1.6] text-[#3d4757]">
        Tallene er hentet fra tidligere vedtak i Forbrukerklageutvalget om bruktbil, og viser sjansen gitt at saken gikk til vedtak. Saker som ble avgjort uten vedtak er ikke med. De sier noe om hva som er vanlig, ikke hva som skjer i din sak.
      </p>
      <Kort tittel="Sakens styrke"><StyrkeInnhold k={m.styrke} /></Kort>
      <Kort tittel="Hva kan du få?"><BelopInnhold k={m.belop} /></Kort>
      <Kort tittel="Hva avgjorde lignende saker?"><AvgjordeInnhold k={m.avgjorde} valgt={utfylling.lignende ?? []} lagre={lagre} /></Kort>
      <Kort tittel="Forhandleren og bilen"><AktorInnhold k={m.aktorer} /></Kort>
      <Kort tittel="Styrk saken"><StyrkInnhold punkter={m.styrk} lagre={lagre} sjekket={utfylling.sjekket ?? []} /></Kort>
      <Kort tittel="Veien videre"><VidereInnhold k={m.videre} sakId={sakId} sendt={utfylling.sendt} idag={m.idag} lagre={lagre} /></Kort>
    </div>
  );
}
```

`avhengighet` is a string built in `BrevSide`: `JSON.stringify([svar, utfylling.krav, utfylling.forhandler, utfylling.forbehold, utfylling.sendt])` — deliberately **not** including `sjekket`/`lignende` (they do not change the numbers, and refetching on every tick would flicker). The checklist and example buttons update from `utfylling` (already in state), so the card shows the new state without a refetch; but `m.styrk[i].sjekket` comes from the fetched data — so in `StyrkInnhold` read `sjekket` from the `utfylling` prop, not from the point.

`kort.tsx` — one exported component per card plus a `Kort` wrapper:

```tsx
export function Kort({ tittel, children }: { tittel: string; children: ReactNode }) {
  const id = useId();
  return (
    <section role="region" aria-labelledby={id} className="rounded-lg border border-[#dcd8cf] bg-white p-5 md:p-7">
      <h3 id={id} className="m-0 mb-3 font-brev text-[19px] font-semibold leading-[1.3]">{tittel}</h3>
      <div className="flex flex-col gap-3 text-[14px] leading-[1.6] text-[#3d4757]">{children}</div>
    </section>
  );
}
```

Write the six contents against the `Mappe` types, following these display rules (each rule is also a Playwright assertion above or in Task 10):
- `StyrkeInnhold`: if `erForFa(k.medhold)` → «Vi har for få saker som ligner din (N) til å si noe sikkert.» and **no percent sign anywhere in the card**; else «**{andel} %** fikk medhold eller delvis medhold i {n} lignende saker (95 % intervall {lav}–{hoy} %)». A stacked bar for fullt/delvis/avslag with text labels (not color only). Line with `k.beskrivelse` («Utvalget: {beskrivelse}»; when `!k.spesifikk`: «Vi fant ikke nok saker med samme feil, så tallet gjelder alle forhandlersaker.»). Footnote: «Feil du krysset av er feil klageren påberopte, ikke nødvendigvis de utvalget godtok.»
- `BelopInnhold`: `tilkjent` quartiles as «Typisk tilkjent beløp: median X kr (midtre halvdel A–B kr, N saker)»; `prisavslag` as a range line; `heving` as three numbers; `erstatning` as «{andel} % av kravene om erstatning ble tilkjent helt eller delvis, median X kr»; each `anbefaling` as a paragraph under the heading «Slik bør kravet settes opp». A null block renders nothing; if all are null: «For få lignende saker med oppgitte beløp.»
- `AvgjordeInnhold`: heading «Hva kom opp i vunne og tapte saker» listing `temaer` as «**{tekst}** — kommer opp i {andelAvslag} % av tapte saker mot {andelMedhold} % av vunne» (percent rounded). Then `eksempler` as `<ul>` of `<li>`: header line «{ar} · {utfall-tekst}{tilkjent}», `sammendrag`, the key points as a list where each has a button «Siter i brevet» (only for won decisions, disabled when 3 are already chosen) that calls `lagre({ lignende: [...valgt, { id, moment: n }] })`; when chosen the same position shows «Fjern fra brevet» (`lagre({ lignende: valgt.filter(v => v.id !== id) })`; send `null`? no — an empty array is valid). Each example has `<a href={kildeUrl} target="_blank" rel="noreferrer">Forbrukerklageutvalget, sak {saksnummer}</a>` and the sentence «Nøkkelpunktene er et sammendrag laget av en modell. Les vedtaket før du bruker det.» Lost decisions are labelled «Tapt sak» and have no cite button.
- `AktorInnhold`: forhandler block (n, medhold with interval or «for få saker», siste år, «Vanligste feil: …», and when `gammel`: «Historikken er fra før 2024 og kan være utdatert.») and bil block; both absent → «Vi har ingen tidligere vedtak om denne forhandleren/modellen.»
- `StyrkInnhold`: each point is `<label><input type="checkbox" checked={sjekket.includes(p.nokkel)} onChange={…lagre({ sjekket: next })} /> {tittel}</label>` followed by `tekst` and, when `p.andel` is a number, «{andel} % av vunne saker hadde dette (N saker)».
- `VidereInnhold`: the `steg` timeline with `norskDato(dato)` when set; a form «Dato brevet ble sendt» (`<input type="date" max={idag}>`, button «Lagre dato» → `lagre({ sendt })`, with a «Fjern datoen» button → `lagre({ sendt: null })`); `ventetid`; then «Hvis forhandleren svarer» listing `motargumenter` as `<details>` (relevant ones open) with «Svar:» text and a «Kopier svar» button (`navigator.clipboard.writeText`, wrapped in try/catch); the purring links appear in Task 9.

Import `norskDato` from `@/lib/brev/brev` (it is pure).

- [ ] **Step 6: Run the tests**

Run: `npx playwright test e2e/saksmappe.spec.ts e2e/brev.spec.ts --project=desktop --project=mobil`
Expected: PASS (the «purring» assertion is added in Task 9).

- [ ] **Step 7: Look at it** — open a real case (`sak.apne` equivalent: use the app flow or `curl` a POST) with Playwright MCP, screenshot desktop (1280) and mobile (390) for every card, read them, and fix layout, wording or contrast problems. Check that a thin-sample car/dealer shows «for få saker» (use a made-up make) and that nothing reads as legal advice.

- [ ] **Step 8: Checkpoint.**

---

### Task 8: Cited decisions end to end

**Files:**
- Modify: `src/lib/brev/dokument.ts` (done in Task 7 Step 2 — verify), `src/app/brev/brevside.tsx` (pass `lignende` to `byggBrev`), `e2e/eksport.spec.ts`

**Interfaces:** Consumes `LignendeRef`, `hentLignende`; produces nothing new.

- [ ] **Step 1: Pass the resolved citations to the preview.** In `brevside.tsx` change the two `byggBrev(input, idag, utfylling)` calls to `byggBrev(input, idag, utfylling, lignende)`.

- [ ] **Step 2: Write the failing tests.** Add to `e2e/saksmappe.spec.ts`:

```ts
test("et vedtak som ikke kvalifiserer, eller en id som ikke finnes, havner ikke i brevet og ødelegger ikke saken", async ({ page, brev, sak, request }) => {
  const url = await sak.apne(svar());
  const id = url.split("/").pop();
  const res = await request.patch(`/api/sak/${id}`, { data: { lignende: [{ id: 2_000_000_000, moment: 0 }] } });
  expect(res.status()).toBe(200);
  expect((await res.json()).lignende).toEqual([]);
  await page.goto(url);
  await expect(brev.ark).not.toContainText("Forbrukerklageutvalgets behandling");
  await expect(brev.overskrift).toBeVisible();
});

test("PATCH avviser mer enn tre vedtak", async ({ request, sak }) => {
  const url = await sak.apne(svar());
  const res = await request.patch(`/api/sak/${url.split("/").pop()}`, { data: { lignende: [1, 2, 3, 4].map((id) => ({ id, moment: 0 })) } });
  expect(res.status()).toBe(400);
});
```

and to `e2e/eksport.spec.ts` a test that a cited decision is in the downloaded Word file (unzip with `jszip`, assert `Sak <saksnummer>` appears) — pick the first eligible example via `GET /api/sak/[id]/mappe`, cite it via `PATCH`, download `brev.docx`, assert. Skip with a reason if the sample has no eligible example.

- [ ] **Step 3: Run**

Run: `npx playwright test e2e/saksmappe.spec.ts e2e/eksport.spec.ts --project=desktop --project=mobil`
Expected: PASS.

- [ ] **Step 4: Checkpoint.**

---

### Task 9: Reminder letter and the objection answers

**Files:**
- Create: `src/lib/brev/purring.ts`, `src/lib/brev/purring.test.ts`
- Modify: `src/lib/brev/dokument.ts` (add `purringForSak`), `src/app/api/sak/[id]/dokument/[fil]/route.ts` (accept `purring.pdf` / `purring.docx`), `src/app/brev/mappe/kort.tsx` (links), `e2e/saksmappe.spec.ts`

**Interfaces:**
- Consumes: `Brev`, `norskDato`, `SVARFRIST_DAGER`/`PURRING_DAGER`/`leggTilDager` (Task 5 `videre.ts`).
- Produces:
  ```ts
  export function byggPurring(input: KlageInput, idag: string, u: Utfylling): Brev;
  export function purringForSak(sak: Sak, idag?: string): Promise<Brev | null>;
  ```

- [ ] **Step 1: Failing unit tests** — `src/lib/brev/purring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KlageInput } from "@/lib/vurdering/typer";
import { byggPurring } from "./purring";

const IDAG = "2026-10-02";
const klage: KlageInput = {
  kvalifisering: { selgerType: "forhandler", privatBruk: true },
  bilOgKjop: { kjopsdato: "2026-03-12", kjopesumNok: 250000, kmVedKjop: 80000 },
  feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "avvist" },
  bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: true },
};
const bil = { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2019 };

describe("byggPurring", () => {
  it("viser til brevet og fristen som gikk ut, og gir en ny frist på sju dager fra i dag", () => {
    const b = byggPurring(klage, IDAG, { kjoretoy: bil, sendt: "2026-09-10" });
    const t = b.avsnitt.join("\n");
    expect(b.emne).toContain("Purring");
    expect(t).toContain("10. september 2026");
    expect(t).toContain("24. september 2026"); // 14 days after sending
    expect(t).toContain("9. oktober 2026"); // 7 days from today
    expect(t).toContain("Forbrukerklageutvalget");
  });
  it("uten sendt-dato er datoen en plassholder", () => {
    expect(byggPurring(klage, IDAG, {}).avsnitt.join("\n")).toContain("[dato for brevet]");
  });
  it("bruker samme avsender og mottaker som brevet", () => {
    const b = byggPurring(klage, IDAG, { forhandler: { type: "fritekst", navn: "Testbil AS" }, avsender: { navn: "Test Testesen", adresse: "Testveien 1", postnummer: "0123", poststed: "Oslo" } });
    expect(b.mottaker[0]).toBe("Testbil AS");
    expect(b.avsender[0]).toBe("Test Testesen");
  });
});
```

- [ ] **Step 2: Implement `purring.ts`** — reuse `byggBrev` for the address blocks and the subject, then replace the body:

```ts
import { iDag } from "@/lib/vurdering/faktorer";
import type { KlageInput } from "@/lib/vurdering/typer";
import { byggBrev, norskDato, type Brev } from "./brev";
import { leggTilDager, PURRING_DAGER, SVARFRIST_DAGER } from "@/lib/mappe/kort/videre";
import type { Utfylling } from "./utfylling";

// The reminder sent when the dealer has not answered by the deadline of the first letter. Same
// sender, recipient and car as the letter; only the body differs.
export function byggPurring(input: KlageInput, idag = iDag(), u: Utfylling = {}): Brev {
  const grunn = byggBrev(input, idag, u);
  const sendt = u.sendt ? norskDato(u.sendt) : "[dato for brevet]";
  const frist = u.sendt ? norskDato(leggTilDager(u.sendt, SVARFRIST_DAGER)) : "[svarfristen]";
  return {
    ...grunn,
    emne: grunn.emne.replace(/^Reklamasjon på mangel/, "Purring – reklamasjon på mangel"),
    avsnitt: [
      `Jeg viser til mitt reklamasjonsbrev av ${sendt} om ovennevnte bil. Fristen for å svare var ${frist}, og jeg har ikke mottatt svar som løser saken.`,
      `Jeg opprettholder kravet i brevet og gir dere en ny frist på ${PURRING_DAGER} dager, det vil si innen ${norskDato(leggTilDager(idag, PURRING_DAGER))}.`,
      "Hører jeg ikke fra dere innen den fristen, vil jeg bringe saken inn for Forbrukerklageutvalget uten ytterligere varsel.",
    ],
  };
}
```

Export `SVARFRIST_DAGER` from `brev.ts` as well and make `videre.ts` import it from there if the two constants would otherwise be duplicated (one source: `brev.ts`).

- [ ] **Step 3: Wire up.** Add `purringForSak` to `dokument.ts` (same pattern as `brevForSak`, `byggPurring(lest.input, idag, sak.utfylling)`); extend `FILER` in the route with `"purring.pdf"` / `"purring.docx"` (file names `purring.pdf` / `purring.docx`, same content types) and pick the builder by `fil.startsWith("purring")`. In `VidereInnhold` show, only when `sendt` is set, `<a href=…/dokument/purring.pdf download>Last ned purring (PDF)</a>` and the Word link.

- [ ] **Step 4: Extend the e2e test** «datoen brevet ble sendt gir frister og purring» with a download of `purring.pdf` (header `%PDF-`) and add a test that without a date the purring links are absent.

Run: `npx vitest run && npx playwright test e2e/saksmappe.spec.ts e2e/eksport.spec.ts --project=desktop --project=mobil`
Expected: PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 10: Integration, iteration in the browser, documentation

**Files:** `CLAUDE.md`, `specs/saksmappe.md`, whatever the browser pass shows needs fixing.

- [ ] **Step 1: Whole suite.**

Run: `npm test && npm run typecheck && npm run lint && npm run test:e2e`
Expected: all green. For any red test follow the CLAUDE.md procedure: read the message and `test-results/` first; update a test only for an intended UI change; fix the app for an app bug; never `skip`/`fixme` or weaken an expectation.

- [ ] **Step 2: Walk the real flow in the browser** (Playwright MCP, desktop and 390 px): `/vurdering` → fill the four steps with made-up answers (mock-free path needs the real Vegvesen key; if it is missing, create the case with `POST /api/sak` as the e2e fixture does) → letter page → fill every step → read the finished letter top to bottom for wording and legal sense → saksmappe tab → read each card with the numbers next to the database (spot-check three numbers with a throwaway SQL script in the scratchpad) → cite two decisions → download PDF and Word and open them → set the sent date → download the reminder. Write down everything that reads wrong, is ugly, or is unclear, fix it, and re-run the affected tests. Repeat until a first-time buyer would understand every card without explanation.

- [ ] **Step 3: Honest-product check.** Re-read the sales card (`NESTE_PUNKTER` in `skjema.tsx`) against what now exists; each promised line must be true: «Formuleringer etter og henvisninger til lovverk», «Henvisninger til lignende saker som fikk medhold» (only when we have one), «Frist for svar fra forhandleren», «Hva du gjør hvis forhandleren avviser» (the objection answers and the reminder), «PDF og redigerbar Word-fil». Add «Saksmappe med tall fra tidligere vedtak» to the list if it is not there, and say so in the summary.

- [ ] **Step 4: Documentation.** In `CLAUDE.md`, under «Tabellen `brevsak`», add a short «Saksmappe» section: where the code lives (`src/lib/mappe/`), that it is computed per request from `vedtak`, the thresholds and the example-quality condition (`KVALIFISERT`), the new `utfylling` fields (`forbehold`, `lignende`, `sjekket`, `sendt`), and the rule «tall vises aldri uten utvalgsstørrelse; under grensen står det "for få saker"». Update `specs/saksmappe.md` so it matches the tests that exist.

- [ ] **Step 5: Final report.** Paste the output of `npm test`, `npm run typecheck`, `npm run test:e2e`. List: what was built, which numbers were checked against the database, what is not reviewed (legal wording — needs a lawyer), what is thin (dealer history, model matches, `feiltyper` precision), and what remains (payment, `tolk-v4`, a complaint document for Forbrukerklageutvalget).

- [ ] **Step 6: Checkpoint** — ask the user whether to commit.
