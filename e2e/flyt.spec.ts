import { expect, type Page, test } from "@playwright/test";

// The whole flow: landing → the questions with the redacted letter beside them → verdict → unlock →
// confirmation → the paid case (/sak/[id]) → the whole letter with a decision. Needs the database
// (DATABASE_URL) and TVISTR_HELT_BREV_UTEN_BETALING=1 for the dev server, so the Vipps button opens the
// case without the app (the payment itself is tested by hand, docs/app.md); the vehicle and company
// registers are stubbed, the ranking and the model are real. Each run saves a case.

// The local date n days ago, YYYY-MM-DD (Swedish writes dates that way).
const dager = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE");
};

async function stubRegistre(page: Page) {
  await page.route("**/api/kjoretoy?**", (r) => r.fulfill({ json: { kjoretoy: { regnr: "AB 12345", merke: "Peugeot", modell: "308", ar: 2014 }, eierFra: dager(100) } }));
  await page.route("**/api/firma?**", (r) =>
    r.fulfill({ json: { forslag: [{ orgnr: "923456783", navn: "BILHUSET VEST AS", adresse: { linjer: ["INDUSTRIVEIEN 4"], postnummer: "1337", poststed: "SANDVIKA" } }] } }),
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

// The screen for the buyer is shown once a dealer sold the car: 11 screens before that, 12 after.
const sporsmal = (page: Page, n: number) => expect(page.locator(".fl-frem-l")).toContainText(new RegExp(`Spørsmål ${n} av ${n === 1 ? 11 : 12}$`));
// A screen of one choice goes on by itself.
const velg = async (page: Page, navn: string | RegExp, neste: number) => {
  await page.getByRole("radio", { name: navn, exact: typeof navn === "string" }).click();
  await sporsmal(page, neste);
};
// A choice in a list of rows (the radio itself is hidden under its label).
const rad = (page: Page, tekst: string) => page.locator("label.vl-r").filter({ hasText: new RegExp(`^${tekst}$`) }).click();
const neste = async (page: Page, n: number) => {
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await sporsmal(page, n);
};

// The twelve screens before payment for AB 12345 with a turbo fault found 20 days ago, up to the verdict.
async function sjekkSaken(page: Page) {
  await sporsmal(page, 1);
  await velg(page, /En bilforhandler/, 2);
  await velg(page, /Privat Jeg kjøpte/, 3);
  await page.locator("#c_reg").fill("AB 12345");
  await page.getByRole("button", { name: "Hent bilen" }).click();
  await expect(page.getByText("Peugeot 308")).toBeVisible();
  await page.locator("#f_c_km").fill("120000");
  await neste(page, 4);
  // The handover date starts as the day the car was registered on its owner.
  await expect(page.locator("#f_c_delivery")).toHaveValue(dager(100));
  await neste(page, 5);
  await velg(page, "Nei", 6);
  await page.getByRole("checkbox", { name: "Motor og eksos" }).click();
  await page.getByRole("checkbox", { name: "Turbo", exact: true }).click();
  await neste(page, 7);
  await page.getByLabel("Når oppdaget du feilen?").fill(dager(20));
  await neste(page, 8);
  await velg(page, /Nei, den bare oppsto/, 9);
  await rad(page, "Nei");
  await neste(page, 10);
  await rad(page, "Nei");
  await neste(page, 11);
  // Not told the dealer yet: nothing to fill in.
  await neste(page, 12);
  await page.locator("label.tile").filter({ hasText: "Retting" }).click();
  await page.getByRole("button", { name: "Se vurderingen" }).click();
  await expect(page.locator(".fl-res h1")).toBeVisible();
}

test("fra forsiden til brevet med et vedtak", async ({ page, browser }) => {
  test.setTimeout(300_000);
  await stubRegistre(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Sjekk saken din gratis" }).first().click();
  await expect(page).toHaveURL(/\/sak$/, { timeout: 30_000 });
  await sjekkSaken(page);

  // Before payment the letter is redacted on the server: bars for the hidden text, and none of the
  // template's own sentences in the page.
  await expect.poll(() => page.locator(".fl-ark .sl").count(), { timeout: 30_000 }).toBeGreaterThan(0);
  expect(await page.content()).not.toContain("Det er dermed dere som må bevise");
  // The closest decision as a card: no link, no quote.
  const kort = page.locator(".fl-kort");
  await expect(kort).toBeVisible({ timeout: 30_000 });
  await expect(kort.locator("a")).toHaveCount(0);

  await page.getByRole("button", { name: /Lås opp hele brevet/ }).click();
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
  // Anyone else with the order number (it is in the receipt) sees only that it is paid.
  const kvittering = page.url();
  const fremmed = await browser.newPage();
  await fremmed.goto(kvittering);
  await expect(fremmed.getByRole("heading", { name: "Takk for handelen!" })).toBeVisible({ timeout: 30_000 });
  await expect(fremmed.getByLabel("Kvittering")).not.toContainText("AB 12345");
  await expect(fremmed.locator("body")).not.toContainText(/Peugeot|Turbo|Du er logget inn/);
  await fremmed.close();
  await page.getByRole("link", { name: "Fortsett til brevet" }).click();
  await expect(page).toHaveURL(/\/sak\/[a-km-np-z2-9]{12}$/, { timeout: 30_000 });
  const lenke = page.url();
  const id = lenke.split("/").pop()!;

  await expect(page.getByRole("heading", { name: "Brevet er låst opp" })).toBeVisible({ timeout: 30_000 });
  // The car is the one bought for: locked, but the mileage can change, and the case is saved as the buyer types.
  const bilen = page.locator("#svar-bilen");
  await bilen.locator(":scope > button").click();
  await expect(page.locator("#c_reg")).toHaveValue("AB 12345");
  await expect(page.locator("#c_reg")).toHaveAttribute("readonly", "");
  await expect(page.locator("#f_c_make")).toBeDisabled();
  await page.locator("#f_c_km").fill("125000");
  await page.waitForTimeout(1500);
  await expect(page.locator(".fl-lagring")).toHaveText("Lagret på kontoen din", { timeout: 15_000 });
  // The link alone does not open the case: another browser must log in.
  const annen = await browser.newPage();
  await tilInnlogging(annen, lenke);
  await annen.close();
  // Saved on the case: the new mileage is there after a reload.
  await page.reload();
  await bilen.locator(":scope > button").click();
  await expect(page.locator("#f_c_km")).toHaveValue(/^125\s000$/);
  await bilen.getByRole("button", { name: "Ferdig" }).click();

  // With no row of the answers open the decision is looked up. Turbo on a used car has many decisions
  // with medhold: the letter must cite one, with quotes and a link.
  const brev = page.locator(".fl-ark");
  const prec = page.locator(".fl-ark .l-prec");
  await expect(prec).toContainText("«", { timeout: 120_000 });
  await expect(prec).toContainText("http");
  await expect(brev).toContainText("Praksis fra");
  // The letter's own conclusion after the decision's paragraph.
  await expect(brev).toContainText(/Min sak bør vurderes på samme måte|Min sak står minst like sterkt/);
  const for_ = await prec.innerText();

  // «Vedtaket» opens «Lignende vedtak»: up to ten, the recommended first; another pick changes the letter on «Ferdig».
  await page.getByRole("button", { name: /^Vedtaket/ }).click();
  const vindu = page.getByRole("dialog", { name: "Lignende vedtak" });
  await expect(vindu).toBeVisible();
  const vk = vindu.locator(".fl-vk");
  await expect(vk.first()).toBeVisible({ timeout: 30_000 });
  expect(await vk.count()).toBeGreaterThanOrEqual(2);
  expect(await vk.count()).toBeLessThanOrEqual(10);
  await expect(vk.first()).toContainText("Anbefalt");
  await expect(vk.first()).toContainText("Slik står det i brevet");
  await vk.nth(1).click();
  await expect(vk.nth(1)).toContainText("Slik står det i brevet");
  await vindu.getByRole("button", { name: "Ferdig" }).click();
  await expect(vindu).toHaveCount(0);
  await expect(prec).not.toHaveText(for_, { timeout: 30_000 });

  // Logged in on a new device (no draft, no tvistr-sak): the same car and fault opens the bought case
  // instead of a second purchase.
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const enhet = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  await enhet.addCookies(await page.context().cookies());
  const ny = await enhet.newPage();
  await stubRegistre(ny);
  await ny.goto("/sak");
  await sjekkSaken(ny);
  await expect(ny.getByText("Du har alt et brev for denne bilen og feilen")).toBeVisible({ timeout: 30_000 });
  await expect(ny.getByRole("button", { name: /Lås opp hele brevet/ })).toHaveCount(0);
  await ny.getByRole("button", { name: "Åpne brevet", exact: true }).click();
  await expect(ny).toHaveURL(/\/sak\/[a-km-np-z2-9]{12}$/, { timeout: 30_000 });
  await expect(ny.getByRole("heading", { name: "Brevet er låst opp" })).toBeVisible({ timeout: 30_000 });
  await enhet.close();

  // The account menu lists the case; «Logg ut» ends the session and the link asks for login again.
  await page.getByRole("button", { name: /^Konto/ }).click();
  const meny = page.locator("#fl-konto-meny");
  const sakRad = meny.locator(`a[href="/sak/${id}"]`);
  await expect(sakRad).toContainText("AB 12345", { timeout: 30_000 });
  await expect(sakRad).toHaveAttribute("aria-current", "page");
  await expect(meny.getByRole("link", { name: "Start en ny sak" })).toBeVisible();
  await meny.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await tilInnlogging(page, lenke);
});

test("brevet finnes bare for en betalt sak", async ({ page }) => {
  expect((await page.goto("/sak/aaaaaaaaaaaa"))?.status()).toBe(404);
  expect((await page.goto("/sak/ikke-en-id"))?.status()).toBe(404);
  expect((await page.goto("/brev"))?.status()).toBe(404);
});
