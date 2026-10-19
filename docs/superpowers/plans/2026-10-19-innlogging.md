# Login with Vipps and «Min side» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A case belongs to the Vipps account that paid for it; the buyer is logged in after paying, finds every letter on «Min side», and comes back on any device with «Logg inn med Vipps».

**Architecture:** The payment already returns the buyer's Vipps `sub`; it is stored on the case. A session is a hashed random token in a new table plus an httpOnly cookie; a second, readable cookie only tells the static pages' header to show «Min side». «Logg inn med Vipps» is plain OpenID Connect (authorization code, `client_secret_basic`, PKCE) against the same sales unit, with its state kept in the database so it survives a return in another browser. Every case read goes through one owner check.

**Tech Stack:** Next.js 16.3.7 App Router (route handlers and server actions set cookies; server components only read), Drizzle on Neon (`neon-http`: `db.batch`, no transactions), `jose` for the `id_token`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-innlogging-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (AGENTS.md). Cookies can be set only in server functions and route handlers.
- Vipps is the only way to log in. A case opens only for the logged-in owner; the link alone is no access. An unknown id and a case with no owner give 404.
- The order number, the receipt link or any other link must never log anyone in by itself.
- No access decision trusts anything from the browser other than the session cookie.
- No new personal data beyond the `sub` and the session.
- Session lifetime 90 days. Login state single use, valid 10 minutes. The one-time login secret on the return page is valid 1 hour after payment, once.
- Login scope `openid` only. Redirect URI `<origin>/logg-inn/vipps`, exactly as registered.
- Header: logged out → «Logg inn»; logged in → «Min side». «Logg ut» is on Min side only. Logging out goes to `/` with no message.
- Copy is Norwegian; comments in code are English, like the surrounding code.
- Ship together with the Vipps payment and the receipt e-mail; nothing is deployed before this is done.

## Review Focus

- **`til` with another site** (`//evil.no`, `https://evil.no`, `/\evil.no`, `javascript:`): login must end on `/min-side`, never off-site. Test in Task 4.
- **A replayed or late login callback** (same `state` twice, or after 10 minutes, or a cookie from the start that differs): the error page, no session. Test in Task 4.
- **The return page opened again** (secret reused, wrong secret, or more than an hour after payment, e.g. from browser history): the confirmation shows but nobody is logged in. Test in Task 5.
- **A paid case without an owner** (`profile.sub` missing from Vipps, or a development case after login exists): 404 for everyone, not «annen Vipps-konto». Test in Task 6.
- **An expired session** (row past `utloper`, cookie still in the browser): treated as logged out everywhere; `/min-side` and `/sak/[id]` send to login. Test in Task 2.

---

### Task 0: Branch and baseline

- [ ] **Step 1:** Ask the owner to commit the uncommitted Vipps payment and receipt work (or agree that it is committed as its own commit first), then `git checkout -b innlogging`.
- [ ] **Step 2:** Run `npm test && npx tsc --noEmit`. Expected: all pass (365 tests at time of writing).

### Task 1: Schema, migration and the trial cases

**Files:**
- Modify: `src/db/schema.ts` (`sak`, `ordre`, two new tables)
- Create: `drizzle/0020_innlogging.sql` (generated, then the deletion appended by hand)

**Interfaces:**
- Produces:
  - `sak.vippsSub: text("vipps_sub")`, nullable, with index `sak_vipps_sub_idx`. Update the `sak` comment: the owner is the Vipps account that paid; the id is no longer the access.
  - `ordre.innloggingHash: text("innlogging_hash")`, nullable: SHA-256 (hex) of the one-time return-page secret.
  - `innlogging` table: `tokenHash text primaryKey` (SHA-256 hex of the cookie token), `sub text notNull`, `opprettet timestamptz notNull defaultNow`, `utloper timestamptz notNull`; index on `sub`.
  - `innloggingStart` table (`innlogging_start`): `state text primaryKey`, `nonce text notNull`, `verifier text notNull`, `til text notNull`, `opprettet timestamptz notNull defaultNow`.
  - Types `Innlogging`, `InnloggingStart` via `$inferSelect`.

- [ ] **Step 1:** Add the columns and tables above.
- [ ] **Step 2:** `npm run db:generate -- --name innlogging`. Expected: `drizzle/0020_innlogging.sql` with the `ALTER TABLE` and `CREATE TABLE` statements.
- [ ] **Step 3:** Append to that file, after a `--> statement-breakpoint`, the owner-approved deletion of the trial cases:
  ```sql
  -- The free trial (17–18 October 2026): cases whose every order is «gratis» are deleted (orders cascade).
  DELETE FROM "sak" WHERE "id" IN (SELECT "sak_id" FROM "ordre" GROUP BY "sak_id" HAVING bool_and("leverandor" = 'gratis'));
  ```
- [ ] **Step 4:** `npm run db:backup` is not needed (the tables are excluded from backups); run `npm run db:migrate`. Expected: «Migreringer er oppdatert.»
- [ ] **Step 5:** `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 6:** Commit `feat(db): eier på saken og innloggingstabeller`.

### Task 2: Sessions

**Files:**
- Create: `src/lib/innlogging/okt.ts`, `src/lib/innlogging/okt.test.ts`

**Interfaces:**
- Consumes: `innlogging` table (Task 1).
- Produces:
  - `OKT = "tvistr_okt"` (httpOnly token), `INNE = "tvistr_inne"` (readable, value `"1"`, only a hint for the header).
  - `OKT_DAGER = 90`.
  - `lagOkt(sub: string): Promise<void>` — 32 random bytes base64url token; inserts `{ tokenHash: sha256hex(token), sub, utloper: now + 90 days }`; sets both cookies with `maxAge` 90 days, `path "/"`, `sameSite "lax"`, `secure` when `NODE_ENV === "production"`, `httpOnly` on `OKT` only. Server functions and route handlers only.
  - `innlogget(): Promise<string | null>` — the `sub` of a live session (`utloper > now`) for the `OKT` cookie, else null. Readable from server components; wrap in React `cache` so one request asks once.
  - `loggUt(): Promise<void>` — deletes the row and both cookies.
  - `sha256hex(s: string): string` (also used in Task 5).

- [ ] **Step 1: Write the failing tests** (mock `next/headers` `cookies()` with a Map-backed store and `@/db` as in `src/lib/vipps/avstem.test.ts`):
  - `lagOkt("sub-1")` inserts a row whose `tokenHash` is `sha256hex` of the `OKT` cookie value (never the token itself), `utloper` 90 days ahead, and sets `OKT` with `httpOnly: true` and `INNE` with `httpOnly` absent/false.
  - `innlogget()` returns `"sub-1"` when the select finds a live row, `null` with no cookie (no db call), `null` when the row is expired (select returns nothing).
  - `loggUt()` deletes by the cookie's hash and deletes both cookies.
- [ ] **Step 2:** `npx vitest run src/lib/innlogging/okt.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/lib/innlogging/okt.ts` with the signatures above (`crypto.randomBytes`, `createHash("sha256")`).
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(innlogging): økter med token i databasen`.

### Task 3: The Vipps Login client

**Files:**
- Create: `src/lib/innlogging/vipps-login.ts`, `src/lib/innlogging/vipps-login.test.ts`
- Modify: `package.json` (`npm install jose`)

**Interfaces:**
- Consumes: env `VIPPS_BASE_URL` (default `https://apitest.vipps.no`), `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET` (the same sales unit as the payment).
- Produces:
  - `oppdag(): Promise<{ authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string }>` — GET `{base}/access-management-1.0/access/.well-known/openid-configuration`, cached in the instance for an hour.
  - `innloggingsUrl(p: { state: string; nonce: string; utfordring: string; redirectUri: string }): Promise<string>` — the authorize URL with `client_id`, `response_type=code`, `scope=openid`, `state`, `nonce`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`, `market=NO`.
  - `byttKode(p: { kode: string; redirectUri: string; verifier: string; nonce: string }): Promise<{ sub: string }>` — POST form `grant_type=authorization_code&code&redirect_uri&code_verifier` with `Authorization: Basic base64(id:secret)`; verifies `id_token` with `jose` `createRemoteJWKSet(jwks_uri)` + `jwtVerify` (`issuer` from discovery, `audience` = client id, RS256), then checks `payload.nonce === nonce`; throws on any failure. Errors are logged without tokens or secrets.
  - `pkce(): { verifier: string; utfordring: string }` — 32 random bytes base64url, S256 challenge.

- [ ] **Step 1: Write the failing tests** (stub `fetch`; make a key pair with `jose` `generateKeyPair("RS256")`, serve its JWK from the stubbed `jwks_uri`, sign test `id_token`s with `SignJWT`):
  - `innloggingsUrl` contains every parameter above, `scope=openid` and the exact `redirect_uri`.
  - `byttKode` sends Basic auth of `id:secret` and `code_verifier`, and returns `{ sub }` for a valid token.
  - `byttKode` throws for a token with the wrong `aud`, the wrong `iss`, an expired `exp`, a different `nonce`, or a signature from another key.
  - `pkce().utfordring` equals base64url(SHA-256(verifier)).
- [ ] **Step 2:** Run `npx vitest run src/lib/innlogging/vipps-login.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with the signatures above.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(innlogging): Vipps Login (OIDC) med jose`.

### Task 4: Login and logout routes

**Files:**
- Create: `src/app/logg-inn/route.ts`, `src/app/logg-inn/vipps/route.ts`, `src/app/logg-inn/feil/page.tsx`, `src/lib/innlogging/flyt.ts`, `src/lib/innlogging/flyt.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3; `innloggingStart` (Task 1).
- Produces:
  - `trygtMal(til: unknown): string` in `flyt.ts` — returns `til` only if it is a string starting with `/`, not `//` or `/\`, without a scheme, else `"/min-side"`.
  - `opprinnelse(request: Request): string` in `flyt.ts` — `x-forwarded-proto` + `x-forwarded-host`/`host`, the same rule as `opprinnelse()` in `src/app/sak/[id]/actions.ts` (which reads `headers()` and stays).
  - `START = "tvistr_start"` cookie (httpOnly, 10 minutes) holding the `state`.
  - `GET /logg-inn?til=<path>` — new `state` and `nonce` (random base64url, ≥ 16 bytes), `pkce()`; insert into `innlogging_start`; set `START`; `302` to `innloggingsUrl` with `redirectUri = opprinnelse + "/logg-inn/vipps"`. Already logged in → `302` to `trygtMal(til)`.
  - `GET /logg-inn/vipps?code&state` (or `?error`) — `DELETE FROM innlogging_start WHERE state = $1 AND opprettet > now() - 10 min RETURNING *` (single use); reject when missing, when `?error`, or when the `START` cookie is present and differs; else `byttKode`, `lagOkt(sub)`, delete `START`, `302` to the stored `til`. Every rejection `302`s to `/logg-inn/feil`.
  - `/logg-inn/feil` — «Innloggingen ble ikke fullført» and a «Prøv igjen» link to `/logg-inn`, in the `Topp` layout like `src/app/betaling/[ref]/page.tsx`.

- [ ] **Step 1: Write the failing tests** in `flyt.test.ts` for `trygtMal`: `"/sak/abcdefghijkm"` kept; `"//evil.no"`, `"/\\evil.no"`, `"https://evil.no"`, `"javascript:alert(1)"`, `""`, `undefined` → `"/min-side"`. And for the callback handler (import `GET` from `src/app/logg-inn/vipps/route.ts` with `@/db`, `next/headers`, `vipps-login` and `okt` mocked):
  - a valid `state` → `byttKode` called with the stored verifier and nonce, `lagOkt("sub-1")`, `302` to the stored `til`;
  - the delete returns nothing (reused or older than 10 minutes) → `302` to `/logg-inn/feil`, no `lagOkt`;
  - `START` cookie differs from `state` → `/logg-inn/feil`;
  - `?error=access_denied` → `/logg-inn/feil`;
  - `byttKode` throws → `/logg-inn/feil`.
- [ ] **Step 2:** Run `npx vitest run src/lib/innlogging/flyt.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the helpers, both route handlers and the error page.
- [ ] **Step 4:** Run the test. Expected: PASS. `npx tsc --noEmit`: no errors.
- [ ] **Step 5:** Commit `feat(innlogging): /logg-inn og tilbakekallet fra Vipps`.

### Task 5: The owner at payment, and logged in after paying

**Files:**
- Modify: `src/lib/vipps/klient.ts` (`Betaling.profile?: { sub?: string }`), `src/lib/vipps/avstem.ts`, `src/app/sak/[id]/actions.ts` (`kjop`), `src/app/deler/kjop.tsx`, `src/app/sak/resultat.tsx`, `src/app/betaling/[ref]/page.tsx`, `src/app/betaling/[ref]/actions.ts`, `src/app/betaling/[ref]/venter.tsx`
- Test: `src/lib/vipps/avstem.test.ts`, `src/app/sak/[id]/actions.test.ts`, create `src/app/betaling/[ref]/actions.test.ts`

**Interfaces:**
- Consumes: `lagOkt`, `innlogget`, `sha256hex` (Task 2); `sak.vippsSub`, `ordre.innloggingHash` (Task 1).
- Produces:
  - `avstem` sets `vippsSub: b.profile?.sub ?? null` in the same `sak` update as `betalt`.
  - `UTVIKLINGSEIER = "utvikling"` exported from `src/lib/vipps/profil.ts`: the owner of development cases (only reachable when `HELT_BREV_UTEN_BETALING()`).
  - `kjop(inn: { sjekk: unknown; samtykke: unknown }): Promise<Kjop>` — `forrige` is gone: the buyer's details come from the logged-in buyer's latest paid case (`innlogget()` → newest `sak` with that `vippsSub`). It makes a secret `n` (24 random bytes base64url), stores `innloggingHash: sha256hex(n)` on the order, and the `url` becomes `/betaling/<ref>?n=<n>` (development) or Vipps' page with `returnUrl` `<origin>/betaling/<ref>?n=<n>`. A development case gets `vippsSub: UTVIKLINGSEIER`.
  - `sjekkBetaling(ref: unknown, n: unknown): Promise<Betalingsstatus>` — as now, and when the order is paid: if `n` is a string, `sha256hex(n)` equals `ordre.innloggingHash`, `ordre.betalt` is less than 1 hour ago and the case has an owner, it clears the hash with a conditional update (`WHERE id = ref AND innlogging_hash = $hash RETURNING`) and, if that returned a row, calls `lagOkt(sak.vippsSub)`. `Bekreftelse` gains `innlogget: boolean` (true when this call or an existing session is the owner's).
  - The page passes `searchParams.n` to `Venter`, which passes it to `sjekkBetaling`.
  - `Kjop` (`kjop.tsx`) loses its `forrige` prop; `resultat.tsx` stops passing it.

- [ ] **Step 1: Write the failing tests:**
  - `avstem.test.ts`: a payment with `profile: { sub: "sub-1" }` puts `vippsSub: "sub-1"` in the `sak` update.
  - `actions.test.ts` (`kjop`): the Vipps order row has a 64-hex `innloggingHash`, and `opprettBetaling`'s `returnUrl` is `https://tvistr.no/betaling/<ref>?n=<n>` where `sha256hex(n)` equals the stored hash; the development case has `vippsSub: "utvikling"` and `url` `/betaling/<ref>?n=…`; with `innlogget()` mocked to `"sub-1"` and a previous case for it, the new form keeps `b_name` from that case; an id passed from the browser is ignored.
  - `betaling/[ref]/actions.test.ts` (`sjekkBetaling`, `avstem` and `okt` mocked):
    - right secret, paid 5 minutes ago → `lagOkt` with the case's owner, once; `bekreftelse.innlogget` true;
    - the same secret again (conditional update returns nothing) → no `lagOkt`;
    - wrong secret, no secret, paid 61 minutes ago, or a case without owner → no `lagOkt`, still `status: "betalt"`, `innlogget` false.
- [ ] **Step 2:** Run `npx vitest run src/lib/vipps src/app/sak src/app/betaling`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the changes above.
- [ ] **Step 4:** Run the tests. Expected: PASS. `npx tsc --noEmit`: no errors.
- [ ] **Step 5:** Commit `feat(innlogging): eier ved betaling og innlogget etter kjøpet`.

### Task 6: Only the owner opens a case

**Files:**
- Modify: `src/lib/sak/db.ts`, `src/app/sak/[id]/page.tsx`, `src/app/sak/[id]/actions.ts` (`finnVedtak`, `lagreSak`)
- Create: `src/app/sak/[id]/annen-konto.tsx`, `src/lib/sak/db.test.ts`, `src/app/min-side/actions.ts`, `src/app/deler/logg-ut.tsx`
- Test: `src/app/sak/[id]/actions.test.ts`

**Interfaces:**
- Consumes: `innlogget()`, `loggUt()` (Task 2).
- Produces:
  - `loggUtHandling(): Promise<void>` (`"use server"`, `src/app/min-side/actions.ts`) → `loggUt()`.
  - `LoggUt` (client, `src/app/deler/logg-ut.tsx`): a secondary `btn` «Logg ut»; on click awaits `loggUtHandling()`, removes `localStorage` `tvistr-sak`, then `window.location.href = "/"`. No message.
  - `hentBetaltSak(id: unknown): Promise<Sak | null>` stays (paid, any owner) for the page's decision.
  - `hentEgenSak(id: unknown): Promise<Sak | null>` — paid, `vippsSub` not null and equal to `await innlogget()`; null otherwise. `finnVedtak` and `lagreSak` use it (their «Brevet er ikke betalt.» / «Fant ikke saken.» messages stay).
  - `/sak/[id]` page: no paid case **or no owner** → `notFound()`; not logged in → `redirect("/logg-inn?til=/sak/<id>")`; logged in as someone else → `<AnnenKonto />`; owner → `<Skriver>` as now.
  - `AnnenKonto`: in the `Topp` layout, «Denne saken tilhører en annen Vipps-konto. Logg inn med Vipps-kontoen som betalte.» and `<LoggUt />`. Nothing about the case.

- [ ] **Step 1: Write the failing tests:**
  - `db.test.ts`: `hentEgenSak` returns the case when `innlogget()` is its `vippsSub`; null when logged out, when logged in as another `sub`, and when the case has `vippsSub` null (even if `innlogget()` returns a value).
  - `actions.test.ts`: change the `@/lib/sak/db` mock to `hentEgenSak`; `lagreSak` and `finnVedtak` with `hentEgenSak` → null give their existing «not found» answers and write nothing.
- [ ] **Step 2:** Run `npx vitest run src/lib/sak src/app/sak`. Expected: FAIL.
- [ ] **Step 3:** Implement `hentEgenSak`, the page's four outcomes and `AnnenKonto`; switch the two actions.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(innlogging): bare eieren åpner saken`.

### Task 7: Min side, logging out and the header

**Files:**
- Create: `src/app/min-side/page.tsx`, `src/app/deler/konto.tsx`, `src/app/sak/mine.ts`
- Modify: `src/app/til-brevet.tsx` (remove; `page.tsx` uses `Konto`), `src/app/page.tsx`, `src/app/deler/topp.tsx`, `src/app/sak/sjekk.tsx`, `src/app/sak/resultat.tsx`, `src/app/sak/[id]/skriver.tsx`, `src/app/betaling/[ref]/venter.tsx`
- Test: create `src/app/sak/mine.test.ts`

**Interfaces:**
- Consumes: `innlogget`, `INNE` (Task 2); `sak.vippsSub` (Task 1); `LoggUt` (Task 6); `kjopt(id, skjema)` from `src/lib/app/saken.ts`.
- Produces:
  - `Konto` (client, `konto.tsx`): reads `document.cookie` for `INNE` via `useSyncExternalStore` (server snapshot: logged out), renders «Min side» → `/min-side` or «Logg inn» → `/logg-inn?til=/min-side`, styled like today's `TilBrevet` (`btn-sec`). The landing page stays static.
  - `mineKjop(): Promise<Kjopt[]>` (`"use server"`, `src/app/sak/mine.ts`) — the logged-in owner's paid cases as `Kjopt`, newest first; `[]` when logged out.
  - `/min-side` (server): not logged in → `redirect("/logg-inn?til=/min-side")`. Else, in the `Topp` layout: «Dine brev»; «Innlogget med Vipps · <b_name of the newest case>» (or just «Innlogget med Vipps») with `<LoggUt />` on the same line; one card per paid owned case, newest first: `c_make c_model (c_reg)`, the faults by name (`komponentnavn` / the categories' names from `src/lib/feil/kategorier.ts`), «Kjøpt <dato>», link «Åpne brevet» → `/sak/<id>`; at the bottom «Sjekk en ny sak» → `/sak?start`. Empty: «Du har ingen brev på denne Vipps-kontoen.» and a link to the check.
  - Header: `page.tsx` and `Topp` render `<Konto />` next to «Sjekk saken din». `sjekk.tsx`'s «Til brevet» button becomes `<Konto />` behaviour (Min side when logged in, else nothing — the check already has its own call to action).
  - `resultat.tsx`: `tilgang` is true when `sammeSak(a, k)` for `kjopt` or for any `k` in `mineKjop()` (fetched once on mount); the matching case is the one «Åpne brevet» opens.
  - `skriver.tsx`: a link «← Min side» at the top.
  - `venter.tsx` (confirmation): a link «Alle brevene dine finner du på Min side» under «Fortsett til brevet».

- [ ] **Step 1: Write the failing test** `src/app/sak/mine.test.ts` (mock `@/db`, `okt`): `mineKjop()` returns `[]` with no session and the owner's cases as `Kjopt` (id, reg, cats, parts) when logged in, and selects only `vippsSub = sub` and `betalt is not null`.
- [ ] **Step 2:** Run `npx vitest run src/app/sak/mine.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the files above.
- [ ] **Step 4:** Run the test. Expected: PASS. `npx tsc --noEmit` and `npx eslint src`: no errors.
- [ ] **Step 5:** Commit `feat(innlogging): Min side, logg ut og toppen`.

### Task 8: Texts, clean-up and documentation

**Files:**
- Modify: `src/lib/epost/kvittering.ts` (+ its test), `src/app/betaling/[ref]/venter.tsx`, `src/app/vilkar/page.tsx`, `src/app/personvern/page.tsx`, `src/lib/sak/sletting.ts` (+ `src/app/api/slett-saker/route.ts`), `.env.example`, `docs/app.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `innlogging`, `innloggingStart` (Task 1).
- Produces:
  - Receipt e-mail: replace «Ta vare på denne e-posten. Lenken er tilgangen til saken, så ikke del den med andre.» with «Du åpner saken med Vipps-kontoen du betalte med. Alle brevene dine finner du også på Min side.» plus a link to `<TVISTR_URL>/min-side` (HTML and text).
  - Confirmation: replace «… Lenken er tilgangen, så ikke del den med andre.» with «Du er logget inn. Neste gang logger du inn med Vipps.» (when `innlogget`) or «Logg inn med Vipps for å åpne saken.» with a «Logg inn med Vipps» link to `/logg-inn?til=/sak/<id>` (when not).
  - `/vilkar` «Levering»: the case opens when the buyer is logged in with the Vipps account that paid; the link in the e-mail asks for that login.
  - `/personvern`: the summary bullet about cookies becomes «Vi bruker bare én informasjonskapsel som holder deg innlogget, og ingen for sporing.»; a section on login (Vipps id stored on the case, session cookie for 90 days, the hint cookie, logging out deletes the session); «Lenken er tilgangen» sentences removed. Update `oppdatert` to the deployment date.
  - `slettUtlopteInnlogginger(na = new Date()): Promise<number>` in `sletting.ts`: deletes `innlogging` rows with `utloper < na` and `innlogging_start` rows older than 10 minutes; the cron route calls it and logs the count.
  - `docs/app.md`: «Sidene» (add `/min-side`, `/logg-inn`), the paragraph «Lenken er tilgangen» replaced by the owner model, «Betaling», «Tester». `CLAUDE.md`: the app bullet. `.env.example`: a comment that Vipps Login uses the same `VIPPS_CLIENT_ID`/`SECRET`, and the redirect URIs to register.

- [ ] **Step 1: Update the failing test** in `kvittering.test.ts`: the e-mail contains `/min-side` and «Vipps-kontoen du betalte med», and no longer «Lenken er tilgangen».
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Make the text changes and add `slettUtlopteInnlogginger`.
- [ ] **Step 4:** `npm test && npx tsc --noEmit && npx eslint src`. Expected: all pass.
- [ ] **Step 5:** `grep -rn "lenken er tilgangen\|Lenken er tilgangen" src docs/app.md CLAUDE.md`. Expected: no hits.
- [ ] **Step 6:** Commit `docs(innlogging): tekster, personvern og sletting av økter`.

### Task 9: End-to-end and the real Vipps round

**Files:**
- Modify: `e2e/flyt.spec.ts`

- [ ] **Step 1:** Update `e2e/flyt.spec.ts` (development flag, so the purchase logs in as `utvikling`):
  - after «Takk for handelen!»: the header shows «Min side»;
  - the «another browser» block: a fresh page opening `lenke` ends at `/logg-inn` or Vipps' authorize page (`/access-management-1\.0\/access\/oauth2\/auth|\/logg-inn/`), not the form;
  - `/min-side` in the first page lists the case (`AB 12345`), and «Åpne brevet» opens it;
  - «Logg ut» lands on `/`, the header shows «Logg inn», and `lenke` now redirects to login;
  - `"brevet finnes bare for en betalt sak"` keeps its three 404s.
- [ ] **Step 2:** `npx playwright test`. Expected: 4 passed (desktop and mobil).
- [ ] **Step 3 (owner, once Login is activated and the redirect URIs are registered):** `npx next build && npx next start -p 3001`; buy at `http://localhost:3001/sak` with the test user (approve sharing and payment in Vipps MT) → confirmation says «Du er logget inn» → Min side lists the case. In a private window open the e-mail's link → «Logg inn med Vipps» → back on the case. `npm run vipps -- siste` shows the order paid; `sak.vipps_sub` is set.
- [ ] **Step 4:** Commit `test(innlogging): e2e med innlogging og Min side`.
