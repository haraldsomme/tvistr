# Login with Vipps and «Min side»

Date: 2026-10-19. Builds on the Vipps payment (`docs/app.md`, «Betaling») and the receipt e-mail
(`src/lib/epost/kvittering.ts`).

## Why

Today the link to a case is the access: whoever has `/sak/<id>` can open and edit the case. A buyer
who loses the link loses the letter, and a forwarded receipt gives the case away. The owner wants the
buyer's Vipps account to be the account: a buyer is logged in after paying, finds every letter they
have bought on «Min side», and can come back on any device with «Logg inn med Vipps».

## What the buyer experiences

1. **Buying.** Unchanged up to Vipps. After paying, the buyer lands on the confirmation
   (`/betaling/[ref]`) and is now **logged in** in that browser, without doing anything more.
2. **The header.** «Sjekk saken din» stays the main button. Next to it, where «Til brevet» is today
   (landing header, `src/app/til-brevet.tsx`; the check's «Til brevet» button in
   `src/app/sak/sjekk.tsx`), a visitor who is not logged in sees a quiet **«Logg inn»**, and a logged-in
   buyer sees **«Min side»**. «Logg ut» is not in the header: there is room for two buttons on a phone,
   and a «Logg ut» next to «Min side» is easy to hit by mistake. The pages that use `Topp`
   (`src/app/deler/topp.tsx`) get the same. (Owner's decision, on my recommendation.)
3. **Min side** (`/min-side`):
   - At the top «Dine brev», a line saying who is logged in («Innlogget med Vipps · <navn>», the name
     from the buyer's latest case, `b_name`; just «Innlogget med Vipps» if there is none), and a
     secondary **«Logg ut»** button on the same line.
   - Below, one card per paid case owned by the logged-in Vipps account, newest first: car and
     registration number, the faults, when it was bought, and «Åpne brevet».
   - At the bottom «Sjekk en ny sak» (the free check, for another car).
   - Empty state: no letters on this Vipps account, with a link to the free check.
4. **Logging out** deletes the session on the server, clears `tvistr-sak` in the browser, and goes
   straight to the landing page, with no message (owner's decision). Vipps' own «Husk meg i
   nettleseren» is Vipps' setting: the next «Logg inn» may then go through without the app.
5. **In the letter** (`/sak/[id]`) a link «← Min side» at the top leads back to the overview.
6. **The confirmation** after paying keeps «Fortsett til brevet» as the main button and adds a link
   «Alle brevene dine finner du på Min side».
7. **The link in the receipt e-mail** still goes to `/sak/<id>`. If the buyer is logged in as the
   owner, the case opens. If not logged in, they are sent to «Logg inn med Vipps» and come straight
   back to the case afterwards (owner's decision: you must log in with Vipps).
8. **Logged in as another Vipps account** (e.g. a spouse who got the forwarded e-mail): no access, a
   short message «Denne saken tilhører en annen Vipps-konto. Logg inn med Vipps-kontoen som betalte.»,
   with a «Logg ut» so they can log in with the right account. Nothing about the case is shown.
9. **Coming back later** on another phone or PC: «Logg inn» → Vipps → Min side.

## Decisions by the owner

1. Vipps is the only way to log in. No passwords, no Tvistr account to create.
2. A case opens only for the logged-in owner. **The link alone is no longer the access.**
3. The receipt link logs in by way of the Vipps login, not by itself.
4. Cases from the free trial (17–18 October, `ordre.leverandor = 'gratis'`) stop working and are
   deleted. Cases with no owner do not open.
5. Vipps payment, the receipt e-mail and login go live together, so no real buyer ever has a paid case
   without an owner. The payment work stays undeployed until login is done.

## Facts from the Vipps documentation (researched 2026-10-19)

- **Same user id for payment and login.** Vipps gives each user one `sub` per sales unit (MSN): «there
  can only be one `sub` per sales unit». It does not change when the user withdraws and grants consent
  again; it changes only if the user deletes their Vipps profile. The payment already returns it as
  `profile.sub` (GET payment) and `sub` (webhook), because the payment asks for profile sharing
  (`PROFIL` in `src/lib/vipps/klient.ts`). So: **activate Login on the same ecom sales unit we pay
  with**, and the login's `sub` equals the payment's `sub`.
- **Activation.** Login is activated in the business portal on the existing ecom sales unit; no new
  sales unit (one made for Login only cannot take payments). Price is not stated in the docs. Test and
  production have separate keys; the current test keys are used.
- **Protocol.** OpenID Connect, authorization code flow, confidential client.
  - Discovery: `{base}/access-management-1.0/access/.well-known/openid-configuration` (test base
    `https://apitest.vipps.no`, production `https://api.vipps.no`). Fetch and cache the endpoints.
  - Authorize: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state` (≥ 8 chars), optional
    PKCE (`code_challenge`, `S256`), optional `market=NO`.
  - Token: POST form-encoded, `Authorization: Basic base64(client_id:client_secret)`
    (`client_secret_basic` is the default), body `grant_type=authorization_code`, `code`, `redirect_uri`.
    Returns `id_token` (RS256, keys at the JWKS endpoint) and an opaque `access_token`. No refresh tokens.
  - The `id_token` must be validated (signature, `iss`, `aud`, `exp`, `nonce`) before use.
- **Redirect URIs** are registered in the business portal and must match exactly; `localhost` is
  allowed; no wildcards (each preview URL needs its own entry, or previews skip login testing).
- **User experience.** On a PC the user types their number, confirms in the app and may tick «Husk meg
  i nettleseren», which skips the app next time. On a phone they go to the app. Login must run as a
  redirect in the browser (no iframe, avoid new windows). Users must be 15 or older.

## The how, as decided

- **The owner of a case is a Vipps `sub`**, stored on the case (`sak.vipps_sub`, new column, indexed).
  `avstem` (`src/lib/vipps/avstem.ts`) stores `profile.sub` from the GET payment in the same batch that
  sets `sak.betalt`. The one Vipps-paid case from testing (`xtjyanckbntu`) can be backfilled from Vipps
  within 7 days of payment, or left ownerless.
- **A session** is a row in a new table (e.g. `innlogging`: hashed token, `sub`, created, expires) and an
  httpOnly, Secure, SameSite=Lax cookie with the token. Server-side rows make «Logg ut» real and let the
  nightly job delete expired sessions. Lifetime 90 days (my call). The cookie is strictly necessary for
  a service the user asked for, so it needs no consent banner (ekomloven § 3-15), but the privacy page
  must stop saying «vi bruker ikke informasjonskapsler».
- **Logged in after paying, without anyone else being able to do it.** The confirmation page cannot log
  in on the order reference alone: the reference is printed in the receipt as «Ordrenummer», so a
  forwarded e-mail would log the recipient in. Instead `kjop` puts a one-time secret in Vipps'
  `returnUrl` (e.g. `/betaling/<ref>?n=<secret>`), stores only its hash on the order, and the return page
  logs in only with that secret, once, and only within an hour of payment (my call). Without a valid
  secret the confirmation still shows, but with «Logg inn med Vipps» to open the case.
- **Access check.** `hentBetaltSak` (`src/lib/sak/db.ts`) and every caller (`/sak/[id]` page,
  `lagreSak`, `finnVedtak`, `kjop`'s `forrige`) take the session's `sub` and return the case only if
  `sak.vipps_sub` equals it. `/sak/[id]` distinguishes three answers for the page: not logged in →
  redirect to login with the case as the return path; logged in as someone else → the «annen
  Vipps-konto» page; owner → the writer. An unknown id still gives 404.
- **`kjop` and the previous buyer.** Today `forrige` (from localStorage `tvistr-sak`) copies the buyer's
  details from their previous case. With login, `kjop` uses the logged-in buyer's latest case instead,
  and no longer trusts an id from the browser.
- **Login routes.** `/logg-inn?til=<path>` starts the flow (state, nonce and PKCE verifier in a
  short-lived httpOnly cookie; `til` must be a same-site path). `/logg-inn/vipps` is the registered
  `redirect_uri`: exchange the code, validate the `id_token`, create the session, redirect to `til`
  (default `/min-side`). `POST /logg-ut` deletes the session. Scope: `openid` only (we need only `sub`;
  name and address already come with the payment). If Vipps answers with an error or the user cancels,
  show a short message with «Prøv igjen».
- **Development.** With `TVISTR_HELT_BREV_UTEN_BETALING=1` (never in production) the purchase without
  Vipps gives the case a development owner and logs the browser in as it, so `e2e/flyt.spec.ts` still
  runs through confirmation → letter without Vipps.
- **The trial cases.** A one-off deletion of cases whose orders are all `leverandor = 'gratis'`
  (`GRATIS` stays as a switch but would need the owner rule revisited before it is ever turned on again).
- **Texts that must change** (each states the link is the access today): the receipt e-mail and the
  confirmation page («Lenken er tilgangen …» → log in with Vipps to open the case), `/vilkar`
  («Levering»), `/personvern` (cookies, Vipps Login, the stored `sub`, the session), `docs/app.md`,
  `CLAUDE.md`.

## Calls made after the builder check (mine, for the owner to check)

- **The login may come back in another browser.** On a phone the Vipps app may return the user to the
  default browser instead of the one that started (the payment already has this, see
  `src/app/betaling/[ref]/page.tsx`). So the login's state, nonce and PKCE verifier live in the database,
  keyed by `state`, single use, valid 10 minutes, and the session is created in whichever browser
  returns. The cookie from the start is checked when present. The trade-off (someone could, in theory,
  get another person's browser logged in to *their own* account) is accepted: it exposes nothing of the
  victim's.
- **The check knows a logged-in buyer's cases.** When logged in, the check's «Du har tilgang / Åpne
  brevet» (`resultat.tsx`, `sammeSak`) and «Til brevet» (`sjekk.tsx`) are decided from the buyer's cases
  on the server, not only from `tvistr-sak` in the browser, so nobody pays twice for the same car and
  faults on a new device. «Logg ut» clears `tvistr-sak`.
- **Locked-out buyers get a refund, not a transfer.** A buyer who cannot get in (paid with someone else's
  Vipps, deleted their Vipps profile) is refunded through support (`npm run vipps -- refunder`), as the
  terms already promise when the letter does not work. No tool to move a case to another account now.

## Goals

- A buyer can always get back to their letters with nothing but their Vipps.
- A forwarded e-mail or link never gives access to someone else's case.
- Buying stays as quick as today: no extra login step right after paying.

## Non-goals

- Logging in without having bought anything has nothing to show; it is allowed, Min side is just empty.
- No sharing a case with someone else (a lawyer, a spouse). Not asked for.
- No names, profile page or settings on Min side beyond the list and «Logg ut».

## Anti-goals

- The order number or any link in the receipt must never log anyone in by itself.
- No access decision may trust anything from the browser other than the session cookie.
- No new personal data stored beyond the `sub` and the session.

## Left to the builder

- Table and column names, the session token format, how the OIDC client is built (a small library such
  as `jose` for the JWKS check is fine; no full auth framework is needed).
- Whether Next.js `proxy.ts` or per-page checks enforce login (read `node_modules/next/dist/docs/`
  first; this Next.js has breaking changes).
- The exact look of Min side, the login error page and the «annen konto» page, following the existing
  pages (`Juridisk`, `Topp`, the confirmation page).

## Before it can be tested (owner's steps)

1. Activate Login on the ecom sales unit in the business portal (test first, then production).
2. Register the redirect URIs: `http://localhost:3000/logg-inn/vipps`, `http://localhost:3001/logg-inn/vipps`,
   and `https://tvistr.no/logg-inn/vipps`.
