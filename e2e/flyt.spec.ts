import { expect, type Page, test } from "@playwright/test";

// The whole flow: landing → check → verdict → unlock → writer → letter with a decision. Needs the
// database (DATABASE_URL) and TVISTR_HELT_BREV_UTEN_BETALING=1 for the unlock; the vehicle and company
// registers are stubbed, the ranking and the model are real.

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

const velg = async (page: Page, navn: string | RegExp) => {
  await page.getByRole("radio", { name: navn, exact: typeof navn === "string" }).click();
  // Auto-advance after the choice.
  await page.waitForTimeout(900);
};

test("fra forsiden til brevet med et vedtak", async ({ page }) => {
  test.setTimeout(180_000);
  await stubRegistre(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Sjekk saken din gratis" }).first().click();
  await expect(page).toHaveURL(/\/sak$/, { timeout: 30_000 });

  await velg(page, /En bilforhandler/);
  await velg(page, /Privat Jeg kjøpte/);
  await velg(page, "1 Nei");
  await page.locator("#qReg").fill("AB 12345");
  await page.locator("#qKm").fill("120000");
  await page.getByRole("button", { name: "Hent bilen" }).click();
  await expect(page.getByText("Peugeot 308")).toBeVisible();
  await expect(page.locator("#qDelivery")).toHaveValue(dager(100));
  await page.getByRole("button", { name: "Neste" }).click();
  await page.getByRole("button", { name: "Motor og eksos" }).click();
  await page.getByRole("button", { name: "Turbo", exact: true }).click();
  await page.getByLabel("Oppdaget: Motor og eksos").fill(dager(20));
  await page.getByRole("button", { name: "Neste" }).click();
  await velg(page, /^1 Nei Feilen var ukjent/);
  await velg(page, /Nei, den bare oppsto/);
  await velg(page, /Ikke ennå/);

  await expect(page.locator(".verdict .vbadge")).toBeVisible();
  await expect(page.locator(".sim-cases .sim-c").first()).toBeVisible({ timeout: 30_000 });
  expect(await page.locator(".sim-cases .sim-c").count()).toBeLessThanOrEqual(3);
  await expect(page.locator(".sim-cases a")).toHaveCount(0);

  await page.getByRole("button", { name: "Lås opp brevskriveren" }).click();
  await page.getByRole("button", { name: "Gå til betaling" }).click();
  await expect(page).toHaveURL(/\/brev$/, { timeout: 30_000 });

  await page.getByRole("button", { name: /Neste: Forhandleren/ }).click();
  await page.getByRole("button", { name: /Neste: Bilen/ }).click();
  // The car is the one bought for: locked.
  await expect(page.locator("#c_reg")).toHaveValue("AB 12345");
  await expect(page.locator("#c_reg")).toHaveAttribute("readonly", "");
  await expect(page.locator("#f_c_make")).toBeDisabled();

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
});

test("brevskriveren er stengt uten betaling", async ({ page }) => {
  await page.goto("/brev");
  await expect(page).toHaveURL(/\/sak$/, { timeout: 30_000 });
});
