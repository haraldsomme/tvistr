import { isAllowed, parseRobots } from "./robots";

const MIN_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 6;

export class TilgangSperretError extends Error {}
export class RobotsForbudError extends Error {}

export function userAgent(): string {
  const email = process.env.CONTACT_EMAIL;
  return `TvistrBot/0.1 (+https://tvistr.no${email ? `; ${email}` : ""})`;
}

// innsyn.onacos.no disallows everything in robots.txt, but it is the only public source
// for FKU/FTU decisions before mid-2025. The project owner decided (2026-09-29) to crawl it
// anyway; rate limiting, identification and the stop-on-access-barrier rule still apply.
const ROBOTS_UNNTAK = new Set(["innsyn.onacos.no"]);

let lastRequestAt = 0;
const robotsCache = new Map<string, ReturnType<typeof parseRobots>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function rawFetch(url: string, init?: RequestInit): Promise<Response> {
  await throttle();
  return fetch(url, {
    ...init,
    redirect: "follow",
    headers: { "User-Agent": userAgent(), ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
}

async function robotsFor(origin: string) {
  let rules = robotsCache.get(origin);
  if (rules) return rules;
  const res = await rawFetch(origin + "/robots.txt");
  // A missing robots.txt means everything is allowed; a 5xx means we must not crawl.
  if (res.status >= 500) throw new RobotsForbudError(`robots.txt for ${origin} svarte ${res.status}`);
  rules = res.ok ? parseRobots(await res.text(), "TvistrBot") : [];
  robotsCache.set(origin, rules);
  return rules;
}

function looksLikeAccessBarrier(res: Response, body: string | null): boolean {
  if (res.status === 401 || res.status === 403) return true;
  if (res.url.match(/login|signin|logon/i)) return true;
  if (body && /captcha|recaptcha|hcaptcha|cf-challenge|type=["']password["']/i.test(body)) return true;
  return false;
}

export type Hentet = { status: number; url: string; contentType: string; body: Buffer };

/**
 * Polite GET/POST: obeys robots.txt, max one request every two seconds (process-wide),
 * exponential backoff on network errors, 429 and 5xx, and stops at logins/captchas.
 */
export async function hent(url: string, init?: RequestInit): Promise<Hentet> {
  const u = new URL(url);
  if (!ROBOTS_UNNTAK.has(u.hostname)) {
    const rules = await robotsFor(u.origin);
    if (!isAllowed(rules, u.pathname + u.search)) throw new RobotsForbudError(`robots.txt forbyr ${u.pathname}`);
  }

  let delay = 5000;
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await rawFetch(url, init);
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw e;
      console.warn(`  nettverksfeil (${(e as Error).message}), venter ${delay / 1000}s`);
      await sleep(delay);
      delay *= 2;
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= MAX_ATTEMPTS) throw new Error(`HTTP ${res.status} etter ${attempt} forsøk: ${url}`);
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.max(retryAfter * 1000, delay) : delay;
      console.warn(`  HTTP ${res.status}, venter ${Math.round(wait / 1000)}s`);
      await res.body?.cancel();
      await sleep(wait);
      delay *= 2;
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    const body = Buffer.from(await res.arrayBuffer());
    const text = contentType.includes("html") ? body.toString("utf8") : null;
    if (looksLikeAccessBarrier(res, text)) {
      throw new TilgangSperretError(`Tilgangssperre (HTTP ${res.status}) på ${res.url}. Stopper.`);
    }
    return { status: res.status, url: res.url, contentType, body };
  }
}

export async function hentTekst(url: string, init?: RequestInit): Promise<string> {
  const r = await hent(url, init);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.body.toString("utf8");
}
