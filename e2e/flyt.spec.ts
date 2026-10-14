// The whole flow before the paywall, from the landing page to step 7 (docs/ferdigkriterier.md, «Før
// betalingsmuren»), at desktop and mobile width, with one case per status. The vehicle registry and the
// seller search are mocked in the browser, so the cases do not depend on a real registration number;
// the server's own calls (the database, Brreg by org.nr. and, in step 7, the model) are real.
//
//   npm run dev   (TVISTR_HELT_BREV_UTEN_BETALING=1 in .env.local for the paid letter)
//   npx playwright test
import { expect, type Page, test } from "@playwright/test";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const idag = new Date();
const maanederSiden = (m: number) => {
  const d = new Date(idag);
  d.setUTCMonth(d.getUTCMonth() - m);
  return iso(d);
};
// The first of this month, or of last month in the first days of a month, so the day is in the past
// and in the calendar that opens.
const forsteIManeden = () => {
  const d = new Date(Date.UTC(idag.getUTCFullYear(), idag.getUTCMonth(), 1));
  if (idag.getUTCDate() < 3) d.setUTCMonth(d.getUTCMonth() - 1);
  return iso(d);
};

// A real dealer, so the server finds it in the Enhetsregister when it addresses the letter.
const SELGER = { orgnr: "925354627", navn: "MØLLE BIL AS", kommune: "INDRE ØSTFOLD", bransje: "Bilhandel", naeringskode: "45.111", status: null, adresse: null, forretningsadresse: null };

type Sak = { navn: string; status: "sak" | "svak" | "ute"; kjopt: string; hoved: string; under: string };
const SAKER: Sak[] = [
  { navn: "du kan ha en sak", status: "sak", kjopt: maanederSiden(5), hoved: "Motor og eksos", under: "Turbo" },
  { navn: "saken står svakt (slitedel etter seks måneder)", status: "svak", kjopt: maanederSiden(11), hoved: "Girkasse, clutch og drivlinje", under: "Clutch" },
  { navn: "fristen er ute", status: "ute", kjopt: maanederSiden(70), hoved: "", under: "" },
];

async function mockApi(page: Page, kjopt: string) {
  await page.route("**/api/kjoretoy?*", (r) => r.fulfill({ json: { kjoretoy: { regnr: "EK 48213", merke: "Volkswagen", modell: "Golf", ar: 2019, bruktimportert: false }, eierFra: kjopt } }));
  await page.route("**/api/firma?*", (r) => r.fulfill({ json: { forslag: [SELGER] } }));
}

async function ingenSideveisRulling(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function velgDato(page: Page, etikett: string, dato: string, mobil: boolean) {
  if (mobil) return page.getByLabel(etikett).fill(dato);
  await page.getByRole("button", { name: etikett }).click();
  await page.locator(`[data-day="${dato}"]:not([data-outside]) button`).click();
}

for (const s of SAKER)
  test(`regnr → vurdering → forhåndsvisning: ${s.navn}`, async ({ page, isMobile }) => {
    test.setTimeout(180_000);
    await mockApi(page, s.kjopt);
    // Server actions are POSTs with a Next-Action header; before step 7 the only one is the assessment.
    const handlinger: string[] = [];
    page.on("request", (r) => {
      const h = r.headers()["next-action"];
      if (r.method() === "POST" && h) handlinger.push(h);
    });

    const start = Date.now();
    await page.goto("/");
    await page.getByLabel("Registreringsnummer").fill("EK48213");
    await page.getByRole("button", { name: "Sjekk bilen" }).click();

    // 1 Bilen
    await expect(page.getByRole("heading", { name: "Er dette bilen din?" })).toBeVisible();
    await page.getByRole("radio", { name: "Ja, det stemmer" }).click();
    await ingenSideveisRulling(page);
    await page.getByRole("button", { name: "Fortsett" }).click();

    // 2 Kjøpet: the date is suggested from the registry.
    await expect(page.getByRole("heading", { name: "Om kjøpet" })).toBeVisible();
    await page.getByLabel("Km ved kjøp").fill("84000");
    await page.getByLabel("Kjøpesum").fill("189000");
    await page.getByRole("radiogroup", { name: /som den er/ }).getByRole("radio", { name: "Nei" }).click();
    await ingenSideveisRulling(page);
    await page.getByRole("button", { name: "Fortsett" }).click();

    if (s.status === "ute") {
      await expect(page.getByRole("heading", { name: "Fristen for å reklamere er ute" })).toBeVisible();
      await expect(page.getByRole("link", { name: /Forbrukerrådet/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Fortsett til brevet|Betal/ })).toHaveCount(0);
      expect(handlinger).toHaveLength(0);
      await ingenSideveisRulling(page);
      return;
    }

    // 3 Feilen
    await page.getByRole("button", { name: s.hoved }).click();
    await page.getByRole("button", { name: s.under, exact: true }).click();
    await velgDato(page, `Når oppdaget du ${s.hoved}?`, forsteIManeden(), isMobile);
    await ingenSideveisRulling(page);
    await page.getByRole("button", { name: "Se vurderingen" }).click();

    // 4 Vurdering
    await expect(page.locator(`[data-status="${s.status}"]`)).toBeVisible({ timeout: 30_000 });
    const tid = Date.now() - start;
    test.info().annotations.push({ type: "tid til vurdering", description: `${Math.round(tid / 1000)} s` });
    expect(tid).toBeLessThan(120_000);
    expect(handlinger).toHaveLength(1);
    await expect(page.getByRole("heading", { name: "Dette sier loven om din sak" })).toBeVisible();
    await expect(page.locator("[data-lovlinje=bevisbyrde]")).toBeVisible();
    if (s.status === "svak") await expect(page.locator("[data-grunn=slitedel_sen]")).toBeVisible();
    // No quotes and no links to the decisions before payment.
    const vurdering = page.locator("[data-status]");
    expect(await vurdering.locator("a").count()).toBe(0);
    expect(await vurdering.locator("[data-vedtakskort]").evaluateAll((k) => k.map((x) => x.textContent ?? "").join(" "))).not.toMatch(/«(?!som den er»)/);
    await ingenSideveisRulling(page);
    await page.getByRole("button", { name: "Fortsett til brevet" }).click();

    // 5 Detaljer
    await expect(page.getByRole("heading", { name: "Litt mer om feilen" })).toBeVisible();
    await page.getByRole("radiogroup", { name: "Er feilen undersøkt av et verksted?" }).getByRole("radio", { name: "Nei" }).click();
    await page.getByRole("radiogroup", { name: "Sa selger noe om denne feilen før kjøpet?" }).getByRole("radio", { name: "Ingenting" }).click();
    await page.getByRole("button", { name: "Fortsett" }).click();

    // 6 Krav og selger
    await expect(page.getByRole("heading", { name: "Hva krever du, og av hvem?" })).toBeVisible();
    await page.getByRole("radio", { name: /^Retting/ }).click();
    await page.getByRole("group", { name: "Har du reklamert til selger?" }).getByRole("button", { name: "Nei" }).click();
    await page.getByLabel("Søk etter selgeren").fill("Mølle bil");
    await page.getByRole("option").first().click();
    await ingenSideveisRulling(page);
    await page.getByRole("button", { name: "Se brevet" }).click();

    // 7 Forhåndsvisning: the background, and of the decision only the first sentence.
    await expect(page.getByRole("heading", { name: "Lås opp hele brevet" })).toBeVisible({ timeout: 90_000 });
    const brev = page.getByRole("article", { name: "Reklamasjonsbrev" });
    await expect(brev).toContainText("1. Sakens bakgrunn");
    const tekst = (await brev.textContent()) ?? "";
    expect(tekst.replace(/«som den er»/g, "")).not.toMatch(/[«»]/);
    expect(await brev.locator("a").count()).toBe(0);
    expect(await page.content()).not.toMatch(/innsyn\.onacos\.no|forbrukertilsynet\.no\/[^"]*wfdocument/);
    await ingenSideveisRulling(page);

    // With TVISTR_HELT_BREV_UTEN_BETALING=1 the pay button stands in for Vipps: the whole letter.
    const betal = page.getByRole("button", { name: "Betal med Vipps" });
    if (!isMobile && s.status === "sak" && (await betal.isEnabled())) {
      await betal.click();
      await expect(page.getByRole("heading", { name: "Brevet er klart" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("article", { name: "Reklamasjonsbrev" }).locator("a", { hasText: "Les vedtaket" })).toHaveCount(1);
      const nedlasting = page.waitForEvent("download");
      await page.getByRole("button", { name: "Last ned Word" }).click();
      expect((await nedlasting).suggestedFilename()).toMatch(/^reklamasjon-EK48213\.docx$/);
      test.info().annotations.push({ type: "betaling", description: "hele brevet og Word-filen" });
    }
  });
