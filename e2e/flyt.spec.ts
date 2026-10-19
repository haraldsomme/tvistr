import { expect, type Page, test } from "@playwright/test";

// The whole flow: landing → check → verdict → unlock → confirmation → the case's writer (/sak/[id]) → letter with a
// decision. Needs the database (DATABASE_URL) and TVISTR_HELT_BREV_UTEN_BETALING=1 for the dev server, so the
// Vipps button opens the case without the app (the payment itself is tested by hand, docs/app.md); the
// vehicle and company registers are stubbed, the ranking and the model are real. Each run saves a case.

const dager = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function stubRegistre(page: Page) {
  await page.route("**/api/kjoretoy?**", (r) => r.fulfill({ json: { kjoretoy: { regnr: "AB 12345", merke: "Peugeot", modell: "308", ar: 2014 }, eierFra: dager(100) } }));
  await page.route("**/api/firma?**", (r) =>
    r.fulfill({ json: { forslag: [{ orgnr: "923456783", navn: "BILHUSET VEST AS", kommune: null, bransje: null, naeringskode: null, status: null, adresse: { linjer: ["INDUSTRIVEIEN 4"], postnummer: "1337", poststed: "SANDVIKA" }, forretningsadresse: null }] } }),
  );
}

// Logged out, the link ends at our login page or at Vipps' authorize URL (Vipps may then answer with its own error page
// when Login is not activated, so the request itself is checked).
const tilInnlogging = async (page: Page, lenke: string) => {
  const mal = /access-management-1\.0\/access\/oauth2\/auth|\/logg-inn/;
  const sett = page.waitForRequest((r) => mal.test(r.url()), { timeout: 30_000 });
  await page.goto(lenke).catch(() => {});
  await sett;
};

const velg = async (page: Page, navn: string | RegExp) => {
  await page.getByRole("radio", { name: navn, exact: typeof navn === "string" }).click();
  // Auto-advance after the choice.
  await page.waitForTimeout(900);
};

// The free check for AB 12345 with a turbo fault, up to the verdict. `forSiste` runs before the last answer.
async function sjekkSaken(page: Page, forSiste: () => Promise<void> = async () => {}) {
  await velg(page, /En bilforhandler/);
  await velg(page, /Privat Jeg kjøpte/);
  await velg(page, "1 Nei");
  await page.locator("#qReg").fill("AB 12345");
  await page.locator("#qKm").fill("120000");
  await page.getByRole("button", { name: "Hent bilen" }).click();
  await expect(page.getByText("Peugeot 308")).toBeVisible();
  await expect(page.locator("#qDelivery")).toHaveValue(dager(100));
  await page.getByRole("button", { name: "Neste" }).click();
  await page.getByRole("checkbox", { name: "Motor og eksos" }).click();
  await page.getByRole("checkbox", { name: "Turbo", exact: true }).click();
  await page.getByLabel("Oppdaget: Motor og eksos").fill(dager(20));
  await page.getByRole("button", { name: "Neste" }).click();
  await velg(page, /^1 Nei Feilen var ukjent/);
  await velg(page, /Nei, den bare oppsto/);
  await forSiste();
  await velg(page, /Ikke ennå/);
}

test("fra forsiden til brevet med et vedtak", async ({ page, browser }) => {
  test.setTimeout(240_000);
  await stubRegistre(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Sjekk saken din gratis" }).first().click();
  await expect(page).toHaveURL(/\/sak$/, { timeout: 30_000 });
  await sjekkSaken(page);

  await expect(page.locator(".verdict .vbadge")).toBeVisible();
  await expect(page.locator(".sim-cases .sim-c").first()).toBeVisible({ timeout: 30_000 });
  expect(await page.locator(".sim-cases .sim-c").count()).toBeLessThanOrEqual(3);
  await expect(page.locator(".sim-cases a")).toHaveCount(0);

  await page.locator(".offer vipps-mobilepay-button").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Jeg ber om at brevet åpnes med en gang").click();
  await dialog.locator("vipps-mobilepay-button").click();
  // The confirmation: the receipt, the link and the next steps, then on to the letter.
  await expect(page).toHaveURL(/\/betaling\/[a-km-np-z2-9]{12}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Takk for handelen!" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Kvittering")).toContainText("kr 249");
  // The owner, logged in by the return address, gets the case itself.
  await expect(page.getByLabel("Kvittering")).toContainText("AB 12345");
  await expect(page.getByLabel("Lenken til saken")).toContainText("Du er logget inn");
  await expect(page.getByRole("link", { name: "Min side" }).first()).toBeVisible();
  await expect(page.getByLabel("Lenken til saken")).toContainText(/\/sak\/[a-km-np-z2-9]{12}/);
  // Anyone else with the order number (it is in the receipt) sees only that it is paid.
  const kvittering = page.url();
  const fremmed = await browser.newPage();
  await fremmed.goto(kvittering);
  await expect(fremmed.getByRole("heading", { name: "Takk for handelen!" })).toBeVisible({ timeout: 30_000 });
  await expect(fremmed.getByLabel("Kvittering")).toContainText("kr 249");
  await expect(fremmed.getByLabel("Kvittering")).not.toContainText("AB 12345");
  await expect(fremmed.locator("body")).not.toContainText(/Peugeot|Turbo|Du er logget inn/);
  await expect(fremmed.getByRole("link", { name: "Logg inn med Vipps" })).toBeVisible();
  expect(await fremmed.evaluate(() => localStorage.getItem("tvistr-sak"))).toBeNull();
  await fremmed.close();
  await page.getByRole("link", { name: "Fortsett til brevet" }).click();
  await expect(page).toHaveURL(/\/sak\/[a-km-np-z2-9]{12}$/, { timeout: 30_000 });
  const lenke = page.url();

  await page.getByRole("button", { name: /Neste: Forhandleren/ }).click();
  await page.getByRole("button", { name: /Neste: Bilen/ }).click();
  // The car is the one bought for: locked.
  await expect(page.locator("#c_reg")).toHaveValue("AB 12345");
  await expect(page.locator("#c_reg")).toHaveAttribute("readonly", "");
  await expect(page.locator("#f_c_make")).toBeDisabled();

  // The case is saved as the buyer types; the link alone no longer opens it: another browser must log in.
  await page.locator("#f_c_km").fill("125000");
  await page.waitForTimeout(1500);
  await expect(page.locator(".saved")).toHaveText("Lagret", { timeout: 15_000 });
  const annen = await browser.newPage();
  await tilInnlogging(annen, lenke);
  await annen.close();

  await page.getByRole("tab", { name: "Brevet" }).click();
  const brev = page.locator("#letterFull");
  // Turbo on a used car has many decisions with medhold: the letter must cite one, with quotes and a link.
  await expect(page.locator(".l-prec")).toBeVisible({ timeout: 120_000 });
  await expect(brev).toContainText("Praksis fra");
  await expect(page.locator(".l-prec")).toContainText("«");
  await expect(page.locator(".l-prec")).toContainText("http");
  // The letter's own conclusion after the decision's paragraph.
  await expect(brev).toContainText(/Min sak bør vurderes på samme måte|Min sak står minst like sterkt/);
  // The letter tab no longer lists the decisions: they are picked in the Vedtak tab.
  await expect(page.locator(".pp-opt")).toHaveCount(0);
  const for_ = await page.locator(".l-prec").innerText();

  await page.getByRole("tab", { name: "Vedtak" }).click();
  const kort = page.locator(".vk");
  expect(await kort.count()).toBeGreaterThanOrEqual(2);
  expect(await kort.count()).toBeLessThanOrEqual(10);
  await expect(kort.first()).toContainText("Anbefalt");
  await expect(kort.first()).toContainText("%");
  await expect(kort.first()).toContainText("Slik står det i brevet");
  await kort.nth(1).click();
  await expect(kort.nth(1)).toContainText("Slik står det i brevet");
  await page.getByRole("tab", { name: "Brevet" }).click();
  await expect(page.locator(".l-prec")).not.toHaveText(for_);

  // Logged in on a new device (no tvistr-sak): the check holds the pay button until the account's cases
  // are in, then offers the bought case instead of a second purchase.
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const enhet = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  await enhet.addCookies(await page.context().cookies());
  const ny = await enhet.newPage();
  await stubRegistre(ny);
  await ny.goto("/sak");
  await sjekkSaken(ny, async () => {
    await ny.route((u) => u.pathname === "/sak", async (r) => {
      if (r.request().method() === "POST") await new Promise((ferdig) => setTimeout(ferdig, 6000));
      await r.continue();
    });
  });
  // The pay buttons in the offer and the bar (the closed purchase dialog always holds one).
  const betal = ny.locator(".offer vipps-mobilepay-button, .res-bar vipps-mobilepay-button");
  await expect(ny.getByRole("button", { name: "Sjekker kjøpene dine …" }).first()).toBeVisible();
  await expect(betal).toHaveCount(0);
  const apne = ny.locator(".offer").getByRole("button", { name: "Åpne brevet" });
  await expect(apne).toBeVisible({ timeout: 30_000 });
  await expect(betal).toHaveCount(0);
  await apne.click();
  await expect(ny).toHaveURL(/\/sak\/[a-km-np-z2-9]{12}$/, { timeout: 30_000 });
  await enhet.close();

  // Min side lists the case; "Åpne brevet" opens it; "Logg ut" ends the session and the link asks for login again.
  const id = lenke.split("/").pop()!;
  await page.goto("/min-side");
  await expect(page.getByRole("heading", { name: "Dine brev" })).toBeVisible({ timeout: 30_000 });
  const kortet = page.locator("section").filter({ has: page.locator(`a[href$="/sak/${id}"]`) }).last();
  await expect(kortet).toContainText("AB 12345");
  await kortet.getByRole("link", { name: "Åpne brevet" }).click();
  await expect(page).toHaveURL(new RegExp(`/sak/${id}$`), { timeout: 30_000 });
  await page.getByRole("link", { name: "← Min side" }).click();
  await expect(page).toHaveURL(/\/min-side$/);
  await page.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Logg inn" }).first()).toBeVisible();
  await tilInnlogging(page, lenke);
});

test("brevet finnes bare for en betalt sak", async ({ page }) => {
  expect((await page.goto("/sak/aaaaaaaaaaaa"))?.status()).toBe(404);
  expect((await page.goto("/sak/ikke-en-id"))?.status()).toBe(404);
  expect((await page.goto("/brev"))?.status()).toBe(404);
});
