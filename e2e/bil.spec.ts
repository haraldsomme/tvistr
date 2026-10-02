import { expect, KJORETOY, mockKjoretoy, test } from "./fixtures";

// The first step of the assessment asks for the registration number: the vehicle is what the
// assessment and the letter are about, and it is locked once the letter is bought. Statens vegvesen
// is mocked. Nothing here reaches /api/vurder.

const KJOPSDATO = `${new Date().getFullYear() - 1}-03-15`;

test("bilen hentes i første steg, og «Neste» venter på den", async ({ page, skjema }) => {
  await mockKjoretoy(page);
  await page.goto("/vurdering");

  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
  await skjema.velgKjop(KJOPSDATO);
  await skjema.kjopesum.fill("250000");
  await skjema.kmVedKjop.fill("80000");
  // Everything else is answered, but there is no car yet.
  await expect(skjema.nesteKnapp).toBeDisabled();
  await expect(skjema.hentKnapp).toBeDisabled();

  await skjema.regnr.fill("zz 99999");
  await expect(skjema.regnr).toHaveValue("ZZ 99999");
  await skjema.hentKnapp.click();

  await expect(page.getByRole("status")).toHaveText("Testmerke Modell X · 2019 · hentet fra Statens vegvesen");
  await expect(page.getByText(KJORETOY.regnr, { exact: true })).toBeVisible();
  await expect(skjema.nesteKnapp).toBeEnabled();
  // A registration number is personal: it is never in the address.
  expect(decodeURIComponent(page.url()).replace(/\s/g, "")).not.toContain("ZZ99999");

  await page.getByRole("button", { name: "Endre", exact: true }).click();
  await expect(skjema.regnr).toHaveValue("");
  await expect(skjema.nesteKnapp).toBeDisabled();
  // The answers are kept while the car is changed.
  await expect(skjema.kjopesum).toHaveValue("250 000");
});

test("Enter i feltet henter bilen i stedet for å gå videre", async ({ page, skjema }) => {
  await mockKjoretoy(page);
  await page.goto("/vurdering");
  await skjema.velgKjop(KJOPSDATO);
  await skjema.kjopesum.fill("250000");
  await skjema.kmVedKjop.fill("80000");

  await skjema.regnr.fill("ZZ 99999");
  await skjema.regnr.press("Enter");

  await expect(page.getByRole("status")).toContainText("Testmerke Modell X");
  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
});

test("bilen beholdes når siden lastes på nytt", async ({ page, skjema }) => {
  await mockKjoretoy(page);
  await page.goto("/vurdering");
  await skjema.hentKjoretoy("ZZ 99999");
  await expect(page.getByRole("status")).toContainText("Testmerke Modell X");

  await page.reload();
  await expect(page.getByRole("status")).toContainText("Testmerke Modell X");
  await expect(skjema.hentKnapp).toHaveCount(0);
});

test("registreringsnummer som ikke finnes, og Vegvesenet som ikke svarer, gir en melding og lar «Neste» stå", async ({ page, skjema }) => {
  await page.route("**/api/kjoretoy?*", (route) => route.fulfill({ status: 404, json: { feil: "Vi fant ingen kjøretøy med dette registreringsnummeret." } }));
  await page.goto("/vurdering");
  await skjema.velgKjop(KJOPSDATO);
  await skjema.kjopesum.fill("250000");
  await skjema.kmVedKjop.fill("80000");

  await skjema.hentKjoretoy("ZZ 99999");
  await expect(page.getByRole("alert").filter({ hasText: "Vi fant ingen kjøretøy" })).toBeVisible();
  await expect(skjema.regnr).toHaveValue("ZZ 99999");
  await expect(skjema.nesteKnapp).toBeDisabled();

  await page.unroute("**/api/kjoretoy?*");
  await page.route("**/api/kjoretoy?*", (route) => route.fulfill({ status: 502, json: { feil: "Vi fikk ikke kontakt med Statens vegvesen. Prøv igjen om litt." } }));
  await skjema.hentKnapp.click();
  await expect(page.getByRole("alert").filter({ hasText: "Vi fikk ikke kontakt med Statens vegvesen" })).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
});

const FORSLAG = "Hentet fra Statens vegvesen: dagen bilen ble registrert på deg.";

test("kjøpsdatoen foreslås fra registeret når feltet er tomt, og kan rettes", async ({ page, skjema }) => {
  await mockKjoretoy(page, KJOPSDATO);
  await page.goto("/vurdering");
  await expect(skjema.kjopsdato).toHaveValue("");

  await skjema.hentKjoretoy("ZZ 99999");
  await expect(skjema.kjopsdato).toHaveValue(KJOPSDATO);
  await expect(page.getByText(FORSLAG)).toBeVisible();

  // The buyer corrects it: it is theirs from then on.
  await skjema.velgKjop(`${new Date().getFullYear() - 1}-05-20`);
  await expect(page.getByText(FORSLAG)).toHaveCount(0);
  await expect(skjema.kjopsdato).toHaveValue(`${new Date().getFullYear() - 1}-05-20`);
});

test("en kjøpsdato brukeren har skrevet, blir ikke byttet ut av registeret", async ({ page, skjema }) => {
  await mockKjoretoy(page, KJOPSDATO);
  await page.goto("/vurdering");
  await skjema.velgKjop(`${new Date().getFullYear() - 1}-05-20`);

  await skjema.hentKjoretoy("ZZ 99999");
  await expect(page.getByRole("status")).toContainText("Testmerke Modell X");
  await expect(skjema.kjopsdato).toHaveValue(`${new Date().getFullYear() - 1}-05-20`);
  await expect(page.getByText(FORSLAG)).toHaveCount(0);
});

test("forslaget til kjøpsdato følger bilen: byttes bilen, tømmes datoen", async ({ page, skjema }) => {
  await mockKjoretoy(page, KJOPSDATO);
  await page.goto("/vurdering");
  await skjema.hentKjoretoy("ZZ 99999");
  await expect(skjema.kjopsdato).toHaveValue(KJOPSDATO);

  await page.getByRole("button", { name: "Endre", exact: true }).click();
  await expect(skjema.kjopsdato).toHaveValue("");
  await expect(page.getByText(FORSLAG)).toHaveCount(0);
});

test("uten brukbar dato i registeret står kjøpsdatoen tom", async ({ page, skjema }) => {
  for (const eierFra of [null, "2999-01-01", "1985-01-01"]) {
    await page.unroute("**/api/kjoretoy?*");
    await mockKjoretoy(page, eierFra);
    await page.goto("/vurdering");
    await skjema.hentKjoretoy("ZZ 99999");
    await expect(page.getByRole("status")).toContainText("Testmerke Modell X");
    await expect(skjema.kjopsdato).toHaveValue("");
    await expect(page.getByText(FORSLAG)).toHaveCount(0);
    // A new page for the next date: the car is remembered in the tab.
    await page.evaluate(() => sessionStorage.clear());
  }
});
