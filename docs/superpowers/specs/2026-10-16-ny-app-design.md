# New app: the externally built flow replaces every page

Date: 2026-10-16. Source: the claude.ai artifact «Bilreklamasjon»
(https://claude.ai/artifact/Wk3A7KViL3Dnjr2qAPfENK, one HTML file, saved locally at
`~/.claude/projects/-Users-harald-somme-dev-tvistr/61c97f80-b9d6-4707-9bf7-311314b87b9d/tool-results/artifact-f0db5523-1792176885-2900.html`;
fetch it again with the Artifact tool if that path is gone). Below it is called «the artifact».

## Why

The owner designed and built the whole product flow outside the repo. That artifact is now the app:
its pages, its UI, its questions, its scoring and its letter. What Tvistr has that the artifact only
stubs stays: the decision database, the ranking and the choice of decision, the vehicle and company
lookups, and the measurement events. The artifact's own comments say where it expects the real app to
plug in («The production app swaps this array for its full database», «Replace the three functions
below with real calls»).

The product is still the letter with a won, similar decision (CLAUDE.md). The artifact shows 3 similar
decisions on the verdict page and lets the buyer pick 1 of the top 3 on the letter page.

## Decisions by the owner

1. **The letter is the artifact's letter**, ported (its `buildLetter`, `toHTML`, `toText`). Tvistr's
   server letter (`src/lib/brev/` letter building, `docx.ts`, riktighet, tidslinje rules, golden
   letters) is removed. Exception: the section citing the decision (below).
2. **The verdict is the artifact's scoring**: `evaluate()` with tiers sterk / mulig / svak / utenfor,
   the meter, «Dette sier loven om din sak», plus Tvistr's counts and 3 cases under «Lignende saker».
   Tvistr's `status` (ute/svak/sak), `lovlinjer` and `grunner` are removed.
3. **No links or quotes before payment.** The 3 cards on the verdict page show car, outcome, case
   number and year, and are not links. Quotes and `kilde_url` reach the browser only after payment.
4. **The name stays Tvistr.** Every «Bilreklamasjon» in the artifact becomes «Tvistr».
5. **Rewrite in React**, in the style of the existing code (client components, server actions, plain
   CSS classes or Tailwind as the repo already uses). Not an embedded HTML/JS blob.
6. **The verdict and the letter follow the law version.** The artifact states the rules from
   1.1.2024 (presumption 2 years, «som den er» under § 15 annet ledd / «vesentlig dårligere stand»).
   For purchases before 2024, swap in the rules as they were (presumption 6 months, «som den er» under
   the old § 17), with paragraph numbers and wording from Tvistr's checked tables in `paragrafer.ts`
   (`PARAGRAFER`, `LOVORD`, `lovRef`). Keep the artifact's wording for 2024 and later. This applies to
   `evaluate()` (the «innen to år» factor and its tier effect, the timeline zone) and every sentence of
   `buildLetter()` that names a period or a paragraph. The date that decides it is the purchase date
   (`c_purchase`), falling back to the handover date (`c_delivery`); in the check, the handover date
   stands in (builder's call made in the design: Tvistr keys everything to `kjopsdato`). Tests cover
   one case per tier for each law version.
7. **The check asks for km**: one optional field «Km-stand ved overtakelse» on the car screen, sent
   to `vurderSaken` and carried into the writer by `prefill()` (the artifact already reads `A.km`).
8. **«Before payment» means quotes and links.** Case number, year, car and outcome may show on the
   verdict cards before payment, and the letter may cite one of those same decisions (it usually will:
   both lists come from the top of the same ranking). The «Brukes i brevet» marker stays.

## What is kept from Tvistr, unchanged in behaviour

- `src/lib/matching/` (ranking), `src/lib/vedtaksvalg/` (Sonnet choice + `mal.ts` paragraph),
  `src/lib/feil/kategorier.ts`, the data pipeline (`scripts/` for hent/klassifiser/tolk/feilvurdering/
  avgjorende/statistikk, `src/lib/ai`, `src/lib/feilvurdering`, `src/lib/avgjorende`, `src/db`).
- `/api/kjoretoy` (Vegvesen) and `/api/firma` (Brreg search), `src/lib/brreg.ts`.
- `src/lib/maling.ts` and `/api/hendelse` (events without personal data).
- `PRIS` in `src/lib/pris.ts` replaces the artifact's «kr [PRIS]».
- `src/lib/brev/paragrafer.ts` in full (decision 6).
- Other helpers in `src/lib/brev/` that the kept code imports (`format.ts`,
  `tidslinje.ts`'s `tidsnivaFor`/`plussManeder`, `rapport.ts`'s `RAPPORT_PUNKTER`, `feiltype.ts` if
  still imported). Keep only what is imported after the removal; move them if a better home is obvious.
- Counts and cards from `src/lib/vurdering/vurdering.ts`: `tallblokker`, the card part of
  `byggVurdering` (`kort`, `sammenligning`), `statistikk_kategori`.

## Pages

Three routes instead of the artifact's single page with views (real routes replace its history hack):

| Route | Artifact view | Content |
|---|---|---|
| `/` | `home` | Landing page, as in the artifact. The number of decisions comes from `statistikk_kategori` at build, as `page.tsx` does today. |
| `/sak` | `check` | Intro, the questions one per screen with auto-advance, then the result: verdict card, law rows, «Lignende saker» (Tvistr counts + 3 cards), offer aside, buy modal. |
| `/brev` | `writer` | Tabs Skjema · Vurdering · Brevet, the rail with steps, the paper letter. Only reachable after payment (otherwise redirect to `/sak`). |

`/?regnr=` from the old landing page is not kept; the registration number is asked in the check.

## The check (`/sak`)

The artifact's `QS`, with these changes:

- **Used cars only.** The question «Var bilen ny eller brukt?» is dropped; the case is always `brukt`.
  The «som den er» question is always shown. (Builder's call made in the design: the database covers
  used vehicles only.)
- **Fault categories are Tvistr's** (`HOVEDKATEGORIER` with `under`), not the artifact's `CATS`/
  `ISSUES`/`PARTS`, because the ranking needs Tvistr's ids. Same UI: area chips → observed issues
  (the subcategories) per area → one discovery date per area.
- Car: «Hent bilen» calls `/api/kjoretoy`; make, model, year and the date the car was registered on
  the current owner (`eierFra`) fill in as in the artifact (`lastReg` → suggested handover date).
- Seller privat / leasing / buyer næring stay terminal «utenfor» results (client-side, as now).
- Answers live in `localStorage` like the artifact (keys prefixed `tvistr-`). Nothing is stored on the
  server.

The result calls a server action (the existing `vurderSaken`, trimmed) with categories, dates, km,
model year and «som den er». It returns `tall` and `kort` (no model call, no quotes, no links). The
tier and the law rows are computed in the browser by the ported `evaluate()`. The artifact's
`matchCases`/`CASES`/`simStats` stubs are removed; the «Lignende saker» block renders `tall` (count,
outcome mix bar from heving/prisavslag/retting/erstatning) and `kort` (3 cards, not links), and
`sammenligning` as its compare line.

## Payment

The artifact's buy modal stays. «Gå til betaling» is still a stub: with
`TVISTR_HELT_BREV_UTEN_BETALING=1` it unlocks (as today); otherwise it shows that payment is not
connected yet. Unlocking gives an order id kept in `localStorage`; the server treats a request as paid
by the existing rule (`hentProfil(ordreId)` non-null today; reduce it to a `betalt(ordreId)` check if
the profile is no longer used). On unlock the writer is prefilled from the check (the artifact's
`prefill()`).

## The writer (`/brev`)

The artifact's steps Partene → Bilen → Mangelen → Krav → Brev, the tabs, live letter, checklist, copy
buttons, tone, expenses, attachments by file name, as in the artifact, with:

- No «Ny bil» tile (used only); kjøpsloven branches (`isF()` is always true) are removed.
- Dealer search uses `/api/firma` (Brreg) instead of `DEMO_DEALERS`; picking a hit fills name, org.nr.
  and address. Org.nr. typed in full looks up the dealer the same way.
- The postcode → place lookup is dropped (there is no service for it); the fields are plain inputs.
- The Vurdering tab: `evaluate()` on the writer's answers (the artifact's `writerQ()` + `wsFactors()`)
  and «Lignende saker» from the last `vurderSaken` result, refreshed when categories, dates, km or
  «som den er» change (no model call).

### The decision in the letter (kept Tvistr logic)

The artifact's generic precedent text (`letterPrecBlocks`: p1/p2/p3 from `CASES`) is replaced by
Tvistr's paragraph from `mal.ts`: verbatim quotes, the car, the outcome, the link. The section heading
stays «Tilsvarende sak fra Forbrukerklageutvalget» (use `UTVALG_I_TEKSTEN` if the decision is from
Forbrukertvistutvalget). The toggle «Vis til en lignende sak» stays.

**Top 3:** `finnVedtak` (server action) runs the ranking and the one Sonnet call as today, and returns
3 paragraphs: the model's choice first («Best treff»), then the next two ranked candidates, each built
by the existing fallback path (`tolkSvar` without a model answer → first quotes → `byggAvsnitt`). Each
has saksnummer, date, car, outcome and `kildeUrl`. It returns them only when the request is paid;
otherwise an error. No sealing is needed any more (`signatur.ts` goes). With no candidate the section
is the existing `LOVSETNING` and the picker is hidden.

The input to `byggSaken` maps from the writer: categories + subcategories + discovery date + the
area's description per fault; `opplysning` from «Sa selger noe om denne feilen» (`seller_said`);
`verksted`/`rapport` from the workshop block (`ws`, `ws_says` mapped onto `RAPPORT_PUNKTER`, `ws_quote`
as the conclusion); `krav` from `k_main` (omlevering → retting); `forsok` 0 unless known; «som den er»
from `c_asis`.

`finnVedtak` is called when the Brevet tab opens, and again only when an input above changed since the
last call (one model call per change set, not per keystroke). The picker shows the 3 options as in the
artifact (`renderPrecPick`), with «Les hele vedtaket» linking to `kildeUrl`.

## What is removed

- `src/app/sak/skjema.tsx`, `deler.tsx`, `vurderingsvisning.tsx`, `rens.ts` (+ test), `signatur.ts`
  (+ test), the old `page.tsx` contents of `/` and `/sak`, `maal-visning.tsx` if unused.
- `src/lib/brev/` except the helpers kept above; its tests, fixtures and snapshots; the `docx`
  dependency.
- `src/lib/vurdering/` except counts and cards; `tekst.ts` and the golden assessment fixtures if they
  only test removed code.
- Scripts that only exercise removed code: `brev-praksis`, `brev-jurist`, `ferdig-brevlop`,
  `vurdering-gylne`, `ferdig-vurdering`, and their `package.json` entries. Keep `simuler`,
  `ferdig:dekning`, `ferdig:stikkprove` if they still run against the kept code; otherwise remove.
- `src/lib/vipps/profil.ts` shrinks to the payment check.
- Docs replaced: `skjema.md`, `brev.md`, `vurdering.md`, `riktighet.md`, `gammelt-skjema.md` give way
  to one `docs/app.md` describing the flow above. `CLAUDE.md` «Løsningen nå» is rewritten to match.
  `vedtaksvalg.md` and `ferdigkriterier.md` stay (update the top-3 part).

## Measurement

Keep `maal()` events at: check started, result shown (with tier instead of status: `STATUSER` becomes
the artifact's tiers), buy clicked, unlocked, letter copied. Drop events for removed steps.

## Tests

- Vitest: `evaluate()` (one case per tier, plus the utenfor gates), the ported letter (one snapshot
  of the artifact's `sample()` case, and that a placeholder shows for each missing field), the mapping
  writer → `byggSaken`, and `finnVedtak`'s top-3 assembly (choice first, two fallbacks, unpaid → error).
- Keep the ranking and vedtaksvalg tests.
- Playwright: rewrite `e2e/flyt.spec.ts` for landing → check → result (3 cards, no links) → unlock
  (dev flag) → writer → Brevet shows the decision section and the picker switches it.

## Non-goals

- No Vipps integration, no new payment provider.
- No server storage of cases or letters.
- No new car types (new cars, boats).
- No Word export (the artifact has copy only).
- No postcode service.

## Anti-goals

- No quote from a decision and no link to it reaches the browser before payment.
- No legal claim in the verdict or the letter that is wrong for the buyer's law version.
- No sentence in the decision section that is not from the database or `mal.ts` (the old rule:
  never say anything untrue, same category or nothing).
- The UI must not drift from the artifact: same copy (except the name and used-only), same layout,
  same interactions. Where the artifact and this document disagree, this document wins.

## Left to the builder

Component split, where the ported pure functions live (`src/lib/app/` or similar), CSS approach
(port the artifact's CSS as a stylesheet scoped to the new pages, or translate to Tailwind; keep the
look exact), how prefill and localStorage are wired, order of work.
